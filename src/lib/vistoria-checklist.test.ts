import { describe, expect, it } from "vitest";
import { isComplete } from "@/components/agent/FormFields";
import { MIN_FOTOS_CARROSSEL, ehTipoDeFoto } from "./midia-arquivos";
import { estadoInicial, respondida } from "./vistoria-checklist";

const dto = (tipo: string, arquivos: string[]) =>
  ({
    etapas: [{ perguntas: [{ id: "p1", tipo, resposta: { texto: null, arquivos, transcricao: null } }] }],
  }) as never;

describe("estadoInicial: respostas já gravadas viram o estado dos campos", () => {
  it("foto com vídeo: a primeira imagem é a foto e o vídeo vai para o campo de vídeo", () => {
    const e = estadoInicial(dto("foto", ["casos/c/foto-1.jpg", "casos/c/video-1.mp4"]));
    expect(e.p1).toMatchObject({ filePath: "casos/c/foto-1.jpg", videoPath: "casos/c/video-1.mp4", iaConfirmada: true });
  });
  it("vídeo gravado antes da foto na lista não vira foto (registro antigo fora de ordem)", () => {
    const e = estadoInicial(dto("foto", ["casos/c/video-1.mov", "casos/c/foto-1.jpg", "casos/c/foto-2.jpg"]));
    expect(e.p1.filePath).toBe("casos/c/foto-1.jpg");
    expect(e.p1.videoPath).toBe("casos/c/video-1.mov");
  });
  it("foto sem vídeo continua como antes", () => {
    const e = estadoInicial(dto("foto", ["casos/c/foto-1.jpg"]));
    expect(e.p1.filePath).toBe("casos/c/foto-1.jpg");
    expect(e.p1.videoPath).toBeUndefined();
  });
  it("pergunta de vídeo e de áudio não mudam (mesmo com extensão webm)", () => {
    expect(estadoInicial(dto("video", ["casos/c/v.mp4"])).p1).toMatchObject({ filePath: "casos/c/v.mp4" });
    const a = estadoInicial(dto("audio", ["casos/c/a.webm"])).p1;
    expect(a.audioPath).toBe("casos/c/a.webm");
    expect(a.filePath).toBeUndefined();
  });
});

describe("carrossel de fotos", () => {
  const pergunta = (obrigatoria = true) => ({ id: "p1", secao_id: "s", texto: "Fotos", tipo: "carrossel" as const, obrigatoria, ordem: 1, instrucao_agente: null, contexto_ia: null });
  const foto = (n: number) => ({ path: `casos/c/f${n}.jpg`, name: `f${n}` });

  it("estado inicial: todas as imagens salvas, na ordem (vídeo fica de fora)", () => {
    const e = estadoInicial(dto("carrossel", ["casos/c/a.jpg", "casos/c/v.mp4", "casos/c/b.jpg"]));
    expect(e.p1.fotos?.map((f) => f.path)).toEqual(["casos/c/a.jpg", "casos/c/b.jpg"]);
    expect(e.p1.filePath).toBeUndefined();
  });

  it("obrigatória só vale com 2 ou mais fotos, no app e no preview", () => {
    for (const modo of ["live", "preview"] as const) {
      expect(isComplete(pergunta(), {}, modo)).toBe(false);
      expect(isComplete(pergunta(), { fotos: [foto(1)] }, modo)).toBe(false);
      expect(isComplete(pergunta(), { fotos: [foto(1), foto(2)] }, modo)).toBe(true);
    }
    expect(isComplete(pergunta(false), {}, "live")).toBe(true);
  });

  it("conta como respondida (progresso) a partir da primeira foto", () => {
    expect(respondida({ tipo: "carrossel" } as never, { fotos: [foto(1)] })).toBe(true);
    expect(respondida({ tipo: "carrossel" } as never, { fotos: [] })).toBe(false);
  });

  it("MIN_FOTOS_CARROSSEL é 2 e ehTipoDeFoto cobre foto e carrossel", () => {
    expect(MIN_FOTOS_CARROSSEL).toBe(2);
    expect(ehTipoDeFoto("carrossel") && ehTipoDeFoto("foto") && !ehTipoDeFoto("video")).toBe(true);
  });
});
