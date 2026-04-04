import { AppPageHeader } from "@/components/app-page-header";
import { ActionCenter } from "@/components/actions/action-center";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export default function AgentPage() {
  return (
    <div className="space-y-8">
      <AppPageHeader
        title="Agent"
        description="Advisory-only control surface for transparent digital-identity hardening."
      />
      <Card>
        <CardHeader>
          <CardTitle>Action planner</CardTitle>
          <p className="text-sm text-muted-foreground">
            Remediation steps are generated from deterministic insights and tracked below.
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
