/** Shared structural surface for tests iterating over differently typed repositories. */
export interface TestRepository {
  count(): Promise<number>;
  all(): PromiseLike<unknown[]>;
  first(): PromiseLike<unknown>;
  where(filter: never): TestRepository;
}
