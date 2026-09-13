import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MarketingBlock } from "@/lib/types";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** A block is shown only when enabled and within its optional date window. */
export function isBlockActive(block: MarketingBlock | undefined): block is MarketingBlock {
  if (!block || !block.enabled || !block.title) return false;
  const today = todayIso();
  if (block.startDate && today < block.startDate) return false;
  if (block.endDate && today > block.endDate) return false;
  return true;
}

/**
 * A homepage marketing / promotional section (Content Block). Renders nothing
 * when disabled — no placeholder, no empty gap.
 */
export function PromotionalBlock({ block }: { block: MarketingBlock | undefined }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !isBlockActive(block)) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div
        className="relative overflow-hidden rounded-3xl px-6 py-10 sm:px-10 sm:py-12"
        style={
          block.backgroundColor
            ? { backgroundColor: block.backgroundColor }
            : { background: "linear-gradient(135deg, var(--primary) 0%, var(--lagoon) 100%)" }
        }
      >
        <button
          type="button"
          aria-label="Close promotion"
          onClick={() => setDismissed(true)}
          className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-black/10 text-muted-foreground transition-colors hover:bg-black/20 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
          {block.image && (
            <img
              src={block.image}
              alt={block.title}
              className="hidden h-40 w-56 shrink-0 rounded-2xl object-cover sm:block"
            />
          )}
          <div className="flex-1">
            <h2
              className="text-2xl font-semibold sm:text-3xl"
              style={{ color: block.backgroundColor ? "inherit" : "var(--primary-foreground)" }}
            >
              {block.title}
            </h2>
            {block.subtitle && (
              <p
                className="mt-2 max-w-xl text-muted-foreground"
                style={
                  block.backgroundColor
                    ? undefined
                    : { color: "var(--primary-foreground)", opacity: 0.9 }
                }
              >
                {block.subtitle}
              </p>
            )}
            {block.buttonLabel && block.buttonUrl && (
              <Button
                asChild
                className="mt-5"
                variant={block.backgroundColor ? "default" : "secondary"}
              >
                {block.buttonUrl.startsWith("/") ? (
                  <Link
                    to={block.buttonUrl}
                    {...(block.openInNewTab ? { target: "_blank", rel: "noreferrer" } : {})}
                  >
                    {block.buttonLabel} <ArrowRight className="size-4" />
                  </Link>
                ) : (
                  <a
                    href={block.buttonUrl}
                    {...(block.openInNewTab ? { target: "_blank", rel: "noreferrer" } : {})}
                  >
                    {block.buttonLabel} <ArrowRight className="size-4" />
                  </a>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
