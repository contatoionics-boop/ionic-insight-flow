import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Table, Th, Td, Badge, Card, Input, Select, Label, Button } from "@/components/ui-bits";
import { statusLabels, statusTones, type CaseStatus } from "@/lib/casos";
import { listarMapeamentosComProgresso, type MapeamentoComProgresso } from "@/lib/mapeamento.functions";
import { listTechnicalAgents } from "@/lib/admin-users.functions";
import { Download, X } from "lucide-react";

export const Route = createFileRoute("/app/cases")({
  component: CasesPage,
});

function corBarra(pct: number) {
  if (pct <= 40) return "bg-red-500";
  if (pct < 80) return "bg-amber-500";
  return "bg-emerald-500";
}

const STATUS_OPCOES: CaseStatus[] = [
  "rascunho", "agendado", "em_andamento", "aguardando_revisao", "aprovado", "concluido", "cancelado",
];

function CasesPage() {
  const navigate = useNavigate();
  const listar = useServerFn(listarMapeamentosComProgresso);
  const loadAgents = useServerFn(listTechnicalAgents);
  const [rows, setRows] = useState<MapeamentoComProgresso[]>([]);
  const [agentes, setAgentes] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [fAgente, setFAgente] = useState("");
  const [fCliente, setFCliente] = useState("");
  const [fInicio, setFInicio] = useState("");
  const [fFim, setFFim] = useState("");
  const [fStatus, setFStatus] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [data, ags] = await Promise.all([listar(), loadAgents()]);
        setRows(data);
        setAgentes(((ags ?? []) as any[]).map((a) => ({ id: a.user_id ?? a.id, nome: a.nome })));
      } finally {
        setLoading(false);
      }
    })();
  }, [listar, loadAgents]);

  const filtradas = useMemo(() => {
    const cliBusca = fCliente.trim().toLowerCase();
    const ini = fInicio ? new Date(fInicio + "T00:00:00").getTime() : null;
    const fim = fFim ? new Date(fFim + "T23:59:59").getTime() : null;
    return rows.filter((r) => {
      if (fAgente && r.agente_id !== fAgente) return false;
      if (fStatus && r.status !== fStatus) return false;
      if (cliBusca) {
        const hay = `${r.empresa_nome ?? ""} ${r.unidade_nome ?? ""} ${r.cliente_codigo_ionics ?? ""} ${r.unidade_codigo_ionics ?? ""}`.toLowerCase();
        if (!hay.includes(cliBusca)) return false;
      }
      if (ini || fim) {
        const d = r.agendado_em ? new Date(r.agendado_em).getTime() : null;
        if (!d) return false;
        if (ini && d < ini) return false;
        if (fim && d > fim) return false;
      }
      return true;
    });
  }, [rows, fAgente, fCliente, fInicio, fFim, fStatus]);

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (fAgente) chips.push({ key: "ag", label: `Agente: ${agentes.find((a) => a.id === fAgente)?.nome ?? "?"}`, clear: () => setFAgente("") });
  if (fCliente) chips.push({ key: "cl", label: `Cliente: ${fCliente}`, clear: () => setFCliente("") });
  if (fInicio) chips.push({ key: "i", label: `De: ${fInicio}`, clear: () => setFInicio("") });
  if (fFim) chips.push({ key: "f", label: `Até: ${fFim}`, clear: () => setFFim("") });
  if (fStatus) chips.push({ key: "st", label: `Status: ${statusLabels[fStatus as CaseStatus]}`, clear: () => setFStatus("") });

  const exportarCsv = () => {
    const headers = ["ID", "Cliente", "Código IONICS", "Unidade", "Código Unidade", "Agente", "Status", "Progresso", "Data agendamento", "Data criação"];
    const lines = [headers.join(";")];
    for (const r of filtradas) {
      const linha = [
        r.codigo,
        r.empresa_nome ?? "",
        r.cliente_codigo_ionics ?? "",
        r.unidade_nome ?? "",
        r.unidade_codigo_ionics ?? "",
        r.agente_nome ?? "",
        statusLabels[r.status as CaseStatus] ?? r.status,
        `${r.respondidas_obrigatorias}/${r.total_obrigatorias}`,
        r.agendado_em ? new Date(r.agendado_em).toLocaleString("pt-BR") : "",
        new Date(r.criado_em).toLocaleString("pt-BR"),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";");
      lines.push(linha);
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mapeamentos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Mapeamentos"
        description="Todos os mapeamentos da plataforma. Clique em uma linha para ver detalhes."
        actions={
          <Button variant="outline" onClick={exportarCsv} disabled={filtradas.length === 0}>
            <Download className="mr-1 h-4 w-4" /> Exportar ({filtradas.length})
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div>
            <Label>Agente técnico</Label>
            <Select value={fAgente} onChange={(e) => setFAgente(e.target.value)}>
              <option value="">Todos</option>
              {agentes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Cliente (nome ou código IONICS)</Label>
            <Input value={fCliente} onChange={(e) => setFCliente(e.target.value)} placeholder="Ex: BP Bio ou ION-00001" />
          </div>
          <div>
            <Label>De</Label>
            <Input type="date" value={fInicio} onChange={(e) => setFInicio(e.target.value)} />
          </div>
          <div>
            <Label>Até</Label>
            <Input type="date" value={fFim} onChange={(e) => setFFim(e.target.value)} />
          </div>
          <div className="md:col-span-5">
            <Label>Status</Label>
            <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="">Todos</option>
              {STATUS_OPCOES.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
            </Select>
          </div>
        </div>
        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((c) => (
              <button
                key={c.key}
                onClick={c.clear}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/20"
              >
                {c.label} <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}
      </Card>

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
          ) : filtradas.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum mapeamento encontrado.</td></tr>
          ) : (
            filtradas.map((c) => {
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
                  <Td className="font-medium">
                    {c.empresa_nome ?? "—"}
                    {c.unidade_nome ? <span className="ml-1 text-xs text-muted-foreground">· {c.unidade_nome}</span> : null}
                    {c.cliente_codigo_ionics && (
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {c.unidade_codigo_ionics ?? c.cliente_codigo_ionics}
                      </div>
                    )}
                  </Td>
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
                  <Td>{c.agendado_em ? new Date(c.agendado_em).toLocaleDateString("pt-BR") : new Date(c.criado_em).toLocaleDateString("pt-BR")}</Td>
                </tr>
              );
            })
          )}
        </tbody>
      </Table>
    </div>
  );
}
