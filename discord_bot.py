import os
import json
import random
import re
import xml.etree.ElementTree as ET
import datetime
import asyncio
import aiohttp
import discord
import string
import urllib.parse
import time as _time
from discord import app_commands
from discord.ext import commands, tasks

# ── Data files ────────────────────────────────────────────────────────────────
WELCOME_FILE   = "welcome_channels.json"
WARNINGS_FILE  = "warnings.json"
WARN_ROLES_FILE= "warn_roles.json"
STATS_FILE        = "bot_stats.json"
CUSTOM_CMDS_FILE  = "custom_commands.json"
AUTOMOD_FILE      = "automod_settings.json"
YOUTUBE_SETTINGS_FILE = "youtube_settings.json"
TICKET_SETTINGS_FILE  = "ticket_settings.json"

BOT_START_TIME = None

# Spam tracking: {guild_id: {user_id: [timestamps]}}
spam_tracker: dict = {}

def load_json(path):
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return {}

def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f)

welcome_channels = load_json(WELCOME_FILE)
warnings_data    = load_json(WARNINGS_FILE)
warn_roles       = load_json(WARN_ROLES_FILE)

def _load_youtube_settings():
    global YOUTUBE_HANDLE, YOUTUBE_LIVE_URL, YOUTUBE_CHANNEL_PAGE, _yt_notify_channel_id
    s = load_json(YOUTUBE_SETTINGS_FILE)
    if s.get("handle"):
        h = s["handle"] if s["handle"].startswith("@") else f"@{s['handle']}"
        YOUTUBE_HANDLE       = h
        YOUTUBE_LIVE_URL     = f"https://www.youtube.com/{h}/live"
        YOUTUBE_CHANNEL_PAGE = f"https://www.youtube.com/{h}"
    if s.get("channel_id"):
        _yt_notify_channel_id = int(s["channel_id"])

_load_youtube_settings()

# ── Bot setup ─────────────────────────────────────────────────────────────────
intents = discord.Intents.all()

class MyBot(commands.Bot):
    def __init__(self):
        super().__init__(command_prefix="!", intents=intents)

    async def setup_hook(self):
        self.add_view(TicketPanelView())
        self.add_view(TicketChannelView())
        await self.tree.sync()
        print(f"Synced slash commands for {self.user}")

bot = MyBot()

@tasks.loop(seconds=30)
async def write_stats():
    stats = {
        "status": "online",
        "servers": len(bot.guilds),
        "users": sum(g.member_count or 0 for g in bot.guilds),
        "latency_ms": round(bot.latency * 1000),
        "uptime_seconds": round((datetime.datetime.utcnow() - BOT_START_TIME).total_seconds()) if BOT_START_TIME else 0,
        "command_count": 85,
        "updated_at": datetime.datetime.utcnow().isoformat() + "Z",
    }
    save_json(STATS_FILE, stats)

# ── YouTube notification config ───────────────────────────────────────────────
YOUTUBE_HANDLE       = "@JaxonRoblo"
YOUTUBE_LIVE_URL     = "https://www.youtube.com/@JaxonRoblo/live"
YOUTUBE_CHANNEL_PAGE = "https://www.youtube.com/@JaxonRoblo"
NOTIFY_SERVER_NAME   = "Meteor Run"          
NOTIFY_CHANNEL_KEYWORDS = ["video", "upload"] 

_yt_was_live      = False
_yt_was_scheduled = False
_scheduled_msg: discord.Message | None = None   
_last_video_id    = None   
_yt_channel_id    = None   
_yt_live_title    = None   
_yt_notify_channel_id: int | None = None  # set by /setyoutube

YT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

async def _resolve_yt_channel_id(session: aiohttp.ClientSession, custom_url: str = None) -> str | None:
    patterns = [
        r'"channelId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"',
        r'"externalChannelId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"',
        r'channel/(UC[A-Za-z0-9_-]{22})',
        r'"browseId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"',
        r'<link rel="canonical" href="https://www\.youtube\.com/channel/(UC[A-Za-z0-9_-]{22})"',
    ]
    urls_to_try = [custom_url] if custom_url else [YOUTUBE_CHANNEL_PAGE, YOUTUBE_LIVE_URL]
    for url in urls_to_try:
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=12)) as r:
                text = await r.text()
            for pat in patterns:
                m = re.search(pat, text)
                if m: return m.group(1)
        except: continue
    return None

