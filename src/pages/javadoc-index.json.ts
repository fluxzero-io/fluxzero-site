import { getCollection } from 'astro:content';
import { javadocPath } from '../utils/javadoc-preview';

export const prerender = true;

/** Keep preview paths aligned with the same index used by Jdoclink. */
export async function GET() {
  const classes = await getCollection('javadocClasses');
  const paths = Object.fromEntries(classes.map(({ data }) => [data.fullName, javadocPath(data.url)]));
  return new Response(JSON.stringify(paths), {
    headers: { 'Content-Type': 'application/json' },
  });
}
