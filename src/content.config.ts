import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { javadocLoader } from './loaders/javadoc-loader';

const javadocClassSchema = z.object({
  fullName: z.string(),
  simpleName: z.string(),
  packageName: z.string(),
  url: z.string(),
});

export const collections = {
	docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
	javadocClasses: defineCollection({
		loader: javadocLoader(),
		schema: javadocClassSchema,
	}),
};
