import { createServer } from 'node:http';
import { generateKeyPairSync, randomBytes, sign, createHash, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const SESSION_COOKIE = 'fz_website_stub_session';
const SESSION_VALUE = 'website-demo';

function json(response, status, payload, extraHeaders = {}) {
    response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        ...extraHeaders,
    });
    response.end(JSON.stringify(payload));
}

function redirect(response, location, cookie) {
    response.writeHead(302, {
        Location: location,
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        ...(cookie ? { 'Set-Cookie': cookie } : {}),
    });
    response.end();
}

function withQuery(redirectUri, values) {
    const url = new URL(redirectUri);
    for (const [key, value] of Object.entries(values)) url.searchParams.set(key, value);
    return url.href;
}

function authorizationReturn(value, issuer) {
    if (!value || !value.startsWith('/oauth2/auth?') || value.includes('\\')) return undefined;
    const target = new URL(value, issuer);
    return target.origin === issuer && target.pathname === '/oauth2/auth' ? target.href : undefined;
}

function hasSession(cookieHeader) {
    return String(cookieHeader || '').split(';').some((part) => part.trim() === `${SESSION_COOKIE}=${SESSION_VALUE}`);
}

function base64url(value) {
    return Buffer.from(value).toString('base64url');
}

async function bodyOf(request) {
    let body = '';
    for await (const chunk of request) {
        body += chunk.toString('utf8');
        if (body.length > 16_384) throw new Error('body too large');
    }
    return new URLSearchParams(body);
}

