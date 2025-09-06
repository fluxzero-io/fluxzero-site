// @ts-check
import { defineConfig } from 'astro/config';
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
      }
  },
  integrations: [
    starlight({
      components: {
        Header: './src/components/DocsHeader.astro',
      },
      title: 'Fluxzero Documentation',
      logo: {
          light: './src/assets/flux-logo-black.png',
          dark: './src/assets/flux-logo-white.png',
          alt: 'Flux Logo'
      },
      editLink: {
            baseUrl: 'https://github.com/flux-capacitor-io/flux-docs/edit/main',
      },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/flux-capacitor-io/flux-docs' }],
      customCss: ['./src/styles/global.css'],
      sidebar: [
          {
              label: 'Getting Started',
              autogenerate: { directory: 'docs/getting-started' },
          },
          {
              label: 'Get started',
              autogenerate: { directory: 'docs/get-started' },
          },
          {
              label: 'Foundation',
              autogenerate: { directory: 'docs/foundation' },
          },
          {
              label: 'Guides',
              autogenerate: { directory: 'docs/guides' },
          },
          {
              label: 'Reference',
              autogenerate: { directory: 'docs/reference' },
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