import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Shield, MessageSquareX, Link2Off, Save } from "lucide-react";

interface AutomodSettings {
  word_filter: { enabled: boolean; words: string[] };
  anti_spam: { enabled: boolean; max_messages: number; window_seconds: number };
  anti_link: { enabled: boolean };
}

const DEFAULT: AutomodSettings = {
  word_filter: { enabled: false, words: [] },
  anti_spam: { enabled: false, max_messages: 5, window_seconds: 5 },
  anti_link: { enabled: false },
};

interface Props { guildId: string; }

function automodKey(guildId: string) { return ["guilds", guildId, "automod"]; }

export default function GuildAutomod({ guildId }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<AutomodSettings>({
    queryKey: automodKey(guildId),
    queryFn: () =>
      fetch(`/api/guilds/${guildId}/automod`, { credentials: "include" }).then((r) => r.json()),
  });

  const updateSettings = useMutation({
    mutationFn: (data: AutomodSettings) =>
      fetch(`/api/guilds/${guildId}/automod`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      queryClient.setQueryData(automodKey(guildId), data);
      toast({ title: "Settings saved", description: "Auto-moderation updated successfully." });
    },
    onError: () => toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" }),
  });

  const [local, setLocal] = useState<AutomodSettings | null>(null);
  const [wordInput, setWordInput] = useState("");

  useEffect(() => {
    if (settings) setLocal(JSON.parse(JSON.stringify(settings)));
  }, [settings]);

  const handleAddWord = (e: React.KeyboardEvent | React.MouseEvent) => {
    if (e.type === "keydown" && (e as React.KeyboardEvent).key !== "Enter") return;
    if (!wordInput.trim() || !local) return;
    e.preventDefault();
    const w = wordInput.trim().toLowerCase();
    if (!local.word_filter.words.includes(w)) {
      setLocal({ ...local, word_filter: { ...local.word_filter, words: [...local.word_filter.words, w] } });
    }
    setWordInput("");
  };

  const handleRemoveWord = (w: string) => {
    if (!local) return;
    setLocal({ ...local, word_filter: { ...local.word_filter, words: local.word_filter.words.filter((x) => x !== w) } });
  };

  if (isLoading || !local) {
    return (
      <div className="p-8 max-w-4xl mx-auto w-full space-y-6">
        <div className="flex justify-between items-center mb-8">
          <Skeleton className="h-10 w-64" /><Skeleton className="h-10 w-32" />
        </div>
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto w-full space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Auto-Moderation</h1>
          <p className="text-muted-foreground mt-1">Keep this server clean automatically.</p>
        </div>
        <Button onClick={() => updateSettings.mutate(local)} disabled={updateSettings.isPending} className="shadow-sm">
          {updateSettings.isPending ? "Saving..." : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
        </Button>
      </div>

      <div className="space-y-6">
        <Card className={`transition-opacity duration-200 ${!local.word_filter.enabled ? "opacity-60" : ""}`}>
          <CardHeader className="flex flex-row items-start justify-between pb-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-primary" />Word Filter</CardTitle>
              <CardDescription>Delete messages containing specific words.</CardDescription>
            </div>
            <Switch checked={local.word_filter.enabled} onCheckedChange={(v) => setLocal({ ...local, word_filter: { ...local.word_filter, enabled: v } })} />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Label>Banned Words</Label>
              <div className="flex gap-2">
                <Input placeholder="Type a word and press Enter..." value={wordInput} onChange={(e) => setWordInput(e.target.value)} onKeyDown={handleAddWord} disabled={!local.word_filter.enabled} className="max-w-xs" />
                <Button variant="secondary" onClick={handleAddWord} disabled={!local.word_filter.enabled || !wordInput.trim()}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-4 min-h-[2rem]">
                {local.word_filter.words.map((w) => (
                  <div key={w} className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm">
                    <span>{w}</span>
                    <button className="text-muted-foreground hover:text-destructive" onClick={() => handleRemoveWord(w)} disabled={!local.word_filter.enabled}>&times;</button>
                  </div>
                ))}
                {local.word_filter.words.length === 0 && <span className="text-sm text-muted-foreground italic flex items-center h-8">No words banned yet.</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`transition-opacity duration-200 ${!local.anti_spam.enabled ? "opacity-60" : ""}`}>
          <CardHeader className="flex flex-row items-start justify-between pb-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2"><MessageSquareX className="w-5 h-5 text-primary" />Anti-Spam</CardTitle>
              <CardDescription>Prevent users from sending too many messages too quickly.</CardDescription>
            </div>
            <Switch checked={local.anti_spam.enabled} onCheckedChange={(v) => setLocal({ ...local, anti_spam: { ...local.anti_spam, enabled: v } })} />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl">
              <div className="space-y-2">
                <Label>Max Messages</Label>
                <Input type="number" min={1} value={local.anti_spam.max_messages} onChange={(e) => setLocal({ ...local, anti_spam: { ...local.anti_spam, max_messages: parseInt(e.target.value) || 1 } })} disabled={!local.anti_spam.enabled} />
              </div>
              <div className="space-y-2">
                <Label>Time Window (seconds)</Label>
                <Input type="number" min={1} value={local.anti_spam.window_seconds} onChange={(e) => setLocal({ ...local, anti_spam: { ...local.anti_spam, window_seconds: parseInt(e.target.value) || 1 } })} disabled={!local.anti_spam.enabled} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`transition-opacity duration-200 ${!local.anti_link.enabled ? "opacity-60" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2"><Link2Off className="w-5 h-5 text-primary" />Anti-Link</CardTitle>
              <CardDescription>Delete messages containing URLs (except for admins).</CardDescription>
            </div>
            <Switch checked={local.anti_link.enabled} onCheckedChange={(v) => setLocal({ ...local, anti_link: { enabled: v } })} />
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
