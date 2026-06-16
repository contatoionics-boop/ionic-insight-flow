import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload, Trash2, FileText, RefreshCw, BookOpen } from "lucide-react";

import { Button, Card, Input, Label, PageHeader } from "@/components/ui-bits";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ConfiguracoesNav } from "@/components/ConfiguracoesNav";
import {
  criarDocumento,
  excluirDocumento,
  listarDocumentos,
} from "@/lib/base-conhecimento.functions";

export const Route = createFileRoute("/app/base-conhecimento")({
  component: BaseConhecimentoPage,
});

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

function StatusBadge({ s, msg }: { s: Doc["status"]; msg: string | null }) {
  const map: Record<Doc["status"], string> = {
    aguardando: "bg-muted text-muted-foreground",
    processando: "bg-primary/10 text-primary",
    pronto: "bg-success/10 text-success",
    erro: "bg-destructive/10 text-destructive",
  };
  const label: Record<Doc["status"], string> = {
    aguardando: "Aguardando",
    processando: "Processando",
    pronto: "Pronto",
    erro: "Erro",
  };
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

function BaseConhecimentoPage() {
  const auth = useAuth();
  const listar = useServerFn(listarDocumentos);
  const criar = useServerFn(criarDocumento);
  const excluir = useServerFn(excluirDocumento);

  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  // Poll while any doc is processing
  useEffect(() => {
    if (!docs.some((d) => d.status === "processando")) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [docs]);

  const categorias = useMemo(
    () => Array.from(new Set(docs.map((d) => d.categoria).filter(Boolean))) as string[],
    [docs],
  );

  if (auth.status === "authenticated" && auth.role !== "super_admin") {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">
          Você não tem permissão para acessar esta página.
        </p>
      </Card>
    );
  }

  const onDelete = async (id: string) => {
    if (!confirm("Excluir este documento da base de conhecimento?")) return;
    try {
      await excluir({ data: { id } });
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao excluir.");
    }
  };

  return (
    <div className="max-w-5xl">
      <ConfiguracoesNav />
      <PageHeader
        title="Base de conhecimento"
        description="Documentos importados aqui se tornam contexto para a IA do sistema."
        actions={
          <>
            <Button variant="outline" onClick={refresh}>
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
            <Button onClick={() => setShowModal(true)}>
              <Upload className="h-4 w-4" />
              Importar documento
            </Button>
          </>
        }
      />

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
            <p className="text-xs">
              Importe PDFs, DOCX ou TXT para enriquecer as respostas da IA.
            </p>
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
                    <td className="px-4 py-2 text-muted-foreground">
                      {d.categoria ?? "—"}
                    </td>
                    <td className="px-4 py-2 uppercase text-muted-foreground">{d.tipo}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {fmtBytes(d.tamanho_bytes)}
                    </td>
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
        <ImportModal
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

function ImportModal({
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
    if (!file) {
      setErr("Selecione um arquivo.");
      return;
    }
    const tipo = tipoFromName(file.name);
    if (!tipo) {
      setErr("Formato não suportado. Use PDF, DOCX ou TXT.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErr("Arquivo maior que 10MB.");
      return;
    }
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
        <p className="mt-1 text-xs text-muted-foreground">
          Formatos: PDF, DOCX, TXT — até 10MB.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <Label>Arquivo</Label>
            <input
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80"
            />
          </div>
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do documento" />
          </div>
          <div>
            <Label>Categoria</Label>
            <Input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ex: Produtos, Procedimentos, Contratos"
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
          <p className="text-xs text-muted-foreground">
            O processamento extrai o texto, divide em trechos e gera embeddings. Pode levar
            alguns segundos para documentos grandes.
          </p>
        </div>
      </div>
    </div>
  );
}
