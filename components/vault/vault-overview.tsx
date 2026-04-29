import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { VaultLibraryDTO } from "@/server/services/vault.service";

function TypePill({ type }: { type: string }) {
  return (
    <span className="rounded-full border border-cyan-300/35 bg-slate-900/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-cyan-100/80">
      {type.replaceAll("_", " ")}
    </span>
  );
}

function sortTypes(types: string[]): string[] {
  const order = ["email", "account", "subscription", "device", "payment_method_reference"];
  const rank = (t: string) => {
    const i = order.indexOf(t);
    return i === -1 ? 1000 : i;
  };
  return [...types].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export function VaultOverview({
  library,
  clerkUserId,
}: {
  library: VaultLibraryDTO;
  /** Same as Clerk `auth().userId` — vault rows are keyed to this string. */
  clerkUserId: string;
}) {
  if (library.items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No vault items yet</CardTitle>
          <CardDescription className="space-y-3 text-pretty">
            <p>
              Vault data is stored per <strong>Clerk User ID</strong> (not your email). This session&apos;s id is:
            </p>
            <p>
              <code className="break-all rounded bg-muted px-2 py-1 font-mono text-xs">{clerkUserId}</code>
            </p>
            <p>
              <strong>If you already seeded:</strong> run <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">npm run db:peek</code> and check which <code className="font-mono text-xs">clerkUserId</code> has{" "}
              <code className="font-mono text-xs">vaultItems: 21</code>. It must match the id above character-for-character.
            </p>
            <p>
              <strong>Fix A — reseed:</strong> set{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">SEED_CLERK_USER_ID</code> in{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env.local</code> to that exact id (copy from
              above), then <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">npm run db:seed</code>.
            </p>
            <p>
              <strong>Fix B — move rows:</strong> set{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">VAULT_OWNER_CLERK_USER_ID</code> in{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env.local</code> to the id above, then{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">npm run db:align-vault</code> (moves items from
              another user that still has seed data). Optional:{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">VAULT_MOVE_FROM_CLERK_USER_ID</code> for the
              source row from <code className="font-mono text-xs">db:peek</code>.
            </p>
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const byType = new Map<string, VaultLibraryDTO["items"]>();
  for (const item of library.items) {
    const list = byType.get(item.type) ?? [];
    list.push(item);
    byType.set(item.type, list);
  }
  const types = sortTypes([...byType.keys()]);
  const emailItems = library.items.filter((i) => i.type === "email");
  const accountLike = library.items.filter((i) => i.type === "account" || i.type === "subscription");
  const distinctProviders = new Set(
    accountLike.map((i) => i.provider?.trim().toLowerCase()).filter((p): p is string => Boolean(p)),
  ).size;
  const providerToEmails = new Map<string, Set<string>>();
  for (const rel of library.relationships) {
    const from = library.items.find((i) => i.id === rel.fromItemId);
    const to = library.items.find((i) => i.id === rel.toItemId);
    if (!from || !to) continue;
    if (from.type === "email" && (to.type === "account" || to.type === "subscription")) {
      const k = (to.provider ?? to.title).trim();
      if (!providerToEmails.has(k)) providerToEmails.set(k, new Set());
      providerToEmails.get(k)!.add(from.id);
    }
    if (to.type === "email" && (from.type === "account" || from.type === "subscription")) {
      const k = (from.provider ?? from.title).trim();
      if (!providerToEmails.has(k)) providerToEmails.set(k, new Set());
      providerToEmails.get(k)!.add(to.id);
    }
  }
  const highFrag = [...providerToEmails.entries()]
    .filter(([, ids]) => ids.size > 1)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 5);

  const initialFor = (title: string) => {
    const first = title.trim().charAt(0);
    return first ? first.toUpperCase() : "?";
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-baseline gap-3">
        <p className="text-sm text-cyan-100/75">
          <span className="font-medium text-cyan-50">{library.items.length}</span> items ·{" "}
          <span className="font-medium text-cyan-50">{library.relationships.length}</span> relationships
        </p>
        <p className="text-sm text-cyan-100/75">
          <span className="font-medium text-cyan-50">{emailItems.length}</span> emails ·{" "}
          <span className="font-medium text-cyan-50">{distinctProviders}</span> providers
        </p>
      </div>
      {highFrag.length > 0 ? (
        <p className="text-xs text-cyan-100/65">
          High-fragmentation clusters: {highFrag.map(([p, ids]) => `${p} (${ids.size} emails)`).join(" · ")}
        </p>
      ) : null}

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-medium tracking-tight text-cyan-50">Vault items</h3>
          <p className="text-sm text-cyan-100/70">Grouped by type. Open metadata for full JSON.</p>
        </div>
        <div className="space-y-8">
          {types.map((type) => (
            <div key={type}>
              <div className="mb-3 flex items-center gap-2">
                <TypePill type={type} />
                <span className="text-xs text-cyan-100/65">{(byType.get(type) ?? []).length} items</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {(byType.get(type) ?? []).map((item) => (
                  <Card key={item.id} size="sm" className="border-cyan-400/35 bg-slate-950/85 shadow-[0_0_0_1px_rgba(56,189,248,0.08)]">
                    <CardHeader className="pb-2">
                      <div className="flex gap-3">
                        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-cyan-300/35 bg-slate-800/90 text-sm font-semibold text-cyan-100">
                          {initialFor(item.title)}
                        </span>
                        <div className="min-w-0">
                          <CardTitle className="truncate text-sm leading-snug text-cyan-50">{item.title}</CardTitle>
                          {item.summary ? (
                            <CardDescription className="line-clamp-2 text-cyan-100/65">{item.summary}</CardDescription>
                          ) : null}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      <div className="flex flex-wrap gap-2 text-xs text-cyan-100/70">
                        {item.provider ? (
                          <span className="rounded border border-cyan-300/30 bg-slate-900/80 px-1.5 py-0.5">
                            {item.provider}
                          </span>
                        ) : null}
                        <span className="rounded border border-cyan-300/35 bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] uppercase text-cyan-200/85">
                          {item.status}
                        </span>
                      </div>
                      {item.metadata != null ? (
                        <details className="rounded-md border border-cyan-300/25 bg-slate-900/70 p-2">
                          <summary className="cursor-pointer text-xs text-cyan-100/70">Metadata</summary>
                          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-relaxed text-cyan-100/80">
                            {JSON.stringify(item.metadata, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-medium tracking-tight text-cyan-50">Relationships</h3>
          <p className="text-sm text-cyan-100/70">Edges between vault items for the signed-in account.</p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-cyan-400/30 bg-slate-950/80">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="border-b border-cyan-300/25 bg-slate-900/70">
              <tr>
                <th className="px-3 py-2 font-medium">From</th>
                <th className="px-3 py-2 font-medium">Relation</th>
                <th className="px-3 py-2 font-medium">To</th>
                <th className="px-3 py-2 font-medium">Meta</th>
              </tr>
            </thead>
            <tbody>
              {library.relationships.map((rel) => (
                <tr key={rel.id} className="border-b border-cyan-300/20 last:border-0">
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium text-cyan-50">{rel.fromTitle}</div>
                    <div className="mt-0.5">
                      <TypePill type={rel.fromType} />
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top font-mono text-xs text-cyan-100/70">{rel.relationType}</td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium text-cyan-50">{rel.toTitle}</div>
                    <div className="mt-0.5">
                      <TypePill type={rel.toType} />
                    </div>
                  </td>
                  <td className="max-w-[220px] px-3 py-2 align-top text-xs text-cyan-100/70">
                    {rel.metadata != null ? (
                      <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all text-[11px]">
                        {JSON.stringify(rel.metadata)}
                      </pre>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
