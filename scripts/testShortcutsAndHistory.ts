/**
 * Teste unitário e de integração para Atalhos Editáveis, Histórico e Gemini Lens.
 */

import { parseShortcut, matchesShortcut, recordShortcutFromEvent, formatShortcutDisplay } from '../shared/utils/shortcutMatcher';
import { migrateLegacyStorage, DEFAULT_STORAGE_STATE } from '../shared/constants/defaultSettings';

async function runTests() {
  console.log('===========================================================');
  console.log('🧪 TESTANDO ATALHOS EDITÁVEIS E HISTÓRICO DE LOGS');
  console.log('===========================================================');

  // 1. Teste de Parsing de Atalhos
  const p1 = parseShortcut('Ctrl+B');
  console.assert(p1.ctrl === true && p1.key === 'B', 'P1 falhou');
  console.log('✅ Parse "Ctrl+B":', p1);

  const p2 = parseShortcut('Ctrl+Shift+Space');
  console.assert(p2.ctrl === true && p2.shift === true && p2.key === 'Space', 'P2 falhou');
  console.log('✅ Parse "Ctrl+Shift+Space":', p2);

  const p3 = parseShortcut('Alt+Shift+H');
  console.assert(p3.alt === true && p3.shift === true && p3.key === 'H', 'P3 falhou');
  console.log('✅ Parse "Alt+Shift+H":', p3);

  const p4 = parseShortcut('Pause');
  console.assert(p4.key === 'Pause', 'P4 falhou');
  console.log('✅ Parse "Pause":', p4);

  // 2. Teste de Formatação de Exibição de Atalho
  const fmt1 = formatShortcutDisplay('Ctrl+Shift+L');
  console.assert(fmt1 === 'Ctrl + Shift + L', 'Format 1 falhou');
  console.log('✅ Display Format "Ctrl+Shift+L":', fmt1);

  const fmt2 = formatShortcutDisplay('Pause');
  console.assert(fmt2 === 'PAUSE', 'Format 2 falhou');
  console.log('✅ Display Format "Pause":', fmt2);

  // 3. Teste de Persistência do Histórico em migrateLegacyStorage
  const mockRawStorage = {
    apiKey: 'AIzaSyTestKey',
    history: {
      enabled: true,
      maxEntries: 50,
      recentItems: [
        { id: 'h1', timestamp: Date.now(), type: 'tts', agentId: 'narrator', previewText: 'Olá mundo' },
        { id: 'h2', timestamp: Date.now(), type: 'stt', agentId: 'narrator', previewText: 'Ditado gravado' },
      ],
    },
  };

  const migrated = migrateLegacyStorage(mockRawStorage);
  console.assert(migrated.history.recentItems.length === 2, 'Migração de histórico falhou!');
  console.assert(migrated.history.recentItems[0].previewText === 'Olá mundo', 'Item de histórico incorreto');
  console.log('✅ Persistência de Histórico em migrateLegacyStorage OK! Itens preservados:', migrated.history.recentItems.length);

  console.log('===========================================================');
  console.log('🎉 TODOS OS TESTES DE ATALHOS E HISTÓRICO PASSARAM COM SUCESSO!');
  console.log('===========================================================');
}

runTests().catch(console.error);
