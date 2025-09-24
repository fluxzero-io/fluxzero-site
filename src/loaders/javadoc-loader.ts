import type { Loader } from 'astro/loaders';
import { z } from 'astro:content';

// Enhanced schema for custom doclet JSON format
const javadocClassSchema = z.object({
  // Basic class info (backward compatible)
  fullName: z.string(),
  simpleName: z.string(),
  packageName: z.string(),
  url: z.string().optional(),

  // Extended info from custom doclet
  type: z.enum(['class', 'interface', 'annotation', 'enum', 'record']).optional(),
  modifiers: z.array(z.string()).optional(),
  description: z.string().optional(),
  since: z.string().optional(),
  author: z.array(z.string()).optional(),
  deprecated: z.object({
    isDeprecated: z.boolean(),
    since: z.string().optional(),
    reason: z.string().optional(),
  }).optional(),
  superclass: z.string().optional(),
  interfaces: z.array(z.string()).optional(),
  fluxzeroCategory: z.enum(['handler', 'web', 'modeling', 'publishing', 'scheduling', 'common']).optional(),

  // Methods and fields
  methods: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    returnType: z.object({
      name: z.string(),
      fullName: z.string(),
      isPrimitive: z.boolean().optional(),
      isArray: z.boolean().optional(),
    }),
    parameters: z.array(z.object({
      name: z.string(),
      description: z.string().optional(),
      type: z.object({
        name: z.string(),
        fullName: z.string(),
        isPrimitive: z.boolean().optional(),
      }),
    })).optional(),
    fluxzeroHandlerType: z.enum(['command', 'event', 'query', 'web', 'document', 'custom', 'schedule']).optional(),
  })).optional(),

  fields: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    type: z.object({
      name: z.string(),
      fullName: z.string(),
    }),
    defaultValue: z.string().optional(),
  })).optional(),

  // Code examples and relationships
  examples: z.array(z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    language: z.enum(['java', 'kotlin']),
    code: z.string(),
  })).optional(),

  relatedTypes: z.array(z.string()).optional(),
  seeAlso: z.array(z.string()).optional(),
});

export function javadocLoader(): Loader {
  return {
    name: 'javadoc-loader',
    async load({ store, logger, parseData }) {
      // Check if Javadoc is optional from npm config
      const isOptional = process.env.npm_package_config_javadoc_optional === 'true';
      const shouldThrowErrors = !isOptional;

      // Try custom doclet JSON first, fall back to HTML scraping
      const jsonUrl = 'https://fluxzero-io.github.io/fluxzero-sdk-java/docs/fluxzero-api.json';
      const htmlUrl = 'https://fluxzero-io.github.io/fluxzero-sdk-java/javadoc/apidocs/overview-tree.html';

      try {
        // Clear existing store
        store.clear();

        // Try JSON format first
        logger.info("Attempting to load from custom doclet JSON...");
        const jsonSuccess = await tryLoadFromJson(jsonUrl, store, parseData, logger);

        if (!jsonSuccess) {
          // Fall back to HTML scraping
          logger.info("JSON not available, falling back to HTML scraping...");
          await loadFromHtml(htmlUrl, store, parseData, logger);
        }

      } catch (error) {
        if (shouldThrowErrors) {
          logger.error(`Failed to load Javadoc classes: ${error}`);
          throw error;
        } else {
          logger.warn(`Failed to load Javadoc classes (continuing without Javadoc data): ${error}`);
          // Clear the store but don't throw - build will continue without Javadoc data
          store.clear();
        }
      }
    }
  };
}

async function tryLoadFromJson(
  url: string,
  store: any,
  parseData: any,
  logger: any
): Promise<boolean> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      return false;
    }

    const jsonData = await response.json();

    // Validate JSON structure
    if (!jsonData.packages) {
      logger.warn("Invalid JSON structure, missing packages");
      return false;
    }

    let classCount = 0;

    // Process packages from custom doclet
    for (const [packageName, packageData] of Object.entries(jsonData.packages as Record<string, any>)) {
      if (!packageData.classes) continue;

      for (const [className, classData] of Object.entries(packageData.classes as Record<string, any>)) {
        // Transform to expected schema format
        const transformedClass = {
          ...classData,
          packageName: packageName,
          // Generate URL if not provided (backward compatibility)
          url: classData.url || generateJavadocUrl(classData.fullName),
        };

        const data = await parseData({
          id: transformedClass.fullName,
          data: transformedClass
        });

        store.set({
          id: data.fullName,
          data
        });

        classCount++;
      }
    }

    logger.info(`Loaded ${classCount} classes from custom doclet JSON`);
    return true;

  } catch (error) {
    logger.debug(`Failed to load JSON: ${error}`);
    return false;
  }
}

async function loadFromHtml(
  url: string,
  store: any,
  parseData: any,
  logger: any
): Promise<void> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();

  // Parse HTML to extract class information
  const classes = parseJavadocClasses(html);

  logger.info(`Found ${classes.length} Javadoc classes from HTML`);

  // Add each class to the store
  for (const cls of classes) {
    const data = await parseData({
      id: cls.fullName,
      data: cls
    });

    store.set({
      id: data.fullName,
      data
    });
  }
}

function generateJavadocUrl(fullName: string): string {
  const path = fullName.replace(/\./g, '/') + '.html';
  return `https://fluxzero-io.github.io/fluxzero-sdk-java/javadoc/apidocs/${path}`;
}

function parseJavadocClasses(html: string) {
  const classes: z.infer<typeof javadocClassSchema>[] = [];
  
  // Parse the HTML to extract class information
  const classLinkRegex = /<a href="([^"]+\.html)"[^>]*>([^<]+)<\/a>/g;
  let match;
  
  while ((match = classLinkRegex.exec(html)) !== null) {
    const [, relativePath, displayName] = match;
    
    // Skip if it's not a class file (e.g., package-summary.html)
    if (relativePath.includes('package-summary') || 
        relativePath.includes('index') || 
        relativePath.includes('overview')) {
      continue;
    }
    
    // Convert path to full class name
    const pathParts = relativePath.replace('.html', '').split('/');
    const className = pathParts[pathParts.length - 1];
    const packageParts = pathParts.slice(0, -1);
    const packageName = packageParts.join('.');
    const fullName = packageName ? `${packageName}.${className}` : className;
    
    // Skip if it doesn't look like a proper class
    if (!fullName.startsWith('io.fluxzero')) {
      continue;
    }
    
    classes.push({
      fullName,
      simpleName: className,
      packageName,
      url: `https://fluxzero-io.github.io/fluxzero-sdk-java/javadoc/apidocs/${relativePath}`
    });
  }
  
  // Sort by package name then class name
  classes.sort((a, b) => {
    const packageCompare = a.packageName.localeCompare(b.packageName);
    return packageCompare !== 0 ? packageCompare : a.simpleName.localeCompare(b.simpleName);
  });
  
  return classes;
}