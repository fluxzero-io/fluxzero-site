export const fluxzeroBrandVersion = 'ea5f28b5-8e77-4cd0-ac01-fa8b5114a472';

const base = `/assets/fluxzero/brand/${fluxzeroBrandVersion}`;

const iconBase = '/assets/fluxzero/icons/light-blue-v1';

export const fluxzeroBrand = {
    logo: `${base}/fluxzero-logo.svg`,
    logoLight: `${base}/fluxzero-logo-light.svg`,
    mark: `${base}/fluxzero-mark.svg`,
    markLight: `${base}/fluxzero-mark-light.svg`,
    faviconSvg: `${iconBase}/favicon.svg`,
    faviconIco: `${iconBase}/favicon.ico`,
    favicon16: `${iconBase}/favicon-16x16.png`,
    favicon32: `${iconBase}/favicon-32x32.png`,
    appleTouchIcon: `${iconBase}/apple-touch-icon.png`,
    safariPinnedTab: `${iconBase}/safari-pinned-tab.svg`,
    webManifest: `${iconBase}/site.webmanifest`,
    browserConfig: `${iconBase}/browserconfig.xml`,
    socialImage: '/assets/fluxzero/social-card.png',
};

export const fluxzeroLogoCssUrl = `url('${fluxzeroBrand.mark}')`;
