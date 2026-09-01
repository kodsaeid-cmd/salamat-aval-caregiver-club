type TursoScalar = string | number | null | ArrayBuffer | ArrayBufferView | boolean;

type TursoPipelineValue =
  | { type: "null" }
  | { type: "integer"; value: string }
  | { type: "float"; value: string }
  | { type: "text"; value: string }
  | { type: "blob"; base64: string };

type TursoExecuteResult = {
  cols?: Array<{ name?: string } | string>;
  rows?: TursoPipelineValue[][];
  affected_row_count?: number;
  last_insert_rowid?: string | number | null;
  rows_read?: number;
  rows_written?: number;
  query_duration_ms?: number;
};

type TursoPipelineItem =
  | { type: "ok"; response?: { type?: string; result?: TursoExecuteResult } }
  | { type: "error"; error?: { message?: string; code?: string } };

type TursoPipelineResponse = {
  results?: TursoPipelineItem[];
};

const TURSO_BACKEND = "turso";
const D1_BACKEND = "d1";
const BACKEND_MARKER = "__SALAMAT_DATABASE_BACKEND_V1";

function bytesToBase64(value: ArrayBuffer | ArrayBufferView) {
  const bytes = value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeArg(value: TursoScalar): TursoPipelineValue {
  if (value === null || value === undefined) return { type: "null" };
  if (typeof value === "boolean") return { type: "integer", value: value ? "1" : "0" };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Database bind values must be finite numbers.");
    return Number.isInteger(value)
      ? { type: "integer", value: String(value) }
      : { type: "float", value: String(value) };
  }
  if (typeof value === "string") return { type: "text", value };
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return { type: "blob", base64: bytesToBase64(value) };
  throw new TypeError(`Unsupported database bind value: ${typeof value}`);
}

function decodeValue(value: TursoPipelineValue | undefined): unknown {
  if (!value || value.type === "null") return null;
  if (value.type === "integer" || value.type === "float") return Number(value.value);
  if (value.type === "text") return value.value;
  if (value.type === "blob") return base64ToBytes(value.base64);
  return null;
}

function resultColumns(result: TursoExecuteResult) {
  return (result.cols || []).map((column, index) =>
    typeof column === "string" ? column : String(column?.name || `column_${index}`),
  );
}

function resultRows(result: TursoExecuteResult) {
  const columns = resultColumns(result);
  return (result.rows || []).map((row) => {
    const record: Record<string, unknown> = {};
    columns.forEach((column, index) => { record[column] = decodeValue(row[index]); });
    return record;
  });
}

function d1Meta(result: TursoExecuteResult) {
  const changes = Number(result.affected_row_count || result.rows_written || 0);
  const lastRowId = result.last_insert_rowid == null ? undefined : Number(result.last_insert_rowid);
  return {
    duration: Number(result.query_duration_ms || 0),
    size_after: 0,
    rows_read: Number(result.rows_read || 0),
    rows_written: Number(result.rows_written || changes),
    changed_db: changes > 0,
    changes,
    last_row_id: Number.isFinite(lastRowId) ? lastRowId : undefined,
  };
}

function normalizeTursoUrl(value: string) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (trimmed.startsWith("libsql://")) return `https://${trimmed.slice("libsql://".length)}`;
  if (trimmed.startsWith("https://")) return trimmed;
  throw new Error("TURSO_DATABASE_URL must use libsql:// or https://.");
}

function isPipelineError(item: TursoPipelineItem | undefined): item is Extract<TursoPipelineItem, { type: "error" }> {
  return Boolean(item && item.type === "error");
}

class TursoD1Database {
  readonly url: string;
  readonly authToken: string;

  constructor(url: string, authToken: string) {
    this.url = normalizeTursoUrl(url);
    this.authToken = authToken;
  }

  prepare(sql: string) {
    return new TursoD1PreparedStatement(this, String(sql || ""), []);
  }

