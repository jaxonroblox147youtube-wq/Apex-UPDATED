import { useEffect, useState } from "react";
import { useGetAutomodSettings, useUpdateAutomodSettings, getGetAutomodSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Shield, MessageSquareX, Link2Off, Save } from "lucide-react";
import type { AutomodSettings } from "@workspace/api-client-react";

export default function DashboardAutomod() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: settings, isLoading } = useGetAutomodSettings();
  const updateSettings = useUpdateAutomodSettings();

  const [localSettings, setLocalSettings] = useState<AutomodSettings | null>(null);
  const [wordInput, setWordInput] = useState("");

  useEffect(() => {
    if (settings) {
      setLocalSettings(JSON.parse(JSON.stringify(settings)));
    }
  }, [settings]);

  const handleSave = () => {
    if (!localSettings) return;
    updateSettings.mutate(
      { data: localSettings },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetAutomodSettingsQueryKey(), data);
          toast({ title: "Settings saved", description: "Auto-moderation updated successfully." });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
        }
      }
    );
  };

  const handleAddWord = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ((e.type === 'keydown' && (e as React.KeyboardEvent).key !== 'Enter') || !wordInput.trim() || !localSettings) return;
    e.preventDefault();
    const newWord = wordInput.trim().toLowerCase();
    if (!localSettings.word_filter.words.includes(newWord)) {
      setLocalSettings({
        ...localSettings,
        word_filter: {
          ...localSettings.word_filter,
          words: [...localSettings.word_filter.words, newWord] as string[]
        }
      });
    }
    setWordInput("");
  };

  const handleRemoveWord = (wordToRemove: string) => {
    if (!localSettings) return;
    setLocalSettings({
      ...localSettings,
      word_filter: {
        ...localSettings.word_filter,
        words: localSettings.word_filter.words.filter(w => w !== wordToRemove)
      }
    });
  };

  if (isLoading || !localSettings) {
    return (
      <div className="p-8 max-w-4xl mx-auto w-full space-y-6">
        <div className="flex justify-between items-center mb-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[1,2,3].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto w-full space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Auto-Moderation</h1>
          <p className="text-muted-foreground mt-1">Keep your server clean automatically.</p>
        </div>
        <Button onClick={handleSave} disabled={updateSettings.isPending} className="shadow-sm">
          {updateSettings.isPending ? "Saving..." : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <div className="space-y-6">
        {/* Word Filter */}
        <Card className={`transition-opacity duration-200 ${!localSettings.word_filter.enabled ? "opacity-60" : ""}`}>
          <CardHeader className="flex flex-row items-start justify-between pb-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Word Filter
              </CardTitle>
              <CardDescription>Delete messages containing specific words.</CardDescription>
            </div>
            <Switch 
              checked={localSettings.word_filter.enabled}
              onCheckedChange={(checked) => setLocalSettings({
                ...localSettings,
                word_filter: { ...localSettings.word_filter, enabled: checked }
              })}
            />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Label>Banned Words</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Type a word and press Enter..." 
                  value={wordInput}
                  onChange={(e) => setWordInput(e.target.value)}
                  onKeyDown={handleAddWord}
                  disabled={!localSettings.word_filter.enabled}
                  className="max-w-xs"
                />
                <Button 
                  variant="secondary" 
                  onClick={handleAddWord}
                  disabled={!localSettings.word_filter.enabled || !wordInput.trim()}
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-4 min-h-[2rem]">
                {localSettings.word_filter.words.map((word: string) => (
                  <div key={word} className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm">
                    <span>{word}</span>
                    <button 
                      className="text-muted-foreground hover:text-destructive focus:outline-none"
                      onClick={() => handleRemoveWord(word)}
                      disabled={!localSettings.word_filter.enabled}
                      title="Remove word"
                    >
                      &times;
                    </button>
                  </div>
                ))}
                {localSettings.word_filter.words.length === 0 && (
                  <span className="text-sm text-muted-foreground italic flex items-center h-8">No words banned yet.</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Anti Spam */}
        <Card className={`transition-opacity duration-200 ${!localSettings.anti_spam.enabled ? "opacity-60" : ""}`}>
          <CardHeader className="flex flex-row items-start justify-between pb-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <MessageSquareX className="w-5 h-5 text-primary" />
                Anti-Spam
              </CardTitle>
              <CardDescription>Prevent users from sending too many messages too quickly.</CardDescription>
            </div>
            <Switch 
              checked={localSettings.anti_spam.enabled}
              onCheckedChange={(checked) => setLocalSettings({
                ...localSettings,
                anti_spam: { ...localSettings.anti_spam, enabled: checked }
              })}
            />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl">
              <div className="space-y-2">
                <Label htmlFor="max_messages">Max Messages</Label>
                <Input 
                  id="max_messages"
                  type="number"
                  min={1}
                  value={localSettings.anti_spam.max_messages}
                  onChange={(e) => setLocalSettings({
                    ...localSettings,
                    anti_spam: { ...localSettings.anti_spam, max_messages: parseInt(e.target.value) || 1 }
                  })}
                  disabled={!localSettings.anti_spam.enabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="window_seconds">Time Window (seconds)</Label>
                <Input 
                  id="window_seconds"
                  type="number"
                  min={1}
                  value={localSettings.anti_spam.window_seconds}
                  onChange={(e) => setLocalSettings({
                    ...localSettings,
                    anti_spam: { ...localSettings.anti_spam, window_seconds: parseInt(e.target.value) || 1 }
                  })}
                  disabled={!localSettings.anti_spam.enabled}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Anti Link */}
        <Card className={`transition-opacity duration-200 ${!localSettings.anti_link.enabled ? "opacity-60" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Link2Off className="w-5 h-5 text-primary" />
                Anti-Link
              </CardTitle>
              <CardDescription>Delete messages containing URLs (except for server admins).</CardDescription>
            </div>
            <Switch 
              checked={localSettings.anti_link.enabled}
              onCheckedChange={(checked) => setLocalSettings({
                ...localSettings,
                anti_link: { ...localSettings.anti_link, enabled: checked }
              })}
            />
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}