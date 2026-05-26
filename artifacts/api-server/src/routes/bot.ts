import { Router, type IRouter } from "express";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const router: IRouter = Router();

function dataPath(filename: string) {
  return path.resolve(import.meta.dirname, "../../../", filename);
}

function readJson<T>(filename: string, fallback: T): T {
  const p = dataPath(filename);
  if (!existsSync(p)) return fallback;
  try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return fallback; }
}

function writeJson(filename: string, data: unknown) {
  writeFileSync(dataPath(filename), JSON.stringify(data, null, 2));
}

const DEFAULT_AUTOMOD = {
  word_filter: { enabled: false, words: [] as string[] },
  anti_spam: { enabled: false, max_messages: 5, window_seconds: 5 },
  anti_link: { enabled: false },
};

// ── Stats ──────────────────────────────────────────────────────────────────

router.get("/bot/stats", (_req, res) => {
  const stats = readJson("bot_stats.json", {
    status: "starting",
    servers: 0,
    users: 0,
    latency_ms: 0,
    uptime_seconds: 0,
    command_count: 61,
    updated_at: new Date().toISOString(),
  });
  res.json(stats);
});

// ── Custom commands ────────────────────────────────────────────────────────

router.get("/bot/commands", (_req, res) => {
  const cmds = readJson<Record<string, { response: string; created_at: string }>>(
    "custom_commands.json", {}
  );
  const list = Object.entries(cmds).map(([name, v]) => ({
    name,
    response: v.response,
    owner_only: Boolean(v.owner_only),
    created_at: v.created_at,
  }));
  res.json(list);
});

router.post("/bot/commands", (req, res) => {
  const { name, response } = req.body as { name?: string; response?: string };
  if (!name || !response) {
    res.status(400).json({ error: "name and response are required" });
    return;
  }
  const { owner_only = false } = req.body as { name?: string; response?: string; owner_only?: boolean };
  const clean = name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const cmds = readJson<Record<string, { response: string; owner_only: boolean; created_at: string }>>(
    "custom_commands.json", {}
  );
  if (cmds[clean]) {
    res.status(409).json({ error: "Command already exists" });
    return;
  }
  cmds[clean] = { response, owner_only: Boolean(owner_only), created_at: new Date().toISOString() };
  writeJson("custom_commands.json", cmds);
  res.status(201).json({ name: clean, response, owner_only: cmds[clean].owner_only, created_at: cmds[clean].created_at });
});

router.delete("/bot/commands/:name", (req, res) => {
  const { name } = req.params;
  const cmds = readJson<Record<string, { response: string; owner_only: boolean; created_at: string }>>(
    "custom_commands.json", {}
  );
  if (!cmds[name]) {
    res.status(404).json({ error: "Command not found" });
    return;
  }
  delete cmds[name];
  writeJson("custom_commands.json", cmds);
  res.status(204).send();
});

// ── Automod ────────────────────────────────────────────────────────────────

router.get("/bot/automod", (_req, res) => {
  res.json(readJson("automod_settings.json", DEFAULT_AUTOMOD));
});

router.put("/bot/automod", (req, res) => {
  const settings = req.body;
  writeJson("automod_settings.json", settings);
  res.json(settings);
});

export default router;
