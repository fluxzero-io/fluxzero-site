import { setTimeout as delay } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { corePages, retiredPages, siteUrl } from './core-pages.mjs';

export async function submitIndexNow({ fetch: send = fetch, read = readFile, wait = delay, attempts = 12 } = {}) {
// IndexNow ownership keys are served publicly, unlike account credentials.
const key = (await read('public/indexnow-key.txt', 'utf8')).trim();
const keyLocation = `${siteUrl}/indexnow-key.txt`;
const request = url => send(url, {signal:AbortSignal.timeout(20000)});
// Newly deployed assets can briefly lag behind the Worker deployment.
for (let attempt = 1; ; attempt++) {
try {
const keyResponse = await request(keyLocation);
if (!keyResponse.ok || (await keyResponse.text()).trim() !== key) throw new Error('Deployed IndexNow ownership key does not match');
const live = await request(`${siteUrl}/llms.txt`);
if (!live.ok || await live.text() !== await read('dist/llms.txt','utf8')) throw new Error('Production content does not match this build; skipping indexing notification');
for (const path of retiredPages) {
    const response = await request(siteUrl + path);
    if (![404,410].includes(response.status)) throw new Error(`Retired page still served: ${path}`);
}
break;
} catch (error) {
    if (attempt >= attempts) throw error;
    console.log(`Production not ready for IndexNow (${attempt}/${attempts}); retrying in 10 seconds.`);
    await wait(10000);
}
}
const response = await send('https://api.indexnow.org/indexnow', {
    method:'POST', headers:{'content-type':'application/json'}, signal:AbortSignal.timeout(20000),
    body:JSON.stringify({host:new URL(siteUrl).host,key,keyLocation,urlList:[...corePages,...retiredPages].map(path=>siteUrl+path)})
});
if (![200,202].includes(response.status)) throw new Error(`IndexNow submission failed: HTTP ${response.status}`);
console.log(`IndexNow accepted ${corePages.length + retiredPages.length} URLs (HTTP ${response.status}). Acceptance does not guarantee indexing.`);

}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await submitIndexNow();
