// Server-only helpers for the mapeamento técnico conversational agent.
// Loads form/state, builds system prompt, executes tools.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { avaliarCondicional } from "@/lib/perguntas-mapeamento";
import { registrarEvento } from "@/lib/eventos.server";

export type BlocoLayout = "cartao" | "matriz" | "fotos";

export type AgentBloco = {
  id: string;
  secao_id: string;
  titulo: string;
  descricao: string | null;
  layout: BlocoLayout;
  ordem: number;
};

export type AgentPergunta = {
  id: string;
  secao_id: string;
  secao_titulo: string;
  secao_ordem: number;
  texto: string;
  tipo: string;
  obrigatoria: boolean;
  ordem: number;
  instrucao_agente: string | null;
  contexto_ia: string | null;
  opcoes: { id: string; texto: string }[];
  condicional_pergunta_id: string | null;
  condicional_operador: string | null;
  condicional_valor: string | null;
  bloco_id: string | null;
  bloco_linha: string | null;
  bloco_coluna: string | null;
  chave_laudo: string | null;
};

export type AgentResposta = {
  valor_texto: string | null;
  arquivo_path: string | null;
  arquivos_paths: string[];
  transcricao: string | null;
  /** Origem: preenchido automaticamente do cadastro e ainda não confirmado. */
  origem_cadastro?: boolean;
};

/** Marcadores gravados em respostas_agente.ia_motivo. */
export const MOTIVO_CADASTRO_PENDENTE = "preenchido_do_cadastro";
export const MOTIVO_CADASTRO_CONFIRMADO = "confirmado_do_cadastro";

export type RespostaSalva = {
  perguntaId: string;
  perguntaTexto: string;
  valor: string;
  tipo: string;
  criadoEm: string;
};

export type CadastroFato = { label: string; valor: string };

export type AgentSecao = { id: string; titulo: string; ordem: number };

export type AgentContext = {
  casoId: string;
  clienteNome: string;
  formularioNome: string;
  perguntas: AgentPergunta[];
  blocos: AgentBloco[];
  secoes: AgentSecao[];
  state: Record<string, AgentResposta>;
  cadastro: CadastroFato[];
};

/** Validate access via token (public link). Returns casoId. */
export async function validarTokenAcesso(token: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("links_agente")
    .select("caso_id, expira_em")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error("Erro ao validar link.");
  if (!data) throw new Error("Link inválido.");
  if (data.expira_em && new Date(data.expira_em) < new Date()) {
    throw new Error("Link expirado.");
  }
  return data.caso_id;
}

/** Validate authenticated user owns/can access this caso. */
export async function validarUsuarioCaso(casoId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("casos")
    .select("id, agente_id, criado_por")
    .eq("id", casoId)
    .maybeSingle();
  if (error || !data) throw new Error("Caso não encontrado.");
  if (data.agente_id !== userId && data.criado_por !== userId) {
    // Allow admins/super_admins
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "super_admin"]);
    if (!roles?.length) throw new Error("Sem acesso a este caso.");
  }
}

