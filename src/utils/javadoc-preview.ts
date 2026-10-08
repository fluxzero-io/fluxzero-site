/** Use the indexed HTML filename: dots inside a nested type are not package separators. */
export function javadocPath(htmlUrl: string): string {
  const prefix = '/fluxzero-sdk-java/javadoc/apidocs/';
  const url = new URL(htmlUrl);
  if (!url.pathname.startsWith(prefix) || !url.pathname.endsWith('.html')) {
    throw new Error(`Invalid Javadoc class URL: ${htmlUrl}`);
  }
  return url.pathname.slice(prefix.length, -'.html'.length);
}

export function createJavadocPreviewLoader(request: typeof fetch = fetch) {
  let index: Promise<Record<string, string>> | undefined;

  return async (qualifiedName: string): Promise<string | null> => {
    // Fetch the build's class index only on first use; share it across previews.
    index ??= request('/javadoc-index.json').then(async (response) => {
      if (!response.ok) throw new Error(`Javadoc index: HTTP ${response.status}`);
      return await response.json() as Record<string, string>;
    }).catch((error) => {
      index = undefined;
      throw error;
    });
    const classes = await index;
    // The doclet may use binary nested names, while the HTML index uses source names.
    const name = qualifiedName.replaceAll('$', '.');
    const path = Object.hasOwn(classes, name) ? classes[name] : undefined;
    if (!path) throw new Error(`Javadoc class not indexed: ${qualifiedName}`);
    const response = await request(
      `https://fluxzero-io.github.io/fluxzero-sdk-java/javadoc/json-doclet/${path}.json`,
    );
    if (!response.ok) throw new Error(`Javadoc preview: HTTP ${response.status}`);
    const data = await response.json();
    return data.documentation ?? null;
  };
}
