/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Extrator e normalizador de texto selecionado no DOM da página ativa.
 */

import { cleanTextForTts } from '@shared/utils/textCleaner';

export function getCleanSelectedText(): { raw: string; cleaned: string } {
  let raw = '';
  const activeElement = document.activeElement;

  if (
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement
  ) {
    const start = activeElement.selectionStart || 0;
    const end = activeElement.selectionEnd || 0;
    if (start !== end) {
      raw = activeElement.value.substring(start, end);
    }
  }

  if (!raw) {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      raw = selection.toString();
    }
  }

  const cleaned = cleanTextForTts(raw);
  return { raw, cleaned };
}
