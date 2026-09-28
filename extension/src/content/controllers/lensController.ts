/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Controlador do Gemini Lens / Inspeção Visual no Content Script.
 * Dá suporte ao atalho Ctrl+Shift+Arrastar para seleção retangular na tela.
 */

import { hud } from '../ui/hudController';
import { shadowDom } from '../ui/shadowDomWrapper';

export class LensController {
  private isSelecting = false;
  private startX = 0;
  private startY = 0;
  private overlayElement: HTMLElement | null = null;
  private boxElement: HTMLElement | null = null;

  public startDragSelection(clientX: number, clientY: number): void {
    if (this.isSelecting) return;
    this.isSelecting = true;
    this.startX = clientX;
    this.startY = clientY;

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
      this.onMouseMove(ev);
    };

    const onMouseUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      const width = Math.abs(ev.clientX - this.startX);
      const height = Math.abs(ev.clientY - this.startY);
      if (width > 20 && height > 20) {
        this.onMouseUp();
      } else {
        this.cleanup();
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  public startSelection(): void {
    if (this.isSelecting) return;
    this.isSelecting = true;

    const root = shadowDom.getRoot();
    const overlay = document.createElement('div');
    overlay.className = 'ext-lens-overlay';

    const box = document.createElement('div');
    box.className = 'ext-lens-box';
    overlay.appendChild(box);

    root.appendChild(overlay);
    this.overlayElement = overlay;
    this.boxElement = box;

    overlay.addEventListener('mousedown', (e) => this.onMouseDown(e));
    overlay.addEventListener('mousemove', (e) => this.onMouseMove(e));
    overlay.addEventListener('mouseup', () => this.onMouseUp());
  }

  private onMouseDown(e: MouseEvent): void {
    this.startX = e.clientX;
    this.startY = e.clientY;
    if (this.boxElement) {
      this.boxElement.style.left = `${this.startX}px`;
      this.boxElement.style.top = `${this.startY}px`;
      this.boxElement.style.width = '0px';
      this.boxElement.style.height = '0px';
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.boxElement || this.startX === 0) return;
    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(this.startX, currentX);
    const top = Math.min(this.startY, currentY);
    const width = Math.abs(currentX - this.startX);
    const height = Math.abs(currentY - this.startY);

    this.boxElement.style.left = `${left}px`;
    this.boxElement.style.top = `${top}px`;
    this.boxElement.style.width = `${width}px`;
    this.boxElement.style.height = `${height}px`;
  }

  private onMouseUp(): void {
    this.cleanup();
    hud.show();
    hud.setStatus('loading', 'Analisando tela');
    hud.setTextPreview('Inspecionando a área selecionada com Gemini Vision...');

    chrome.runtime.sendMessage(
      {
        type: 'LENS_ANALYZE_REQUEST',
        payload: {
          instruction: 'Descreva detalhadamente o conteúdo, layout e elementos desta área da página.',
        },
      },
      (response) => {
        if (!response || !response.success) {
          hud.setStatus('idle', 'Erro Lens');
          hud.setTextPreview('Falha ao processar captura visual.');
          return;
        }
        hud.setStatus('idle', 'Concluído');
        hud.setTextPreview(response.data || 'Nenhum texto detectado.');
      }
    );
  }

  private cleanup(): void {
    this.isSelecting = false;
    this.startX = 0;
    this.startY = 0;
    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
      this.boxElement = null;
    }
  }
}

export const lens = new LensController();
