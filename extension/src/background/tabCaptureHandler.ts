/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Gerenciador de Captura de Tela e Análise Visual (Lens) no Service Worker.
 */

import { geminiDirectClient } from '../services/geminiDirectClient';
import { chromeStorage } from '../services/storage/chromeStorageAdapter';
import { getCanonicalAgent } from '@shared/constants/defaultAgents';

export async function captureAndAnalyzeTab(
  tabId: number,
  instruction?: string,
  agentId?: string
): Promise<string> {
  const apiSettings = await chromeStorage.get('api');
  if (!apiSettings.apiKey) {
    throw new Error('Chave de API Gemini não configurada.');
  }

  const agent = getCanonicalAgent(agentId);
  const modelsSettings = await chromeStorage.get('models');

  // Captura tela visível da aba ativa em formato JPEG
  const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: 80 });
  const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

  const prompt = instruction || agent.instructions.lensInspectionInstruction || 'Descreva a página.';
  return geminiDirectClient.inspectVisionContext(
    base64Data,
    prompt,
    apiSettings.apiKey,
    modelsSettings.visionModelId
  );
}
