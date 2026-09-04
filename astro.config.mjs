// @ts-check
import { defineConfig, envField } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';
import tailwindcss from '@tailwindcss/vite';
import starlightLinksValidator from 'starlight-links-validator'
import cloudflare from '@astrojs/cloudflare';
import { fluxzeroBrand } from './src/config/brand.mjs';

// https://astro.build/config
export default defineConfig({
    site: 'https://fluxzero.io',
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
            components: {
                SiteTitle: './src/components/DocsSiteTitle.astro',
                MarkdownContent: './src/components/MarkdownContentWithFeedback.astro',
                Footer: './src/components/DocsFooter.astro',
            },
            title: 'Fluxzero docs',
            favicon: fluxzeroBrand.faviconSvg,
            head: [
                { tag: 'link', attrs: { rel: 'icon', href: fluxzeroBrand.favicon32, sizes: '32x32', type: 'image/png' } },
                { tag: 'link', attrs: { rel: 'icon', href: fluxzeroBrand.favicon16, sizes: '16x16', type: 'image/png' } },
                { tag: 'link', attrs: { rel: 'icon', href: fluxzeroBrand.faviconIco, sizes: 'any' } },
                { tag: 'link', attrs: { rel: 'apple-touch-icon', href: fluxzeroBrand.appleTouchIcon } },
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
                    label: 'Getting started',
                    autogenerate: { directory: 'docs/getting-started' },
                },
                {
                    label: 'Tutorials',
                    autogenerate: { directory: 'docs/tutorials' },
                },
                {
                    label: 'Guides',
                    autogenerate: { directory: 'docs/guides' },
                },
                {
                    label: 'Reference',
                    autogenerate: { directory: 'docs/reference' },
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
        imageService: 'compile',
        platformProxy: {
            enabled: true,
        },
    }),
});
