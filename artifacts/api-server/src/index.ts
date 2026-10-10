import fs from "node:fs";
import path from "node:path";

// Automatically load environment files if present
const possibleEnvPaths = [
  path.resolve(process.cwd(), "artifacts/api-server/.env"),
  path.resolve(process.cwd(), "artifacts/api-server/api.env"),
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

const server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
});

server.on("error", (err: any) => {
  if (err?.code === "EADDRINUSE") {
    logger.error(
      `Port ${port} is already in use. Run 'pnpm run clean:ports' in PowerShell to clear lingering processes.`
    );
  } else {
    logger.error({ err }, "Error listening on port");
  }
  process.exit(1);
});

