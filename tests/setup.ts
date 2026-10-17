import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import "dotenv/config";

// Tests never touch the dev database: use DATABASE_URL_TEST, or the same server's "blindspot_test" database.
const dev = process.env.DATABASE_URL ?? "";
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? dev.replace(/\/[^/?"]+(\?|$)/, "/blindspot_test$1");
process.env.STORAGE_LOCAL_DIR = mkdtempSync(path.join(tmpdir(), "bs-test-"));
