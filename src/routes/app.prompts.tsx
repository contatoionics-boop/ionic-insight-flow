import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Card, Textarea, Label, Button } from "@/components/ui-bits";
import { aiPrompts } from "@/lib/mock-data";

export const Route = createFileRoute("/app/prompts")({
  component: PromptsPage,
});

function PromptsPage() {
  const [vals, setVals] = useState(aiPrompts);

  const update = (k: keyof typeof aiPrompts, v: string) =>
    setVals((s) => ({ ...s, [k]: v }));

  return (
    <div>
      <PageHeader
        title="Configuração de prompts"
        description="Edite os prompts utilizados em cada módulo de IA."
      />
      <div className="space-y-4">
        <Card>
          <Label>Validação de imagem</Label>
          <Textarea rows={4} value={vals.validacao_imagem} onChange={(e) => update("validacao_imagem", e.target.value)} />
        </Card>
        <Card>
          <Label>Transcrição de áudio</Label>
          <Textarea rows={4} value={vals.transcricao_audio} onChange={(e) => update("transcricao_audio", e.target.value)} />
        </Card>
        <Card>
          <Label>Geração de relatório</Label>
          <Textarea rows={6} value={vals.geracao_relatorio} onChange={(e) => update("geracao_relatorio", e.target.value)} />
        </Card>
        <div className="flex justify-end">
          <Button>Salvar alterações</Button>
        </div>
      </div>
    </div>
  );
}
