import os
import json
import random
import datetime
import discord
from discord import app_commands
from discord.ext import commands

WELCOME_FILE = "welcome_channels.json"
WARNINGS_FILE = "warnings.json"
WARN_ROLES_FILE = "warn_roles.json"

def load_json(path):
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return {}

def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f)

welcome_channels = load_json(WELCOME_FILE)
warnings_data   = load_json(WARNINGS_FILE)
warn_roles      = load_json(WARN_ROLES_FILE)

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

class MyBot(commands.Bot):
    def __init__(self):
        super().__init__(command_prefix="!", intents=intents)

    async def setup_hook(self):
        await self.tree.sync()
        print(f"Synced slash commands for {self.user}")

bot = MyBot()

@bot.event
async def on_ready():
    print(f'Logged in as {bot.user.name}')

# ── Welcome system ────────────────────────────────────────────────────────────

@bot.event
async def on_member_join(member: discord.Member):
    guild_id = str(member.guild.id)
    channel_id = welcome_channels.get(guild_id)
    if not channel_id:
        return
    channel = member.guild.get_channel(int(channel_id))
    if not channel:
        return
    embed = discord.Embed(
        title=f"👋 Welcome to {member.guild.name}!",
        description=f"Hey {member.mention}, glad you're here! You are member **#{member.guild.member_count}**.",
        color=discord.Color.green()
    )
    embed.set_thumbnail(url=member.display_avatar.url)
    embed.set_footer(text=f"Joined • {datetime.datetime.now().strftime('%B %d, %Y')}")
    await channel.send(embed=embed)

# ── Original commands ─────────────────────────────────────────────────────────

@bot.tree.command(name="ping", description="Check the bot's speed")
async def ping(interaction: discord.Interaction):
    await interaction.response.send_message(f'🏓 Pong! Latency: {round(bot.latency * 1000)}ms')

@bot.tree.command(name="hello", description="Get a friendly greeting")
async def hello(interaction: discord.Interaction):
    await interaction.response.send_message(f'Hello {interaction.user.mention}! Hope you are having a great day! 😊')

@bot.tree.command(name="bye", description="Say goodbye")
async def bye(interaction: discord.Interaction):
    await interaction.response.send_message(f'Bye {interaction.user.mention}! Hope you have a wonderful day!')

# ── Dice rolling ──────────────────────────────────────────────────────────────

@bot.tree.command(name="roll", description="Roll dice — e.g. 2d6 rolls two six-sided dice")
@app_commands.describe(dice="Dice to roll in NdN format (e.g. 1d20, 2d6). Defaults to 1d6.")
async def roll(interaction: discord.Interaction, dice: str = "1d6"):
    try:
        parts = dice.lower().split("d")
        if len(parts) != 2:
            raise ValueError
        count, sides = int(parts[0]), int(parts[1])
        if count < 1 or count > 100 or sides < 2 or sides > 1000:
            raise ValueError
    except (ValueError, IndexError):
        await interaction.response.send_message("❌ Invalid format. Use NdN, e.g. `2d6` or `1d20`.", ephemeral=True)
        return

    rolls = [random.randint(1, sides) for _ in range(count)]
    total = sum(rolls)
    rolls_str = ", ".join(str(r) for r in rolls)
    if count == 1:
        await interaction.response.send_message(f'🎲 Rolled **d{sides}**: **{total}**')
    else:
        await interaction.response.send_message(f'🎲 Rolled **{dice}**: [{rolls_str}] → Total: **{total}**')

# ── Polls ─────────────────────────────────────────────────────────────────────

@bot.tree.command(name="poll", description="Create a quick yes/no poll")
@app_commands.describe(question="The question to ask the server")
async def poll(interaction: discord.Interaction, question: str):
    embed = discord.Embed(
        title="📊 Poll",
        description=question,
        color=discord.Color.blurple()
    )
    embed.set_footer(text=f"Asked by {interaction.user.display_name}")
    await interaction.response.send_message(embed=embed)
    message = await interaction.original_response()
    await message.add_reaction("👍")
    await message.add_reaction("👎")

