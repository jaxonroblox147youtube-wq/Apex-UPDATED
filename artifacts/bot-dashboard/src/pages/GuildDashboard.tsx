import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Link } from "wouter";
import { LayoutDashboard, TerminalSquare, ShieldAlert, FileText, Home, ChevronLeft, Bot, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import GuildOverview from "./GuildOverview";
import GuildCommands from "./GuildCommands";
import GuildAutomod from "./GuildAutomod";
import GuildApplications from "./GuildApplications";

interface GuildInfo {
  id: string;
  name: string;
  icon?: string;
  member_count?: number;
}

function guildIconUrl(guild: GuildInfo) {
  if (!guild.icon) return null;
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=64`;
}

interface Props {
  tab?: string;
}

export default function GuildDashboard({ tab }: Props) {
  const params = useParams<{ guildId: string }>();
  const guildId = params.guildId;
  const [, navigate] = useLocation();
  const [guild, setGuild] = useState<GuildInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ username: string; avatar?: string; id: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => { if (r.status === 401) { window.location.href = "/api/auth/login"; return null; } return r.json(); })
      .then((d) => d && setUser(d));
  }, []);

  useEffect(() => {
    if (!guildId) return;
    fetch(`/api/guilds/${guildId}/info`, { credentials: "include" })
      .then((r) => { if (r.status === 403 || r.status === 401) { navigate("/dashboard"); return null; } return r.json(); })
      .then((d) => { if (d) { setGuild(d); setLoading(false); } })
      .catch(() => setLoading(false));
  }, [guildId]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/";
  };

  const activeTab = tab || "overview";

  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard, href: `/dashboard/${guildId}` },
    { id: "commands", label: "Commands", icon: TerminalSquare, href: `/dashboard/${guildId}/commands` },
    { id: "automod", label: "Auto-Moderation", icon: ShieldAlert, href: `/dashboard/${guildId}/automod` },
    { id: "applications", label: "Applications", icon: FileText, href: `/dashboard/${guildId}/applications` },
  ];

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-sidebar border-r border-border w-64">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-4 border-b border-border shrink-0">
        <Bot className="w-5 h-5 text-primary" />
        <span className="font-bold text-base tracking-tight">Apex Dashboard</span>
        <button className="ml-auto md:hidden text-muted-foreground" onClick={() => setSidebarOpen(false)}>
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Server info */}
      <div className="px-4 py-3 border-b border-border">
        <a href="/dashboard" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ChevronLeft className="w-3 h-3" /> All servers
        </a>
        {loading ? (
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : guild ? (
          <div className="flex items-center gap-2.5">
            {guildIconUrl(guild) ? (
              <img src={guildIconUrl(guild)!} alt={guild.name} className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-sm text-primary">
                {guild.name[0]}
              </div>
            )}
            <span className="font-semibold text-sm truncate">{guild.name}</span>
          </div>
        ) : null}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <Link key={item.id} href={item.href}>
              <div
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer text-sm ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-1">
        <a href="/" className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors cursor-pointer">
          <Home className="w-4 h-4 shrink-0" />
          Home
        </a>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Logout
          {user && <span className="ml-auto text-xs truncate max-w-[80px]">{user.username}</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="w-64 flex flex-col">
            <Sidebar />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 h-12 border-b border-border shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">{guild?.name || "Dashboard"}</span>
        </div>

        {activeTab === "overview" && <GuildOverview guildId={guildId} guild={guild} />}
        {activeTab === "commands" && <GuildCommands guildId={guildId} />}
        {activeTab === "automod" && <GuildAutomod guildId={guildId} />}
        {activeTab === "applications" && <GuildApplications guildId={guildId} />}
      </main>
    </div>
  );
}
