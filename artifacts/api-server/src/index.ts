import app from "./app";
import { logger } from "./lib/logger";
import { spawn } from "child_process";
import path from "path";

function startDiscordBot() {
  // Built file lives at artifacts/api-server/dist/index.mjs → 3 levels up = workspace root
  const botPath = path.resolve(import.meta.dirname, "../../../discord_bot.py");
  const child = spawn("python", [botPath], {
    stdio: "inherit",
    env: { ...process.env, APEX_MANAGED_BY_API: "1" },
  });
  child.on("exit", (code) => {
    logger.warn({ code }, "Discord bot exited — restarting in 5s");
    setTimeout(startDiscordBot, 5000);
  });
  child.on("error", (err) => {
    logger.error({ err }, "Discord bot process error");
    setTimeout(startDiscordBot, 5000);
  });
  logger.info("Discord bot process started");
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

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
  startDiscordBot();
});