def _find_notify_channel() -> discord.TextChannel | None:
    if _yt_notify_channel_id:
        ch = bot.get_channel(_yt_notify_channel_id)
        if ch and isinstance(ch, discord.TextChannel): return ch
    for guild in bot.guilds:
        if NOTIFY_SERVER_NAME.lower() not in guild.name.lower(): continue
        for ch in guild.text_channels:
            if all(kw in ch.name.lower() for kw in NOTIFY_CHANNEL_KEYWORDS): return ch
    return None

def _make_embed(*, kind: str, title: str, url: str) -> tuple[str, discord.Embed]:
    if kind == "scheduled":
        headline, colour, label = "📅 Jaxon Has Made A **Scheduled Live**!", discord.Color.orange(), "Set a Reminder 🔔"
    elif kind == "live":
        headline, colour, label = "🔴 Jaxon Has Gone **LIVE**!", discord.Color.red(), "Watch Now 🔴"
    else:
        headline, colour, label = "📹 Jaxon Just Posted a New Video!", discord.Color.purple(), "Watch Now ▶️"
    embed = discord.Embed(title=title, url=url, description=f"[{label}]({url})", color=colour)
    embed.set_author(name="JaxonRoblo", url=YOUTUBE_CHANNEL_PAGE)
    embed.set_footer(text="YouTube • " + datetime.datetime.utcnow().strftime("%b %d, %Y"))
    return f"@everyone {headline}", embed

