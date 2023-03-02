import type { Feed } from './feeds';
import type { Item } from './rss';

import model from 'wink-eng-lite-web-model';
import winkNLP, { type Bow, type CustomEntities, type Tokens, type Document } from 'wink-nlp';
import BM25Vectorizer from 'wink-nlp/utilities/bm25-vectorizer';
import similarity from 'wink-nlp/utilities/similarity';
import graph from 'pagerank.js';

// Initialize NLP
export const nlp = winkNLP(model);
export const its = nlp.its;
export const as = nlp.as;

// Custom entities
const patterns = [
	{
		name: 'nounPhrase',
		patterns: ['[PROPN] [|PROPN] [|PROPN] [|PROPN]']
	},
	{
		name: 'nounPhrase',
		patterns: ['[PROPN] [ADJ|PROPN] [|PROPN] [|PROPN]']
	},
	{
		name: 'nounPhrase',
		patterns: ['[PROPN|ADJ] [PROPN]']
	},
	{
		name: 'nounPhrase',
		patterns: ['[PROPN] [CARDINAL]']
	}
];
nlp.learnCustomEntities(patterns, {
	matchValue: false,
	useEntity: true,
	usePOS: true
});

// BM25
export const bm25 = BM25Vectorizer();

/**
 * @param text The description text
 * @returns The normalized description text
 */
export function normalizeDescription(text: string): string {
	if (text.length < 15) return '';
	return text;
}

/**
 * @param subtokens Sub-token information like lemmas or stems
 * @returns A consolidated string to represent the conglomeration
 * (but done in a searchable way)
 */
function joinSubtokens(subtokens: string[]): string {
	return ` ${subtokens.join(' ')} `;
}

export const lemmaToText: { [lemma: string]: string } = {};
export const lemmaToStem: { [lemma: string]: string } = {};
export const stemToLemma: { [stem: string]: string } = {};

export function getDocs(item: Item): [[Document, string], [Document, string]] {
	const title = item.title;
	const description = normalizeDescription(item.description);
	const titleDoc = nlp.readDoc(title);
	const descriptionDoc = nlp.readDoc(description);
	return [
		[titleDoc, title],
		[descriptionDoc, description]
	];
}

/**
 * @param string1 The first string to compare
 * @param string2 The second string to compare
 * @returns True if the first string has more capitalized letters
 */
export function moreCapitalized(string1: string, string2: string): boolean {
	let count1 = 0;
	let count2 = 0;
	for (let i = 0; i < string1.length; i++) {
		if (string1[i] === string1[i].toUpperCase()) count1++;
	}
	for (let i = 0; i < string2.length; i++) {
		if (string2[i] === string2[i].toUpperCase()) count2++;
	}
	return count1 > count2;
}

function updateDictIfMoreAuthoritative(
	dict: { [key: string]: string },
	key: string,
	newValue: string
) {
	const oldValue = dict[key];
	if (oldValue == null) {
		dict[key] = newValue;
	} else if (
		newValue.length < oldValue.length ||
		(moreCapitalized(newValue, oldValue) && newValue.length <= oldValue.length)
	) {
		dict[key] = newValue;
	}
}

export function processDoc([doc, text]: [Document, string]): Doc {
	const texts: string[] = [];
	const lemmas: string[] = [];
	const stems: string[] = [];
	const customEntities = doc.customEntities();
	customEntities.each((entity) => {
		const tokens = entity.tokens();
		// Grab consolidated lemma and stem
		const text = joinSubtokens(tokens.out(its.value, as.array));
		const lemma = joinSubtokens(tokens.out(its.lemma, as.array));
		const stem = joinSubtokens(tokens.out(its.stem, as.array));
		texts.push(text);
		lemmas.push(lemma);
		stems.push(stem);
		// Map lemma to stem
		lemmaToStem[lemma] = stem;
		updateDictIfMoreAuthoritative(lemmaToText, lemma, text);
		// Map stem to lemma, but only if lemma is shorter than what's in there
		updateDictIfMoreAuthoritative(stemToLemma, stem, lemma);
	});
	bm25.learn(stems as unknown as Tokens); // ts hackery necessary, but this works

	// Leave bow empty for now; it's extracted after bm25 learning
	return new Doc(text, doc, customEntities, texts, lemmas, stems, {});
}

