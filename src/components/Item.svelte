<script lang="ts">
	import { Cluster, displayKeyword, parseIndex } from '../nlp';
	import type { Item } from '../rss';

	let titleElem: HTMLElement;

	export let itemOrCluster: Item | Cluster;

	function getItem(item: Item | Cluster, i = 0): Item {
		if (item instanceof Cluster) {
			return item.docs[parseIndex(item.inClusterIndices[i])][2];
		} else {
			return item;
		}
	}

	$: item = getItem(itemOrCluster);
	$: item2 = getItem(itemOrCluster, 1);
	$: item3 = getItem(itemOrCluster, 2);
	$: isCluster = itemOrCluster instanceof Cluster;
</script>

<div class="border-gray-600 border-b px-4">
	<a href={item.link} target="_blank" rel="noreferrer"
		><div class="my-6">
			{#if itemOrCluster instanceof Cluster}
				<div class="-mt-4 mb-1">
					<img
						class="bg-white rounded-sm top-1 h-3 inline-block"
						src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(item.link)}
            `}
						alt="Favicon for {item.link}"
					/>
					{#each itemOrCluster.topKeywords(1).map(displayKeyword) as keyword}
						<div class="inline-block text-xs bg-blue-200 text-blue-700 mr-1 px-1 rounded-sm">
							{keyword}
						</div>
					{/each}
				</div>
			{/if}
			<h3 class="font-bold text-base leading-6 mb-1 headline" bind:this={titleElem}>
				{item.title}
			</h3>
			<p class="text-gray-300 text-sm leading-5 mt-1">{item.description}</p>
			{#if item.image}
				{#if isCluster}
					<div class="flex">
						<img
							src={item.image}
							alt={item.title}
							class="w-3/5 max-h-28 object-cover rounded-md mt-2 mr-2"
						/>
						<div class="flex flex-col w-2/5">
							<img
								src={item2.image}
								alt={item2.title}
								class="w-full max-h-14 object-cover rounded-md mt-2"
							/>
							<img
								src={item3.image}
								alt={item3.title}
								class="w-full max-h-12 object-cover rounded-md mt-2"
							/>
						</div>
					</div>
				{:else}
					<img
						src={item.image}
						alt={item.title}
						class="w-full max-h-32 object-cover rounded-md mt-2"
					/>
				{/if}
			{/if}
		</div></a
	>
	{#if itemOrCluster instanceof Cluster && itemOrCluster.inClusterIndices.length >= 2}
		<div class="text-xs -mt-2 mb-1 font-bold uppercase">Related coverage</div>
		<div class="mb-1">
			{#each itemOrCluster.topKeywords().slice(1).map(displayKeyword) as keyword}
				<div class="inline-block text-xs bg-gray-200 text-gray-700 mr-1 px-1 rounded-sm">
					{keyword}
				</div>
			{/each}
		</div>
		<ul class="mb-4 flex flex-col">
			{#each itemOrCluster.inClusterIndices.slice(1) as relatedArticleIndex}
				{@const relatedArticle = itemOrCluster.docs[parseIndex(relatedArticleIndex)][2]}
				<li class="text-sm my-1 text-gray-300 relative">
					<img
						class="bg-white rounded-sm absolute top-1 h-3"
						src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(
							relatedArticle.link
						)}
            `}
						alt="Favicon for {relatedArticle.link}"
					/>
					<a href={relatedArticle.link} class="ml-5 inline-block"> {relatedArticle.title}</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
