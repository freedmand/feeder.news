import { parseFeed } from 'htmlparser2';
import { decode } from 'html-entities';

const proxy = 'https://proxy.rssfeed.workers.dev/';

export type Rss = Item[];

export interface Item {
	title: string;
	description: string;
	link: string;
	image?: string;
}

export async function fetchRssFeed(url: string): Promise<Rss> {
	const proxyUrl = `${proxy}?url=${encodeURIComponent(url)}`;

	const response = await fetch(proxyUrl);
	const content = await response.text();
	const feed = parseFeed(content);

	if (feed == null) {
		throw new Error('Feed is null');
	}

	console.log(feed.items);

	return feed.items.map((item: any) => {
		const image: string | undefined = item.media?.[0]?.url;
		return {
			title: decode(item.title ?? ''),
			description: decode(item.description ?? ''),
			link: item.link,
			image
		};
	});
}