export let idfs: {
	[stem: string]: number;
} = {};
let idfsInitialized = false;

export function getBow(doc: Doc): Bow {
	if (!idfsInitialized) {
		// Initialize idfs now that we're ready
		idfs = Object.fromEntries(bm25.out(its.idf));
		idfsInitialized = true;
	}
	return bm25.bowOf(doc.stems as unknown as Tokens);
}

const simMatrix: { [key: number]: { [key: number]: number } } = {};

export class Doc {
	constructor(
		readonly text: string,
		readonly doc: Document,
		readonly customEntities: CustomEntities,
		readonly texts: string[],
		readonly lemmas: string[],
		readonly stems: string[],
		public bow: Bow
	) {}

	hasStem(stem: string) {
		return this.stems.includes(stem);
	}
}

export function stemToText(stem: string): string {
	return lemmaToText[stemToLemma[stem]];
}

export type Docs = [Doc, Doc, Item][];

export function bowSimilarity(bow1: Bow, bow2: Bow): number {
	return similarity.bow.cosine(bow1, bow2);
}

export function getSimilarity(docs: Docs, i: number, j: number): number {
	if (simMatrix[i] && simMatrix[i][j] !== undefined) {
		return simMatrix[i][j];
	}

	const sim =
		bowSimilarity(docs[i][0].bow, docs[j][0].bow) * 0.7 +
		bowSimilarity(docs[i][1].bow, docs[j][1].bow) * 0.15 +
		bowSimilarity(docs[i][1].bow, docs[j][0].bow) * 0.075 +
		bowSimilarity(docs[i][0].bow, docs[j][1].bow) * 0.075;
	simMatrix[i] = simMatrix[i] ?? {};
	simMatrix[i][j] = sim;
	simMatrix[j] = simMatrix[j] ?? {};
	simMatrix[j][i] = sim;
	return sim;
}

export function getRemainingDocsSet(docs: Docs): Set<number> {
	const remainingDocs = new Set<number>();
	for (let i = 0; i < docs.length; i++) {
		remainingDocs.add(i);
	}
	return remainingDocs;
}

/**
 *
 * @param docs All the docs
 * @param docIndexSet The specific doc indices to pagerank
 * @param keywordScores Optional mapping of keyword scores to reweight responses
 * @param sameSourceScaling The weight penalty for items with the same source
 * @returns Dictionary mapping docIndex to rank
 */
export function pagerank(
	docs: Docs,
	docIndexSet: Set<number>,
	keywordScores: KeywordScoreMap | null = null,
	sameSourceScaling = 0.5
): { [node: number]: number } {
	graph.reset();

	const docIndices = Array.from(docIndexSet);
	for (let i = 0; i < docIndices.length; i++) {
		for (let j = i + 1; j < docIndices.length; j++) {
			const x = docIndices[i];
			const y = docIndices[j];
			let scaling = 1;
			// Check for keyword scores
			if (keywordScores != null) {
				const docTitleScore1 = docKeywordScore(docs[x][0], keywordScores) * 0.8;
				const docDescriptionScore1 = docKeywordScore(docs[x][1], keywordScores) * 0.2;
				const docTitleScore2 = docKeywordScore(docs[y][0], keywordScores) * 0.8;
				const docDescriptionScore2 = docKeywordScore(docs[y][1], keywordScores) * 0.2;
				scaling =
					(docTitleScore1 + docDescriptionScore1 + docTitleScore2 + docDescriptionScore2) / 2;
			}
			const sameSource = docs[x][2].feed.source === docs[y][2].feed.source;
			graph.link(x, y, getSimilarity(docs, x, y) * scaling * (sameSource ? sameSourceScaling : 1));
		}
	}

	const ranks: { [node: number]: number } = {};
	graph.rank(0.85, 0.000001, (node: number, rank: number) => {
		ranks[node] = rank;
	});
	return ranks;
}

export function max0(list: number[]): number {
	let max = 0;
	for (const x of list) {
		if (x > max) {
			max = x;
		}
	}
	return max;
}

