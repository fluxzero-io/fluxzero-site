import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectPage, validateDiscovery } from './check-discovery.mjs';
import { lastChanged } from './sitemap-dates.mjs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const site='https://fluxzero.io';
function fixture() {
    const home = `# Home\n\nSource: ${site}/\n\nOverview.\n`;
    const proof = `# Proof\n\nSource: ${site}/proof/\n\nDetails.\n`;
    return {pages:new Map([['/',inspectPage(`<link rel="canonical" href="${site}/"><a href="/proof">Proof</a>`,'/')],['/proof/',inspectPage(`<link rel="canonical" href="${site}/proof/"><a href="/">Home</a>`,'/proof/')]]),sitemap:new Set(['/','/proof/']),llms:`[Home](${site}/) [Proof](${site}/proof/)\n\n${home}\n---\n\n${proof}`,markdown:new Map([['/',home],['/proof/',proof]]),robots:`Sitemap: ${site}/sitemap-index.xml`};
}
const check = f => validateDiscovery(f,['/','/proof/']);
test('accepts linked canonical pages and complete exports',()=>assert.deepEqual(check(fixture()),[]));
for(const [label,mutate] of [
    ['missing HTML', f=>f.pages.delete('/proof/')],
    ['absent from sitemap',f=>f.sitemap.delete('/proof/')],
    ['absent from llms.txt',f=>{f.llms='';}],
    ['missing page Markdown',f=>{f.markdown.delete('/');}],
    ['incomplete content in llms.txt',f=>{f.llms=f.llms.replace('Overview.', 'Truncated.');}],
    ['links to its own alias',f=>{f.llms+='[Full content]('+site+'/llms-full.txt)';}],
    ['incorrect canonical',f=>{f.pages.get('/proof/').canonical=[site+'/wrong/'];}],
    ['noindex',f=>{f.pages.set('/proof/',inspectPage(`<link rel="canonical" href="${site}/proof/"><meta name="googlebot" content="none">`,'/proof/'));}],
    ['no incoming internal link',f=>{f.pages.get('/').links=[];}],
    ['retired page',f=>f.sitemap.add('/makeitreal/')],
]) test(`rejects ${label}`,()=>{const f=fixture();mutate(f);assert.ok(check(f).some(s=>s.includes(label)));});
test('accepts Markdown index links', () => {
    const f = fixture();
    f.llms = f.llms.replace(`](${site}/)`, `](${site}/index.md)`).replace(`](${site}/proof/)`, `](${site}/proof/index.md)`);
    assert.deepEqual(check(f), []);
});
test('ignores external and nofollow links',()=>assert.deepEqual(inspectPage('<a href="https://other.example/proof/">x</a><a rel="nofollow" href="/proof/">x</a>','/').links,[]));
test('lastmod stays at source change even after unrelated commits',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'sitemap-date-'));
    const git=(...args)=>execFileSync('git',args,{cwd:dir,stdio:'pipe',env:{...process.env,GIT_AUTHOR_DATE:'2025-01-02T12:00:00Z',GIT_COMMITTER_DATE:'2025-01-02T12:00:00Z'}});
    try {
        git('init');git('config','user.name','Test');git('config','user.email','test@example.com');
        await writeFile(join(dir,'page.astro'),'content');git('add','.');git('commit','-m','initial');
        const date=lastChanged(dir,['page.astro']);assert.ok(date.startsWith('2025-01-02'));
        await writeFile(join(dir,'other.txt'),'other');git('add','.');git('commit','-m','unrelated');
        assert.equal(lastChanged(dir,['page.astro']),date);assert.equal(lastChanged(dir,['unknown']),undefined);
    } finally {await rm(dir,{recursive:true,force:true});}
});


test('IndexNow submits only after the correct release and removal are live',async()=>{
    const {submitIndexNow}=await import('./submit-indexnow.mjs');
    const calls=[];
    const read=async path=>path.endsWith('key.txt')?'ownership-key':'full release';
    const send=async (url,options)=>{
        calls.push({url,options});
        if(url.endsWith('indexnow-key.txt')) return new Response('ownership-key');
        if(url.endsWith('llms.txt')) return new Response('full release');
        if(url.includes('makeitreal')) return new Response('',{status:404});
        return new Response('',{status:202});
    };
    await submitIndexNow({fetch:send,read});
    assert.equal(calls.at(-1).options.method,'POST');
    const payload=JSON.parse(calls.at(-1).options.body);
    assert.ok(payload.urlList.includes(site+'/product-code/'));
    assert.ok(payload.urlList.includes(site+'/makeitreal/'));
    const postCount=calls.filter(c=>c.options?.method==='POST').length;
    await assert.rejects(submitIndexNow({read,fetch:async(url,options)=>url.endsWith('llms.txt')?new Response('old release'):send(url,options)}),/does not match/);
    assert.equal(calls.filter(c=>c.options?.method==='POST').length,postCount);
});
