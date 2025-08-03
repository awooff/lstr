export function filter_list(l: Array<any>): Array<number> {
  return l
    .filter(val => typeof val === 'number')
}

console.log(
	filter_list([2,3,"4","c"])
)
