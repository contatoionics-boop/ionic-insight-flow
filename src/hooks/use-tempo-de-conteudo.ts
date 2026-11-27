import { useEffect, useState } from "react";

let navegacao: { caminho: string; inicio: number } | undefined;

export function marcarInicioDaNavegacao(caminho: string) {
  navegacao = { caminho, inicio: performance.now() };
}

/** Mede da navegação até o fim do carregamento inicial, apenas no servidor de desenvolvimento. */
export function useTempoDeConteudo(pagina: string, carregando: boolean) {
  const [medicao] = useState(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    const caminho = window.location.pathname;
    const abertura = performance.getEntriesByType("navigation")[0];
    const inicio = navegacao?.caminho === caminho
      ? navegacao.inicio
      : abertura && new URL(abertura.name).pathname === caminho && !navegacao
        ? abertura.startTime
        : performance.now();
    const prefixo = "ionics:conteudo:" + pagina;
    return { inicio, prefixo, registrada: false };
  });

  useEffect(() => {
    if (!medicao || carregando || medicao.registrada) return;
    medicao.registrada = true;
    const primeira = performance.getEntriesByName(medicao.prefixo + ":primeira", "measure").length === 0;
    performance.measure(medicao.prefixo + (primeira ? ":primeira" : ":retorno"), { start: medicao.inicio });
  }, [carregando, medicao]);
}
