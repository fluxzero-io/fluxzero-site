import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createPublicKey, randomBytes, verify } from 'node:crypto';
import { startWebsiteOidcStub } from './website-oidc-stub.mjs';

test('website stub completes silent code+PKCE and requires a local session', async () => {
    const stub = await startWebsiteOidcStub({ port: 0 });
    assert.equal(stub.websiteOrigin, 'http://localhost:4321');
    assert.equal(new URL(stub.issuer).hostname, 'localhost');
    const redirectUri = `${stub.websiteOrigin}/oidc/silent-callback/`;
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const request = (path, options = {}) => fetch(`${stub.issuer}${path}`, {
        redirect: 'manual',
        ...options,
    });
    const authorizationPath = ({ includeNonce = true } = {}) => {
        const query = new URLSearchParams({
            client_id: stub.clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid profile',
            state: 'random-state',
            prompt: 'none',
            code_challenge_method: 'S256',
            code_challenge: challenge,
        });
        if (includeNonce) query.set('nonce', 'random-nonce');
        return `/oauth2/auth?${query}`;
    };

    try {
        const discovery = await (await request('/.well-known/openid-configuration')).json();
        assert.equal(discovery.issuer, stub.issuer);
        assert.deepEqual(discovery.prompt_values_supported, ['none', 'login', 'create']);
        assert.equal(discovery.end_session_endpoint, `${stub.issuer}/oauth2/sessions/logout`);

        const anonymous = await request(authorizationPath());
        assert.equal(anonymous.status, 302);
        assert.equal(new URL(anonymous.headers.get('location')).searchParams.get('error'), 'login_required');

        const login = await request('/__stub/login');
        const cookie = login.headers.get('set-cookie').split(';')[0];
        assert.match(cookie, /^fz_website_stub_session=/);

        const authorization = await request(authorizationPath(), { headers: { Cookie: cookie } });
        assert.equal(authorization.status, 302);
        const callback = new URL(authorization.headers.get('location'));
        assert.equal(callback.origin + callback.pathname, redirectUri);
        assert.equal(callback.searchParams.get('state'), 'random-state');
        const code = callback.searchParams.get('code');
        assert.ok(code);

        const tokenForm = new URLSearchParams({
            grant_type: 'authorization_code', client_id: stub.clientId,
            redirect_uri: redirectUri, code, code_verifier: verifier,
        });
        const token = await request('/oauth2/token', {
            method: 'POST',
            headers: { Origin: stub.websiteOrigin, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenForm,
        });
        assert.equal(token.status, 200);
        assert.equal(token.headers.get('access-control-allow-origin'), stub.websiteOrigin);
        const tokens = await token.json();
        const [header, payload, signature] = tokens.id_token.split('.');
        const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
        assert.equal(claims.iss, stub.issuer);
        assert.equal(claims.aud, stub.clientId);
        assert.equal(claims.nonce, 'random-nonce');
        assert.equal(claims.given_name, 'Demo');
        const jwks = await (await request('/.well-known/jwks.json')).json();
        assert.ok(verify('RSA-SHA256', Buffer.from(`${header}.${payload}`),
            createPublicKey({ key: jwks.keys[0], format: 'jwk' }), Buffer.from(signature, 'base64url')));

        const withoutNonce = await request(authorizationPath({ includeNonce: false }), {
            headers: { Cookie: cookie },
        });
        assert.equal(withoutNonce.status, 302);
        const secondCode = new URL(withoutNonce.headers.get('location')).searchParams.get('code');
        const secondToken = await request('/oauth2/token', {
            method: 'POST',
            headers: { Origin: stub.websiteOrigin },
            body: new URLSearchParams({
                grant_type: 'authorization_code', client_id: stub.clientId,
                redirect_uri: redirectUri, code: secondCode, code_verifier: verifier,
            }),
        });
        assert.equal(secondToken.status, 200);
        const secondClaims = JSON.parse(Buffer.from((await secondToken.json()).id_token.split('.')[1], 'base64url'));
        assert.equal(secondClaims.nonce, undefined);

        const replay = await request('/oauth2/token', {
            method: 'POST', headers: { Origin: stub.websiteOrigin }, body: tokenForm,
        });
        assert.equal(replay.status, 400);

        const logout = await request('/__stub/logout', { headers: { Cookie: cookie } });
        assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
    } finally {
        await stub.close();
    }
});

test('website stub supports login, registration, profile and RP logout without email', async () => {
    const stub = await startWebsiteOidcStub({ port: 0 });
    const redirectUri = `${stub.websiteOrigin}/oidc/callback/`;
    const request = (path, options = {}) => fetch(`${stub.issuer}${path}`, { redirect: 'manual', ...options });
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const authorization = `/oauth2/auth?${new URLSearchParams({
        client_id: stub.clientId, redirect_uri: redirectUri, response_type: 'code',
        scope: 'openid profile', state: 'website-return-state', nonce: 'website-nonce',
        code_challenge_method: 'S256', code_challenge: challenge,
        theme: 'light',
    })}`;
    try {
        const login = await request(authorization);
        assert.equal(login.status, 302);
        const loginUrl = new URL(login.headers.get('location'), stub.issuer);
        assert.equal(loginUrl.pathname, '/login');
        assert.equal(loginUrl.searchParams.get('theme'), 'light');
        const continuation = loginUrl.searchParams.get('returnTo');
        assert.match(continuation, /^\/oauth2\/auth\?transaction=[a-f0-9]{32}$/);

        const unboundLogin = await request(`/login?returnTo=${encodeURIComponent(authorization)}`);
        assert.equal(unboundLogin.status, 400);

        const themedLoginUrl = new URL('/login', stub.issuer);
        themedLoginUrl.searchParams.set('returnTo', continuation);
        themedLoginUrl.searchParams.set('theme', 'dark');
        assert.equal((await request(`${themedLoginUrl.pathname}${themedLoginUrl.search}`)).status, 400);
        themedLoginUrl.searchParams.set('theme', 'light');
        const themedLogin = await request(`${themedLoginUrl.pathname}${themedLoginUrl.search}`);
        assert.equal(themedLogin.status, 302);
        assert.equal(themedLogin.headers.get('location'), `${stub.issuer}${continuation}`);

        const registrationUrl = new URL('/register', stub.issuer);
        registrationUrl.searchParams.set('returnTo', continuation);
        registrationUrl.searchParams.set('theme', 'light');
        const registration = await request(`${registrationUrl.pathname}${registrationUrl.search}`);
        assert.equal(registration.status, 302);
        assert.equal(registration.headers.get('location'), `${stub.issuer}${continuation}`);
        const cookie = registration.headers.get('set-cookie').split(';')[0];

        const resumed = await request(continuation, { headers: { Cookie: cookie } });
        assert.equal(resumed.headers.get('location'), authorization);
        const callback = new URL((await request(authorization, { headers: { Cookie: cookie } })).headers.get('location'));
        assert.equal(callback.origin + callback.pathname, redirectUri);
        assert.equal(callback.searchParams.get('state'), 'website-return-state');
        const token = await request('/oauth2/token', {
            method: 'POST', headers: { Origin: stub.websiteOrigin },
            body: new URLSearchParams({ grant_type: 'authorization_code', client_id: stub.clientId,
                redirect_uri: redirectUri, code: callback.searchParams.get('code'), code_verifier: verifier }),
        });
        assert.equal(token.status, 200);

        const profile = await request('/account', { headers: { Cookie: cookie } });
        assert.equal(profile.status, 200);
        assert.match(await profile.text(), /Demo Builder/);

        const logout = await request(`/oauth2/sessions/logout?${new URLSearchParams({
            client_id: stub.clientId,
            post_logout_redirect_uri: `${stub.websiteOrigin}/oidc/logout-callback/`,
            state: 'logout-state',
        })}`, { headers: { Cookie: cookie } });
        assert.equal(logout.status, 302);
        assert.equal(new URL(logout.headers.get('location')).searchParams.get('state'), 'logout-state');
        assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);

        const unsafeRegistration = await request('/register?returnTo=https://elsewhere.example/');
        assert.equal(unsafeRegistration.status, 400);
    } finally {
        await stub.close();
    }
});

