// Arquivos de uma resposta de foto: imagens + (opcionalmente) UM vídeo da mesma pergunta.
// Tudo fica em `respostas_agente.arquivos_paths`; o vídeo é reconhecido pela extensão do caminho
// (os uploads sempre gravam `casos/<caso>/<uuid>.<ext>`). Funções puras, usadas no app e no servidor.

export const EXT_VIDEO = /\.(mp4|mov|m4v|webm|3gp|3gpp)$/i;

export const ehVideoPath = (path: string | null | undefined): boolean => !!path && EXT_VIDEO.test(path);

const unicos = (lista: (string | null | undefined)[]) => [...new Set(lista.filter((p): p is string => !!p))];

/** Separa imagens e vídeos, na ordem em que aparecem e sem repetir caminhos. */
export function separarMidias(paths: (string | null | undefined)[]): { imagens: string[]; videos: string[] } {
  const todos = unicos(paths);
  return { imagens: todos.filter((p) => !ehVideoPath(p)), videos: todos.filter((p) => ehVideoPath(p)) };
}

/** Imagens primeiro, depois os vídeos (a primeira posição é sempre a foto que representa a pergunta). */
export function ordenarMidias(paths: (string | null | undefined)[]): string[] {
  const { imagens, videos } = separarMidias(paths);
  return [...imagens, ...videos];
}

export type ArquivosDaFoto = {
  /** imagens e depois o vídeo (no máximo um) */
  arquivos: string[];
  /** a primeira imagem; sem imagem a pergunta de foto não está respondida */
  arquivoPath: string | null;
  temImagem: boolean;
};

/**
 * Junta o que já estava salvo com o que chegou. As imagens acumulam (como sempre foi). O vídeo é um só:
 * o que chega substitui o anterior; sem vídeo novo o anterior é mantido; `removerVideo` apaga.
 */
export function combinarArquivosFoto(
  existentes: (string | null | undefined)[],
  entrantes: (string | null | undefined)[],
  opcoes: { removerVideo?: boolean } = {},
): ArquivosDaFoto {
  const antes = separarMidias(existentes);
  const novos = separarMidias(entrantes);
  const imagens = unicos([...antes.imagens, ...novos.imagens]);
  const video = opcoes.removerVideo ? undefined : (novos.videos[novos.videos.length - 1] ?? antes.videos[0]);
  return { arquivos: video ? [...imagens, video] : imagens, arquivoPath: imagens[0] ?? null, temImagem: imagens.length > 0 };
}

/** "3 fotos + 1 vídeo", "1 foto", "1 vídeo" (para resumos e contagens). */
export function resumoMidias(paths: (string | null | undefined)[]): string {
  const { imagens, videos } = separarMidias(paths);
  const partes: string[] = [];
  if (imagens.length) partes.push(`${imagens.length} ${imagens.length === 1 ? "foto" : "fotos"}`);
  if (videos.length) partes.push(`${videos.length} ${videos.length === 1 ? "vídeo" : "vídeos"}`);
  return partes.join(" + ");
}
