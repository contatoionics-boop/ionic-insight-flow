import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Card, Button, Textarea, Modal, Badge } from "@/components/ui-bits";
import { cases } from "@/lib/mock-data";
import { ArrowLeft, Check, AlertCircle, Pencil } from "lucide-react";

export const Route = createFileRoute("/app/review/$id")({
  component: ReviewCasePage,
});

const mockReport = [
  {
    section: "Identificação do veículo",
    content: "Veículo Fiat Strada, placa BRA-2E19, em bom estado de conservação. Hodômetro registrando 87.450 km.",
    photos: 2,
    audio: "Áudio: \"Veículo recebido em condições normais...\" (32s)",
  },
  {
    section: "Equipamento instalado",
    content: "Rastreador modelo IO-450 instalado sob o painel. Sensor de combustível conectado. Sinal verificado e estável.",
    photos: 4,
    audio: "Áudio: \"Instalação concluída sem intercorrências...\" (1m 12s)",
  },
  {
    section: "Finalização",
    content: "Sistema testado em movimento por 5 minutos. Dados chegando corretamente à plataforma.",
    photos: 1,
    audio: null,
  },
];

function ReviewCasePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const caseData = cases.find((c) => c.id === id);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);

  if (!caseData) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">Caso não encontrado.</p>
        <Link to="/app/review-queue" className="mt-2 inline-block text-sm text-primary hover:underline">
          Voltar para fila
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/app/review-queue"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para fila
      </Link>

      <PageHeader
        title={`Revisão ${caseData.id}`}
        description={`${caseData.clientName} · Agente ${caseData.agent}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setReopenOpen(true)}>
              <AlertCircle className="h-4 w-4" /> Solicitar reenvio
            </Button>
            <Button variant="success" onClick={() => setApproveOpen(true)}>
              <Check className="h-4 w-4" /> Aprovar
            </Button>
          </>
        }
      />

      <div className="space-y-4">
        {mockReport.map((s, idx) => (
          <Card key={s.section}>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="md:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{s.section}</h3>
                  <button
                    onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                </div>
                {editingIdx === idx ? (
                  <Textarea rows={5} defaultValue={s.content} />
                ) : (
                  <p className="text-sm leading-relaxed text-foreground">{s.content}</p>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Fotos ({s.photos})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: s.photos }).map((_, i) => (
                      <div
                        key={i}
                        className="flex h-16 w-16 items-center justify-center rounded-md border border-border bg-muted text-xs text-muted-foreground"
                      >
                        IMG {i + 1}
                      </div>
                    ))}
                  </div>
                </div>
                {s.audio && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Áudio
                    </p>
                    <Badge className="bg-accent text-accent-foreground">{s.audio}</Badge>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={reopenOpen} onClose={() => setReopenOpen(false)} title="Solicitar reenvio">
        <p className="mb-3 text-sm text-muted-foreground">
          Descreva o que precisa ser refeito pelo agente:
        </p>
        <Textarea rows={5} placeholder="Ex: foto do hodômetro está borrada, refazer..." />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setReopenOpen(false)}>Cancelar</Button>
          <Button onClick={() => { setReopenOpen(false); navigate({ to: "/app/review-queue" }); }}>
            Enviar solicitação
          </Button>
        </div>
      </Modal>

      <Modal open={approveOpen} onClose={() => setApproveOpen(false)} title="Aprovar relatório">
        <p className="text-sm text-foreground">
          Confirma a aprovação do caso <strong>{caseData.id}</strong>? O relatório será enviado
          conforme as configurações de saída.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancelar</Button>
          <Button variant="success" onClick={() => { setApproveOpen(false); navigate({ to: "/app/history" }); }}>
            Confirmar aprovação
          </Button>
        </div>
      </Modal>
    </div>
  );
}
