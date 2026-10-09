import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let db: NodePgDatabase<typeof schema> | null = null;

const dbUrl = process.env.DATABASE_URL;

if (dbUrl && !dbUrl.includes("user:password@localhost")) {
  try {
    pool = new Pool({
      connectionString: dbUrl,
      connectionTimeoutMillis: 3000,
      ssl: dbUrl.includes("neon.tech") || dbUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
    });
    db = drizzle(pool, { schema });
  } catch (err) {
    console.warn("Could not initialize PostgreSQL pool, using resilient in-memory fallback:", err);
  }
}

export { pool, db };
export * from "./schema";
