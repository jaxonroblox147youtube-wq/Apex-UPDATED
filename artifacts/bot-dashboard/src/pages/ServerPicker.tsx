import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, ExternalLink, LogOut, ChevronRight } from "lucide-react";

const INVITE_BASE = `https://discord.com/api/oauth2/authorize?client_id=1507776524189827242&permissions=1099780090886&scope=bot%20applications.commands`;

interface Guild {
  id: string;
  name: string;
  icon?: string;
  owner: boolean;
  bot_present: boolean;
}

interface User {
  id: string;
  username: string;
  avatar?: string;
}

function guildIconUrl(guild: Guild) {
  if (!guild.icon) return null;
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=64`;
}

function avatarUrl(user: User) {
  if (!user.avatar) return null;
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=64`;
}

export default function ServerPicker() {
  const [, navigate] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => {
        if (r.status === 401) { window.location.href = "/api/auth/login"; return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setUser(data);
        setAuthChecked(true);
      });
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    fetch("/api/auth/guilds", { credentials: "include" })
      .then((r) => r.json())
      .then((data: Guild[]) => {
        setGuilds(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [authChecked]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center font-bold text-white text-sm">A</div>
            <span className="font-bold text-base tracking-tight">Apex</span>
          </a>
          {user && (
            <div className="flex items-center gap-3">
              {avatarUrl(user) ? (
                <img src={avatarUrl(user)!} alt={user.username} className="w-7 h-7 rounded-full border border-border" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">{user.username[0]}</div>
              )}
              <span className="text-sm font-medium text-muted-foreground hidden sm:block">{user.username}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground gap-1.5">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Select a Server</h1>
          <p className="text-muted-foreground mt-1">Choose a server to manage. Only servers you have permission to manage are shown.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : guilds.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-xl">
            <Bot className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
            <p className="text-lg font-medium">No servers found</p>
            <p className="text-muted-foreground text-sm mt-1">You don't manage any servers where Apex can be added.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {guilds.map((guild) => (
              <div key={guild.id} className="group border border-border rounded-xl bg-card/50 hover:bg-card transition-colors overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  {guildIconUrl(guild) ? (
                    <img src={guildIconUrl(guild)!} alt={guild.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                      {guild.name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{guild.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {guild.owner ? "Owner" : "Admin"}
                    </p>
                  </div>
                </div>
                <div className="border-t border-border px-4 py-3">
                  {guild.bot_present ? (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => navigate(`/dashboard/${guild.id}`)}
                    >
                      Manage
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      asChild
                    >
                      <a href={`${INVITE_BASE}&guild_id=${guild.id}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="w-4 h-4 mr-1.5" />
                        Add Apex
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
