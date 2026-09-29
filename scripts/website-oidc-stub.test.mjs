import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createPublicKey, randomBytes, verify } from 'node:crypto';
import { startWebsiteOidcStub } from './website-oidc-stub.mjs';

test('website stub completes silent code+PKCE and requires a local session', async () => {
    const stub = await startWebsiteOidcStub({ port: 0 });
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
        assert.deepEqual(discovery.prompt_values_supported, ['none']);

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
