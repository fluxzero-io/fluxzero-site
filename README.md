# Flux Documentation Site

## Preview

Current "production" URL https://flux-website.rene7346.workers.dev

## License

This repository uses separate licenses for code and documentation:

- **Website code**: [Business Source License 1.1](./LICENSE.code) — source available for non-commercial use.
- **Documentation & content**: [CC BY-NC-ND 4.0](./LICENSE.docs) — may not be modified or used commercially.
- **Logos and branding**: All rights reserved.

If you’d like to use our code or content commercially, please contact us at alen@fluxzero.io.

## Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `pnpm install`             | Installs dependencies                            |
| `pnpm dev`             | Starts local dev server at `localhost:4321`      |
| `pnpm build`           | Build your production site to `./dist/`          |
| `pnpm preview`         | Preview your build locally, before deploying     |
| `pnpm astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `pnpm astro -- --help` | Get help using the Astro CLI                     |
| `pnpm update-changelog` | Update changelog with new releases from GitHub   |
| `pnpm update-changelog:full` | Rebuild entire changelog from GitHub           |


## Environment Setup

### Required Environment Variables

Create a `.dev.vars` file in the root directory with the following variables:

```bash
# GitHub Personal Access Token for reading discussions (feedback API)
# Create at: https://github.com/settings/tokens
# Required permissions: public_repo (for reading public discussions)
# Note: PATs expire after 30-90 days depending on your settings. You'll need to regenerate them periodically.
GITHUB_TOKEN=your_github_token_here
```

### For Production Deployment

Set the GitHub token as a secret in Cloudflare:

```bash
wrangler secret put GITHUB_TOKEN
```

## Contributing

- Download VSCode
- Install extensions: Astro, MDX, TypeScript
- Set up environment variables as described above


## Changelog Automation

The site includes automated changelog generation from GitHub releases:

- **Incremental updates**: `pnpm update-changelog` fetches only new releases since the last update
- **Full rebuild**: `pnpm update-changelog:full` rebuilds the entire changelog from GitHub  
- **Smart filtering**: Automatically skips releases without meaningful content
- **Organized structure**: Groups releases by year and quarter with version ranges
- **Version cutoff**: Only includes releases from v0.1192.0 onwards
- **Collapsible design**: Each release is wrapped in expandable details for better UX

The changelog is automatically organized as:
```
## 2025
### 2025-Q2 - release 0.1192.0 - 0.1201.0
<details><summary>0.1201.0 (2025-06-30)</summary>
[Release content with proper heading levels]
</details>
```

## Features we'd like to add

- Generate project from a UI
- Web IDE 
- Comments / questions?


Topics
 - Typical thing: do something on startup
 - Multi tenancy
 - ID generation
 - Handling HTTP requests
 - Sending HTTP requests 
 - Configuration / secrets 
 - Performance / server requirements
 - Comparing to ... Axon, Restate, etc.

Backlog

1. High over explanation of Fluxzero - what does it do, what can you use it for and why should you choose to use it?
2. Getting started
3. Building your first application (alle aspecten met deep-dives over testen, webapi's, web clients, )


# Example Application

In order to demonstrate Fluxzero, we will build home automation software based on the Fluxzero platform. 

Features
- Turning lights on/off (virtual buttons)
- Showing light status (reactive updates)
- Grouping lights in a room
- Grouping rooms into a house
- Turning lights on/off based on a timer
- Turning lights on/off based on sunset / sundown (integrate with weather api)
- Login to control the house
- Sensor processing --> movement events 
- Statistics (read models)
- MQTT integration? 



Stappen 

- Goal: being able to turn off and on lights
  - post /lights 


Brede context
Readme uit elkaar trekken --> referentie

Birds eye view
Most important concepts -- aggregate, command, query, event 
Goal of flux 


Wat mist in de readme
Diagrammen uitgezoomd
core concepten wat is een command? 
hoe run je het lokaal ?



Patterns
Best practises 