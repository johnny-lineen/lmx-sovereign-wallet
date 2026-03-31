"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ActionStatus = "todo" | "in_progress" | "done" | "skipped";
type ActionPriority = "low" | "medium" | "high";

type UserAction = {
  id: string;
  title: string;
  description: string;
  status: ActionStatus;
  priority: ActionPriority;
  relatedItemIds: string[];
  metadata?: {
    insightCount?: number;
    estimatedMinutes?: number;
  } | null;
};

const STATUS_ORDER: ActionStatus[] = ["todo", "in_progress", "done", "skipped"];

export function ActionCenter() {
  const [actions, setActions] = useState<UserAction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/actions", { credentials: "same-origin" });
      if (!res.ok) {
        setError("Could not load advisory actions.");
        setActions([]);
        return;
      }
      const data = (await res.json()) as { actions?: UserAction[] };
      setActions(data.actions ?? []);
    } catch {
      setError("Could not load advisory actions.");
      setActions([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const items = actions ?? [];
    return {
      todo: items.filter((a) => a.status === "todo").length,
      in_progress: items.filter((a) => a.status === "in_progress").length,
      done: items.filter((a) => a.status === "done").length,
      skipped: items.filter((a) => a.status === "skipped").length,
    };
  }, [actions]);

  const updateStatus = async (id: string, status: ActionStatus) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/actions/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setError("Could not update action status.");
        return;
      }
      setActions((prev) => (prev ?? []).map((a) => (a.id === id ? { ...a, status } : a)));
    } catch {
      setError("Could not update action status.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Action Center</CardTitle>
        <CardDescription>
          Top 3-5 security actions prioritized for immediate risk reduction.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Focused queue: Todo {counts.todo} · In progress {counts.in_progress} · Done {counts.done} · Skipped {counts.skipped}
        </p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {actions === null ? (
          <p className="text-sm text-muted-foreground">Loading actions…</p>
        ) : actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No focused actions yet. Add more vault data or rerun ingestion.</p>
        ) : (
          <ul className="space-y-3">
            {actions.map((a) => (
              <li key={a.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Priority {a.priority} · Related items {a.relatedItemIds.length}
                      {typeof a.metadata?.insightCount === "number" ? ` · Insights ${a.metadata.insightCount}` : ""}
                      {typeof a.metadata?.estimatedMinutes === "number" ? ` · Est. ${a.metadata.estimatedMinutes}m` : ""}
                    </p>
                  </div>
                  <select
                    value={a.status}
                    disabled={busyId === a.id}
                    onChange={(e) => void updateStatus(a.id, e.target.value as ActionStatus)}
                    className="h-8 rounded border border-input bg-background px-2 text-xs"
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <pre className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {a.description}
                </pre>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Refresh actions
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
