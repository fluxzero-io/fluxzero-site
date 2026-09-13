export const siteUrl = 'https://fluxzero.io';
export const marketingPages = ['/', '/how-it-works/', '/product-code/', '/technical-foundation/', '/pricing/', '/about/', '/get-started/', '/contact/'];
// In llms.txt, Get started contributes the opening instruction and Contact is linked.
// llms-full.txt and standalone Markdown still contain all marketing pages.
export const inlineMarketingPages = marketingPages.filter(path => !['/get-started/', '/contact/'].includes(path));
export const documentationPages = ['/docs/getting-started/introduction/', '/docs/getting-started/core-concepts/'];
export const corePages = [...marketingPages, ...documentationPages];
export const retiredPages = ['/makeitreal/'];
export const htmlFile = path => `${path.replace(/^\//, '')}index.html`;
export const normalizePath = path => path === '/' ? '/' : `${path.replace(/\/$/, '')}/`;