@bot.tree.command(name="poll_choice", description="Create a poll with up to 4 custom options")
@app_commands.describe(
    question="The question to ask",
    option1="First option",
    option2="Second option",
    option3="Third option (optional)",
    option4="Fourth option (optional)"
)
async def poll_choice(
    interaction: discord.Interaction,
    question: str,
    option1: str,
    option2: str,
    option3: str = None,
    option4: str = None
):
    emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"]
    options = [o for o in [option1, option2, option3, option4] if o]
    description = "\n".join(f"{emojis[i]} {opt}" for i, opt in enumerate(options))
    embed = discord.Embed(
        title=f"📊 {question}",
        description=description,
        color=discord.Color.blurple()
    )
    embed.set_footer(text=f"Asked by {interaction.user.display_name}")
    await interaction.response.send_message(embed=embed)
    message = await interaction.original_response()
    for i in range(len(options)):
        await message.add_reaction(emojis[i])

# ── Owner-only check ──────────────────────────────────────────────────────────

def is_owner(interaction: discord.Interaction) -> bool:
    return interaction.user == interaction.guild.owner

# ── Welcome setup commands (owner only) ──────────────────────────────────────

@bot.tree.command(name="setwelcome", description="Set the channel where welcome messages are sent (owner only)")
@app_commands.describe(channel="The channel to send welcome messages in")
@app_commands.check(is_owner)
async def setwelcome(interaction: discord.Interaction, channel: discord.TextChannel):
    welcome_channels[str(interaction.guild.id)] = str(channel.id)
    save_json(WELCOME_FILE, welcome_channels)
    await interaction.response.send_message(f'✅ Welcome messages will now be sent in {channel.mention}.')

@bot.tree.command(name="clearwelcome", description="Disable welcome messages for this server (owner only)")
@app_commands.check(is_owner)
async def clearwelcome(interaction: discord.Interaction):
    welcome_channels.pop(str(interaction.guild.id), None)
    save_json(WELCOME_FILE, welcome_channels)
    await interaction.response.send_message("✅ Welcome messages have been disabled.")

@bot.tree.command(name="welcometest", description="Preview what the welcome message looks like (owner only)")
@app_commands.check(is_owner)
async def welcometest(interaction: discord.Interaction):
    member = interaction.user
    embed = discord.Embed(
        title=f"👋 Welcome to {interaction.guild.name}!",
        description=f"Hey {member.mention}, glad you're here! You are member **#{interaction.guild.member_count}**.",
        color=discord.Color.green()
    )
    embed.set_thumbnail(url=member.display_avatar.url)
    embed.set_footer(text=f"Joined • {datetime.datetime.now().strftime('%B %d, %Y')}")
    await interaction.response.send_message("Here's a preview of the welcome message:", embed=embed, ephemeral=True)

# ── Moderation (server owner only) ───────────────────────────────────────────

@bot.tree.command(name="kick", description="Kick a member from the server (owner only)")
@app_commands.describe(member="The member to kick", reason="Reason for the kick")
@app_commands.check(is_owner)
async def kick(interaction: discord.Interaction, member: discord.Member, reason: str = "No reason provided"):
    if member == interaction.user:
        await interaction.response.send_message("❌ You can't kick yourself.", ephemeral=True)
        return
    if member.top_role >= interaction.guild.me.top_role:
        await interaction.response.send_message("❌ I don't have permission to kick that member.", ephemeral=True)
        return
    await member.kick(reason=reason)
    await interaction.response.send_message(f'👢 **{member.display_name}** has been kicked. Reason: {reason}')

