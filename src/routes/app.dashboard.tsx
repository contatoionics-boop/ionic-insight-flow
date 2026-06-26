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
const FINALIZADOS: CaseStatus[] = ["aguardando_revisao", "aprovado", "concluido", "cancelado"];

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

/** Aceite em atraso: agendado já está no passado (data corrida) e o agente ainda não aceitou. */
function aceiteAtrasado(c: MapeamentoComProgresso, now: number): boolean {
  if (!c.agendado_em) return false;
  if (c.aceite_status !== "aguardando_aceite") return false;
  if (FINALIZADOS.includes(c.status as CaseStatus)) return false;
  return new Date(c.agendado_em).getTime() < now;
}

/** Execução em atraso: aceito (ou sem agendamento de aceite), data do agendamento já passou e ainda não foi entregue. */
function execucaoAtrasada(c: MapeamentoComProgresso, now: number): boolean {
  if (!c.agendado_em) return false;
  if (FINALIZADOS.includes(c.status as CaseStatus)) return false;
  if (c.aceite_status === "aguardando_aceite" || c.aceite_status === "recusado_pelo_agente") return false;
  // já entregue pelo agente => não é atraso de execução
  if (c.data_entrega_agente) return false;
  return new Date(c.agendado_em).getTime() < now;
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

  const now = Date.now();

  const stats = useMemo(() => {
    const abertos = rows.filter((c) => ABERTOS.includes(c.status as CaseStatus)).length;
    const revisao = rows.filter((c) => c.status === "aguardando_revisao").length;
    const aceitos = rows.filter((c) => c.aceite_status === "confirmado").length;
    const aceiteAtr = rows.filter((c) => aceiteAtrasado(c, now)).length;
    const execAtr = rows.filter((c) => c.atrasado || execucaoAtrasada(c, now)).length;
    const hoje = rows.filter((c) => isHoje(c.agendado_em)).length;
    const aprovados = rows.filter((c) => c.status === "aprovado").length;
    return { abertos, revisao, aceitos, aceiteAtr, execAtr, hoje, aprovados };
  }, [rows, now]);

  const resumoAgentes = useMemo(() => {
    type Row = {
      id: string;
      nome: string;
      total: number;
      abertos: number;
      aceiteAtr: number;
      execAtr: number;
    };
    const map = new Map<string, Row>();
    for (const a of agentes) {
      map.set(a.user_id, { id: a.user_id, nome: a.nome, total: 0, abertos: 0, aceiteAtr: 0, execAtr: 0 });
    }
    for (const c of rows) {
      if (!c.agente_id) continue;
      let item = map.get(c.agente_id);
      if (!item) {
        item = { id: c.agente_id, nome: c.agente_nome ?? "—", total: 0, abertos: 0, aceiteAtr: 0, execAtr: 0 };
        map.set(c.agente_id, item);
      }
      item.total += 1;
      if (ABERTOS.includes(c.status as CaseStatus)) item.abertos += 1;
      if (aceiteAtrasado(c, now)) item.aceiteAtr += 1;
      if (c.atrasado || execucaoAtrasada(c, now)) item.execAtr += 1;
    }
    return [...map.values()].sort(
      (a, b) => b.aceiteAtr + b.execAtr - (a.aceiteAtr + a.execAtr) || b.total - a.total,
    );
  }, [rows, agentes, now]);

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
        <StatCard
          label="Aceite em atraso"
          value={stats.aceiteAtr}
          hint="Não aceito até a data agendada"
          tone="danger"
        />
        <StatCard
          label="Execução em atraso"
          value={stats.execAtr}
          hint="Data passou e não foi entregue"
          tone="danger"
        />
        <StatCard label="Mapeamentos hoje" value={stats.hoje} hint="Agendados para hoje" />
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
                  <Th>Total</Th>
                  <Th>Em aberto</Th>
                  <Th>Aceite em atraso</Th>
                  <Th>Execução em atraso</Th>
                </tr>
              </thead>
              <tbody>
                {resumoAgentes.map((a) => (
                  <tr key={a.id}>
                    <Td className="font-medium">{a.nome}</Td>
                    <Td>{a.total}</Td>
                    <Td>{a.abertos}</Td>
                    <Td>
                      {a.aceiteAtr > 0 ? (
                        <span className="font-semibold text-destructive">{a.aceiteAtr}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </Td>
                    <Td>
                      {a.execAtr > 0 ? (
                        <span className="font-semibold text-destructive">{a.execAtr}</span>
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