export async function loadAgentContext(casoId: string): Promise<AgentContext> {
  const { data: caso, error: cErr } = await supabaseAdmin
    .from("casos")
    .select(
      "id, formulario_id, agendamento_id, endereco_vistoria, observacoes_agendamento, agendado_em, tipo_solicitacao, modalidade, nivel, agente_nome_manual, agente:profiles!casos_agente_id_fkey(nome), unidade:unidades(nome, logradouro, numero, bairro, cidade, estado, cep, telefone, email, matriz:matrizes(nome, razao_social, cnpj, telefone, email, logradouro, numero, bairro, cidade, estado, cep, empresa:empresas(nome)))",
    )
    .eq("id", casoId)
    .maybeSingle();
  if (cErr || !caso) throw new Error("Caso não encontrado.");
  if (!caso.formulario_id) throw new Error("Caso sem formulário.");

  const unidade = (caso as any).unidade;
  const matriz = unidade?.matriz;
  const empresa = matriz?.empresa;
  const clienteNome =
    empresa?.nome ?? matriz?.razao_social ?? matriz?.nome ?? unidade?.nome ?? "Cliente";

  // Buscar endereço da vistoria do agendamento se existir
  let enderecoVistoria: string | null = (caso as any).endereco_vistoria ?? null;
  if (!enderecoVistoria && (caso as any).agendamento_id) {
    const { data: ag } = await supabaseAdmin
      .from("agendamentos")
      .select("endereco_vistoria")
      .eq("id", (caso as any).agendamento_id)
      .maybeSingle();
    enderecoVistoria = ag?.endereco_vistoria ?? null;
  }

  const enderecoUnidade = [
    unidade?.logradouro,
    unidade?.numero,
    unidade?.bairro,
    unidade?.cidade && unidade?.estado ? `${unidade.cidade}/${unidade.estado}` : unidade?.cidade,
    unidade?.cep,
  ]
    .filter(Boolean)
    .join(", ");

  const cadastro: CadastroFato[] = [];
  if (empresa?.nome) cadastro.push({ label: "Empresa (cliente)", valor: empresa.nome });
  if (matriz?.razao_social) cadastro.push({ label: "Razão social da matriz", valor: matriz.razao_social });
  if (matriz?.nome && matriz?.nome !== matriz?.razao_social) cadastro.push({ label: "Nome da matriz", valor: matriz.nome });
  if (matriz?.cnpj) cadastro.push({ label: "CNPJ", valor: matriz.cnpj });
  if (matriz?.telefone) cadastro.push({ label: "Telefone da matriz", valor: matriz.telefone });
  if (matriz?.email) cadastro.push({ label: "E-mail da matriz", valor: matriz.email });
  if (unidade?.nome) cadastro.push({ label: "Unidade", valor: unidade.nome });
  if (enderecoUnidade) cadastro.push({ label: "Endereço da unidade", valor: enderecoUnidade });
  if (unidade?.telefone) cadastro.push({ label: "Telefone da unidade", valor: unidade.telefone });
  if (unidade?.email) cadastro.push({ label: "E-mail da unidade", valor: unidade.email });
  if (enderecoVistoria) cadastro.push({ label: "Endereço do mapeamento", valor: enderecoVistoria });
  if (unidade?.cidade) cadastro.push({ label: "Cidade", valor: unidade.cidade });
  if (unidade?.estado) cadastro.push({ label: "Estado", valor: unidade.estado });
  if (unidade?.bairro) cadastro.push({ label: "Bairro", valor: unidade.bairro });
  if (unidade?.cep) cadastro.push({ label: "CEP", valor: unidade.cep });

  const agenteNome =
    (caso as any).agente?.nome ?? (caso as any).agente_nome_manual ?? null;
  if (agenteNome) cadastro.push({ label: "Agente técnico", valor: agenteNome });

  const agendadoEm = (caso as any).agendado_em as string | null;
  if (agendadoEm) {
    const d = new Date(agendadoEm);
    cadastro.push({
      label: "Data do mapeamento",
      valor: d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    });
    cadastro.push({
      label: "Hora do mapeamento",
      valor: d.toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  }

  const rotulosEnum: Record<string, string> = {
    instalacao: "Instalação",
    upgrade: "Upgrade",
    presencial: "Presencial",
    remoto: "Remoto",
    nivel_1: "Nível 1",
    nivel_2: "Nível 2",
    nivel_3: "Nível 3",
  };
  const tipoSolicitacao = (caso as any).tipo_solicitacao as string | null;
  const modalidade = (caso as any).modalidade as string | null;
  const nivel = (caso as any).nivel as string | null;
  if (tipoSolicitacao)
    cadastro.push({ label: "Tipo de solicitação", valor: rotulosEnum[tipoSolicitacao] ?? tipoSolicitacao });
  if (modalidade) cadastro.push({ label: "Modalidade", valor: rotulosEnum[modalidade] ?? modalidade });
  if (nivel) cadastro.push({ label: "Nível do serviço", valor: rotulosEnum[nivel] ?? nivel });
  if ((caso as any).observacoes_agendamento) cadastro.push({ label: "Observações do agendamento", valor: (caso as any).observacoes_agendamento });

  const { data: formulario } = await supabaseAdmin
    .from("formularios")
    .select("nome")
    .eq("id", caso.formulario_id)
    .maybeSingle();

  const { data: secoes } = await supabaseAdmin
    .from("secoes")
    .select("id, titulo, ordem")
    .eq("formulario_id", caso.formulario_id)
    .order("ordem");

  const secoesIds = (secoes ?? []).map((s) => s.id);
  const { data: perguntasRaw } = secoesIds.length
    ? await supabaseAdmin
        .from("perguntas")
        .select(
          "id, secao_id, texto, tipo, obrigatoria, ordem, instrucao_agente, contexto_ia, condicional_pergunta_id, condicional_operador, condicional_valor, bloco_id, bloco_linha, bloco_coluna, chave_laudo",
        )
        .in("secao_id", secoesIds)
        .order("ordem")
    : { data: [] };

  const { data: blocosRaw } = secoesIds.length
    ? await supabaseAdmin
        .from("pergunta_blocos")
        .select("id, secao_id, titulo, descricao, layout, ordem")
        .in("secao_id", secoesIds)
        .order("ordem")
    : { data: [] };

  const pIds = (perguntasRaw ?? []).map((p: any) => p.id);
  const { data: opcoes } = pIds.length
    ? await supabaseAdmin
        .from("opcoes_pergunta")
        .select("id, pergunta_id, texto, ordem")
        .in("pergunta_id", pIds)
        .order("ordem")
    : { data: [] };

  const opcoesPorP = new Map<string, { id: string; texto: string }[]>();
  for (const o of opcoes ?? []) {
    const a = opcoesPorP.get(o.pergunta_id) ?? [];
    a.push({ id: o.id, texto: o.texto });
    opcoesPorP.set(o.pergunta_id, a);
  }

  const secaoTitulo = new Map((secoes ?? []).map((s) => [s.id, s.titulo as string]));
  const secaoOrdem = new Map((secoes ?? []).map((s) => [s.id, Number(s.ordem) || 0]));
  const perguntas: AgentPergunta[] = (perguntasRaw ?? []).map((p: any) => ({
    id: p.id,
    secao_id: p.secao_id,
    secao_titulo: secaoTitulo.get(p.secao_id) ?? "",
    secao_ordem: secaoOrdem.get(p.secao_id) ?? 0,
    texto: p.texto,
    tipo: p.tipo,
    obrigatoria: !!p.obrigatoria,
    ordem: p.ordem,
    instrucao_agente: p.instrucao_agente ?? null,
    contexto_ia: p.contexto_ia ?? null,
    opcoes: opcoesPorP.get(p.id) ?? [],
    condicional_pergunta_id: p.condicional_pergunta_id ?? null,
    condicional_operador: p.condicional_operador ?? null,
    condicional_valor: p.condicional_valor ?? null,
    bloco_id: p.bloco_id ?? null,
    bloco_linha: p.bloco_linha ?? null,
    bloco_coluna: p.bloco_coluna ?? null,
    chave_laudo: p.chave_laudo ?? null,
  })).sort((a, b) => a.secao_ordem - b.secao_ordem || a.ordem - b.ordem);

  const blocos: AgentBloco[] = (blocosRaw ?? []).map((b: any) => ({
    id: b.id,
    secao_id: b.secao_id,
    titulo: b.titulo,
    descricao: b.descricao ?? null,
    layout: (b.layout ?? "cartao") as BlocoLayout,
    ordem: Number(b.ordem) || 0,
  }));

  const { data: respostas } = await supabaseAdmin
    .from("respostas_agente")
    .select("pergunta_id, valor_texto, arquivo_path, arquivos_paths, transcricao, ia_motivo")
    .eq("caso_id", casoId);
  const state: Record<string, AgentResposta> = {};
  for (const r of respostas ?? []) {
    state[r.pergunta_id] = {
      valor_texto: r.valor_texto ?? null,
      arquivo_path: r.arquivo_path ?? null,
      arquivos_paths: (r as any).arquivos_paths ?? [],
      transcricao: r.transcricao ?? null,
      origem_cadastro: (r as any).ia_motivo === MOTIVO_CADASTRO_PENDENTE,
    };
  }

  return {
    casoId,
    clienteNome,
    formularioNome: formulario?.nome ?? "",
    perguntas,
    blocos,
    secoes: (secoes ?? []).map((s: any) => ({
      id: s.id,
      titulo: s.titulo,
      ordem: Number(s.ordem) || 0,
    })),
    state,
    cadastro,
  };
}

/** Filter perguntas by current state's conditional rules. */
export function perguntasVisiveis(ctx: AgentContext): AgentPergunta[] {
  // adapt state to format avaliarCondicional expects
  const adapted: Record<string, { text?: string; transcription?: string }> = {};
  for (const [k, v] of Object.entries(ctx.state)) {
    adapted[k] = { text: v.valor_texto ?? undefined, transcription: v.transcricao ?? undefined };
  }
  return ctx.perguntas.filter((p) =>
    avaliarCondicional(
      {
        condicional_pergunta_id: p.condicional_pergunta_id,
        condicional_operador: p.condicional_operador,
        condicional_valor: p.condicional_valor,
      },
      adapted as any,
    ),
  );
}

/**
 * Fonte única da verdade: uma pergunta só é considerada respondida quando há
 * texto não vazio, arquivo, lista de arquivos ou transcrição.
 */
export function estaRespondida(r: AgentResposta | undefined): boolean {
  return !!(
    (r?.valor_texto && r.valor_texto.trim()) ||
    r?.arquivo_path ||
    (r?.transcricao && r.transcricao.trim()) ||
    (r?.arquivos_paths && r.arquivos_paths.length > 0)
  );
}

export type BlocoPendente = AgentBloco & {
  secao_titulo: string;
  perguntas: AgentPergunta[];
};

export type Pendencias = {
  totalVisiveis: number;
  respondidas: number;
  totalObrigatorias: number;
  respondidasObrigatorias: number;
  obrigatoriasFaltando: number;
  pendentesObrigatorias: AgentPergunta[];
  pendentesOpcionais: AgentPergunta[];
  proxima: AgentPergunta | null;
  proximoBloco: BlocoPendente | null;
  secaoAtualIndice: number;
  totalSecoes: number;
  /** "Momentos" de resposta: blocos contam como 1 interação. */
  totalMomentos: number;
  momentosConcluidos: number;
  podeFinalizar: boolean;
};

/** Recalcula pendências a partir do estado atual do contexto. */
export function calcularPendencias(ctx: AgentContext): Pendencias {
  const visiveis = perguntasVisiveis(ctx);
  const resp = (p: AgentPergunta) => estaRespondida(ctx.state[p.id]);
  const obrigatorias = visiveis.filter((p) => p.obrigatoria);
  const pendentes = visiveis.filter((p) => !resp(p));
  const pendentesObrigatorias = pendentes.filter((p) => p.obrigatoria);
  const pendentesOpcionais = pendentes.filter((p) => !p.obrigatoria);
  const proxima = pendentes[0] ?? null;

  // Bloco da próxima pendência (com todas as perguntas visíveis do grupo).
  let proximoBloco: BlocoPendente | null = null;
  if (proxima?.bloco_id) {
    const bloco = ctx.blocos.find((b) => b.id === proxima.bloco_id);
    if (bloco) {
      const perguntasBloco = visiveis.filter((p) => p.bloco_id === bloco.id);
      if (perguntasBloco.length > 0) {
        proximoBloco = {
          ...bloco,
          secao_titulo: proxima.secao_titulo,
          perguntas: perguntasBloco,
        };
      }
    }
  }

  // Momentos: cada bloco visível conta 1; perguntas soltas contam 1 cada.
  const blocosVisiveis = new Map<string, AgentPergunta[]>();
  let soltas = 0;
  let soltasRespondidas = 0;
  for (const p of visiveis) {
    if (p.bloco_id) {
      const arr = blocosVisiveis.get(p.bloco_id) ?? [];
      arr.push(p);
      blocosVisiveis.set(p.bloco_id, arr);
    } else {
      soltas++;
      if (resp(p)) soltasRespondidas++;
    }
  }
  let blocosConcluidos = 0;
  for (const arr of blocosVisiveis.values()) {
    if (arr.every(resp)) blocosConcluidos++;
  }

  const secoesOrdenadas = [...ctx.secoes].sort((a, b) => a.ordem - b.ordem);
  const secaoAtualIndice = proxima
    ? Math.max(0, secoesOrdenadas.findIndex((s) => s.id === proxima.secao_id))
    : Math.max(0, secoesOrdenadas.length - 1);

  return {
    totalVisiveis: visiveis.length,
    respondidas: visiveis.filter(resp).length,
    totalObrigatorias: obrigatorias.length,
    respondidasObrigatorias: obrigatorias.filter(resp).length,
    obrigatoriasFaltando: pendentesObrigatorias.length,
    pendentesObrigatorias,
    pendentesOpcionais,
    // Retoma exatamente na primeira lacuna da sequência oficial do formulário.
    // O bloqueio de finalização continua dependendo apenas das obrigatórias.
    proxima,
    proximoBloco,
    secaoAtualIndice,
    totalSecoes: secoesOrdenadas.length,
    totalMomentos: soltas + blocosVisiveis.size,
    momentosConcluidos: soltasRespondidas + blocosConcluidos,
    podeFinalizar: pendentesObrigatorias.length === 0,
  };
}

function normalizarRotulo(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Persiste dados cadastrais inequívocos antes de iniciar a conversa. */
export async function sincronizarCadastro(ctx: AgentContext): Promise<void> {
  const fatos = new Map(ctx.cadastro.map((f) => [normalizarRotulo(f.label), f.valor]));
  for (const pergunta of ctx.perguntas) {
    if (estaRespondida(ctx.state[pergunta.id])) continue;
    const texto = normalizarRotulo(pergunta.texto);
    let valor: string | undefined;
    if (pergunta.tipo === "cnpj" || texto.includes("cnpj")) valor = fatos.get("cnpj");
    else if (pergunta.tipo === "cep" || texto.includes("cep")) {
      valor = fatos.get("endereco da unidade")?.match(/\b\d{5}-?\d{3}\b/)?.[0];
    } else if (texto.includes("endereco") && !texto.includes("foto")) {
      valor = fatos.get("endereco do mapeamento") ?? fatos.get("endereco da unidade");
    }
    if (!valor) continue;
    await execSalvarResposta(ctx.casoId, ctx, { pergunta_id: pergunta.id, valor_texto: valor });
  }
}

export function buildSystemPrompt(ctx: AgentContext): string {
  const visiveis = perguntasVisiveis(ctx);
  const flat = visiveis.map((p) => {
    const resp = ctx.state[p.id];
    const respondida = estaRespondida(resp);

    return {
      pergunta_id: p.id,
      secao: p.secao_titulo,
      texto: p.texto,
      tipo: p.tipo,
      obrigatoria: p.obrigatoria,
      instrucao: p.instrucao_agente,
      contexto_ia: p.contexto_ia,
      opcoes: p.opcoes.length ? p.opcoes : undefined,
      bloco: p.bloco_id
        ? {
            id: p.bloco_id,
            titulo: ctx.blocos.find((b) => b.id === p.bloco_id)?.titulo ?? "",
            layout: ctx.blocos.find((b) => b.id === p.bloco_id)?.layout ?? "cartao",
            linha: p.bloco_linha,
            coluna: p.bloco_coluna,
          }
        : undefined,
      condicional: p.condicional_pergunta_id
        ? {
            depende_de: p.condicional_pergunta_id,
            operador: p.condicional_operador ?? "igual",
            valor: p.condicional_valor,
          }
        : undefined,
      respondida,
      resposta_atual: respondida
        ? {
            valor_texto: resp?.valor_texto ?? null,
            arquivo_path: resp?.arquivo_path ?? null,
            transcricao: resp?.transcricao ?? null,
          }
        : undefined,
    };
  });

  const pend = calcularPendencias(ctx);
  const proxima = pend.proxima;
  const faltando = pend.obrigatoriasFaltando;

  const listaPendentes = (arr: AgentPergunta[]) =>
    arr.length
      ? arr.map((p) => `  - ${p.id} :: ${p.texto}`).join("\n")
      : "  - (nenhuma)";

  const cadastroBloco = ctx.cadastro.length
    ? ctx.cadastro.map((c) => `- ${c.label}: ${c.valor}`).join("\n")
    : "- (nenhum dado de cadastro disponível)";

  return [
    `# ESTADO OFICIAL (fonte da verdade — recalculado pelo servidor neste turno)`,
    `- Obrigatórias respondidas: ${pend.respondidasObrigatorias}/${pend.totalObrigatorias}`,
    `- Obrigatórias faltando: ${faltando}`,
    `- Total respondidas (incluindo opcionais): ${pend.respondidas}/${pend.totalVisiveis}`,
    `- PODE FINALIZAR: ${pend.podeFinalizar ? "SIM" : "NÃO"}`,
    proxima
      ? `- PRÓXIMA PERGUNTA A FAZER AGORA: ${proxima.id} :: "${proxima.texto}"`
      : `- Não há perguntas pendentes.`,
    ``,
    `## Obrigatórias pendentes (${pend.pendentesObrigatorias.length})`,
    listaPendentes(pend.pendentesObrigatorias.slice(0, 40)),
    `## Opcionais pendentes (${pend.pendentesOpcionais.length})`,
    listaPendentes(pend.pendentesOpcionais.slice(0, 20)),
    ``,

    `Você é o assistente técnico da Ionics conduzindo o **mapeamento técnico** de **${ctx.clienteNome}** usando o formulário **${ctx.formularioNome}**.`,
    ``,
    `## Contexto exclusivo`,
    `- Este atendimento é um **mapeamento técnico**. Use SEMPRE o termo "mapeamento" (nunca "vistoria", "inspeção", "auditoria" ou termos correlatos) ao se referir ao trabalho em andamento, em perguntas, confirmações e fechamentos.`,
    `- Refira-se ao usuário como "agente técnico" (não "vistoriador").`,
    ``,
    `## Dados já cadastrados no mapeamento (NÃO pergunte sobre eles)`,
    `Os dados abaixo já foram informados no cadastro deste mapeamento e você já os conhece. **Não pergunte novamente.** Se uma pergunta do formulário pedir um desses dados, pule-a salvando diretamente com \`salvar_resposta\` usando o valor já conhecido, e siga para a próxima pendente. Se o usuário pedir para revisar, responda diretamente com o valor abaixo.`,
    cadastroBloco,
    ``,
    `## Regras de conversa`,
    `- Idioma: português do Brasil. Tom: formal técnico ("Por favor, informe…", "Poderia confirmar…").`,
    `- **Inicie a conversa direto pela primeira pergunta pendente** — não faça apresentação longa nem pergunte dados de cliente/endereço que já constam acima. Um cumprimento curto ("Olá! Vamos continuar o mapeamento.") seguido imediatamente da próxima pergunta basta.`,
    `- Faça **uma pergunta por vez**, reformulando o texto cru de forma natural e clara. Não leia o texto da pergunta literalmente — explique o que precisa.`,
    `- **Blocos agrupados:** quando a próxima pendência pertence a um bloco (campo \`bloco\` no JSON abaixo), a interface exibe um cartão com TODOS os campos do bloco de uma vez e o agente técnico preenche tudo junto. Nesse caso, anuncie o bloco em uma frase curta (ex.: \"Vamos registrar os dados da Bomba.\") e NÃO repita as perguntas campo a campo nem chame \`salvar_resposta\` — o cartão salva sozinho. Quando receber a mensagem \"[BLOCO_SALVO ...]\", apenas confirme brevemente e siga para a próxima pendência.`,
    `- Para perguntas tipo "foto", peça que o agente técnico anexe a imagem pelo botão de câmera.`,
    `- Para perguntas tipo "audio", aceite a transcrição enviada como texto.`,
    `- Para perguntas com \`opcoes\`, apresente as opções numeradas.`,
    `- **Aceite respostas em batch:** se o usuário fornecer várias informações numa só mensagem, chame \`salvar_resposta\` várias vezes — uma por pergunta — antes de fazer a próxima.`,
    `- **Sempre** chame \`salvar_resposta\` antes de avançar. Use o exato \`pergunta_id\` listado abaixo.`,
    `- Respeite condicionais: pergunte apenas as visíveis listadas. Se uma resposta tornar nova pergunta visível, ela aparecerá no próximo turno.`,
    `- Quando o usuário anexar uma ou mais fotos (mensagem contendo "[ANEXO_FOTO arquivo_path=..." ou "[ANEXO_FOTOS arquivos_paths=p1,p2,..."), chame \`validar_foto\` na PRIMEIRA foto e em seguida chame \`salvar_resposta\` UMA ÚNICA VEZ passando \`arquivos_paths\` com a lista completa (ou \`arquivo_path\` se for só uma). Não crie respostas separadas por foto — todas pertencem ao mesmo \`pergunta_id\`.`,
    `- **Revisão de respostas anteriores:** se o usuário pedir para revisar/consultar algo que já respondeu, consulte o \`state\` ou os dados de cadastro acima e responda diretamente — NÃO chame \`salvar_resposta\` nesse caso. Depois, retome a próxima pergunta pendente.`,
    `- A interface mostra apenas a sua última mensagem por vez (estilo ChatGPT). Por isso, cada turno deve conter a pergunta atual completa e autocontida — não diga "como mencionei acima".`,
    `- **Nunca** sugira, mencione ou implique que o mapeamento pode ser finalizado enquanto \`Obrigatórias faltando > 0\`. Se o usuário pedir para finalizar antes disso, informe quantas obrigatórias ainda faltam, liste as próximas e retome imediatamente pela PRÓXIMA PERGUNTA indicada no ESTADO OFICIAL.`,
    `- Quando (e SOMENTE quando) \`PODE FINALIZAR: SIM\`, agradeça e informe que o mapeamento pode ser finalizado pelo botão "Finalizar" no topo.`,
    `- Em caso de dúvida sobre o que falta, chame a ferramenta \`proximas_pendentes\` antes de responder. Nunca conclua o mapeamento por suposição.`,
    `- Após cada \`salvar_resposta\`, o tool retorna \`estado_pos_salvamento\` com \`obrigatorias_faltando\` e \`proxima_pergunta_id\` — siga OBRIGATORIAMENTE para \`proxima_pergunta_id\`, ignorando qualquer suposição anterior.`,
    ``,
    `## Status atual`,
    `- Perguntas visíveis: ${flat.length}`,
    `- Já respondidas: ${flat.filter((p) => p.respondida).length}`,
    `- Obrigatórias faltando: ${faltando}`,
    proxima ? `- Próxima sugerida: ${proxima.id} ("${proxima.texto}")` : `- Todas respondidas.`,

    ``,
    `## Formulário (perguntas visíveis com estado atual)`,
    `\`\`\`json`,
    JSON.stringify(flat, null, 2),
    `\`\`\``,
  ].join("\n");
}

/** Tool executors. They have closure over casoId via the route handler. */

export async function execSalvarResposta(
  casoId: string,
  ctx: AgentContext,
  input: {
    pergunta_id: string;
    valor_texto?: string;
    opcao_id?: string;
    arquivo_path?: string;
    arquivos_paths?: string[];
    transcricao?: string;
  },
): Promise<{ ok: boolean; motivo?: string; estado_pos_salvamento?: { obrigatorias_faltando: number; total_obrigatorias: number; respondidas_obrigatorias: number; proxima_pergunta_id: string | null; pode_finalizar: boolean } }> {
  const p = ctx.perguntas.find((x) => x.id === input.pergunta_id);
  if (!p) return { ok: false, motivo: "pergunta_id desconhecido para este formulário." };

  let valor_texto = input.valor_texto ?? null;
  // Aceita lista (multi-foto) ou caminho único (legado). Para foto, agregamos
  // com o que já estiver salvo, sem duplicar.
  const existente = ctx.state[input.pergunta_id];
  const incomingList = (input.arquivos_paths ?? []).filter(Boolean);
  const incomingSingle = input.arquivo_path ? [input.arquivo_path] : [];
  let arquivos_paths: string[] = [];
  if (p.tipo === "foto") {
    const merged = [
      ...(existente?.arquivos_paths ?? []),
      ...incomingList,
      ...incomingSingle,
    ];
    arquivos_paths = Array.from(new Set(merged.filter(Boolean)));
  } else {
    arquivos_paths = [...incomingList, ...incomingSingle];
  }
  const arquivo_path = arquivos_paths[0] ?? input.arquivo_path ?? null;
  const transcricao = input.transcricao ?? null;

  // Type-specific validation
  if (p.tipo === "foto" && !arquivo_path) {
    return { ok: false, motivo: "Pergunta tipo foto exige arquivo_path ou arquivos_paths." };
  }
  if (p.tipo === "video" && !arquivo_path) {
    return { ok: false, motivo: "Pergunta tipo vídeo exige arquivo_path." };
  }
  if (p.tipo === "audio" && !transcricao && !arquivo_path) {
    return { ok: false, motivo: "Pergunta tipo audio exige transcricao ou arquivo_path." };
  }
  if (p.tipo === "selecao_unica") {
    if (input.opcao_id) {
      const opc = p.opcoes.find((o) => o.id === input.opcao_id);
      if (!opc) return { ok: false, motivo: "opcao_id inválido." };
      valor_texto = opc.texto;
    } else if (valor_texto) {
      const match = p.opcoes.find(
        (o) => o.texto.toLowerCase().trim() === valor_texto!.toLowerCase().trim(),
      );
      if (!match) {
        return {
          ok: false,
          motivo: `valor_texto não corresponde a nenhuma opção. Opções: ${p.opcoes.map((o) => o.texto).join(" | ")}`,
        };
      }
      valor_texto = match.texto;
    } else {
      return { ok: false, motivo: "Forneça opcao_id ou valor_texto correspondendo a uma opção." };
    }
  }
  if (p.tipo === "toggle") {
    const v = (valor_texto ?? "").toLowerCase().trim();
    if (!["sim", "nao", "não"].includes(v)) {
      return { ok: false, motivo: "Toggle aceita apenas 'sim' ou 'nao'." };
    }
    valor_texto = v === "não" ? "nao" : v;
  }

  const { error } = await supabaseAdmin
    .from("respostas_agente")
    .upsert(
      {
        caso_id: casoId,
        pergunta_id: input.pergunta_id,
        tipo: p.tipo as any,
        valor_texto,
        arquivo_path,
        arquivos_paths,
        transcricao,
      },
      { onConflict: "caso_id,pergunta_id" },
    );
  if (error) return { ok: false, motivo: error.message };

  // Update in-memory state so subsequent tool calls in same turn see it
  ctx.state[input.pergunta_id] = {
    valor_texto,
    arquivo_path,
    arquivos_paths,
    transcricao,
  };

  // Marca o mapeamento como iniciado na primeira resposta salva.
  try {
    const { data: caso } = await supabaseAdmin
      .from("casos")
      .select("status, agente_id, agendamento_id")
      .eq("id", casoId)
      .maybeSingle();
    if (caso && (caso.status === "agendado" || caso.status === "rascunho")) {
      const { error: updErr } = await supabaseAdmin
        .from("casos")
        .update({ status: "em_andamento" })
        .eq("id", casoId)
        .in("status", ["agendado", "rascunho"]);
      if (!updErr) {
        await registrarEvento({
          casoId,
          agendamentoId: caso.agendamento_id ?? null,
          tipo: "vistoria_iniciada",
          atorId: caso.agente_id ?? null,
        });
      }
    }
  } catch (e) {
    console.error("[vistoria] falha ao marcar iniciada:", e);
  }

  // Compute post-save state so the model can see the real numbers immediately.
  const pend = calcularPendencias(ctx);

  return {
    ok: true,
    estado_pos_salvamento: {
      obrigatorias_faltando: pend.obrigatoriasFaltando,
      total_obrigatorias: pend.totalObrigatorias,
      respondidas_obrigatorias: pend.respondidasObrigatorias,
      proxima_pergunta_id: pend.proxima?.id ?? null,
      pode_finalizar: pend.podeFinalizar,
    },
  };

}

export async function execValidarFoto(
  ctx: AgentContext,
  input: { pergunta_id: string; arquivo_path: string },
): Promise<{ status: string; problemas: string[]; orientacao: string } | { erro: string }> {
  const p = ctx.perguntas.find((x) => x.id === input.pergunta_id);
  if (!p) return { erro: "pergunta_id desconhecido." };
  if (p.tipo !== "foto") return { erro: "Pergunta não é do tipo foto." };

  const { data: blob, error } = await supabaseAdmin.storage
    .from("agente-uploads")
    .download(input.arquivo_path);
  if (error || !blob) return { erro: "Não foi possível baixar a foto." };

  const ab = await blob.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const base64 = btoa(bin);
  const mime = (blob as any).type || "image/jpeg";

  const { generateText, Output } = await import("ai");
  const { z } = await import("zod");
  const { createOpenAIProvider } = await import("@/lib/openai.server");
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { erro: "OPENAI_API_KEY ausente." };
  const provider = createOpenAIProvider(key);
  const model = provider("gpt-4o-mini");

  const schema = z.object({
    status: z.enum(["aprovada", "parcial", "incorreta"]),
    problemas: z.array(z.string()),
    orientacao: z.string(),
  });

  const contexto = p.contexto_ia?.trim() || p.instrucao_agente?.trim() || p.texto;
  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema }),
      messages: [
        {
          role: "system",
          content:
            "Você valida fotos de mapeamentos técnicos. Compare a imagem ao contexto e responda em PT-BR.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Pergunta: ${p.texto}\nContexto esperado: ${contexto}` },
            { type: "image", image: `data:${mime};base64,${base64}` },
          ],
        },
      ],
    });
    return output;
  } catch (e: any) {
    return { erro: String(e?.message ?? e) };
  }
}
