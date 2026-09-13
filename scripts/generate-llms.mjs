import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

import { siteUrl, marketingPages, documentationPages, htmlFile } from './core-pages.mjs';
const outputDirectory = join(process.cwd(), 'dist');

// These are the public marketing pages that explain and support the product.
// Page copy, titles, and descriptions are read from the built HTML so the text
// alternatives stay in sync with the website automatically.
const pages = marketingPages.map(path => ({ path, file: htmlFile(path) }));

const skippedTags = new Set([
    'script',
    'style',
    'svg',
    'template',
    'noscript',
    'nav',
    'footer',
]);

const skippedRoles = new Set(['tablist']);

const blockTags = new Set([
    'address',
    'article',
    'aside',
    'blockquote',
    'dd',
    'details',
    'div',
    'dl',
    'dt',
    'fieldset',
    'figcaption',
    'figure',
    'form',
    'header',
    'li',
    'main',
    'ol',
    'p',
    'pre',
    'section',
    'summary',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'tr',
    'ul',
]);

function getAttribute(node, name) {
    return node.attrs?.find((attribute) => attribute.name === name)?.value;
}

function findElement(node, predicate) {
    if (predicate(node)) return node;
    for (const child of node.childNodes ?? []) {
        const match = findElement(child, predicate);
        if (match) return match;
    }
    return undefined;
}

function textContent(node) {
    if (node.nodeName === '#text') return node.value ?? '';
    return (node.childNodes ?? []).map(textContent).join(' ');
}

function rawTextContent(node) {
    if (node.nodeName === '#text') return node.value ?? '';
    return (node.childNodes ?? []).map(rawTextContent).join('');
}

