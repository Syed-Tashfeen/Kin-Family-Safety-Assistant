import fs from "node:fs";
import path from "node:path";

// Automatically load environment files if present
const possibleEnvPaths = [
  path.resolve(process.cwd(), "api.env"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(import.meta.dirname, "../api.env"),
  path.resolve(import.meta.dirname, "../.env"),
  path.resolve(process.cwd(), "../../api.env"),
  path.resolve(process.cwd(), "../../.env"),
];

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch {}
  }
}

import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] || "5000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
