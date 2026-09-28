/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Entrypoint modular do Content Script (Manifest V3).
 * Inicializa controladores, listeners de mensagens e atalhos de teclado editáveis.
 * Possui guard global para impedir injeções e listeners duplicados.
 */

import { hud } from './ui/hudController';
import { tts } from './controllers/ttsController';
import { stt } from './controllers/sttController';
import { lens } from './controllers/lensController';
import { getCleanSelectedText } from './dom/textExtractor';
import { injectTranscribedText } from './dom/inputInjector';
import { matchesShortcut } from '@shared/utils/shortcutMatcher';
import { chromeStorage } from '../services/storage/chromeStorageAdapter';
import { DEFAULT_UI_PREFERENCES } from '@shared/constants/defaultSettings';

// Estilos CSS do HUD
import hudCss from './styles/hud.css?raw';

// Guard global para evitar duplicação de content scripts e listeners
declare global {
  interface Window {
    __STT_TTSBYALEE_INITIALIZED__?: boolean;
  }
}

let cachedShortcuts = { ...DEFAULT_UI_PREFERENCES.shortcuts };

function initialize(): void {
  if (window.__STT_TTSBYALEE_INITIALIZED__) {
    return;
  }
  window.__STT_TTSBYALEE_INITIALIZED__ = true;

  // Carrega atalhos configurados pelo usuário
  chromeStorage.get('ui').then((uiData) => {
    if (uiData?.shortcuts) {
      cachedShortcuts = { ...cachedShortcuts, ...uiData.shortcuts };
    }
  });

  // Atualiza atalhos em tempo real quando alterados nas Opções da Extensão
  chromeStorage.subscribe('ui', (newUi) => {
    if (newUi?.shortcuts) {
      cachedShortcuts = { ...cachedShortcuts, ...newUi.shortcuts };
    }
  });

  // Inicializa o HUD no Shadow DOM
  hud.init(hudCss);

  // Conecta ações do HUD aos controladores
  hud.onPlayPauseClick = () => tts.togglePlayPause();
  hud.onStopClick = () => tts.stop();
  hud.onCloseClick = () => {
    tts.stop();
    stt.cancelRecording();
  };
  hud.onRecordClick = () => stt.toggleRecording();
  hud.onLensClick = () => lens.activateLensMode();
  hud.onVolumeChange = (vol) => tts.setVolume(vol);
  hud.onSpeedChange = (speed) => tts.setSpeed(speed);

  // Registro de atalhos de teclado dinâmicos e editáveis da página
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    // 1. Ler texto selecionado (Default: Ctrl+B)
    if (matchesShortcut(e, cachedShortcuts.readSelection || 'Ctrl+B')) {
      const { cleaned } = getCleanSelectedText();
      if (cleaned) {
        e.preventDefault();
        tts.speakText(cleaned);
      }
      return;
    }

    // 2. Pausar / Retomar leitura (Default: Pause / Break)
    if (matchesShortcut(e, cachedShortcuts.togglePause || 'Pause')) {
      e.preventDefault();
      tts.togglePlayPause();
      return;
    }

    // 3. Iniciar / Parar Ditado por voz (Default: Ctrl+Shift+Espaço)
    if (matchesShortcut(e, cachedShortcuts.startDictation || 'Ctrl+Shift+Space')) {
      e.preventDefault();
      stt.toggleRecording();
      return;
    }

    // 4. Iniciar Seleção Gemini Lens por teclado (Default: Ctrl+Shift+L)
    if (matchesShortcut(e, cachedShortcuts.lensSelection || 'Ctrl+Shift+L')) {
      e.preventDefault();
      lens.activateLensMode();
      return;
    }

    // 5. Alternar exibição do HUD flutuante (Default: Alt+Shift+H)
    if (matchesShortcut(e, cachedShortcuts.toggleHud || 'Alt+Shift+H')) {
      e.preventDefault();
      hud.toggle();
      return;
    }
  });

  // 5. Ctrl+Shift+Arrastar: Gemini Lens (Seleção retangular na página)
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
