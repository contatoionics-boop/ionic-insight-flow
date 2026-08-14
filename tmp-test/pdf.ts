import { buildLaudoPdf } from "../src/lib/pdf-laudo.server";
import { montarBlocos } from "../src/lib/laudo/template";
const V=(o:any)=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,{chave:k,valor:v,origem:"formulario",confianca:1}]));
const blocos = montarBlocos({ variaveis: V({nivel_servico:"nivel_2",nome_solucao:"SAAF",comboio:"sim"}) as any, materiais: [], cabecalho:{cliente:"c",unidade:"u",data:"d",agente:"a",especialista:"e",modalidade:null} });
const bytes = await (buildLaudoPdf as any)({ blocos, meta:{ titulo:"t", codigo:null, revisao:null, empresaNome:"IONICS", cliente:"c", unidade:"u", data:"d", agente:"a" } });
await Bun.write("/tmp/t/out.pdf", bytes);
console.log("bytes", bytes.length);
