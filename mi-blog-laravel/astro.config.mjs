// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://laraveles.es',
  integrations: [
    mdx(),
    sitemap({
      lastmod: new Date(),
      changefreq: 'daily',
      priority: 0.7,
      customPages: [
        'https://www.laraveles.es/',
        'https://www.laraveles.es/blog',
        'https://www.laraveles.es/roadmap',
        'https://www.laraveles.es/curso',
        'https://www.laraveles.es/about',
      ],
    }),
  ],

  fonts: [
      {
          provider: fontProviders.local(),
          name: 'Atkinson',
          cssVariable: '--font-atkinson',
          fallbacks: ['sans-serif'],
          options: {
              variants: [
                  {
                      src: ['./src/assets/fonts/atkinson-regular.woff'],
                      weight: 400,
                      style: 'normal',
                      display: 'swap',
                  },
                  {
                      src: ['./src/assets/fonts/atkinson-bold.woff'],
                      weight: 700,
                      style: 'normal',
                      display: 'swap',
                  },
              ],
          },
      },
	],

  vite: {
    plugins: [tailwindcss()],
  },
});