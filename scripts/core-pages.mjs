export const siteUrl = 'https://fluxzero.io';
// Canonical destinations for links arriving from the shared SDK documentation.
export const siteLinkAliases = { '/get-started': '/#get-started', '/technical-foundation': '/how-it-works/' };
export const marketingPages = ['/', '/how-it-works/', '/product-code/', '/product-insight/', '/pricing/', '/about/', '/contact/', '/partners/'];
// In llms.txt, the homepage supplies the opening instruction; Contact and Partners are linked.
// Standalone Markdown still contains all marketing pages.
export const inlineMarketingPages = marketingPages.filter(path => !['/contact/', '/partners/'].includes(path));
export const documentationPages = ['/docs/getting-started/introduction/', '/docs/getting-started/core-concepts/'];
export const corePages = [...marketingPages, ...documentationPages];
export const retiredPages = ['/makeitreal/', '/get-started/'];
export const unlistedPages = ['/oidc/callback/', '/oidc/silent-callback/', '/oidc/logout-callback/'];
// Limit visible entry points independently of search indexing.
export const restrictedLinkSources = { '/partners/': { footer: true, navigation: true, pages: ['/contact/'] } };
export const htmlFile = path => `${path.replace(/^\//, '')}index.html`;
export const normalizePath = path => path === '/' ? '/' : `${path.replace(/\/$/, '')}/`;
