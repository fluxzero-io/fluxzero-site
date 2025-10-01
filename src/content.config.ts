import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { javadocLoader } from './loaders/javadoc-loader';
import { changelogLoader } from './loaders/changelog-loader';

const javadocClassSchema = z.object({
  fullName: z.string(),
  simpleName: z.string(),
  packageName: z.string(),
  url: z.string(),
});

const changelogReleaseSchema = z.object({
  version: z.string(),
  date: z.string(),
  body: z.string(),
  url: z.string(),
  quarterKey: z.string(),
  year: z.number(),
  quarter: z.string(),
});

const feedbackToggleSchema = z.union([
	z.boolean(),
	z.object({
		enabled: z.boolean().optional(),
		slug: z.string().optional(),
	}),
]);

const docsWithFeedbackSchema = docsSchema({
	extend: () =>
		z.object({
			feedback: feedbackToggleSchema.optional(),
		}),
});

export const collections = {
	docs: defineCollection({ loader: docsLoader(), schema: docsWithFeedbackSchema }),
	javadocClasses: defineCollection({
		loader: javadocLoader(),
		schema: javadocClassSchema,
	}),
	changelogReleases: defineCollection({
		loader: changelogLoader(),
		schema: changelogReleaseSchema,
	}),
};
