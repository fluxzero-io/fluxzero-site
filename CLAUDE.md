# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

This is an Astro documentation site using pnpm as the package manager:

- `pnpm install` - Install dependencies
- `pnpm dev` - Start local development server at localhost:4321
- `pnpm build` - Build production site to ./dist/
- `pnpm preview` - Preview production build locally
- `pnpm astro ...` - Run Astro CLI commands (e.g., `pnpm astro check`)

## Product Context

This documentation site covers **fluxzero**, a message-driven software development platform that aims to radically improve developer productivity. Fluxzero allows developers to write business logic while the platform handles all the underlying plumbing.

### Fluxzero Components
- **fluxzero-java-sdk** / **fluxzero-kotlin-sdk** - Language-specific SDKs (currently named flux-capacitor-client)
- **fluxzero** - Server component
- **fluxzero-proxy** - Proxy component;
- **fluxzero-cloud** - Cloud offering
- **fluxzero-cli** - CLI -- 'fz'

### Core Platform Capabilities
The fluxzero-java-sdk is an event-driven, distributed messaging framework with:

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

*Note: fluxzero is not officially launched yet, so online resources may be limited.*

## Architecture & Structure

This is a documentation site for fluxzero, built with:
- **Astro 5** with **Starlight** theme for documentation
- **TypeScript** configuration with strict mode
- **Cloudflare Workers** deployment via Wrangler
- **pnpm** for package management

### Content Structure
Documentation is organized in `src/content/docs/` with the following sections:
- `about/` - Introduction, compatibility, FAQ, use cases
- `get-started/` - Installation, new projects, deployment
- `guides/` - Authentication, validation, testing, HTTP handling
- `reference/` - CLI commands, core components, error codes
- `tutorials/` - Step-by-step tutorials

Content follows the Diataxis Framework (see https://diataxis.fr). ALWAYS follow those conventions.

### Key Configuration Files
- `astro.config.mjs` - Astro configuration with Starlight integration and Cloudflare adapter
- `src/content.config.ts` - Content collection schema configuration
- `wrangler.jsonc` - Cloudflare Workers deployment configuration
- `tsconfig.json` - TypeScript configuration extending Astro strict preset

### Deployment
- Deployed to Cloudflare Workers
- Production URL: https://flux-docs01.rene7346.workers.dev/
- Uses Cloudflare's image service with compile-time Sharp processing
- Edit links point to GitHub repository for contributions

### Development Notes
- Node.js version >=22.0.0 required
- Sharp is used for image processing but only at compile time (Cloudflare limitation)
- TypeScript paths configured with `~/*` alias for `src/*`

## Technical Writing Guidelines

When working on documentation content:

**Role & Audience:**
- Act as a professional co-technical writer
- Target audience: software developers
- Goal: convince developers that fluxzero is the platform for their next project

**Content Strategy:**
- Use extensive code examples throughout documentation
- Examples are always in java and in kotlin
- Focus on smooth onboarding experience
- Integrate flux-cli for local development workflows
- Suggest online playground options (Replit/CodeSandbox) for experimentation
- Maintain consistent language and terminology

**Required Reference:**
- ALWAYS check the latest SDK documentation before writing: https://raw.githubusercontent.com/flux-capacitor-io/flux-capacitor-client/refs/heads/master/README.md
- ALWAYS check the latest Javadoc if you need to know if a symbol exists or what options are available: https://flux-capacitor.io/flux-capacitor-client/javadoc/apidocs/
- Use this as the authoritative source for current SDK capabilities and examples