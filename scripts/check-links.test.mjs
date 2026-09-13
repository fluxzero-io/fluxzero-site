import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectLinks, validateLinks } from './check-links.mjs';
const page = (html, path='/') => inspectLinks(html,path);
test('checks inline HTML, relative, absolute and nofollow links outside docs', () => {
 const pages = new Map([['/',page('<p>Read <a href="/logs/missing">guide</a><a rel="nofollow" href="https://fluxzero.io/gone">x</a><a href="relative">y</a></p>')]]);
 assert.equal(validateLinks(pages,new Set()).length,3);
});
test('follows redirects, preserves anchors and permits downloads and external links',()=>{
 const pages=new Map([['/',page('<a href="/old#ok">x</a><a href="/file.pdf">file</a><a href="https://example.org">external</a>')],['/new',page('<h2 id="ok">OK</h2>')]]);
 assert.deepEqual(validateLinks(pages,new Set(['/file.pdf']),new Map([['/old','/new/']])),[]);
});
test('fails missing anchors, broken redirect targets and redirect loops',()=>{
 const pages=new Map([['/',page('<a href="/new#missing">x</a><a href="/old">y</a><a href="/loop">z</a>')],['/new',page('<h2 id="ok">OK</h2>')]]);
 const errors=validateLinks(pages,new Set(),new Map([['/old','/gone'],['/loop','/loop']]));
 assert.equal(errors.length,3);
});