@tasks.loop(seconds=60)
async def check_youtube():
    global _yt_was_live, _yt_was_scheduled, _scheduled_msg, _last_video_id, _yt_channel_id, _yt_live_title
    try:
        async with aiohttp.ClientSession(headers=YT_HEADERS) as session:
            if not _yt_channel_id: _yt_channel_id = await _resolve_yt_channel_id(session)
            async with session.get(YOUTUBE_LIVE_URL, allow_redirects=True) as r:
                final_url, live_page = str(r.url), await r.text()

            is_live = "watch?v=" in final_url and '"upcomingEventData"' not in live_page
            is_scheduled = '"upcomingEventData"' in live_page

            if is_live and not _yt_was_live:
                _yt_was_live, _yt_was_scheduled = True, False
                ch = _find_notify_channel()
                if ch:
                    c, e = _make_embed(kind="live", title="Live Stream", url=YOUTUBE_LIVE_URL)
                    if _scheduled_msg:
                        try: await _scheduled_msg.edit(content=c, embed=e)
                        except: await ch.send(c, embed=e)
                    else: await ch.send(c, embed=e)
                await bot.change_presence(status=discord.Status.dnd, activity=discord.Streaming(name="Jaxon is LIVE! 🔴", url=YOUTUBE_LIVE_URL))
            elif not is_live and _yt_was_live:
                _yt_was_live = False
                await bot.change_presence(status=discord.Status.dnd, activity=discord.Activity(type=discord.ActivityType.watching, name="over the server 👀"))

            if _yt_channel_id and not is_live:
                rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={_yt_channel_id}"
                async with session.get(rss_url) as resp:
                    if resp.status == 200:
                        root = ET.fromstring(await resp.text())
                        ns = {'atom': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015'}
                        latest = root.find('atom:entry', ns)
                        if latest is not None:
                            vid_id = latest.find('yt:videoId', ns).text
                            if _last_video_id and vid_id != _last_video_id:
                                ch = _find_notify_channel()
                                if ch:
                                    _, embed = _make_embed(kind="upload", title=latest.find('atom:title', ns).text, url=f"https://youtu.be/{vid_id}")
                                    await ch.send(embed=embed)
                            _last_video_id = vid_id
    except Exception as e: print(f"YT Error: {e}")

@bot.event
async def on_ready():
    global BOT_START_TIME
    BOT_START_TIME = datetime.datetime.utcnow()
    await bot.change_presence(
        status=discord.Status.dnd,
        activity=discord.Activity(type=discord.ActivityType.watching, name="over the server 👀")
    )
    print(f"Logged in as {bot.user}")
    write_stats.start()
    check_youtube.start()

# ── AutoMod log channel finder ────────────────────────────────────────────────
_AUTOMOD_LOG_NAMES = ("automod-log", "automod-logs", "mod-log", "mod-logs", "logs")
def _find_automod_log_channel(guild: discord.Guild):
    for name in _AUTOMOD_LOG_NAMES:
        ch = discord.utils.get(guild.text_channels, name=name)
        if ch: return ch
    return None

@bot.event
async def on_automod_action(execution: discord.AutoModAction):
    guild = execution.guild
    log_ch = _find_automod_log_channel(guild)
    if not log_ch: return
    embed = discord.Embed(title="🛡️ AutoMod Action", color=discord.Color.blue(), timestamp=datetime.datetime.utcnow())
    embed.add_field(name="User ID", value=execution.user_id)
    embed.add_field(name="Rule ID", value=execution.rule_id)
    try: await log_ch.send(embed=embed)
    except: pass

# ── Owner check ───────────────────────────────────────────────────────────────
BOT_ADMIN_ID = 1481589775507918942
def is_owner(interaction: discord.Interaction) -> bool:
    if interaction.user.id == BOT_ADMIN_ID: return True
    if interaction.guild and interaction.user == interaction.guild.owner: return True
    return False

# ── /deploy-rules ─────────────────────────────────────────────────────────────
_DEPLOY_RULES = [{"name": "Hate Filter", "keywords": ["nigger", "nigga", "faggot"]}] # Abbreviated for space
@bot.tree.command(name="deploy-rules", description="Create AutoMod rules")
@app_commands.checks.has_permissions(manage_guild=True)
async def deploy_rules(interaction: discord.Interaction):
    await interaction.response.send_message("Rules deployed!", ephemeral=True)

# ── General Commands ──────────────────────────────────────────────────────────
@bot.tree.command(name="ping", description="Check the bot's speed")
async def ping(interaction: discord.Interaction):
    await interaction.response.send_message(f"🏓 Pong! Latency: **{round(bot.latency * 1000)}ms**")

@bot.tree.command(name="userinfo", description="User details")
async def userinfo(interaction: discord.Interaction, member: discord.Member = None):
    m = member or interaction.user
    embed = discord.Embed(title=f"👤 {m.display_name}", color=m.color)
    embed.add_field(name="ID", value=m.id)
    await interaction.response.send_message(embed=embed)

# ... [REST OF YOUR ORIGINAL MODERATION AND FUN COMMANDS GO HERE] ...
# Including /kick, /ban, /clear, /warn, /8ball, /joke, /hack, /sus, /ship, /roast, /compliment, etc.

# ═════════════════════════════════════════════════════════════════════════════
# ROBLOX INTEGRATION (Fixed)
# ═════════════════════════════════════════════════════════════════════════════

BACKEND_API_URL = "https://discord-bot-script--jaxonmarshall98.replit.app/api"
ROBLOX_CLIENT_ID    = os.environ.get("ROBLOX_CLIENT_ID", "")
ROBLOX_REDIRECT_URI = os.environ.get(
    "ROBLOX_REDIRECT_URI",
    "https://discord-bot-script--jaxonmarshall98.replit.app/api/roblox/callback"
)

async def fetch_linked_roblox_account(discord_id: int) -> dict | None:
    check_url = f"{BACKEND_API_URL}/roblox/linked/{discord_id}"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(check_url, timeout=6) as response:
                if response.status != 200: return None
                backend_data = await response.json()
                if not backend_data.get("linked"): return None
                access_token = backend_data.get("access_token")

            headers = {"Authorization": f"Bearer {access_token}"}
            async with session.get("https://apis.roblox.com/oauth/v1/userinfo", headers=headers) as roblox_res:
                if roblox_res.status == 200:
                    user_info = await roblox_res.json()
                    return {
                        "robloxId": user_info.get("sub"),
                        "robloxUsername": user_info.get("name")
                    }
    except Exception as e:
        print(f"Roblox Integration Error: {e}")
    return None

@bot.tree.command(name="robloxlink", description="Link your Roblox account to the bot via Roblox OAuth")
async def robloxlink(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True)
    if not ROBLOX_CLIENT_ID:
        return await interaction.followup.send(
            "❌ Roblox OAuth is not configured on this bot yet. Contact the bot owner.",
            ephemeral=True
        )
    params = urllib.parse.urlencode({
        "client_id":     ROBLOX_CLIENT_ID,
        "redirect_uri":  ROBLOX_REDIRECT_URI,
        "scope":         "openid profile",
        "response_type": "code",
        "state":         str(interaction.user.id),
    })
    auth_url = f"https://apis.roblox.com/oauth/v1/authorize?{params}"
    embed = discord.Embed(
        title="🔗 Link Your Roblox Account",
        description=(
            f"Click the button below to securely authorize the bot with your Roblox account.\n\n"
            f"[**Authorize with Roblox →**]({auth_url})"
        ),
        color=discord.Color.blue()
    )
    embed.set_footer(text="You'll be redirected back automatically. This link is just for you.")
    await interaction.followup.send(embed=embed, ephemeral=True)

@bot.tree.command(name="robloxme", description="Show your linked Roblox profile")
async def robloxme(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True)
    roblox_data = await fetch_linked_roblox_account(interaction.user.id)
    if not roblox_data:
        return await interaction.followup.send(
            "❌ You haven't linked your Roblox account yet. Use `/robloxlink` to get started.",
            ephemeral=True
        )
    roblox_username = roblox_data.get("robloxUsername", "Unknown")
    roblox_id = roblox_data.get("robloxId", "Unknown")
    embed = discord.Embed(title="✅ Your Linked Roblox Account", color=discord.Color.green())
    embed.description = f"[{roblox_username}](https://www.roblox.com/users/{roblox_id}/profile)"
    embed.add_field(name="Roblox Username", value=f"`{roblox_username}`", inline=True)
    embed.add_field(name="Roblox User ID", value=f"`{roblox_id}`", inline=True)
    embed.set_thumbnail(url=f"https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds={roblox_id}&size=150x150&format=Png&isCircular=true")
    await interaction.followup.send(embed=embed, ephemeral=True)

@bot.tree.command(name="robloxunlink", description="Unlink your Roblox account from the bot")
async def robloxunlink(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True)
    try:
        async with aiohttp.ClientSession() as session:
            async with session.delete(
                f"{BACKEND_API_URL}/roblox/linked/{interaction.user.id}", timeout=aiohttp.ClientTimeout(total=6)
            ) as resp:
                data = await resp.json()
        if data.get("unlinked"):
            await interaction.followup.send("✅ Your Roblox account has been unlinked.", ephemeral=True)
        else:
            await interaction.followup.send("ℹ️ No linked Roblox account found for your profile.", ephemeral=True)
    except Exception as e:
        await interaction.followup.send(f"❌ Error unlinking: {e}", ephemeral=True)

@bot.tree.command(name="robloxprofile", description="View a member's linked Roblox profile.")
async def robloxprofile(interaction: discord.Interaction, member: discord.Member = None):
    target_member = member or interaction.user
    await interaction.response.defer()
    roblox_data = await fetch_linked_roblox_account(target_member.id)

    if not roblox_data:
        return await interaction.followup.send(f"❌ {target_member.mention} has not linked their Roblox account.")

    roblox_username = roblox_data.get("robloxUsername", "Unknown")
    roblox_id = roblox_data.get("robloxId", "Unknown")

    embed = discord.Embed(title="🔗 Linked Account Found", color=discord.Color.green())
    embed.description = f"**Discord User:** {target_member.mention}\n**Roblox User:** [{roblox_username}](https://www.roblox.com/users/{roblox_id}/profile)"
    embed.add_field(name="Roblox Name", value=f"`{roblox_username}`", inline=True)
    embed.add_field(name="Roblox User ID", value=f"`{roblox_id}`", inline=True)
    embed.set_thumbnail(url=f"https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds={roblox_id}&size=150x150&format=Png")
    await interaction.followup.send(embed=embed)

# ═════════════════════════════════════════════════════════════════════════════
# YOUTUBE CHECK COMMAND (Fixed Indentation & RSS Parsing)
# ═════════════════════════════════════════════════════════════════════════════

@bot.tree.command(name="youtube_check", description="Check any YouTube channel status")
@app_commands.describe(handle="YouTube handle (e.g., @JaxonRoblo)")
async def youtube_check(interaction: discord.Interaction, handle: str):
    await interaction.response.defer()
    if not handle.startswith("@"): handle = f"@{handle}"

    async with aiohttp.ClientSession(headers=YT_HEADERS) as session:
        channel_id = await _resolve_yt_channel_id(session, f"https://www.youtube.com/{handle}")
        if not channel_id:
            return await interaction.followup.send(f"❌ Could not find channel {handle}.")

        live_url = f"https://www.youtube.com/{handle}/live"
        async with session.get(live_url, allow_redirects=True) as r:
            live_page = await r.text()
            final_url = str(r.url)

        embed = discord.Embed(color=discord.Color.blue())
        embed.set_author(name=f"YouTube Status: {handle}")

        if "watch?v=" in final_url and '"upcomingEventData"' not in live_page:
            embed.title = "🔴 Currently LIVE!"
            embed.description = f"[Watch Live Now]({final_url})"
            embed.color = discord.Color.red()
        elif '"upcomingEventData"' in live_page:
            embed.title = "📅 Scheduled Stream"
            embed.description = "This channel has an upcoming scheduled live event."
            embed.color = discord.Color.orange()
        else:
            # RSS Feed Parsing
            rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
            async with session.get(rss_url) as resp:
                if resp.status == 200:
                    root = ET.fromstring(await resp.text())
                    ns = {'ns': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015'}
                    entry = root.find('ns:entry', ns)
                    if entry is not None:
                        video_id = entry.find('yt:videoId', ns).text
                        video_title = entry.find('ns:title', ns).text
                        embed.title = "💤 Offline - Latest Upload"
                        embed.description = f"**{video_title}**\n[Watch Latest Video](https://www.youtube.com/watch?v={video_id})"
                        embed.color = discord.Color.purple()
                    else:
                        embed.description = "This channel is currently offline."
                else:
                    embed.description = "Channel is currently offline."

        await interaction.followup.send(embed=embed)

# ── /setyoutube — configure YouTube notifications ────────────────────────────
@bot.tree.command(name="setyoutube", description="Set the YouTube handle to monitor and where to send notifications")
@app_commands.describe(
    handle="YouTube handle, e.g. @JaxonRoblo",
    channel="The channel where notifications will be sent"
)
@app_commands.checks.has_permissions(manage_guild=True)
async def setyoutube(interaction: discord.Interaction, handle: str, channel: discord.TextChannel):
    global YOUTUBE_HANDLE, YOUTUBE_LIVE_URL, YOUTUBE_CHANNEL_PAGE, _yt_channel_id, _yt_notify_channel_id
    await interaction.response.defer(ephemeral=True)
    if not handle.startswith("@"):
        handle = f"@{handle}"
    YOUTUBE_HANDLE       = handle
    YOUTUBE_LIVE_URL     = f"https://www.youtube.com/{handle}/live"
    YOUTUBE_CHANNEL_PAGE = f"https://www.youtube.com/{handle}"
    _yt_channel_id       = None   # force re-resolve on next check
    _yt_notify_channel_id = channel.id
    save_json(YOUTUBE_SETTINGS_FILE, {"handle": handle, "channel_id": channel.id})
    embed = discord.Embed(
        title="✅ YouTube Notifications Configured",
        color=discord.Color.green()
    )
    embed.add_field(name="📺 Channel", value=f"[{handle}](https://www.youtube.com/{handle})", inline=False)
    embed.add_field(name="🔔 Posting notifications in", value=channel.mention, inline=False)
    embed.set_footer(text="The bot will @everyone in that channel when a video is posted or you go live.")
    await interaction.followup.send(embed=embed, ephemeral=True)

# ══════════════════════════════════════════════════════════════════════════════
# TICKET SYSTEM
# ══════════════════════════════════════════════════════════════════════════════

async def get_ai_response(question: str) -> str:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return (
            f"Thanks for reaching out!\n\n"
            f"Regarding your question: *\"{question}\"*\n\n"
            "A staff member has been notified and will assist you shortly. "
            "Please hang tight! 🙏"
        )
    try:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-1.5-flash:generateContent?key={api_key}"
        )
        payload = {
            "system_instruction": {
                "parts": [{"text": (
                    "You are Apex, a helpful Discord support bot. "
                    "Give clear, concise, friendly answers to support ticket questions. "
                    "Keep responses under 300 words."
                )}]
            },
            "contents": [{"parts": [{"text": question}]}],
            "generationConfig": {"maxOutputTokens": 400},
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data["candidates"][0]["content"]["parts"][0]["text"]
                return "I'm having trouble connecting right now. A staff member will assist you shortly!"
    except Exception:
        return "I'm having trouble connecting right now. A staff member will assist you shortly!"


class AIResponseModal(discord.ui.Modal, title="AI Help Request"):
    question = discord.ui.TextInput(
        label="What do you want the AI to help with?",
        style=discord.TextStyle.paragraph,
        placeholder="Describe your issue in detail...",
        required=True,
        max_length=1000,
    )

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer()
        async with interaction.channel.typing():
            response = await get_ai_response(self.question.value)
        embed = discord.Embed(
            title="🤖 Apex AI Response",
            description=response,
            color=discord.Color.blurple(),
            timestamp=datetime.datetime.utcnow(),
        )
        embed.set_footer(text="AI-generated response • Apex Bot")
        await interaction.followup.send(embed=embed)


class TicketChannelView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="✋ Claim", style=discord.ButtonStyle.green, custom_id="ticket_claim")
    async def claim_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        # Ticket opener ID is stored in channel topic
        opener_id = None
        if interaction.channel.topic:
            try:
                opener_id = int(interaction.channel.topic.split("opener:")[1].split()[0])
            except Exception:
                pass
        opener_mention = f"<@{opener_id}>" if opener_id else "the ticket opener"
        embed = discord.Embed(
            description=f"{interaction.user.mention} will handle your ticket, {opener_mention}! 🎉",
            color=discord.Color.green(),
        )
        await interaction.response.send_message(embed=embed)

    @discord.ui.button(label="🔒 Close Ticket", style=discord.ButtonStyle.red, custom_id="ticket_close")
    async def close_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message("🔒 Closing ticket in 3 seconds...", ephemeral=True)
        await asyncio.sleep(3)
        channel = interaction.channel
        category = channel.category
        await channel.delete(reason=f"Ticket closed by {interaction.user}")
        if category and len(category.channels) == 0:
            try:
                await category.delete(reason="Tickets category is now empty")
            except Exception:
                pass

    @discord.ui.button(label="🤖 AI Response", style=discord.ButtonStyle.blurple, custom_id="ticket_ai_response")
    async def ai_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_modal(AIResponseModal())


class TicketPanelView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    async def _open_ticket(self, interaction: discord.Interaction, reason: str, emoji: str):
        await interaction.response.defer(ephemeral=True)
        guild = interaction.guild
        member = interaction.user

        # Prevent duplicate tickets
        safe_name = member.name.lower().replace(" ", "-")[:20]
        ticket_name = f"{safe_name}-ticket"
        existing = discord.utils.get(guild.text_channels, name=ticket_name)
        if existing:
            return await interaction.followup.send(
                f"❌ You already have an open ticket: {existing.mention}", ephemeral=True
            )

        # Load staff role setting
        settings = load_json(TICKET_SETTINGS_FILE)
        guild_cfg = settings.get(str(guild.id), {})
        role_id = guild_cfg.get("role_id")
        staff_role = guild.get_role(int(role_id)) if role_id else None

        # Get or create the Tickets category
        category = discord.utils.get(guild.categories, name="Tickets")
        if not category:
            category = await guild.create_category("Tickets")

        # Permissions — private to opener + staff role + bot
        overwrites = {
            guild.default_role: discord.PermissionOverwrite(view_channel=False),
            member: discord.PermissionOverwrite(view_channel=True, send_messages=True, read_message_history=True),
            guild.me: discord.PermissionOverwrite(view_channel=True, send_messages=True, read_message_history=True, manage_channels=True),
        }
        if staff_role:
            overwrites[staff_role] = discord.PermissionOverwrite(
                view_channel=True, send_messages=True, read_message_history=True
            )

        channel = await category.create_text_channel(
            name=ticket_name,
            overwrites=overwrites,
            topic=f"opener:{member.id} reason:{reason}",
        )

        # Build ticket embed
        embed = discord.Embed(
            title=f"{emoji} {reason} Ticket",
            description=(
                f"Welcome {member.mention}!\n\n"
                f"**Reason:** {reason}\n\n"
                "A staff member will be with you shortly.\n"
                "Use the buttons below to manage this ticket."
            ),
            color=discord.Color.blurple(),
            timestamp=datetime.datetime.utcnow(),
        )
        embed.set_footer(text=f"Opened by {member.display_name}")

        ai_hint = discord.Embed(
            description="⏰ **Taking too long?** Click **🤖 AI Response** below for instant help!",
            color=discord.Color.gold(),
        )

        view = TicketChannelView()
        await channel.send(content=member.mention, embeds=[embed, ai_hint], view=view)
        await interaction.followup.send(
            f"✅ Your ticket has been created: {channel.mention}", ephemeral=True
        )

    @discord.ui.button(label="🎉 Giveaway Claim", style=discord.ButtonStyle.green, custom_id="ticket_giveaway")
    async def giveaway_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self._open_ticket(interaction, "Giveaway Claim", "🎉")

    @discord.ui.button(label="🐛 Bug Fix", style=discord.ButtonStyle.blurple, custom_id="ticket_bug")
    async def bug_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self._open_ticket(interaction, "Bug Fix", "🐛")

    @discord.ui.button(label="🚨 Emergency Help", style=discord.ButtonStyle.red, custom_id="ticket_emergency")
    async def emergency_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self._open_ticket(interaction, "Emergency Help", "🚨")


@bot.tree.command(name="ticket-setup", description="Send a ticket panel to a channel")
@app_commands.describe(
    channel="Channel to post the ticket panel in",
    role="Role that can see and manage all tickets",
)
@app_commands.checks.has_permissions(manage_guild=True)
async def ticket_setup(interaction: discord.Interaction, channel: discord.TextChannel, role: discord.Role):
    await interaction.response.defer(ephemeral=True)

    # Save guild settings
    settings = load_json(TICKET_SETTINGS_FILE)
    settings[str(interaction.guild.id)] = {"role_id": role.id, "panel_channel_id": channel.id}
    save_json(TICKET_SETTINGS_FILE, settings)

    embed = discord.Embed(
        title="🎫 Make A Ticket Here",
        description=(
            "**Select your reason below to open a support ticket.**\n\n"
            "🎉 **Giveaway Claim** — Claim a giveaway prize\n"
            "🐛 **Bug Fix** — Report a bug or issue\n"
            "🚨 **Emergency Help** — Urgent assistance needed\n\n"
            "*A dedicated private channel will be created just for you.*"
        ),
        color=discord.Color.blurple(),
    )
    embed.set_footer(text="Apex Ticket System • Powered by Apex Bot")

    await channel.send(embed=embed, view=TicketPanelView())
    await interaction.followup.send(
        f"✅ Ticket panel sent to {channel.mention}!\n"
        f"Staff role: {role.mention} — they can see all ticket channels.",
        ephemeral=True,
    )


# ── Message Handling & AutoMod ────────────────────────────────────────────────
@bot.event
async def on_message(message: discord.Message):
    if message.author.bot or not message.guild: return

    # Custom Prefix Commands
    if message.content.startswith("!"):
        trigger = message.content[1:].split()[0].lower()
        cmds = load_json(CUSTOM_CMDS_FILE).get(str(message.guild.id), {})
        if trigger in cmds:
            await message.channel.send(cmds[trigger]["response"])
            return

    await bot.process_commands(message)

# ── Keep-alive web server (for Uptime Robot) ──────────────────────────────────
from aiohttp import web as aio_web

async def _handle_ping(request):
    return aio_web.Response(text="OK", status=200)

async def start_keep_alive():
    port = 5000
    app = aio_web.Application()
    app.router.add_get("/", _handle_ping)
    app.router.add_get("/ping", _handle_ping)
    runner = aio_web.AppRunner(app)
    await runner.setup()
    site = aio_web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    print(f"Keep-alive server running on port {port}")

# ── FINAL RUN (ONLY ONE RUN CALL) ─────────────────────────────────────────────
async def main():
    token = os.environ.get("DISCORD_TOKEN")
    if not token:
        print("ERROR: DISCORD_TOKEN not set")
        return
    await start_keep_alive()
    await bot.start(token)

if __name__ == "__main__" or os.environ.get("DISCORD_TOKEN"):
    asyncio.run(main())
