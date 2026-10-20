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

## Global food search (October 2026 pilot)

The Nutrition meal planner now includes a food-search panel powered by a server-side `GET /api/foods/search?q=...` endpoint. Search requires authenticated app access. Open Food Facts is queried live for packaged foods; entries missing energy, protein, carbohydrate or fat per 100 g are excluded rather than guessed. Users choose a result, enter grams and select breakfast/lunch/snack/dinner; the current meal and day totals recalculate. Added foods are session-only and are not yet persisted to a user account.

For USDA FoodData Central, supply `USDA_FDC_API_KEY` as a **server-side hosted secret** and redeploy; never embed an API key in the frontend. Until configured, USDA returns no entries. Sources have different coverage, and homemade Jordanian/Arab dishes and recipe builders are future work; no claim of universal food coverage or clinical nutrition accuracy should be made. Verify source label, per-100-g state and actual edible portion.

**Deployment:** committing to GitHub does not by itself certify deployment of a hosted Sites worker; build/validate/test and publish the changed source through the existing Sites hosting workflow. Test the public search with a signed-in user and confirm `/api/foods/search` and `/food-catalog.js` are served. Never publish food diary data to analytics; the current food search query is sent to the nutrition-data provider but not saved in the app database.
