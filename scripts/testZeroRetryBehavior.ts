/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Teste Comportamental Real do Mecanismo Zero-Retry
 */

import {
  executeWithZeroRetryFallback,
  AUTH_TEST_INITIAL_MODEL,
  TTS_MODELS_WHITELIST,
  FLASH_LITE_MODELS_WHITELIST,
  STT_UNARY_MODELS_WHITELIST,
  STT_LIVE_MODELS_WHITELIST,
  getFallbackChainForTask,
} from '../shared/constants/modelsCatalog';

function printHeader(title: string) {
  console.log('\n======================================================================');
  console.log(`🔷 ${title}`);
  console.log('======================================================================');
}

async function runTests() {
  // -------------------------------------------------------------------------
  // CENÁRIO 1: TTS - Falha no 1º modelo e avanço imediato para o 2º (Zero-Retry)
  // -------------------------------------------------------------------------
  printHeader('CENÁRIO 1: TTS - Falha no 1º Modelo e Sucesso no 2º Modelo');
  {
    const callLog: { model: string; timestamp: number }[] = [];
    const modelCallCount: Record<string, number> = {};

    const res = await executeWithZeroRetryFallback('tts', 'gemini-3.8-flash-lite-tts', async (modelId) => {
      callLog.push({ model: modelId, timestamp: Date.now() });
      modelCallCount[modelId] = (modelCallCount[modelId] || 0) + 1;

      if (modelId === 'gemini-3.8-flash-lite-tts') {
        console.log(`[Chamada 1] Tentando modelo: "${modelId}" -> ❌ ERRO 429 (Quota exceeded)`);
        throw new Error('HTTP 429: Rate limit / Quota exceeded on gemini-3.8-flash-lite-tts');
      }

      if (modelId === 'gemini-3.8-flash-tts') {
        console.log(`[Chamada 2] Tentando modelo: "${modelId}" -> ✅ SUCESSO (Áudio gerado)`);
        return { audio: 'base64_audio_data' };
      }

      throw new Error(`Modelo inesperado chamado: ${modelId}`);
    });

    console.log('\n📊 Log de Execução:');
    console.log('  Sequência Real das Chamadas:', callLog.map((c) => c.model).join(' ➔ '));
    console.log('  Contagem por Modelo:', JSON.stringify(modelCallCount));
    console.log('  Modelo que Entregou a Resposta:', res.usedModelId);
    console.log('  Histórico de Tentativas no Retorno:', res.attempts);
    
    // Asserções
    if (callLog.length !== 2) throw new Error(`Esperava 2 chamadas, obteve ${callLog.length}`);
    if (callLog[0].model !== 'gemini-3.8-flash-lite-tts' || callLog[1].model !== 'gemini-3.8-flash-tts') {
      throw new Error('Sequência incorreta no Cenário 1');
    }
    if (modelCallCount['gemini-3.8-flash-lite-tts'] !== 1) throw new Error('Retry indevido no modelo 1!');
  }

  // -------------------------------------------------------------------------
  // CENÁRIO 1B: TTS - Falha no 1º e 2º modelos -> Sucesso no 3º modelo
  // -------------------------------------------------------------------------
  printHeader('CENÁRIO 1B: TTS - Falha no 1º e 2º Modelos -> Sucesso no 3º Modelo (3.1 Flash TTS)');
  {
    const callLog: string[] = [];
    const modelCallCount: Record<string, number> = {};

    const res = await executeWithZeroRetryFallback('tts', 'gemini-3.8-flash-lite-tts', async (modelId) => {
      callLog.push(modelId);
      modelCallCount[modelId] = (modelCallCount[modelId] || 0) + 1;

      if (modelId === 'gemini-3.8-flash-lite-tts') {
        console.log(`[Tentativa 1] "${modelId}" -> ❌ ERRO 503 (Service Unavailable)`);
        throw new Error('HTTP 503: Service Unavailable');
      }
      if (modelId === 'gemini-3.8-flash-tts') {
        console.log(`[Tentativa 2] "${modelId}" -> ❌ ERRO 404 (Model Not Found)`);
        throw new Error('HTTP 404: Not Found');
      }
      if (modelId === 'gemini-3.1-flash-tts-preview') {
        console.log(`[Tentativa 3] "${modelId}" -> ✅ SUCESSO (Áudio gerado)`);
        return { audio: 'base64_audio_preview_data' };
      }

      throw new Error(`Modelo não esperado: ${modelId}`);
    });

    console.log('\n📊 Log de Execução:');
    console.log('  Sequência Real:', callLog.join(' ➔ '));
    console.log('  Contagem por Modelo:', JSON.stringify(modelCallCount));
    console.log('  Zero-Retry Confirmado:', Object.values(modelCallCount).every((count) => count === 1));

    if (callLog.join('->') !== 'gemini-3.8-flash-lite-tts->gemini-3.8-flash-tts->gemini-3.1-flash-tts-preview') {
      throw new Error('Sequência incorreta no Cenário 1B');
    }
  }

  // -------------------------------------------------------------------------
  // CENÁRIO 2: STT Unary - Verificação de Isolamento estrito (Sem Live API)
  // -------------------------------------------------------------------------
  printHeader('CENÁRIO 2: STT Unary - Isolamento Estrito do Protocolo Live');
  {
    const sttChain = getFallbackChainForTask('stt_unary');
    console.log('  Cadeia STT Unary Configurada:', sttChain);
    console.log('  Cadeia STT Live Configurada:', STT_LIVE_MODELS_WHITELIST);

    const callLog: string[] = [];
    const res = await executeWithZeroRetryFallback('stt_unary', 'gemini-3.5-transcribe', async (modelId) => {
      callLog.push(modelId);
      console.log(`[STT Unary] Chamando modelo de transcrição: "${modelId}" -> ✅ SUCESSO`);
      return 'Transcrição fiel do áudio';
    });

    console.log('\n📊 Verificação:');
    console.log('  Modelo Executado:', res.usedModelId);
    console.log('  Contém modelo Live?:', callLog.includes('gemini-3.5-transcribe-live') ? 'SIM (ERRO)' : 'NÃO (CORRETO)');

    if (sttChain.includes('gemini-3.5-transcribe-live' as any)) {
      throw new Error('Modelo Live não pode estar na cadeia STT Unary!');
    }
    if (res.usedModelId !== 'gemini-3.5-transcribe') {
      throw new Error('Modelo incorreto no STT Unary');
    }
  }

  // -------------------------------------------------------------------------
  // CENÁRIO 3: API Key - 1º modelo é gemini-3.1-flash-lite + Fallback sem repetição
  // -------------------------------------------------------------------------
  printHeader('CENÁRIO 3: Teste de API Key - 1º Modelo gemini-3.1-flash-lite + Fallback Flash-Lite');
  {
    console.log('  Modelo Inicial de Autenticação:', AUTH_TEST_INITIAL_MODEL);
    if (AUTH_TEST_INITIAL_MODEL !== 'gemini-3.1-flash-lite') {
      throw new Error(`Modelo inicial de auth incorreto: ${AUTH_TEST_INITIAL_MODEL}`);
    }

    const callLog: string[] = [];
    const modelCallCount: Record<string, number> = {};

    const res = await executeWithZeroRetryFallback('auth_test', AUTH_TEST_INITIAL_MODEL, async (modelId) => {
      callLog.push(modelId);
      modelCallCount[modelId] = (modelCallCount[modelId] || 0) + 1;

      if (modelId === 'gemini-3.1-flash-lite') {
        console.log(`[Auth Test] Modelo 1: "${modelId}" -> ❌ ERRO 500`);
        throw new Error('HTTP 500: Internal error');
      }
      if (modelId === 'gemini-3.5-flash-lite') {
        console.log(`[Auth Test] Modelo 2: "${modelId}" -> ✅ SUCESSO (Pong)`);
        return true;
      }
      throw new Error(`Inesperado: ${modelId}`);
    });

    console.log('\n📊 Log de Execução:');
    console.log('  Sequência Real:', callLog.join(' ➔ '));
    console.log('  Contagem por Modelo:', JSON.stringify(modelCallCount));
    console.log('  Zero-Retry Confirmado:', Object.values(modelCallCount).every((count) => count === 1));

    if (callLog[0] !== 'gemini-3.1-flash-lite' || callLog[1] !== 'gemini-3.5-flash-lite') {
      throw new Error('Sequência de Auth Test incorreta');
    }
  }

  // -------------------------------------------------------------------------
  // CENÁRIO 4: Regra de Ouro - Cada modelo chamado exatamente UMA vez (A -> B -> C)
  // -------------------------------------------------------------------------
  printHeader('CENÁRIO 4: Regra de Ouro - Garantia de Unicidade Estrita por Operação');
  {
    const callLog: string[] = [];
    const modelCallCount: Record<string, number> = {};

    await executeWithZeroRetryFallback('vision', 'gemini-3.1-flash-lite', async (modelId) => {
      callLog.push(modelId);
      modelCallCount[modelId] = (modelCallCount[modelId] || 0) + 1;

      if (modelId === 'gemini-3.1-flash-lite') {
        console.log(`[Vision] "${modelId}" -> ❌ Falha simulada`);
        throw new Error('Falha 1');
      }
      if (modelId === 'gemini-3.5-flash-lite') {
        console.log(`[Vision] "${modelId}" -> ❌ Falha simulada`);
        throw new Error('Falha 2');
      }
      if (modelId === 'gemini-2.5-flash-lite') {
        console.log(`[Vision] "${modelId}" -> ✅ Sucesso`);
        return 'Visão ok';
      }
      throw new Error(`Inesperado: ${modelId}`);
    });

    console.log('\n📊 Sequência Registrada:');
    console.log('  ', callLog.join(' ➔ '));
    console.log('  Contagem de Execuções por Modelo:');
    Object.entries(modelCallCount).forEach(([mod, cnt]) => {
      console.log(`    - ${mod}: ${cnt} chamada (Zero Retry: ${cnt === 1 ? 'SIM' : 'NÃO'})`);
    });

    const hasDuplicates = new Set(callLog).size !== callLog.length;
    if (hasDuplicates) {
      throw new Error('VIOLAÇÃO DA REGRA DE OURO: Modelo repetido na mesma operação!');
    }
  }

  // -------------------------------------------------------------------------
  // CENÁRIO 5: Falha Total - Todos os 4 modelos TTS falham -> Erro Agregado
  // -------------------------------------------------------------------------
  printHeader('CENÁRIO 5: Teste de Falha Total na Cadeia TTS (4 Modelos)');
  {
    const callLog: string[] = [];
    const modelCallCount: Record<string, number> = {};
    let caughtError: Error | null = null;

    try {
      await executeWithZeroRetryFallback('tts', 'gemini-3.8-flash-lite-tts', async (modelId) => {
        callLog.push(modelId);
        modelCallCount[modelId] = (modelCallCount[modelId] || 0) + 1;
        console.log(`[Falha Total TTS] Tentando ${callLog.length}/4: "${modelId}" -> ❌ ERRO FORÇADO`);
        throw new Error(`Simulated failure on ${modelId}`);
      });
    } catch (err: any) {
      caughtError = err;
    }

    console.log('\n📊 Resultado da Falha Total:');
    console.log('  Quantidade de Tentativas:', callLog.length);
    console.log('  Modelos Tentados na Ordem:', callLog.join(' ➔ '));
    console.log('  Contagem por Modelo:', JSON.stringify(modelCallCount));
    console.log('  Erro Agregado Retornado ao Usuário/Caller:');
    console.log('   ', caughtError?.message);

    if (callLog.length !== 4) throw new Error(`Esperava 4 tentativas na falha total, obteve ${callLog.length}`);
    if (new Set(callLog).size !== 4) throw new Error('Modelos não eram todos diferentes!');
    if (!caughtError || !caughtError.message.includes('Todos os 4 modelos falharam sem retry')) {
      throw new Error('Mensagem de erro agregado não formatada corretamente');
    }
  }

  // -------------------------------------------------------------------------
  // CENÁRIO 6: Teste de Sucesso Imediato no 1º Modelo (Sem chamadas subsequentes)
  // -------------------------------------------------------------------------
  printHeader('CENÁRIO 6: Sucesso no 1º Modelo -> Nenhum Modelo Subsequente Chamado');
  {
    const callLog: string[] = [];
    const modelCallCount: Record<string, number> = {};

    const res = await executeWithZeroRetryFallback('tts', 'gemini-3.8-flash-lite-tts', async (modelId) => {
      callLog.push(modelId);
      modelCallCount[modelId] = (modelCallCount[modelId] || 0) + 1;
      console.log(`[Sucesso Direto] Tentando "${modelId}" -> ✅ SUCESSO IMEDIATO`);
      return { audio: 'audio_sucesso_direto' };
    });

    console.log('\n📊 Log de Execução:');
    console.log('  Total de Chamadas:', callLog.length);
    console.log('  Modelo Executado:', callLog[0]);
    console.log('  Modelos Subsequentes Chamados:', callLog.length > 1 ? callLog.slice(1).join(', ') : 'NENHUM (CORRETO)');
    console.log('  Resultado Entregue:', res.result);

    if (callLog.length !== 1) throw new Error(`Esperava exatamente 1 chamada, obteve ${callLog.length}`);
    if (callLog[0] !== 'gemini-3.8-flash-lite-tts') throw new Error('Modelo incorreto');
  }

  printHeader('🎉 TODOS OS TESTES COMPORTAMENTAIS ZERO-RETRY PASSARAM COM 100% DE SUCESSO!');
}

runTests().catch((err) => {
  console.error('\n❌ ERRO NO TESTE:', err);
  process.exit(1);
});
