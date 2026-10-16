import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const katex = require(require.resolve('katex', {paths: [dirname(require.resolve('mermaid'))]}));

test('Mermaid math remains renderable with the patched KaTeX dependency', () => {
    const html = katex.renderToString(String.raw`\sum_{n=1}^{\infty}\frac{1}{n^2}=\frac{\pi^2}{6}`, {
        throwOnError: true, displayMode: true, trust: false
    });
    assert.match(html, /class="katex"/);
    assert.match(html, /<math /);
    assert.match(html, /<mfrac>/);
});
