/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Gerenciador de Captura de Tela e Análise Visual (Lens) no Service Worker.
 * Executa recorte local da área selecionada com base em coordenadas e devicePixelRatio.
 */

import { geminiDirectClient } from '../services/geminiDirectClient';
import { chromeStorage } from '../services/storage/chromeStorageAdapter';
import { getCanonicalAgent } from '@shared/constants/defaultAgents';
import { uint8ArrayToBase64 } from '@shared/utils/pcmWav';

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
  devicePixelRatio?: number;
}

export async function captureAndAnalyzeTab(
  tabId: number,
  instruction?: string,
  agentId?: string,
  rect?: SelectionRect
): Promise<string> {
  const apiSettings = await chromeStorage.get('api');
  if (!apiSettings.apiKey) {
    throw new Error('Chave de API Gemini não configurada. Abra as opções da extensão.');
  }

  const agent = getCanonicalAgent(agentId);
  const modelsSettings = await chromeStorage.get('models');

  // Captura a tela visível da aba ativa em formato JPEG
  const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: 90 });
  let base64ToSend = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

  // Se houver seleção retangular com dimensões válidas, recorta a imagem antes do envio à Gemini
  if (rect && rect.width > 10 && rect.height > 10) {
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const imageBitmap = await createImageBitmap(blob);

      const dpr = rect.devicePixelRatio || 1;
      const cropX = Math.max(0, Math.round(rect.x * dpr));
      const cropY = Math.max(0, Math.round(rect.y * dpr));
      const cropW = Math.min(imageBitmap.width - cropX, Math.round(rect.width * dpr));
      const cropH = Math.min(imageBitmap.height - cropY, Math.round(rect.height * dpr));

      if (cropW > 10 && cropH > 10) {
        const offscreen = new OffscreenCanvas(cropW, cropH);
        const ctx = offscreen.getContext('2d');
        if (ctx) {
          ctx.drawImage(imageBitmap, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          const croppedBlob = await offscreen.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
          const arrayBuffer = await croppedBlob.arrayBuffer();
          base64ToSend = uint8ArrayToBase64(new Uint8Array(arrayBuffer));
          console.log(`[Lens Handler] Imagem recortada com sucesso: ${cropW}x${cropH}px`);
        }
      }
    } catch (cropErr) {
      console.warn('[Lens Handler] Falha ao recortar seleção localmente, enviando captura integral:', cropErr);
    }
  }

  const prompt = instruction || agent.instructions.lensInspectionInstruction || 'Descreva a área selecionada da imagem.';
  return geminiDirectClient.inspectVisionContext(
    base64ToSend,
    prompt,
    apiSettings.apiKey,
    modelsSettings.visionModelId
  );
}
