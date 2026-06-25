export const fluxzeroBrandVersion = '6f850ace-8509-45ad-9664-4dcf381e181f';

const base = `/assets/fluxzero/brand/${fluxzeroBrandVersion}`;

export const fluxzeroBrand = {
    logo: `${base}/fluxzero-logo.svg`,
    mark: `${base}/fluxzero-mark.svg`,
    faviconSvg: `${base}/fluxzero-mark.svg`,
    faviconIco: `${base}/favicon.ico`,
    favicon16: `${base}/favicon-16x16.png`,
    favicon32: `${base}/favicon-32x32.png`,
    appleTouchIcon: `${base}/apple-touch-icon.png`,
    webManifest: `${base}/site.webmanifest`,
    browserConfig: `${base}/browserconfig.xml`,
    socialImage: '/assets/fluxzero/social-card.png',
};

export const fluxzeroLogoCssUrl = `url('${fluxzeroBrand.mark}')`;
