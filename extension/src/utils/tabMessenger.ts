/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Utilitário seguro para comunicação com Content Scripts em abas do Chrome.
 * - Evita o erro 'Receiving end does not exist'
 * - Injeta o Content Script dinamicamente se a aba foi aberta antes do carregamento da extensão
 * - Ignora páginas de sistema protegidas (chrome://, edge://, about:)
 */

export interface TabSendResult {
  success: boolean;
  error?: string;
  restricted?: boolean;
}

export function isRestrictedUrl(url?: string): boolean {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('view-source:') ||
    url.startsWith('chrome-untrusted://') ||
    url.startsWith('https://chrome.google.com/webstore') ||
    url.startsWith('https://chromewebstore.google.com')
  );
}

export async function sendTabMessageSafe(
  tabId: number,
  tabUrl: string | undefined,
  message: Record<string, unknown>
): Promise<TabSendResult> {
  if (isRestrictedUrl(tabUrl)) {
    return {
      success: false,
      restricted: true,
      error: 'Páginas internas do navegador (chrome://, about:) são protegidas e não permitem scripts de extensão.',
    };
  }

  try {
    const res = await chrome.tabs.sendMessage(tabId, message);
    return { success: true, ...res };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Se o content script ainda não foi injetado (ex: aba aberta antes da extensão carregar)
    if (
      errorMsg.includes('Receiving end does not exist') ||
      errorMsg.includes('Could not establish connection')
    ) {
      try {
        // Injeta CSS e Script programaticamente
        await chrome.scripting.insertCSS({
          target: { tabId },
          files: ['content.css'],
        }).catch(() => {});

        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js'],
        });

        // Aguarda inicialização do DOM e retenta envio
        await new Promise((resolve) => setTimeout(resolve, 150));
        const retryRes = await chrome.tabs.sendMessage(tabId, message);
        return { success: true, ...retryRes };
      } catch (injectErr) {
        return {
          success: false,
          error: 'Recarregue a página (F5) para habilitar o assistente nesta aba.',
        };
      }
    }

    return { success: false, error: errorMsg };
  }
}
