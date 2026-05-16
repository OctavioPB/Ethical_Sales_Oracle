import pg from "pg";

const { Pool } = pg;

let _pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    _pool.on("error", (err) => {
      process.stderr.write(
        JSON.stringify({ level: "error", event: "pg_pool_error", error: err.message }) + "\n",
      );
    });
  }
  return _pool;
}

export async function closePool(): Promise<void> {
  await _pool?.end();
  _pool = null;
}
