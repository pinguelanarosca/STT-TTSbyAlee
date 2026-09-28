/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Utilitário de Parsing, Comparação e Formatação de Atalhos de Teclado Editáveis.
 */

export interface ParsedShortcut {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  key: string;
}

export function parseShortcut(shortcutStr?: string): ParsedShortcut {
  if (!shortcutStr || typeof shortcutStr !== 'string') {
    return { ctrl: false, shift: false, alt: false, meta: false, key: '' };
  }

  const parts = shortcutStr.split('+').map((p) => p.trim());
  let ctrl = false;
  let shift = false;
  let alt = false;
  let meta = false;
  let key = '';

  for (const p of parts) {
    const lower = p.toLowerCase();
    if (lower === 'ctrl' || lower === 'control') ctrl = true;
    else if (lower === 'shift') shift = true;
    else if (lower === 'alt') alt = true;
    else if (lower === 'cmd' || lower === 'meta') meta = true;
    else key = p;
  }

  return { ctrl, shift, alt, meta, key };
}

export function matchesShortcut(event: KeyboardEvent, shortcutStr?: string): boolean {
  if (!shortcutStr || !event) return false;

  const parsed = parseShortcut(shortcutStr);
  if (!parsed.key) return false;

  const hasCtrlOrMeta = event.ctrlKey || event.metaKey;
  if (parsed.ctrl !== hasCtrlOrMeta) return false;
  if (parsed.shift !== event.shiftKey) return false;
  if (parsed.alt !== event.altKey) return false;

  const targetKey = parsed.key.toLowerCase();
  const eventKey = (event.key || '').toLowerCase();
  const eventCode = (event.code || '').toLowerCase();

  if (targetKey === 'space' || targetKey === 'espaço') {
    return eventKey === ' ' || eventCode === 'space';
  }

  if (targetKey === 'pause' || targetKey === 'break') {
    return eventKey === 'pause' || eventCode === 'pause';
  }

  // Compara tecla de letra, número ou caractere
  if (eventKey === targetKey) return true;
  if (eventCode === `key${targetKey}`) return true;
  if (eventCode === targetKey) return true;

  return false;
}

export function formatShortcutDisplay(shortcutStr?: string): string {
  if (!shortcutStr) return 'Não configurado';
  const parsed = parseShortcut(shortcutStr);
  const parts: string[] = [];

  if (parsed.ctrl) parts.push('Ctrl');
  if (parsed.alt) parts.push('Alt');
  if (parsed.shift) parts.push('Shift');
  if (parsed.meta) parts.push('Cmd');

  if (parsed.key) {
    let keyLabel = parsed.key.toUpperCase();
    if (keyLabel === 'SPACE') keyLabel = 'Espaço';
    parts.push(keyLabel);
  }

  return parts.join(' + ');
}

export function recordShortcutFromEvent(e: KeyboardEvent): string | null {
  // Ignora teclas modificadoras isoladas
  if (['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
    return null;
  }

  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  let keyStr = e.code.replace(/^Key/, '').replace(/^Digit/, '');
  if (e.key === ' ') keyStr = 'Space';
  else if (e.key === 'Pause') keyStr = 'Pause';
  else if (!keyStr) keyStr = e.key.toUpperCase();

  parts.push(keyStr);
  return parts.join('+');
}
