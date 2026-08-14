import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Loader2, Microscope, Undo2 } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui-bits";
import { decidirAchadoLaudo } from "@/lib/laudo.functions";
import type { Achado } from "@/lib/laudo/analise/achados";
import type { LaudoConteudo } from "@/lib/laudo/tipos";

type Props = {
  casoId: string;
  achados: Achado[];
  descartados: string[];
  onAtualizar: (r: {
    conteudo: LaudoConteudo;
    achados: Achado[];
    descartados: string[];
  }) => void;
};

const SECAO_ROTULO: Record<string, string> = {
  "2.1": "2.1 Equipamentos de TI",
  "2.2": "2.2 Transferência de dados",
  "2.3": "2.3 Objeto do mapeamento",
  "2.4": "2.4 Bicos de abastecimento",
};

export function AnaliseTecnicaPanel({ casoId, achados, descartados, onAtualizar }: Props) {
  const fnDecidir = useServerFn(decidirAchadoLaudo);
  const [emAndamento, setEmAndamento] = useState<string | null>(null);

  async function decidir(chave: string, decisao: "aceitar" | "descartar") {
    setEmAndamento(chave);
    try {
      const r = await fnDecidir({ data: { casoId, chave, decisao } });
      onAtualizar(r as any);
      toast.success(decisao === "descartar" ? "Achado descartado." : "Achado reincluído.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao atualizar a análise.");
    } finally {
      setEmAndamento(null);
    }
  }

  if (!achados.length) {
    return (
      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Microscope className="h-4 w-4" /> Análise técnica
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Nenhuma conclusão técnica foi derivada ainda. Gere/regere o laudo depois que o formulário
          FR-29-10 estiver preenchido.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <p className="mb-1 flex items-center gap-2 text-sm font-medium">
        <Microscope className="h-4 w-4" /> Análise técnica
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        Conclusões derivadas dos dados do mapeamento (proposta + FR-29-10). Descarte o que não se
        aplica; o documento é remontado automaticamente.
      </p>
      <div className="space-y-3">
        {achados.map((a) => {
          const off = descartados.includes(a.chave);
          return (
            <div
              key={a.chave}
              className={`rounded-lg border p-3 text-sm ${
                off ? "border-dashed border-border opacity-60" : "border-border"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{a.titulo}</span>
                <Badge className="bg-muted text-muted-foreground">
                  {SECAO_ROTULO[a.secao] ?? a.secao}
                </Badge>
                {a.severidade === "atencao" && (
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    atenção
                  </Badge>
                )}
                {off && <Badge className="bg-muted text-muted-foreground">descartado</Badge>}
              </div>

              <p className="mt-2 text-muted-foreground">{a.conclusao}</p>

              {a.recomendacoes.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {a.recomendacoes.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}

              {a.evidencias.length > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  <span className="font-medium">Evidências:</span>{" "}
                  {a.evidencias.map((e) => `${e.rotulo}: ${e.valor}`).join(" · ")}
                </p>
              )}

              <Button
                className="mt-2"
                variant="secondary"
                disabled={emAndamento === a.chave}
                onClick={() => decidir(a.chave, off ? "aceitar" : "descartar")}
              >
                {emAndamento === a.chave ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : off ? (
                  <Undo2 className="mr-2 h-4 w-4" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                {off ? "Reincluir no laudo" : "Descartar do laudo"}
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
