import assert from 'node:assert/strict';
import test from 'node:test';
import { parse } from 'parse5';
import { renderPageContent } from './generate-llms.mjs';

const render = (html) => renderPageContent(parse(html), 'https://example.com/features/');
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

test('keeps indentation, tabs, blank lines and string spacing through nested containers', () => {
    const code = '\n  class Example {\n\tString value = "two  spaces";\n\n\n    void run() {}\n  }\n';
    const result = render(`<main><article><div><figure>
        <figcaption>Example.java</figcaption><div><pre><code class="language-java">${escape(code)}</code></pre></div>
        </figure></div></article><p> Normal   prose. </p></main>`);

    assert.ok(result.includes('```java\n' + code + '```'));
    assert.ok(result.endsWith('Normal prose.'));
    assert.equal(result.includes('\0'), false);
});

test('preserves highlighted code and uses fences longer than backticks in the source', () => {
    const code = '    String fence = "```";\n    return "a  b";';
    const highlighted = escape(code).replace('String', '<span>String</span>');
    const result = render(`<main><pre><code class="language-java">${highlighted}</code></pre>
        <pre><code class="language-python">\tprint("hello")</code></pre></main>`);

    assert.ok(result.includes('````java\n' + code + '\n````'));
    assert.ok(result.includes('```python\n\tprint("hello")\n```'));
    assert.equal(result.includes('<span>'), false);
});

test('keeps captions, headings and definition notes in order without decorative duplicates', () => {
    const result = render(`<main><h1>Features</h1><article><h2>Store data</h2>
        <figure><figcaption><strong>Example.java</strong><small>Root model</small></figcaption>
        <button data-llms-exclude>Copy code</button><pre><code class="language-java">record Example() {}</code></pre></figure>
        <div aria-hidden="true"><strong>Example</strong><ul><li>Child</li><li>Child</li></ul></div>
        <dl><div><dt>Stored automatically</dt><dd>Your data stays available.</dd></div></dl>
        <a href="/docs">Read docs</a></article></main>`);

    assert.equal(result, '## Features\n\n### Store data\n\n**Example.java** Root model\n\n'
        + '```java\nrecord Example() {}\n```\n\n'
        + '- **Stored automatically:** Your data stays available.\n\n'
        + '[Read docs](https://example.com/docs)');
});

test('preserves table labels and cells next to preformatted content', () => {
    const result = render(`<main><table><tr><th>Plan</th><th>Price</th></tr>
        <tr><th>Basic</th><td><strong>€10</strong><small>per month</small></td></tr></table>
        <pre>  keep    spacing</pre></main>`);

    assert.equal(result, '| Plan | Price |\n| --- | --- |\n| Basic | €10 — per month |\n\n'
        + '```\n  keep    spacing\n```');
});

test('page Markdown preserves the source and exact extracted code', async () => {
    const { renderMarkdownPage } = await import('./generate-llms.mjs');
    const content = render('<main><h1>Example</h1><pre><code class="language-java">  foo("a  b");</code></pre></main>');
    assert.equal(renderMarkdownPage({title:'Example',url:'https://example.com/features/',content}), `# Example\n\nSource: https://example.com/features/\n\n${content}\n`);
});

test('compact proposal uses selected HTML copy and metadata deterministically', async () => {
    const { extractSummary, renderShortIndex } = await import('./generate-llms.mjs');
    const summary = extractSummary(parse('<main><p data-llms-summary>Existing <strong>product</strong> copy.</p><p>Other copy.</p><p data-llms-summary hidden>Hidden.</p></main>'));
    assert.equal(summary, 'Existing product copy.');
    const pages=[{title:'Home',description:'Existing description.',summary,url:'https://fluxzero.io/'}];
    const result=renderShortIndex(pages,[]);
    assert.equal(result,renderShortIndex(pages,[]));
    assert.ok(result.includes(summary));
    assert.ok(result.includes('[Home](https://fluxzero.io/index.md): Existing description.'));
    assert.ok(!result.includes('Other copy.'));
});


test('compact index includes the visible hero and exact building instruction outside Optional', async () => {
    const { renderShortIndex } = await import('./generate-llms.mjs');
    const home={title:'Home',hero:'The European cloud for AI-built apps',description:'Description',summary:'Summary',url:'https://fluxzero.io/'};
    const start={title:'Start building',instruction:'Build my app with Fluxzero. Start at plugins.fluxzero.io',description:'Get started',url:'https://fluxzero.io/get-started/'};
    const result=renderShortIndex([home,start],[]);
    assert.ok(result.includes('> '+home.hero));
    assert.ok(result.includes(start.instruction));
    assert.ok(result.indexOf(start.instruction)<result.indexOf('## Optional'));
    assert.ok(!result.split('## Optional')[1].includes(start.url));
});

test('llms includes the instruction once while page Markdown retains setup and contact content', async () => {
    const { renderShortIndex, renderLlms, renderMarkdownPage } = await import('./generate-llms.mjs');
    const home = { title: 'Home', hero: 'Hero', description: 'Description', summary: 'Summary', url: 'https://fluxzero.io/', content: '## Home\n\nProduct overview.' };
    const start = { title: 'Start building with Fluxzero', description: 'Setup', url: 'https://fluxzero.io/get-started/', instruction: 'Build my app with Fluxzero. Start at plugins.fluxzero.io' };
    start.content = `## Start building with Fluxzero\n\n${start.instruction}\n\nSupported agents.`;
    const contact = { title: 'Contact', description: 'Contact details', url: 'https://fluxzero.io/contact/', content: '## Contact\n\nFull name\n\nEmail address\n\nSend' };
    const pages = [home, start, contact];
    const llms = renderLlms(pages, []);

    assert.equal(llms.split(start.instruction).length - 1, 1);
    assert.equal(llms.split(start.url + 'index.md').length - 1, 1);
    assert.ok(llms.indexOf(start.instruction) < llms.indexOf('## Read in this order'));
    assert.ok(llms.startsWith(renderShortIndex(pages, []).trimEnd()));
    assert.ok(llms.includes(`[Contact](${contact.url}index.md)`));
    assert.ok(!llms.includes('Full name'));
    assert.ok(!llms.includes('Source: ' + start.url));
    assert.ok(!llms.includes('Source: ' + contact.url));
    assert.ok(!llms.includes('/llms-full.txt'));
    assert.ok(llms.includes(home.content));
    for (const page of pages) assert.ok(renderMarkdownPage(page).includes(`Source: ${page.url}\n\n${page.content}`));
});

test('exports equivalent code languages in source order without repeating their shared prompt', () => {
    const result = render(`<main><figure>
        <figcaption><p>You write</p><blockquote>Reserve a ticket.</blockquote></figcaption>
        <div data-llms-exclude><button>Kotlin</button><button>Java</button></div>
        <div><pre><code class="language-kotlin">data class Ticket(val id: String)</code></pre></div>
        <div hidden data-llms-include><pre><code class="language-java">record Ticket(String id) {}</code></pre></div>
        </figure></main>`);
    assert.equal(result.match(/Reserve a ticket\./g)?.length, 1);
    assert.ok(result.includes('```kotlin\ndata class Ticket(val id: String)\n```'));
    assert.ok(result.includes('```java\nrecord Ticket(String id) {}\n```'));
    assert.ok(result.indexOf('```kotlin') < result.indexOf('```java'));
    assert.equal(result.includes('Kotlin'), false);
});
