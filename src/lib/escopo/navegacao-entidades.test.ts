import { describe, expect, it } from "vitest";
import type { EntidadeEscopo } from "./tipos";
import { contarEstados, estadoDe, montarNavegacao, nomeRealDe, type ItemNav } from "./navegacao-entidades";

const ent = (id: string, tipo: EntidadeEscopo["tipo"], parent: string | null, ordem: number, rotulo: string): EntidadeEscopo => ({
  id,
  tipo,
  parent_id: parent,
  ordem,
  rotulo,
});

let seq = 0;
const item = (entidadeId: string | null, extra: Partial<ItemNav> = {}): ItemNav => ({
  id: `p${++seq}`,
  entidadeId,
  obrigatoria: true,
  respondida: false,
  completa: false,
  texto: "Pergunta",
  valor: "",
  etapaId: "e1",
  etapaTitulo: "Etapa 1",
  etapaOrdem: 1,
  ...extra,
});
const feito = (entidadeId: string | null, extra: Partial<ItemNav> = {}) =>
  item(entidadeId, { respondida: true, completa: true, valor: "x", ...extra });

const entidades: EntidadeEscopo[] = [
  ent("po1", "posto", null, 1, "Posto 01"),
  ent("il1", "ilha", "po1", 1, "Ilha 01"),
  ent("il2", "ilha", "po1", 2, "Ilha 02"),
  ent("b1", "bomba", "il1", 1, "Bomba 01"),
  ent("b2", "bomba", "il1", 2, "Bomba 02"),
  ent("b3", "bomba", "il2", 1, "Bomba 03"),
  ent("bi1", "bico", "b1", 1, "Bico 01"),
  ent("bi2", "bico", "b1", 2, "Bico 02"),
  ent("c1", "comboio", null, 1, "Comboio 01"),
  ent("c2", "comboio", null, 2, "Comboio 02"),
];

describe("estadoDe", () => {
  const p = (respondidas: number, falta: number, obrigTotal = 3, total = 4) => ({
    total,
    respondidas,
    obrigatoriasTotal: obrigTotal,
    obrigatoriasFaltando: falta,
  });
  it("nao iniciada sem respostas", () => expect(estadoDe(p(0, 3), false, false)).toBe("nao_iniciada"));
  it("em andamento com obrigatória faltando", () => expect(estadoDe(p(1, 2), false, false)).toBe("em_andamento"));
  it("com pendências quando marcou/tentou e falta obrigatória", () => {
    expect(estadoDe(p(1, 2), true, false)).toBe("com_pendencias");
    expect(estadoDe(p(1, 2), false, true)).toBe("com_pendencias");
  });
  it("concluída automaticamente quando as obrigatórias estão atendidas", () =>
    expect(estadoDe(p(3, 0), false, false)).toBe("concluida"));
  it("sem obrigatórias: só conclui com tudo respondido ou marcada", () => {
    expect(estadoDe(p(1, 0, 0, 4), false, false)).toBe("em_andamento");
    expect(estadoDe(p(4, 0, 0, 4), false, false)).toBe("concluida");
    expect(estadoDe(p(1, 0, 0, 4), true, false)).toBe("concluida");
  });
});

