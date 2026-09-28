/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Controlador do Gemini Lens / Inspeção Visual no Content Script.
 * Captura seleção retangular (Ctrl+Shift+Arrastar), calcula coordenadas em pixels
 * e despacha análise visual com retorno detalhado no HUD.
 */

import { hud } from '../ui/hudController';
import { shadowDom } from '../ui/shadowDomWrapper';

export class LensController {
  private isSelecting = false;
  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private currentY = 0;
  private overlayElement: HTMLElement | null = null;
  private boxElement: HTMLElement | null = null;

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

    const box = document.createElement('div');
    box.className = 'ext-lens-box';
    box.style.left = `${this.startX}px`;
    box.style.top = `${this.startY}px`;
    box.style.width = '0px';
    box.style.height = '0px';
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

    chrome.runtime.sendMessage(
      {
        type: 'LENS_ANALYZE_REQUEST',
        payload: {
          instruction: 'Descreva detalhadamente o conteúdo, layout e textos visíveis nesta área selecionada da página.',
          rect,
        },
      },
      (response) => {
        if (!response || !response.success || !response.data) {
          const err = response?.error || 'Falha na análise visual';
          hud.setStatus('idle', 'Erro Lens');
          hud.setTextPreview(`❌ Erro no Lens: ${err}`);
          return;
        }

        hud.setStatus('idle', 'Concluído');
        hud.setTextPreview(response.data);
      }
    );
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
