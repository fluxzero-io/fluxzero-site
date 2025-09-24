# Fluxzero Doclet JSON Schema Design

## Overview

Based on the analysis of the fluxzero-sdk-java repository, our custom doclet should generate JSON that captures:
- Standard Javadoc information (classes, methods, parameters)
- Fluxzero-specific annotations and patterns
- Cross-references and relationships
- Code examples and usage patterns

## Repository Structure Analysis

### Key Packages:
- `io.fluxzero.sdk.tracking.handling` - Core handler annotations
- `io.fluxzero.sdk.web` - Web handling annotations
- `io.fluxzero.sdk.modeling` - Domain modeling
- `io.fluxzero.sdk.publishing` - Message publishing
- `io.fluxzero.sdk.scheduling` - Scheduling support

### Key Annotations Found:
- `@HandleCommand` - Command handlers
- `@HandleEvent` - Event handlers
- `@HandleQuery` - Query handlers
- `@HandleGet`, `@HandlePost`, etc. - HTTP handlers
- `@HandleWeb` - General web handlers
- `@HandleDocument` - Document handlers

## JSON Schema Design

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "metadata": {
      "type": "object",
      "properties": {
        "version": { "type": "string" },
        "timestamp": { "type": "string", "format": "date-time" },
        "sdkVersion": { "type": "string" },
        "javaVersion": { "type": "string" }
      }
    },
    "packages": {
      "type": "object",
      "patternProperties": {
        "^[a-z][a-z0-9_]*(\\.[a-z0-9_]+)*$": {
          "$ref": "#/definitions/Package"
        }
      }
    },
    "index": {
      "type": "object",
      "properties": {
        "annotations": { "type": "array", "items": { "type": "string" } },
        "classes": { "type": "array", "items": { "type": "string" } },
        "interfaces": { "type": "array", "items": { "type": "string" } },
        "enums": { "type": "array", "items": { "type": "string" } },
        "handlerAnnotations": { "type": "array", "items": { "type": "string" } },
        "webAnnotations": { "type": "array", "items": { "type": "string" } }
      }
    }
  },
  "definitions": {
    "Package": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "description": { "type": "string" },
        "since": { "type": "string" },
        "classes": {
          "type": "object",
          "patternProperties": {
            "^[A-Z][a-zA-Z0-9_]*$": {
              "$ref": "#/definitions/ClassInfo"
            }
          }
        }
      }
    },
    "ClassInfo": {
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": ["class", "interface", "annotation", "enum", "record"]
        },
        "fullName": { "type": "string" },
        "simpleName": { "type": "string" },
        "package": { "type": "string" },
        "modifiers": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["public", "private", "protected", "static", "final", "abstract"]
          }
        },
        "description": { "type": "string" },
        "since": { "type": "string" },
        "author": { "type": "array", "items": { "type": "string" } },
        "deprecated": {
          "type": "object",
          "properties": {
            "isDeprecated": { "type": "boolean" },
            "since": { "type": "string" },
            "forRemoval": { "type": "boolean" },
            "reason": { "type": "string" }
          }
        },
        "superclass": { "type": "string" },
        "interfaces": { "type": "array", "items": { "type": "string" } },
        "annotations": {
          "type": "array",
          "items": { "$ref": "#/definitions/AnnotationUsage" }
        },
        "fluxzeroCategory": {
          "type": "string",
          "enum": ["handler", "web", "modeling", "publishing", "scheduling", "common"]
        },
        "methods": {
          "type": "array",
          "items": { "$ref": "#/definitions/MethodInfo" }
        },
        "fields": {
          "type": "array",
          "items": { "$ref": "#/definitions/FieldInfo" }
        },
        "constructors": {
          "type": "array",
          "items": { "$ref": "#/definitions/ConstructorInfo" }
        },
        "examples": {
          "type": "array",
          "items": { "$ref": "#/definitions/CodeExample" }
        },
        "relatedTypes": { "type": "array", "items": { "type": "string" } },
        "seeAlso": { "type": "array", "items": { "type": "string" } }
      }
    },
    "MethodInfo": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "description": { "type": "string" },
        "modifiers": { "type": "array", "items": { "type": "string" } },
        "returnType": { "$ref": "#/definitions/TypeInfo" },
        "parameters": {
          "type": "array",
          "items": { "$ref": "#/definitions/ParameterInfo" }
        },
        "exceptions": {
          "type": "array",
          "items": { "$ref": "#/definitions/ExceptionInfo" }
        },
        "annotations": {
          "type": "array",
          "items": { "$ref": "#/definitions/AnnotationUsage" }
        },
        "since": { "type": "string" },
        "deprecated": { "$ref": "#/definitions/ClassInfo/properties/deprecated" },
        "examples": {
          "type": "array",
          "items": { "$ref": "#/definitions/CodeExample" }
        },
        "fluxzeroHandlerType": {
          "type": "string",
          "enum": ["command", "event", "query", "web", "document", "custom", "schedule"]
        }
      }
    },
    "FieldInfo": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "description": { "type": "string" },
        "modifiers": { "type": "array", "items": { "type": "string" } },
        "type": { "$ref": "#/definitions/TypeInfo" },
        "defaultValue": { "type": "string" },
        "annotations": {
          "type": "array",
          "items": { "$ref": "#/definitions/AnnotationUsage" }
        },
        "since": { "type": "string" },
        "deprecated": { "$ref": "#/definitions/ClassInfo/properties/deprecated" }
      }
    },
    "ConstructorInfo": {
      "type": "object",
      "properties": {
        "description": { "type": "string" },
        "modifiers": { "type": "array", "items": { "type": "string" } },
        "parameters": {
          "type": "array",
          "items": { "$ref": "#/definitions/ParameterInfo" }
        },
        "exceptions": {
          "type": "array",
          "items": { "$ref": "#/definitions/ExceptionInfo" }
        },
        "annotations": {
          "type": "array",
          "items": { "$ref": "#/definitions/AnnotationUsage" }
        },
        "since": { "type": "string" },
        "deprecated": { "$ref": "#/definitions/ClassInfo/properties/deprecated" }
      }
    },
    "ParameterInfo": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "description": { "type": "string" },
        "type": { "$ref": "#/definitions/TypeInfo" },
        "annotations": {
          "type": "array",
          "items": { "$ref": "#/definitions/AnnotationUsage" }
        },
        "isVarArgs": { "type": "boolean" }
      }
    },
    "ExceptionInfo": {
      "type": "object",
      "properties": {
        "type": { "$ref": "#/definitions/TypeInfo" },
        "description": { "type": "string" }
      }
    },
    "TypeInfo": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "fullName": { "type": "string" },
        "isArray": { "type": "boolean" },
        "arrayDimensions": { "type": "integer", "minimum": 0 },
        "isGeneric": { "type": "boolean" },
        "typeParameters": {
          "type": "array",
          "items": { "$ref": "#/definitions/TypeInfo" }
        },
        "isPrimitive": { "type": "boolean" }
      }
    },
    "AnnotationUsage": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "fullName": { "type": "string" },
        "values": {
          "type": "object",
          "patternProperties": {
            "^[a-zA-Z][a-zA-Z0-9_]*$": {
              "type": ["string", "number", "boolean", "array"]
            }
          }
        }
      }
    },
    "CodeExample": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "description": { "type": "string" },
        "language": {
          "type": "string",
          "enum": ["java", "kotlin", "javascript", "json", "xml", "yaml"]
        },
        "code": { "type": "string" },
        "tags": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

