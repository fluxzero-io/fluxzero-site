import { spawn } from 'node:child_process';
import { startWebsiteOidcStub } from './website-oidc-stub.mjs';

const [, , mode, port] = process.argv;
if (!['stub', 'live'].includes(mode) || !/^\d+$/.test(port || '') || Number(port) < 1 || Number(port) > 65535) {
    process.stderr.write('Usage: node scripts/dev-website.mjs <stub|live> <astro-port>\n');
    process.exit(2);
}

const environment = { ...process.env };
// Local previews should stay available when the public GitHub release API is rate limited.
environment.npm_package_config_ghreleases_optional = 'true';
environment.npm_package_config_javadoc_optional = 'true';
let stub;
if (mode === 'stub') {
    const websiteOrigin = process.env.WEBSITE_STUB_ORIGIN || 'http://site.fluxzero.localhost:4321';
    const stubPort = Number(process.env.WEBSITE_STUB_PORT || '4390');
    stub = await startWebsiteOidcStub({ websiteOrigin, port: stubPort });
    environment.PUBLIC_WEBSITE_OIDC_ENABLED = 'true';
    environment.PUBLIC_WEBSITE_OIDC_ISSUER = stub.issuer;
    environment.PUBLIC_WEBSITE_OIDC_CLIENT_ID = stub.clientId;
    delete environment.PUBLIC_WEBSITE_OIDC_RESOURCE;
    process.stdout.write(`Website OIDC stub: ${stub.issuer}/ (sign in here as Demo Builder)\n`);
    process.stdout.write(`Website: ${websiteOrigin}/\n`);
}

const commands = [
    ['exec', 'astro', 'sync'],
    ['sync:docs'],
    ['exec', 'astro', 'dev', '--host', '127.0.0.1', '--port', port, '--strictPort'],
];
let active;
let stopping = false;

async function stop() {
    if (stopping) return;
    stopping = true;
    if (active && active.exitCode === null) active.kill('SIGTERM');
    if (stub) await stub.close();
}

process.once('SIGINT', () => { void stop(); });
process.once('SIGTERM', () => { void stop(); });

try {
    for (const args of commands) {
        if (stopping) break;
        active = spawn('pnpm', args, { stdio: 'inherit', env: environment });
        const code = await new Promise((resolve, reject) => {
            active.once('error', reject);
            active.once('exit', (exitCode) => resolve(exitCode));
        });
        if (code !== 0 && !stopping) throw new Error(`pnpm ${args.join(' ')} exited with ${code}`);
    }
} catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
} finally {
    await stop();
}
