import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { getEffectiveMarkup, applyMarkup } from "@/lib/markup";
import { computeLeadIntelligence } from "@/lib/api/predictive";
import { computeSupplierRisk } from "@/lib/api/predictive";
import { computeCommandCenter } from "@/lib/api/command";
import type {
  AssistantAdviceItem,
  ManagementAnswer,
  OperationsAdvice,
  PropertyRecommendation,
  SalesRecommendation,
  ScoredLead,
} from "@/lib/types";

const DAY = 86_400_000;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// AI Sales Assistant — recommend properties + markup + draft a quote
// ---------------------------------------------------------------------------

export async function recommendProperties(input: {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  budget?: number;
  preferences?: string[];
}): Promise<SalesRecommendation> {
  const checkIn = new Date(`${input.checkIn}T00:00:00.000Z`);
  const checkOut = new Date(`${input.checkOut}T00:00:00.000Z`);
  const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / DAY));
  const guests = input.adults + input.children;

  const properties = await db.property.findMany({
    where: { status: "ACTIVE" },
    include: {
      rooms: {
        where: { status: "ACTIVE" },
        select: { id: true, name: true, maxAdults: true, extraGuestRate: true },
      },
    },
  });
  const propertyIds = properties.map((p) => p.id);
  const rates = await db.rate.findMany({
    where: {
      propertyId: { in: propertyIds },
      validFrom: { lte: checkIn },
      validTo: { gte: checkOut },
    },
  });

  const recommendations: PropertyRecommendation[] = [];
  for (const property of properties) {
    let best: { rate: number; room: string } | null = null;
    for (const room of property.rooms) {
      const match = rates.find((r) => r.roomId === room.id);
      if (!match) continue;
      const price = Number(match.amount);
      if (!best || price < best.rate) best = { rate: price, room: room.name };
    }
    if (!best) continue;

    const markup = await getEffectiveMarkup({
      propertyId: property.id,
      propertyType: property.type,
      ...(property.supplierId ? { supplierId: property.supplierId } : {}),
    });
    const estimatedTotal = applyMarkup(
      best.rate * nights + Number(property.transferPricePerPerson) * guests,
      markup,
    );

    // Fit score: budget match (50) + guest capacity (30) + rating (20), minus preference misses.
    let fitScore = 40;
    const reasons: string[] = [];
    if (input.budget && estimatedTotal <= input.budget) {
      fitScore += 25;
      reasons.push("Within budget");
    } else if (input.budget) {
      fitScore -= 10;
      reasons.push(`Above budget by ${money(estimatedTotal - input.budget)}`);
    }
    const capacityOk = property.rooms.some((r) => r.maxAdults >= guests);
    if (capacityOk) {
      fitScore += 20;
      reasons.push(`Sleeps ${guests} guests`);
    } else {
      fitScore -= 15;
    }
    fitScore += Math.min(15, Number(property.rating) * 5);

    if (input.preferences?.length) {
      const haystack =
        `${property.name} ${property.highlights.join(" ")} ${property.amenities.join(" ")}`.toLowerCase();
      for (const pref of input.preferences) {
        if (haystack.includes(pref.toLowerCase())) {
          fitScore += 8;
          reasons.push(`Matches "${pref}"`);
        }
      }
    }

    recommendations.push({
      propertyId: property.id,
      name: property.name,
      type: property.type,
      atoll: property.atoll,
      nightlyRate: best.rate,
      estimatedTotal,
      markupPercent: markup,
      fitScore: Math.max(0, Math.min(100, fitScore)),
      reasons,
    });
  }

  recommendations.sort((a, b) => b.fitScore - a.fitScore);
  const top = recommendations.slice(0, 3);
  const bestRec = top[0];

  const quoteDraft = bestRec
    ? `Hi there,\n\nThank you for your enquiry for ${input.adults} adult${input.adults === 1 ? "" : "s"}${input.children ? ` and ${input.children} child${input.children === 1 ? "" : "ren"}` : ""} from ${input.checkIn} to ${input.checkOut} (${nights} nights).\n\nI'd recommend ${bestRec.name} in the ${bestRec.atoll} — rooms from ${money(bestRec.nightlyRate)}/night, estimated ${money(bestRec.estimatedTotal)} all-in. ${bestRec.reasons.join(". ")}.\n\nWould you like me to prepare a formal quote and check availability?\n\nBest regards,\nTravelOS by Boliflow`
    : "No properties match the requested dates right now — let me check with our partners and get back to you.";

  const suggestion = bestRec
    ? `Recommended: ${bestRec.name} (fit ${bestRec.fitScore}/100). Share the quote draft or adjust dates/budget to widen options.`
    : "Widen the date range or raise the budget for more options.";

  return { recommendations: top, quoteDraft, suggestion };
}

