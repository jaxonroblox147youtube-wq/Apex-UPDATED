import { useGetBotStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Users, Activity, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface GuildInfo {
  id: string;
  name: string;
  icon?: string;
  member_count?: number;
}

interface Props {
  guildId: string;
  guild: GuildInfo | null;
}

export default function GuildOverview({ guildId, guild }: Props) {
  const { data: stats, isLoading, isError } = useGetBotStats({
    query: { refetchInterval: 15000, queryKey: ["getBotStats"] }
  });

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-1">
            {guild ? `Managing ${guild.name}` : "Live bot metrics"}
            {guild?.member_count ? ` · ${guild.member_count.toLocaleString()} members` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-full shadow-sm">
          <div className={`w-2 h-2 rounded-full ${stats?.status === "online" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"}`} />
          <span className="text-sm font-medium capitalize text-foreground">{stats?.status || "Unknown"}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : isError ? (
        <div className="text-destructive p-4 border border-destructive/20 rounded-lg bg-destructive/10">
          Failed to load bot statistics.
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Servers</CardTitle>
              <Server className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.servers.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Server</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{guild?.member_count?.toLocaleString() ?? "—"}</div>
              <p className="text-xs text-muted-foreground mt-1">members</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Latency</CardTitle>
              <Activity className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.latency_ms}ms</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Uptime</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatUptime(stats.uptime_seconds)}</div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
