import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Table, Th, Td, Badge } from "@/components/ui-bits";
import { statusLabels, statusTones, type CaseStatus } from "@/lib/casos";
import { listarMapeamentosComProgresso, type MapeamentoComProgresso } from "@/lib/mapeamento.functions";

export const Route = createFileRoute("/app/cases")({
  component: CasesPage,
});

function corBarra(pct: number) {
  if (pct <= 40) return "bg-red-500";
  if (pct < 80) return "bg-amber-500";
  return "bg-emerald-500";
}

function CasesPage() {
  const navigate = useNavigate();
  const listar = useServerFn(listarMapeamentosComProgresso);
  const [rows, setRows] = useState<MapeamentoComProgresso[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await listar();
        setRows(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [listar]);

  return (
    <div>
      <PageHeader title="Mapeamentos" description="Todos os mapeamentos da plataforma. Clique em uma linha para ver detalhes." />
      <Table>
        <thead>
          <tr>
            <Th>ID</Th>
            <Th>Cliente</Th>
            <Th>Agente</Th>
            <Th>Status</Th>
            <Th>Progresso</Th>
            <Th>Data</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">Carregando...</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum mapeamento registrado ainda.</td></tr>
          ) : (
            rows.map((c) => {
              const pct = c.total_obrigatorias > 0
                ? Math.round((c.respondidas_obrigatorias / c.total_obrigatorias) * 100)
                : 0;
              return (
                <tr
                  key={c.id}
                  onClick={() => navigate({ to: "/app/vistorias/$id", params: { id: c.id } })}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                >
                  <Td className="font-mono text-xs">
                    <div className="flex items-center gap-1">
                      {c.codigo}
                      {c.atrasado && (
                        <Badge className="bg-destructive/15 text-destructive">Aguardando agente</Badge>
                      )}
                    </div>
                  </Td>
                  <Td className="font-medium">{c.empresa_nome ?? "—"}{c.unidade_nome ? <span className="ml-1 text-xs text-muted-foreground">· {c.unidade_nome}</span> : null}</Td>
                  <Td>{c.agente_nome ?? "—"}</Td>
                  <Td><Badge className={statusTones[c.status as CaseStatus]}>{statusLabels[c.status as CaseStatus]}</Badge></Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {c.respondidas_obrigatorias}/{c.total_obrigatorias}
                      </span>
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full ${corBarra(pct)} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </Td>
                  <Td>{new Date(c.criado_em).toLocaleDateString("pt-BR")}</Td>
                </tr>
              );
            })
          )}
        </tbody>
      </Table>
    </div>
  );
}
