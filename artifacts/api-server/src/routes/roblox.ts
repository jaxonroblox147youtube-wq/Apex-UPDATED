import { Router, type IRouter } from "express";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const router: IRouter = Router();

const ROBLOX_CLIENT_ID     = process.env["ROBLOX_CLIENT_ID"]     ?? "";
const ROBLOX_CLIENT_SECRET = process.env["ROBLOX_CLIENT_SECRET"] ?? "";
const ROBLOX_REDIRECT_URI  = process.env["ROBLOX_REDIRECT_URI"]  ??
  "https://discord-bot-script--jaxonmarshall98.replit.app/api/roblox/callback";

const TOKENS_FILE = path.resolve(import.meta.dirname, "../../../roblox_tokens.json");

function readTokens(): Record<string, { access_token: string; refresh_token: string; expires_at: number }> {
  if (!existsSync(TOKENS_FILE)) return {};
  try { return JSON.parse(readFileSync(TOKENS_FILE, "utf-8")); } catch { return {}; }
}

function saveTokens(data: object) {
  writeFileSync(TOKENS_FILE, JSON.stringify(data, null, 2));
}

// GET /api/roblox/callback — Roblox OAuth2 redirect handler
// The `state` param contains the Discord user ID so we can map the token to them.
router.get("/roblox/callback", async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };

  if (!code || !state) {
    res.status(400).send("Missing code or state from Roblox OAuth.");
    return;
  }

  if (!ROBLOX_CLIENT_ID || !ROBLOX_CLIENT_SECRET) {
    res.status(503).send("Roblox OAuth is not configured on this server.");
    return;
  }

  try {
    // Exchange auth code for access + refresh tokens
    const body = new URLSearchParams({
      grant_type:    "authorization_code",
      client_id:     ROBLOX_CLIENT_ID,
      client_secret: ROBLOX_CLIENT_SECRET,
      redirect_uri:  ROBLOX_REDIRECT_URI,
      code,
    });

    const tokenRes = await fetch("https://apis.roblox.com/oauth/v1/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    body.toString(),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      res.status(400).send(`Roblox token exchange failed: ${err}`);
      return;
    }

    const tokens = await tokenRes.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    // Store mapped to Discord user ID (state param)
    const all = readTokens();
    all[state] = {
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at:    Date.now() + tokens.expires_in * 1000,
    };
    saveTokens(all);

    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Roblox Linked!</title>
        <style>body{font-family:sans-serif;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:16px}</style>
        </head>
        <body>
          <h1>✅ Roblox Account Linked!</h1>
          <p>Your Roblox account has been connected to the Discord bot.</p>
          <p>You can now close this tab and use <code>/robloxme</code>, <code>/robloxannounce</code>, and <code>/robloxrole</code> in Discord.</p>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`Internal error: ${err}`);
  }
});

export default router;
