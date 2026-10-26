// Dispara o download de um arquivo devolvido em base64 pelas funções de servidor (client-safe).
export function baixarBase64(out: { contentBase64: string; mimeType: string; filename: string }) {
  const binary = atob(out.contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: out.mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = out.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
