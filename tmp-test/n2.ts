import { montarBlocos } from "../src/lib/laudo/template";
import { mesclarDocumento } from "../src/lib/laudo/mesclar";
import { figuraEstatica } from "../src/lib/laudo/figuras-estaticas.server";

const V = (o: Record<string,string>) => Object.fromEntries(Object.entries(o).map(([k,v])=>[k,{chave:k,valor:v,origem:"formulario" as const,confianca:1}]));
const base = { materiais: [], cabecalho: { cliente:"c",unidade:"u",data:"d",agente:"a",especialista:"e",modalidade:null } };

function run(nome:string, vars:any){
  const b1 = montarBlocos({ ...base, variaveis: vars } as any);
  let doc = mesclarDocumento([], b1).blocos;
  doc = mesclarDocumento(doc, montarBlocos({ ...base, variaveis: vars } as any)).blocos;
  doc = mesclarDocumento(doc, montarBlocos({ ...base, variaveis: vars } as any)).blocos;
  const h = doc.filter(b=>b.tipo==="heading").map((b:any)=>b.texto);
  const dupHead = h.filter((t,i)=>h.indexOf(t)!==i);
  const imgs = doc.filter((b:any)=>b.tipo==="image");
  console.log(nome, {
    vii: h.filter(t=>t.startsWith("VII.")).length,
    t24: h.filter(t=>t.startsWith("2.4.")).length,
    t241: h.filter(t=>t.startsWith("2.4.1")).length,
    dupHead,
    imgs: imgs.map((i:any)=>i.url),
    estaticas: imgs.filter((i:any)=>!!figuraEstatica(i.url)).length,
  });
}
run("N2 sem comboio", V({nivel_servico:"nivel_2", nome_solucao:"SAAF", comunicacao_tipos:"wifi,4g"}));
run("N2 comboio", V({nivel_servico:"nivel_2", nome_solucao:"SAAF", comboio:"sim", comunicacao_tipos:"wifi,4g"}));
run("N1", V({nivel_servico:"nivel_1", nome_solucao:"SAAF"}));
