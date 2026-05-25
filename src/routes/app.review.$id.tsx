import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Card, Button, Textarea, Modal } from "@/components/ui-bits";
import { ArrowLeft, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/review/$id")({
  component: ReviewCasePage,
});

type Caso = {
  id: string;
  codigo: string;
  status: string;
  cliente: { nome: string } | null;
  agente: { nome: string } | null;
};

function ReviewCasePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<Caso | null>(null);
  const [loading, setLoading] = useState(true);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("casos")
        .select("id, codigo, status, cliente:clientes(nome), agente:profiles!agente_id(nome)")
        .eq("id", id)
        .maybeSingle();
      setCaseData((data as unknown as Caso) ?? null);
      setLoading(false);
    })();
  }, [id]);

  const approve = async () => {
    if (!caseData) return;
    setWorking(true);
    await supabase.from("casos").update({ status: "aprovado" }).eq("id", caseData.id);
    setApproveOpen(false);
    navigate({ to: "/app/history" });
  };

  const reopen = async () => {
    if (!caseData) return;
    setWorking(true);
    await supabase.from("casos").update({ status: "em_analise" }).eq("id", caseData.id);
    setReopenOpen(false);
    navigate({ to: "/app/review-queue" });
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

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
        title={`Revisão ${caseData.codigo}`}
        description={`${caseData.cliente?.nome ?? "—"} · Agente ${caseData.agente?.nome ?? "—"}`}
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

      <Card>
        <p className="text-sm text-muted-foreground">
          O conteúdo coletado pelo agente técnico (fotos, transcrições e respostas) será exibido aqui
          assim que o fluxo de campo estiver concluído. Por enquanto você pode aprovar ou solicitar
          reenvio do caso.
        </p>
      </Card>

      <Modal open={reopenOpen} onClose={() => setReopenOpen(false)} title="Solicitar reenvio">
        <p className="mb-3 text-sm text-muted-foreground">
          Descreva o que precisa ser refeito pelo agente:
        </p>
        <Textarea
          rows={5}
          value={reopenReason}
          onChange={(e) => setReopenReason(e.target.value)}
          placeholder="Ex: foto do hodômetro está borrada, refazer..."
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setReopenOpen(false)} disabled={working}>
            Cancelar
          </Button>
          <Button onClick={reopen} disabled={working}>
            Enviar solicitação
          </Button>
        </div>
      </Modal>

      <Modal open={approveOpen} onClose={() => setApproveOpen(false)} title="Aprovar relatório">
        <p className="text-sm text-foreground">
          Confirma a aprovação do caso <strong>{caseData.codigo}</strong>? O relatório será enviado
          conforme as configurações de saída.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={working}>
            Cancelar
          </Button>
          <Button variant="success" onClick={approve} disabled={working}>
            Confirmar aprovação
          </Button>
        </div>
      </Modal>
    </div>
  );
}
