/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Roteador de mensagens tipado da Extensão Chrome (Service Worker).
 * Despacha requisições entre Content Script, Popup e Options com suporte a cancelamento de TTS,
 * recorte no Lens e gravação de logs de histórico.
 */

import { AnyExtensionMessage, ExtensionResponse } from '@shared/types/messages';
import { HistoryItem } from '@shared/types/storage';
import { getCanonicalAgent } from '@shared/constants/defaultAgents';
import { chromeStorage } from '../services/storage/chromeStorageAdapter';
import { geminiDirectClient } from '../services/geminiDirectClient';
import { captureAndAnalyzeTab } from './tabCaptureHandler';

let activeTtsAbortController: AbortController | null = null;

async function addHistoryLog(
  type: 'tts' | 'stt' | 'vision',
  previewText: string,
  agentId?: string,
  status: 'success' | 'error' = 'success',
  errorDetails?: string
) {
  try {
    const historyData = await chromeStorage.get('history');
    if (historyData.enabled === false) return;

    const newItem: HistoryItem = {
      id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type,
      agentId: agentId || 'narrator',
      previewText: status === 'error' ? `❌ [ERRO] ${previewText}` : previewText,
      status,
      errorDetails,
    };

    const updatedItems = [newItem, ...(historyData.recentItems || [])].slice(0, historyData.maxEntries || 50);
    await chromeStorage.setPartial('history', { recentItems: updatedItems });
  } catch (err) {
    console.warn('[HistoryLog] Falha ao gravar histórico:', err);
  }
}

