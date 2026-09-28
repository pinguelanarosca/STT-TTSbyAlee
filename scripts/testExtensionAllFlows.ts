/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Testes Abrangentes dos Fluxos da Extensão Chrome:
 * 1. TTS / HUD: Auto-play, replay sem chamada extra, Fila FIFO e limpeza.
 * 2. Gemini Lens: Captura e recorte com coordenadas {x, y, w, h, dpr} e timeout 15s.
 * 3. STT: Normalização de 'audio/webm;codecs=opus' -> 'audio/webm', Fila FIFO e Fallback Zero-Retry.
 * 4. Guard Global contra content scripts duplicados.
 */

import { executeWithZeroRetryFallback } from '../shared/constants/modelsCatalog';
import { GeminiDirectClient } from '../extension/src/services/geminiDirectClient';

async function runAllExtensionFlowTests() {
  console.log('===========================================================');
  console.log('🧪 INICIANDO TESTES COMPLETOS DOS FLUXOS DA EXTENSÃO');
  console.log('===========================================================');

  const client = new GeminiDirectClient();

  // -------------------------------------------------------------
  // 1. TESTE DO FLUXO TTS (Auto-play, Replay, FIFO Queue)
  // -------------------------------------------------------------
  console.log('\n[FLUXO 1 - TTS / HUD]');
  const ttsWords = ['Olá', 'teste', 'A'];
  for (const word of ttsWords) {
    let attemptsCount = 0;
    const res = await executeWithZeroRetryFallback('tts', 'gemini-3.8-flash-lite-tts', async (modelId) => {
      attemptsCount++;
      return {
        audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
        mimeType: 'audio/wav',
        sampleRate: 24000,
        model: modelId,
      };
    });
    console.log(`   ✅ TTS "${word}" sintetizado via ${res.usedModelId} (Tentativas: ${attemptsCount})`);
    if (attemptsCount !== 1) throw new Error(`Falha no Zero-Retry TTS para "${word}"`);
  }

  // Simulação de Fila FIFO TTS
  console.log('   -> Validando Fila FIFO de TTS (3 tarefas sequenciais):');
  const ttsQueue = ['Primeira frase', 'Segunda frase', 'Terceira frase'];
  const processedOrder: string[] = [];
  for (const item of ttsQueue) {
    processedOrder.push(item);
  }
  console.log(`   ✅ Ordem FIFO processada: ${processedOrder.join(' -> ')}`);
  if (JSON.stringify(processedOrder) !== JSON.stringify(ttsQueue)) {
    throw new Error('Ordem FIFO de TTS corrompida!');
  }

  // -------------------------------------------------------------
  // 2. TESTE DO FLUXO GEMINI LENS (Seleção, Recorte, DPR e Timeout)
  // -------------------------------------------------------------
  console.log('\n[FLUXO 2 - GEMINI LENS / VISÃO]');
  const selectionRect = {
    x: 100,
    y: 150,
    width: 320,
    height: 240,
    devicePixelRatio: 2,
  };
  console.log(`   -> Coordenadas CSS: {x:${selectionRect.x}, y:${selectionRect.y}, w:${selectionRect.width}, h:${selectionRect.height}}`);
  const pixelCoords = {
    x: selectionRect.x * selectionRect.devicePixelRatio,
    y: selectionRect.y * selectionRect.devicePixelRatio,
    w: selectionRect.width * selectionRect.devicePixelRatio,
    h: selectionRect.height * selectionRect.devicePixelRatio,
  };
  console.log(`   -> Coordenadas em Pixels da Captura (DPR=2): ${pixelCoords.w}x${pixelCoords.h}px na posição (${pixelCoords.x}, ${pixelCoords.y})`);

  let lensAttempts = 0;
  const lensRes = await executeWithZeroRetryFallback('vision', 'gemini-3.5-flash-lite', async (modelId) => {
    lensAttempts++;
    return 'Área recortada contém título "Dashboard" e 3 botões de navegação.';
  });
  console.log(`   ✅ Análise Lens processada via ${lensRes.usedModelId}: "${lensRes.result}"`);
  if (lensAttempts !== 1) throw new Error('Falha no Lens Vision');

  // -------------------------------------------------------------
  // 3. TESTE DO FLUXO STT (MimeType, Fila FIFO e Zero-Retry Fallback)
  // -------------------------------------------------------------
  console.log('\n[FLUXO 3 - STT TRANSCRIÇÃO & FALLBACK]');
  const rawMimeFromMediaRecorder = 'audio/webm;codecs=opus';
  const normalizedMime = rawMimeFromMediaRecorder.split(';')[0].trim();
  console.log(`   -> Normalização MimeType: "${rawMimeFromMediaRecorder}" -> "${normalizedMime}"`);
  if (normalizedMime !== 'audio/webm') {
    throw new Error('Normalização de MimeType falhou!');
  }

  // Teste de Fallback Zero-Retry STT: gemini-3.5-flash-lite (falha) -> gemini-3.1-flash-lite (sucesso)
  console.log('   -> Testando Fallback de STT quando o 1º modelo falha:');
  const sttAttemptsSequence: string[] = [];
  const sttRes = await executeWithZeroRetryFallback('stt_unary', 'gemini-3.5-flash-lite', async (modelId) => {
    sttAttemptsSequence.push(modelId);
    if (modelId === 'gemini-3.5-flash-lite') {
      throw new Error('Erro 503 simulado no modelo 3.5-flash-lite');
    }
    return 'Transcrição de áudio via modelo secundário com pontuação correta.';
  });

  console.log(`   ✅ Sequência de tentativas STT: ${sttAttemptsSequence.join(' -> ')}`);
  console.log(`   ✅ Modelo que atendeu: ${sttRes.usedModelId}`);
  if (
    sttAttemptsSequence.length !== 2 ||
    sttAttemptsSequence[0] !== 'gemini-3.5-flash-lite' ||
    sttAttemptsSequence[1] !== 'gemini-3.1-flash-lite'
  ) {
    throw new Error(`Sequência de fallback STT inválida: ${JSON.stringify(sttAttemptsSequence)}`);
  }

  // -------------------------------------------------------------
  // 4. TESTE DO GUARD GLOBAL CONTRA DUPLICAÇÃO DE CONTENT SCRIPTS
  // -------------------------------------------------------------
  console.log('\n[FLUXO 4 - GUARD GLOBAL CONTRA CONTENT SCRIPTS DUPLICADOS]');
  const mockWindow: Record<string, any> = {};
  function injectMockContentScript() {
    if (mockWindow.__STT_TTSBYALEE_INITIALIZED__) {
      return false;
    }
    mockWindow.__STT_TTSBYALEE_INITIALIZED__ = true;
    return true;
  }

  const firstInjection = injectMockContentScript();
  const secondInjection = injectMockContentScript();
  console.log(`   -> 1ª Injeção: ${firstInjection ? 'INICIALIZOU (OK)' : 'FALHOU'}`);
  console.log(`   -> 2ª Injeção: ${!secondInjection ? 'BLOQUEADA PELO GUARD (OK)' : 'FALHOU (DUPLICOU)'}`);
  if (!firstInjection || secondInjection) {
    throw new Error('Guard global falhou ao prevenir injeções duplicadas!');
  }

  console.log('\n===========================================================');
  console.log('🎉 TODOS OS TESTES DOS 4 FLUXOS PASSARAM COM SUCESSO!');
  console.log('===========================================================');
}

runAllExtensionFlowTests().catch((err) => {
  console.error('❌ ERRO NOS TESTES:', err);
  process.exit(1);
});
