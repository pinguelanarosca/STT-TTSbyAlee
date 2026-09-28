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
import { logDiagnostic } from '../services/diagnosticLogger';

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
  // Timeout Global de 30s para o fluxo inteiro da captura até a resposta
  const GLOBAL_LENS_TIMEOUT_MS = 30000;

  const executionPromise = (async () => {
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

        if (cropW <= 10 || cropH <= 10) {
          throw new Error(`Dimensões de recorte inválidas após DPR: ${cropW}x${cropH}px`);
        }

        const offscreen = new OffscreenCanvas(cropW, cropH);
        const ctx = offscreen.getContext('2d');
        if (!ctx) {
          throw new Error('Falha ao obter contexto 2D para OffscreenCanvas');
        }

        ctx.drawImage(imageBitmap, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        const croppedBlob = await offscreen.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
        const arrayBuffer = await croppedBlob.arrayBuffer();
        base64ToSend = uint8ArrayToBase64(new Uint8Array(arrayBuffer));

        await logDiagnostic({
          level: 'info',
          source: 'LENS',
          operation: 'CROP_SELECTION_SUCCESS',
          message: `Seleção de tela recortada com sucesso: ${cropW}x${cropH}px (DPR ${dpr})`,
        });
      } catch (cropErr: any) {
        const cropErrMsg = cropErr instanceof Error ? cropErr.message : String(cropErr);
        await logDiagnostic({
          level: 'error',
          source: 'LENS',
          operation: 'CROP_SELECTION_FAILED',
          message: `Falha ao recortar seleção de tela: ${cropErrMsg}. NUNCA enviando captura integral.`,
          errorDetails: cropErr?.stack || String(cropErr),
        });
        // NUNCA envia tela inteira quando existe seleção. Lança erro explícito.
        throw new Error(`Falha no recorte da seleção de tela: ${cropErrMsg}`);
      }
    }

    const prompt = instruction || agent.instructions.lensInspectionInstruction || 'Descreva a área selecionada da imagem.';
    return geminiDirectClient.inspectVisionContext(
      base64ToSend,
      prompt,
      apiSettings.apiKey,
      modelsSettings.visionModelId
    );
  })();

  let timerId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error('Timeout global de 30s excedido no fluxo do Gemini Lens.'));
    }, GLOBAL_LENS_TIMEOUT_MS);
  });

  try {
    return await Promise.race([executionPromise, timeoutPromise]);
  } finally {
    if (timerId) clearTimeout(timerId);
  }
}
