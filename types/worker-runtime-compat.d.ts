export {};

declare global {
  /**
   * D1 run() responses always include execution metadata at runtime. This overload
   * makes that runtime guarantee explicit for strict TypeScript consumers.
   */
  interface D1PreparedStatement {
    run<T = unknown>(): Promise<D1Result<T> & { meta: NonNullable<D1Result<T>["meta"]> }>;
  }
}
