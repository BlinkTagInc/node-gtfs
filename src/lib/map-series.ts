/**
 * Runs an async callback for each item in an array one at a time, in order
 * @param items Items to iterate over
 * @param callback Async function called with each item in turn
 * @returns Array of results in the same order as `items`
 */
export async function mapSeries<Item, Result>(
  items: readonly Item[],
  callback: (item: Item) => Promise<Result>,
): Promise<Result[]> {
  const results: Result[] = [];

  for (const item of items) {
    results.push(await callback(item));
  }

  return results;
}
