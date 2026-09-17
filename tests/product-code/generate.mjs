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

// Qualify Kotlin in a separate Maven profile so identical JSON resource paths
// resolve to the Kotlin domain types without changing displayed snippets.
const { kotlinExamples } = await import('../../src/data/product-code-kotlin.mjs');
const kotlinUsed = new Set();
const kotlinSource = readFileSync(new URL('KotlinProductCodeTest.kt.template', directory), 'utf8')
    .replace(/^    \/\/ @snippet (\w+)$/gm, (_, name) => {
        if (!kotlinExamples[name] || kotlinUsed.has(name)) throw new Error(`Missing or duplicate Kotlin snippet: ${name}`);
        kotlinUsed.add(name);
        let snippet = kotlinExamples[name];
        if (name === 'reservationModelCode') {
            snippet += ` {
    companion object {
        fun awaitingPayment(id: ReservationId, ticket: TicketId, customer: String) =
            Reservation(id, ticket, customer, AWAITING_PAYMENT, null)
    }
}`;
        }
        return snippet.split('\n').map(line => '    ' + line).join('\n');
    });
const kotlinRendered = [...page.matchAll(/kotlinCode=\{kotlinExamples\.(\w+)\}/g)].map(match => match[1]);
for (const name of rendered) {
    if (!kotlinUsed.has(name) || !kotlinRendered.includes(name)) throw new Error(`Missing Kotlin panel qualification: ${name}`);
}
if (kotlinUsed.size !== kotlinRendered.length || kotlinUsed.size !== Object.keys(kotlinExamples).length) {
    throw new Error('Kotlin examples and rendered panels must match');
}
const kotlinDestination = new URL('target/generated-kotlin-sources/qualification/kotlin/', directory);
mkdirSync(kotlinDestination, { recursive: true });
writeFileSync(new URL('KotlinProductCodeTest.kt', kotlinDestination), kotlinSource);
const { readdirSync } = await import('node:fs');
function copyKotlinResources(relative = '') {
    const from = new URL(`src/test/resources/${relative}`, directory);
    const to = new URL(`target/kotlin-resources/${relative}`, directory);
    mkdirSync(to, { recursive: true });
    for (const entry of readdirSync(from, { withFileTypes: true })) {
        if (entry.isDirectory()) copyKotlinResources(`${relative}${entry.name}/`);
        else writeFileSync(new URL(entry.name, to), readFileSync(new URL(entry.name, from), 'utf8')
            .replaceAll('qualification.ProductCodeTest$', 'qualification.kotlin.KotlinProductCodeTest$'));
    }
}
copyKotlinResources();
console.log(`Extracted ${kotlinUsed.size} Kotlin examples into ${fileURLToPath(kotlinDestination)}`);
