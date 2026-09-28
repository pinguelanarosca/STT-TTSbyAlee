/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Gerenciador de Menus de Contexto (botão direito) no Service Worker.
 */

import { sendTabMessageSafe } from '../utils/tabMessenger';

function createMenus(): void {
  chrome.contextMenus.removeAll(() => {
    // 1. Menu Principal para texto selecionado
    chrome.contextMenus.create({
      id: 'read_selection_menu',
      title: '🔊 Ler em voz alta com Gemini (TTS)',
      contexts: ['selection'],
    });

    // 2. Menu de Tradução
    chrome.contextMenus.create({
      id: 'translate_selection_menu',
      title: '🌐 Traduzir e Ouvir Seleção',
      contexts: ['selection'],
    });

    // 3. Menu de Resumo
    chrome.contextMenus.create({
      id: 'summarize_selection_menu',
      title: '📝 Resumir e Ouvir Seleção',
      contexts: ['selection'],
    });

    // 4. Menu de Ditado para campos de texto
    chrome.contextMenus.create({
      id: 'dictate_menu',
      title: '🎙 Ditar com Gemini (STT)',
      contexts: ['editable'],
    });
  });
}

export function setupContextMenus(): void {
  // Cria os menus imediatamente ao iniciar o Service Worker
  createMenus();

  // Garante a criação em eventos de ciclo de vida
  chrome.runtime.onInstalled.addListener(() => {
    createMenus();
  });

  chrome.runtime.onStartup.addListener(() => {
    createMenus();
  });

  // Listener de clique no menu de contexto
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab || !tab.id) return;

    switch (info.menuItemId) {
      case 'read_selection_menu':
        await sendTabMessageSafe(tab.id, tab.url, {
          type: 'CMD_READ_SELECTION',
          payload: { text: info.selectionText },
        });
        break;

      case 'translate_selection_menu':
        await sendTabMessageSafe(tab.id, tab.url, {
          type: 'CMD_READ_SELECTION',
          payload: { text: info.selectionText, agentId: 'translator' },
        });
        break;

      case 'summarize_selection_menu':
        await sendTabMessageSafe(tab.id, tab.url, {
          type: 'CMD_READ_SELECTION',
          payload: { text: info.selectionText, agentId: 'summarizer' },
        });
        break;

      case 'dictate_menu':
        await sendTabMessageSafe(tab.id, tab.url, {
          type: 'CMD_START_DICTATION',
        });
        break;
    }
  });
}

