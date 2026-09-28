/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Implementação de IStorageService para o Web Studio utilizando localStorage.
 * Garante sincronização bidirecional e compatibilidade com o schema unificado AppStorageSchema.
 */

import { AppStorageSchema, IStorageService } from '@shared/types/storage';
import { DEFAULT_STORAGE_STATE, migrateLegacyStorage } from '@shared/constants/defaultSettings';

const STORAGE_PREFIX = 'ext_tts_stt_';

export class WebStorageAdapter implements IStorageService {
  private static instance: WebStorageAdapter;
  private listeners: Map<string, Set<(newVal: unknown, oldVal?: unknown) => void>> = new Map();

  public static getInstance(): WebStorageAdapter {
    if (!WebStorageAdapter.instance) {
      WebStorageAdapter.instance = new WebStorageAdapter();
    }
    return WebStorageAdapter.instance;
  }

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key && event.key.startsWith(STORAGE_PREFIX)) {
          const namespace = event.key.replace(STORAGE_PREFIX, '') as keyof AppStorageSchema;
          const callbacks = this.listeners.get(namespace);
          if (callbacks) {
            try {
              const newVal = event.newValue ? JSON.parse(event.newValue) : DEFAULT_STORAGE_STATE[namespace];
              const oldVal = event.oldValue ? JSON.parse(event.oldValue) : undefined;
              callbacks.forEach((cb) => cb(newVal, oldVal));
            } catch (err) {
              console.error('[WebStorage] Erro ao processar evento storage:', err);
            }
          }
        }
      });
    }
  }

  public async get<K extends keyof AppStorageSchema>(namespace: K): Promise<AppStorageSchema[K]> {
    if (typeof window === 'undefined') {
      return DEFAULT_STORAGE_STATE[namespace];
    }
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${namespace}`);
    if (!raw) {
      return DEFAULT_STORAGE_STATE[namespace];
    }
    try {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_STORAGE_STATE[namespace], ...parsed };
    } catch {
      return DEFAULT_STORAGE_STATE[namespace];
    }
  }

  public async getAll(): Promise<AppStorageSchema> {
    if (typeof window === 'undefined') {
      return DEFAULT_STORAGE_STATE;
    }
    const result: Partial<AppStorageSchema> = {};
    for (const key of Object.keys(DEFAULT_STORAGE_STATE) as Array<keyof AppStorageSchema>) {
      result[key] = await this.get(key) as never;
    }
    return migrateLegacyStorage(result as Record<string, unknown>);
  }

  public async set<K extends keyof AppStorageSchema>(
    namespace: K,
    value: AppStorageSchema[K]
  ): Promise<void> {
    if (typeof window === 'undefined') return;
    const oldVal = await this.get(namespace);
    localStorage.setItem(`${STORAGE_PREFIX}${namespace}`, JSON.stringify(value));

    // Notifica ouvintes locais
    const callbacks = this.listeners.get(namespace);
    if (callbacks) {
      callbacks.forEach((cb) => cb(value, oldVal));
    }
  }

  public async setPartial<K extends keyof AppStorageSchema>(
    namespace: K,
    partial: Partial<AppStorageSchema[K]>
  ): Promise<void> {
    const current = await this.get(namespace);
    const updated = typeof current === 'object' && current !== null
      ? { ...current, ...partial }
      : partial;
    return this.set(namespace, updated as AppStorageSchema[K]);
  }

  public async setMultiple(partial: Partial<AppStorageSchema>): Promise<void> {
    for (const [key, val] of Object.entries(partial)) {
      if (val !== undefined) {
        await this.set(key as keyof AppStorageSchema, val as never);
      }
    }
  }

  public async reset(): Promise<void> {
    if (typeof window === 'undefined') return;
    for (const key of Object.keys(DEFAULT_STORAGE_STATE)) {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    }
    await this.setMultiple(DEFAULT_STORAGE_STATE);
  }

  public subscribe<K extends keyof AppStorageSchema>(
    namespace: K,
    callback: (newValue: AppStorageSchema[K], oldValue?: AppStorageSchema[K]) => void
  ): () => void {
    if (!this.listeners.has(namespace)) {
      this.listeners.set(namespace, new Set());
    }
    const set = this.listeners.get(namespace)!;
    set.add(callback as (newVal: unknown, oldVal?: unknown) => void);

    return () => {
      set.delete(callback as (newVal: unknown, oldVal?: unknown) => void);
    };
  }
}

export const webStorage = WebStorageAdapter.getInstance();
