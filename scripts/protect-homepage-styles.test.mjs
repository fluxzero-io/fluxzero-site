import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { protectHomepageStyles } from './protect-homepage-styles.mjs';

test('allows the exact built styles while preserving scripts and inline star positions', () => {
    const css = ':root { color: white; background: #05070b; }';
    const html = `<html><head><meta charset="UTF-8"><style>${css}</style><style>${css}</style></head><body><span style="--star:3">★</span><button onclick="toggleFaq(this)">FAQ</button><script src="/js/home.js"></script></body></html>`;
    const output = protectHomepageStyles(html);
    const hash = createHash('sha256').update(css).digest('base64');
    assert.equal(output.split(`'sha256-${hash}'`).length, 2);
    assert.ok(output.indexOf('Content-Security-Policy') < output.indexOf('<style>'));
    assert.ok(output.includes(`style-src 'self' 'sha256-${hash}'`));
    assert.ok(output.includes("; style-src-attr 'unsafe-inline'"));
    assert.equal(output.replace(/<meta http-equiv="Content-Security-Policy"[^>]+>/, ''), html);
    assert.notEqual(protectHomepageStyles(html.replace(css, css + 'p{color:red}')), output);
});

test('fails instead of shipping a missing or conflicting policy', () => {
    assert.throws(() => protectHomepageStyles('<head><meta charset="UTF-8"></head>'), /compiled styles/);
    assert.throws(() => protectHomepageStyles('<head><style>body{color:white}</style></head>'), /charset/);
    assert.throws(() => protectHomepageStyles('<head><meta http-equiv="Content-Security-Policy" content="style-src none"></head>'), /already has/);
});

test('keeps the installed Mermaid integration stylesheet allowed after dependency updates', async () => {
    const integration = await readFile(new URL(import.meta.resolve('astro-mermaid')), 'utf8');
    const css = integration.match(/style\.textContent = \\`([\s\S]*?)\\`;/)?.[1];
    assert.ok(css, 'Review Mermaid stylesheet injection when its integration changes.');
    const hash = createHash('sha256').update(css).digest('base64');
    const output = protectHomepageStyles('<head><meta charset="UTF-8"><style>body{color:white}</style></head>');
    assert.ok(output.includes(`'sha256-${hash}'`), 'Review the pinned Mermaid stylesheet hash.');
});
