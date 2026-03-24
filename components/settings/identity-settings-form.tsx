"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { identityUpdateSchema } from "@/lib/validations/identity";

type Props = {
  initialDisplayName: string | null;
  initialSummary: string | null;
};

export function IdentitySettingsForm({ initialDisplayName, initialSummary }: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [summary, setSummary] = useState(initialSummary ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = identityUpdateSchema.safeParse({
      displayName: displayName.trim() === "" ? null : displayName,
      summary: summary.trim() === "" ? null : summary,
    });
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const msg = [...(first.displayName ?? []), ...(first.summary ?? [])].join(" ");
      setError(msg || "Invalid input");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/identity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(ev) => setDisplayName(ev.target.value)}
          maxLength={120}
          autoComplete="name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="summary">Summary</Label>
        <Textarea
          id="summary"
          value={summary}
          onChange={(ev) => setSummary(ev.target.value)}
          maxLength={2000}
          rows={4}
          className="resize-y"
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save identity"}
      </Button>
    </form>
  );
}
