/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Gerenciador de atalhos de teclado (chrome.commands) no Service Worker.
 */

import { sendTabMessageSafe } from '../utils/tabMessenger';

export function registerCommandHandlers(): void {
  chrome.commands.onCommand.addListener(async (command: string) => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || !activeTab.id) return;

    switch (command) {
      case 'read_selection':
        await sendTabMessageSafe(activeTab.id, activeTab.url, { type: 'CMD_READ_SELECTION' });
        break;

      case 'start_dictation':
        await sendTabMessageSafe(activeTab.id, activeTab.url, { type: 'CMD_START_DICTATION' });
        break;

      case 'toggle_hud':
        await sendTabMessageSafe(activeTab.id, activeTab.url, { type: 'TOGGLE_HUD' });
        break;

      default:
        console.warn(`[Command] Comando não reconhecido: ${command}`);
        break;
    }
  });
}
