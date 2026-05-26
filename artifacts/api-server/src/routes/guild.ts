import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
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

type CmdEntry = { response: string; owner_only: boolean; created_at: string };
type CmdsFile = { [guildId: string]: { [cmdName: string]: CmdEntry } };

const DEFAULT_AUTOMOD = {
  word_filter: { enabled: false, words: [] as string[] },
  anti_spam: { enabled: false, max_messages: 5, window_seconds: 5 },
  anti_link: { enabled: false },
};
type AutomodSettings = typeof DEFAULT_AUTOMOD;
type AutomodFile = { [guildId: string]: AutomodSettings };

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req.session as any).user) { res.status(401).json({ error: "Not authenticated" }); return; }
  next();
}

async function requireGuildAccess(req: Request, res: Response, next: NextFunction) {
  const token = (req.session as any).discordToken as string | undefined;
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
  const guildId = req.params["guildId"] as string;
  try {
    const r = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const guilds = await r.json() as Array<{ id: string; owner: boolean; permissions: string }>;
    const guild = guilds.find((g) => g.id === guildId);
    if (!guild) { res.status(403).json({ error: "No access to this server" }); return; }
    const perms = BigInt(guild.permissions);
    if (!guild.owner && (perms & BigInt(0x20)) === BigInt(0) && (perms & BigInt(0x8)) === BigInt(0)) {
      res.status(403).json({ error: "Insufficient permissions" }); return;
    }
    next();
  } catch {
    res.status(500).json({ error: "Failed to verify guild access" });
  }
}

// ── Guild info ───────────────────────────────────────────────────────────────

router.get("/guilds/:guildId/info", requireAuth, requireGuildAccess, async (req, res) => {
  const guildId = req.params["guildId"] as string;
  const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}?with_counts=true`, {
    headers: { Authorization: `Bot ${process.env["DISCORD_TOKEN"]}` },
  });
  if (!r.ok) { res.status(404).json({ error: "Guild not found" }); return; }
  const guild = await r.json() as { id: string; name: string; icon?: string; approximate_member_count?: number };
  res.json({ id: guild.id, name: guild.name, icon: guild.icon, member_count: guild.approximate_member_count });
});

// ── Per-guild custom commands ─────────────────────────────────────────────────

router.get("/guilds/:guildId/commands", requireAuth, requireGuildAccess, (req, res) => {
  const guildId = req.params["guildId"] as string;
  const all = readJson<CmdsFile>("custom_commands.json", {});
  const cmds = all[guildId] ?? {};
  res.json(Object.entries(cmds).map(([name, v]) => ({
    name, response: v.response, owner_only: Boolean(v.owner_only), created_at: v.created_at,
  })));
});

router.post("/guilds/:guildId/commands", requireAuth, requireGuildAccess, (req, res) => {
  const guildId = req.params["guildId"] as string;
  const { name, response, owner_only = false } = req.body as { name?: string; response?: string; owner_only?: boolean };
  if (!name || !response) { res.status(400).json({ error: "name and response are required" }); return; }
  const clean = name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const all = readJson<CmdsFile>("custom_commands.json", {});
  if (!all[guildId]) all[guildId] = {};
  if (all[guildId][clean]) { res.status(409).json({ error: "Command already exists" }); return; }
  const entry: CmdEntry = { response, owner_only: Boolean(owner_only), created_at: new Date().toISOString() };
  all[guildId][clean] = entry;
  writeJson("custom_commands.json", all);
  res.status(201).json({ name: clean, ...entry });
});

router.delete("/guilds/:guildId/commands/:name", requireAuth, requireGuildAccess, (req, res) => {
  const guildId = req.params["guildId"] as string;
  const name = req.params["name"] as string;
  const all = readJson<CmdsFile>("custom_commands.json", {});
  if (!all[guildId]?.[name]) { res.status(404).json({ error: "Command not found" }); return; }
  delete all[guildId][name];
  writeJson("custom_commands.json", all);
  res.status(204).send();
});

// ── Per-guild automod ──────────────────────────────────────────────────────────

router.get("/guilds/:guildId/automod", requireAuth, requireGuildAccess, (req, res) => {
  const guildId = req.params["guildId"] as string;
  const all = readJson<AutomodFile>("automod_settings.json", {});
  res.json(all[guildId] ?? DEFAULT_AUTOMOD);
});

router.put("/guilds/:guildId/automod", requireAuth, requireGuildAccess, (req, res) => {
  const guildId = req.params["guildId"] as string;
  const all = readJson<AutomodFile>("automod_settings.json", {});
  all[guildId] = req.body as typeof DEFAULT_AUTOMOD;
  writeJson("automod_settings.json", all);
  res.json(req.body);
});

export default router;
