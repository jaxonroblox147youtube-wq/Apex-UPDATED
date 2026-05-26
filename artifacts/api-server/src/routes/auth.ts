import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const CLIENT_ID = "1507776524189827242";
const CLIENT_SECRET = process.env["DISCORD_CLIENT_SECRET"]!;
const REDIRECT_URI = process.env["DISCORD_REDIRECT_URI"] ||
  "https://discord-bot-script--jaxonmarshall98.replit.app/api/auth/callback";

const DISCORD_API = "https://discord.com/api/v10";

// GET /api/auth/login — redirect to Discord OAuth
router.get("/auth/login", (req, res) => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "identify guilds",
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

// GET /api/auth/callback — exchange code for token, store in session
router.get("/auth/callback", async (req, res) => {
  const { code } = req.query as { code?: string };
  if (!code) { res.redirect("/?error=no_code"); return; }

  try {
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      logger.error({ tokenData }, "Discord token exchange failed");
      res.redirect("/?error=token_failed");
      return;
    }

    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json() as { id: string; username: string; avatar?: string };

    (req.session as any).discordToken = tokenData.access_token;
    (req.session as any).user = { id: user.id, username: user.username, avatar: user.avatar };

    res.redirect("/dashboard");
  } catch (err) {
    logger.error({ err }, "OAuth callback error");
    res.redirect("/?error=oauth_error");
  }
});

// POST /api/auth/logout
router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// GET /api/auth/me — return current session user
router.get("/auth/me", (req, res) => {
  const user = (req.session as any).user;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  res.json(user);
});

// GET /api/auth/guilds — return guilds where user has MANAGE_GUILD and bot is present
router.get("/auth/guilds", async (req, res) => {
  const token = (req.session as any).discordToken;
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }

  try {
    const guildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const allGuilds = await guildsRes.json() as Array<{
      id: string; name: string; icon?: string; owner: boolean; permissions: string;
    }>;

    // Filter to guilds where user is admin/manager (bit 5 = MANAGE_GUILD, bit 3 = ADMINISTRATOR)
    const managed = allGuilds.filter((g) => {
      const perms = BigInt(g.permissions);
      return g.owner || (perms & BigInt(0x20)) !== BigInt(0) || (perms & BigInt(0x8)) !== BigInt(0);
    });

    // Fetch bot's guild list from Discord using bot token
    const botGuildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bot ${process.env["DISCORD_TOKEN"]}` },
    });
    const botGuilds = await botGuildsRes.json() as Array<{ id: string }>;
    const botGuildIds = new Set(botGuilds.map((g) => g.id));

    const result = managed.map((g) => ({
      ...g,
      bot_present: botGuildIds.has(g.id),
    }));

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Failed to fetch guilds");
    res.status(500).json({ error: "Failed to fetch guilds" });
  }
});

export default router;
