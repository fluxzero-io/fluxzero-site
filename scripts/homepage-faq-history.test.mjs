import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const page = readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const script = ts.transpileModule(page.match(/<script>\s*([\s\S]*?)<\/script>/)[1], {}).outputText;

const pricingPage = readFileSync(new URL('../src/components/marketing/PricingPage.astro', import.meta.url), 'utf8');
const pricingScript = ts.transpileModule(pricingPage.match(/<script>\s*([\s\S]*?)<\/script>/)[1].replace(/import [^;]+;/, ''), {}).outputText;

function visit(hash = '', state = null, source = script) {
    const listeners = new Map();
    let scrolledTo;
    const items = ['faq-first', 'faq-second'].map(id => ({
        id, open: false, scrollIntoView() { scrolledTo = id; },
        querySelector: () => ({ addEventListener: (name, fn) => listeners.set(id + ':' + name, fn) }),
    }));
    const toggle = {
        expanded: 'false', getAttribute() { return this.expanded; },
        setAttribute(name, value) { this.expanded = value; },
        addEventListener(name, fn) { listeners.set('button:' + name, fn); },
    };
    const panel = { hidden: true, inert: true, classList: { remove() {} }, scrollIntoView() { scrolledTo = 'faq'; } };
    const stack = [new URL('https://fluxzero.io/?source=test' + hash)];
    let position = 0;
    const history = { state, pushState(value, title, url) {
        assert.equal(value, null, 'FAQ state belongs in the URL');
        stack.splice(++position, Infinity, new URL(url));
    } };
    const window = {
        get location() { return stack[position]; }, matchMedia: () => ({ matches: true }),
        addEventListener(name, fn) { listeners.set(name, fn); },
    };
    vm.runInNewContext(source, { history, window, URL,
        document: { querySelector: selector => selector === '#faq' ? panel : toggle, querySelectorAll: () => items },
        requestAnimationFrame: fn => { fn(); return 1; }, cancelAnimationFrame() {},
    });
    return { items, toggle, panel, window, get scrolledTo() { return scrolledTo; },
        emit: name => listeners.get(name)({ preventDefault() {} }),
        back() { position--; listeners.get('popstate')(); },
        forward() { position++; listeners.get('popstate')(); },
    };
}

test('a shared question URL opens only that answer and scrolls to it on load', () => {
    const page = visit('#faq-second');
    page.emit('pageshow');
    assert.equal(page.panel.hidden, false);
    assert.equal(page.panel.inert, false);
    assert.deepEqual(page.items.map(item => item.open), [false, true]);
    assert.equal(page.scrolledTo, 'faq-second');
});

test('open, switch and close questions update the URL; back and forward follow those changes', () => {
    const page = visit();
    page.emit('button:click');
    assert.equal(page.window.location.hash, '#faq');
    page.emit('faq-first:click');
    assert.equal(page.window.location.hash, '#faq-first');
    page.emit('faq-second:click');
    assert.deepEqual(page.items.map(item => item.open), [false, true]);
    page.back();
    assert.equal(page.window.location.hash, '#faq-first');
    assert.deepEqual(page.items.map(item => item.open), [true, false]);
    page.forward();
    assert.equal(page.items[1].open, true);
    page.emit('faq-second:click');
    assert.equal(page.window.location.hash, '#faq');
    assert.ok(page.items.every(item => !item.open));
    const reloaded = visit(page.window.location.hash);
    assert.equal(reloaded.panel.hidden, false);
    assert.ok(reloaded.items.every(item => !item.open));
    page.emit('button:click');
    assert.equal(page.window.location.hash, '');
    assert.equal(page.window.location.search, '?source=test');
    assert.equal(visit(page.window.location.hash).panel.hidden, true);
});

test('a URL without a FAQ fragment ignores stale saved state, including cached returns', () => {
    for (const hash of ['', '#get-started', '#missing-question', '#%ZZ']) {
        const page = visit(hash, { fluxzeroHomepageFaq: { expanded: true, question: 'faq-second', scrollY: 4500 } });
        page.panel.hidden = false;
        page.items[1].open = true;
        page.emit('pageshow');
        assert.equal(page.panel.hidden, true);
        assert.equal(page.toggle.expanded, 'false');
        assert.ok(page.items.every(item => !item.open));
        assert.equal(page.scrolledTo, undefined);
    }
});

test('question IDs are unique and do not depend on the visible question wording', () => {
    const ids = [...page.matchAll(/id: '(faq-[^']+)'/g)].map(match => match[1]);
    const questions = [...page.matchAll(/question: '/g)];
    assert.equal(ids.length, questions.length);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.includes('faq-companies'));
});


test('pricing FAQ supports direct links, exclusive selection, closing, refresh and browser history', () => {
    const page = visit('#faq-first', null, pricingScript);
    page.emit('pageshow');
    assert.deepEqual(page.items.map(item => item.open), [true, false]);
    assert.equal(page.scrolledTo, 'faq-first');
    page.emit('faq-second:click');
    assert.equal(page.window.location.hash, '#faq-second');
    assert.deepEqual(page.items.map(item => item.open), [false, true]);
    page.back();
    assert.deepEqual(page.items.map(item => item.open), [true, false]);
    page.forward();
    assert.deepEqual(page.items.map(item => item.open), [false, true]);
    page.emit('faq-second:click');
    assert.equal(page.window.location.hash, '#faq');
    assert.ok(visit('#faq', null, pricingScript).items.every(item => !item.open));
    assert.ok(visit('', { open: true }, pricingScript).items.every(item => !item.open));
    assert.ok(visit('#%ZZ', null, pricingScript).items.every(item => !item.open));
});

test('pricing questions have unique stable fragment IDs', () => {
    const ids = [...pricingPage.matchAll(/name="pricing-faq" id="([^"]+)"/g)].map(match => match[1]);
    assert.equal(ids.length, 10);
    assert.equal(new Set(ids).size, ids.length);
});
