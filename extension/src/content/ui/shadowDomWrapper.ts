/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Shadow DOM Wrapper para isolamento estrito de estilos do HUD flutuante.
 */

export class ShadowDomWrapper {
  private static instance: ShadowDomWrapper;
  private hostElement: HTMLElement;
  private shadowRoot: ShadowRoot;

  private constructor() {
    let host = document.getElementById('ext-tts-stt-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'ext-tts-stt-host';
      document.documentElement.appendChild(host);
    }
    this.hostElement = host;
    this.shadowRoot = host.shadowRoot || host.attachShadow({ mode: 'open' });
  }

  public static getInstance(): ShadowDomWrapper {
    if (!ShadowDomWrapper.instance) {
      ShadowDomWrapper.instance = new ShadowDomWrapper();
    }
    return ShadowDomWrapper.instance;
  }

  public getRoot(): ShadowRoot {
    return this.shadowRoot;
  }

  public injectStyles(cssText: string): void {
    const style = document.createElement('style');
    style.textContent = cssText;
    this.shadowRoot.appendChild(style);
  }
}

export const shadowDom = ShadowDomWrapper.getInstance();
