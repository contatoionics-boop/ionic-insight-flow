import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { Button, Card } from "@/components/ui-bits";
import { listarBlocosPadrao, type BlocoPadrao } from "@/lib/blocos-padrao.functions";
import { listarFotosLaudo } from "@/lib/laudo.functions";
import type { BlocoLaudo } from "@/lib/laudo/tipos";

type Foto = { path: string; url: string; legenda: string };

export function BibliotecaModal({
  casoId,
  tipo,
  onClose,
  onInserir,
}: {
  casoId: string;
  tipo: "padrao" | "foto" | null;
  onClose: () => void;
  onInserir: (blocos: BlocoLaudo[]) => void;
}) {
  const fnBlocos = useServerFn(listarBlocosPadrao);
  const fnFotos = useServerFn(listarFotosLaudo);
  const [carregando, setCarregando] = useState(false);
  const [padroes, setPadroes] = useState<BlocoPadrao[]>([]);
  const [fotos, setFotos] = useState<Foto[]>([]);

  useEffect(() => {
    if (!tipo) return;
    let vivo = true;
    setCarregando(true);
    (async () => {
      try {
        if (tipo === "padrao") {
          const r = await fnBlocos({ data: {} as any });
          if (vivo) setPadroes((r as BlocoPadrao[]).filter((b) => b.ativo));
        } else {
          const r = await fnFotos({ data: { casoId } });
          if (vivo) setFotos(r as Foto[]);
        }
      } catch (e: any) {
        toast.error(e?.message ?? "Falha ao carregar a biblioteca.");
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [tipo, casoId]);

  if (!tipo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <Card className="mt-10 w-full max-w-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">
            {tipo === "padrao" ? "Blocos padrão" : "Fotos do mapeamento"}
          </p>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        {carregando ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </p>
        ) : tipo === "padrao" ? (
          padroes.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              Nenhum bloco padrão cadastrado. Crie a biblioteca em Configurações › Blocos padrão.
            </p>
          ) : (
            <div className="space-y-2">
              {padroes.map((b) => (
                <div
                  key={b.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{b.nome}</p>
                    {b.descricao && (
                      <p className="text-xs text-muted-foreground">{b.descricao}</p>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {b.categoria} · {b.blocos?.length ?? 0} bloco(s)
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => onInserir(b.blocos ?? [])}>
                    Inserir
                  </Button>
                </div>
              ))}
            </div>
          )
        ) : fotos.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Nenhuma foto anexada neste mapeamento.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {fotos.map((f) => (
              <button
                key={f.path}
                type="button"
                className="overflow-hidden rounded-lg border border-border text-left transition hover:border-primary"
                onClick={() =>
                  onInserir([
                    {
                      id: `foto-${Math.random().toString(36).slice(2, 10)}`,
                      tipo: "image",
                      url: f.url,
                      alt: f.legenda,
                      legenda: f.legenda,
                      larguraMax: 320,
                    } as BlocoLaudo,
                  ])
                }
              >
                <img src={f.url} alt={f.legenda} className="h-28 w-full object-cover" />
                <span className="block p-2 text-[11px] leading-tight text-muted-foreground">
                  {f.legenda}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
