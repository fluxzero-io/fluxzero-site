# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Core Orientation

This repository is primarily the public **Fluxzero marketing website**, with technical documentation living in the same Astro app.

Default to the marketing site unless the user explicitly asks for documentation work.

- If the user says "site", "website", "homepage", "pricing", "about", "contact", "nav", "footer", "hero", "CTA", "copy", "section", or "marketing", assume they mean the marketing pages.
- Treat the docs as the primary surface only when the user explicitly mentions docs, documentation, Starlight, MDX, guides, tutorials, reference pages, API docs, or paths under `src/content/docs/`.
- The marketing audience is not primarily Java/Kotlin developers. It is people who want to build a product through prompts and AI agents, and who care about the product outcome rather than the machinery underneath.
- The docs are the technical layer for developers, AI agents, and people who want to understand or extend Fluxzero. They support the marketing site, but they are not the default mental model for this repository.

## Common Commands

This is an Astro site using pnpm as the package manager:

- `pnpm install` - Install dependencies
- `pnpm dev` - Start local development server at localhost:4321
- `pnpm build` - Build production site to ./dist/
- `pnpm preview` - Preview production build locally
- `pnpm astro ...` - Run Astro CLI commands (e.g., `pnpm astro check`)

## Product Context

**Fluxzero** is a production-ready foundation for AI-generated and prompt-built software.

Its core promise on the marketing site:

- Builders can describe features, flows, and user experience without repeatedly running into backend, infrastructure, or architecture walls.
- AI agents can spend their prompt budget on product behavior instead of generating commodity backend plumbing.
- Fluxzero handles the foundation underneath: state, persistence, message flow, validation, authorization, scheduling, HTTP/web flows, observability, testing support, and production runtime concerns.
- The result should feel like faster product development with less technical debt, less risk, and fewer tokens spent on infrastructure.

Avoid leading with Java, Kotlin, SDK names, event sourcing, annotations, or internal architecture on marketing pages unless the section is explicitly bridging into technical docs.

### Primary Audiences

- Prompt-first builders who want to build products with AI agents.
- Founders, operators, and product teams who want production-ready software without assembling the entire backend foundation themselves.
- Technical decision makers who want confidence that the generated product has solid architecture underneath.
- Developers and AI agents are a secondary audience for `/docs`, not the default audience for the homepage or pricing page.

## Marketing Site Guidance

Primary marketing files:

- `src/pages/index.astro` - Homepage
- `src/pages/pricing.astro` - Pricing page
- `src/pages/about.astro` - Story/about page
- `src/pages/contact.astro` - Contact page
- `src/components/marketing/MarketingHeader.astro` - Marketing navigation
- `src/components/marketing/MarketingFooter.astro` - Marketing footer
- `public/css/home.css` - Homepage and major marketing section styling
- `public/css/marketing-shell.css` - Shared marketing shell styling

When editing marketing pages:

- Explain Fluxzero as the foundation that lets people build product through prompts without getting stuck on infrastructure.
- Keep copy outcome-first, concise, and concrete.
- Make AI/product-builder benefits prominent: fewer tokens, fewer repeated backend decisions, less risk, better continuity as the product grows.
- Use the technical docs as proof or a "see inside" layer, not as the headline experience.
- Do not assume the reader wants to install an SDK, choose Java/Kotlin, or understand framework internals.
- Keep CTAs focused on starting to build, generating an app, pricing, or contacting Fluxzero.
- Preserve polished responsive behavior. Mobile text must not clip, overlap, or become unnaturally narrow.

### Machine-readable marketing content

The production build generates a self-contained `dist/llms.txt` and a compatibility copy at `dist/llms-full.txt` from the rendered core marketing pages. These files help crawlers and ad-hoc AI agents understand the same product story as human visitors.