// ---------------------------------------------------------------------------
// AI Operations Assistant — supplier follow-ups, contract renewals, deposits
// ---------------------------------------------------------------------------

export async function getOperationsAdvice(): Promise<OperationsAdvice> {
  const [risks, command] = await Promise.all([computeSupplierRisk(), computeCommandCenter()]);
  const items: AssistantAdviceItem[] = [];

  const slowing = risks.filter((r) => r.responseTrend === "slowing");
  for (const s of slowing) {
    items.push({
      type: "supplier-followup",
      targetId: s.supplierId,
      title: `Follow up with ${s.name}`,
      detail: `Response time is slowing (${s.recentResponseHours ?? 0}h recently) — they may need a nudge.`,
      draft: `Subject: Availability update — ${s.name}\n\nDear Reservations Team,\n\nWe've noticed your response times have slowed over the past two weeks. To keep your inventory live on our site, could you confirm the current availability for the next quarter?\n\nYou can update it directly in your supplier portal — no spreadsheets needed.\n\nKind regards,\nTravelOS by Boliflow`,
    });
  }

  const contracts = command.contractsRenewing.filter((c) => c.expiryDays <= 30);
  for (const c of contracts) {
    items.push({
      type: "contract-renewal",
      targetId: c.supplierId,
      title: `Renew contract with ${c.name}`,
      detail: `Contract expires in ${c.expiryDays} day${c.expiryDays === 1 ? "" : "s"}.`,
      draft: `Subject: Contract renewal — ${c.name}\n\nDear Partner,\n\nYour current agreement with TravelOS by Boliflow expires in ${c.expiryDays} days. We'd love to continue working together — shall we set up a call to renew rates and terms?\n\nBest regards,\nTravelOS by Boliflow`,
    });
  }

  for (const d of command.overdueDeposits) {
    items.push({
      type: "deposit-followup",
      title: `Deposit overdue — ${d.reference}`,
      detail: `${d.customer} owes ${money(d.amount)} (${d.ageDays} days old).`,
      draft: `Hi ${d.customer},\n\nJust a friendly reminder that the ${money(d.amount)} deposit for booking ${d.reference} is still outstanding. You can pay securely through your booking portal.\n\nLet us know if you need anything.\n\nBest regards,\nTravelOS by Boliflow`,
    });
  }

  const summary = items.length
    ? `${items.length} action${items.length === 1 ? "" : "s"} suggested — ${slowing.length} supplier follow-up${slowing.length === 1 ? "" : "s"}, ${contracts.length} renewal${contracts.length === 1 ? "" : "s"}, ${command.overdueDeposits.length} deposit chase${command.overdueDeposits.length === 1 ? "" : "s"}.`
    : "No urgent follow-ups right now.";

  return { items, summary };
}

// ---------------------------------------------------------------------------
// AI Management Assistant — answer operational questions
// ---------------------------------------------------------------------------

