import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const component = readFileSync(resolve(import.meta.dirname, '../src/components/WebsiteAccountControls.astro'), 'utf8');
const inlineScript = component.match(/<script is:inline>([\s\S]*?)<\/script>/)?.[1];
assert.ok(inlineScript, 'account prepaint script must exist');

function renderAccountControl({ issuer, clientId, siteOrigin, page }) {
    class Element {}
    class Anchor extends Element {
        listeners = new Map();
        href = `${issuer}/account`;
        addEventListener(name, listener) { this.listeners.set(name, listener); }
        dispatch(name) { this.listeners.get(name)?.(); }
    }
    const profile = new Anchor();
    const menu = { hidden: true };
    const control = new Element();
    control.dataset = { oidcIssuer: issuer, oidcClientId: clientId, oidcSiteOrigin: siteOrigin };
    control.hasAttribute = () => true;
    control.removeAttribute = () => { control.disabled = true; };
    control.classList = { contains: () => false };
    control.querySelector = (selector) => ({ '[data-oidc-profile]': profile,
        '.website-account-menu': menu })[selector];
    const location = new URL(page);
    runInNewContext(inlineScript, {
        document: { currentScript: { previousElementSibling: control } },
        HTMLElement: Element,
        HTMLAnchorElement: Anchor,
        URL,
        location,
        sessionStorage: { getItem: () => null },
        Date,
        JSON,
    });
    return { profile, menu, control, location };
}

test('Profile carries the exact website page and public client to the IDP', () => {
    const page = 'https://fluxzero.io/pricing/?plan=pro&team=alpha#details';
    const account = renderAccountControl({
        issuer: 'https://login.fluxzero.io',
        clientId: 'fluxzero-website',
        siteOrigin: 'https://fluxzero.io',
        page,
    });
    const target = new URL(account.profile.href);
    assert.equal(target.origin + target.pathname, 'https://login.fluxzero.io/account');
    assert.equal(target.searchParams.get('app_client'), 'fluxzero-website');
    assert.equal(target.searchParams.get('app_return'), page);
    assert.equal(account.menu.hidden, false);

    account.location.href = 'https://fluxzero.io/docs/get-started/?lang=en#install';
    account.profile.dispatch('click');
    assert.equal(new URL(account.profile.href).searchParams.get('app_return'), account.location.href);
});

test('the localhost stub works without a custom host and a different origin remains hidden', () => {
    const stub = renderAccountControl({
        issuer: 'http://localhost:4390', clientId: 'fluxzero-website-local',
        siteOrigin: 'http://localhost:4321', page: 'http://localhost:4321/docs/',
    });
    assert.equal(new URL(stub.profile.href).searchParams.get('app_return'), 'http://localhost:4321/docs/');
    assert.equal(stub.menu.hidden, false);

    const preview = renderAccountControl({
        issuer: 'http://login.fluxzero.localhost:4300', clientId: 'fluxzero-website',
        siteOrigin: 'http://site.fluxzero.localhost:4321', page: 'http://localhost:4321/',
    });
    assert.equal(preview.control.disabled, true);
    assert.equal(preview.menu.hidden, true);
    assert.equal(new URL(preview.profile.href).search, '');
});
