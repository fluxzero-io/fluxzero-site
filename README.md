# Flux Documentation Site

## Preview

Current "production" URL https://flux-docs01.rene7346.workers.dev/

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


## Contributing 

- Download VSCode
- Install extensions: Astro, MDX, TypeScript


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