- Treat the rendered marketing HTML as the single source of truth. Never hand-edit generated files in `dist/` and do not maintain a separate copy of page content for AI agents.
- Structure content semantically so relationships survive linear or Markdown rendering. Use headings for hierarchy, lists for repeated items, `dl`/`dt`/`dd` for terms, metrics, or key-value groups, and native tables or complete ARIA table roles for comparisons.
- A semantic table must include its header row, row headers, column headers, and cells inside the table structure, even when the visual layout positions the header separately.
- Do not rely on visual order, CSS grid placement, icons, color, or responsive presentation to communicate which value belongs to which label. The DOM order and semantics must remain understandable without CSS.
- Solve new content patterns through correct semantic HTML or a generic renderer capability. Never add parser branches tied to page paths, section names, CSS classes, exact copy, or one specific table/card layout.
- Responsive variants must not cause duplicated machine-readable content. Keep at least one semantically complete variant, and prefer making the primary desktop HTML complete instead of extracting a separate mobile-only representation.
- When a public page contains an authentication wall, ensure the generated text contains the useful post-auth content rather than only the login prompt. Use the generic `data-llms-exclude` and `data-llms-include` visibility controls only when normal HTML visibility would otherwise select the wrong content state.
- When adding or removing a core public marketing page, review the page list in `scripts/generate-llms.mjs` so the generated index remains intentional.
- After changing marketing copy or structure, run the production build and inspect the affected passage in `dist/llms-full.txt`. Verify that headings, labels, values, table cells, links, and post-auth content remain correctly associated and that repeated responsive content appears only once.

### Generated site data

- `src/data/changelog-cache.json` is generated site content, not an unrelated source-code change. A refresh produced by the normal docs sync or build may be committed with other website changes after checking that it contains expected public release data and no secrets.

## Architecture & Structure

This Astro app contains both the marketing site and documentation:

- **Astro 5** for the site
- **Starlight** for `/docs`
- **TypeScript** configuration with strict mode
- **Cloudflare Workers** deployment via Wrangler
- **pnpm** for package management

### Marketing Routes

- `/` - Marketing homepage
- `/pricing` - Pricing
- `/about` - Our story
- `/contact` - Contact

### Documentation Routes

Documentation is organized in `src/content/docs/` with these sections:

- `about/` - Introduction, compatibility, FAQ, use cases
- `get-started/` - Installation, new projects, deployment
- `guides/` - Authentication, validation, testing, HTTP handling
- `reference/` - CLI commands, core components, error codes
- `tutorials/` - Step-by-step tutorials