test('registration rejects unbound entry, invalid hints and continuation replacement', async () => {
    const stub = await startWebsiteOidcStub({ port: 0 });
    const request = (url) => fetch(url, { redirect: 'manual' });
    const authorization = new URL('/oauth2/auth', stub.issuer);
    authorization.search = new URLSearchParams({
        client_id: stub.clientId, redirect_uri: `${stub.websiteOrigin}/oidc/callback/`,
        response_type: 'code', scope: 'openid profile', state: 'return-state', nonce: 'nonce',
        code_challenge_method: 'S256', code_challenge: randomBytes(32).toString('base64url'),
        prompt: 'create', theme: 'dark',
    }).toString();
    try {
        for (const [name, value] of [['prompt', 'create none'], ['prompt', 'signup'],
            ['theme', 'unknown'], ['returnTo', '/register']]) {
            const invalid = new URL(authorization);
            invalid.searchParams.set(name, value);
            assert.equal((await request(invalid)).status, 400);
        }
        const entry = new URL((await request(authorization)).headers.get('location'), stub.issuer);
        assert.equal(entry.pathname, '/register');
        const continuation = new URL(entry.searchParams.get('returnTo'), stub.issuer);
        continuation.searchParams.set('theme', 'light');
        const replaced = await request(continuation);
        assert.equal(replaced.headers.get('location'), '/login?error=authorization_unavailable');
        entry.searchParams.set('theme', 'light');
        assert.equal((await request(entry)).status, 400);
        const unbound = new URL('/register', stub.issuer);
        unbound.searchParams.set('returnTo', `${authorization.pathname}${authorization.search}`);
        assert.equal((await request(unbound)).status, 400);
    } finally { await stub.close(); }
});