@bot.tree.command(name="ban", description="Ban a member from the server (owner only)")
@app_commands.describe(member="The member to ban", reason="Reason for the ban")
@app_commands.check(is_owner)
async def ban(interaction: discord.Interaction, member: discord.Member, reason: str = "No reason provided"):
    if member == interaction.user:
        await interaction.response.send_message("❌ You can't ban yourself.", ephemeral=True)
        return
    if member.top_role >= interaction.guild.me.top_role:
        await interaction.response.send_message("❌ I don't have permission to ban that member.", ephemeral=True)
        return
    await member.ban(reason=reason)
    await interaction.response.send_message(f'🔨 **{member.display_name}** has been banned. Reason: {reason}')

@bot.tree.command(name="unban", description="Unban a user by their ID (owner only)")
@app_commands.describe(user_id="The Discord user ID to unban")
@app_commands.check(is_owner)
async def unban(interaction: discord.Interaction, user_id: str):
    try:
        uid = int(user_id)
    except ValueError:
        await interaction.response.send_message("❌ Please provide a valid numeric user ID.", ephemeral=True)
        return
    try:
        user = await bot.fetch_user(uid)
        await interaction.guild.unban(user)
        await interaction.response.send_message(f'✅ **{user.name}** has been unbanned.')
    except discord.NotFound:
        await interaction.response.send_message("❌ That user is not banned or doesn't exist.", ephemeral=True)

@bot.tree.command(name="timeout", description="Timeout a member temporarily (owner only)")
@app_commands.describe(member="The member to timeout", minutes="Duration in minutes (max 40320 = 4 weeks)")
@app_commands.check(is_owner)
async def timeout(interaction: discord.Interaction, member: discord.Member, minutes: int = 5):
    if minutes < 1 or minutes > 40320:
        await interaction.response.send_message("❌ Duration must be between 1 and 40320 minutes.", ephemeral=True)
        return
    duration = datetime.timedelta(minutes=minutes)
    await member.timeout(duration)
    await interaction.response.send_message(f'⏱️ **{member.display_name}** has been timed out for {minutes} minute(s).')

@bot.tree.command(name="clear", description="Delete a number of messages from this channel (owner only)")
@app_commands.describe(amount="Number of messages to delete (1–100)")
@app_commands.check(is_owner)
async def clear(interaction: discord.Interaction, amount: int = 10):
    if amount < 1 or amount > 100:
        await interaction.response.send_message("❌ Amount must be between 1 and 100.", ephemeral=True)
        return
    await interaction.response.defer(ephemeral=True)
    deleted = await interaction.channel.purge(limit=amount)
    await interaction.followup.send(f'🧹 Deleted {len(deleted)} message(s).', ephemeral=True)

# ── Warning system (owner only) ───────────────────────────────────────────────

@bot.tree.command(name="setwarnrole", description="Set the role assigned to warned members (owner only)")
@app_commands.describe(role="The role to give members when they are warned")
@app_commands.check(is_owner)
async def setwarnrole(interaction: discord.Interaction, role: discord.Role):
    warn_roles[str(interaction.guild.id)] = str(role.id)
    save_json(WARN_ROLES_FILE, warn_roles)
    await interaction.response.send_message(f'✅ Warned members will receive the {role.mention} role.')

