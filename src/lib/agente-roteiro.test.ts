import { describe, expect, it } from "vitest";
import { agruparPorDia, montarParadas, rotuloDoDia, separarPorAceite, type CasoBase } from "./agente-roteiro";

let n = 0;
const caso = (extra: Partial<CasoBase> = {}): CasoBase => ({
  id: `c${++n}`,
  codigo: `CS-${String(n).padStart(4, "0")}`,
  status: "agendado",
  agendado_em: "2026-10-28T12:00:00.000Z",
  agendamento_id: "a1",
  ...extra,
});

describe("separarPorAceite", () => {
  it("separa aguardando, confirmados e recusados; ignora cancelados", () => {
    const aceites = new Map([
      ["a1", "confirmado"],
      ["a2", "aguardando_aceite"],
      ["a3", "recusado_pelo_agente"],
    ]);
    const r = separarPorAceite(
      [
        caso({ agendamento_id: "a1" }),
        caso({ agendamento_id: "a2" }),
        caso({ agendamento_id: "a3" }),
        caso({ agendamento_id: "a1", status: "cancelado" }),
      ],
      aceites,
    );
    expect(r.aceitos).toHaveLength(1);
    expect(r.aguardando).toHaveLength(1);
    expect(r.recusados).toHaveLength(1);
  });

  it("caso já iniciado ou entregue conta como aceito mesmo sem aceite registrado", () => {
    const r = separarPorAceite(
      [caso({ status: "em_andamento", agendamento_id: "a9" }), caso({ status: "aprovado", agendamento_id: "a9" })],
      new Map(),
    );
    expect(r.aceitos).toHaveLength(2);
    expect(r.aguardando).toHaveLength(0);
  });

  it("sem aceite registrado e agendado = aguardando", () => {
    expect(separarPorAceite([caso({ agendamento_id: "x" })], new Map()).aguardando).toHaveLength(1);
  });
});

describe("montarParadas", () => {
  it("agrupa os formulários do mesmo agendamento e horário numa parada", () => {
    const { ativas } = montarParadas([caso(), caso(), caso({ agendamento_id: "a2" })]);
    expect(ativas).toHaveLength(2);
    expect(ativas.find((p) => p.agendamentoId === "a1")!.casos).toHaveLength(2);
  });

  it("o formulário atual é o em andamento; senão o primeiro pendente", () => {
    const a = caso({ codigo: "CS-0001" });
    const b = caso({ codigo: "CS-0002", status: "em_andamento" });
    expect(montarParadas([a, b]).ativas[0]!.atual?.codigo).toBe("CS-0002");
    const c = caso({ codigo: "CS-0003", status: "aguardando_revisao", agendamento_id: "z" });
    const d = caso({ codigo: "CS-0004", agendamento_id: "z" });
    expect(montarParadas([c, d]).ativas[0]!.atual?.codigo).toBe("CS-0004");
  });

  it("parada com tudo entregue vai para entregues", () => {
    const r = montarParadas([caso({ status: "aprovado", agendamento_id: "e" }), caso({ status: "aguardando_revisao", agendamento_id: "e" })]);
    expect(r.ativas).toHaveLength(0);
    expect(r.entregues).toHaveLength(1);
    expect(r.entregues[0]!.atual).toBeNull();
  });

  it("ordena por data e põe a que está em andamento primeiro", () => {
    const tarde = caso({ agendado_em: "2026-10-30T12:00:00.000Z", agendamento_id: "t" });
    const cedo = caso({ agendado_em: "2026-10-27T12:00:00.000Z", agendamento_id: "c" });
    const andamento = caso({ agendado_em: "2026-11-05T12:00:00.000Z", agendamento_id: "m", status: "em_andamento" });
    const ordem = montarParadas([tarde, andamento, cedo]).ativas.map((p) => p.agendamentoId);
    expect(ordem).toEqual(["m", "c", "t"]);
  });
});

describe("rotuloDoDia / agruparPorDia", () => {
  const agora = new Date(2026, 9, 28, 10, 0); // 28/10/2026 10:00 local
  it("atrasados, hoje, amanhã e demais dias", () => {
    expect(rotuloDoDia(new Date(2026, 9, 27, 9), agora)).toMatchObject({ rotulo: "Atrasados", atrasado: true });
    expect(rotuloDoDia(new Date(2026, 9, 28, 15), agora).rotulo).toBe("Hoje");
    expect(rotuloDoDia(new Date(2026, 9, 29, 8), agora).rotulo).toBe("Amanhã");
    expect(rotuloDoDia(new Date(2026, 10, 2, 8), agora).rotulo).toMatch(/02\/11$/);
    expect(rotuloDoDia(null, agora).rotulo).toBe("Sem data");
  });

  it("agrupa paradas por dia mantendo a ordem; em andamento cai em Hoje", () => {
    const hoje = caso({ agendado_em: new Date(2026, 9, 28, 14).toISOString(), agendamento_id: "h" });
    const amanha = caso({ agendado_em: new Date(2026, 9, 29, 9).toISOString(), agendamento_id: "m" });
    const velho = caso({ agendado_em: new Date(2026, 9, 20, 9).toISOString(), agendamento_id: "v", status: "em_andamento" });
    const grupos = agruparPorDia(montarParadas([amanha, hoje, velho]).ativas, agora);
    expect(grupos.map((g) => g.rotulo)).toEqual(["Hoje", "Amanhã"]);
    expect(grupos[0]!.paradas.map((p) => p.agendamentoId)).toEqual(["v", "h"]);
  });
});
