import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import {dirname, resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {corePages} from './core-pages.mjs';
import {parseCookies, unsealCookiePayload} from '../src/pages/api/auth/_utils.ts';

// Exercise the built workerd bundle. All requests stay on loopback, and the
// GitHub login route only constructs a redirect; it never follows that redirect.
const require = createRequire(import.meta.url);
const cli = resolve(dirname(require.resolve('wrangler/package.json')), 'bin/wrangler.js');
const redirect = JSON.parse(await readFile('.wrangler/deploy/config.json', 'utf8'));
const config = JSON.parse(await readFile(resolve('.wrangler/deploy', redirect.configPath), 'utf8'));
if (process.env.CLOUDFLARE_ENV) {
    assert.ok(config.name.endsWith(`-${process.env.CLOUDFLARE_ENV}`), 'Build must select the intended deployment environment');
    assert.equal(config.vars.FEEDBACK_PROVIDER, 'github-issues');
}

const reservation = createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const secret = 'local-worker-fixture-cookie-key';
const env = {...process.env, WRANGLER_SEND_METRICS: 'false'};
for (const name of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_KEY', 'CF_API_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN']) delete env[name];
const child = spawn(process.execPath, [cli, 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port),
    '--name', 'fluxzero-site-qualification',
    '--var', 'FEEDBACK_PROVIDER:github-issues',
    '--var', `COOKIE_SECRET:${secret}`,
    '--var', 'GITHUB_APP_CLIENT_ID:local-worker-fixture',
    '--var', 'GITHUB_APP_CLIENT_SECRET:local-worker-fixture'], {
    env, detached: true, stdio: ['ignore', 'pipe', 'pipe']
});
const exited = once(child, 'exit');
let output = '';
const collect = chunk => output = (output + chunk).slice(-12000);
child.stdout.on('data', collect);
child.stderr.on('data', collect);

try {
    let ready = false;
    for (let attempt = 0; attempt < 180; attempt++) {
        assert.equal(child.exitCode, null, 'Local Worker exited before qualification');
        try {
            const response = await fetch(origin, {signal: AbortSignal.timeout(1000)});
            if (response.ok) {ready = true; break;}
        } catch { /* workerd is still starting */ }
        await delay(250);
    }
    assert.ok(ready, 'Built Worker must start without a Cloudflare account or credentials');
    for (const path of corePages) {
        const response = await fetch(new URL(path, origin));
        assert.equal(response.status, 200, path);
        assert.match(response.headers.get('content-type'), /text\/html/, path);
        const html = await response.text();
        assert.match(html, /<main(?:\s|>)/, path);
        if (path === '/') assert.match(html, /http-equiv="Content-Security-Policy"/, 'Keep homepage stylesheet protection');
    }
    const markdown = await fetch(origin + '/', {headers: {accept: 'text/markdown'}});
    assert.equal(markdown.status, 200);
    assert.match(markdown.headers.get('content-type'), /text\/markdown/);
    assert.match(markdown.headers.get('vary'), /Accept/i);
    assert.equal(markdown.headers.get('content-location'), '/index.md');
    assert.ok((await markdown.text()).length > 100);
    const head = await fetch(origin + '/', {method: 'HEAD', headers: {accept: 'text/markdown'}});
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');

    const legacy = await fetch(origin + '/monitoring?source=fixture', {redirect: 'manual'});
    assert.equal(legacy.status, 302);
    assert.equal(legacy.headers.get('location'), origin + '/product-insight/?source=fixture');
    assert.equal((await fetch(origin + '/not-a-real-route-for-qualification')).status, 404);
    assert.equal((await fetch(origin + '/api/feedback', {
        method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'
    })).status, 400);
    assert.equal((await fetch(origin + '/api/auth/github/me')).status, 401);

    const login = await fetch(origin + '/api/auth/github/login?returnTo=//untrusted.invalid', {redirect: 'manual'});
    assert.equal(login.status, 302);
    const authorize = new URL(login.headers.get('location'));
    assert.equal(authorize.origin, 'https://github.com');
    assert.equal(authorize.pathname, '/login/oauth/authorize');
    assert.equal(authorize.searchParams.get('client_id'), 'local-worker-fixture');
    const state = await unsealCookiePayload(authorize.searchParams.get('state'), secret);
    assert.equal(state.returnTo, '/', 'Do not permit an external return destination');
    assert.equal(state.n, parseCookies(login.headers.get('set-cookie')).fx_gh_state);
    assert.match(login.headers.get('set-cookie'), /HttpOnly/);
    const rejected = await fetch(origin + '/api/auth/github/callback?code=fixture&state=invalid', {redirect: 'manual'});
    assert.equal(rejected.status, 400, 'Reject invalid state before any external token request');
    console.log(`Built Worker qualified: ${corePages.length} core pages, Markdown/HEAD, redirects, 404 and local auth boundaries.`);
} catch (error) {
    console.error(output);
    throw error;
} finally {
    try {process.kill(-child.pid, 'SIGTERM');} catch (error) {if (error.code !== 'ESRCH') throw error;}
    await Promise.race([exited, delay(5000)]);
}
