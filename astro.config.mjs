// @ts-check
import {defineConfig} from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';
import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
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
    redirects: {
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
               //  Header: './src/components/DocsHeader.astro', // disabled as we haven't gotten this right yet
            },
            title: 'Fluxzero documentation',
            logo: {
                light: './src/assets/flux-logo-black.png',
                dark: './src/assets/flux-logo-white.png',
                alt: 'Flux Logo'
            },
            favicon: '/assets/fluxzero/fluxzero-logo.png',
            editLink: {
                baseUrl: 'https://github.com/fluxzero-io/flux-docs/edit/main',
            },
            social: [{icon: 'github', label: 'GitHub', href: 'https://github.com/fluxzero-io/flux-docs'}],
            customCss: ['./src/styles/global.css'],
            sidebar: [
                {
                    label: 'Getting started',
                    autogenerate: {directory: 'docs/getting-started'},
                },
                {
                    label: 'Tutorials',
                    autogenerate: {directory: 'docs/tutorials'},
                },
                {
                    label: 'Guides',
                    autogenerate: {directory: 'docs/guides'},
                },
                {
                    label: 'Reference',
                    autogenerate: {directory: 'docs/reference'},
                },
                {
                    label: 'About',
                    autogenerate: {directory: 'docs/about'},
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