  async request(statements: Array<{ sql: string; args?: TursoScalar[] }>, transactional = false) {
    const requests: any[] = [];
    if (transactional && statements.length > 1) requests.push({ type: "execute", stmt: { sql: "BEGIN IMMEDIATE" } });
    for (const statement of statements) {
      requests.push({
        type: "execute",
        stmt: {
          sql: statement.sql,
          ...(statement.args?.length ? { args: statement.args.map(encodeArg) } : {}),
        },
      });
    }
    if (transactional && statements.length > 1) requests.push({ type: "execute", stmt: { sql: "COMMIT" } });
    requests.push({ type: "close" });

    const response = await fetch(`${this.url}/v2/pipeline`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.authToken}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ requests }),
    });
    const payload = await response.json().catch(() => null) as TursoPipelineResponse | null;
    if (!response.ok) throw new Error(`Turso request failed (${response.status}).`);
    const items = Array.isArray(payload?.results) ? payload!.results! : [];
    const failure = items.find(isPipelineError);
    if (failure) throw new Error(failure.error?.message || "Turso SQL execution failed.");
    const offset = transactional && statements.length > 1 ? 1 : 0;
    return statements.map((_, index) => {
      const item = items[offset + index] as Extract<TursoPipelineItem, { type: "ok" }> | undefined;
      return item?.response?.result || {};
    });
  }

  async batch(statements: TursoD1PreparedStatement[]) {
    if (!Array.isArray(statements)) throw new TypeError("DB.batch expects an array of prepared statements.");
    const normalized = statements.map((statement) => {
      if (!(statement instanceof TursoD1PreparedStatement) || statement.database !== this) {
        throw new TypeError("DB.batch received a statement from a different database backend.");
      }
      return { sql: statement.sql, args: statement.args };
    });
    const results = await this.request(normalized, true);
    return results.map((result) => ({ success: true, results: resultRows(result), meta: d1Meta(result) }));
  }

  async exec(sql: string) {
    const result = (await this.request([{ sql: String(sql || "") }]))[0] || {};
    return { count: Number(result.affected_row_count || 0), duration: Number(result.query_duration_ms || 0) };
  }
}

class TursoD1PreparedStatement {
  readonly database: TursoD1Database;
  readonly sql: string;
  readonly args: TursoScalar[];

  constructor(database: TursoD1Database, sql: string, args: TursoScalar[]) {
    this.database = database;
    this.sql = sql;
    this.args = args;
  }

  bind(...values: TursoScalar[]) {
    return new TursoD1PreparedStatement(this.database, this.sql, values);
  }

  private async execute() {
    return (await this.database.request([{ sql: this.sql, args: this.args }]))[0] || {};
  }

  async first<T = Record<string, unknown>>(columnName?: string): Promise<T | null> {
    const result = await this.execute();
    const row = resultRows(result)[0];
    if (!row) return null;
    if (columnName) return (row[columnName] ?? null) as T | null;
    return row as T;
  }

  async all<T = Record<string, unknown>>() {
    const result = await this.execute();
    return { success: true, results: resultRows(result) as T[], meta: d1Meta(result) };
  }

  async run<T = Record<string, unknown>>() {
    const result = await this.execute();
    return { success: true, results: resultRows(result) as T[], meta: d1Meta(result) };
  }

  async raw<T = unknown[]>(options?: { columnNames?: boolean }) {
    const result = await this.execute();
    const columns = resultColumns(result);
    const rows = (result.rows || []).map((row) => row.map(decodeValue));
    return (options?.columnNames ? [columns, ...rows] : rows) as T[];
  }
}

export function databaseBackend(env: any) {
  return String(env?.DATABASE_BACKEND || D1_BACKEND).trim().toLowerCase();
}

export function withDatabaseBackend(env: any) {
  if (!env || typeof env !== "object") return env;
  const backend = databaseBackend(env);
  if (backend !== TURSO_BACKEND) return env;
  if (env[BACKEND_MARKER] === TURSO_BACKEND) return env;
  const url = String(env.TURSO_DATABASE_URL || "").trim();
  const authToken = String(env.TURSO_AUTH_TOKEN || "").trim();
  if (!url || !authToken) throw new Error("Turso backend selected but TURSO_DATABASE_URL/TURSO_AUTH_TOKEN are missing.");
  return {
    ...env,
    D1_DB: env.DB,
    DB: new TursoD1Database(url, authToken),
    [BACKEND_MARKER]: TURSO_BACKEND,
  };
}

export async function checkDatabaseBackend(env: any) {
  const runtimeEnv = withDatabaseBackend(env);
  const row = await runtimeEnv.DB.prepare("SELECT 1 AS ok").first() as { ok?: number } | null;
  return { backend: databaseBackend(runtimeEnv), ok: Number(row?.ok || 0) === 1 };
}
