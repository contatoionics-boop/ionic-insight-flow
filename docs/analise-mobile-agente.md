# Análise e ajustes da versão mobile — Agente técnico em campo

Data: 02/10/2026 · Escopo: fluxo do agente em celular e tablet (preenchimento do
mapeamento, fotos, vídeos, texto, áudio/fala transcrita, layout e conexão).

## 1. Contexto

O agente técnico usa o sistema quase sempre no celular ou no tablet, em campo,
muitas vezes com sinal ruim (nos próprios mapeamentos o sinal GSM aparece como
"Ruim"). Cada mapeamento tem ~18 fotos, pode ter vídeo, áudio e dezenas de
campos. A análise foi feita por revisão de código dos fluxos do agente
(`checklist`, `FormFields`, `use-gravacao-voz`, layout mobile, funções de
servidor) e validada com testes de navegador das partes que não dependem de
câmera/microfone reais.

> **Limitação:** não houve teste em aparelho físico (iPhone/Android/tablet).
> Os itens marcados com (T) precisam de teste no aparelho — veja a seção 5.

## 2. Problemas encontrados e situação

| # | Problema | Gravidade | Situação |
|---|----------|-----------|----------|
| 1 | Foto só pela câmera (`capture="environment"`): não dá para anexar print/galeria (ex.: "Print – WiFi Network Analyzer"). Causa provável do "só carrega pelo web". | Crítico | **Corrigido** — botões "Tirar foto" e "Galeria" |
| 2 | Sem fila offline: foto/vídeo/áudio que falhava no envio era perdido | Crítico | **Corrigido** — fila no aparelho (IndexedDB) com reenvio automático |
| 3 | Foto original (3–12 MB) enviada sem compressão; preview em resolução cheia; uma chamada de URL por foto | Crítico | **Corrigido** — redimensiona p/ 1800 px e converte para JPEG; URLs em lote |
| 4 | Áudio no iPhone/iPad gravado como `webm` fixo (Safari grava mp4) → transcrição podia falhar | Crítico | **Corrigido** — formato detectado + conversão para WAV 16 kHz |
| 5 | Vídeo: sem progresso, limite de 100 MB, só câmera | Crítico | **Parcial** — progresso, galeria, limite 150 MB, reenvio automático; **sem retomada** de upload interrompido |
| 6 | Barra "Anterior/Próximo" sobreposta à navegação inferior | Importante | **Corrigido** — navegação inferior some durante o preenchimento (T) |
| 7 | Campos em 14 px (zoom automático no iOS) e alvos de toque < 44 px | Importante | **Corrigido** |
| 8 | Microfone não era liberado ao sair da tela; sem limite de duração; WAV 48 kHz pesado | Importante | **Corrigido** — para ao sair, máx. 5 min, 16 kHz (~3x menor) |
| 9 | Erros em inglês ("Failed to fetch"); sem indicador de conexão | Importante | **Corrigido** — mensagens em pt-BR, faixa "Sem conexão" e contador de pendências |
| 10 | Teclado virtual cobrindo campos; `100vh` no Safari | Importante | **Parcial** — `dvh` e `interactive-widget`; no iOS o teclado pode ainda cobrir a barra fixa (T) |
| 11 | `createObjectURL` nunca liberado; arquivo antigo ficava órfão ao refazer foto | Menor | **Corrigido** |
| 12 | `urlsArquivosVistoria` usava `||` no filtro de caminho (agente podia pedir URL assinada de arquivo de outro caso) | Segurança | **Corrigido** (`&&`) |
| 13 | `transcreverAudio`/`validarFoto` aceitavam token `app`/`preview` sem autenticação (consumo da chave OpenAI por qualquer pessoa) | Segurança | **Corrigido** — exige sessão; limite de tamanho |
| 14 | Tablet: layout de 3 colunas só a partir de 1024 px | Menor | **Não alterado** — aceitável; validar (T) |

## 3. O que mudou (arquivos principais)

- `src/lib/midia-upload.ts` (novo): compressão de imagem, envio com progresso
  (XHR), **fila offline** em IndexedDB com reenvio ao voltar a conexão (evento
  `online` + a cada 20 s), tradução de erros de rede, lote de URLs assinadas.
- `src/components/agent/FormFields.tsx`: campos de foto, vídeo e áudio
  reescritos (câmera + galeria, progresso, aviso de pendência, alvos de 44 px).
- `src/components/agent/use-gravacao-voz.ts`: gravador com formato correto por
  navegador, limite de 5 min, liberação do microfone e conversão para WAV 16 kHz.
- `src/components/agent/checklist/ChecklistVistoria.tsx`: faixa de conexão,
  arquivos pendentes não são enviados ao servidor antes do upload, "Finalizar"
  aguarda a fila esvaziar, "Salvo no aparelho".
- `src/components/AgentMobileLayout.tsx`: navegação inferior oculta durante o
  preenchimento, botão voltar, `min-h-dvh`.
- `src/components/ui-bits.tsx`, `MicButton.tsx`: campos 16 px / 44 px no celular.
- `src/lib/agent-ai.functions.ts`, `src/lib/vistoria-agent.functions.ts`:
  correções de segurança.

## 4. Como funciona o modo offline

1. O agente tira a foto; ela é reduzida e o envio começa.
2. Sem sinal: o arquivo fica guardado no aparelho, a resposta continua
   preenchida e aparece o aviso "aguardando envio".
3. Quando o sinal volta (ou a cada 20 s) o arquivo sobe sozinho e só então a
   resposta é enviada ao servidor.
4. O mapeamento só pode ser finalizado com a fila vazia.

Texto e escolhas já eram salvos em rascunho local e continuam assim.

## 5. Roteiro de teste em aparelho (T)

Executar em: iPhone (Safari), Android (Chrome) e tablet; uma vez com Wi-Fi e uma
com sinal fraco/modo avião.

1. Foto: "Tirar foto" e "Galeria" (inclusive um print); conferir tamanho final
   (~200–500 KB) e que a imagem aparece na revisão.
2. Foto em modo avião: aviso de pendência → ativar rede → arquivo sobe sozinho.
3. Vídeo curto: barra de progresso; vídeo grande (>150 MB): mensagem clara.
4. Áudio: gravar 30 s no iPhone e no Android; transcrição aparece; "Prefiro
   digitar" funciona; sair da tela gravando solta o microfone.
5. Digitar em campo de texto: sem zoom automático no iOS; teclado não esconde o
   botão "Próximo".
6. Finalizar com pendência: botão bloqueado até a fila esvaziar.
7. Tablet em retrato e paisagem: leitura e botões confortáveis.

## 6. Pendências e recomendações

- **Abrir o app sem internet:** o aplicativo ainda precisa carregar uma vez com
  conexão (não há service worker). Depois de aberto, preenchimento e fila
  funcionam offline. Cache offline completo (service worker) é uma etapa
  futura que exige cuidado para não servir versões antigas após deploy.
- **Retomada de upload:** vídeos grandes reiniciam do começo se a conexão cair.
  Upload resumível (TUS do Supabase) seria o próximo passo.
- **Limite do Storage:** confirmar no painel do Supabase o limite de tamanho de
  arquivo do bucket `agente-uploads` (o app permite vídeo de até 150 MB).
- **Fotos antigas:** continuam no tamanho original; só as novas são reduzidas.
- Considerar miniaturas geradas no servidor para a tela de revisão.
