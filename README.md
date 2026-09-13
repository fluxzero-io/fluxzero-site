<a href="https://fluxzero.io"><img src="https://raw.githubusercontent.com/fluxzero-io/.github/3fa8f79df95d07678a730147bc1bd0402ae660d5/assets/brand/2026-09/repository-header.svg" alt="Fluxzero — The European cloud for AI-built apps" width="1280"></a>

# Fluxzero Website

Source code for the [Fluxzero website](https://fluxzero.io) and [documentation](https://fluxzero.io/docs).

- The marketing site explains Fluxzero to people building products with AI.
- The documentation under `/docs` is the technical layer for developers and coding agents.
- The application is deployed as a Cloudflare Worker.

## Requirements

- Node.js 22 or newer
- pnpm (CI uses version 10)
- A checkout of [`fluxzero-sdk-java`](https://github.com/fluxzero-io/fluxzero-sdk-java) for the SDK-owned documentation

By default, the docs sync expects both repositories to have the same parent directory:

```text
flux/
├── flux-website/
└── fluxzero-sdk-java/
    └── docs/developer/
```

If the SDK repository lives elsewhere, set `FLUXZERO_SDK_DOCS_SOURCE` to its `docs/developer` directory when running development or build commands.

## Local development

Install the dependencies and start the development server:

```bash
pnpm install
pnpm dev
```

The site is then available at <http://localhost:4321>.

`pnpm dev` refreshes the Astro content, copies the current SDK documentation into the site, and starts Astro. The SDK-sourced files under `src/content/docs/docs/` are generated and ignored by Git; edit their source in `fluxzero-sdk-java` instead.

A GitHub token is not required for ordinary local development. The changelog loader can read public releases without authentication, although setting `GITHUB_TOKEN` avoids GitHub's lower anonymous rate limit:

```bash
GITHUB_TOKEN=your_token pnpm dev
```

The local feedback provider defaults to in-memory storage. Testing the deployed GitHub-backed feedback and sign-in flow additionally requires the Cloudflare runtime variables used in production: `FEEDBACK_PROVIDER`, `GITHUB_REPO`, `GITHUB_TOKEN`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, and `COOKIE_SECRET`. Put local Cloudflare secrets in `.dev.vars`; never commit that file.

## Commands

Run commands from the repository root.

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Sync content and SDK docs, then start Astro at `localhost:4321` |
| `pnpm build` | Create the production Worker and static assets in `dist/` |
| `pnpm preview` | Serve the existing production build locally with Wrangler |
| `pnpm sync:docs` | Refresh the generated docs from `fluxzero-sdk-java` |
| `pnpm astro sync` | Refresh Astro content, generated types, and the release cache |
| `pnpm test:changelog` | Run the changelog import regression tests |
| `pnpm test:discovery` | Test the discoverability release checks and source modification dates |
| `pnpm check:discovery` | Check the existing build without rebuilding |
| `pnpm test:llms` | Verify Markdown export, code formatting, and semantic content |
| `pnpm test:product-code` | Compile the page examples and test their behavior with the published SDK (Java 25 and Maven required) |
| `pnpm astro ...` | Run another Astro CLI command |

The production build also generates `dist/llms.txt` and `dist/llms-full.txt` from the rendered core marketing pages. These files are build artifacts; the website HTML remains their source of truth.

The [product-code tests](tests/product-code/README.md) extract all Java examples directly from `/product-code` and exercise their behavior with the real SDK `TestFixture`. They run locally and in CI without an SDK checkout or a running Fluxzero server.

## Project structure

| Path | Contents |
| --- | --- |
| `src/pages/` | Marketing pages and server API routes |
| `src/components/marketing/` | Shared marketing navigation, footer, and UI components |
| `src/content/docs/` | Starlight content collection; SDK-owned docs are synced into its ignored `docs/` directory |
| `public/` | Static assets and marketing styles |
| `scripts/sync-sdk-docs.mjs` | SDK documentation and static changelog sync |
| `scripts/generate-llms.mjs` | Machine-readable marketing-content generation |
| `wrangler.jsonc` | Cloudflare Worker environments, bindings, and production domains |

`src/data/changelog-cache.json` is generated site data. A normal sync or build may update it; commit the change only after confirming that it contains expected public release data and no secrets.

## Build and deployment

Run the same checks used by the deployment workflow before publishing a change:

```bash
pnpm test:changelog
pnpm test:llms
pnpm test:discovery
pnpm test:product-code
pnpm build
```

To run the built Worker locally after that:

```bash
pnpm preview
```

Deployment is automated by [`.github/workflows/build-and-deploy.yaml`](.github/workflows/build-and-deploy.yaml):

- A pull request builds and deploys the `preview` Cloudflare environment.
- A push to `main` builds and deploys the `production` environment at [fluxzero.io](https://fluxzero.io).
- `workflow_dispatch` can start the workflow manually.
- An SDK repository dispatch rebuilds the website when the public MDX documentation changed.

The workflow checks out the SDK docs, installs dependencies with the frozen lockfile, tests the changelog import, builds the site, and deploys it with Wrangler. Deployment credentials are managed as GitHub Actions secrets: `CLOUDFLARE_API_TOKEN`, `CF_GITHUB_APP_CLIENT_ID`, `CF_GITHUB_APP_CLIENT_SECRET`, `CF_COOKIE_SECRET`, and `CF_GITHUB_TOKEN`. Do not replace this process with manually managed local production secrets.

## Search and agent discovery

`scripts/core-pages.mjs` defines the required marketing and documentation routes.
The full `llms.txt` stays self-contained; `llms-full.txt` is an identical compatibility
copy, including the reading guide and links. Both are generated from rendered HTML.

Every build verifies that required pages exist, are in the sitemap and LLM index,
have a self-canonical URL and an incoming internal link, and have no `noindex` meta
tag. Retired routes must not occur in HTML, internal links, sitemap or text exports.
Removing a route lets the deployed site return 404; do not block it in robots.txt,
so crawlers can observe its removal. External search results take time to disappear.

Sitemap `lastmod` values come from the last Git commit touching the page source,
including the SDK source for documentation. CI checks out full history. Unknown
dates are omitted instead of substituting the build date. Shared footer or style
changes do not pretend every page's primary content changed.

After production deployment, IndexNow receives the core and retired URLs. The
script first checks the deployed ownership key, release content and retired-page
status. A failed notification fails that workflow step without rolling back a
successful deployment. Retry the notification with `node scripts/submit-indexnow.mjs`
from the matching build. The public ownership file is not an account credential.
Acceptance means the URLs were received, not that they have been indexed.

Google discovers the sitemap through `robots.txt`. Submit
`https://fluxzero.io/sitemap-index.xml` once in the verified Search Console property,
then use URL Inspection and the Pages report to check indexing after substantive
releases. Do not use the retired Google sitemap-ping endpoint. Search Console
submission requires an authorized property; it is not simulated by the build.

## Changelog

Astro's content sync reconciles the complete public release history from `fluxzero-sdk-java` with `src/data/changelog-cache.json`. It includes semantic versions from `0.1192.0` onward, including prereleases, and excludes drafts and releases without meaningful notes. A GitHub API failure aborts the default build before a partial cache can be written.

## Contributing

Keep marketing copy outcome-first and keep technical implementation details in the docs. Preserve semantic HTML and responsive behavior so both people and machine-readable renderers can understand the site.

Before committing:

1. Run the focused tests for the change.
2. Run `pnpm build`.
3. Inspect any generated changelog-cache change and the relevant passage in `dist/llms-full.txt` when marketing content changed.

## License

This repository uses separate licenses for code and documentation:

- **Website code:** [European Union Public Licence 1.2](./LICENSE.code).
- **Documentation and content:** [CC BY-NC-SA 4.0](./LICENSE.docs).
- **Logos and branding:** All rights reserved.

For licensing questions, contact [alen@fluxzero.io](mailto:alen@fluxzero.io).


---

<p align="center"><strong>Are you a builder or coding agent?</strong><br>We welcome your ideas, issues, and pull requests!</p>

<p align="center">
  <a href="https://github.com/fluxzero-io/fluxzero-sdk-java"><picture><source media="(max-width: 520px) and (prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/fluxzero-io/.github/21a1ad90e2cd306a35b6f7f9f969f500e99dd70a/assets/brand/2026-09/profile/sdk-mobile-dark.svg"><source media="(max-width: 520px)" srcset="https://raw.githubusercontent.com/fluxzero-io/.github/21a1ad90e2cd306a35b6f7f9f969f500e99dd70a/assets/brand/2026-09/profile/sdk-mobile-light.svg"><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/fluxzero-io/.github/21a1ad90e2cd306a35b6f7f9f969f500e99dd70a/assets/brand/2026-09/profile/sdk-dark.svg"><img src="https://raw.githubusercontent.com/fluxzero-io/.github/21a1ad90e2cd306a35b6f7f9f969f500e99dd70a/assets/brand/2026-09/profile/sdk-light.svg" alt="SDK — Connect your code to Fluxzero"></picture></a>
  <a href="https://github.com/fluxzero-io/fluxzero-agent-plugins"><picture><source media="(max-width: 520px) and (prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/fluxzero-io/.github/21a1ad90e2cd306a35b6f7f9f969f500e99dd70a/assets/brand/2026-09/profile/agents-mobile-dark.svg"><source media="(max-width: 520px)" srcset="https://raw.githubusercontent.com/fluxzero-io/.github/21a1ad90e2cd306a35b6f7f9f969f500e99dd70a/assets/brand/2026-09/profile/agents-mobile-light.svg"><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/fluxzero-io/.github/21a1ad90e2cd306a35b6f7f9f969f500e99dd70a/assets/brand/2026-09/profile/agents-dark.svg"><img src="https://raw.githubusercontent.com/fluxzero-io/.github/21a1ad90e2cd306a35b6f7f9f969f500e99dd70a/assets/brand/2026-09/profile/agents-light.svg" alt="Agent plugins — Guide your coding agent"></picture></a>
  <a href="https://github.com/fluxzero-io/fluxzero-cli"><picture><source media="(max-width: 520px) and (prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/fluxzero-io/.github/21a1ad90e2cd306a35b6f7f9f969f500e99dd70a/assets/brand/2026-09/profile/cli-mobile-dark.svg"><source media="(max-width: 520px)" srcset="https://raw.githubusercontent.com/fluxzero-io/.github/21a1ad90e2cd306a35b6f7f9f969f500e99dd70a/assets/brand/2026-09/profile/cli-mobile-light.svg"><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/fluxzero-io/.github/21a1ad90e2cd306a35b6f7f9f969f500e99dd70a/assets/brand/2026-09/profile/cli-dark.svg"><img src="https://raw.githubusercontent.com/fluxzero-io/.github/21a1ad90e2cd306a35b6f7f9f969f500e99dd70a/assets/brand/2026-09/profile/cli-light.svg" alt="CLI — Create, run, and deploy apps"></picture></a>
  <a href="https://github.com/fluxzero-io/fluxzero-dev-server"><picture><source media="(max-width: 520px) and (prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/fluxzero-io/.github/21a1ad90e2cd306a35b6f7f9f969f500e99dd70a/assets/brand/2026-09/profile/dev-server-mobile-dark.svg"><source media="(max-width: 520px)" srcset="https://raw.githubusercontent.com/fluxzero-io/.github/21a1ad90e2cd306a35b6f7f9f969f500e99dd70a/assets/brand/2026-09/profile/dev-server-mobile-light.svg"><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/fluxzero-io/.github/21a1ad90e2cd306a35b6f7f9f969f500e99dd70a/assets/brand/2026-09/profile/dev-server-dark.svg"><img src="https://raw.githubusercontent.com/fluxzero-io/.github/21a1ad90e2cd306a35b6f7f9f969f500e99dd70a/assets/brand/2026-09/profile/dev-server-light.svg" alt="Dev Server — Develop and test locally"></picture></a>
</p>

<p align="center">
  <a href="https://fluxzero.io/">Website</a> &nbsp;·&nbsp;
  <a href="https://fluxzero.io/how-it-works">How it works</a> &nbsp;·&nbsp;
  <a href="https://fluxzero.io/docs">Docs</a> &nbsp;·&nbsp;
  <a href="https://fluxzero.io/about">About us</a> &nbsp;·&nbsp;
  <a href="https://fluxzero.io/contact">Contact us</a>
</p>
