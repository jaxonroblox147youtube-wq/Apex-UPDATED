import os
import discord
from discord import app_commands
from discord.ext import commands

intents = discord.Intents.default()
intents.message_content = True

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

@bot.tree.command(name="ping", description="Check the bot's speed")
async def ping(interaction: discord.Interaction):
    await interaction.response.send_message(f'🏓 Pong! Latency: {round(bot.latency * 1000)}ms')

@bot.tree.command(name="hello", description="Get a friendly greeting")
async def hello(interaction: discord.Interaction):
    await interaction.response.send_message(f'Hello {interaction.user.mention}! Hope you are having a great day! 😊')

@bot.tree.command(name="bye", description="Say goodbye")
async def bye(interaction: discord.Interaction):
    await interaction.response.send_message(f'Bye {interaction.user.mention}! Hope you have a wonderful day!')

token = os.environ.get('DISCORD_TOKEN')
if not token:
    raise ValueError("DISCORD_TOKEN environment variable is not set. Add it to your secrets.")

bot.run(token)
