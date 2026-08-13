import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui-bits";
import {
  PerguntaBloco,
  isComplete,
  type Pergunta,
  type Resposta,
  type TipoPergunta,
} from "@/components/agent/FormFields";
import { salvarRespostasBloco, type BlocoDTO } from "@/lib/vistoria-agent.functions";

type Props = {
  bloco: BlocoDTO;
  casoId: string;
  token: string;
  tokenLink?: string;
  casoIdAuth?: string;
  onSaved: (resumo: string) => void | Promise<void>;
};

function toPergunta(p: BlocoDTO["perguntas"][number], secaoId: string, ordem: number): Pergunta {
  return {
    id: p.id,
    secao_id: secaoId,
    texto: p.texto,
    tipo: p.tipo as TipoPergunta,
    obrigatoria: p.obrigatoria,
    ordem,
    instrucao_agente: p.instrucao_agente,
    contexto_ia: p.contexto_ia,
    opcoes: p.opcoes,
  };
}

export function BlocoResposta({
  bloco,
  casoId,
  token,
  tokenLink,
  casoIdAuth,
  onSaved,
}: Props) {
  const draftKey = `bloco-draft:${casoId}:${bloco.id}`;
  const [state, setState] = useState<Record<string, Resposta>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(draftKey);
      return raw ? (JSON.parse(raw) as Record<string, Resposta>) : {};
    } catch {
      return {};
    }
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const salvarBloco = useServerFn(salvarRespostasBloco);

  // Mantém o rascunho local para que trocar de aba / recarregar não perca dados.
  useEffect(() => {
    try {
      const limpo = Object.fromEntries(
        Object.entries(state).map(([k, r]) => {
          const { filePreview: _ignored, ...rest } = r as Resposta & { filePreview?: string };
          return [k, rest];
        }),
      );
      window.localStorage.setItem(draftKey, JSON.stringify(limpo));
    } catch {
      // storage cheio ou indisponível: segue sem rascunho
    }
  }, [state, draftKey]);

  const perguntas = useMemo(
    () => bloco.perguntas.map((p, i) => toPergunta(p, `bloco-${bloco.id}`, i)),
    [bloco],
  );

  const update = (perguntaId: string, patch: Partial<Resposta>) =>
    setState((s) => ({ ...s, [perguntaId]: { ...(s[perguntaId] ?? {}), ...patch } }));

  const siblings = {
    perguntas,
    state,
    updateById: (id: string, patch: Partial<Resposta>) => update(id, patch),
  };

  const faltando = perguntas.filter(
    (p) => p.obrigatoria && !isComplete(p, state[p.id] ?? {}, "live"),
  );

  // Agrupa por linha quando o layout é matriz
  const linhas = useMemo(() => {
    if (bloco.layout !== "matriz") return null;
    const map = new Map<string, Pergunta[]>();
    bloco.perguntas.forEach((raw, i) => {
      const chave = raw.bloco_linha ?? "—";
      const arr = map.get(chave) ?? [];
      arr.push(perguntas[i]!);
      map.set(chave, arr);
    });
    return [...map.entries()];
  }, [bloco, perguntas]);

  const handleSalvar = async () => {
    setErro(null);
    if (faltando.length > 0) {
      setErro(`Faltam ${faltando.length} campo(s) obrigatório(s) neste bloco.`);
      return;
    }
    setSalvando(true);
    try {
      const respostas = perguntas
        .map((p) => {
          const r = state[p.id] ?? {};
          const arquivos = [r.filePath, r.audioPath].filter(Boolean) as string[];
          return {
            perguntaId: p.id,
            ...(r.text?.trim() ? { valorTexto: r.text.trim() } : {}),
            ...(r.transcription?.trim() ? { transcricao: r.transcription.trim() } : {}),
            ...(arquivos.length ? { arquivosPaths: arquivos } : {}),
          };
        })
        .filter((r) => r.valorTexto || r.transcricao || r.arquivosPaths);

      if (respostas.length === 0) {
        setErro("Preencha ao menos um campo antes de salvar.");
        return;
      }

      const res = await salvarBloco({
        data: {
          ...(tokenLink ? { token: tokenLink } : {}),
          ...(casoIdAuth ? { casoId: casoIdAuth } : {}),
          blocoId: bloco.id,
          respostas,
        },
      });

      if (!res.ok && res.erros.length > 0) {
        setErro(res.erros.map((e) => e.motivo).join(" · "));
        return;
      }
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // ignora
      }
      await onSaved(res.resumo || bloco.titulo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar o bloco.");
    } finally {
      setSalvando(false);
    }
  };

  const renderCampo = (p: Pergunta) => (
    <PerguntaBloco
      key={p.id}
      pergunta={p}
      casoId={casoId}
      token={token}
      resposta={state[p.id] ?? {}}
      update={(patch) => update(p.id, patch)}
      mode="live"
      siblings={siblings}
    />
  );

  return (
    <div className="mx-auto w-full max-w-2xl animate-fade-in text-left">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {bloco.secaoTitulo}
          </p>
          <h3 className="text-lg font-semibold text-foreground">{bloco.titulo}</h3>
          {bloco.descricao && (
            <p className="mt-1 text-sm text-muted-foreground">{bloco.descricao}</p>
          )}
        </div>

        {linhas ? (
          <div className="space-y-5">
            {linhas.map(([linha, ps]) => (
              <div key={linha}>
                <p className="mb-2 text-sm font-semibold text-foreground">{linha}</p>
                <div className="grid gap-3 sm:grid-cols-2">{ps.map(renderCampo)}</div>
              </div>
            ))}
          </div>
        ) : bloco.layout === "fotos" ? (
          <div className="grid gap-3 sm:grid-cols-2">{perguntas.map(renderCampo)}</div>
        ) : (
          <div className="space-y-3">{perguntas.map(renderCampo)}</div>
        )}

        {erro && (
          <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {erro}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {perguntas.length - faltando.length} de {perguntas.length} campos prontos
          </span>
          <Button variant="primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Salvar bloco
          </Button>
        </div>
      </div>
    </div>
  );
}
