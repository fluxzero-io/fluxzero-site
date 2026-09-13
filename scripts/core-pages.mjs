export const siteUrl = 'https://fluxzero.io';
export const marketingPages = ['/', '/how-it-works/', '/product-code/', '/technical-foundation/', '/pricing/', '/about/', '/get-started/', '/contact/'];
export const documentationPages = ['/docs/getting-started/introduction/', '/docs/getting-started/core-concepts/'];
export const corePages = [...marketingPages, ...documentationPages];
export const retiredPages = ['/makeitreal/'];
export const htmlFile = path => `${path.replace(/^\//, '')}index.html`;
export const normalizePath = path => path === '/' ? '/' : `${path.replace(/\/$/, '')}/`;
