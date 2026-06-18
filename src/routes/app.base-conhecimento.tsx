import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Upload,
  Trash2,
  FileText,
  RefreshCw,
  BookOpen,
  Plus,
  Download,
  Pencil,
  X,
} from "lucide-react";

import { Button, Card, Input, Label, PageHeader } from "@/components/ui-bits";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ConfiguracoesNav } from "@/components/ConfiguracoesNav";
import {
  criarDocumento,
  excluirDocumento,
  listarDocumentos,
} from "@/lib/base-conhecimento.functions";
import {
  listarRegistros,
  criarRegistro,
  atualizarRegistro,
  excluirRegistro,
  listarImportacoes,
  excluirImportacao,
  importarRegistros,
  baixarTemplate,
} from "@/lib/knowledge-base.functions";
import {
  CATEGORIA_LABEL,
  CLASSIFICACAO_BADGE,
  CLASSIFICACAO_LABEL,
  KNOWLEDGE_CATEGORIAS,
  KNOWLEDGE_CLASSIFICACOES,
  type KnowledgeCategoria,
  type KnowledgeClassificacao,
  type KnowledgeRegistro,
  type KnowledgeImportacao,
} from "@/lib/knowledge-base";

export const Route = createFileRoute("/app/base-conhecimento")({
  component: BaseConhecimentoPage,
});

type Tab = "documentos" | "registros" | "importacoes";