export async function answerQuestion(question: string): Promise<ManagementAnswer> {
  const q = question.toLowerCase();
  const command = await computeCommandCenter();

  if (q.includes("revenue") || q.includes("expected") || q.includes("month")) {
    return {
      question,
      answer: `Expected revenue this month is ${money(command.monthRevenue.expected)} (${money(command.monthRevenue.confirmed)} confirmed, ${money(command.monthRevenue.profit)} expected profit).`,
      detail: `Based on the forecast for ${command.month}.`,
    };
  }
  if (q.includes("deposit") || q.includes("overdue")) {
    const total = command.overdueDeposits.reduce((s, d) => s + d.amount, 0);
    return {
      question,
      answer: `${command.overdueDeposits.length} overdue deposit${command.overdueDeposits.length === 1 ? "" : "s"} totalling ${money(total)}.`,
      detail: command.overdueDeposits.length
        ? command.overdueDeposits
            .map((d) => `${d.reference} (${d.customer}) — ${money(d.amount)}`)
            .join("; ")
        : "Nothing overdue — collections are on track.",
    };
  }
  if (q.includes("supplier") || q.includes("risk") || q.includes("at risk")) {
    return {
      question,
      answer: `${command.attention.atRiskSuppliers} supplier${command.attention.atRiskSuppliers === 1 ? "" : "s"} at risk, ${command.attention.renewingContracts} contract${command.attention.renewingContracts === 1 ? "" : "s"} renewing within 90 days, ${command.attention.supplierRequests} open update request${command.attention.supplierRequests === 1 ? "" : "s"}.`,
      detail: "See the supplier scorecards for the full reliability ranking.",
    };
  }
  if (q.includes("lead") || q.includes("convert")) {
    const leads = await computeLeadIntelligence();
    return {
      question,
      answer: `${leads.overallConversionRate}% of leads convert overall. Best source: ${leads.bestSource ?? "n/a"} at ${leads.avgLeadValue ? money(leads.avgLeadValue) : "—"} average value.`,
      detail: leads.bySource.map((s) => `${s.source}: ${s.conversionRate}%`).join(" · "),
    };
  }
  if (q.includes("arrival") || q.includes("check-in") || q.includes("upcoming")) {
    return {
      question,
      answer: `${command.arrivals.length} confirmed arrival${command.arrivals.length === 1 ? "" : "s"} in the next 14 days.`,
      detail: command.arrivals.length
        ? command.arrivals.map((a) => `${a.reference} · ${a.customer} · ${a.checkIn}`).join("; ")
        : "No confirmed arrivals.",
    };
  }
  if (q.includes("agent") || q.includes("perform")) {
    const top = command.agents[0];
    return {
      question,
      answer: top
        ? `${top.name} leads with ${top.bookings} bookings, ${money(top.profit)} profit and ${money(top.commission)} commission.`
        : "No assigned bookings yet.",
      ...(command.agents.length
        ? { detail: command.agents.map((a) => `${a.name}: ${a.bookings} bookings`).join(" · ") }
        : {}),
    };
  }
  return {
    question,
    answer:
      "I can help with revenue, deposits, suppliers, leads, arrivals and agent performance. Try 'expected revenue this month'.",
  };
}

// ---------------------------------------------------------------------------
// Lead scoring
// ---------------------------------------------------------------------------

export async function scoreLeads(): Promise<ScoredLead[]> {
  const [leads, intelligence] = await Promise.all([
    db.lead.findMany({
      where: { status: { in: ["NEW", "CONTACTED", "FOLLOW_UP"] } },
      include: { booking: { select: { totalPrice: true } }, quotes: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
    }),
    computeLeadIntelligence(),
  ]);
  const convBySource = new Map(intelligence.bySource.map((s) => [s.source, s.conversionRate]));
  const avgValue = intelligence.avgLeadValue || 2000;

  const scored: ScoredLead[] = leads.map((lead) => {
    let prob = convBySource.get(lead.source) ?? intelligence.overallConversionRate ?? 25;
    const ageDays = Math.max(0, Math.round((Date.now() - lead.createdAt.getTime()) / DAY));
    if (lead.quotes.length > 0) prob += 15;
    if (lead.status === "CONTACTED") prob += 10;
    else if (lead.status === "NEW") prob -= 5;
    if (ageDays > 7) prob -= ageDays / 10; // older leads cool off
    if (lead.booking) prob = 100;

    const value = lead.booking ? Number(lead.booking.totalPrice) : avgValue * (prob / 100);
    const reason =
      lead.quotes.length > 0
        ? "Already quoted — high intent"
        : `Source ${lead.source} converts at ${convBySource.get(lead.source) ?? 25}%`;
    return {
      leadId: lead.id,
      fullName: lead.fullName,
      source: lead.source,
      status: lead.status,
      conversionProbability: Math.round(Math.max(0, Math.min(100, prob))),
      expectedValue: round2(value),
      reason,
    };
  });

  scored.sort((a, b) => b.conversionProbability - a.conversionProbability);
  return scored;
}

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

export const assistantRecommendProperties = createServerFn({ method: "POST" })
  .validator(
    (input: {
      checkIn: string;
      checkOut: string;
      adults: number;
      children: number;
      budget?: number;
      preferences?: string[];
    }) => input,
  )
  .handler(async ({ data }) => recommendProperties(data));

export const assistantOperationsAdvice = createServerFn({ method: "GET" }).handler(async () =>
  getOperationsAdvice(),
);

export const assistantAnswer = createServerFn({ method: "POST" })
  .validator((question: string) => question)
  .handler(async ({ data }) => answerQuestion(data));

export const assistantScoredLeads = createServerFn({ method: "GET" }).handler(async () =>
  scoreLeads(),
);

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