export class KeywordScoreMap {
	constructor(readonly scoreMap: { [keyword: string]: number }, public oovScore: number) {}

	score(keyword: string): number {
		const result = this.scoreMap[keyword];
		if (result == null) return this.oovScore;
		return result;
	}

	/**
	 * @param score The new oov score
	 * @returns A new keyword score map with that oov
	 */
	oov(score: number): KeywordScoreMap {
		return new KeywordScoreMap(this.scoreMap, score);
	}

	add(other: KeywordScoreMap, scalingFactor = 1) {
		for (const [key, value] of Object.entries(other.scoreMap)) {
			this.scoreMap[key] += value * scalingFactor;
		}
	}
}

export function smoothScoreRamp(
	keywordLists: string[][],
	top = 1,
	bottom = 0,
	oovScore = -1
): KeywordScoreMap {
	const length = max0(keywordLists.map((x) => x.length));
	const scoreMap: { [keyword: string]: number } = {};
	for (const keywords of keywordLists) {
		for (let i = 0; i < keywords.length; i++) {
			const score = (i / (length - 1)) * (top - bottom) + bottom;
			const keyword = keywords[i];
			scoreMap[keyword] = (scoreMap[keyword] ?? 0) + score;
		}
	}
	return new KeywordScoreMap(scoreMap, oovScore);
}

/**
 *  -10 -> 0.294
 *   -1 -> 0.591
 * -0.1 -> 0.913
 *    0 -> 1.000
 *  0.1 -> 1.095
 *    1 -> 1.693
 *   10 -> 3.398
 * @param num The number to get a scaling factor for
 * @returns The output scaling factor
 */
function smoothLog(num: number): number {
	if (num >= 0) return Math.log(num + 1) + 1;
	return 1 / (Math.log(-num + 1) + 1);
}

export function docKeywordScore(doc: Doc, scoreMap: KeywordScoreMap): number {
	const bow = Object.entries(doc.bow);
	let total = 0;
	for (const [keyword, bowScore] of bow) {
		total += scoreMap.score(keyword) * bowScore;
	}
	return smoothLog(total);
}

export function emptyKeywordMap(
	docs: Docs,
	docIndices: Set<number> | number[]
): { [keyword: string]: number } {
	const keywords: { [keyword: string]: number } = {};

	for (const node of docIndices) {
		for (const stem of docs[node][0].stems) {
			keywords[stem] = 1;
		}
		for (const stem of docs[node][1].stems) {
			keywords[stem] = 1;
		}
	}

	return keywords;
}

export function parseIndex(x: Index): number {
	if (typeof x === 'string') return parseInt(x);
	return x;
}

export function keywordMap(
	docs: Docs,
	docIndices: Set<number> | Index[],
	ranks: { [node: number]: number } | null = null,
	keywordScoreMap: KeywordScoreMap | null = null,
	useSmoothLog = true
): { [keyword: string]: number } {
	const keywords: { [keyword: string]: number } = {};

	const scoreFn = (node: Index, stem: string): number => {
		const prevScore = keywords[stem] ?? 0;
		const logFn = useSmoothLog ? smoothLog : (x: number) => x;
		const scaling = keywordScoreMap ? logFn(keywordScoreMap.score(stem)) : 1;
		if (ranks == null) {
			return (prevScore + 1) * idfs[stem] * scaling;
		} else {
			return (prevScore + 1 + ranks[parseIndex(node)]) * idfs[stem] * scaling;
		}
	};

	for (const node of docIndices) {
		for (const stem of docs[parseIndex(node)][0].stems) {
			keywords[stem] = scoreFn(node, stem) * 0.8;
		}
		for (const stem of docs[parseIndex(node)][1].stems) {
			keywords[stem] = scoreFn(node, stem) * 0.2;
		}
	}

	return keywords;
}

export function topFromMap(keywordMap: { [keyword: Index]: number }, n?: number): string[] {
	return Object.entries(keywordMap)
		.sort((a, b) => b[1] - a[1])
		.map((entry) => entry[0])
		.slice(0, n);
}

