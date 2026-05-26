import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, TerminalSquare, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface Command {
  name: string;
  response: string;
  owner_only: boolean;
  created_at: string;
}

interface Props {
  guildId: string;
}

function cmdKey(guildId: string) {
  return ["guilds", guildId, "commands"];
}

export default function GuildCommands({ guildId }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: commands, isLoading } = useQuery<Command[]>({
    queryKey: cmdKey(guildId),
    queryFn: () =>
      fetch(`/api/guilds/${guildId}/commands`, { credentials: "include" }).then((r) => r.json()),
  });

  const createCmd = useMutation({
    mutationFn: (body: { name: string; response: string; owner_only: boolean }) =>
      fetch(`/api/guilds/${guildId}/commands`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cmdKey(guildId) });
      setName(""); setResponse(""); setOwnerOnly(false);
      toast({ title: "Command created" });
    },
    onError: () => toast({ title: "Error", description: "Failed to create command.", variant: "destructive" }),
  });

  const deleteCmd = useMutation({
    mutationFn: (name: string) =>
      fetch(`/api/guilds/${guildId}/commands/${name}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cmdKey(guildId) });
      toast({ title: "Command deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete command.", variant: "destructive" }),
  });

  const [name, setName] = useState("");
  const [response, setResponse] = useState("");
  const [ownerOnly, setOwnerOnly] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !response.trim()) return;
    createCmd.mutate({ name: name.trim(), response: response.trim(), owner_only: ownerOnly });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Custom Commands</h1>
        <p className="text-muted-foreground mt-1">Manage custom text responses for this server.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
            </div>
          ) : !commands?.length ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <TerminalSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium">No custom commands</h3>
              <p className="text-muted-foreground text-sm">Create one using the form.</p>
            </div>
          ) : (
            commands.map((cmd) => (
              <Card key={cmd.name} className="overflow-hidden bg-card/50">
                <div className="flex items-start justify-between p-5">
                  <div className="space-y-2 flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono bg-primary/10 px-2.5 py-1 rounded text-sm font-semibold text-primary">
                        !{cmd.name}
                      </span>
                      {cmd.owner_only && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                          <ShieldCheck className="w-3 h-3" />
                          Owner only
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm whitespace-pre-wrap break-words">{cmd.response}</p>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => deleteCmd.mutate(cmd.name)}
                    disabled={deleteCmd.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="sticky top-8">
          <Card>
            <CardHeader>
              <CardTitle>New Command</CardTitle>
              <CardDescription>Add a new auto-responder for this server.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Trigger (without !)</Label>
                  <Input id="name" placeholder="ping" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="response">Response</Label>
                  <Textarea
                    id="response" placeholder="Pong!"
                    className="min-h-[100px] resize-none"
                    value={response} onChange={(e) => setResponse(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="owner-only" className="text-sm font-medium cursor-pointer">Owner only</Label>
                    <p className="text-xs text-muted-foreground">Only the server owner can trigger this.</p>
                  </div>
                  <Switch id="owner-only" checked={ownerOnly} onCheckedChange={setOwnerOnly} />
                </div>
                <Button
                  type="submit" className="w-full"
                  disabled={!name.trim() || !response.trim() || createCmd.isPending}
                >
                  {createCmd.isPending ? "Creating..." : <><Plus className="w-4 h-4 mr-2" />Create Command</>}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
