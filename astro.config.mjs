// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Flux Documentation',
			logo: {
				light: './src/assets/flux-logo-black.png',
				dark: './src/assets/flux-logo-white.png',
				alt: 'Flux Logo'
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
});
