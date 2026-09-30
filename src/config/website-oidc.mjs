const DEFAULT_DASHBOARD_URL = 'https://dashboard.fluxzero.io/';

function configuredUrl(value, name) {
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`${name} must be an absolute URL`);
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error(`${name} must be an HTTP(S) URL without credentials, query or fragment`);
    }
    return url.href;
}

export function websiteOidcConfig(env) {
    const dashboardUrl = configuredUrl(
        env.PUBLIC_WEBSITE_DASHBOARD_URL?.trim() || DEFAULT_DASHBOARD_URL,
        'PUBLIC_WEBSITE_DASHBOARD_URL',
    );
    if (env.PUBLIC_WEBSITE_OIDC_ENABLED !== 'true') {
        return { enabled: false, dashboardUrl };
    }

    const issuer = env.PUBLIC_WEBSITE_OIDC_ISSUER?.trim();
    const clientId = env.PUBLIC_WEBSITE_OIDC_CLIENT_ID?.trim();
    if (!issuer || !clientId) {
        throw new Error('Website OIDC requires PUBLIC_WEBSITE_OIDC_ISSUER and PUBLIC_WEBSITE_OIDC_CLIENT_ID');
    }
    const issuerUrl = new URL(configuredUrl(issuer, 'PUBLIC_WEBSITE_OIDC_ISSUER'));
    if (issuerUrl.pathname !== '/') {
        throw new Error('PUBLIC_WEBSITE_OIDC_ISSUER must be an origin without a path');
    }
    if (!/^[A-Za-z0-9._~-]+$/.test(clientId)) {
        throw new Error('PUBLIC_WEBSITE_OIDC_CLIENT_ID contains unsupported characters');
    }
    const resource = env.PUBLIC_WEBSITE_OIDC_RESOURCE?.trim();
    const siteOrigin = env.PUBLIC_WEBSITE_OIDC_SITE_ORIGIN?.trim();
    const siteUrl = siteOrigin ? new URL(configuredUrl(siteOrigin, 'PUBLIC_WEBSITE_OIDC_SITE_ORIGIN')) : undefined;
    if (siteUrl && siteUrl.pathname !== '/') {
        throw new Error('PUBLIC_WEBSITE_OIDC_SITE_ORIGIN must be an origin without a path');
    }
    return {
        enabled: true,
        issuer: issuerUrl.origin,
        clientId,
        resource: resource ? configuredUrl(resource, 'PUBLIC_WEBSITE_OIDC_RESOURCE') : undefined,
        siteOrigin: siteUrl?.origin,
        dashboardUrl,
    };
}
