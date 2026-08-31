# Clunk Foundry Product Rebuild Design

## Status

Approved for implementation by the existing request to proceed with the attached Clunk product rebuild brief.

## Design read

This is an existing-product redesign for game developers and creators. The visual language is an industrial creative workstation: warm paper, graphite ink, Clunk Amber, restrained technical cyan, thin rules, large real assets, and purposeful motion. Marketing surfaces stay airy; authenticated workspaces may be denser.

## Goal

Make Clunk read and work as an AI Game Asset Foundry and Game AssetOps platform whose north star is taking a game asset from idea to Game Ready, while preserving the existing real authoring, byte inspection, evidence, Passport, D1/R2, MCP, CLI, and authentication contracts.

## Product hierarchy

Public and authenticated surfaces use this order:

1. Asset
2. Create
3. Result
4. Game Ready
5. Discover and ship
6. Advanced evidence

Technical evidence is not removed. It is moved behind an understandable Game Ready layer. A score, fixture, or static PASS never becomes player-facing approval without the existing runtime and human-review evidence.

## Existing contracts to preserve

- `packages/core` remains the source of truth for parsing, metrics, policy, optimization, hashes, fresh reinspection, and Passport.
- `/api/generation` continues to create real separate artifacts and return provenance and evidence.
- `/api/reviews` continues to require real review fields and preserves runtime, player-facing, and human decisions separately.
- `/api/marketplace` remains Draft-first and only publishes when the existing publication gate allows it.
- `/api/marketplace/checkout` remains an explicit payment-provider-unconfigured boundary.
- `/api/mcp`, CLI, VS Code, sprite review, collaboration, and Passport behavior remain intact.
- ChatGPT Sites headers remain the live authentication adapter.
- `.openai/hosting.json` remains the Sites binding declaration with `DB` and `ASSETS`.
- Original inputs are never overwritten and raw local inspection bytes are not silently uploaded.

## Architecture

### Public shell

`SiteNav` keeps its existing browser-native link implementation and active-state API, but its visible information architecture becomes:

- Discover -> `/marketplace`
- Create -> `/studio`
- Game Ready -> `/app`
- Developers -> `/connect`
- Pricing -> `/pricing`

Dashboard is removed from public primary navigation and remains inside `WorkspaceShell`. Docs remain reachable from Developers and the footer. The public primary CTA is `에셋 만들기` and the secondary account action is `로그인`.

`SiteShell` receives the same vocabulary in its footer. Existing route slugs stay stable.

### Foundry visual system

Create `app/foundry.css` and import it from the root layout. This isolates the new identity from the 11k-line legacy stylesheet and avoids a blind append or deletion of existing selectors.

The new token group uses:

- `--foundry-bg`, `--foundry-paper`, `--foundry-ink`, `--foundry-muted`, `--foundry-line`
- `--foundry-amber`, `--foundry-amber-strong`, `--foundry-cyan`
- `--foundry-success`, `--foundry-warning`, `--foundry-danger`
- `--foundry-radius-control`, `--foundry-radius-panel`

Light and dark values are declared together. The page has one theme at a time and honors the existing `data-theme` toggle. No new dependency is introduced. Existing Lucide icons are retained because the repository already depends on one icon family.

### Landing

Replace the current evidence-first `app/page.tsx` composition with a product-first composition:

1. Hero: `CLUNK / AI GAME ASSET FOUNDRY`, creation-first headline, two CTAs, and a composed visual using the real tractor PNG plus the real sprite PNG. Any metadata stamp is explicitly labeled sample or fixture.
2. Creation preview: a non-submitting prompt composer that links into `/studio`; it never calls a private API or claims to have generated an asset.
3. Asset shelf: large 2D and 3D previews for currently supported families, using current data and assets.
4. Real flow: Create, Inspect, Review, Draft, with current support boundaries visible.
5. Game Ready: a simple sample score and category state summary with a disclosure for static, runtime, player-facing, human, hashes, reinspection, and Passport details. Sample labels prevent fixture data from being read as a user approval.
6. Discover: curated catalogue preview that links to `/marketplace` and prioritizes asset preview, identity, format, license, and readiness.
7. Developers: MCP/API/CLI/Passport later in the page, limited to facts derived from `product-facts.ts`.
8. Final CTA: creation and asset discovery, not inspection.

No new fake generation, customer, purchase, review, or runtime evidence is added.

### Studio

Keep `AssetCreationWorkbench` as the real interactive authoring surface and preserve its API calls. Reframe `StudioClient` as a workstation:

- top bar: workspace identity, current asset kind, real status;
- left creation rail: asset family, name, license declaration, prompt, target profile;
- center result bay: current real artifact preview or clearly labeled sample state;
- right result inspector: Game Ready summary, format, storage, provenance, and real actions;
- lower context rail: actual workflow, review inputs, Draft action, and advanced evidence.

