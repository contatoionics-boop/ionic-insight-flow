import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Button, Card, Badge } from "@/components/ui-bits";
import { forms, type FormDef } from "@/lib/mock-data";
import { Plus, ChevronRight, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/app/forms")({
  component: FormsPage,
});

function FormsPage() {
  const [selected, setSelected] = useState<FormDef | null>(null);

  if (selected) {
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para formulários
        </button>
        <PageHeader
          title={selected.name}
          description={`Cliente: ${selected.clientName}`}
          actions={<Button><Plus className="h-4 w-4" /> Nova seção</Button>}
        />
        <div className="space-y-4">
          {selected.sections.map((s) => (
            <Card key={s.id}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                <Button variant="outline" size="sm"><Plus className="h-3.5 w-3.5" /> Pergunta</Button>
              </div>
              <ul className="divide-y divide-border">
                {s.questions.map((q) => (
                  <li key={q.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{q.text}</p>
                      <div className="mt-1 flex gap-2">
                        <Badge className="bg-accent text-accent-foreground">{q.type}</Badge>
                        {q.required && <Badge className="bg-warning/20 text-warning-foreground">Obrigatória</Badge>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Formulários"
        description="Roteiros de vistoria por cliente."
        actions={<Button><Plus className="h-4 w-4" /> Novo formulário</Button>}
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {forms.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelected(f)}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-5 text-left shadow-sm transition-colors hover:bg-muted"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">{f.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {f.clientName} · {f.sections.length} seções
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}
