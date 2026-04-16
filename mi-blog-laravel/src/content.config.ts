import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			tags: z.array(z.string()).optional().default([]),
		}),
});

const quizQuestion = z.object({
	pregunta: z.string(),
	opciones: z.array(z.string()),
	correcta: z.number(),
	explicacion: z.string(),
});

const curso = defineCollection({
	loader: glob({ base: './src/content/curso', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		modulo: z.number(),
		leccion: z.number(),
		title: z.string(),
		description: z.string(),
		duracion: z.string(),
		quiz: z.array(quizQuestion).optional().default([]),
	}),
});

export const collections = { blog, curso };
