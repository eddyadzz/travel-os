# Technical Debt

Deferred work. Nothing here blocks the demo or a first-client deployment; it is
tracked so it is not forgotten and is tackled after the first demonstration.

## Medium priority

| # | Item | Why it matters | Notes |
|---|------|----------------|-------|
| 1 | **Tenant → Agency/Deployment terminology cleanup** | "Tenant" is SaaS language; each deployment is a dedicated agency, not a tenant in a shared app | Rename only in code/UI copy. No DB table renames before the demo (too risky). Start with user-facing strings, then internal identifiers |
| 2 | **Remove remaining SaaS language from UI** | The product reads as single-agency; leftover "plan/limits/tenants" wording confuses owners | Sweep `PLAN_LIMITS`, plan selectors, `/admin/tenants` labels |
| 3 | **Replace default "TravelOS by Boliflow" branding** | Every deployment ships with the default brand until the client replaces it | Ensure the onboarding wizard and readiness check make branding unmissable |
| 4 | **R2 production validation** | Object storage is implemented but untested against a live bucket | Provide the real `R2_ACCESS_KEY_ID` (currently empty) and verify uploads reach the public URL |

## Lower priority

| # | Item | Notes |
|---|------|-------|
| 5 | Real supplier connectors | MockBeds is the current demo connector; integrate a real channel manager API |
| 6 | Push notifications | In-app + web push for lead/booking/supplier events |
| 7 | Native mobile wrappers | PWA is shipped; native iOS/Android wrappers only if a client asks |
| 8 | AI enhancements | The assistant is rules-based; later add an LLM-backed layer |
| 9 | Additional automation | More scheduled jobs / triggers as real usage surfaces patterns |

## Done / no longer debt

- Server/client boundary (top-level `node:*` imports) — fixed via `.server.ts` split.
- Email dev mode — `RESEND_API_KEY` empty by default so a 403 cannot appear during a demo.
