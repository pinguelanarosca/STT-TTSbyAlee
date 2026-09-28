/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Controlador do Gemini Lens / Inspeção Visual no Content Script.
 * Captura seleção retangular (Ctrl+Shift+Arrastar ou atalho/HUD), calcula coordenadas em pixels,
 * extrai o texto visível da região e O NARRA AUTOMATICAMENTE via TTS.
 */

import { hud } from '../ui/hudController';
import { tts } from './ttsController';
import { shadowDom } from '../ui/shadowDomWrapper';

export class LensController {
  private isSelecting = false;
  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private currentY = 0;
  private overlayElement: HTMLElement | null = null;
  private boxElement: HTMLElement | null = null;

  /**
   * Ativa o modo de seleção Gemini Lens por atalho de teclado ou botão do HUD/Popup.
   * Exibe aviso no topo da tela e aguarda o clique e arraste do usuário.
   */
  public activateLensMode(): void {
    if (this.isSelecting) return;
    this.isSelecting = true;

    const root = shadowDom.getRoot();
    const overlay = document.createElement('div');
    overlay.className = 'ext-lens-overlay';
    overlay.style.cssText = 'position: fixed; inset: 0; z-index: 2147483646; cursor: crosshair; background: rgba(15, 23, 42, 0.25);';

    const banner = document.createElement('div');
    banner.innerText = '🔍 Gemini Lens: Clique e arraste para selecionar uma área na página (Esc para cancelar)';
    banner.style.cssText = `
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      border: 1px solid #38bdf8;
      color: #38bdf8;
      padding: 10px 22px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      z-index: 2147483647;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      pointer-events: none;
      font-family: system-ui, sans-serif;
    `;
    overlay.appendChild(banner);

    root.appendChild(overlay);
    this.overlayElement = overlay;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.removeEventListener('keydown', onKeyDown);
        this.cleanup();
      }
    };

    const onMouseDown = (ev: MouseEvent) => {
      ev.preventDefault();
      overlay.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);

      this.startX = ev.clientX;
      this.startY = ev.clientY;
      this.currentX = ev.clientX;
      this.currentY = ev.clientY;

      const box = document.createElement('div');
      box.className = 'ext-lens-box';
      box.style.position = 'fixed';
      box.style.border = '2px dashed #38bdf8';
      box.style.background = 'rgba(56, 189, 248, 0.15)';
      box.style.left = `${this.startX}px`;
      box.style.top = `${this.startY}px`;
      box.style.width = '0px';
      box.style.height = '0px';
      box.style.zIndex = '2147483647';
      overlay.appendChild(box);
      this.boxElement = box;

      const onMouseMove = (moveEv: MouseEvent) => {
        this.currentX = moveEv.clientX;
        this.currentY = moveEv.clientY;
        this.updateBoxCoordinates();
      };

      const onMouseUp = (upEv: MouseEvent) => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        this.currentX = upEv.clientX;
        this.currentY = upEv.clientY;

        const left = Math.min(this.startX, this.currentX);
        const top = Math.min(this.startY, this.currentY);
        const width = Math.abs(this.currentX - this.startX);
        const height = Math.abs(this.currentY - this.startY);

        if (width > 15 && height > 15) {
          this.submitSelection({
            x: left,
            y: top,
            width,
            height,
            devicePixelRatio: window.devicePixelRatio || 1,
          });
        } else {
          this.cleanup();
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    overlay.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
  }

  /**
   * Inicia a seleção imediatamente quando acionada por Ctrl+Shift+Mousedown (arraste direto).
   */
  public startDragSelection(clientX: number, clientY: number): void {
    if (this.isSelecting) return;
    this.isSelecting = true;
    this.startX = clientX;
    this.startY = clientY;
    this.currentX = clientX;
    this.currentY = clientY;

    const root = shadowDom.getRoot();
    const overlay = document.createElement('div');
    overlay.className = 'ext-lens-overlay';
    overlay.style.cssText = 'position: fixed; inset: 0; z-index: 2147483646; cursor: crosshair; background: rgba(15, 23, 42, 0.25);';

    const box = document.createElement('div');
    box.className = 'ext-lens-box';
    box.style.position = 'fixed';
    box.style.border = '2px dashed #38bdf8';
    box.style.background = 'rgba(56, 189, 248, 0.15)';
    box.style.left = `${this.startX}px`;
    box.style.top = `${this.startY}px`;
    box.style.width = '0px';
    box.style.height = '0px';
    box.style.zIndex = '2147483647';
    overlay.appendChild(box);

    root.appendChild(overlay);
    this.overlayElement = overlay;
    this.boxElement = box;

    const onMouseMove = (ev: MouseEvent) => {
      this.currentX = ev.clientX;
      this.currentY = ev.clientY;
      this.updateBoxCoordinates();
    };

    const onMouseUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      this.currentX = ev.clientX;
      this.currentY = ev.clientY;

      const left = Math.min(this.startX, this.currentX);
      const top = Math.min(this.startY, this.currentY);
      const width = Math.abs(this.currentX - this.startX);
      const height = Math.abs(this.currentY - this.startY);

      if (width > 15 && height > 15) {
        this.submitSelection({
          x: left,
          y: top,
          width,
          height,
          devicePixelRatio: window.devicePixelRatio || 1,
        });
      } else {
        this.cleanup();
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  private updateBoxCoordinates(): void {
    if (!this.boxElement) return;
    const left = Math.min(this.startX, this.currentX);
    const top = Math.min(this.startY, this.currentY);
    const width = Math.abs(this.currentX - this.startX);
    const height = Math.abs(this.currentY - this.startY);

    this.boxElement.style.left = `${left}px`;
    this.boxElement.style.top = `${top}px`;
    this.boxElement.style.width = `${width}px`;
    this.boxElement.style.height = `${height}px`;
  }

  private submitSelection(rect: { x: number; y: number; width: number; height: number; devicePixelRatio: number }): void {
    this.cleanup();
    hud.show();
    hud.setStatus('loading', 'Analisando tela');
    hud.setTextPreview('Inspecionando a área selecionada com Gemini Vision...');

    try {
      chrome.runtime.sendMessage(
        {
          type: 'LENS_ANALYZE_REQUEST',
          payload: {
            instruction: 'Extraia e transcreva com exatidão todo o texto visível nesta área selecionada da página. Retorne unicamente o texto extraído, limpo, sem introduções ou observações, pronto para ser lido.',
            rect,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            const err = chrome.runtime.lastError.message || 'Erro de conexão com a extensão';
            console.error('[Lens Controller] Erro runtime:', err);
            hud.setStatus('idle', 'Erro Lens');
            hud.setTextPreview(`❌ Erro no Lens: ${err}`);
            return;
          }

          if (!response || !response.success || !response.data) {
            const err = response?.error || 'Falha na análise visual do Gemini';
            console.error('[Lens Controller] Erro de resposta:', err);
            hud.setStatus('idle', 'Erro Lens');
            hud.setTextPreview(`❌ Erro no Lens: ${err}`);
            return;
          }

          const extractedText = String(response.data).trim();
          hud.setStatus('idle', 'Texto Extraído');
          hud.setTextPreview(extractedText || 'Nenhum texto visível detectado na região.');

          // Narrar AUTOMATICAMENTE o texto extraído da região selecionada!
          if (extractedText && !extractedText.startsWith('❌')) {
            tts.speakText(extractedText);
          }
        }
      );
    } catch (err: any) {
      console.error('[Lens Controller] Exceção ao enviar Lens request:', err);
      hud.setStatus('idle', 'Erro Lens');
      hud.setTextPreview(`❌ Exceção no Lens: ${err?.message || String(err)}`);
    }
  }

  private cleanup(): void {
    this.isSelecting = false;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
      this.boxElement = null;
    }
  }
}

export const lens = new LensController();
