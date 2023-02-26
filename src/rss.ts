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

	const getImage = (item: any) => {
		const image: string | undefined = item.media?.[0]?.url;
		return image;
	};

	const linksWithoutImages = feed.items
		.filter((item: any) => !getImage(item))
		.map((item: any) => item.link);

	// Batch by 10
	const batches = linksWithoutImages.reduce((acc: string[][], link: string) => {
		const last = acc[acc.length - 1];
		if (last == null || last.length === 10) {
			acc.push([link]);
		} else {
			last.push(link);
		}
		return acc;
	}, []);

	let images = await Promise.all(
		batches.map(async (batch) => {
			const linksWithImages = await fetch(
				`${proxy}?images=${encodeURIComponent(JSON.stringify(batch))}`
			);
			const images = await linksWithImages.json();
			return images;
		})
	);
	images = images.flat();
	const imageMap: { [key: string]: string } = {};
	images.forEach((image: string, index: number) => {
		imageMap[linksWithoutImages[index]] = image;
	});

	return feed.items.map((item: any) => {
		let image: string | undefined = getImage(item);
		if (image == null) {
			image = imageMap[item.link];
		}
		return {
			title: decode(item.title ?? ''),
			description: decode(item.description ?? ''),
			link: item.link,
			image
		};
	});
}
