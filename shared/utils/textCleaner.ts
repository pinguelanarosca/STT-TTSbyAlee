/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Funções puras de higienização, normalização e particionamento de texto para TTS/STT.
 * Totalmente agnóstico de DOM ou navegador (regex puras).
 */

/**
 * Remove tags HTML, marcações markdown, URLs prolixas e caracteres não-pronunciáveis
 * para produzir uma leitura fluida e natural no TTS.
 */
export function cleanTextForTts(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = rawText;

  // 1. Remove tags HTML (<div ...>, </span>, etc.)
  text = text.replace(/<[^>]*>/g, ' ');

  // 2. Remove URLs completas (substitui por menção breve ou remove)
  text = text.replace(/https?:\/\/[^\s$.?#].[^\s]*/gi, '');

  // 3. Remove sintaxe Markdown (cabeçalhos #, asteriscos de negrito/itálico, crases de código)
  text = text.replace(/^#+\s+/gm, ''); // Headers Markdown
  text = text.replace(/[*_~`]{1,3}([^*_~`]+)[*_~`]{1,3}/g, '$1'); // Negrito / Itálico
  text = text.replace(/```[\s\S]*?```/g, ' [Bloco de código omitido] '); // Blocos de código
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // Links Markdown [Texto](url) -> Texto

  // 4. Normaliza quebras de linha e espaçamentos repetidos
  text = text.replace(/[\r\n]+/g, '. ');
  text = text.replace(/\s{2,}/g, ' ');

  // 5. Normaliza pontuações repetidas (ex: "?????" -> "?", "......" -> "...")
  text = text.replace(/([.!?]){2,}/g, '$1');

  return text.trim();
}

/**
 * Divide textos extensos em blocos menores respeitando fronteiras de sentenças,
 * evitando que frases sejam cortadas no meio durante a síntese de áudio.
 */
export function splitTextIntoChunks(text: string, maxChunkLength: number = 800): string[] {
  const clean = text.trim();
  if (clean.length <= maxChunkLength) {
    return clean.length > 0 ? [clean] : [];
  }

  const chunks: string[] = [];
  // Divide por finalizadores de frases (. ! ? ou quebras)
  const sentences = clean.split(/(?<=[.!?])\s+/);

  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + ' ' + sentence).trim().length <= maxChunkLength) {
      currentChunk = (currentChunk + ' ' + sentence).trim();
    } else {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
      // Se uma única sentença for maior que maxChunkLength, divide por vírgulas ou palavras
      if (sentence.length > maxChunkLength) {
        const words = sentence.split(/\s+/);
        let subChunk = '';
        for (const word of words) {
          if ((subChunk + ' ' + word).trim().length <= maxChunkLength) {
            subChunk = (subChunk + ' ' + word).trim();
          } else {
            if (subChunk.length > 0) chunks.push(subChunk);
            subChunk = word;
          }
        }
        currentChunk = subChunk;
      } else {
        currentChunk = sentence;
      }
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Formata e limpa o texto resultante de transcrição STT para inserção fluida
 * em campos de formulário e editores de texto.
 */
export function sanitizeDictatedText(rawDictation: string): string {
  if (!rawDictation || typeof rawDictation !== 'string') return '';

  let text = rawDictation.trim();

  // Garante inicial maiúscula se for início de frase
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  // Ajusta espaçamento ao redor de vírgulas, pontos e dois pontos
  text = text.replace(/\s+([.,;:!?])/g, '$1');
  text = text.replace(/([.,;:!?])(?=[a-zA-Z0-9À-ÿ])/g, '$1 ');

  return text;
}
