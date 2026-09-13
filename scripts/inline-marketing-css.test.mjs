import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { marketingPages } from './core-pages.mjs';
import { inlineMarketingCss } from './inline-marketing-css.mjs';
test('preserves style order, resolves relative assets and leaves docs unchanged', async () => {
 const dir=await mkdtemp(join(tmpdir(),'marketing-css-'));
 try {
  await mkdir(join(dir,'_astro'));
  await writeFile(join(dir,'_astro/site.css'),'.a{background:url(./image.webp)}.b{src:url(/font.woff2)}');
  const html='<link rel="stylesheet" href="/_astro/site.css"><style>.a{color:red}</style>';
  for(const path of [...marketingPages,'/docs/']) {
   await mkdir(join(dir,path),{recursive:true});await writeFile(join(dir,path,'index.html'),html);
  }
  await inlineMarketingCss(dir);
  const output=await readFile(join(dir,'index.html'),'utf8');
  assert.match(output,/url\(\/_astro\/image.webp\)/);
  assert.match(output,/url\(\/font.woff2\)/);
  assert.ok(output.indexOf('background:')<output.indexOf('color:red'));
  assert.equal(await readFile(join(dir,'docs/index.html'),'utf8'),html);
 }finally{await rm(dir,{recursive:true,force:true});}
});
