<script lang="ts">
	import Feed from '../components/Feed.svelte';
	import Header from '../components/Header.svelte';
	import { feeds } from '../feeds';
</script>

<Header />

<div class="flex overflow-x-auto">
	{#each feeds as feed}
		<Feed {feed} />
	{/each}
</div>
