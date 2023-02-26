import { parseFeed } from 'htmlparser2';
import { decode } from 'html-entities';

export interface Env {}

interface Item {
	title: string;
	description: string;
	link: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// Get query param of feed
		const url = new URL(request.url);
		const feedUrl = url.searchParams.get('feed');
		if (!feedUrl) {
			return new Response('No feed provided', { status: 400 });
		}

		const pageSize = parseInt(url.searchParams.get('pageSize') ?? '20');
		const page = parseInt(url.searchParams.get('page') ?? '1');

		if (isNaN(pageSize) || isNaN(page) || page < 1 || pageSize < 1) {
			return new Response('Invalid page or pageSize', { status: 400 });
		}

		const response = await fetch(feedUrl);
		const content = await response.text();
		const feed = parseFeed(content);

		let items = feed.items;

		// Check if there's more items
		const hasMore = items.length > page * pageSize;
		const nextPageUrl = hasMore
			? `${url.origin}${url.pathname}?feed=${encodeURIComponent(
					feedUrl
			  )}&pageSize=${pageSize}&page=${page + 1}`
			: undefined;

		// Slice items
		items = items.slice((page - 1) * pageSize, page * pageSize);

		// Write items
		return new Response(
			JSON.stringify({
				items: items.map((item: Item) => ({
					title: decode(item.title),
					description: decode(item.description),
					link: item.link
				})),
				next: nextPageUrl
			}),
			{
				headers: {
					'content-type': 'application/json;charset=UTF-8'
				}
			}
		);
	}
};
