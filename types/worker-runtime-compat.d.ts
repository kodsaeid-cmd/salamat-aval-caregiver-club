export {};

declare global {
  /**
   * D1 run() responses always include execution metadata at runtime. This overload
   * makes that runtime guarantee explicit for strict TypeScript consumers.
   */
  interface D1PreparedStatement {
    run<T = unknown>(): Promise<D1Result<T> & { meta: NonNullable<D1Result<T>["meta"]> }>;
  }

  /**
   * Normalized records produced from Record<string, unknown> retain the optional
   * status field supplied by their database row. This declaration reflects that
   * legacy record shape until all normalizers use explicit domain interfaces.
   */
  interface Object {
    readonly status?: unknown;
  }
}
