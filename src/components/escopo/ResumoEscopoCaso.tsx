import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { carregarEscopoEstrutura } from "@/lib/escopo.functions";
import { ResumoEscopo, type EntidadeResumo } from "@/components/escopo/ResumoEscopo";

/** Carrega a estrutura do Escopo de um caso e mostra o resumo + orientações. */
export function ResumoEscopoCaso({
  casoId,
  orientacoes,
  compacto,
  className,
}: {
  casoId: string;
  orientacoes?: string | null;
  compacto?: boolean;
  className?: string;
}) {
  const carregar = useServerFn(carregarEscopoEstrutura);
  const [estado, setEstado] = useState<{ entidades: EntidadeResumo[]; numero: number | null } | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let vivo = true;
    setEstado(null);
    setFalhou(false);
    carregar({ data: { casoId } })
      .then((r) => {
        if (!vivo) return;
        setEstado({
          numero: r.numero ?? null,
          entidades: (r.entidades ?? []).map((e: any) => ({
            id: e.id,
            tipo: e.tipo,
            parentId: e.parent_id ?? null,
            ordem: e.ordem,
            rotulo: e.rotulo,
          })),
        });
      })
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
    };
  }, [casoId, carregar]);

  if (falhou) {
    return orientacoes?.trim() ? (
      <ResumoEscopo className={className} entidades={[]} orientacoes={orientacoes} compacto />
    ) : null;
  }
  if (!estado) return <p className={`text-xs text-muted-foreground ${className ?? ""}`}>Carregando escopo…</p>;
  return (
    <ResumoEscopo
      className={className}
      entidades={estado.entidades}
      versao={estado.numero}
      orientacoes={orientacoes}
      compacto={compacto}
    />
  );
}
