# Plan: Build Custom Fluxzero Doclet for Documentation Site

## Overview
Create a custom Java doclet that generates JSON/MDX output specifically tailored for the Fluxzero documentation site, providing full control over structure and styling.

## Phase 1: Doclet Implementation

### 1.1 Create FluxzeroDoclet Project
- **New Maven/Gradle module**: `fluxzero-doclet`
- **Dependencies**:
  - `jdk.javadoc` (provided by JDK)
  - Jackson or Gson for JSON generation
  - Optionally: Mustache/Handlebars for template-based MDX generation

### 1.2 Core Doclet Structure
```java
package io.fluxzero.doclet;

public class FluxzeroDoclet implements Doclet {
    private Reporter reporter;
    private DocletEnvironment environment;

    @Override
    public void init(Locale locale, Reporter reporter) {
        this.reporter = reporter;
    }

    @Override
    public String getName() {
        return "FluxzeroDoclet";
    }

    @Override
    public boolean run(DocletEnvironment env) {
        this.environment = env;
        // Process elements and generate output
        return true;
    }
}
```

### 1.3 Data Extraction Components
- **ClassProcessor**: Extract class/interface/annotation info
- **MethodProcessor**: Extract method signatures, parameters, return types
- **JavadocParser**: Parse comment text, tags, examples
- **AnnotationExtractor**: Special handling for Fluxzero annotations
- **TypeResolver**: Resolve generic types and imports

## Phase 2: Output Generation

### 2.1 JSON Schema Design
```json
{
  "version": "1.0.0",
  "timestamp": "2024-01-24T10:00:00Z",
  "packages": {
    "io.fluxzero.aggregate": {
      "description": "Aggregate handling components",
      "classes": {
        "HandleCommand": {
          "type": "annotation",
          "modifiers": ["public"],
          "description": "Marks command handler methods",
          "since": "1.0",
          "methods": [{
            "name": "value",
            "returnType": "Class<?>",
            "defaultValue": "Void.class",
            "description": "Command type to handle"
          }],
          "examples": [{
            "language": "java",
            "code": "@HandleCommand\nvoid handle(TurnOnLight cmd) {...}"
          }],
          "relatedTypes": ["HandleEvent", "HandleQuery"]
        }
      }
    }
  },
  "index": {
    "annotations": ["HandleCommand", "HandleEvent", ...],
    "interfaces": ["Handler", "Aggregate", ...],
    "classes": ["FluxCapacitor", ...]
  }
}
```

### 2.2 MDX Generation Option
Generate MDX files directly for immediate use:
```mdx
---
title: HandleCommand
description: Annotation for marking command handlers
package: io.fluxzero.aggregate
type: annotation
since: '1.0'
---

import { Tabs, TabItem, Card, CardGrid } from '@astrojs/starlight/components';

## HandleCommand

{frontmatter.description}

### Usage

<Tabs>
<TabItem label="Java">
```java
@HandleCommand
public void handle(TurnOnLight command) {
    // Handle command
}
```
</TabItem>
<TabItem label="Kotlin">
```kotlin
@HandleCommand
fun handle(command: TurnOnLight) {
    // Handle command
}
```
</TabItem>
</Tabs>
```

## Phase 3: Fluxzero-Specific Features

### 3.1 Smart Extraction
- **Handler Detection**: Identify all `@Handle*` annotations
- **Aggregate Analysis**: Extract aggregate structure and relationships
- **Event Flow**: Map command → event relationships from `@Apply` methods
- **Validation Rules**: Extract from `@NotNull`, `@Size`, etc.
- **Authorization**: Document `@Authorize` usage

### 3.2 Code Example Extraction
- Parse `@code` blocks from Javadoc
- Extract example usage from test files (if referenced)
- Generate both Java and Kotlin examples

### 3.3 Cross-Reference Generation
- Create relationship maps between:
  - Commands and their handlers
  - Events and aggregates
  - Queries and projections
- Generate navigation indices

## Phase 4: Build Integration

### 4.1 Maven Configuration
```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-javadoc-plugin</artifactId>
    <configuration>
        <doclet>io.fluxzero.doclet.FluxzeroDoclet</doclet>
        <docletArtifact>
            <groupId>io.fluxzero</groupId>
            <artifactId>fluxzero-doclet</artifactId>
            <version>1.0.0</version>
        </docletArtifact>
        <additionalOptions>
            <additionalOption>-outputformat json</additionalOption>
            <additionalOption>-outputdir ${project.build.directory}/api-docs</additionalOption>
        </additionalOptions>
    </configuration>
</plugin>
```

### 4.2 GitHub Actions Workflow
- Run doclet on SDK builds
- Upload JSON/MDX to GitHub Pages or artifact storage
- Trigger documentation site rebuild

## Phase 5: Documentation Site Integration

### 5.1 Enhanced Loader
```typescript
// javadoc-loader.ts
export function javadocLoader(): Loader {
  return {
    name: 'javadoc-loader',
    async load({ store, logger }) {
      // Fetch generated JSON from doclet
      const response = await fetch('https://cdn.../fluxzero-api.json');
      const apiData = await response.json();

      // Process and store in content collection
      for (const [pkg, data] of Object.entries(apiData.packages)) {
        for (const [className, classData] of Object.entries(data.classes)) {
          store.set({
            id: `${pkg}.${className}`,
            data: classData
          });
        }
      }
    }
  };
}
```

### 5.2 Display Components
- **ApiClass.astro**: Full class documentation page
- **ApiMethod.astro**: Method signature display
- **ApiPackage.astro**: Package overview
- **ApiSearch.astro**: Search across API docs
- **ApiExample.astro**: Interactive code examples

### 5.3 Routes
- `/api/` - API documentation index
- `/api/packages/` - Package listing
- `/api/[package]/` - Package details
- `/api/[package]/[class]/` - Class documentation

## Phase 6: Advanced Features

### 6.1 Interactive Features
- **Live Examples**: Generate StackBlitz/CodeSandbox links
- **Type Links**: Navigate between related types
- **Search**: Full-text search across API docs
- **Version Switcher**: Support multiple SDK versions

### 6.2 AI-Friendly Output
- Generate structured data for LLM training
- Include semantic descriptions
- Provide usage patterns and best practices

## Benefits Over Existing Solutions

1. **Tailored for Fluxzero**: Understands your specific patterns
2. **Optimal Output**: Only includes needed data
3. **Styling Control**: Direct integration with Starlight
4. **Maintainable**: You own and understand the code
5. **Extensible**: Add features as needed
6. **Performance**: Optimized JSON structure
7. **Version Support**: Handle multiple SDK versions

## Implementation Timeline

- **Week 1**: Basic doclet with JSON output
- **Week 2**: Fluxzero-specific extraction features
- **Week 3**: Build integration and CI/CD
- **Week 4**: Documentation site components
- **Week 5**: Polish and advanced features

## Next Steps

1. Create `fluxzero-doclet` project in the SDK repository
2. Implement basic Doclet interface
3. Add JSON generation
4. Test with sample classes
5. Integrate with build system
6. Update documentation site to consume output