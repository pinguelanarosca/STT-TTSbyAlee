/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Gerenciador de Menus de Contexto (botão direito) no Service Worker.
 */

export function setupContextMenus(): void {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'read_selection_menu',
        title: 'Ler em voz alta com Gemini (TTS)',
        contexts: ['selection'],
      });

      chrome.contextMenus.create({
        id: 'translate_selection_menu',
        title: 'Traduzir e Ouvir Seleção',
        contexts: ['selection'],
      });

      chrome.contextMenus.create({
        id: 'summarize_selection_menu',
        title: 'Resumir e Ouvir Seleção',
        contexts: ['selection'],
      });

      chrome.contextMenus.create({
        id: 'dictate_menu',
        title: 'Ditar com Gemini (STT)',
        contexts: ['editable'],
      });
    });
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab || !tab.id) return;

    switch (info.menuItemId) {
      case 'read_selection_menu':
        chrome.tabs.sendMessage(tab.id, {
          type: 'CMD_READ_SELECTION',
          payload: { text: info.selectionText },
        });
        break;

      case 'translate_selection_menu':
        chrome.tabs.sendMessage(tab.id, {
          type: 'CMD_READ_SELECTION',
          payload: { text: info.selectionText, agentId: 'translator' },
        });
        break;

      case 'summarize_selection_menu':
        chrome.tabs.sendMessage(tab.id, {
          type: 'CMD_READ_SELECTION',
          payload: { text: info.selectionText, agentId: 'summarizer' },
        });
        break;

      case 'dictate_menu':
        chrome.tabs.sendMessage(tab.id, {
          type: 'CMD_START_DICTATION',
        });
        break;
    }
  });
}
