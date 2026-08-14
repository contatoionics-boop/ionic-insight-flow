import { montarBlocosEAnalise } from "../src/lib/laudo/template";
const V = (o: Record<string,string>) => Object.fromEntries(Object.entries(o).map(([k,v])=>[k,{chave:k,valor:v,origem:"formulario",confianca:1}]));
const r = montarBlocosEAnalise({
  variaveis: V({ nome_cliente:"X", tipo_bomba:"eletronica", marca_bomba:"Wayne", vazao:"75", distancia_pista:"25", area_coberta:"sim", comunicacao_tipos:"wifi", frequencia_wifi:"2.4GHz", qualidade_wifi:"boa", diametro_ponteira_bico:"25,4" }) as any,
  materiais: [], cabecalho:{cliente:"X",unidade:"U",data:"01/01",agente:"A",especialista:"E",modalidade:null},
});
for (const b of r.blocos as any[]) {
  if (b.tipo==="paragraph") console.log("P:", b.texto.slice(0,120));
  if (b.tipo==="bullets") console.log("B:", b.itens[0].slice(0,80));
}
