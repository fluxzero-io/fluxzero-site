/// <reference types="astro/client" />

// Pull in the Cloudflare runtime shape from the adapter, parameterized by your Env
type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
    interface Locals extends Runtime {
        // add anything else you put on locals here
        // otherLocals?: { ... }
    }
}