export const spinWords = (words: string): string =>
   words
	.split(" ")
	.map(word =>
		word.length >= 5
			? word.split('').reverse().join('')
			: word
	)
	.join(" ")

console.log(
	spinWords('hello world i am kae sdkljf')
)

