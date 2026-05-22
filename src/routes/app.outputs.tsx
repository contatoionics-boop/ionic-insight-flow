import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Card, Toggle, Input, Label, Button, Badge } from "@/components/ui-bits";
import { outputConfig } from "@/lib/mock-data";
import { X } from "lucide-react";

export const Route = createFileRoute("/app/outputs")({
  component: OutputsPage,
});

function OutputsPage() {
  const [emailOn, setEmailOn] = useState(outputConfig.email.enabled);
  const [asanaOn, setAsanaOn] = useState(outputConfig.asana.enabled);
  const [tifluxOn, setTifluxOn] = useState(outputConfig.tiflux.enabled);
  const [recipients, setRecipients] = useState<string[]>(outputConfig.email.recipients);
  const [newEmail, setNewEmail] = useState("");

  const addEmail = () => {
    if (newEmail && !recipients.includes(newEmail)) {
      setRecipients([...recipients, newEmail]);
      setNewEmail("");
    }
  };

  return (
    <div>
      <PageHeader
        title="Configuração de saída"
        description="Defina onde os relatórios finais serão entregues."
      />

      <div className="space-y-3">
        <Toggle label="E-mail" checked={emailOn} onChange={setEmailOn} />
        <Toggle label="Asana" checked={asanaOn} onChange={setAsanaOn} />
        <Toggle label="Tiflux" checked={tifluxOn} onChange={setTifluxOn} />
      </div>

      {emailOn && (
        <Card className="mt-6">
          <Label>Destinatários de e-mail</Label>
          <div className="mb-3 flex flex-wrap gap-2">
            {recipients.map((r) => (
              <Badge key={r} className="bg-accent text-accent-foreground gap-1.5">
                {r}
                <button onClick={() => setRecipients(recipients.filter((x) => x !== r))}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="novo@email.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
            />
            <Button onClick={addEmail}>Adicionar</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
