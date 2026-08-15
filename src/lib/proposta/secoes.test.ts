import { describe, expect, it } from "vitest";
import { extrairEscopoDeterministico } from "@/lib/proposta/extrair.server";
import { comboioExplicito, faseParaNivel, segmentarProposta } from "@/lib/proposta/secoes";
import { blocosNivel2, temComboio } from "@/lib/laudo/blocos-nivel2";
import type { VariaveisLaudo } from "@/lib/laudo/tipos";
import { variaveisDaProposta } from "@/lib/proposta/para-laudo";

const PROPOSTA_SETEL = `
PROPOSTA COMERCIAL IONICS
Responsável pela Proposta IONICS: Mariela Smoje
Empresa: SETEL CONSTRUTORA LTDA
CNPJ: 15.206.469/0001-59
Cidade/UF: Campinas de Piraja - BA
CEP: 41270-005
Endereço: Estrada de Campinas 63
Contato: Silvany
Solução: SSG Frota

2. AUTOMAÇÃO PARA OS POSTOS FIXOS E COMBOIOS
2.1 FASE 1 - Nível 1: controle de acesso e apontamento.
2.2 FASE 2 - Nível 2: automatização de bombas, bicos, veículos e máquinas, com DIV/NLDIV.
2.3 FASE 3 e FASE 4: integrações avançadas com o SAAF.

3.6 Automatização do processo de abastecimento de combustível em FASE 2, para: 01 posto fixo; 01 bombas mecânicas com 01 bico.
3.7 KIT SSGFrota FASE 2 (para bomba FIXA ou MÓVEL) - qtd 1
Terminal T850 e NLDIV Wireless inclusos no kit.

OBSERVAÇÕES
A comunicação prevista será via WIFI disponibilizado pelo cliente.
A comunicação 4G+WIFI é uma opção adicional, cotada à parte.
Os itens de infraestrutura serão dimensionados no mapeamento técnico.
Os dispositivos de identificação podem variar conforme o veículo.
`;

function vars(escopo: any): VariaveisLaudo {
  return variaveisDaProposta(escopo);
}

describe("segmentação da proposta", () => {
  it("separa cabeçalho, escopo específico e observações", () => {
    const s = segmentarProposta(PROPOSTA_SETEL);
    expect(s.cabecalho).toContain("SETEL CONSTRUTORA LTDA");
    expect(s.escopo).toContain("01 posto fixo");
    expect(s.observacoes).toContain("WIFI");
    expect(s.institucional).toContain("FASE 3");
  });
});

describe("escopo SETEL", () => {
  const escopo = extrairEscopoDeterministico(PROPOSTA_SETEL);

  it("lê identificação do cabeçalho", () => {
    expect(escopo.cnpj.valor).toBe("15.206.469/0001-59");
    expect(escopo.cep.valor).toBe("41270-005");
    expect(escopo.responsavel_proposta.valor).toContain("Mariela");
    expect(escopo.nome_cliente.valor).toContain("SETEL");
  });

  it("lê solução, fase e nível", () => {
    expect(escopo.nome_solucao.valor).toBe("SSG Frota");
    expect(escopo.fase_automacao.valor).toBe(2);
    expect(escopo.nivel_automacao.valor).toBe(2);
  });

  it("lê estruturas do item 3.6", () => {
    expect(escopo.tem_pista.valor).toBe(true);
    expect(escopo.qtd_postos.valor).toBe(1);
    expect(escopo.qtd_bombas.valor).toBe(1);
    expect(escopo.tipo_bomba_previsto.valor).toBe("mecânica");
    expect(escopo.qtd_bicos.valor).toBe(1);
  });

  it("NÃO marca comboio por título genérico nem por 'bomba FIXA ou MÓVEL'", () => {
    expect(escopo.tem_comboio.valor).toBe(false);
    expect(comboioExplicito(segmentarProposta(PROPOSTA_SETEL)).valor).toBe(false);
  });

  it("lê comunicação prevista Wi-Fi (4G é adicional)", () => {
    expect(escopo.comunicacao_prevista.valor).toBe("wifi");
  });
});

describe("fase → nível", () => {
  it("mapeia só o que é oficial", () => {
    expect(faseParaNivel(1)).toBe(1);
    expect(faseParaNivel(2)).toBe(2);
    expect(faseParaNivel(3)).toBeNull();
    expect(faseParaNivel(4)).toBeNull();
  });
});

describe("comboio explícito", () => {
  it("reconhece comboio quando o escopo específico lista quantidade", () => {
    const texto = PROPOSTA_SETEL.replace(
      "para: 01 posto fixo; 01 bombas mecânicas com 01 bico.",
      "para: 02 caminhões comboio; 02 bombas mecânicas com 02 bicos.",
    );
    const escopo = extrairEscopoDeterministico(texto);
    expect(escopo.tem_comboio.valor).toBe(true);
    expect(escopo.qtd_comboios.valor).toBe(2);
  });
});

describe("condicionais Nível 2 / 2.4 / 2.4.1", () => {
  const bid = (p: string) => `${p}-1`;
  const proximaFigura = () => 1;
  const chaves = (nivel: string, v: VariaveisLaudo) =>
    blocosNivel2({ nivel, variaveis: v, bid, proximaFigura }).map((b: any) => b.chave);

  it("Nível 2 + Pista sem Comboio: 2.4 sim, 2.4.1 não", () => {
    const v = vars(extrairEscopoDeterministico(PROPOSTA_SETEL));
    expect(temComboio(v)).toBe(false);
    const ks = chaves("nivel_2", v);
    expect(ks).toContain("nivel2:2.4");
    expect(ks).not.toContain("nivel2:2.4.1");
  });

  it("Nível 2 + Comboio: 2.4 e 2.4.1", () => {
    const v: VariaveisLaudo = {
      ...vars(extrairEscopoDeterministico(PROPOSTA_SETEL)),
      comboio: { chave: "comboio", valor: "sim", origem: "formulario", confianca: 1 },
    };
    const ks = chaves("nivel_2", v);
    expect(ks).toContain("nivel2:2.4");
    expect(ks).toContain("nivel2:2.4.1");
  });

  it("Nível 1: nenhum dos dois", () => {
    const v = vars(extrairEscopoDeterministico(PROPOSTA_SETEL));
    expect(chaves("nivel_1", v)).toHaveLength(0);
  });

  it("texto livre com 'comboio' não liga o 2.4.1", () => {
    const v: VariaveisLaudo = {
      objeto_escopo: {
        chave: "objeto_escopo",
        valor: "Automação para os postos fixos e comboios",
        origem: "proposta",
        confianca: 0.8,
      },
    };
    expect(temComboio(v)).toBe(false);
  });
});
