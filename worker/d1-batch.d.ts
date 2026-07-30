// The repository's hand-written Cloudflare declaration predates D1 batch().
// Merge the missing method into the global interface used by Worker modules.
interface D1Database {
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}