function BaseConhecimentoPage() {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>("documentos");

  if (auth.status === "authenticated" && auth.role !== "super_admin") {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">
          Você não tem permissão para acessar esta página.
        </p>
      </Card>
    );
  }

  return (
    <div className="max-w-6xl">
      <ConfiguracoesNav />
      <PageHeader
        title="Base de conhecimento"
        description="Documentos e registros estruturados que alimentam a IA do sistema."
      />

      <div className="mb-4 flex gap-1 border-b border-border">
        {(
          [
            ["documentos", "Documentos"],
            ["registros", "Registros estruturados"],
            ["importacoes", "Importações"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === k
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "documentos" && <DocumentosTab />}
      {tab === "registros" && <RegistrosTab />}
      {tab === "importacoes" && <ImportacoesTab />}
    </div>
  );
}

// =========================================================================
// DOCUMENTOS (mantido)
// =========================================================================

type Doc = {
  id: string;
  nome: string;
  categoria: string | null;
  tipo: "pdf" | "docx" | "txt";
  tamanho_bytes: number | null;
  status: "aguardando" | "processando" | "pronto" | "erro";
  erro_mensagem: string | null;
  criado_em: string;
};

function tipoFromName(name: string): "pdf" | "docx" | "txt" | null {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "txt") return "txt";
  return null;
}

function fmtBytes(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function StatusBadge({
  s,
  msg,
}: {
  s: "aguardando" | "processando" | "pronto" | "erro";
  msg: string | null;
}) {
  const map = {
    aguardando: "bg-muted text-muted-foreground",
    processando: "bg-primary/10 text-primary",
    pronto: "bg-success/10 text-success",
    erro: "bg-destructive/10 text-destructive",
  } as const;
  const label = {
    aguardando: "Aguardando",
    processando: "Processando",
    pronto: "Pronto",
    erro: "Erro",
  } as const;
  return (
    <span
      title={msg ?? undefined}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${map[s]}`}
    >
      {s === "processando" && <Loader2 className="h-3 w-3 animate-spin" />}
      {label[s]}
    </span>
  );
}

function DocumentosTab() {
  const listar = useServerFn(listarDocumentos);
  const criar = useServerFn(criarDocumento);
  const excluir = useServerFn(excluirDocumento);

  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const refresh = async () => {
    try {
      const data = await listar();
      setDocs(data as any);
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao carregar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!docs.some((d) => d.status === "processando")) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [docs]);

  const categorias = useMemo(
    () => Array.from(new Set(docs.map((d) => d.categoria).filter(Boolean))) as string[],
    [docs],
  );

  const onDelete = async (id: string) => {
    if (!confirm("Excluir este documento da base de conhecimento?")) return;
    try {
      await excluir({ data: { id } });
      setDocs((p) => p.filter((d) => d.id !== id));
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao excluir.");
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2">
        <Button variant="outline" onClick={refresh}>
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
        <Button onClick={() => setShowModal(true)}>
          <Upload className="h-4 w-4" /> Importar documento
        </Button>
      </div>

      {err && (
        <Card className="mb-4 border-destructive/40">
          <p className="text-sm text-destructive">{err}</p>
        </Card>
      )}

      <Card className="p-0">
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <BookOpen className="h-8 w-8 opacity-50" />
            <p>Nenhum documento importado ainda.</p>
            <p className="text-xs">Importe PDFs, DOCX ou TXT para enriquecer a IA.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Nome</th>
                  <th className="px-4 py-2 text-left font-medium">Categoria</th>
                  <th className="px-4 py-2 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2 text-left font-medium">Tamanho</th>
                  <th className="px-4 py-2 text-left font-medium">Data</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">{d.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{d.categoria ?? "—"}</td>
                    <td className="px-4 py-2 uppercase text-muted-foreground">{d.tipo}</td>
                    <td className="px-4 py-2 text-muted-foreground">{fmtBytes(d.tamanho_bytes)}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(d.criado_em).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge s={d.status} msg={d.erro_mensagem} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onDelete(d.id)}
                        className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showModal && (
        <ImportDocModal
          categorias={categorias}
          onClose={() => setShowModal(false)}
          onUploaded={async () => {
            setShowModal(false);
            await refresh();
          }}
          uploadFn={async (payload) => {
            await criar({ data: payload });
          }}
        />
      )}
    </div>
  );
}

function ImportDocModal({
  categorias,
  onClose,
  onUploaded,
  uploadFn,
}: {
  categorias: string[];
  onClose: () => void;
  onUploaded: () => void | Promise<void>;
  uploadFn: (p: {
    nome: string;
    categoria: string | null;
    arquivo_path: string;
    tipo: "pdf" | "docx" | "txt";
    tamanho_bytes: number;
  }) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onFileChange = (f: File | null) => {
    setFile(f);
    if (f && !nome) setNome(f.name.replace(/\.[^/.]+$/, ""));
  };

  const onSubmit = async () => {
    if (!file) return setErr("Selecione um arquivo.");
    const tipo = tipoFromName(file.name);
    if (!tipo) return setErr("Formato não suportado. Use PDF, DOCX ou TXT.");
    if (file.size > 10 * 1024 * 1024) return setErr("Arquivo maior que 10MB.");
    setErr(null);
    setUploading(true);
    try {
      const path = `base-conhecimento/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("agente-uploads")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) throw upErr;
      await uploadFn({
        nome: nome.trim() || file.name,
        categoria: categoria.trim() || null,
        arquivo_path: path,
        tipo,
        tamanho_bytes: file.size,
      });
      await onUploaded();
    } catch (e: any) {
      setErr(e?.message ?? "Falha no upload.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg">
        <h3 className="text-lg font-semibold text-foreground">Importar documento</h3>
        <p className="mt-1 text-xs text-muted-foreground">Formatos: PDF, DOCX, TXT — até 10MB.</p>
        <div className="mt-4 space-y-4">
          <div>
            <Label>Arquivo</Label>
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80"
            />
          </div>
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Categoria</Label>
            <Input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              list="categorias-existentes"
            />
            <datalist id="categorias-existentes">
              {categorias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={uploading}>
              Cancelar
            </Button>
            <Button onClick={onSubmit} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Processando…" : "Importar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// REGISTROS ESTRUTURADOS
// =========================================================================

function ClassBadge({ c }: { c: KnowledgeClassificacao }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CLASSIFICACAO_BADGE[c]}`}
    >
      {CLASSIFICACAO_LABEL[c]}
    </span>
  );
}

function RegistrosTab() {
  const listar = useServerFn(listarRegistros);
  const excluir = useServerFn(excluirRegistro);
  const baixar = useServerFn(baixarTemplate);

  const [rows, setRows] = useState<KnowledgeRegistro[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<KnowledgeCategoria | "">("");
  const [classificacao, setClassificacao] = useState<KnowledgeClassificacao | "">("");
  const [tagsInput, setTagsInput] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<KnowledgeRegistro | null>(null);
  const [creating, setCreating] = useState(false);
  const pageSize = 50;

  const refresh = async (p = page) => {
    setLoading(true);
    try {
      const tags = tagsInput.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
      const res: any = await listar({
        data: {
          busca: busca || undefined,
          categoria: categoria || undefined,
          classificacao: classificacao || undefined,
          tags: tags.length ? tags : undefined,
          page: p,
          pageSize,
        },
      });
      setRows(res.rows);
      setTotal(res.total);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao carregar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh(1);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoria, classificacao]);

  useEffect(() => {
    refresh(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const onDelete = async (id: string) => {
    if (!confirm("Excluir este registro?")) return;
    await excluir({ data: { id } });
    refresh();
  };

  const onBaixarTemplate = async (tipo: "csv" | "json") => {
    const res: any = await baixar({ data: { tipo } });
    const blob = new Blob([res.conteudo], { type: res.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template-knowledge.${tipo}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={() => onBaixarTemplate("csv")}>
          <Download className="h-4 w-4" /> Modelo CSV
        </Button>
        <Button variant="outline" onClick={() => onBaixarTemplate("json")}>
          <Download className="h-4 w-4" /> Modelo JSON
        </Button>
        <Button variant="outline" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Novo registro
        </Button>
        <Button onClick={() => setShowImport(true)}>
          <Upload className="h-4 w-4" /> Importar arquivo
        </Button>
      </div>

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Busca</Label>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") refresh(1);
              }}
              placeholder="Título ou conteúdo"
            />
          </div>
          <div>
            <Label>Categoria</Label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as any)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {KNOWLEDGE_CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIA_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Classificação</Label>
            <select
              value={classificacao}
              onChange={(e) => setClassificacao(e.target.value as any)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {KNOWLEDGE_CLASSIFICACOES.map((c) => (
                <option key={c} value={c}>
                  {CLASSIFICACAO_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Tags (separadas por vírgula)</Label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") refresh(1);
              }}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="outline" onClick={() => refresh(1)}>
            Aplicar filtros
          </Button>
        </div>
      </Card>

      {err && (
        <Card className="mb-4 border-destructive/40">
          <p className="text-sm text-destructive">{err}</p>
        </Card>
      )}

      <Card className="p-0">
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <BookOpen className="h-8 w-8 opacity-50" />
            <p>Nenhum registro encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Título</th>
                  <th className="px-4 py-2 text-left font-medium">Categoria</th>
                  <th className="px-4 py-2 text-left font-medium">Tags</th>
                  <th className="px-4 py-2 text-left font-medium">Classificação</th>
                  <th className="px-4 py-2 text-left font-medium">Fonte</th>
                  <th className="px-4 py-2 text-left font-medium">Atualizado</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-2 font-medium text-foreground">{r.titulo}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {CATEGORIA_LABEL[r.categoria]}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {(r.tags ?? []).slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                        {(r.tags?.length ?? 0) > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{r.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <ClassBadge c={r.classificacao} />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{r.fonte ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(r.updated_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing(r)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(r.id)}
                        className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-2 text-sm text-muted-foreground">
                <span>
                  Página {page} de {totalPages} — {total} registro(s)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {(creating || editing) && (
        <RegistroFormModal
          registro={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setCreating(false);
            setEditing(null);
            await refresh();
          }}
        />
      )}

      {showImport && (
        <ImportarRegistrosModal
          onClose={() => setShowImport(false)}
          onDone={async () => {
            setShowImport(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function RegistroFormModal({
  registro,
  onClose,
  onSaved,
}: {
  registro: KnowledgeRegistro | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const criar = useServerFn(criarRegistro);
  const atualizar = useServerFn(atualizarRegistro);
  const [titulo, setTitulo] = useState(registro?.titulo ?? "");
  const [conteudo, setConteudo] = useState(registro?.conteudo ?? "");
  const [categoria, setCategoria] = useState<KnowledgeCategoria>(
    registro?.categoria ?? "regras_tecnicas",
  );
  const [classificacao, setClassificacao] = useState<KnowledgeClassificacao>(
    registro?.classificacao ?? "OK",
  );
  const [tags, setTags] = useState((registro?.tags ?? []).join(", "));
  const [fonte, setFonte] = useState(registro?.fonte ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!titulo.trim() || !conteudo.trim()) {
      return setErr("Título e conteúdo são obrigatórios.");
    }
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        titulo: titulo.trim(),
        conteudo: conteudo.trim(),
        categoria,
        classificacao,
        tags: tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean),
        fonte: fonte.trim() || null,
      };
      if (registro) {
        await atualizar({ data: { id: registro.id, ...payload } });
      } else {
        await criar({ data: payload });
      }
      await onSaved();
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            {registro ? "Editar registro" : "Novo registro"}
          </h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div>
            <Label>Categoria</Label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as KnowledgeCategoria)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {KNOWLEDGE_CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIA_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Classificação</Label>
            <select
              value={classificacao}
              onChange={(e) => setClassificacao(e.target.value as KnowledgeClassificacao)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {KNOWLEDGE_CLASSIFICACOES.map((c) => (
                <option key={c} value={c}>
                  {CLASSIFICACAO_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Tags (separadas por vírgula)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <div>
            <Label>Fonte</Label>
            <Input value={fonte} onChange={(e) => setFonte(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Conteúdo</Label>
            <textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              rows={8}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}

function ImportarRegistrosModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const importar = useServerFn(importarRegistros);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resumo, setResumo] = useState<{
    inseridos: number;
    ignorados: number;
    erros: { linha: number; motivo: string }[];
  } | null>(null);

  const tipoDe = (f: File): "json" | "csv" | "xlsx" | null => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext === "json") return "json";
    if (ext === "csv") return "csv";
    if (ext === "xlsx" || ext === "xls") return "xlsx";
    return null;
  };

  const onSubmit = async () => {
    if (!file) return setErr("Selecione um arquivo.");
    const tipo = tipoDe(file);
    if (!tipo) return setErr("Formato não suportado. Use JSON, CSV ou XLSX.");
    if (file.size > 5 * 1024 * 1024)
      return setErr("Arquivo maior que 5 MB. Divida em arquivos menores.");
    setErr(null);
    setUploading(true);
    try {
      const path = `knowledge-base/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("agente-uploads")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) throw upErr;
      const res: any = await importar({
        data: { arquivo_path: path, nome_arquivo: file.name, tipo },
      });
      setResumo(res);
    } catch (e: any) {
      setErr(e?.message ?? "Falha na importação. Tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Importar registros</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Formatos: JSON, CSV, XLSX — até 5 MB e 5.000 linhas. Campos obrigatórios:
          <code className="mx-1">titulo</code>, <code>conteudo</code>, <code>categoria</code>.
        </p>

        {!resumo ? (
          <div className="mt-4 space-y-4">
            <div>
              <Label>Arquivo</Label>
              <input
                type="file"
                accept=".json,.csv,.xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80"
              />
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose} disabled={uploading}>
                Cancelar
              </Button>
              <Button onClick={onSubmit} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Processando…" : "Importar"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-foreground">
              Importação concluída: <strong>{resumo.inseridos}</strong> registro(s) inseridos
              {resumo.ignorados > 0 && (
                <>
                  , <strong>{resumo.ignorados}</strong> ignorado(s)
                </>
              )}
              .
            </p>
            {resumo.erros.length > 0 && (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
                <p className="mb-1 font-medium text-foreground">Primeiros erros:</p>
                <ul className="space-y-0.5 text-muted-foreground">
                  {resumo.erros.map((e, i) => (
                    <li key={i}>
                      Linha {e.linha}: {e.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={onDone}>Fechar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// IMPORTAÇÕES
// =========================================================================

function ImportacoesTab() {
  const listar = useServerFn(listarImportacoes);
  const excluir = useServerFn(excluirImportacao);
  const [items, setItems] = useState<KnowledgeImportacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const data: any = await listar();
      setItems(data);
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao carregar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!items.some((i) => i.status === "processando")) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [items]);

  const onDelete = async (id: string) => {
    if (!confirm("Remover esta importação? Todos os registros associados serão excluídos."))
      return;
    await excluir({ data: { id } });
    refresh();
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="outline" onClick={refresh}>
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>
      {err && (
        <Card className="mb-4 border-destructive/40">
          <p className="text-sm text-destructive">{err}</p>
        </Card>
      )}
      <Card className="p-0">
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhuma importação realizada ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Arquivo</th>
                  <th className="px-4 py-2 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2 text-left font-medium">Registros</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Data</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-border">
                    <td className="px-4 py-2 font-medium text-foreground">{it.nome_arquivo}</td>
                    <td className="px-4 py-2 uppercase text-muted-foreground">{it.tipo}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {it.total_inseridos}
                      {it.total_registros > it.total_inseridos &&
                        ` / ${it.total_registros}`}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge s={it.status} msg={it.erro_mensagem} />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(it.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onDelete(it.id)}
                        className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                        title="Remover importação"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
