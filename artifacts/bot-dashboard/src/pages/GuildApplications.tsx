import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, Trash2, Send, CheckCircle2 } from "lucide-react";

type Channel = { id: string; name: string };
type Application = {
  id: string;
  name: string;
  questions: { id: string; text: string }[];
  publish_channel_id?: string;
  published_channel_id?: string;
  results_channel_id?: string;
  created_at: string;
};

const key = (guildId: string) => ["guilds", guildId, "applications"];

export default function GuildApplications({ guildId }: { guildId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [questions, setQuestions] = useState([""]);
  const [publishChannel, setPublishChannel] = useState("");
  const [resultsChannel, setResultsChannel] = useState("");
  const [applicationChannels, setApplicationChannels] = useState<Record<string, string>>({});

  const applications = useQuery<Application[]>({
    queryKey: key(guildId),
    queryFn: async () => {
      const response = await fetch(`/api/guilds/${guildId}/applications`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load applications");
      return response.json();
    },
  });
  const channels = useQuery<Channel[]>({
    queryKey: ["guilds", guildId, "channels"],
    queryFn: async () => {
      const response = await fetch(`/api/guilds/${guildId}/channels`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load channels");
      return response.json();
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/guilds/${guildId}/applications`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          questions: questions.map((text) => ({ text })),
          publish_channel_id: publishChannel || undefined,
          results_channel_id: resultsChannel || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error([body.error, body.detail].filter(Boolean).join(": ") || "Failed to create application");
      return body;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: key(guildId) });
      setName(""); setQuestions([""]); setPublishChannel(""); setResultsChannel("");
      if (created.published) {
        toast({ title: "Application created and sent to Discord" });
      } else {
        toast({
          title: "Application saved, but not sent",
          description: created.publish_error || "Choose a channel on the application card, then select Send to Discord.",
          variant: created.publish_error ? "destructive" : "default",
        });
      }
    },
    onError: (error: Error) => toast({ title: "Could not create application", description: error.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/guilds/${guildId}/applications/${id}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error("Failed to delete application");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key(guildId) });
      toast({ title: "Application deleted" });
    },
  });
  const publish = useMutation({
    mutationFn: async ({ id, channel_id }: { id: string; channel_id: string }) => {
      const response = await fetch(`/api/guilds/${guildId}/applications/${id}/publish`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error([body.error, body.detail].filter(Boolean).join(": ") || "Failed to send to Discord");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key(guildId) });
      toast({ title: "Application sent to Discord" });
    },
    onError: (error: Error) => toast({ title: "Could not send to Discord", description: error.message, variant: "destructive" }),
  });

  const channelName = (id?: string) => channels.data?.find((channel) => channel.id === id)?.name || "Not selected";
  const updateQuestion = (index: number, value: string) =>
    setQuestions((current) => current.map((question, i) => i === index ? value : question));

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary"><FileText className="w-5 h-5" /></div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
            <p className="text-muted-foreground mt-1">Build Yes/No application forms and send them to Discord.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-4">
          {applications.isLoading ? [1, 2].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />) :
            !applications.data?.length ? (
              <div className="text-center py-16 border border-dashed border-border rounded-xl">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium">No applications yet</h3>
                <p className="text-muted-foreground text-sm">Create your first application form.</p>
              </div>
            ) : applications.data.map((application) => (
              <Card key={application.id} className="bg-card/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{application.name}</CardTitle>
                      <CardDescription>{application.questions.length} Yes/No question{application.questions.length === 1 ? "" : "s"}</CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" disabled={publish.isPending || !(applicationChannels[application.id] || application.publish_channel_id)} onClick={() => {
                        const channel_id = applicationChannels[application.id] || application.publish_channel_id;
                        if (channel_id) publish.mutate({ id: application.id, channel_id });
                      }}><Send className="w-3.5 h-3.5 mr-1.5" />{application.published_channel_id ? "Resend" : "Send to Discord"}</Button>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => remove.mutate(application.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {application.questions.map((question, index) => (
                      <div key={question.id} className="text-sm flex gap-2">
                        <span className="text-primary font-semibold">{index + 1}.</span><span>{question.text}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <select
                      aria-label={`Publish ${application.name} to channel`}
                      className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={applicationChannels[application.id] ?? application.publish_channel_id ?? ""}
                      onChange={(event) => setApplicationChannels((current) => ({ ...current, [application.id]: event.target.value }))}
                    >
                      <option value="">Choose a channel</option>
                      {channels.data?.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
                    <span className="inline-flex items-center gap-1"><Send className="w-3 h-3" /> Publish: #{channelName(application.publish_channel_id)}</span>
                    <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Results: #{channelName(application.results_channel_id)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>

        <Card className="sticky top-8">
          <CardHeader>
            <CardTitle>New Application</CardTitle>
            <CardDescription>Applicants answer each question with Yes or No.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (name.trim() && questions.some((q) => q.trim())) create.mutate(); }}>
              <div className="space-y-2">
                <Label htmlFor="application-name">Application name</Label>
                <Input id="application-name" placeholder="Moderator Application" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Questions</Label>
                {questions.map((question, index) => (
                  <div key={index} className="flex gap-2">
                    <Input placeholder={`Question ${index + 1}`} value={question} onChange={(event) => updateQuestion(index, event.target.value)} />
                    {questions.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setQuestions((current) => current.filter((_, i) => i !== index))}><Trash2 className="w-4 h-4" /></Button>}
                  </div>
                ))}
                {questions.length < 5 && <Button type="button" variant="outline" size="sm" onClick={() => setQuestions((current) => [...current, ""])}><Plus className="w-4 h-4 mr-2" />Add question</Button>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="publish-channel">Publish channel</Label>
                <select id="publish-channel" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={publishChannel} onChange={(event) => setPublishChannel(event.target.value)}>
                  <option value="">Choose later in Discord</option>
                  {channels.data?.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="results-channel">Results/review channel</Label>
                <select id="results-channel" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={resultsChannel} onChange={(event) => setResultsChannel(event.target.value)}>
                  <option value="">Use the application channel</option>
                  {channels.data?.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <Button className="w-full" type="submit" disabled={!name.trim() || !questions.some((q) => q.trim()) || create.isPending}>
                {create.isPending ? "Creating..." : <><Plus className="w-4 h-4 mr-2" />Create application</>}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}