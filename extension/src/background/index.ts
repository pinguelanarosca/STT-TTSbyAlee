/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Entrypoint do Service Worker da Extensão Chrome (Manifest V3).
 * Orientado a eventos, ultraleve e sem dependência de DOM.
 */

import { handleExtensionMessage } from './messageRouter';
import { registerCommandHandlers } from './commandHandler';
import { setupContextMenus } from './contextMenuHandler';
import { chromeStorage } from '../services/storage/chromeStorageAdapter';

// Inicialização de ciclo de vida
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[EXT TTS STT] Extensão inicializada (${details.reason})`);
  // Garante que o storage possua os namespaces padrão inicializados
  const allSettings = await chromeStorage.getAll();
  await chromeStorage.setMultiple(allSettings);
});

// Registro dos listeners de atalhos e menus
registerCommandHandlers();
setupContextMenus();

// Roteamento de mensagens assíncronas
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleExtensionMessage(message, sender)
    .then((response) => sendResponse(response))
    .catch((error) => sendResponse({ success: false, error: String(error) }));
  return true; // Retorno true mantém a porta de resposta aberta para promessas
});
