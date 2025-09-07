import type { Loader } from 'astro/loaders';
import { z } from 'astro:content';

const javadocClassSchema = z.object({
  fullName: z.string(),
  simpleName: z.string(),
  packageName: z.string(),
  url: z.string(),
});

export function javadocLoader(): Loader {
  return {
    name: 'javadoc-loader',
    async load({ store, logger, parseData }) {
      logger.info("Loading Javadoc classes from overview tree");
      
      // Check if Javadoc is optional from npm config
      const isOptional = process.env.npm_package_config_javadoc_optional === 'true';
      const shouldThrowErrors = !isOptional;
      
      const url = 'https://flux-capacitor.io/fluxzero-sdk-java/javadoc/apidocs/overview-tree.html';
      
      try {
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        
        // Clear existing store
        store.clear();
        
        // Parse HTML to extract class information
        const classes = parseJavadocClasses(html);
        
        logger.info(`Found ${classes.length} Javadoc classes`);
        
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
    if (!fullName.startsWith('io.fluxcapacitor')) {
      continue;
    }
    
    classes.push({
      fullName,
      simpleName: className,
      packageName,
      url: `https://flux-capacitor.io/fluxzero-sdk-java/javadoc/apidocs/${relativePath}`
    });
  }
  
  // Sort by package name then class name
  classes.sort((a, b) => {
    const packageCompare = a.packageName.localeCompare(b.packageName);
    return packageCompare !== 0 ? packageCompare : a.simpleName.localeCompare(b.simpleName);
  });
  
  return classes;
}