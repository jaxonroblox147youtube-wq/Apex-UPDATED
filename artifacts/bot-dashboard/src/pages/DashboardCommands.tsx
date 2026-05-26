import { useState } from "react";
import { useListCustomCommands, useCreateCustomCommand, useDeleteCustomCommand, getListCustomCommandsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, TerminalSquare, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function DashboardCommands() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: commands, isLoading } = useListCustomCommands();
  const createCommand = useCreateCustomCommand();
  const deleteCommand = useDeleteCustomCommand();

  const [name, setName] = useState("");
  const [response, setResponse] = useState("");
  const [ownerOnly, setOwnerOnly] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !response.trim()) return;

    createCommand.mutate(
      { data: { name: name.trim(), response: response.trim(), owner_only: ownerOnly } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCustomCommandsQueryKey() });
          setName("");
          setResponse("");
          setOwnerOnly(false);
          toast({ title: "Command created", description: `!${name.trim()} added successfully.` });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create command.", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (cmdName: string) => {
    deleteCommand.mutate(
      { name: cmdName },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCustomCommandsQueryKey() });
          toast({ title: "Command deleted", description: `!${cmdName} was removed.` });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to delete command.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Custom Commands</h1>
        <p className="text-muted-foreground mt-1">Manage custom text responses for your server.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
            </div>
          ) : commands?.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <TerminalSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium">No custom commands</h3>
              <p className="text-muted-foreground">Create one to get started.</p>
            </div>
          ) : (
            commands?.map((cmd) => (
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
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleDelete(cmd.name)}
                    disabled={deleteCommand.isPending}
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
              <CardDescription>Add a new auto-responder.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Trigger (without !)</Label>
                  <Input
                    id="name"
                    placeholder="ping"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="response">Response</Label>
                  <Textarea
                    id="response"
                    placeholder="Pong!"
                    className="min-h-[100px] resize-none"
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="owner-only" className="text-sm font-medium cursor-pointer">
                      Owner only
                    </Label>
                    <p className="text-xs text-muted-foreground">Only the server owner can trigger this command.</p>
                  </div>
                  <Switch
                    id="owner-only"
                    checked={ownerOnly}
                    onCheckedChange={setOwnerOnly}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!name.trim() || !response.trim() || createCommand.isPending}
                >
                  {createCommand.isPending ? "Creating..." : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Command
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
