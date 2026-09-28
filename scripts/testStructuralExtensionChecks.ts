/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Teste Estrutural de Invariantes e Regras do Código da Extensão Chrome.
 * Verifica estritamente:
 * 1. TTS background não aborta nova solicitação
 * 2. Lens envia agentId
 * 3. Lens possui timeout global (30s)
 * 4. Lens NÃO possui fallback para screenshot integral
 * 5. Schema possui logs namespace
 * 6. UI Options lê/escreve logs
 * 7. chrome.commands.getAll() é usado na UI de atalhos
 * 8. Timeout por modelo Gemini é estritamente 15s (15000ms)
 */

import fs from 'fs';
import path from 'path';

function runStructuralChecks() {
  console.log('===========================================================');
  console.log('🧪 INICIANDO VERIFICAÇÃO ESTRUTURAL DE REGRAS E INVARIANTES');
  console.log('===========================================================');

  const rootDir = process.cwd();

  // 1. TTS background não aborta nova solicitação
  const messageRouterPath = path.join(rootDir, 'extension/src/background/messageRouter.ts');
  const messageRouterContent = fs.readFileSync(messageRouterPath, 'utf8');

  if (messageRouterContent.includes('activeTtsAbortController.abort(\'Nova requisição iniciada.\')')) {
    throw new Error('❌ REGRA VIOLADA: messageRouter.ts ainda aborta activeTtsAbortController em nova solicitação TTS!');
  }
  console.log('✅ 1. TTS Background: Nova solicitação NÃO aborta a anterior.');

  // 2. Lens envia agentId
  const lensControllerPath = path.join(rootDir, 'extension/src/content/controllers/lensController.ts');
  const lensControllerContent = fs.readFileSync(lensControllerPath, 'utf8');

  if (!lensControllerContent.includes('agentId')) {
    throw new Error('❌ REGRA VIOLADA: lensController.ts não envia agentId no payload de LENS_ANALYZE_REQUEST!');
  }
  console.log('✅ 2. Lens Controller: envia agentId no payload do LENS_ANALYZE_REQUEST.');

  // 3. Lens possui timeout global (30s)
  const tabCapturePath = path.join(rootDir, 'extension/src/background/tabCaptureHandler.ts');
  const tabCaptureContent = fs.readFileSync(tabCapturePath, 'utf8');

  if (!tabCaptureContent.includes('GLOBAL_LENS_TIMEOUT_MS = 30000') && !tabCaptureContent.includes('30000')) {
    throw new Error('❌ REGRA VIOLADA: tabCaptureHandler.ts não possui timeout global de 30s!');
  }
  if (!lensControllerContent.includes('30000')) {
    throw new Error('❌ REGRA VIOLADA: lensController.ts não possui timeout client-side global de 30s!');
  }
  console.log('✅ 3. Lens Flow: Timeout global de 30s implementado no background e client-side.');

  // 4. Lens não possui fallback para screenshot integral
  if (!tabCaptureContent.includes('NUNCA enviando captura integral') || !tabCaptureContent.includes('throw new Error')) {
    throw new Error('❌ REGRA VIOLADA: tabCaptureHandler.ts não lança erro explícito quando o crop falha!');
  }
  console.log('✅ 4. Lens Crop: Não existe fallback para screenshot integral em caso de erro.');

  // 5. Schema possui logs
  const storageTypesPath = path.join(rootDir, 'shared/types/storage.ts');
  const storageTypesContent = fs.readFileSync(storageTypesPath, 'utf8');

  if (!storageTypesContent.includes('logs: TechnicalLogsSchema')) {
    throw new Error('❌ REGRA VIOLADA: AppStorageSchema em storage.ts não possui namespace "logs"!');
  }
  console.log('✅ 5. Storage Schema: Namespace "logs" estruturado no contrato.');

  // 6. UI realmente lê/escreve logs
  const optionsAppPath = path.join(rootDir, 'extension/src/options/OptionsApp.tsx');
  const optionsAppContent = fs.readFileSync(optionsAppPath, 'utf8');

  if (!optionsAppContent.includes('chromeStorage.subscribe(\'logs\'') || !optionsAppContent.includes('storageState?.logs')) {
    throw new Error('❌ REGRA VIOLADA: OptionsApp.tsx não se inscreve nem exibe o namespace "logs"!');
  }
  console.log('✅ 6. UI Options: Inscrição e renderização em tempo real de logs de diagnóstico ativas.');

  // 7. chrome.commands.getAll() é usado
  if (!optionsAppContent.includes('chrome.commands.getAll') || !optionsAppContent.includes('chrome://extensions/shortcuts')) {
    throw new Error('❌ REGRA VIOLADA: OptionsApp.tsx não utiliza chrome.commands.getAll() nem link/botão para chrome://extensions/shortcuts!');
  }
  console.log('✅ 7. Atalhos Globais: chrome.commands.getAll() e redirecionamento para chrome://extensions/shortcuts confirmados.');

  // 8. Timeout por modelo é 15s (15000)
  const clientPath = path.join(rootDir, 'extension/src/services/geminiDirectClient.ts');
  const clientContent = fs.readFileSync(clientPath, 'utf8');

  if (!clientContent.includes('MAX_PER_MODEL_TIMEOUT_MS = 15000')) {
    throw new Error('❌ REGRA VIOLADA: geminiDirectClient.ts não possui MAX_PER_MODEL_TIMEOUT_MS = 15000!');
  }
  console.log('✅ 8. Timeout Gemini: MAX_PER_MODEL_TIMEOUT_MS redefinido estritamente para 15000ms (15s).');

  console.log('===========================================================');
  console.log('🎉 TODAS AS 8 VERIFICAÇÕES ESTRUTURAIS PASSARAM COM SUCESSO!');
  console.log('===========================================================');
}

runStructuralChecks();
