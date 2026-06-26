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

// GET /api/roblox/linked/:discordId — bot calls this to check if a user has linked
router.get("/roblox/linked/:discordId", (req, res) => {
  const { discordId } = req.params;
  const all = readTokens();
  const entry = all[discordId];
  if (!entry) {
    res.json({ linked: false });
    return;
  }
  res.json({ linked: true, access_token: entry.access_token, expires_at: entry.expires_at });
});

// DELETE /api/roblox/linked/:discordId — unlink a Roblox account
router.delete("/roblox/linked/:discordId", (req, res) => {
  const { discordId } = req.params;
  const all = readTokens();
  if (all[discordId]) {
    delete all[discordId];
    saveTokens(all);
    res.json({ unlinked: true });
  } else {
    res.json({ unlinked: false });
  }
});

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

// GET /api/privacy
router.get("/privacy", (_req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>Privacy Policy — Apex Bot</title>
<style>body{font-family:sans-serif;max-width:700px;margin:60px auto;padding:0 20px;background:#111;color:#ccc;line-height:1.7}h1,h2{color:#fff}a{color:#5865f2}</style>
</head><body>
<h1>Privacy Policy</h1>
<p><strong>Last updated:</strong> June 2025</p>
<p>Apex Bot ("the Bot") is a Discord bot that integrates with Roblox. This policy explains what data we collect and how it is used.</p>
<h2>Data We Collect</h2>
<ul>
  <li><strong>Discord User IDs</strong> — used to link your Discord account to your Roblox account.</li>
  <li><strong>Roblox OAuth Tokens</strong> — stored locally on the server to perform actions on your behalf (group announcements, role management) only when you use the relevant commands.</li>
  <li><strong>Guild (Server) Settings</strong> — automod rules, custom commands, and YouTube notification preferences set by server administrators.</li>
</ul>
<h2>Data We Do Not Collect</h2>
<p>We do not collect message content, passwords, payment information, or any personal information beyond what is listed above.</p>
<h2>Data Sharing</h2>
<p>We do not sell, share, or transmit your data to any third parties. Data is only used to power the Bot's features within your Discord server.</p>
<h2>Data Deletion</h2>
<p>You can unlink your Roblox account at any time using <code>/robloxunlink</code> in Discord, which removes your stored tokens immediately.</p>
<h2>Contact</h2>
<p>For questions, contact the bot owner via Discord.</p>
</body></html>`);
});

// GET /api/terms
router.get("/terms", (_req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>Terms of Service — Apex Bot</title>
<style>body{font-family:sans-serif;max-width:700px;margin:60px auto;padding:0 20px;background:#111;color:#ccc;line-height:1.7}h1,h2{color:#fff}a{color:#5865f2}</style>
</head><body>
<h1>Terms of Service</h1>
<p><strong>Last updated:</strong> June 2025</p>
<p>By using Apex Bot ("the Bot"), you agree to the following terms.</p>
<h2>Acceptable Use</h2>
<ul>
  <li>You must comply with <a href="https://discord.com/terms" target="_blank">Discord's Terms of Service</a> and <a href="https://en.help.roblox.com/hc/en-us/articles/115004647846" target="_blank">Roblox's Terms of Use</a>.</li>
  <li>You may not use the Bot for harassment, spam, or any illegal activity.</li>
  <li>Server administrators are responsible for configuring the Bot appropriately for their community.</li>
</ul>
<h2>Roblox Integration</h2>
<p>By authorizing the Bot with your Roblox account, you grant it permission to perform actions you explicitly request (such as group announcements and role assignments). You may revoke this access at any time.</p>
<h2>Availability</h2>
<p>The Bot is provided "as-is" with no uptime guarantees. We reserve the right to modify or discontinue features at any time.</p>
<h2>Limitation of Liability</h2>
<p>The Bot owner is not liable for any damages resulting from the use or inability to use the Bot.</p>
<h2>Contact</h2>
<p>For questions or concerns, contact the bot owner via Discord.</p>
</body></html>`);
});

export default router;