On narrow screens the three columns stack in the same order: create, preview, result. No forced snap scrolling is added to the workspace.

Only actions backed by current code remain actionable: create, review, inspect, save review, Draft listing, download, Passport/provenance. Future Remix, Retexture, Animate, and variation controls are omitted.

### Discover and asset detail

Keep `/marketplace` and `/marketplace/:slug` route compatibility. Change visible copy and visual ordering to asset-first Discover. Existing public samples and real published listings remain distinct. Cards show preview first, then title, category, readiness, format, license, and technical details. Checkout messaging continues to reflect the real provider boundary.

### Game Ready and workspace

Keep `/app` and `ClunkInspector` behavior. Change the shell title and first-level presentation to `Clunk Game Ready`, with score and issue summary first and advanced evidence below. Do not change Core PASS logic.

Change `DashboardClient` ordering to recent assets and generations first, then Game Ready status, review state, Passport, credits, and collaboration. Preserve all existing loading, auth-required, error, retry, and evidence-lane semantics.

### Provider-neutral authentication

Add `app/auth.ts` with a provider-neutral model:

```ts
type AuthProvider = "chatgpt-sites" | "google" | "github" | "chatgpt-oauth";
type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  fullName: string | null;
  provider: AuthProvider;
};

getCurrentUser(): Promise<AuthUser | null>;
requireUser(returnTo: string): Promise<AuthUser>;
getCurrentIdentity(): Promise<{ provider: AuthProvider; providerAccountId: string } | null>;
signOut(returnTo?: string): string;
```

`SitesAuthAdapter` reads the existing four headers and remains the only live provider. `chatgpt-auth.ts` keeps compatibility exports (`ChatGPTUser`, `getChatGPTUser`, `requireChatGPTUser`, `chatGPTSignInPath`, `chatGPTSignOutPath`) while delegating to the new boundary. Protected pages and `app/api/_lib/clunk.ts` use the provider-neutral functions where practical. No OAuth buttons, OAuth secrets, email-only linking, session table rewrite, or unsafe user identity trust is introduced.

The future identity model and migration rules are documented without adding speculative migrations. If an existing schema extension is not necessary for this task, no D1 migration is created.

### Deployment and documentation

Update README opening, current implementation, and limitations to match the real authoring product. Update site metadata and page metadata to use truthful Foundry/AssetOps positioning. Add `docs/deployment-cloudflare.md` covering a future Sites to direct Workers transition, D1/R2 bindings, secrets, auth migration, database migration, custom domain, and rollback, without executing that migration.

## Error and truth handling

- Public pages never invoke authenticated generation endpoints.
- Loading, empty, unavailable, and error states remain explicit.
- `SAMPLE`, `CONTRACT_FIXTURE`, `PROCEDURAL_AUTHORED`, `GAP`, `NOT_EVALUATED`, and `DEMO MODE` are used where the current implementation requires them.
- The UI never calls a score `production ready` unless the current publication/evidence gate actually says so.
- API failure, missing D1/R2, payment-unconfigured, and environment-unavailable states remain user-visible.
- Existing auth redirects and reserved return-path protection remain unchanged.

## Testing strategy

Before implementation changes, add or update contract tests that assert:

- public navigation exposes Discover, Create, Game Ready, Developers, and Pricing while retaining stable route slugs;
- landing copy and markup describe creation-first Foundry positioning, real asset visuals, and no fake generation;
- Studio still exposes `/api/generation`, `/api/reviews`, `/api/marketplace`, real asset families, and evidence lanes;
- Game Ready and dashboard keep separate evidence states and auth/error/loading states;
- provider-neutral auth delegates to Sites headers and compatibility exports remain available;
- metadata, README, hosting bindings, and Cloudflare migration documentation stay truthful.

Run focused tests after each behavior, then the required gates:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run generation:test
npm.cmd run product:test
npm.cmd run build
npm.cmd test
```

Manual browser checks cover `/`, `/studio`, `/marketplace`, `/app`, `/dashboard`, `/connect`, `/pricing`, `/docs`, and `/login` at 1440x900, 1280x720, 1024x768, 768x1024, and 390x844. Confirm no horizontal overflow, real asset previews, auth redirects, Studio generation flow, review/Draft boundaries, theme, keyboard focus, and reduced motion.

## Out of scope

- Google OAuth, GitHub OAuth, external ChatGPT OAuth
- Remix, Kits, full variant generation, GPU orchestration
- real payments, marketplace purchase fulfillment, or creator marketplace expansion
- direct Cloudflare migration, DNS changes, custom domains, or production destruction
- deleting unrelated dirty or untracked work

## Completion criteria

The implementation is complete only when the new product hierarchy is visible in the public and authenticated surfaces, current real authoring and evidence flows remain intact, provider-neutral auth is in place without weakening Sites auth, Cloudflare/auth documentation is present, responsive and accessible states are verified, required tests/build pass, and any unavailable capability is reported as unavailable rather than simulated.
