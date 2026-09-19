export const siteUrl = 'https://fluxzero.io';
export const marketingPages = ['/', '/how-it-works/', '/product-code/', '/technical-foundation/', '/product-insight/', '/pricing/', '/about/', '/get-started/', '/contact/'];
// In llms.txt, Get started contributes the opening instruction and Contact is linked.
// Standalone Markdown still contains all marketing pages.
export const inlineMarketingPages = marketingPages.filter(path => !['/get-started/', '/contact/'].includes(path));
export const documentationPages = ['/docs/getting-started/introduction/', '/docs/getting-started/core-concepts/'];
export const corePages = [...marketingPages, ...documentationPages];
export const retiredPages = ['/makeitreal/'];
export const unlistedPages = ['/partners/'];
// Deliberate entry points for otherwise unindexed pages.
export const unlistedLinkSources = { '/partners/': { footer: true, pages: ['/contact/'] } };
export const htmlFile = path => `${path.replace(/^\//, '')}index.html`;
export const normalizePath = path => path === '/' ? '/' : `${path.replace(/\/$/, '')}/`;