Content follows the Diataxis Framework (see https://diataxis.fr). Follow those conventions when editing docs content.

### Key Configuration Files

- `astro.config.mjs` - Astro configuration with Starlight integration and Cloudflare adapter
- `src/content.config.ts` - Content collection schema configuration
- `wrangler.jsonc` - Cloudflare Workers deployment configuration
- `tsconfig.json` - TypeScript configuration extending Astro strict preset

### Deployment

- Deployed to Cloudflare Workers
- Production URL: https://fluxzero.io/
- Uses Cloudflare's image service with compile-time Sharp processing
- Edit links point to GitHub repository for contributions

### Development Notes

- Node.js version >=22.0.0 required
- Sharp is used for image processing but only at compile time (Cloudflare limitation)
- TypeScript paths configured with `~/*` alias for `src/*`

## Technical Fluxzero Context

Use this technical context mainly when working on docs, developer-facing explanations, technical proof points, or code examples.

### Fluxzero Components

- **fluxzero-sdk-java** / **fluxzero-kotlin-sdk** - Language-specific SDKs (currently named fluxzero-sdk-java)
- **fluxzero** - Server component
- **fluxzero-proxy** - Proxy component
- **fluxzero-cloud** - Cloud offering
- **fluxzero-cli** - CLI, `fz`

### Core Platform Capabilities

The fluxzero SDK is an event-driven, distributed messaging framework with:

**Message Types & Handling:**

- Commands, events, queries, web requests, schedules
- Annotation-based handlers (`@HandleCommand`, `@HandleEvent`, etc.)
- Location-transparent message routing across services
- Synchronous and asynchronous processing

**Domain Modeling:**

- Aggregate-based entity management with nested entities
- Event sourcing patterns
- Declarative state updates via `@Apply` and `@AssertLegal` annotations
- Immutable domain models

**Infrastructure Features:**

- Built-in validation, authorization, error handling
- WebSocket and HTTP request support
- Comprehensive testing fixtures
- Metrics tracking and scheduling
- User/role-based access control

*Note: Fluxzero is not officially launched yet, so online resources may be limited.*

## Documentation Guidelines

Use these rules when the task is explicitly about documentation content.

**Role & Audience:**

- Act as a professional co-technical writer.
- Target audience: software developers and AI agents.
- Goal: make Fluxzero understandable and convincing for people who want the technical version.

**Content Strategy:**

- Use extensive code examples throughout documentation.
- Examples are always in Java and Kotlin.
- Focus on smooth onboarding experience.
- Integrate flux-cli for local development workflows.
- Suggest online playground options (Replit/CodeSandbox) for experimentation.
- Maintain consistent language and terminology.

**Required Reference:**

- When editing docs or technical code examples, ALWAYS check the latest SDK documentation first: https://raw.githubusercontent.com/fluxzero-io/fluxzero-sdk-java/refs/heads/master/README.md
- When you need to know whether a symbol exists or what options are available, ALWAYS check the latest Javadoc: https://flux-capacitor.io/fluxzero-sdk-java/javadoc/apidocs/
- Use these as the authoritative sources for current SDK capabilities and examples.

## Documentation Patterns & Standards

### Established Example Domain

- **Smart Home/Home Automation** is the primary example domain across all documentation.
- Use consistent entities: Device, Room, Home, SecuritySystem, etc.
- Examples should include: lights, thermostats, security sensors, cameras, motion detectors.
- Device IDs, Room IDs, Home IDs are the primary routing key examples.

### Content Structure Patterns

- **CardGrid with 4 cards** for key concepts introduction.
- **Mermaid diagrams** for architecture visualization (configured for client-side rendering).
- **Real-world analogies** in Aside components to explain complex concepts.
- **Java/Kotlin code tabs** for all code examples.
- **Best practices sections** with numbered guidelines.
- **Troubleshooting sections** with Aside caution components.
- **Related concepts** section linking to other documentation.

### Code Example Standards

- Always provide both Java and Kotlin variants using Tabs component.
- Use smart home domain consistently (Device, Room, Home entities).
- Include practical, complete examples that demonstrate real-world usage.
- Avoid service layer abstractions - show direct business logic.
- Use meaningful method and variable names that reflect the domain.
- Include comments explaining the business logic, not the technical implementation.

### Visual Components

- **Import statement**: `import { Tabs, TabItem, Card, CardGrid, Aside } from '@astrojs/starlight/components';`
- **Mermaid diagrams**: Use for architecture, flow, and relationship visualization.
- **CardGrid**: For key concepts (typically 4 cards with icons).
- **Aside components**: For tips, warnings, cautions, and notes.
- **Performance tables**: For configuration guidelines and comparisons.

### FAQ Structure

- Use collapsible `<details><summary>` for 20+ questions.
- Organize into 5 categories: Getting Started, Technical Architecture, Development & Testing, Deployment & Operations, Migration & Comparison.
- Include CardGrid overview for category navigation.
- Bold questions in summary tags for easy scanning.

### Productivity Messaging

- Emphasize elimination of infrastructure complexity.
- Focus on product behavior and business logic.
- Highlight AI coding assistant benefits.
- Use realistic productivity claims with specific scenarios.
- Avoid excessive marketing language in docs - be factual and developer-focused.

### Technical Accuracy Guidelines

- Fluxzero handles HTTP through messaging (endpoints exist but no REST controllers).
- All HTTP requests (inbound/outbound) are handled as messages for observability.
- Built-in backpressure and automatic concurrency management.
- One programming model for HTTP, background jobs, webhooks, AND scheduling.
- Message handlers contain only business logic - no infrastructure code.
- PostgreSQL backend but no direct database access needed.

### Mermaid Configuration

- Client-side rendering configured in `astro.config.mjs`.
- Automatic theme switching (light/dark).
- Remove quotes from node labels to avoid parsing errors.
- Use consistent smart home node examples in diagrams.
