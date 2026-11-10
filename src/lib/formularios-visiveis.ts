// Quais formulários aparecem no agendamento para o cliente escolhido (client-safe, função pura).
//
// Formulário sem cliente = padrão (serve a todos). Formulário com cliente foi criado para a
// especificidade daquele cliente: só aparece quando esse cliente é o escolhido.

export type FormularioComCliente = { id: string; nome: string; empresa_id: string | null };

export type GrupoFormulario = "cliente" | "padrao" | "outro";
export type FormularioVisivel<T extends FormularioComCliente> = T & { grupo: GrupoFormulario };

/**
 * Os do cliente escolhido vêm primeiro, depois os padrão; os de outros clientes só entram com `incluirOutros`
 * (no fim). Sem cliente escolhido, só os padrão (e os de outros, se pedido).
 */
export function formulariosVisiveis<T extends FormularioComCliente>(
  forms: T[],
  empresaId: string | null | undefined,
  incluirOutros = false,
): FormularioVisivel<T>[] {
  const grupo = (f: T): GrupoFormulario =>
    !f.empresa_id ? "padrao" : empresaId && f.empresa_id === empresaId ? "cliente" : "outro";
  const ordem = { cliente: 0, padrao: 1, outro: 2 } as const;
  return forms
    .map((f): FormularioVisivel<T> => ({ ...f, grupo: grupo(f) }))
    .filter((f) => f.grupo !== "outro" || incluirOutros)
    .sort((a, b) => ordem[a.grupo] - ordem[b.grupo] || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Quantos formulários de outros clientes estão escondidos (para o aviso "mostrar outros"). */
export function qtdDeOutrosClientes(forms: FormularioComCliente[], empresaId: string | null | undefined): number {
  return forms.filter((f) => f.empresa_id && f.empresa_id !== (empresaId || null)).length;
}
