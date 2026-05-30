import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { PageHeader, Card, Textarea, Button } from "@/components/ui-bits";
import { ConfiguracoesNav } from "@/components/ConfiguracoesNav";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/prompts")({
  component: PromptsPage,
});

type Prompt = {
  id: string;
  chave: string;
  nome: string;
  descricao: string | null;
  conteudo: string;
};

function PromptCard({
  prompt,
  value,
  onChange,
  onSave,
  saved,
  saving,
}: {
  prompt: Prompt;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saved: boolean;
  saving: boolean;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">{prompt.nome}</h3>
        {prompt.descricao && (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{prompt.descricao}</p>
        )}
      </div>
      <Textarea
        rows={8}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="resize-y leading-relaxed"
      />
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm font-medium text-success">Prompt salvo com sucesso ✓</span>}
        <Button onClick={onSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
      </div>
    </Card>
  );
}

function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("prompts_ia")
        .select("id, chave, nome, descricao, conteudo")
        .order("nome");
      if (error) setError(error.message);
      else {
        const list = (data ?? []) as Prompt[];
        setPrompts(list);
        setValues(Object.fromEntries(list.map((p) => [p.id, p.conteudo])));
      }
      setLoading(false);
    })();
  }, []);

  const update = useCallback((id: string, v: string) => {
    setValues((s) => ({ ...s, [id]: v }));
    setSavedKeys((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleSave = useCallback(
    async (id: string) => {
      setSavingKey(id);
      const { error } = await supabase
        .from("prompts_ia")
        .update({ conteudo: values[id] })
        .eq("id", id);
      setSavingKey(null);
      if (error) {
        setError(error.message);
        return;
      }
      setSavedKeys((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setSavedKeys((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 2500);
    },
    [values],
  );

  return (
    <div>
      <ConfiguracoesNav />
      <PageHeader
        title="Configuração de Prompts de IA"
        description="Estes prompts controlam o comportamento da inteligência artificial em cada etapa do processo."
      />
      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {loading ? (
        <Card><p className="text-sm text-muted-foreground">Carregando...</p></Card>
      ) : (
        <div className="space-y-6">
          {prompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              value={values[prompt.id] ?? ""}
              onChange={(v) => update(prompt.id, v)}
              onSave={() => handleSave(prompt.id)}
              saved={savedKeys.has(prompt.id)}
              saving={savingKey === prompt.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
