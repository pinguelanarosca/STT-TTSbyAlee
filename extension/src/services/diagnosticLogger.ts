/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Serviço Centralizado de Logging e Diagnóstico Técnico.
 * Grava eventos de runtime, falhas de modelo, requisições de API, timeouts e estados do sistema
 * de forma persistente no namespace 'logs' do chrome.storage.local.
 */

import { TechnicalLogItem, LogLevel, LogSource } from '@shared/types/storage';
import { chromeStorage } from './storage/chromeStorageAdapter';

export interface LogEntryInput {
  level: LogLevel;
  source: LogSource;
  operation: string;
  message: string;
  modelId?: string;
  httpStatus?: number;
  durationMs?: number;
  errorDetails?: string;
}

export async function logDiagnostic(entry: LogEntryInput): Promise<void> {
  try {
    const logsData = await chromeStorage.get('logs');
    if (logsData.enabled === false) return;

    const newItem: TechnicalLogItem = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      level: entry.level,
      source: entry.source,
      operation: entry.operation,
      message: entry.message,
      modelId: entry.modelId,
      httpStatus: entry.httpStatus,
      durationMs: entry.durationMs,
      errorDetails: entry.errorDetails,
    };

    const max = logsData.maxEntries || 100;
    const updatedItems = [newItem, ...(logsData.items || [])].slice(0, max);
    await chromeStorage.setPartial('logs', { items: updatedItems });

    console.log(`[DiagnosticLog][${entry.source}][${entry.level.toUpperCase()}] ${entry.operation}: ${entry.message}`);
  } catch (err) {
    console.warn('[DiagnosticLogger] Falha ao persistir log técnico:', err);
  }
}

export async function clearDiagnosticLogs(): Promise<void> {
  try {
    await chromeStorage.setPartial('logs', { items: [] });
  } catch (err) {
    console.warn('[DiagnosticLogger] Falha ao limpar logs técnicos:', err);
  }
}
