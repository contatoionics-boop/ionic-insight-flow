import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listarNotificacoes,
  marcarNotificacaoLida,
  marcarTodasLidas,
  type Notificacao,
} from "@/lib/notificacoes.functions";


function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificacoesBell() {
  const listar = useServerFn(listarNotificacoes);
  const marcar = useServerFn(marcarNotificacaoLida);
  const marcarTodas = useServerFn(marcarTodasLidas);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Notificacao[]>([]);
  const lastIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return;
      const data = await listar();
      const novas = data.filter((n) => !lastIdsRef.current.has(n.id) && !n.lido);
      if (!firstLoadRef.current && novas.length > 0) {
        for (const n of novas.slice(0, 3)) toast(n.titulo, { description: n.mensagem });
      }
      lastIdsRef.current = new Set(data.map((n) => n.id));
      firstLoadRef.current = false;
      setRows(data);
    } catch (e) {
      console.error(e);
    }
  }, [listar]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const naoLidas = rows.filter((r) => !r.lido).length;

  const onClickItem = async (n: Notificacao) => {
    if (!n.lido) {
      try {
        await marcar({ data: { id: n.id } });
        setRows((rs) => rs.map((r) => (r.id === n.id ? { ...r, lido: true } : r)));
      } catch {}
    }
    setOpen(false);
    if (n.caso_id) navigate({ to: "/app/vistorias/$id", params: { id: n.caso_id } });
  };

  const onMarkAll = async () => {
    try {
      await marcarTodas();
      setRows((rs) => rs.map((r) => ({ ...r, lido: true })));
    } catch {}
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted"
        aria-label="Notificações"
      >
        <Bell className="h-4 w-4" />
        {naoLidas > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-md border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <p className="text-sm font-semibold text-foreground">Notificações</p>
              {naoLidas > 0 && (
                <button
                  onClick={onMarkAll}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <CheckCheck className="h-3 w-3" /> Marcar todas
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {rows.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Sem notificações.
                </p>
              ) : (
                rows.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => onClickItem(n)}
                    className={`block w-full border-b border-border px-3 py-2 text-left transition-colors hover:bg-muted/50 ${
                      n.lido ? "opacity-60" : ""
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">{n.titulo}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {n.mensagem}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {fmt(n.criado_em)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
