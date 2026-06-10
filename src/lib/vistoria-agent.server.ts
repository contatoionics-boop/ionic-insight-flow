// Server-only helpers for the mapeamento técnico conversational agent.
// Loads form/state, builds system prompt, executes tools.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { avaliarCondicional } from "@/lib/perguntas-mapeamento";

export type AgentPergunta = {
  id: string;
  secao_id: string;
  secao_titulo: string;
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
};

export type AgentResposta = {
  valor_texto: string | null;
  arquivo_path: string | null;
  transcricao: string | null;
};

export type CadastroFato = { label: string; valor: string };

export type AgentContext = {
  casoId: string;
  clienteNome: string;
  formularioNome: string;
  perguntas: AgentPergunta[];
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
      "id, formulario_id, agendamento_id, endereco_vistoria, observacoes_agendamento, agendado_em, unidade:unidades(nome, logradouro, numero, bairro, cidade, estado, cep, telefone, email, matriz:matrizes(nome, razao_social, cnpj, telefone, email, logradouro, numero, bairro, cidade, estado, cep, empresa:empresas(nome)))",
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
          "id, secao_id, texto, tipo, obrigatoria, ordem, instrucao_agente, contexto_ia, condicional_pergunta_id, condicional_operador, condicional_valor",
        )
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
  const perguntas: AgentPergunta[] = (perguntasRaw ?? []).map((p: any) => ({
    id: p.id,
    secao_id: p.secao_id,
    secao_titulo: secaoTitulo.get(p.secao_id) ?? "",
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
  }));

  const { data: respostas } = await supabaseAdmin
    .from("respostas_agente")
    .select("pergunta_id, valor_texto, arquivo_path, transcricao")
    .eq("caso_id", casoId);
  const state: Record<string, AgentResposta> = {};
  for (const r of respostas ?? []) {
    state[r.pergunta_id] = {
      valor_texto: r.valor_texto ?? null,
      arquivo_path: r.arquivo_path ?? null,
      transcricao: r.transcricao ?? null,
    };
  }

  return {
    casoId,
    clienteNome,
    formularioNome: formulario?.nome ?? "",
    perguntas,
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

export function buildSystemPrompt(ctx: AgentContext): string {
  const visiveis = perguntasVisiveis(ctx);
  const flat = visiveis.map((p) => {
    const resp = ctx.state[p.id];
    const respondida = !!(resp?.valor_texto || resp?.arquivo_path || resp?.transcricao);
    return {
      pergunta_id: p.id,
      secao: p.secao_titulo,
      texto: p.texto,
      tipo: p.tipo,
      obrigatoria: p.obrigatoria,
      instrucao: p.instrucao_agente,
      contexto_ia: p.contexto_ia,
      opcoes: p.opcoes.length ? p.opcoes : undefined,
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

  const proxima = flat.find((p) => !p.respondida);
  const faltando = flat.filter((p) => p.obrigatoria && !p.respondida).length;

  const cadastroBloco = ctx.cadastro.length
    ? ctx.cadastro.map((c) => `- ${c.label}: ${c.valor}`).join("\n")
    : "- (nenhum dado de cadastro disponível)";

  return [
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
    `- Para perguntas tipo "foto", peça que o agente técnico anexe a imagem pelo botão de câmera.`,
    `- Para perguntas tipo "audio", aceite a transcrição enviada como texto.`,
    `- Para perguntas com \`opcoes\`, apresente as opções numeradas.`,
    `- **Aceite respostas em batch:** se o usuário fornecer várias informações numa só mensagem, chame \`salvar_resposta\` várias vezes — uma por pergunta — antes de fazer a próxima.`,
    `- **Sempre** chame \`salvar_resposta\` antes de avançar. Use o exato \`pergunta_id\` listado abaixo.`,
    `- Respeite condicionais: pergunte apenas as visíveis listadas. Se uma resposta tornar nova pergunta visível, ela aparecerá no próximo turno.`,
    `- Quando o usuário anexar uma foto (mensagem mencionando "[ANEXO_FOTO arquivo_path=...]"), chame \`validar_foto\` com o \`pergunta_id\` adequado e o \`arquivo_path\`. Se aprovada/parcial, chame \`salvar_resposta\` com o \`arquivo_path\`.`,
    `- **Revisão de respostas anteriores:** se o usuário pedir para revisar/consultar algo que já respondeu, consulte o \`state\` ou os dados de cadastro acima e responda diretamente — NÃO chame \`salvar_resposta\` nesse caso. Depois, retome a próxima pergunta pendente.`,
    `- A interface mostra apenas a sua última mensagem por vez (estilo ChatGPT). Por isso, cada turno deve conter a pergunta atual completa e autocontida — não diga "como mencionei acima".`,
    `- Quando todas as perguntas obrigatórias visíveis estiverem respondidas, agradeça e informe que o mapeamento pode ser finalizado pelo botão "Finalizar" no topo.`,
    ``,
    `## Status atual`,
    `- Perguntas visíveis: ${flat.length}`,
    `- Já respondidas: ${flat.filter((p) => p.respondida).length}`,
    `- Obrigatórias faltando: ${faltando}`,
    proxima ? `- Próxima sugerida: ${proxima.pergunta_id} ("${proxima.texto}")` : `- Todas respondidas.`,
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
    transcricao?: string;
  },
): Promise<{ ok: boolean; motivo?: string }> {
  const p = ctx.perguntas.find((x) => x.id === input.pergunta_id);
  if (!p) return { ok: false, motivo: "pergunta_id desconhecido para este formulário." };

  let valor_texto = input.valor_texto ?? null;
  const arquivo_path = input.arquivo_path ?? null;
  const transcricao = input.transcricao ?? null;

  // Type-specific validation
  if (p.tipo === "foto" && !arquivo_path) {
    return { ok: false, motivo: "Pergunta tipo foto exige arquivo_path." };
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
        transcricao,
      },
      { onConflict: "caso_id,pergunta_id" },
    );
  if (error) return { ok: false, motivo: error.message };

  // Update in-memory state so subsequent tool calls in same turn see it
  ctx.state[input.pergunta_id] = {
    valor_texto,
    arquivo_path,
    transcricao,
  };
  return { ok: true };
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
  const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { erro: "LOVABLE_API_KEY ausente." };
  const provider = createLovableAiGatewayProvider(key);
  const model = provider("google/gemini-3-flash-preview");

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
            "Você valida fotos de vistorias técnicas. Compare a imagem ao contexto e responda em PT-BR.",
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
