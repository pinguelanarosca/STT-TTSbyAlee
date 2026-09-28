/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Injetor de texto transcrito em campos de input, textarea e contentEditable.
 */

import { sanitizeDictatedText } from '@shared/utils/textCleaner';

export function injectTranscribedText(
  rawText: string,
  targetSelector?: string,
  explicitTarget?: Element | null
): boolean {
  const textToInsert = sanitizeDictatedText(rawText);
  if (!textToInsert) return false;

  let targetElement: Element | null = explicitTarget || null;

  if (!targetElement && targetSelector) {
    targetElement = document.querySelector(targetSelector);
  }

  if (!targetElement) {
    targetElement = document.activeElement;
  }

  if (!targetElement) return false;

  // Caso 1: Input ou TextArea padrão
  if (
    targetElement instanceof HTMLInputElement ||
    targetElement instanceof HTMLTextAreaElement
  ) {
    const start = targetElement.selectionStart || targetElement.value.length;
    const end = targetElement.selectionEnd || targetElement.value.length;
    const originalValue = targetElement.value;

    const prefix = originalValue.substring(0, start);
    const suffix = originalValue.substring(end);
    const spacer = prefix.length > 0 && !prefix.endsWith(' ') ? ' ' : '';

    targetElement.value = prefix + spacer + textToInsert + suffix;
    targetElement.selectionStart = targetElement.selectionEnd = start + spacer.length + textToInsert.length;

    // Dispara eventos para React / Vue / Angular capturarem a mutação
    targetElement.dispatchEvent(new Event('input', { bubbles: true }));
    targetElement.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  // Caso 2: contentEditable (Gmail, Notion, Slack web, Docs)
  if ((targetElement as HTMLElement).isContentEditable) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(' ' + textToInsert);
      range.insertNode(textNode);
      range.collapse(false);
      targetElement.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
  }

  return false;
}