export function filterDocs(
	docs: Docs,
	docIndices: Set<number>,
	filterFn: (doc: Doc) => boolean
): Set<number> {
	const result = new Set<number>();
	for (const docIndex of docIndices) {
		const [titleDoc, descriptionDoc] = docs[docIndex];
		// Check if the doc should be kept
		if (filterFn(titleDoc) || filterFn(descriptionDoc)) {
			result.add(docIndex);
		}
	}
	return result;
}

export function keywordPreview(keywords: string[], n = 5): string[] {
	return keywords.slice(0, n).map((keyword) => lemmaToText[stemToLemma[keyword]]);
}

export function docPreview(docs: Docs, indices: Index[]) {
	return indices.map((index) => docs[parseIndex(index)][0].text);
}

type Index = string | number;

export function displayKeyword(keyword: string): string {
	return stemToText(keyword).trim();
}

export class Cluster {
	constructor(
		readonly index: number,
		readonly docs: Docs,
		readonly inClusterIndices: Index[],
		readonly allIndices: Index[],
		readonly ranks: { [node: Index]: number }
	) {}

	topKeywords(n = 5): string[] {
		return topFromMap(keywordMap(this.docs, this.inClusterIndices), n);
	}

	toString(): string {
		let result = '';

		result += `Cluster ${this.index + 1}  [n=${this.inClusterIndices.length}/${
			this.allIndices.length
		}] (${this.topKeywords().map(displayKeyword)})\n--------\n`;

		for (let j = 0; j < this.inClusterIndices.length; j++) {
			const node = this.inClusterIndices[j];
			const doc = this.docs[parseIndex(node)];
			result += `  ${String.fromCharCode('a'.charCodeAt(0) + j)}) ${this.ranks[node].toFixed(3)} ${
				doc[0].text
			}\n${Array.from(doc[0].lemmas)} | ${Array.from(doc[1].lemmas)}\n\n`;
		}

		return result;
	}
}

export function constructAutoFeed(
	feeds: Feed[],
	itemsByFeed: { [feed: string]: Item[] }
): Cluster[] {
	let clusterIndex = 0;

	// Do a first-pass through the feed to build up lemma map and bm25 model
	const docs: Docs = [];
	const titleMap: { [title: string]: boolean } = {};
	for (const feed of feeds) {
		for (const item of itemsByFeed[feed.feed]) {
			// Ensure no duplicates come in
			const title = item.title;
			if (titleMap[title] != null) continue;
			titleMap[title] = true;

			// Extract docs
			const [titleDoc, descriptionDoc] = getDocs(item);
			docs.push([processDoc(titleDoc), processDoc(descriptionDoc), item]);
		}
	}

	// Do a second-pass through stems to extract bm25 bows
	for (const [titleDoc, descriptionDoc] of docs) {
		titleDoc.bow = getBow(titleDoc);
		descriptionDoc.bow = getBow(descriptionDoc);
	}

	// Begin clustering
	const remainingDocs = getRemainingDocsSet(docs);
	const keywordWeights = new KeywordScoreMap(emptyKeywordMap(docs, remainingDocs), 0);

	// Create 20 clusters for now
	const clusters: Cluster[] = [];
	for (let z = 0; z < 20; z++) {
		const keywords = topFromMap(keywordMap(docs, remainingDocs, null, keywordWeights));
		const topKeyword = keywords[0];

		const docsWithKeyword = filterDocs(docs, remainingDocs, (doc: Doc) => doc.hasStem(topKeyword));

		const secondaryKeywords = topFromMap(keywordMap(docs, docsWithKeyword)).filter(
			(keyword) => keyword !== topKeyword
		);

		const keywordScores = smoothScoreRamp([
			keywords.slice(0, 5),
			[topKeyword, ...secondaryKeywords.slice(0, 4)]
		]);

		const ranks = pagerank(docs, docsWithKeyword, keywordScores);

		const topRanks = topFromMap(ranks);

		const cluster = new Cluster(clusterIndex++, docs, topRanks.slice(0, 5), topRanks, ranks);
		clusters.push(cluster);

		// Reweight keywords to negatively incentivize current ones
		keywordWeights.add(smoothScoreRamp([cluster.topKeywords(10)], -100, -100, 0), 1);
	}

	return clusters;
}
