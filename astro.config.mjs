// @ts-check
import { defineConfig, envField } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';
import tailwindcss from '@tailwindcss/vite';
import starlightLinksValidator from 'starlight-links-validator'
import cloudflare from '@astrojs/cloudflare';
import { fluxzeroBrand } from './src/config/brand.mjs';
import remarkDocsLinks from './scripts/remark-docs-links.mjs';
import { siteUrl, siteLinkAliases } from './scripts/core-pages.mjs';

// https://astro.build/config
export default defineConfig({
    site: 'https://fluxzero.io',
    prefetch: { defaultStrategy: 'hover' },
    markdown: { remarkPlugins: [[remarkDocsLinks, { siteUrl, linkAliases: siteLinkAliases }]] },
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
        "/technical-foundation": { status: 301, destination: "/how-it-works/" },
        "/technical-foundation/index.html": { status: 301, destination: "/how-it-works/" },
        "/technical-foundation/index.md": { status: 301, destination: "/how-it-works/index.md" },
        "/docs/model-migration-tests": { status: 301, destination: "/docs/guides/modeling-and-persistence/model-migration-tests/" },
        "/docs/model-persistence": { status: 301, destination: "/docs/guides/modeling-and-persistence/model-persistence/" },
        "/docs/model-query-guide": { status: 301, destination: "/docs/guides/modeling-and-persistence/model-query-guide/" },
        "/docs/updating-entities": { status: 301, destination: "/docs/guides/modeling-and-persistence/updating-entities/" },
        "/docs/model-state": { status: 301, destination: "/docs/guides/modeling-and-persistence/model-state/" },
        "/docs/model-state-boundaries": { status: 301, destination: "/docs/guides/modeling-and-persistence/model-state-boundaries/" },
        "/docs/guides/model-state": { status: 301, destination: "/docs/guides/modeling-and-persistence/model-state/" },
        "/docs/guides/model-query-guide": { status: 301, destination: "/docs/guides/modeling-and-persistence/model-query-guide/" },
        "/docs/guides/model-state-boundaries": { status: 301, destination: "/docs/guides/modeling-and-persistence/model-state-boundaries/" },
        "/docs/guides/model-migration-tests": { status: 301, destination: "/docs/guides/modeling-and-persistence/model-migration-tests/" },
        "/docs/guides/model-persistence": { status: 301, destination: "/docs/guides/modeling-and-persistence/model-persistence/" },
        "/docs/guides/updating-entities": { status: 301, destination: "/docs/guides/modeling-and-persistence/updating-entities/" },
        "/docs/guides/stateful-handlers": { status: 301, destination: "/docs/guides/modeling-and-persistence/stateful-handlers/" },
        "/docs/data-control-and-serialization/protecting-sensitive-data": { status: 301, destination: "/docs/guides/data-control-and-serialization/protecting-sensitive-data/" },
        "/docs/modeling-and-persistence/model-migration-tests": { status: 301, destination: "/docs/guides/modeling-and-persistence/model-migration-tests/" },
        "/docs/fluxzero-2-overview": { status: 301, destination: "/docs/fluxzero-2/" },
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
            destination: "/#get-started"
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
                Header: './src/components/DocsHeader.astro',
                ThemeProvider: './src/components/DocsThemeProvider.astro',
                ThemeSelect: './src/components/DocsThemeToggle.astro',
                MobileMenuFooter: './src/components/DocsMobileMenuFooter.astro',
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
                { tag: 'meta', attrs: { name: 'msapplication-config', content: fluxzeroBrand.browserConfig } },
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
                        { label: 'Start here', slug: 'docs/getting-started/introduction' },
                        { label: 'Example apps', slug: 'docs/building/example-apps' },
                        { label: 'Tutorials', items: [
                            { label: 'Explore a working app', slug: 'docs/building/local-development' },
                            { label: 'Make your first change', slug: 'docs/building/first-feature' },
                        ] },
                        { label: 'How-to guides', collapsed: true, items: [
                            { label: 'Start an app', slug: 'docs/building/start-an-app' },
                            { label: 'Open an existing project', slug: 'docs/building/resume-a-project' },
                            { label: 'Check and improve a feature', slug: 'docs/building/test-and-improve' },
                            { label: 'Investigate unexpected behavior', slug: 'docs/building/investigate' },
                            { label: 'Publish your app', slug: 'docs/tutorials/cloud-deployment' },
                            { label: 'Publish an update', slug: 'docs/building/publish-updates' },
                            { label: 'Manage users and access', slug: 'docs/building/manage-access' },
                            { label: 'Configure settings and secrets', slug: 'docs/building/configuration' },
                            { label: 'Connect a custom domain', slug: 'docs/building/custom-domain' },
                            { label: 'Investigate a failed deployment', slug: 'docs/building/deployment-problems' },
                            { label: 'Recover a version or data', slug: 'docs/building/recovery' },
                            { label: 'Review usage and costs', slug: 'docs/building/usage-and-costs' },
                        ] },
                        { label: 'Explanation', collapsed: true, items: [
                            { label: 'You, your agent and Fluxzero', slug: 'docs/building/working-with-your-agent' },
                            { label: 'How the toolkit fits together', slug: 'docs/building/fluxzero-toolkit' },
                            { label: 'Local and live environments', slug: 'docs/building/environments' },
                            { label: 'What the evidence tells you', slug: 'docs/building/understanding-evidence' },
                            { label: 'Identity and access', slug: 'docs/building/identity-and-access' },
                        ] },
                        { label: 'Reference', collapsed: true, items: [
                            { label: 'Devboard', slug: 'docs/building/devboard' },
                            { label: 'Cloud dashboard', slug: 'docs/building/dashboard' },
                            { label: 'Monitoring views', slug: 'docs/building/monitoring' },
                        ] },
                    ],
                },
                {
                    label: 'Developer Guides',
                    collapsed: true,
                    items: [
                        { label: 'Overview', slug: 'docs/guides' },
                        { label: 'Core concepts', slug: 'docs/getting-started/core-concepts' },
                        { label: 'Fluxzero 2.0', collapsed: true, items: [
                            { label: 'Overview', slug: 'docs/fluxzero-2' },
                            { label: 'Deep dive', slug: 'docs/fluxzero-2-deep-dive' },
                        ] },
                        { label: 'Tutorials', collapsed: true, items: [
                            { label: 'Hello world', slug: 'docs/getting-started/hello-world' },
                            { label: 'Building your first app', slug: 'docs/tutorials/first-app' },
                        ] },
                        { label: 'How-to guides', collapsed: true, items: [
                            { label: 'Overview', slug: 'docs/guides/how-to' },
                            { label: 'SDK installation', slug: 'docs/getting-started/installation' },
                            { label: 'Messaging', collapsed: true, items: [
                                { label: 'Message replays', slug: 'docs/guides/messaging/message-replays' },
                                { label: 'Dynamic dead-lettering', slug: 'docs/guides/messaging/dynamic-dead-lettering' },
                                { label: 'Model schedule reconciliation', slug: 'docs/guides/messaging/model-schedule-reconciliation' },
                                { label: 'Tie schedules to their owner', slug: 'docs/guides/messaging/parent-owned-schedules' },
                                { label: 'Custom message logs', slug: 'docs/guides/messaging/custom-message-logs' },
                                { label: 'Sending web requests', slug: 'docs/guides/messaging/sending-web-requests' },
                                { label: 'Building API integrations', slug: 'docs/guides/messaging/building-api-integrations' },
                                { label: 'Receive an external callback', slug: 'docs/guides/messaging/receiving-webhooks' },
                                { label: 'Keep a screen up to date', slug: 'docs/guides/messaging/updating-a-live-screen' },
                                { label: 'Build a feature from past events', slug: 'docs/guides/messaging/adding-a-feature-to-history' },
                                { label: 'Live and historical processing', slug: 'docs/guides/messaging/live-and-historical-processing' },
                                { label: 'Split a consumer', slug: 'docs/guides/messaging/splitting-a-consumer' },
                                { label: 'Merge two consumers', slug: 'docs/guides/messaging/merging-consumers' },
                            ] },
                            { label: 'Modeling & persistence', collapsed: true, items: [
                                { label: 'Designing Model state', slug: 'docs/guides/modeling-and-persistence/model-state' },
                                { label: 'Model recipes', slug: 'docs/guides/modeling-and-persistence/model-recipes' },
                                { label: 'Prevent double bookings', slug: 'docs/guides/modeling-and-persistence/preventing-double-bookings' },
                                { label: 'Wait for a response', slug: 'docs/guides/modeling-and-persistence/waiting-for-a-response' },
                                { label: 'React to a state change', slug: 'docs/guides/modeling-and-persistence/reacting-to-a-change' },
                                { label: 'Choose a Model or Graph query', slug: 'docs/guides/modeling-and-persistence/model-query-guide' },
                                { label: 'Update stored documents', slug: 'docs/guides/modeling-and-persistence/tracking-and-updating-documents' },
                            ] },
                            { label: 'Data protection', collapsed: true, items: [
                                { label: 'Use PII and erase it', slug: 'docs/guides/data-control-and-serialization/using-and-erasing-pii' },
                            ] },
                            { label: 'Testing', collapsed: true, items: [
                                { label: 'Testing your handlers', slug: 'docs/guides/messaging/testing-your-handlers' },
                                { label: 'Testing web endpoints', slug: 'docs/guides/messaging/testing-web-endpoints' },
                                { label: 'Testing Model migrations', slug: 'docs/guides/modeling-and-persistence/model-migration-tests' },
                            ] },
                        ] },
                        { label: 'Reference', collapsed: true, items: [
                            { label: 'Messaging', collapsed: true, items: [
                                { label: 'Sending messages', slug: 'docs/guides/messaging/sending-messages' },
                                { label: 'Message handling', slug: 'docs/guides/messaging/message-handling' },
                                { label: 'Message tracking', slug: 'docs/guides/messaging/message-tracking' },
                                { label: 'Response typing', slug: 'docs/guides/configuration/response-typing' },
                                { label: 'Local handling', slug: 'docs/guides/messaging/local-handling' },
                                { label: 'Payload validation', slug: 'docs/guides/messaging/payload-validation' },
                                { label: 'Role-based access control', slug: 'docs/guides/messaging/role-based-access-control' },
                                { label: 'Message scheduling', slug: 'docs/guides/messaging/message-scheduling' },
                                { label: 'Handling web requests', slug: 'docs/guides/messaging/handling-web-requests' },
                                { label: 'Handling WebSocket messages', slug: 'docs/guides/messaging/handling-websocket-messages' },
                                { label: 'Message interceptors', slug: 'docs/guides/messaging/message-interceptors' },
                                { label: 'Parameter resolvers', slug: 'docs/guides/messaging/parameter-resolvers' },
                                { label: 'Metrics messages', slug: 'docs/guides/messaging/metrics-messages' },
                                { label: 'Correlation data', slug: 'docs/guides/messaging/correlation-data' },
                            ] },
                            { label: 'Modeling & persistence', collapsed: true, items: [
                                { label: 'Loading models', slug: 'docs/guides/modeling-and-persistence/entity-loading' },
                                { label: 'Temporal Graphs', slug: 'docs/guides/modeling-and-persistence/temporal-graphs' },
                                { label: 'Updating models', slug: 'docs/guides/modeling-and-persistence/updating-entities' },
                                { label: 'Model relations and embedded members', slug: 'docs/guides/modeling-and-persistence/nested-entities' },
                                { label: 'Model persistence', slug: 'docs/guides/modeling-and-persistence/model-persistence' },
                                { label: 'Model state and protection boundaries', slug: 'docs/guides/modeling-and-persistence/model-state-boundaries' },
                                { label: 'Stateful handlers', slug: 'docs/guides/modeling-and-persistence/stateful-handlers' },
                                { label: 'Document indexing and search', slug: 'docs/guides/modeling-and-persistence/document-index-and-search' },
                            ] },
                            { label: 'Data control & serialization', collapsed: true, items: [
                                { label: 'Protecting sensitive data', slug: 'docs/guides/data-control-and-serialization/protecting-sensitive-data' },
                                { label: 'Upcasting and downcasting', slug: 'docs/guides/data-control-and-serialization/upcasting-and-downcasting' },
                                { label: 'User-based content filtering', slug: 'docs/guides/data-control-and-serialization/user-based-content-filtering' },
                            ] },
                            { label: 'Configuration', collapsed: true, items: [
                                { label: 'Configuring Fluxzero', slug: 'docs/guides/configuration/configuring-fluxzero' },
                                { label: 'Configuring WebSocket client', slug: 'docs/guides/configuration/configuring-websocket-client' },
                                { label: 'Application properties', slug: 'docs/guides/configuration/application-properties' },
                            ] },
                            { label: 'Error codes', slug: 'docs/errors' },
                        ] },
                    ],
                },
                {
                    label: 'Tools & automation',
                    collapsed: true,
                    items: [
                        { label: 'Overview', slug: 'docs/tools/overview' },
                        { label: 'Install and update', slug: 'docs/tools/install' },
                        { label: 'Set up your agent', slug: 'docs/tools/agent-plugin' },
                        { label: 'MCP connection and tools', slug: 'docs/tools/mcp' },
                        { label: 'CLI', slug: 'docs/tools/cli' },
                        { label: 'CLI command reference', slug: 'docs/tools/cli-reference' },
                        { label: 'Dev Server', slug: 'docs/tools/dev-server' },
                        { label: 'Build and publish', slug: 'docs/tools/build-and-publish' },
                        { label: 'GitHub Actions', slug: 'docs/tools/github-actions' },
                        { label: 'System API', slug: 'docs/tools/system-api' },
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
