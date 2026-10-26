import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button, Modal } from "@/components/ui-bits";
import { baixarBase64 } from "@/lib/baixar-pdf";
import { gerarPdfLaudo } from "@/lib/laudo.functions";

type Modo = "baixar" | "visualizar";

/** O servidor recusa o PDF enquanto há [CONFIRMAR] ou alerta técnico sem ciência; o usuário pode seguir mesmo assim. */
const ehPendencia = (msg: string) => /pendência\(s\) \[CONFIRMAR\]|alertas técnicos bloqueantes/.test(msg);

/**
 * Botões "Pré-visualizar" e "Gerar PDF" do resultado do mapeamento (usados na lista, no detalhe e depois da aprovação).
 * Se o documento tiver pendências, mostra o motivo e pergunta se quer gerar mesmo assim.
 */
export function AcoesPdfResultado({
  casoId,
  codigo,
  tamanho = "sm",
  aoBaixar,
}: {
  casoId: string;
  codigo?: string | null;
  tamanho?: "sm" | "md";
  /** chamado depois que o PDF foi baixado */
  aoBaixar?: () => void;
}) {
  const gerar = useServerFn(gerarPdfLaudo);
  const [ocupado, setOcupado] = useState<Modo | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [pendencia, setPendencia] = useState<{ modo: Modo; mensagem: string } | null>(null);

  useEffect(() => () => {
    if (previa) URL.revokeObjectURL(previa);
  }, [previa]);

  async function executar(modo: Modo, ignorarPendencias = false) {
    setOcupado(modo);
    try {
      const out = await gerar({ data: { casoId, ignorarPendencias } });
      if (modo === "baixar") {
        baixarBase64(out);
        toast.success(`PDF${codigo ? ` do mapeamento ${codigo}` : ""} gerado.`);
        aoBaixar?.();
      } else {
        const bin = atob(out.contentBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        setPrevia(URL.createObjectURL(new Blob([bytes], { type: out.mimeType })));
      }
    } catch (e: any) {
      const mensagem = e?.message ?? "Não foi possível gerar o PDF.";
      if (!ignorarPendencias && ehPendencia(mensagem)) setPendencia({ modo, mensagem });
      else toast.error(mensagem);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <>
      <div className="inline-flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
        <Button size={tamanho} variant="outline" onClick={() => void executar("visualizar")} disabled={ocupado !== null} title="Ver o PDF antes de baixar">
          {ocupado === "visualizar" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1 h-3.5 w-3.5" />} Pré-visualizar
        </Button>
        <Button size={tamanho} variant="outline" onClick={() => void executar("baixar")} disabled={ocupado !== null} title="Gerar e baixar o PDF do resultado">
          {ocupado === "baixar" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1 h-3.5 w-3.5" />} Gerar PDF
        </Button>
      </div>

      <Modal open={!!pendencia} onClose={() => setPendencia(null)} title="O documento tem pendências">
        <p className="text-sm text-foreground">{pendencia?.mensagem}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Se gerar agora, os trechos pendentes saem escritos como <span className="font-mono">[CONFIRMAR: …]</span> no PDF.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setPendencia(null)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              const p = pendencia;
              setPendencia(null);
              if (p) void executar(p.modo, true);
            }}
          >
            {pendencia?.modo === "visualizar" ? "Pré-visualizar mesmo assim" : "Gerar mesmo assim"}
          </Button>
        </div>
      </Modal>

      <Modal open={!!previa} onClose={() => setPrevia(null)} title={`Pré-visualização${codigo ? ` — ${codigo}` : ""}`}>
        {previa && <iframe src={previa} title="Pré-visualização do PDF" className="h-[70vh] w-full rounded-md border border-border" />}
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setPrevia(null)}>
            Fechar
          </Button>
          <Button
            onClick={() => {
              setPrevia(null);
              void executar("baixar", true);
            }}
          >
            Baixar PDF
          </Button>
        </div>
      </Modal>
    </>
  );
}
