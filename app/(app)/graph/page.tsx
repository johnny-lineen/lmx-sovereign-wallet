import { VaultGraphView } from "@/components/graph/vault-graph-view";
import { Suspense } from "react";

export default function GraphPage() {
  return (
    <Suspense fallback={<div className="min-h-[420px] w-full animate-pulse bg-[#0c0c0f]" />}>
      <VaultGraphView />
    </Suspense>
  );
}
