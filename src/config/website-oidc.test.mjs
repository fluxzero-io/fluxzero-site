import test from 'node:test';
import assert from 'node:assert/strict';
import { websiteOidcConfig } from './website-oidc.mjs';

test('OIDC is opt-in and leaves the dashboard link available', () => {
    assert.deepEqual(websiteOidcConfig({}), {
        enabled: false,
        dashboardUrl: 'https://dashboard.fluxzero.io/',
    });
});

test('local and production settings are explicit public configuration', () => {
    assert.deepEqual(websiteOidcConfig({
        PUBLIC_WEBSITE_OIDC_ENABLED: 'true',
        PUBLIC_WEBSITE_OIDC_ISSUER: 'http://login.fluxzero.localhost:4300',
        PUBLIC_WEBSITE_OIDC_CLIENT_ID: 'fluxzero-website',
        PUBLIC_WEBSITE_OIDC_SITE_ORIGIN: 'http://site.fluxzero.localhost:4321',
        PUBLIC_WEBSITE_DASHBOARD_URL: 'http://dashboard.localhost:4200/',
    }), {
        enabled: true,
        issuer: 'http://login.fluxzero.localhost:4300',
        clientId: 'fluxzero-website',
        resource: undefined,
        siteOrigin: 'http://site.fluxzero.localhost:4321',
        dashboardUrl: 'http://dashboard.localhost:4200/',
    });
});

test('invalid enabled configuration fails before emitting a broken auth client', () => {
    assert.throws(() => websiteOidcConfig({ PUBLIC_WEBSITE_OIDC_ENABLED: 'true' }), /requires/);
    assert.throws(() => websiteOidcConfig({
        PUBLIC_WEBSITE_OIDC_ENABLED: 'true',
        PUBLIC_WEBSITE_OIDC_ISSUER: 'http://login.localhost:4300/extra',
        PUBLIC_WEBSITE_OIDC_CLIENT_ID: 'website',
    }), /must be an origin/);
    assert.throws(() => websiteOidcConfig({
        PUBLIC_WEBSITE_OIDC_ENABLED: 'true',
        PUBLIC_WEBSITE_OIDC_ISSUER: 'https://login.fluxzero.io',
        PUBLIC_WEBSITE_OIDC_CLIENT_ID: 'website',
        PUBLIC_WEBSITE_DASHBOARD_URL: 'javascript:alert(1)',
    }), /HTTP\(S\)/);
    assert.throws(() => websiteOidcConfig({
        PUBLIC_WEBSITE_OIDC_ENABLED: 'true',
        PUBLIC_WEBSITE_OIDC_ISSUER: 'https://login.fluxzero.io',
        PUBLIC_WEBSITE_OIDC_CLIENT_ID: 'website',
        PUBLIC_WEBSITE_OIDC_SITE_ORIGIN: 'http://site.fluxzero.localhost:4321/extra',
    }), /must be an origin/);
});
