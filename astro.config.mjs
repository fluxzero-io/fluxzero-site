// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
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
                  autogenerate: { directory: 'about' },
              },
              {
                  label: 'Tutorials',
                  autogenerate: { directory: 'tutorials' },
              },
              {
                  label: 'Guides',
                  autogenerate: { directory: 'guides' },
              },
              {
                  label: 'Reference',
                  autogenerate: { directory: 'reference' },
              },
          ],
      }),
	],

  adapter: cloudflare({
    imageService: 'compile',
    platformProxy: {
        enabled: true,
    },
  }),
});