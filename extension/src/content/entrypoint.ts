/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Entrypoint modular do Content Script (Manifest V3).
 * Inicializa controladores, listeners de mensagens e atalhos de teclado.
 * NÃO importa React nem bibliotecas pesadas.
 */

import { hud } from './ui/hudController';
import { tts } from './controllers/ttsController';
import { stt } from './controllers/sttController';
import { lens } from './controllers/lensController';
import { getCleanSelectedText } from './dom/textExtractor';
import { injectTranscribedText } from './dom/inputInjector';

// Estilos CSS do HUD
import hudCss from './styles/hud.css?raw';

function initialize(): void {
  // Inicializa o HUD no Shadow DOM
  hud.init(hudCss);

  // Conecta ações do HUD aos controladores
  hud.onPlayPauseClick = () => tts.togglePlayPause();
  hud.onStopClick = () => tts.stop();
  hud.onRecordClick = () => stt.toggleRecording();
  hud.onVolumeChange = (vol) => tts.setVolume(vol);
  hud.onSpeedChange = (speed) => tts.setSpeed(speed);

  // Registro de atalhos de teclado da página
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    // 1. Ctrl+B: Ler texto selecionado (TTS)
    if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.code === 'KeyB' || e.key === 'b' || e.key === 'B')) {
      const { cleaned } = getCleanSelectedText();
      if (cleaned) {
        e.preventDefault();
        tts.speakText(cleaned);
      }
    }

    // 2. Pause / Break: Pausar / Retomar leitura
    if (e.code === 'Pause' || e.key === 'Pause') {
      e.preventDefault();
      tts.togglePlayPause();
    }

    // 3. Ctrl+Shift+Espaço: Iniciar / Parar Ditado por voz (STT)
    if (e.ctrlKey && e.shiftKey && (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar')) {
      e.preventDefault();
      stt.toggleRecording();
    }
  });

  // 4. Ctrl+Shift+Arrastar: Gemini Lens (Seleção retangular na página)
  window.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.ctrlKey && e.shiftKey && e.button === 0) {
      e.preventDefault();
      lens.startDragSelection(e.clientX, e.clientY);
    }
  });

  // Listener para mensagens vindas do Background / Popup / Menus
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type) {
      case 'CMD_READ_SELECTION': {
        const payloadText = message.payload?.text;
        const targetText = payloadText || getCleanSelectedText().cleaned;
        if (targetText) {
          tts.speakText(targetText, message.payload?.agentId);
        }
        sendResponse({ success: true });
        break;
      }

      case 'CMD_START_DICTATION': {
        stt.toggleRecording(message.payload?.agentId);
        sendResponse({ success: true });
        break;
      }

      case 'TOGGLE_HUD': {
        hud.toggle();
        sendResponse({ success: true });
        break;
      }

      case 'TTS_AUDIO_READY': {
        if (message.payload?.audioBase64) {
          tts.playBase64Audio(message.payload.audioBase64, message.payload.mimeType);
        }
        sendResponse({ success: true });
        break;
      }

      case 'STT_RESULT': {
        if (message.payload?.text) {
          injectTranscribedText(message.payload.text, message.payload.targetInputSelector);
        }
        sendResponse({ success: true });
        break;
      }
    }
    return true;
  });
}

// Inicia assim que o script de conteúdo é injetado
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
