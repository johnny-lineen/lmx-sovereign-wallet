import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export default function AgentPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent</CardTitle>
        <p className="text-sm text-muted-foreground">
          The sovereign agent will run here with your scoped context.
        </p>
      </CardHeader>
      <CardContent>
        <Textarea
          readOnly
          placeholder="Agent logic is not connected in Phase 1."
          className="min-h-[160px] resize-none bg-muted/30"
        />
      </CardContent>
    </Card>
  );
}
