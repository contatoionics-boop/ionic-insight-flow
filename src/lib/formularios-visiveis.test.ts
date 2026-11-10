import { describe, expect, it } from "vitest";
import { formulariosVisiveis, qtdDeOutrosClientes } from "./formularios-visiveis";

const f = (id: string, nome: string, empresa_id: string | null = null) => ({ id, nome, empresa_id });
const forms = [f("1", "Pista"), f("2", "Comboio"), f("3", "Usina Vertente", "A"), f("4", "Posto Sul", "B")];

describe("formulários visíveis no agendamento", () => {
  it("sem cliente escolhido, só os padrão", () => {
    expect(formulariosVisiveis(forms, "").map((x) => x.id)).toEqual(["2", "1"]);
  });
  it("com cliente: os dele primeiro, depois os padrão; os de outros clientes ficam escondidos", () => {
    const r = formulariosVisiveis(forms, "A");
    expect(r.map((x) => x.id)).toEqual(["3", "2", "1"]);
    expect(r.map((x) => x.grupo)).toEqual(["cliente", "padrao", "padrao"]);
  });
  it("com 'mostrar outros', os de outros clientes entram no fim", () => {
    const r = formulariosVisiveis(forms, "A", true);
    expect(r.map((x) => x.id)).toEqual(["3", "2", "1", "4"]);
    expect(r[3]!.grupo).toBe("outro");
  });
  it("conta os formulários de outros clientes escondidos", () => {
    expect(qtdDeOutrosClientes(forms, "A")).toBe(1);
    expect(qtdDeOutrosClientes(forms, "")).toBe(2);
    expect(qtdDeOutrosClientes([f("1", "x")], "A")).toBe(0);
  });
});
