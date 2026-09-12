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
