import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/scripts/website-oidc.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source.replaceAll('import.meta.env.DEV', 'false'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

function website({ prerendering = false, configured = true } = {}) {
    let storage = new Map();
    const sessionStorage = {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.delete(key),
    };
    const trigger = {
        dataset: {},
        setAttribute() {},
        removeAttribute() {},
    };
    const control = {
        dataset: { oidcIssuer: 'https://login.example.test', oidcClientId: 'website' },
        hasAttribute: () => configured,
        querySelector: (selector) => selector === '.website-account-trigger' ? trigger : null,
        addEventListener() {},
    };
    const document = new EventTarget();
    if (prerendering !== 'unsupported') document.prerendering = prerendering;
    document.hidden = Boolean(document.prerendering);
    document.querySelectorAll = () => [control];
    let managers = 0;
    let silentChecks = 0;
    class UserManager {
        constructor(settings) {
            managers++;
            this.settings = settings;
        }
        async signinSilent() {
            silentChecks++;
            const store = this.settings.stateStore.store;
            store.setItem('oidc.test-transaction', 'pending');
            // Cross-origin authorization finishes only after prerender activation.
            if (document.prerendering) {
                await new Promise((resolve) => document.addEventListener('prerenderingchange', resolve, { once: true }));
            }
            if (store.getItem('oidc.test-transaction') !== 'pending') {
                throw new Error('No matching state found in storage');
            }
            store.removeItem('oidc.test-transaction');
            return { profile: { name: 'Demo Builder' }, expired: false };
        }
    }
    const exports = {};
    runInNewContext(outputText, {
        exports,
        require: (name) => {
            assert.equal(name, 'oidc-client-ts');
            return {
                UserManager,
                InMemoryWebStorage: class {},
                WebStorageStateStore: class { constructor({ store }) { this.store = store; } },
            };
        },
        document,
        window: Object.assign(new EventTarget(), {
            sessionStorage, location: new URL('https://example.test/'),
        }),
        sessionStorage,
        crypto: webcrypto,
        btoa,
        Event,
    });
    return {
        init: exports.initWebsiteOidc,
        counts: () => ({ managers, silentChecks }),
        signedIn: () => trigger.dataset.oidcState === 'signed-in',
        presence: () => sessionStorage.getItem('fluxzero.website.oidc.presence.v1'),
        activate: () => {
            // Chrome discards prerender writes before firing prerenderingchange.
            storage = new Map();
            document.prerendering = false;
            document.hidden = false;
            document.dispatchEvent(new Event('prerenderingchange'));
        },
    };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('a prerendered page confirms the IDP session after the storage swap', async () => {
    const page = website({ prerendering: true });
    page.init();
    const beforeActivation = page.counts();
    const presenceBeforeActivation = page.presence();

    page.activate();
    await settle();
    assert.equal(page.signedIn(), true);
    assert.deepEqual(beforeActivation, { managers: 0, silentChecks: 0 });
    assert.equal(presenceBeforeActivation, null);
    assert.deepEqual(page.counts(), { managers: 1, silentChecks: 1 });
    assert.ok(page.presence());

    page.activate();
    await settle();
    assert.deepEqual(page.counts(), { managers: 1, silentChecks: 1 });
});

test('normal navigation and browsers without prerendering support check immediately', async () => {
    for (const prerendering of [false, 'unsupported']) {
        const page = website({ prerendering });
        page.init();
        assert.deepEqual(page.counts(), { managers: 1, silentChecks: 1 });
        await settle();
        assert.equal(page.signedIn(), true);
    }
});

test('a discarded prerender and disabled OIDC never start a session check', async () => {
    for (const options of [{ prerendering: true }, { configured: false }]) {
        const page = website(options);
        page.init();
        await settle();
        assert.deepEqual(page.counts(), { managers: 0, silentChecks: 0 });
        assert.equal(page.presence(), null);
    }
});
