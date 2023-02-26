export interface Feed {
	source: string;
	section: string;
	feed: string;
}

export const feeds: Feed[] = [
	{
		source: 'New York Times',
		section: 'Home page',
		feed: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml'
	},
	{
		source: 'New York Times',
		section: 'World',
		feed: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml'
	},
	{
		source: 'Washington Post',
		section: 'Home page',
		feed: 'https://feeds.washingtonpost.com/rss/homepage'
	},
	{
		source: 'Al Jazeera',
		section: 'Home page',
		feed: 'https://www.aljazeera.com/xml/rss/all.xml'
	},
	{
		source: 'BBC',
		section: 'Top stories',
		feed: 'http://feeds.bbci.co.uk/news/rss.xml'
	},
	{
		source: 'BBC',
		section: 'World',
		feed: 'http://feeds.bbci.co.uk/news/world/rss.xml'
	},
	{
		source: 'Hacker News',
		section: 'Top',
		feed: 'https://news.ycombinator.com/rss'
	}
];