export async function startWebsiteOidcStub({
    port = 4390,
    hostname = 'login.fluxzero.localhost',
    websiteOrigin = 'http://site.fluxzero.localhost:4321',
    clientId = 'fluxzero-website-local',
} = {}) {
    const websiteUrl = new URL(websiteOrigin);
    if (!['http:', 'https:'].includes(websiteUrl.protocol) || websiteUrl.pathname !== '/'
        || websiteUrl.search || websiteUrl.hash || websiteUrl.username || websiteUrl.password) {
        throw new Error('websiteOrigin must be an HTTP(S) origin');
    }
    const silentRedirectUri = `${websiteUrl.origin}/oidc/silent-callback/`;
    const interactiveRedirectUri = `${websiteUrl.origin}/oidc/callback/`;
    const logoutRedirectUri = `${websiteUrl.origin}/oidc/logout-callback/`;
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = publicKey.export({ format: 'jwk' });
    const kid = randomBytes(12).toString('base64url');
    const codes = new Map();
    let lastSilentCheck = 'No request yet';
    let issuer;

    const handleRequest = async (request, response) => {
        if (!issuer || request.headers.host !== new URL(issuer).host) {
            json(response, 404, { error: 'not_found' });
            return;
        }
        const url = new URL(request.url || '/', issuer);
        const origin = request.headers.origin;
        const cors = origin === websiteUrl.origin
            ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
            : { Vary: 'Origin' };

        if (request.method === 'OPTIONS' && url.pathname === '/oauth2/token') {
            if (origin !== websiteUrl.origin) {
                json(response, 403, { error: 'forbidden' });
                return;
            }
            response.writeHead(204, {
                ...cors,
                'Access-Control-Allow-Methods': 'POST',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Cache-Control': 'no-store',
            });
            response.end();
            return;
        }

        if (request.method === 'GET' && url.pathname === '/.well-known/openid-configuration') {
            json(response, 200, {
                issuer,
                authorization_endpoint: `${issuer}/oauth2/auth`,
                token_endpoint: `${issuer}/oauth2/token`,
                end_session_endpoint: `${issuer}/oauth2/sessions/logout`,
                jwks_uri: `${issuer}/.well-known/jwks.json`,
                response_types_supported: ['code'],
                grant_types_supported: ['authorization_code'],
                subject_types_supported: ['pairwise'],
                id_token_signing_alg_values_supported: ['RS256'],
                token_endpoint_auth_methods_supported: ['none'],
                code_challenge_methods_supported: ['S256'],
                scopes_supported: ['openid', 'profile'],
                prompt_values_supported: ['none', 'login'],
            }, cors);
            return;
        }
        if (request.method === 'GET' && url.pathname === '/.well-known/jwks.json') {
            json(response, 200, { keys: [{ ...jwk, kid, alg: 'RS256', use: 'sig' }] }, cors);
            return;
        }

        if (request.method === 'GET' && url.pathname === '/oauth2/auth') {
            const params = url.searchParams;
            const state = params.get('state');
            const nonce = params.get('nonce');
            const challenge = params.get('code_challenge');
            const requestedRedirectUri = params.get('redirect_uri');
            const scopes = new Set((params.get('scope') || '').split(' ').filter(Boolean));
            if (params.get('client_id') !== clientId || ![silentRedirectUri, interactiveRedirectUri].includes(requestedRedirectUri)
                || params.get('response_type') !== 'code' || !state
                || params.get('code_challenge_method') !== 'S256' || !challenge
                || params.has('resource') || params.has('audience')
                || !/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) {
                lastSilentCheck = 'Invalid authorization request';
                json(response, 400, { error: 'invalid_request' });
                return;
            }
            if (!scopes.has('openid') || [...scopes].some((scope) => !['openid', 'profile'].includes(scope))) {
                lastSilentCheck = 'Consent required';
                redirect(response, withQuery(requestedRedirectUri, { error: 'consent_required', state }));
                return;
            }
            if (!hasSession(request.headers.cookie)) {
                lastSilentCheck = 'No session';
                if (params.get('prompt') === 'none') {
                    redirect(response, withQuery(requestedRedirectUri, { error: 'login_required', state }));
                } else {
                    redirect(response, `/login?returnTo=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
                }
                return;
            }
            lastSilentCheck = 'Code issued';
            const code = randomBytes(32).toString('base64url');
            codes.set(code, { challenge, nonce, redirectUri: requestedRedirectUri,
                scopes: [...scopes].join(' '), expiresAt: Date.now() + 60_000 });
            redirect(response, withQuery(requestedRedirectUri, { code, state }));
            return;
        }

        if (request.method === 'POST' && url.pathname === '/oauth2/token') {
            if (origin && origin !== websiteUrl.origin) {
                json(response, 403, { error: 'forbidden' });
                return;
            }
            let form;
            try {
                form = await bodyOf(request);
            } catch {
                json(response, 413, { error: 'invalid_request' }, cors);
                return;
            }
            const code = form.get('code');
            const authorization = code && codes.get(code);
            if (code) codes.delete(code);
            const verifier = form.get('code_verifier') || '';
            const actualChallenge = createHash('sha256').update(verifier).digest('base64url');
            const expectedChallenge = authorization?.challenge || '';
            const challengeMatches = expectedChallenge.length === actualChallenge.length
                && timingSafeEqual(Buffer.from(expectedChallenge), Buffer.from(actualChallenge));
            if (form.get('grant_type') !== 'authorization_code' || form.get('client_id') !== clientId
                || form.get('redirect_uri') !== authorization?.redirectUri || !authorization
                || authorization.expiresAt < Date.now() || !challengeMatches) {
                json(response, 400, { error: 'invalid_grant' }, cors);
                return;
            }
            const now = Math.floor(Date.now() / 1000);
            const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }));
            const claims = {
                iss: issuer, aud: clientId, sub: 'website-demo-builder',
                iat: now, exp: now + 300,
                ...(authorization.nonce ? { nonce: authorization.nonce } : {}),
                name: 'Demo Builder', given_name: 'Demo',
            };
            const payload = base64url(JSON.stringify(claims));
            const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey)
                .toString('base64url');
            json(response, 200, {
                access_token: randomBytes(32).toString('base64url'),
                id_token: `${header}.${payload}.${signature}`,
                token_type: 'Bearer', expires_in: 300, scope: authorization.scopes,
            }, cors);
            return;
        }

        if (request.method === 'GET' && ['/login', '/register'].includes(url.pathname)) {
            const returnTo = authorizationReturn(url.searchParams.get('returnTo'), issuer);
            if (!returnTo) {
                json(response, 400, { error: 'invalid_return' });
                return;
            }
            redirect(response, returnTo, `${SESSION_COOKIE}=${SESSION_VALUE}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`);
            return;
        }

        if (request.method === 'GET' && url.pathname === '/account') {
            if (!hasSession(request.headers.cookie)) {
                redirect(response, '/');
                return;
            }
            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
            response.end('<!doctype html><html lang="en"><title>Profile</title><h1>Demo Builder</h1><p>Website-only local profile.</p></html>');
            return;
        }

        if (request.method === 'GET' && url.pathname === '/oauth2/sessions/logout') {
            if (url.searchParams.get('post_logout_redirect_uri') !== logoutRedirectUri
                || (url.searchParams.has('client_id') && url.searchParams.get('client_id') !== clientId)) {
                json(response, 400, { error: 'invalid_request' });
                return;
            }
            const state = url.searchParams.get('state');
            redirect(response, state ? withQuery(logoutRedirectUri, { state }) : logoutRedirectUri,
                `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
            return;
        }

        if (request.method === 'GET' && url.pathname === '/') {
            const signedIn = hasSession(request.headers.cookie);
            response.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store',
                'Referrer-Policy': 'no-referrer',
                'X-Frame-Options': 'DENY',
            });
            response.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Website OIDC stub</title><body style="font:16px system-ui;max-width:36rem;margin:5rem auto"><h1>Website OIDC stub</h1><p>${signedIn ? 'Signed in as Demo Builder.' : 'Signed out.'}</p><p><a href="/__stub/${signedIn ? 'logout' : 'login'}">${signedIn ? 'Sign out' : 'Sign in as Demo Builder'}</a></p><p>Last silent check: ${lastSilentCheck}</p><p><a href="${websiteUrl.origin}/">Return to the website</a></p></body></html>`);
            return;
        }
        if (request.method === 'GET' && url.pathname === '/__stub/login') {
            redirect(response, '/', `${SESSION_COOKIE}=${SESSION_VALUE}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`);
            return;
        }
        if (request.method === 'GET' && url.pathname === '/__stub/logout') {
            redirect(response, '/', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
            return;
        }
        json(response, 404, { error: 'not_found' });
    };

    const server = createServer(handleRequest);

    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', resolve);
    });
    const boundPort = server.address().port;
    const ipv6Server = createServer(handleRequest);
    try {
        await new Promise((resolve, reject) => {
            ipv6Server.once('error', reject);
            ipv6Server.listen(boundPort, '::1', resolve);
        });
    } catch (error) {
        await new Promise((resolve) => server.close(resolve));
        throw error;
    }
    issuer = `http://${hostname}:${boundPort}`;
    return {
        issuer,
        websiteOrigin: websiteUrl.origin,
        clientId,
        close: () => Promise.all([server, ipv6Server].map((instance) =>
            new Promise((resolve, reject) => instance.close((error) => error ? reject(error) : resolve())))),
    };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const stub = await startWebsiteOidcStub();
    process.stdout.write(`Website-only OIDC stub: ${stub.issuer}/\n`);
}
