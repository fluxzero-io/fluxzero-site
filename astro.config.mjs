// @ts-check
import { defineConfig, envField } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';
import tailwindcss from '@tailwindcss/vite';
import starlightLinksValidator from 'starlight-links-validator'
import cloudflare from '@astrojs/cloudflare';
import { fluxzeroBrand } from './src/config/brand.mjs';
import remarkDocsLinks from './scripts/remark-docs-links.mjs';

// https://astro.build/config
export default defineConfig({
    site: 'https://fluxzero.io',
    prefetch: { defaultStrategy: 'hover' },
    markdown: { remarkPlugins: [remarkDocsLinks] },
    vite: {
        plugins: [tailwindcss()],
        css: {
            preprocessorOptions: {
                scss: {
                    silenceDeprecations: ['import', 'global-builtin', 'color-functions']
                }
            },
            postcss: {
                plugins: []
            }
        }
    },
    env: {
        validateSecrets: true,
        schema: {
            FEEDBACK_PROVIDER: envField.enum({ optional: true, context: 'server', default: 'memory', access: 'public', values: ['memory', 'github-issues', 'github-discussions'] }),
            GITHUB_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true, default: '' }),
            GITHUB_REPO: envField.string({ context: 'server', access: 'secret', optional: true, default: '' }),
            COOKIE_SECRET: envField.string({ context: 'server', access: 'secret', optional: true, default: '' }),
            GITHUB_APP_CLIENT_ID: envField.string({ context: 'server', access: 'secret', optional: true, default: '' }),
            GITHUB_APP_CLIENT_SECRET: envField.string({ context: 'server', access: 'secret', optional: true, default: '' }),
        }
    },
    redirects: {
        "/docs/building/devboard-walkthrough": { status: 301, destination: "/docs/building/local-development/" },
        "/monitoring": { status: 302, destination: "/product-insight/" },
        "/monitoring/index.html": { status: 302, destination: "/product-insight/" },
        "/monitoring/index.md": { status: 302, destination: "/product-insight/index.md" },
        "/docs/guides/messaging/071-role-based-access-control/": { status: 301, destination: "/docs/guides/messaging/role-based-access-control/" },
        "/docs/guides/scheduling": { status: 301, destination: "/docs/guides/messaging/message-scheduling/" },
        "/docs/guides/testing": { status: 301, destination: "/docs/guides/messaging/testing-your-handlers/" },
        "/logs/guides/messaging/020-message-handling": { status: 301, destination: "/docs/guides/messaging/message-handling/" },

        "/llms-full.txt": {
            status: 302,
            destination: "/llms.txt"
        },
        "/sitemap.xml": {
            status: 301,
            destination: "/sitemap-index.xml"
        },
        "/start-building": {
            status: 308,
            destination: "/get-started"
        },
        "/docs": {
            status: 302,
            destination: "/docs/getting-started/introduction"
        },
        "/cli.sh": {
            status: 302,
            destination: "https://github.com/fluxzero-io/fluxzero-cli/releases/latest/download/install.sh"
        }
    },
    integrations: [
        starlight({
            disable404Route: true,
            components: {
                Head: './src/components/DocsHead.astro',
                SiteTitle: './src/components/DocsSiteTitle.astro',
                MarkdownContent: './src/components/MarkdownContentWithFeedback.astro',
                Footer: './src/components/DocsFooter.astro',
            },
            title: 'Fluxzero docs',
            favicon: fluxzeroBrand.faviconSvg,
            head: [
                { tag: 'link', attrs: { rel: 'icon', href: fluxzeroBrand.faviconIco, sizes: '16x16 32x32 48x48' } },
                { tag: 'link', attrs: { rel: 'icon', href: fluxzeroBrand.favicon32, sizes: '32x32', type: 'image/png' } },
                { tag: 'link', attrs: { rel: 'apple-touch-icon', href: fluxzeroBrand.appleTouchIcon, sizes: '180x180' } },
                { tag: 'link', attrs: { rel: 'mask-icon', href: fluxzeroBrand.safariPinnedTab, color: '#2f78b6' } },
                { tag: 'link', attrs: { rel: 'manifest', href: fluxzeroBrand.webManifest } },
                { tag: 'meta', attrs: { name: 'theme-color', content: '#05070B' } },
            ],
            social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/fluxzero-io' }],
            customCss: ['./src/styles/global.css'],
            plugins: [
                starlightLinksValidator({
                    exclude: ({ link }) => {
                        // ignore any non docs link as we cannot check this from starlight if they actually exist or not
                        return !link.startsWith('/docs/')
                    }
                })
            ],
            sidebar: [
                {
                    label: 'Building with Fluxzero',
                    items: [
                        { label: 'Introduction', slug: 'docs/getting-started/introduction' },
                        { label: 'Build your first feature', slug: 'docs/building/first-feature' },
                        { label: 'Example apps', slug: 'docs/building/example-apps' },
                        { label: 'The Fluxzero toolkit', slug: 'docs/building/fluxzero-toolkit' },
                        { label: 'Local development', slug: 'docs/building/local-development' },
                        { label: 'Understand your app', slug: 'docs/building/monitoring' },
                        { label: 'Test and improve your app', slug: 'docs/building/test-and-improve' },
                        { label: 'Publishing your app', slug: 'docs/tutorials/cloud-deployment' },
                    ],
                },
                {
                    label: 'Developer Guides',
                    collapsed: true,
                    items: [
                        { label: 'Core concepts', slug: 'docs/getting-started/core-concepts' },
                        { label: 'Installation', slug: 'docs/getting-started/installation' },
                        { label: 'Hello world', slug: 'docs/getting-started/hello-world' },
                        { label: 'Building your first app', slug: 'docs/tutorials/first-app' },
                        { label: 'Fluxzero 2.0', slug: 'docs/fluxzero-2' },
                        { label: 'In depth', autogenerate: { directory: 'docs/guides' } },
                        { label: 'Reference', autogenerate: { directory: 'docs/reference' } },
                    ],
                },
                {
                    label: 'About',
                    autogenerate: { directory: 'docs/about' },
                },
            ],
        }),
        mermaid({
            theme: 'default',
            autoTheme: true,
            mermaidConfig: {
                theme: 'default',
                themeVariables: {
                    primaryColor: '#3b82f6',
                    primaryTextColor: '#ffffff',
                    primaryBorderColor: '#1e40af',
                    lineColor: '#6b7280',
                    sectionBkgColor: '#f3f4f6',
                    altSectionBkgColor: '#e5e7eb',
                    gridColor: '#d1d5db',
                    secondaryColor: '#f59e0b',
                    tertiaryColor: '#10b981'
                }
            }
        })
    ],

    adapter: cloudflare({
        workerEntryPoint: { path: './src/worker.mjs' },
        imageService: 'compile',
        platformProxy: {
            enabled: true,
        },
    }),
});
