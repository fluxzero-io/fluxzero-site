# Plan: Embed Javadocs with Custom Styling in Fluxzero Documentation

## Current Situation
- You have a javadoc loader that scrapes class names from the GitHub-hosted Javadocs
- You have a `jdoclink` component that links to external Javadocs
- The default Javadoc HTML is outdated and doesn't match your site's styling

## Recommended Approach: Generate JSON from Javadocs

### Option 1: Use a JSON Doclet (Recommended)

#### 1. Generate JSON from Java source
- Use `javadoc-json-doclet` or similar tool to generate JSON files from your Java source
- This produces structured data with class info, methods, parameters, descriptions, etc.
- Run as part of your build process for the fluxzero-sdk-java project

Available doclets:
- **rob4lderman/javadoc-json-doclet**: Closely matches javadoc API structure
- **RaidAndFade/javadoc-json-doclet**: Uses Gson, creates one JSON file per class
- **tantaman/jsonDoclet**: Simple JSON output, one file per class
- **jnpn/jsondoclet**: Uses modern Doclet 9 API (for Java 9+)

#### 2. Create a GitHub Actions workflow
- Build JSON docs alongside regular Javadocs
- Publish JSON files to GitHub Pages or as release artifacts
- Keep them versioned with your SDK releases

#### 3. Enhance the javadoc loader
- Modify `javadoc-loader.ts` to fetch JSON files instead of scraping HTML
- Parse full class documentation including methods, fields, annotations
- Store richer data in the content collection

#### 4. Create custom Astro components
- Build a `JavadocClass` component to display full class documentation
- Create `JavadocMethod`, `JavadocField` components for details
- Style with your existing Starlight theme (syntax highlighting, cards, etc.)

#### 5. Create documentation pages
- Add routes like `/api/[className]` for full class docs
- Or embed inline with MDX using custom components

### Option 2: Parse Javadoc HTML (Alternative)
1. Fetch and parse existing Javadoc HTML pages
2. Extract content and re-render with custom components
3. More fragile but doesn't require changes to SDK build

## Implementation Steps

### Phase 1: Set up JSON Generation
1. Add javadoc-json-doclet to fluxzero-sdk-java build
2. Configure Maven/Gradle to run JSON doclet
3. Test JSON output structure

### Phase 2: Update Documentation Site
1. Modify javadoc-loader.ts to fetch JSON data
2. Extend content schema for richer Javadoc data
3. Create Javadoc display components
4. Add API documentation pages/sections
5. Update jdoclink component to link internally

### Phase 3: Styling and Features
1. Apply Starlight theme to Javadoc components
2. Add search functionality for API docs
3. Create cross-references between docs and API
4. Add code examples and playground links

## JSON Structure Example

Based on javadoc-json-doclet, the JSON typically includes:

```json
{
  "name": "HandleCommand",
  "qualifiedName": "io.fluxzero.aggregate.HandleCommand",
  "commentText": "Annotation to mark command handlers...",
  "package": "io.fluxzero.aggregate",
  "isInterface": false,
  "isAnnotation": true,
  "methods": [
    {
      "name": "value",
      "returnType": "Class<?>",
      "parameters": [],
      "commentText": "The command type to handle"
    }
  ],
  "annotations": [],
  "modifiers": ["public"]
}
```

## Benefits
- **Full control** over styling and presentation
- **Better performance** (no external requests)
- **Searchable** API docs within your site
- **Consistent** user experience
- Can add features like code examples, playground links
- **Offline access** to API documentation
- **Version-specific** documentation support

## Considerations
- Requires changes to SDK build process
- Need to maintain JSON generation alongside HTML Javadocs
- Initial setup complexity
- Storage for JSON files (GitHub Pages, CDN, or bundled)

## Alternative: TypeDoc-style Approach
Consider looking at how TypeDoc generates documentation for TypeScript:
- Generates JSON AST from source
- Renders with customizable themes
- Could inspire similar approach for Java

## Resources
- [javadoc-json-doclet](https://github.com/rob4lderman/javadoc-json-doclet)
- [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/)
- [Starlight Components](https://starlight.astro.build/components/)