function normalizeInline(value) {
    return value
        .replace(/\u00a0/g, ' ')
        .replace(/[\t\r\f ]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .trim();
}

function joinRenderedParts(parts) {
    return parts.reduce((result, part) => {
        if (!part) return result;
        if (!result || /\s$/.test(result) || /^\s/.test(part)) return result + part;

        const startsWithClosingPunctuation = /^[,.;:!?%)\]}]/.test(part);
        const startsWithContraction = /^[’'](?:s|t|re|ve|ll|d|m)\b/i.test(part);
        const endsWithOpeningPunctuation = /[(\[{/]$/.test(result);
        const separator = startsWithClosingPunctuation || startsWithContraction || endsWithOpeningPunctuation
            ? ''
            : ' ';

        return result + separator + part;
    }, '');
}

function shouldSkip(node) {
    if (!node.tagName) return false;
    if (skippedTags.has(node.tagName)) return true;
    if (skippedRoles.has(getAttribute(node, 'role'))) return true;
    if (getAttribute(node, 'data-llms-exclude') !== undefined) return true;
    const forceInclude = getAttribute(node, 'data-llms-include') !== undefined;
    if (getAttribute(node, 'aria-hidden') === 'true') return true;
    if (getAttribute(node, 'hidden') !== undefined && !forceInclude) {
        return true;
    }

    // Responsive duplicates are useful visually, but would repeat the same
    // content in the machine-readable version.
    if (forceInclude) return false;
    const classNames = (getAttribute(node, 'class') ?? '').split(/\s+/);
    return classNames.some(
        (className) => className.includes('__mobile') || /(^|[-_])mobile($|[-_])/.test(className),
    );
}

function plainTextContent(node) {
    if (node.nodeName === '#text') return node.value ?? '';
    if (shouldSkip(node)) return '';
    return (node.childNodes ?? []).map(plainTextContent).join(' ');
}

function collectTableRows(node, table, rows = []) {
    for (const child of node.childNodes ?? []) {
        const role = getAttribute(child, 'role');
        if (child !== table && (child.tagName === 'table' || role === 'table')) continue;

        if (child.tagName === 'tr' || role === 'row') {
            rows.push(child);
            continue;
        }

        collectTableRows(child, table, rows);
    }
    return rows;
}

function collectRowCells(row, cells = []) {
    for (const child of row.childNodes ?? []) {
        const role = getAttribute(child, 'role');
        if (
            child.tagName === 'th' ||
            child.tagName === 'td' ||
            role === 'columnheader' ||
            role === 'rowheader' ||
            role === 'cell'
        ) {
            cells.push(child);
            continue;
        }

        collectRowCells(child, cells);
    }
    return cells;
}

function collectDefinitionItems(node, list, items = []) {
    for (const child of node.childNodes ?? []) {
        if (child !== list && child.tagName === 'dl') continue;

        if (child.tagName === 'dt' || child.tagName === 'dd') {
            items.push(child);
            continue;
        }

        collectDefinitionItems(child, list, items);
    }
    return items;
}

function markdownTableCell(node) {
    const elementChildren = (node.childNodes ?? []).filter((child) => child.tagName);
    const primaryNode = elementChildren.find(
        (child) => child.tagName === 'strong' || /^h[1-6]$/.test(child.tagName),
    );
    const secondaryNode = elementChildren.find(
        (child) => child.tagName === 'small' || child.tagName === 'p',
    );
    const primary = primaryNode ? normalizeInline(plainTextContent(primaryNode)) : '';
    const secondary = secondaryNode ? normalizeInline(plainTextContent(secondaryNode)) : '';
    const value =
        (primary && secondary ? `${primary} — ${secondary}` : normalizeInline(plainTextContent(node))) ||
        getAttribute(node, 'aria-label') ||
        '';
    return value.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function renderTable(table) {
    const rows = collectTableRows(table, table)
        .map((row) => collectRowCells(row))
        .filter((cells) => cells.length > 0);
    if (!rows.length) return '';

    const width = Math.max(...rows.map((cells) => cells.length));
    const firstRowIsHeader = rows[0].some((cell) => {
        const role = getAttribute(cell, 'role');
        return cell.tagName === 'th' || role === 'columnheader';
    });
    const header = firstRowIsHeader
        ? rows[0]
        : Array.from({ length: width }, (_, index) => ({
            attrs: [{ name: 'aria-label', value: `Column ${index + 1}` }],
        }));
    const body = firstRowIsHeader ? rows.slice(1) : rows;
    const renderRow = (cells) => {
        const values = Array.from({ length: width }, (_, index) => markdownTableCell(cells[index] ?? {}));
        return `| ${values.join(' | ')} |`;
    };

    return `\n\n${renderRow(header)}\n| ${Array.from({ length: width }, () => '---').join(' | ')} |${
        body.length ? `\n${body.map(renderRow).join('\n')}` : ''
    }\n\n`;
}

function absoluteHref(href, pageUrl) {
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) return href;
    try {
        return new URL(href, pageUrl).toString();
    } catch {
        return href;
    }
}

function accessibleName(node) {
    const explicitName = getAttribute(node, 'aria-label') || getAttribute(node, 'title');
    if (explicitName) return normalizeInline(explicitName);

    const image = findElement(node, (child) => child.tagName === 'img' && getAttribute(child, 'alt'));
    return image ? normalizeInline(getAttribute(image, 'alt')) : '';
}

function renderChildrenInline(node, pageUrl, headingOffset, codeBlocks) {
    return normalizeInline(
        joinRenderedParts(
            (node.childNodes ?? []).map((child) => renderNode(child, pageUrl, headingOffset, codeBlocks)),
        ),
    );
}

function renderNode(node, pageUrl, headingOffset, codeBlocks) {
    if (node.nodeName === '#text') return node.value ?? '';
    if (shouldSkip(node)) return '';

    const tagName = node.tagName;
    const role = getAttribute(node, 'role');

    if (tagName === 'table' || role === 'table') return renderTable(node);

    if (tagName === 'br') return '\n';

    if (tagName === 'img') {
        const alt = normalizeInline(getAttribute(node, 'alt') ?? '');
        const src = absoluteHref(getAttribute(node, 'src'), pageUrl);
        if (!alt) return '';
        return src ? `![${alt}](${src})` : alt;
    }

    if (tagName === 'a') {
        const hasTextLabel = normalizeInline(plainTextContent(node));
        const renderedLabel = hasTextLabel
            ? normalizeInline(
                joinRenderedParts(
                    (node.childNodes ?? []).map((child) => renderNode(child, pageUrl, headingOffset, codeBlocks)),
                ),
            )
            : '';
        const label = renderedLabel || accessibleName(node);
        const href = absoluteHref(getAttribute(node, 'href'), pageUrl);
        return label && href ? `[${label}](${href})` : label;
    }

    if (tagName === 'strong' || tagName === 'b') {
        const value = normalizeInline(
            joinRenderedParts(
                (node.childNodes ?? []).map((child) => renderNode(child, pageUrl, headingOffset, codeBlocks)),
            ),
        );
        return value ? `**${value}**` : '';
    }

    if (tagName === 'small') {
        const value = renderChildrenInline(node, pageUrl, headingOffset, codeBlocks);
        return value ? ` ${value}` : '';
    }

    if (tagName === 'code' && node.parentNode?.tagName !== 'pre') {
        const value = normalizeInline(textContent(node));
        return value ? `\`${value}\`` : '';
    }

    if (tagName === 'pre') {
        const value = rawTextContent(node);
        if (!value.trim()) return '';
        const code = findElement(node, (child) => child.tagName === 'code');
        const language = (getAttribute(code ?? {}, 'class') ?? '')
            .split(/\s+/)
            .find((className) => className.startsWith('language-'))
            ?.slice('language-'.length);
        const fence = '`'.repeat(Math.max(3, ...Array.from(value.matchAll(/`+/g), ([run]) => run.length + 1)));
        const block = `${fence}${language ?? ''}\n${value}${value.endsWith('\n') ? '' : '\n'}${fence}`;
        // Keep code outside all prose normalization, including ancestor elements.
        // HTML parsing replaces null characters, so these markers cannot collide with page text.
        const marker = `\0${codeBlocks.push(block) - 1}\0`;
        return `\n\n${marker}\n\n`;
    }

    if (tagName === 'sup') {
        const value = renderChildrenInline(node, pageUrl, headingOffset, codeBlocks);
        if (!value) return '';
        return value.includes('](') ? ` ${value}` : ` [${value}]`;
    }

    const headingMatch = tagName?.match(/^h([1-6])$/);
    if (headingMatch) {
        const level = Math.min(6, Number(headingMatch[1]) + headingOffset);
        const value = normalizeInline(plainTextContent(node));
        return value ? `\n\n${'#'.repeat(level)} ${value}\n\n` : '';
    }

    if (tagName === 'summary') {
        const titleNode = findElement(node, (child) => child.tagName === 'strong');
        const subtitleNode = findElement(node, (child) => child.tagName === 'small');

        if (titleNode) {
            const title = normalizeInline(textContent(titleNode));
            const subtitle = subtitleNode ? normalizeInline(textContent(subtitleNode)) : '';
            return `\n\n### ${title}${subtitle ? `\n\n${subtitle}` : ''}\n\n`;
        }
    }

    if (tagName === 'dl') {
        const entries = [];
        let entry;

        for (const child of collectDefinitionItems(node, node)) {
            if (child.tagName === 'dt') {
                if (entry) entries.push(entry);
                entry = { term: normalizeInline(textContent(child)), values: [] };
            } else if (child.tagName === 'dd') {
                const value = renderChildrenInline(child, pageUrl, headingOffset, codeBlocks);
                if (!entry) entry = { term: '', values: [] };
                if (value) entry.values.push(value);
            }
        }
        if (entry) entries.push(entry);

        const lines = entries
            .filter(({ term, values }) => term || values.length)
            .map(({ term, values }) =>
                term ? `- **${term}:** ${values.join(' ')}` : `- ${values.join(' ')}`,
            );
        return lines.length ? `\n\n${lines.join('\n')}\n\n` : '';
    }

    const children = joinRenderedParts(
        (node.childNodes ?? []).map((child) => renderNode(child, pageUrl, headingOffset, codeBlocks)),
    );
    const value = normalizeInline(children);

    if (!value) return '';
    if (tagName === 'li') return `\n- ${value}\n`;
    if (tagName === 'summary') return `\n\n### ${value}\n\n`;
    if (tagName === 'dt') return `\n- **${value}**\n`;
    if (tagName === 'dd') return ` ${value}\n`;
    if (tagName === 'p' || blockTags.has(tagName)) return `\n\n${value}\n\n`;

    return value;
}

function cleanMarkdown(value) {
    return value
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/(^- [^\n]+)\n\n(?=- )/gm, '$1\n')
        .replace(/ +/g, ' ')
        .replace(/^ +| +$/gm, '')
        .trim();
}

function documentMetadata(document, path) {
    const titleNode = findElement(document, (node) => node.tagName === 'title');
    const descriptionNode = findElement(
        document,
        (node) => node.tagName === 'meta' && getAttribute(node, 'name') === 'description',
    );

    return {
        title: normalizeInline(textContent(titleNode ?? document)) || 'Fluxzero',
        description: getAttribute(descriptionNode ?? {}, 'content') ?? '',
        url: new URL(path, siteUrl).toString(),
    };
}

export function renderPageContent(document, pageUrl) {
    const main =
        findElement(document, (node) => node.tagName === 'main') ??
        findElement(document, (node) => node.tagName === 'body');
    if (!main) throw new Error(`No <main> or <body> element found in ${pageUrl}`);

    const codeBlocks = [];
    return cleanMarkdown(renderNode(main, pageUrl, 1, codeBlocks))
        .replace(/\0(\d+)\0/g, (_, index) => codeBlocks[Number(index)]);
}

async function readPage(page) {
    const html = await readFile(join(outputDirectory, page.file), 'utf8');
    const document = parse(html);
    const metadata = documentMetadata(document, page.path);

    return {
        ...metadata,
        summary: extractSummary(document),
        content: renderPageContent(document, metadata.url),
    };
}

export function extractSummary(document) {
    const summaries = [];
    function visit(node) {
        if (shouldSkip(node)) return;
        if (getAttribute(node, 'data-llms-summary') !== undefined) {
            summaries.push(normalizeInline(plainTextContent(node)));
            return;
        }
        for (const child of node.childNodes ?? []) visit(child);
    }
    visit(document);
    return summaries.filter(Boolean).join('\n\n');
}

export function renderMarkdownPage(page) {
    return `# ${page.title}\n\nSource: ${page.url}\n\n${page.content}\n`;
}

// A proposal only: no model, rewritten copy, or separate maintained summary.
export function renderShortIndex(builtPages, docs) {
    const homepage = builtPages[0];
    const link = page => `- [${page.title}](${page.url}index.md): ${page.description}`;
    const primaryPaths = ['/', '/how-it-works/', '/technical-foundation/', '/product-code/', '/pricing/'];
    const primary = primaryPaths.map(path => builtPages.find(page => new URL(page.url).pathname === path)).filter(Boolean);
    const optional = builtPages.filter(page => !primary.includes(page));
    return `# Fluxzero\n\n> ${homepage.description}\n\n${homepage.summary}\n\n## Read in this order\n\n${primary.map(link).join('\n')}\n\n## Technical documentation\n\n${docs.map(link).join('\n')}\n\n## Complete content\n\n- [Full website text](${siteUrl}/llms-full.txt)\n\n## Optional\n\n${optional.map(link).join('\n')}\n`;
}

async function generateFiles() {
    const builtPages = await Promise.all(pages.map(readPage));
    const homepage = builtPages[0];
    const docs = await Promise.all(documentationPages.map(path => readPage({ path, file: htmlFile(path) })));

    const proposalIndex = process.argv.indexOf('--short-proposal');
    if (proposalIndex !== -1) {
        const target = process.argv[proposalIndex + 1];
        if (!target) throw new Error('--short-proposal requires an output path outside dist');
        const absolute = resolve(target);
        if (absolute === outputDirectory || absolute.startsWith(outputDirectory + '/')) throw new Error('Keep proposals outside the published build');
        await mkdir(dirname(absolute), { recursive: true });
        await writeFile(absolute, renderShortIndex(builtPages, docs));
        console.log(`Generated proposal: ${absolute}`);
        return;
    }

    const index = cleanMarkdown(`
    # Fluxzero

    > ${homepage.description}

    ## Recommended reading order

    Start with the homepage and How it works. Product code shows what an agent writes; Technical foundation explains what the cloud handles. Read Pricing next, then the documentation for implementation details.

    ## Core pages

    ${builtPages
        .map((page) => `- [${page.title}](${page.url}): ${page.description} ([Markdown](${page.url}index.md))`)
        .join('\n')}

    ## Technical documentation

    ${docs.map(page => `- [${page.title}](${page.url}): ${page.description} ([Markdown](${page.url}index.md))`).join('\n')}
    `);

    const full = builtPages
        .map((page) => `# ${page.title}\n\nSource: ${page.url}\n\n${page.content}`)
        .join('\n\n---\n\n');
    const selfContained = `${index}\n\n---\n\n${full}`;

    await mkdir(outputDirectory, { recursive: true });
    await Promise.all([
        writeFile(join(outputDirectory, 'llms.txt'), `${selfContained}\n`, 'utf8'),
        writeFile(join(outputDirectory, 'llms-full.txt'), `${full}\n`, 'utf8'),
        ...[...builtPages, ...docs].map(async page => {
            const target = join(outputDirectory, new URL(page.url).pathname, 'index.md');
            await mkdir(dirname(target), { recursive: true });
            await writeFile(target, renderMarkdownPage(page), 'utf8');
        }),
    ]);

    console.log(`Generated llms.txt and llms-full.txt from ${builtPages.length} pages.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await generateFiles();
}
