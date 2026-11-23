import { describe, expect, it } from "vitest";
import { estadoInicial } from "./vistoria-checklist";

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
