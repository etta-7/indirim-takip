#!/usr/bin/env node
/**
 * Apply migrations/001_init.sql using POSTGRES_URL (psql-compatible connection string).
 * Requires: node 20+, POSTGRES_URL in env.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "..", "migrations", "001_init.sql");

const url = process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL is required");
  process.exit(1);
}

const sql = readFileSync(sqlPath, "utf8");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.log("Migration 001_init.sql applied.");
} finally {
  await client.end();
}
