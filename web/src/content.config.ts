import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { changelogsLoader } from 'starlight-changelogs/loader';

export const collections = {
	docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
	changelogs: defineCollection({
		loader: changelogsLoader([
			{
				provider: 'keep-a-changelog',
				base: 'reference/changelog',
				changelog: '../CHANGELOG.md',
				extractDate: ({ title }) => {
					const date = title.match(/\((\d{4}-\d{2}-\d{2})\)$/)?.[1];

					return date ? new Date(`${date}T12:00:00Z`) : undefined;
				},
				process: ({ title }) => title.replace(/\s+\(\d{4}-\d{2}-\d{2}\)$/, ''),
			},
		]),
	}),
};
