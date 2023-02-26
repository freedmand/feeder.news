<script lang="ts">
	import '../app.css';
</script>

<main class="flex max-w-screen">
	<slot />
</main>

<svelte:head>
	<title>feeder.news</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<link rel="icon" type="image/png" href="/favicon.png" />
</svelte:head>
