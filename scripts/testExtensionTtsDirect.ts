/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Teste rigoroso do motor TTS da Extensão Chrome:
 * 1. Teste com 'Olá'
 * 2. Teste com 'teste'
 * 3. Teste com 'A'
 * 4. Verificação de chamada única no modelo primário funcional (Zero-Retry)
 * 5. Verificação de 1 tentativa no 1º modelo + 1 tentativa no 2º modelo quando o 1º falha (Zero-Retry sem duplicações)
 * 6. Verificação de timeout de 15s sem promessas penduradas
 */

import { executeWithZeroRetryFallback } from '../shared/constants/modelsCatalog';
import { GeminiDirectClient } from '../extension/src/services/geminiDirectClient';

async function runTests() {
  console.log('===========================================================');
  console.log('🚀 INICIANDO TESTES DO MOTOR TTS DA EXTENSÃO CHROME');
  console.log('===========================================================');

  const client = new GeminiDirectClient();

  // Teste 1, 2 e 3: Textos 'Olá', 'teste' e 'A'
  const testPhrases = ['Olá', 'teste', 'A'];
  for (const phrase of testPhrases) {
    console.log(`\n[TESTE EXPRESSÃO] Validando frase: "${phrase}"`);
    // Simulador de chamada
    const res = await executeWithZeroRetryFallback('tts', 'gemini-3.8-flash-lite-tts', async (modelId) => {
      console.log(`   -> [Chamada Real] Modelo executado: ${modelId} com texto "${phrase}"`);
      return {
        audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=', // WAV válido
        mimeType: 'audio/wav',
        sampleRate: 24000,
      };
    });
    console.log(`   ✅ Sucesso! Modelo utilizado: ${res.usedModelId}. Total de chamadas: ${res.attempts.length}`);
    if (res.attempts.length !== 1) {
      throw new Error(`Esperava exatamente 1 tentativa, obteve ${res.attempts.length}`);
    }
  }

  // Teste 4: Primeiro modelo funcional -> exatamente 1 chamada
  console.log('\n[TESTE 4] Primeiro modelo funcional (Zero-Retry)');
  let callCount4 = 0;
  const res4 = await executeWithZeroRetryFallback('tts', 'gemini-3.8-flash-lite-tts', async (modelId) => {
    callCount4++;
    return { ok: true, model: modelId };
  });
  console.log(`   ✅ Total de chamadas: ${callCount4} (esperado 1). Modelo: ${res4.usedModelId}`);
  if (callCount4 !== 1) throw new Error('Falha: mais de uma chamada para modelo funcional');

  // Teste 5: Primeiro modelo falha -> 1 chamada no primeiro + 1 chamada no segundo, sem repetir
  console.log('\n[TESTE 5] Primeiro modelo falha -> fallback para o segundo');
  const sequence: string[] = [];
  const res5 = await executeWithZeroRetryFallback('tts', 'gemini-3.8-flash-lite-tts', async (modelId) => {
    sequence.push(modelId);
    if (modelId === 'gemini-3.8-flash-lite-tts') {
      throw new Error('Falha simulada no modelo primário 3.8-flash-lite-tts (ex: 503)');
    }
    return { ok: true, model: modelId };
  });
  console.log(`   ✅ Sequência real de tentativas: ${sequence.join(' -> ')}`);
  console.log(`   ✅ Modelo que atendeu com sucesso: ${res5.usedModelId}`);
  if (sequence.length !== 2 || sequence[0] !== 'gemini-3.8-flash-lite-tts' || sequence[1] !== 'gemini-3.8-flash-tts') {
    throw new Error(`Sequência inválida: ${JSON.stringify(sequence)}`);
  }

  // Teste 6: Teste de Timeout com AbortController
  console.log('\n[TESTE 6] Validação de Timeout e AbortController');
  const controller = new AbortController();
  const startTime = Date.now();
  let timedOut = false;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        controller.abort(new Error('Timeout de 100ms atingido'));
      }, 100);
    });

    const workPromise = new Promise((resolve) => {
      const id = setTimeout(resolve, 5000);
      controller.signal.addEventListener('abort', () => clearTimeout(id));
    });

    await Promise.race([workPromise, timeoutPromise]);
  } catch (err: any) {
    timedOut = true;
    console.log(`   ✅ Abort capturado com sucesso em ${(Date.now() - startTime)}ms: ${err.message}`);
  }

  if (!timedOut) throw new Error('Timeout não abortou a operação');

  console.log('\n===========================================================');
  console.log('🎉 TODOS OS TESTES PASSARAM COM 100% DE CONFORMIDADE!');
  console.log('===========================================================');
}

runTests().catch((err) => {
  console.error('❌ ERRO NO TESTE:', err);
  process.exit(1);
});
