// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          silenceDeprecations: ['import', 'global-builtin', 'color-functions']
        }
      }
    }
  },
  redirects: {
  },
  integrations: [
    starlight({
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
      sidebar: [
          {
              label: 'About',
              autogenerate: { directory: 'docs/about' },
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