@bot.tree.command(name="warn", description="Warn a member (owner only)")
@app_commands.describe(member="The member to warn", reason="Reason for the warning")
@app_commands.check(is_owner)
async def warn(interaction: discord.Interaction, member: discord.Member, reason: str = "No reason provided"):
    if member.bot:
        await interaction.response.send_message("❌ You can't warn a bot.", ephemeral=True)
        return
    if member == interaction.user:
        await interaction.response.send_message("❌ You can't warn yourself.", ephemeral=True)
        return

    guild_id = str(interaction.guild.id)
    user_id  = str(member.id)

    warnings_data.setdefault(guild_id, {}).setdefault(user_id, [])
    warnings_data[guild_id][user_id].append({
        "reason": reason,
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "by": str(interaction.user)
    })
    save_json(WARNINGS_FILE, warnings_data)
    count = len(warnings_data[guild_id][user_id])

    role_id = warn_roles.get(guild_id)
    role_text = ""
    if role_id:
        warn_role = interaction.guild.get_role(int(role_id))
        if warn_role and warn_role not in member.roles:
            try:
                await member.add_roles(warn_role, reason=f"Warned by {interaction.user}")
                role_text = f" The **{warn_role.name}** role has been assigned."
            except discord.Forbidden:
                role_text = " ⚠️ Couldn't assign the warn role (missing permissions)."

    embed = discord.Embed(
        title="⚠️ Member Warned",
        color=discord.Color.orange()
    )
    embed.add_field(name="Member", value=member.mention, inline=True)
    embed.add_field(name="Total Warnings", value=str(count), inline=True)
    embed.add_field(name="Reason", value=reason, inline=False)
    embed.set_footer(text=f"Warned by {interaction.user.display_name}")
    await interaction.response.send_message(content=role_text.strip() or None, embed=embed)

    try:
        await member.send(
            f"⚠️ You have been warned in **{interaction.guild.name}**.\n"
            f"**Reason:** {reason}\n"
            f"**Total warnings:** {count}"
        )
    except discord.Forbidden:
        pass

@bot.tree.command(name="warnings", description="Check how many warnings a member has")
@app_commands.describe(member="The member to check")
async def warnings(interaction: discord.Interaction, member: discord.Member):
    guild_id = str(interaction.guild.id)
    user_id  = str(member.id)
    entries  = warnings_data.get(guild_id, {}).get(user_id, [])

    if not entries:
        await interaction.response.send_message(f'✅ **{member.display_name}** has no warnings.', ephemeral=True)
        return

    embed = discord.Embed(
        title=f"⚠️ Warnings for {member.display_name}",
        color=discord.Color.orange()
    )
    for i, w in enumerate(entries, 1):
        embed.add_field(
            name=f"Warning #{i} — {w['timestamp']}",
            value=f"**Reason:** {w['reason']}\n**By:** {w['by']}",
            inline=False
        )
    embed.set_thumbnail(url=member.display_avatar.url)
    await interaction.response.send_message(embed=embed, ephemeral=True)

@bot.tree.command(name="clearwarnings", description="Clear all warnings for a member and remove the warn role (owner only)")
@app_commands.describe(member="The member to clear warnings for")
@app_commands.check(is_owner)
async def clearwarnings(interaction: discord.Interaction, member: discord.Member):
    guild_id = str(interaction.guild.id)
    user_id  = str(member.id)

    warnings_data.get(guild_id, {}).pop(user_id, None)
    save_json(WARNINGS_FILE, warnings_data)

    role_id = warn_roles.get(guild_id)
    role_text = ""
    if role_id:
        warn_role = interaction.guild.get_role(int(role_id))
        if warn_role and warn_role in member.roles:
            try:
                await member.remove_roles(warn_role, reason=f"Warnings cleared by {interaction.user}")
                role_text = f" The **{warn_role.name}** role has been removed."
            except discord.Forbidden:
                role_text = " ⚠️ Couldn't remove the warn role (missing permissions)."

    await interaction.response.send_message(
        f'✅ All warnings cleared for **{member.display_name}**.{role_text}'
    )

# ── Error handler ─────────────────────────────────────────────────────────────

@bot.tree.error
async def on_app_command_error(interaction: discord.Interaction, error: app_commands.AppCommandError):
    if isinstance(error, app_commands.CheckFailure):
        await interaction.response.send_message("❌ Only the server owner can use this command.", ephemeral=True)
    else:
        await interaction.response.send_message(f"❌ An error occurred: {error}", ephemeral=True)

# ── Run ───────────────────────────────────────────────────────────────────────

token = os.environ.get('DISCORD_TOKEN')
if not token:
    raise ValueError("DISCORD_TOKEN environment variable is not set. Add it to your secrets.")

bot.run(token)