## Example Output

```json
{
  "metadata": {
    "version": "1.0.0",
    "timestamp": "2024-09-24T14:50:00Z",
    "sdkVersion": "0-SNAPSHOT",
    "javaVersion": "21"
  },
  "packages": {
    "io.fluxzero.sdk.tracking.handling": {
      "name": "io.fluxzero.sdk.tracking.handling",
      "description": "Core handler annotations and infrastructure",
      "classes": {
        "HandleCommand": {
          "type": "annotation",
          "fullName": "io.fluxzero.sdk.tracking.handling.HandleCommand",
          "simpleName": "HandleCommand",
          "package": "io.fluxzero.sdk.tracking.handling",
          "modifiers": ["public"],
          "description": "Marks a method or constructor as a handler for command messages",
          "fluxzeroCategory": "handler",
          "methods": [
            {
              "name": "disabled",
              "description": "If true, disables this handler during discovery",
              "returnType": {
                "name": "boolean",
                "fullName": "boolean",
                "isPrimitive": true
              },
              "parameters": []
            },
            {
              "name": "passive",
              "description": "If true, this handler is considered passive and will not emit a result message",
              "returnType": {
                "name": "boolean",
                "fullName": "boolean",
                "isPrimitive": true
              },
              "parameters": []
            },
            {
              "name": "allowedClasses",
              "description": "Restricts which payload types this handler may be invoked for",
              "returnType": {
                "name": "Class[]",
                "fullName": "java.lang.Class[]",
                "isArray": true,
                "arrayDimensions": 1
              },
              "parameters": []
            }
          ],
          "examples": [
            {
              "title": "Basic Command Handler",
              "language": "java",
              "code": "@HandleCommand\nvoid handle(CreateUser cmd) {\n    // Handle user creation\n}"
            },
            {
              "title": "Passive Command Handler",
              "language": "java",
              "code": "@HandleCommand(passive = true)\nvoid logCommand(CreateUser cmd) {\n    // Log without result\n}"
            }
          ],
          "relatedTypes": ["HandleEvent", "HandleQuery", "HandleMessage"],
          "seeAlso": ["MessageType.COMMAND"]
        }
      }
    }
  },
  "index": {
    "annotations": ["HandleCommand", "HandleEvent", "HandleQuery", "HandleGet"],
    "handlerAnnotations": ["HandleCommand", "HandleEvent", "HandleQuery"],
    "webAnnotations": ["HandleGet", "HandlePost", "HandleWeb"]
  }
}
```

## Fluxzero-Specific Enhancements

### Handler Type Classification
- Automatically detect handler types based on annotations
- Group related handlers (command/event pairs)
- Extract routing patterns from web handlers

### Code Example Generation
- Parse `@code` blocks from Javadoc
- Generate both Java and Kotlin examples
- Create smart home domain examples consistently

### Cross-Reference Analysis
- Link commands to their events via `@Apply` methods
- Map aggregates to their handlers
- Connect web endpoints to their implementations

### Usage Pattern Detection
- Identify common patterns (CQRS, event sourcing)
- Extract validation annotations
- Document authorization requirements

## Integration Points

### Build Process
- Add as Maven plugin execution
- Generate during `mvn javadoc:javadoc`
- Upload JSON to GitHub Pages/CDN

### Documentation Site
- Enhanced `javadoc-loader.ts` to consume JSON
- New Astro components for rich display
- Search integration
- Interactive examples