describe("montarNavegacao", () => {
  it("separa perguntas gerais e agrega a bomba com seus bicos", () => {
    const itens = [
      feito(null),
      feito("b1"),
      item("b1"),
      feito("bi1"),
      feito("bi2"),
      feito("b2"),
      feito("b2"),
    ];
    const nav = montarNavegacao(entidades, itens);
    expect(nav.geral?.estado).toBe("concluida");
    const b1 = nav.porId.get("b1")!;
    expect(b1.total).toBe(4);
    expect(b1.respondidas).toBe(3);
    expect(b1.obrigatoriasFaltando).toBe(1);
    expect(b1.subs.map((s) => s.entidade.id)).toEqual(["bi1", "bi2"]);
    expect(b1.estado).toBe("em_andamento");
    expect(nav.porId.get("b2")!.estado).toBe("concluida");
  });

  it("monta posto › ilha › equipamentos e conta estados por ilha", () => {
    const itens = [feito("b1"), feito("b2"), item("b2"), feito("b3")];
    const nav = montarNavegacao(entidades, itens);
    expect(nav.pista).toHaveLength(1);
    const [il1, il2] = nav.pista[0].ilhas;
    expect(il1.equipamentos.map((u) => u.id)).toEqual(["b1", "b2"]);
    expect(il2.equipamentos.map((u) => u.id)).toEqual(["b3"]);
    expect(contarEstados(il1.equipamentos).concluidas).toBe(1);
    const todas = nav.sequencia("bomba");
    expect(contarEstados(todas)).toMatchObject({ total: 3, concluidas: 2, emAndamento: 1 });
  });

  it("próximo equipamento segue para a próxima ilha e termina no último", () => {
    const itens = [item("b1"), item("b2"), item("b3"), item("c1"), item("c2")];
    const nav = montarNavegacao(entidades, itens);
    expect(nav.proxima("b1")?.id).toBe("b2");
    expect(nav.proxima("b2")?.id).toBe("b3");
    expect(nav.proxima("b3")).toBeNull();
    expect(nav.proxima("c1")?.id).toBe("c2");
    expect(nav.proxima("c2")).toBeNull();
  });

  it("não cria unidades para entidades sem perguntas visíveis", () => {
    const nav = montarNavegacao(entidades, [item("b1")]);
    expect(nav.porId.has("b2")).toBe(false);
    expect(nav.comboios).toHaveLength(0);
  });

  it("dados do próprio posto/ilha viram unidade à parte, sem misturar com as bombas", () => {
    const nav = montarNavegacao(entidades, [feito("il1"), item("b1")]);
    const il = nav.pista[0].ilhas[0];
    expect(il.dados?.id).toBe("il1:dados");
    expect(il.dados?.titulo).toBe("Dados da Ilha 01");
    expect(il.equipamentos.map((u) => u.id)).toEqual(["b1"]);
    expect(nav.proxima("il1:dados")).toBeNull();
  });

  it("posto e ilha sem nenhuma pergunta no formulário não aparecem (ex.: formulário só de comboio)", () => {
    const nav = montarNavegacao(entidades, [item("c1"), item("c2")]);
    expect(nav.pista).toHaveLength(0);
    expect(nav.comboios).toHaveLength(2);
    const soIlha2 = montarNavegacao(entidades, [item("b3")]);
    expect(soIlha2.pista[0].ilhas.map((i) => i.ilha.id)).toEqual(["il2"]);
  });

  it("marcação manual e tentativa mudam o estado com obrigatória faltando", () => {
    const itens = [feito("b1"), item("b1")];
    expect(montarNavegacao(entidades, itens).porId.get("b1")!.estado).toBe("em_andamento");
    expect(montarNavegacao(entidades, itens, { tentaram: new Set(["b1"]) }).porId.get("b1")!.estado).toBe("com_pendencias");
    expect(montarNavegacao(entidades, itens, { concluidas: new Set(["b1"]) }).porId.get("b1")!.estado).toBe("com_pendencias");
  });
});

describe("nomeRealDe", () => {
  it("usa marca/modelo respondido", () => {
    const nome = nomeRealDe([
      feito("b1", { texto: "Tipo de bomba", valor: "Mecânica" }),
      feito("b1", { texto: "Marca / modelo da bomba", valor: "Wayne Helix 6000" }),
    ]);
    expect(nome).toBe("Wayne Helix 6000");
  });
  it("cai para placa/identificação e ignora respostas vazias, sim/não e datas", () => {
    expect(nomeRealDe([feito("c1", { texto: "Placa do veículo", valor: "ABC1D23" })])).toBe("ABC1D23");
    expect(nomeRealDe([feito("c1", { texto: "Possui modelo novo?", valor: "sim" })])).toBeNull();
    expect(nomeRealDe([item("c1", { texto: "Modelo" })])).toBeNull();
  });
  it("sem identificação devolve null (usa só o rótulo)", () => {
    const nav = montarNavegacao(entidades, [feito("c1", { texto: "Observações", valor: "ok" })]);
    expect(nav.porId.get("c1")!.tituloCompleto).toBe("Comboio 01");
  });
  it("título completo junta rótulo e nome real", () => {
    const nav = montarNavegacao(entidades, [feito("c2", { texto: "Marca e modelo do veículo", valor: "Mercedes Atego 1719" })]);
    expect(nav.porId.get("c2")!.tituloCompleto).toBe("Comboio 02 — Mercedes Atego 1719");
  });
});