export async function handleExtensionMessage(
  message: AnyExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<ExtensionResponse> {
  try {
    switch (message.type) {
      case 'TTS_REQUEST': {
        const { text, agentId, voiceName } = message.payload;
        if (!text || !text.trim()) {
          return { success: false, error: 'Texto não informado para síntese.' };
        }

        if (activeTtsAbortController) {
          activeTtsAbortController.abort('Nova requisição iniciada.');
        }

        const currentController = new AbortController();
        activeTtsAbortController = currentController;

        const apiSettings = await chromeStorage.get('api');
        if (!apiSettings.apiKey) {
          const err = 'Chave de API Gemini não configurada. Abra as opções para configurar.';
          await addHistoryLog('tts', text.substring(0, 60), agentId, 'error', err);
          return { success: false, error: err };
        }

        const agentsSettings = await chromeStorage.get('agents');
        const customAgent = agentsSettings.customAgents?.find((a) => a.metadata.id === agentId);
        const agent = customAgent || getCanonicalAgent(agentId);
        const modelsSettings = await chromeStorage.get('models');
        const audioSettings = await chromeStorage.get('audio');

        const ttsModelId = agent.modelPreferences.ttsModelId || modelsSettings.ttsModelId;
        const voice = voiceName || agent.voice.preferredVoice || audioSettings.preferredVoice;

        console.log(`[TTS Router] Iniciando TTS para "${text.length > 30 ? text.substring(0, 30) + '...' : text}" com modelo ${ttsModelId}`);

        try {
          const result = await geminiDirectClient.synthesizeSpeech(
            {
              text,
              voiceName: voice,
              rateMultiplier: agent.voice.rateMultiplier,
              pitchMultiplier: agent.voice.pitchMultiplier,
              systemInstruction: agent.instructions.ttsSystemInstruction,
              modelId: ttsModelId,
            },
            apiSettings.apiKey,
            currentController.signal
          );

          await addHistoryLog('tts', text.length > 80 ? text.substring(0, 80) + '...' : text, agentId, 'success');
          console.log(`[TTS Router] Síntese finalizada com sucesso via modelo: ${result.modelUsed}`);
          return { success: true, data: result };
        } catch (err: any) {
          const errMsg = err instanceof Error ? err.message : String(err);
          await addHistoryLog('tts', text.substring(0, 60), agentId, 'error', errMsg);
          throw err;
        } finally {
          if (activeTtsAbortController === currentController) {
            activeTtsAbortController = null;
          }
        }
      }

      case 'TTS_STOP': {
        if (activeTtsAbortController) {
          console.log('[TTS Router] Recebido TTS_STOP: abortando requisição ativa.');
          activeTtsAbortController.abort('Interrompido por TTS_STOP');
          activeTtsAbortController = null;
        }
        return { success: true };
      }

      case 'STT_TRANSCRIBE_REQUEST': {
        const { audioBase64, mimeType, agentId, targetInputSelector } = message.payload;
        const apiSettings = await chromeStorage.get('api');
        if (!apiSettings.apiKey) {
          const err = 'Chave de API Gemini não configurada. Abra as opções para configurar.';
          await addHistoryLog('stt', 'Gravação de voz', agentId, 'error', err);
          return { success: false, error: err };
        }

        const agentsSettings = await chromeStorage.get('agents');
        const customAgent = agentsSettings.customAgents?.find((a) => a.metadata.id === agentId);
        const agent = customAgent || getCanonicalAgent(agentId);
        const modelsSettings = await chromeStorage.get('models');
        const sttModelId = agent.modelPreferences.sttModelId || modelsSettings.sttModelId;

        console.log(`[STT Router] Iniciando transcrição com ${sttModelId}, mimeType: ${mimeType}`);

        try {
          const transcribedText = await geminiDirectClient.transcribeAudio(
            {
              audioBase64,
              mimeType,
              formattingInstruction: agent.instructions.sttFormattingInstruction,
              modelId: sttModelId,
            },
            apiSettings.apiKey
          );

          await addHistoryLog('stt', transcribedText.length > 80 ? transcribedText.substring(0, 80) + '...' : transcribedText, agentId, 'success');

          if (sender.tab?.id) {
            chrome.tabs.sendMessage(sender.tab.id, {
              type: 'STT_RESULT',
              payload: {
                text: transcribedText,
                isFinal: true,
                targetInputSelector,
              },
            });
          }

          return { success: true, data: { text: transcribedText } };
        } catch (err: any) {
          const errMsg = err instanceof Error ? err.message : String(err);
          await addHistoryLog('stt', 'Ditado por voz', agentId, 'error', errMsg);
          throw err;
        }
      }

      case 'TEST_API_KEY': {
        const isValid = await geminiDirectClient.testApiKey(message.payload.apiKey);
        return { success: isValid, error: isValid ? undefined : 'Chave inválida ou sem permissão de acesso.' };
      }

      case 'DISCOVER_MODELS': {
        const apiSettings = await chromeStorage.get('api');
        if (!apiSettings.apiKey) {
          return { success: false, error: 'Chave de API não informada.' };
        }
        const discovered = await geminiDirectClient.discoverAvailableModels(apiSettings.apiKey);
        await chromeStorage.setPartial('models', {
          discoveredModels: discovered,
          discoveryCacheTimestamp: Date.now(),
        });
        return { success: true, data: discovered };
      }

      case 'LENS_ANALYZE_REQUEST': {
        const tabId = sender.tab?.id;
        if (!tabId) {
          return { success: false, error: 'Aba não identificada para captura visual.' };
        }
        console.log(`[Lens Router] Iniciando captura visual para aba ${tabId}`);

        try {
          const description = await captureAndAnalyzeTab(
            tabId,
            message.payload.instruction,
            message.payload.agentId,
            message.payload.rect
          );

          await addHistoryLog('vision', description.length > 80 ? description.substring(0, 80) + '...' : description, message.payload.agentId, 'success');
          return { success: true, data: description };
        } catch (err: any) {
          const errMsg = err instanceof Error ? err.message : String(err);
          await addHistoryLog('vision', 'Análise de Seleção de Tela', message.payload.agentId, 'error', errMsg);
          throw err;
        }
      }

      case 'TOGGLE_HUD': {
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, message);
        }
        return { success: true };
      }

      default:
        return { success: false, error: `Tipo de mensagem desconhecido: ${(message as AnyExtensionMessage).type}` };
    }
  } catch (err) {
    const messageStr = err instanceof Error ? err.message : String(err);
    console.error('[MessageRouter] Erro no processamento da mensagem:', messageStr);
    return { success: false, error: messageStr };
  }
}
