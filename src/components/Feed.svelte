<script lang="ts">
	import { onMount } from 'svelte';
	import type { Feed } from '../feeds';
	import { fetchRssFeed, type Item } from '../rss';

	export let feed: Feed;

	let items: Item[] = [];

	onMount(async () => {
		items = await fetchRssFeed(feed.feed);
	});
</script>

<div class="pane">
	<div class="p-4 border-gray-600 border-b">
		<h1 class="font-bold text-md">{feed.source}</h1>
		<h2 class="text-sm text-gray-300">{feed.section}</h2>
	</div>
	<div class="overflow-y-auto pt-0">
		{#each items as item}
			<div class="border-gray-600 border-b px-4">
				<a href={item.link} target="_blank" rel="noreferrer"
					><div class="my-6">
						<h3 class="font-bold text-base leading-6 mb-1 headline">{item.title}</h3>
						<p class="text-gray-300 text-sm leading-5 mt-1">{item.description}</p>
						{#if item.image}
							<img
								src={item.image}
								alt={item.title}
								class="w-full max-h-32 object-cover rounded-md mt-2"
							/>
						{/if}
					</div></a
				>
			</div>
		{/each}
	</div>
</div>
