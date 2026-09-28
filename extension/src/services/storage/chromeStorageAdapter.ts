/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Implementação de IStorageService sobre chrome.storage.local.
 * Garante que a extensão consuma estritamente o AppStorageSchema unificado.
 */

import { AppStorageSchema, IStorageService } from '@shared/types/storage';
import { DEFAULT_STORAGE_STATE, migrateLegacyStorage } from '@shared/constants/defaultSettings';

export class ChromeStorageAdapter implements IStorageService {
  private static instance: ChromeStorageAdapter;

  public static getInstance(): ChromeStorageAdapter {
    if (!ChromeStorageAdapter.instance) {
      ChromeStorageAdapter.instance = new ChromeStorageAdapter();
    }
    return ChromeStorageAdapter.instance;
  }

  public async get<K extends keyof AppStorageSchema>(namespace: K): Promise<AppStorageSchema[K]> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([namespace], (result) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        if (result && result[namespace] !== undefined && result[namespace] !== null) {
          resolve(result[namespace] as AppStorageSchema[K]);
        } else {
          // Fallback para valor padrão do schema
          resolve(DEFAULT_STORAGE_STATE[namespace]);
        }
      });
    });
  }

  public async getAll(): Promise<AppStorageSchema> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(null, (result) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        const state = migrateLegacyStorage(result || {});
        resolve(state);
      });
    });
  }

  public async set<K extends keyof AppStorageSchema>(
    namespace: K,
    value: AppStorageSchema[K]
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [namespace]: value }, () => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        resolve();
      });
    });
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
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(partial, () => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        resolve();
      });
    });
  }

  public async reset(): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        chrome.storage.local.set(DEFAULT_STORAGE_STATE, () => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve();
        });
      });
    });
  }

  public subscribe<K extends keyof AppStorageSchema>(
    namespace: K,
    callback: (newValue: AppStorageSchema[K], oldValue?: AppStorageSchema[K]) => void
  ): () => void {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes[namespace]) {
        callback(
          changes[namespace].newValue as AppStorageSchema[K],
          changes[namespace].oldValue as AppStorageSchema[K]
        );
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }
}

export const chromeStorage = ChromeStorageAdapter.getInstance();
