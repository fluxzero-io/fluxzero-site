import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prefersMarkdown, negotiateMarkdown } from '../src/server/markdown-negotiation.mjs';
import { legacyMonitoringPaths, redirectLegacyMonitoring } from '../src/server/legacy-redirects.mjs';
import { corePages } from './core-pages.mjs';

for (const [accept, expected] of [
    ['',false], ['*/*',false], ['text/*',false], ['text/html,application/xhtml+xml,*/*;q=0.8',false],
    ['text/markdown',true], ['text/markdown, */*',true], ['text/markdown;q=0',false],
    ['text/html, text/markdown;q=0.5',false], ['text/html;q=0.5, text/markdown',true],
    ['text/html, text/markdown',false], ['text/markdown;q=0.1,text/html;q=0,*/*',true],
    ['TEXT/MARKDOWN; charset=utf-8',true], ['text/markdown;q=invalid',false]
]) test(`Accept: ${accept || '(empty)'}`,()=>assert.equal(prefersMarkdown(accept),expected));

test('negotiates aliases, preserves queries for HTML, and separates cache variants',async()=>{
    const seen=[];
    const assets={fetch:async request=>{
        seen.push(request);
        return new Response('asset',{headers:{'Content-Type':'text/html','ETag':'version','Vary':'Accept-Encoding'}});
    }};
    for(const path of ['/product-code','/product-code/','/product-code/index.html']) {
        const response=await negotiateMarkdown(new Request(`https://fluxzero.io${path}?campaign=x`,{headers:{Accept:'text/markdown'}}),assets);
        assert.equal(seen.at(-1).url,'https://fluxzero.io/product-code/index.md');
        assert.equal(response.headers.get('Vary'),'Accept-Encoding, Accept');
        assert.match(response.headers.get('Content-Type'),/^text\/markdown/);
        assert.equal(response.headers.get('Content-Location'),'/product-code/index.md');
        assert.equal(response.headers.get('ETag'),'version');
    }
    const html=await negotiateMarkdown(new Request('https://fluxzero.io/product-code/?campaign=x',{headers:{Accept:'text/html'}}),assets);
    assert.equal(seen.at(-1).url,'https://fluxzero.io/product-code/?campaign=x');
    assert.equal(html.headers.get('Content-Type'),'text/html');
    assert.ok(html.headers.get('Vary').includes('Accept'));
});
test('HEAD and conditional requests retain asset semantics',async()=>{
    const response=await negotiateMarkdown(new Request('https://fluxzero.io/',{method:'HEAD',headers:{Accept:'text/markdown','If-None-Match':'md-version'}}),{fetch:async req=>{
        assert.equal(req.method,'HEAD');assert.equal(req.headers.get('If-None-Match'),'md-version');
        return new Response(null,{status:304,headers:{ETag:'md-version'}});
    }});
    assert.equal(response.status,304);assert.equal(await response.text(),'');assert.equal(response.headers.get('Vary'),'Accept');
});
test('APIs, unrelated paths and writes fall through without fetching assets',async()=>{
    const assets={fetch:()=>{throw new Error('Unexpected asset fetch');}};
    for(const [path,method] of [['/api/feedback','GET'],['/makeitreal','GET'],['/product-code/','POST'],['/product-code/index.md','GET']]) {
        assert.equal(await negotiateMarkdown(new Request('https://fluxzero.io'+path,{method,headers:{Accept:'text/markdown'}}),assets),undefined);
    }
});
test('worker-first configuration covers negotiated page aliases and temporary redirects',async()=>{
    const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
    const expected=corePages.flatMap(path=>path==='/'?[path,path+'index.html']:[path.slice(0,-1),path,path+'index.html']);
    assert.deepEqual([...config.assets.run_worker_first].sort(),[...expected,...legacyMonitoringPaths].sort());
});

test('legacy monitoring URLs redirect temporarily and preserve query context',()=>{
    for(const path of legacyMonitoringPaths) for(const method of ['GET','HEAD']) {
        const response=redirectLegacyMonitoring(new Request('https://fluxzero.io'+path+'?campaign=shared',{method}));
        assert.equal(response.status,302);
        assert.equal(response.headers.get('Location'),'https://fluxzero.io/product-insight/'+(path.endsWith('.md')?'index.md':'')+'?campaign=shared');
    }
    assert.equal(redirectLegacyMonitoring(new Request('https://fluxzero.io/monitoring-demo/index.html')),undefined);
    assert.equal(redirectLegacyMonitoring(new Request('https://fluxzero.io/product-insight/')),undefined);
});
