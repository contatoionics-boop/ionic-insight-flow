import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PageHeader, Card, Button, Textarea, Modal } from "@/components/ui-bits";
import { ArrowLeft, Check, AlertCircle, FileDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { gerarPdfMapeamento } from "@/lib/casos-pdf.functions";

export const Route = createFileRoute("/app/review/$id")({
  component: ReviewCasePage,
});

type Caso = {
  id: string;
  codigo: string;
  status: string;
  unidade: { nome: string; matriz: { nome: string; empresa: { nome: string } | null } | null } | null;
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
  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const gerarPdf = useServerFn(gerarPdfMapeamento);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("casos")
        .select("id, codigo, status, unidade:unidades(nome, matriz:matrizes(nome, empresa:empresas(nome))), agente:profiles!agente_id(nome)")
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

  const baixarPdf = async () => {
    if (!caseData) return;
    setDownloading(true);
    setPdfError(null);
    try {
      const out = await gerarPdf({ data: { casoId: caseData.id } });
      const binary = atob(out.contentBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: out.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = out.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "Falha ao gerar PDF.");
    } finally {
      setDownloading(false);
    }
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
        description={`${caseData.unidade?.matriz?.empresa?.nome ?? "—"}${caseData.unidade?.nome ? ` · ${caseData.unidade.nome}` : ""} · Agente ${caseData.agente?.nome ?? "—"}`}
        actions={
          <>
            <Button variant="outline" onClick={baixarPdf} disabled={downloading}>
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Baixar PDF
            </Button>
            <Button variant="outline" onClick={() => setReopenOpen(true)}>
              <AlertCircle className="h-4 w-4" /> Solicitar reenvio
            </Button>
            <Button variant="success" onClick={() => setApproveOpen(true)}>
              <Check className="h-4 w-4" /> Aprovar
            </Button>
          </>
        }
      />

      {pdfError && (
        <Card className="mb-3 border-destructive/30 bg-destructive/5">
          <p className="text-sm text-destructive">{pdfError}</p>
        </Card>
      )}


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
