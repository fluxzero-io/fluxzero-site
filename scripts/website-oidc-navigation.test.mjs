import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import { UserManager, InMemoryWebStorage, WebStorageStateStore } from 'oidc-client-ts';
import { startWebsiteOidcStub } from './website-oidc-stub.mjs';

const source = readFileSync(new URL('../src/scripts/website-oidc.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source.replaceAll('import.meta.env.DEV', 'false'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

// Exercise the real website handlers and OIDC library; only DOM/navigation are replaced.
function website(stub, options = {}) {
    const { surface = 'marketing', preference } = options;
    const storage = new InMemoryWebStorage();
    const listeners = new Map();
    const requests = [];
    const managers = [];
    const nodes = new Map();
    const location = new URL(surface === 'docs'
        ? `${stub.websiteOrigin}/docs/get-started/?lang=en#install`
        : `${stub.websiteOrigin}/pricing/?plan=pro#details`);
    location.replace = (value) => { location.href = new URL(value, location).href; };
    let cookie = '';
    let theme = preference;
    let pendingNavigation;
    const control = {
        dataset: { oidcIssuer: stub.issuer, oidcClientId: stub.clientId },
        classList: { contains: (name) => surface === 'docs' && name === 'website-account-controls--docs' },
        hasAttribute: () => true,
        contains: () => true,
        addEventListener: (name, listener) => listeners.set(name, listener),
        querySelector: (selector) => {
            if (!nodes.has(selector)) nodes.set(selector, {
                dataset: {}, hidden: true, textContent: '', setAttribute() {}, removeAttribute() {},
            });
            return nodes.get(selector);
        },
    };
    const redirect = {
        prepare: async () => ({
            navigate: async ({ url }) => { requests.push(url); return { url }; }, close() {},
        }),
    };
    const iframe = {
        prepare: async () => ({
            navigate: async ({ url }) => {
                const response = await fetch(url, { redirect: 'manual', headers: { Cookie: cookie } });
                return { url: new URL(response.headers.get('location'), url).href };
            }, close() {},
        }),
    };
    class BrowserUserManager extends UserManager {
        constructor(settings) {
            super(settings, redirect, redirect, iframe);
            managers.push(this);
            if ('prompts' in options) {
                const metadata = this.metadataService.getMetadata.bind(this.metadataService);
                this.metadataService.getMetadata = async () => ({
                    ...await metadata(), prompt_values_supported: options.prompts,
                });
            }
        }
        signinRedirect(args) {
            pendingNavigation = super.signinRedirect(args);
            return pendingNavigation;
        }
    }
    const document = Object.assign(new EventTarget(), {
        hidden: false, querySelectorAll: () => [control], querySelector: () => control,
    });
    const exports = {};
    runInNewContext(outputText, {
        exports,
        require: () => ({ UserManager: BrowserUserManager, InMemoryWebStorage, WebStorageStateStore }),
        document,
        window: Object.assign(new EventTarget(), {
            sessionStorage: storage, location,
            history: { replaceState: (_, __, path) => location.replace(path) },
        }),
        sessionStorage: storage,
        localStorage: { getItem: () => theme }, crypto: webcrypto, btoa, URL,
    });
    return {
        init: exports.initWebsiteOidc,
        requests, location,
        setTheme: (value) => { theme = value; },
        setCookie: (value) => { cookie = value; },
        presence: () => JSON.parse(storage.getItem('fluxzero.website.oidc.presence.v1') || 'null'),
        async click(action) {
            pendingNavigation = null;
            const target = {
                closest: () => target, hasAttribute: (name) => name === `data-oidc-${action}`,
            };
            listeners.get('click')({ target, preventDefault() {} });
            for (let attempt = 0; !pendingNavigation && attempt < 100; attempt++) {
                await new Promise((resolve) => setTimeout(resolve, 5));
            }
            assert.ok(pendingNavigation, 'account action must start an OIDC navigation');
            await pendingNavigation;
            return new URL(requests.at(-1));
        },
        async complete(callback) {
            location.href = callback;
            await exports.finishInteractiveWebsiteOidc();
        },
        async close() {
            await Promise.all(managers.map((manager) => manager.removeUser()));
        },
    };
}

test('account actions preserve the route and current theme and request signup only for Create account', async () => {
    const stub = await startWebsiteOidcStub({ port: 0 });
    const states = new Set();
    const nonces = new Set();
    try {
        for (const [surface, preference, expected] of [
            ['marketing', 'light', 'dark'], ['docs', 'light', 'light'], ['docs', 'dark', 'dark'],
            ['docs', null, 'system'], ['docs', 'invalid', 'system'],
        ]) {
            const page = website(stub, { surface, preference });
            try {
                page.init();
                for (const action of ['login', 'create']) {
                    const url = await page.click(action);
                    assert.equal(url.pathname, '/oauth2/auth');
                    assert.equal(url.searchParams.get('prompt'), action === 'create' ? 'create' : null);
                    assert.equal(url.searchParams.get('theme'), expected);
                    assert.equal(url.searchParams.get('redirect_uri'), `${stub.websiteOrigin}/oidc/callback/`);
                    assert.equal(url.searchParams.get('scope'), 'openid profile');
                    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
                    assert.match(url.searchParams.get('code_challenge'), /^[A-Za-z0-9_-]{43}$/);
                    assert.ok(url.searchParams.get('nonce'));
                    states.add(url.searchParams.get('state'));
                    nonces.add(url.searchParams.get('nonce'));
                }
                if (surface === 'docs') {
                    page.setTheme('dark');
                    assert.equal((await page.click('create')).searchParams.get('theme'), 'dark');
                }
            } finally { await page.close(); }
        }
        assert.equal(states.size, 10);
        assert.equal(nonces.size, 10);
    } finally { await stub.close(); }
});

test('older or incomplete discovery keeps Create account on the normal login transaction', async () => {
    const stub = await startWebsiteOidcStub({ port: 0 });
    try {
        for (const prompts of [['none', 'consent'], undefined, 'create', []]) {
            const page = website(stub, { prompts });
            try {
                page.init();
                const url = await page.click('create');
                assert.equal(url.searchParams.get('prompt'), null);
                const response = await fetch(url, { redirect: 'manual' });
                assert.equal(new URL(response.headers.get('location'), stub.issuer).pathname, '/login');
            } finally { await page.close(); }
        }
    } finally { await stub.close(); }
});

test('signup and its existing-account handoff complete code+PKCE and return to the exact website page', async () => {
    const stub = await startWebsiteOidcStub({ port: 0 });
    const request = (url, cookie = '') => fetch(url, { redirect: 'manual', headers: { Cookie: cookie } });
    try {
        for (const [preference, chooseLogin] of [['dark', false], ['light', false], ['system', false], ['light', true]]) {
            const page = website(stub, { surface: 'docs', preference });
            try {
                page.init();
                const originalPage = page.location.href;
                // Even an existing browser session must first see the signup entry.
                const existing = await request(`${stub.issuer}/__stub/login`);
                const existingCookie = existing.headers.get('set-cookie').split(';')[0];
                const authorization = await page.click('create');
                const entry = new URL((await request(authorization, existingCookie)).headers.get('location'), stub.issuer);
                assert.equal(entry.pathname, '/register');
                assert.equal(entry.searchParams.get('theme'), preference);
                const continuation = entry.searchParams.get('returnTo');
                assert.match(continuation, /^\/oauth2\/auth\?transaction=[a-f0-9]{32}$/);
                // Native registration's existing-account/cancel action keeps this same continuation.
                if (chooseLogin) entry.pathname = '/login';
                const registration = await request(entry);
                const cookie = registration.headers.get('set-cookie').split(';')[0];
                const resume = await request(registration.headers.get('location'), cookie);
                const authorized = await request(new URL(resume.headers.get('location'), stub.issuer), cookie);
                const callback = authorized.headers.get('location');
                await page.complete(callback);
                assert.equal(page.location.href, originalPage);
                assert.equal(page.presence().name, 'Demo Builder');
                assert.equal(page.presence().issuer, stub.issuer);
                await page.complete(callback);
                assert.equal(page.location.href, `${stub.websiteOrigin}/`, 'replayed callback must fail closed');
            } finally { await page.close(); }
        }
    } finally { await stub.close(); }
});
