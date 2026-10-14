# Spartacus Coach
Private Sites app. Original Spartacus logo and red/charcoal identity; Arabic nutrition prototype and exercise-video studio.

## Build and verify
`node scripts/build-worker.mjs`
`node scripts/validate-artifact.mjs`
`node scripts/test-worker.mjs`

Source is in `public/` and `worker/`; `dist/` is generated. Build embeds all assets in a single Worker. Preserve `.openai/hosting.json` project identity. Source is Git-backed; use the Sites source workflow to commit/push/package and deploy a saved version.

## Runway setup
- Create a Runway Dev account/project and buy API credits in the developer portal. Creative subscription credits are separate.
- Set `RUNWAY_API_KEY` as a hosted secret through Sites environment settings. Never put the key in browser code, source, logs or chat.
- `SPARTACUS_ADMIN_EMAIL` is a hosted secret defining the administrator. Match the platform-verified identity header.
- `RUNWAY_GENERATION_ENABLED` defaults to `false`. Set to `true` only after account/budget setup and an explicit decision to run paid generation; deploy to apply configuration.
- Generation: Gen-4.5, text-to-video, five seconds, 1280:720. Current estimate 60 credits/$0.60 per request before taxes; verify pricing before enabling.

## Storage and review
Sites provisions the `BUCKET` R2 binding. Jobs are JSON records under `jobs/`, MP4s under `videos/`, approved pointers under `approved/`. Generated assets are downloaded when the admin explicitly refreshes a successful task; Runway URLs expire, so refresh within its validity window. The application does not retain provider output URLs.
A named reviewer must attest to checking exercise technique before a saved video is approved. Approved videos appear in the exercise library. The pilot allows at most five submitted job records. Do not increase this limit before reviewing quality, credits, and failures.
An R2 conditional lock and request IDs prevent duplicate paid submissions. A submission with unknown outcome is not retried; inspect Runway before any further generation. A crashed generation handler can leave `generation-lock`; inspect provider requests before clearing it administratively. No automatic recovery that could duplicate charges.

## Verification limits
Tests use mock provider responses and mock R2, including admin checks, Origin checks, disabled generation, duplicate prevention and review gating. No live Runway generation has been tested without a configured key and credits. Nutrition calculations are deterministic USDA-based estimates, not a complete dietetic service. Personal nutrition and training records are session-only; R2 persistence currently covers video jobs/assets only.
The private access boundary must be preserved. Before expanding the audience, retest admin restrictions and serving permissions. R2 persistence is not an independent backup; exports/off-site backups remain to be configured.
