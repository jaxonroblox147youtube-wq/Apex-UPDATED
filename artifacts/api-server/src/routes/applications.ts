import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const router: IRouter = Router();
const APPLICATIONS_FILE = path.resolve(import.meta.dirname, "../../../applications.json");
const DISCORD_API = "https://discord.com/api/v10";
const APPLICATION_ID = "1507776524189827242";

type Question = { id: string; text: string };
type ApplicationForm = {
  id: string;
  name: string;
  questions: Question[];
  publish_channel_id?: string;
  results_channel_id?: string;
  created_at: string;
};
type ApplicationFile = { [guildId: string]: ApplicationForm[] };

function readApplications(): ApplicationFile {
  if (!existsSync(APPLICATIONS_FILE)) return {};
  try { return JSON.parse(readFileSync(APPLICATIONS_FILE, "utf-8")); } catch { return {}; }
}

function writeApplications(data: ApplicationFile) {
  writeFileSync(APPLICATIONS_FILE, JSON.stringify(data, null, 2));
}

async function publishApplication(channelId: string, form: ApplicationForm) {
  const embed = {
    title: `📝 ${form.name}`,
    description: "Click **Apply** below and answer every Yes/No question to submit your application.",
    color: 0x5865f2,
    fields: form.questions.map((question, index) => ({
      name: `Question ${index + 1}`,
      value: question.text,
      inline: false,
    })),
  };
  const response = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${process.env["DISCORD_TOKEN"]}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      embeds: [embed],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 1,
          label: "Apply",
          emoji: { name: "📝" },
          custom_id: `application_apply:${form.id}`,
        }],
      }],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Discord rejected the panel (${response.status}): ${detail.slice(0, 200)}`);
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req.session as any).user) { res.status(401).json({ error: "Not authenticated" }); return; }
  next();
}

async function requireGuildAccess(req: Request, res: Response, next: NextFunction) {
  const token = (req.session as any).discordToken as string | undefined;
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
  try {
    const r = await fetch(`${DISCORD_API}/users/@me/guilds`, { headers: { Authorization: `Bearer ${token}` } });
    const guilds = await r.json() as Array<{ id: string; owner: boolean; permissions: string }>;
    const guild = guilds.find((g) => g.id === req.params["guildId"]);
    if (!guild) { res.status(403).json({ error: "No access to this server" }); return; }
    const perms = BigInt(guild.permissions);
    if (!guild.owner && (perms & BigInt(0x20)) === BigInt(0) && (perms & BigInt(0x8)) === BigInt(0)) {
      res.status(403).json({ error: "Insufficient permissions" }); return;
    }
    next();
  } catch { res.status(500).json({ error: "Failed to verify guild access" }); }
}

router.get("/guilds/:guildId/channels", requireAuth, requireGuildAccess, async (req, res) => {
  const r = await fetch(`${DISCORD_API}/guilds/${req.params["guildId"]}/channels`, {
    headers: { Authorization: `Bot ${process.env["DISCORD_TOKEN"]}` },
  });
  if (!r.ok) { res.status(502).json({ error: "Unable to load Discord channels" }); return; }
  const channels = await r.json() as Array<{ id: string; name: string; type: number; position: number }>;
  res.json(channels.filter((c) => c.type === 0).sort((a, b) => a.position - b.position));
});

router.get("/guilds/:guildId/applications", requireAuth, requireGuildAccess, (req, res) => {
  res.json(readApplications()[req.params["guildId"]!] ?? []);
});

router.post("/guilds/:guildId/applications", requireAuth, requireGuildAccess, async (req, res) => {
  const { name, questions, publish_channel_id, results_channel_id } = req.body as {
    name?: string; questions?: Array<{ text?: string }>; publish_channel_id?: string; results_channel_id?: string;
  };
  const cleanName = name?.trim();
  const cleanQuestions = questions?.map((q, index) => ({
    id: `q${index + 1}`,
    text: q.text?.trim() ?? "",
  })).filter((q) => q.text).slice(0, 5);
  if (!cleanName || !cleanQuestions?.length) {
    res.status(400).json({ error: "A name and at least one question are required" }); return;
  }
  const all = readApplications();
  const guildId = req.params["guildId"]!;
  const forms = all[guildId] ?? [];
  if (forms.some((f) => f.name.toLowerCase() === cleanName.toLowerCase())) {
    res.status(409).json({ error: "An application with that name already exists" }); return;
  }
  const form: ApplicationForm = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: cleanName,
    questions: cleanQuestions,
    publish_channel_id,
    results_channel_id,
    created_at: new Date().toISOString(),
  };
  all[guildId] = [...forms, form];
  writeApplications(all);
  if (form.publish_channel_id) {
    try {
      await publishApplication(form.publish_channel_id, form);
    } catch (error) {
      res.status(502).json({
        error: "Application was saved, but Discord rejected the panel. Check the bot's Send Messages and Embed Links permissions in that channel.",
        detail: error instanceof Error ? error.message : "Discord publish failed",
      });
      return;
    }
  }
  res.status(201).json(form);
});

router.patch("/guilds/:guildId/applications/:applicationId", requireAuth, requireGuildAccess, (req, res) => {
  const all = readApplications();
  const forms = all[req.params["guildId"]!] ?? [];
  const form = forms.find((f) => f.id === req.params["applicationId"]);
  if (!form) { res.status(404).json({ error: "Application not found" }); return; }
  const body = req.body as Partial<ApplicationForm> & { questions?: Array<{ text?: string }> };
  if (body.name?.trim()) form.name = body.name.trim();
  if (body.questions) form.questions = body.questions.map((q, i) => ({ id: `q${i + 1}`, text: q.text?.trim() ?? "" })).filter((q) => q.text).slice(0, 5);
  if (body.publish_channel_id !== undefined) form.publish_channel_id = body.publish_channel_id;
  if (body.results_channel_id !== undefined) form.results_channel_id = body.results_channel_id;
  writeApplications(all);
  res.json(form);
});

router.post("/guilds/:guildId/applications/:applicationId/publish", requireAuth, requireGuildAccess, async (req, res) => {
  const forms = readApplications()[req.params["guildId"]!] ?? [];
  const form = forms.find((item) => item.id === req.params["applicationId"]);
  if (!form) { res.status(404).json({ error: "Application not found" }); return; }
  const channelId = (req.body as { channel_id?: string }).channel_id || form.publish_channel_id;
  if (!channelId) { res.status(400).json({ error: "Choose a publish channel first" }); return; }
  try {
    await publishApplication(channelId, form);
    res.json({ ok: true, channel_id: channelId });
  } catch (error) {
    res.status(502).json({
      error: "Discord rejected the panel. Check the bot's Send Messages and Embed Links permissions in that channel.",
      detail: error instanceof Error ? error.message : "Discord publish failed",
    });
  }
});

router.delete("/guilds/:guildId/applications/:applicationId", requireAuth, requireGuildAccess, (req, res) => {
  const all = readApplications();
  const guildId = req.params["guildId"]!;
  const forms = all[guildId] ?? [];
  if (!forms.some((f) => f.id === req.params["applicationId"])) { res.status(404).json({ error: "Application not found" }); return; }
  all[guildId] = forms.filter((f) => f.id !== req.params["applicationId"]);
  writeApplications(all);
  res.status(204).send();
});

export default router;