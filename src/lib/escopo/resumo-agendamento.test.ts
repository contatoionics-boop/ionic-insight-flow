import { describe, expect, it } from "vitest";
import { mesclarCatalogo } from "./catalogo-tipos";
import { resumoEscopoAgendamento } from "./resumo-agendamento";
import { arvoreVazia } from "./tipos";

describe("resumo do escopo no agendamento", () => {
  it("omite grupos sem preenchimento e equipamentos sem identificação", () => {
    const arvore = arvoreVazia();
    arvore.config = { equipamentos: [{ descricao: "", quantidade: 1 }] };
    expect(resumoEscopoAgendamento(arvore, mesclarCatalogo(), [])).toEqual([]);
  });

  it("separa os bicos da pista e dos comboios e inclui tipos personalizados aninhados", () => {
    const arvore = arvoreVazia();
    arvore.postos = [{ ilhas: [{ bombas: [{ bicos: 2 }] }] }];
    arvore.comboios = [{ tanques: 2, bicos: 1, filhos: { patio: [{ nome: "Sul" }] } }];
    const catalogo = mesclarCatalogo([{ chave: "patio", rotulo: "Pátio", plural: "Pátios" }]);
    const linhas = resumoEscopoAgendamento(arvore, catalogo, []);
    expect(linhas.find((linha) => linha.grupo === "Pista")?.itens).toContain("2 bicos");
    expect(linhas.find((linha) => linha.grupo === "Comboios")?.itens).toContain("1 bico");
    expect(linhas.find((linha) => linha.grupo === "Outros itens a mapear")?.itens).toContain("1 pátio");
  });
});
