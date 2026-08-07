import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Badge, Modal } from "@/components/ui-bits";
import { getResumoRespostas, type ResumoRespostas } from "@/lib/agente-progresso.functions";

export function ResumoRespostasModal({
  casoId,
  open,
  onClose,
}: {
  casoId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const load = useServerFn(getResumoRespostas);
  const [data, setData] = useState<ResumoRespostas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !casoId) return;
    setLoading(true);
    setErro(null);
    setData(null);
    load({ data: { casoId } })
      .then((r) => setData(r))
      .catch((e: any) => setErro(e?.message ?? "Não foi possível carregar as respostas."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, casoId]);

  const respondidas = data?.itens.filter((i) => i.resposta) ?? [];
  const pendentesObrig = data?.itens.filter((i) => !i.resposta && i.obrigatoria) ?? [];
  const pendentesOpcionais = data?.itens.filter((i) => !i.resposta && !i.obrigatoria) ?? [];
  const totalObrig = data?.itens.filter((i) => i.obrigatoria).length ?? 0;
  const respObrig = data?.itens.filter((i) => i.obrigatoria && i.resposta).length ?? 0;


  return (
    <Modal open={open} onClose={onClose} title="Respostas já preenchidas">
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando respostas...</p>
      ) : erro ? (
        <p className="text-sm text-destructive">{erro}</p>
      ) : data ? (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <p className="text-sm font-semibold text-foreground">{data.formularioNome}</p>
            <p className="text-xs text-muted-foreground">{data.clienteNome}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {respObrig} de {totalObrig} obrigatórias respondidas · {respondidas.length} de{" "}
              {data.itens.length} no total
            </p>
          </div>

          {respondidas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma resposta registrada ainda.</p>
          ) : (
            <div className="space-y-2">
              {respondidas.map((i) => (
                <div key={i.perguntaId} className="rounded-md border border-border bg-muted/20 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{i.secao}</p>
                  <p className="text-sm font-medium text-foreground">{i.pergunta}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{i.resposta}</p>
                </div>
              ))}
            </div>
          )}

          {pendentesObrig.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-destructive">
                Obrigatórias pendentes <Badge className="ml-1">{pendentesObrig.length}</Badge>
              </p>
              <ul className="space-y-1">
                {pendentesObrig.map((i) => (
                  <li key={i.perguntaId} className="text-sm text-muted-foreground">
                    • {i.pergunta}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pendentesOpcionais.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">
                Opcionais pendentes <Badge className="ml-1">{pendentesOpcionais.length}</Badge>
              </p>
              <ul className="space-y-1">
                {pendentesOpcionais.map((i) => (
                  <li key={i.perguntaId} className="text-sm text-muted-foreground">
                    • {i.pergunta}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      ) : null}
    </Modal>
  );
}
