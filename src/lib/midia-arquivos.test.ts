import { describe, expect, it } from "vitest";
import { combinarArquivosFoto, ehVideoPath, ordenarMidias, resumoMidias, separarMidias } from "./midia-arquivos";

const foto = (n: number) => `casos/c1/foto-${n}.jpg`;
const video = (n: number, ext = "mp4") => `casos/c1/video-${n}.${ext}`;

describe("reconhecer vídeo pelo caminho", () => {
  it("extensões de vídeo (qualquer caixa); foto, vazio e nulo não são", () => {
    for (const e of ["mp4", "MOV", "m4v", "webm", "3gp", "3gpp"]) expect(ehVideoPath(video(1, e))).toBe(true);
    expect(ehVideoPath(foto(1))).toBe(false);
    expect(ehVideoPath("casos/c1/audio.webm.txt")).toBe(false);
    expect(ehVideoPath("")).toBe(false);
    expect(ehVideoPath(null)).toBe(false);
  });
  it("separa e ordena: imagens primeiro, sem repetir e ignorando vazios", () => {
    const lista = [video(1), foto(1), null, foto(2), foto(1), undefined, ""];
    expect(separarMidias(lista)).toEqual({ imagens: [foto(1), foto(2)], videos: [video(1)] });
    expect(ordenarMidias(lista)).toEqual([foto(1), foto(2), video(1)]);
  });
});

describe("combinar os arquivos de uma pergunta de foto", () => {
  it("foto sem vídeo continua igual: imagens acumulam, sem repetir", () => {
    const r = combinarArquivosFoto([foto(1)], [foto(1), foto(2)]);
    expect(r).toEqual({ arquivos: [foto(1), foto(2)], arquivoPath: foto(1), temImagem: true });
  });
  it("adiciona o vídeo depois da foto; a primeira posição segue sendo a imagem", () => {
    const r = combinarArquivosFoto([foto(1)], [video(1), foto(1)]);
    expect(r.arquivos).toEqual([foto(1), video(1)]);
    expect(r.arquivoPath).toBe(foto(1));
  });
  it("vídeo novo substitui o anterior; sem vídeo novo mantém o que já estava salvo", () => {
    expect(combinarArquivosFoto([foto(1), video(1)], [foto(1), video(2)]).arquivos).toEqual([foto(1), video(2)]);
    expect(combinarArquivosFoto([foto(1), video(1)], [foto(1)]).arquivos).toEqual([foto(1), video(1)]);
    // vários vídeos chegando de uma vez (ex.: pelo chat): vale o último
    expect(combinarArquivosFoto([foto(1)], [video(1), video(2)]).arquivos).toEqual([foto(1), video(2)]);
  });
  it("remover vídeo apaga só o vídeo", () => {
    const r = combinarArquivosFoto([foto(1), foto(2), video(1)], [], { removerVideo: true });
    expect(r.arquivos).toEqual([foto(1), foto(2)]);
    // remover junto com um vídeo novo também descarta o novo (a remoção vence)
    expect(combinarArquivosFoto([foto(1)], [video(2)], { removerVideo: true }).arquivos).toEqual([foto(1)]);
  });
  it("vídeo sem nenhuma foto não conta como resposta (arquivoPath nulo, temImagem falso)", () => {
    const r = combinarArquivosFoto([], [video(1)]);
    expect(r).toEqual({ arquivos: [video(1)], arquivoPath: null, temImagem: false });
  });
  it("registros antigos com vídeo na frente são reordenados", () => {
    expect(combinarArquivosFoto([video(1), foto(1)], []).arquivos).toEqual([foto(1), video(1)]);
  });
});

describe("resumo para contagens", () => {
  it("fotos e vídeo no singular/plural", () => {
    expect(resumoMidias([foto(1)])).toBe("1 foto");
    expect(resumoMidias([foto(1), foto(2), video(1)])).toBe("2 fotos + 1 vídeo");
    expect(resumoMidias([video(1)])).toBe("1 vídeo");
    expect(resumoMidias([])).toBe("");
  });
});
