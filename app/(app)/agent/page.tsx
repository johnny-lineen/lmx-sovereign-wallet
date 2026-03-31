import { ActionCenter } from "@/components/actions/action-center";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export default function AgentPage() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Agent</CardTitle>
          <p className="text-sm text-muted-foreground">
            Advisory-only control surface for transparent digital-identity hardening.
          </p>
        </CardHeader>
        <CardContent>
          <Textarea
            readOnly
            value="Your recommended remediation actions are generated from deterministic insights and tracked below."
            className="min-h-[120px] resize-none bg-muted/30"
          />
        </CardContent>
      </Card>
      <ActionCenter />
    </div>
  );
}
