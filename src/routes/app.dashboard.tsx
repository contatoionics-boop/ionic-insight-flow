import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, StatCard, Card, Badge, Table, Th, Td } from "@/components/ui-bits";
import { statusLabels, statusTones, type CaseStatus } from "@/lib/casos";
import {
  listarMapeamentosComProgresso,
  type MapeamentoComProgresso,
} from "@/lib/mapeamento.functions";
import { listTechnicalAgents } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/app/dashboard")({
  component: DashboardPage,
});

type Agente = { id: string; user_id: string; nome: string };

const ABERTOS: CaseStatus[] = ["agendado", "em_andamento", "rascunho"];

function isHoje(iso: string | null) {
  if (!iso) return false;
  const d = new Date(iso);
  const h = new Date();
  return (
    d.getFullYear() === h.getFullYear() &&
    d.getMonth() === h.getMonth() &&
    d.getDate() === h.getDate()
  );
}

function DashboardPage() {
  const load = useServerFn(listarMapeamentosComProgresso);
  const loadAgentes = useServerFn(listTechnicalAgents);
  const [rows, setRows] = useState<MapeamentoComProgresso[]>([]);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [r, a] = await Promise.all([load(), loadAgentes()]);
      setRows((r ?? []) as MapeamentoComProgresso[]);
      setAgentes((a ?? []) as Agente[]);
      setLoading(false);
    })();
  }, [load, loadAgentes]);

  const stats = useMemo(() => {
    const abertos = rows.filter((c) => ABERTOS.includes(c.status as CaseStatus)).length;
    const revisao = rows.filter((c) => c.status === "aguardando_revisao").length;
    const aceitos = rows.filter((c) => c.aceite_status === "confirmado").length;
    const atrasados = rows.filter((c) => c.atrasado).length;
    const hoje = rows.filter((c) => isHoje(c.agendado_em)).length;
    const aprovados = rows.filter((c) => c.status === "aprovado").length;
    return { abertos, revisao, aceitos, atrasados, hoje, aprovados };
  }, [rows]);

  const resumoAgentes = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; total: number; abertos: number; atrasados: number }>();
    for (const a of agentes) {
      map.set(a.user_id, { id: a.user_id, nome: a.nome, total: 0, abertos: 0, atrasados: 0 });
    }
    for (const c of rows) {
      if (!c.agente_id) continue;
      let item = map.get(c.agente_id);
      if (!item) {
        item = { id: c.agente_id, nome: c.agente_nome ?? "—", total: 0, abertos: 0, atrasados: 0 };
        map.set(c.agente_id, item);
      }
      item.total += 1;
      if (ABERTOS.includes(c.status as CaseStatus)) item.abertos += 1;
      if (c.atrasado) item.atrasados += 1;
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [rows, agentes]);

  const recentes = useMemo(
    () =>
      [...rows]
        .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
        .slice(0, 6),
    [rows],
  );

  return (
    <div>
      <PageHeader title="Dashboard" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Mapeamentos em aberto" value={stats.abertos} hint="Em andamento" />
        <StatCard label="Aguardando revisão" value={stats.revisao} hint="Fila do especialista" />
        <StatCard label="Aceitos" value={stats.aceitos} hint="Confirmados pelo agente" />
        <StatCard label="Em atraso" value={stats.atrasados} hint="Prazo excedido" tone="danger" />
        <StatCard label="Mapeamentos hoje" value={stats.hoje} hint="Agendados para hoje" />
        <StatCard label="Aprovados" value={stats.aprovados} hint="Total no sistema" />
      </div>

      <div className="mt-8">
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-foreground">Agentes técnicos</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : resumoAgentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum agente técnico cadastrado.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Agente</Th>
                  <Th>Total de mapeamentos</Th>
                  <Th>Em aberto</Th>
                  <Th>Em atraso</Th>
                </tr>
              </thead>
              <tbody>
                {resumoAgentes.map((a) => (
                  <tr key={a.id}>
                    <Td className="font-medium">{a.nome}</Td>
                    <Td>{a.total}</Td>
                    <Td>{a.abertos}</Td>
                    <Td>
                      {a.atrasados > 0 ? (
                        <span className="font-semibold text-destructive">{a.atrasados}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-foreground">Mapeamentos recentes</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : recentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum mapeamento registrado ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentes.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      <Link
                        to="/app/vistorias/$id"
                        params={{ id: c.id }}
                        className="hover:underline"
                      >
                        {c.codigo}
                      </Link>{" "}
                      · {c.empresa_nome ?? "—"}
                      {c.unidade_nome ? ` · ${c.unidade_nome}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Badge className={statusTones[c.status as CaseStatus]}>
                    {statusLabels[c.status as CaseStatus]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
