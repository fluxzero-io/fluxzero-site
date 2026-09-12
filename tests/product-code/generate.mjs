import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseFragment } from 'parse5';

const directory = new URL('./', import.meta.url);
const page = readFileSync(new URL('../../src/pages/product-code.astro', directory), 'utf8');
const text = node => node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(text).join('');
const snippets = new Map([...page.matchAll(/const (\w+) = `([\s\S]*?)`;/g)]
    .map(([, name, html]) => [name, text(parseFragment(html))]));
const used = new Set();
const source = readFileSync(new URL('ProductCodeTest.java.template', directory), 'utf8')
    .replace(/^    \/\/ @snippet (\w+)$/gm, (_, name) => {
        if (!snippets.has(name) || used.has(name)) throw new Error(`Missing or duplicate snippet: ${name}`);
        used.add(name);
        // Nest top-level classes only to compile all examples together.
        let snippet = snippets.get(name).replace(/^class /gm, 'static class ');
        if (name === 'reservationModelCode') {
            if (!snippet.endsWith('{}')) throw new Error('Review the Reservation factory insertion');
            // The model diagram omits the domain factory called by ReserveTicket.
            snippet = snippet.slice(0, -2) + `{
    static Reservation awaitingPayment(ReservationId id, TicketId ticket, String customer) {
        return new Reservation(id, ticket, customer, AWAITING_PAYMENT, null);
    }
}`;
        }
        return snippet.split('\n').map(line => '    ' + line).join('\n');
    });
const rendered = [...page.matchAll(/code=\{(\w+)\}/g)].map(match => match[1]);
for (const name of rendered) {
    if (!used.has(name)) throw new Error(`Unverified code panel: ${name}`);
}
const destination = new URL('target/generated-test-sources/qualification/', directory);
mkdirSync(destination, { recursive: true });
writeFileSync(new URL('ProductCodeTest.java', destination), source);
console.log(`Extracted ${used.size} page examples into ${fileURLToPath(destination)}`);
