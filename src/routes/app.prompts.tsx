import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { PageHeader, Card, Textarea, Button } from "@/components/ui-bits";
import { aiPrompts } from "@/lib/mock-data";
import type { PromptDef } from "@/lib/mock-data";

export const Route = createFileRoute("/app/prompts")({
  component: PromptsPage,
});

function PromptCard({
  prompt,
  value,
  onChange,
  onSave,
  saved,
}: {
  prompt: PromptDef;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saved: boolean;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">{prompt.name}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {prompt.description}
        </p>
      </div>
      <Textarea
        rows={8}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="resize-y leading-relaxed"
      />
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="text-sm font-medium text-success">Prompt salvo com sucesso ✓</span>
        )}
        <Button onClick={onSave}>Salvar</Button>
      </div>
    </Card>
  );
}

function PromptsPage() {
  const initial = Object.fromEntries(
    aiPrompts.map((p) => [p.key, p.content])
  ) as Record<string, string>;

  const [values, setValues] = useState(initial);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  const update = useCallback((key: string, v: string) => {
    setValues((s) => ({ ...s, [key]: v }));
    setSavedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const handleSave = useCallback((key: string) => {
    setSavedKeys((prev) => new Set(prev).add(key));
    // auto-hide after 2.5s
    setTimeout(() => {
      setSavedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 2500);
  }, []);

  return (
    <div>
      <PageHeader
        title="Configuração de Prompts de IA"
        description="Estes prompts controlam o comportamento da inteligência artificial em cada etapa do processo."
      />
      <div className="space-y-6">
        {aiPrompts.map((prompt) => (
          <PromptCard
            key={prompt.key}
            prompt={prompt}
            value={values[prompt.key]}
            onChange={(v) => update(prompt.key, v)}
            onSave={() => handleSave(prompt.key)}
            saved={savedKeys.has(prompt.key)}
          />
        ))}
      </div>
    </div>
  );
}
