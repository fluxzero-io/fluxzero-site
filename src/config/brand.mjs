export const fluxzeroBrandVersion = 'ea5f28b5-8e77-4cd0-ac01-fa8b5114a472';

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
