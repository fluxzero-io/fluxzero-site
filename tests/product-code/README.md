# Product-code example tests

Run from the website root after `pnpm install`:

```sh
pnpm test:product-code
```

Requires Node.js 22+, Java 25+ and Maven 3.9+. Maven downloads the pinned
Fluxzero SDK `2.0.0-RC9` from the public Fluxzero package repository.
No local SDK checkout, credentials, running server, or private repository is needed.

## What is tested

`generate.mjs` reads the Java snippets from `src/pages/product-code.astro`, removes
the syntax-highlighting markup with an HTML parser, and inserts the actual code
into `ProductCodeTest.java.template`. Every rendered code panel must be included;
adding an unverified panel makes the check fail. The generated source and JUnit
reports live under the ignored `target/` directory.

The template supplies domain declarations omitted from the examples, plus
behavior tests for queries, unnamed query parameters, payment workflows,
scheduling and cancellation, protected contact details, retroactive rewards,
and fraud review. The two displayed tests also run using the included JSON
request fixture. Tests use the SDK's real `TestFixture`, model persistence and
message handling, without mocked Fluxzero APIs.

The only structural changes to displayed code are nesting top-level classes
inside the test class and supplying the `Reservation.awaitingPayment` factory
that the model diagram omits. The page remains the single source for all
displayed behavior. The supporting reward action applies to a real reward
balance and counts each reservation once.

## Updating examples or the SDK

Edit the page first, update omitted domain support or assertions when its
behavior changes, and rerun the command. Do not edit generated Java. Failures
report the individual JUnit scenario in `target/surefire-reports/`.

The SDK version is pinned in `pom.xml`. To try another published version:

```sh
pnpm test:product-code -Dfluxzero.version=2.0.0-RC9
```

Update the pin only after the examples pass against that release. These tests
check code behavior; the website build, LLM export tests and browser checks
cover content extraction and presentation separately.
