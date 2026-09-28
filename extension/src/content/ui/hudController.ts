/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Controlador de Ciclo de Vida do HUD flutuante no Shadow DOM.
 */

import { shadowDom } from './shadowDomWrapper';

export class HudController {
  private static instance: HudController;
  private container: HTMLElement | null = null;
  private badgeElement: HTMLElement | null = null;
  private previewElement: HTMLElement | null = null;
  private playPauseBtn: HTMLElement | null = null;
  private volumeSlider: HTMLInputElement | null = null;
  private speedSlider: HTMLInputElement | null = null;

  public onPlayPauseClick?: () => void;
  public onStopClick?: () => void;
  public onCloseClick?: () => void;
  public onRecordClick?: () => void;
  public onVolumeChange?: (vol: number) => void;
  public onSpeedChange?: (speed: number) => void;

  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private posX = 24;
  private posY = 24;

  public static getInstance(): HudController {
    if (!HudController.instance) {
      HudController.instance = new HudController();
    }
    return HudController.instance;
  }

  public init(cssContent: string): void {
    if (this.container) return;

    shadowDom.injectStyles(cssContent);
    const root = shadowDom.getRoot();

    const wrapper = document.createElement('div');
    wrapper.className = 'ext-hud-card hidden';
    wrapper.style.right = `${this.posX}px`;
    wrapper.style.bottom = `${this.posY}px`;

    wrapper.innerHTML = `
      <div class="ext-hud-header" id="ext-drag-handle">
        <div class="ext-hud-title">
          <span>⚡ Gemini Assistant</span>
          <span class="ext-hud-badge idle" id="ext-badge">Pronto</span>
        </div>
        <div class="ext-hud-controls">
          <button class="ext-btn-icon" id="ext-btn-min" title="Ocultar">−</button>
          <button class="ext-btn-icon" id="ext-btn-close" title="Fechar">✕</button>
        </div>
      </div>
      <div class="ext-hud-body">
        <div class="ext-hud-text-preview" id="ext-preview">Nenhum texto selecionado. Selecione algo e use Ctrl+B.</div>
        <div class="ext-hud-actions">
          <button class="ext-btn-primary" id="ext-btn-play">
            <span id="ext-play-label">▶ Ouvir</span>
          </button>
          <button class="ext-btn-secondary" id="ext-btn-mic">
            <span>🎙 Ditar (Ctrl+Shift+Espaço)</span>
          </button>
          <button class="ext-btn-secondary" id="ext-btn-stop" title="Parar reprodução">■</button>
        </div>
        <div class="ext-hud-sliders">
          <span>Vol:</span>
          <input type="range" id="ext-vol" min="0" max="1" step="0.05" value="1.0" />
          <span>Vel:</span>
          <input type="range" id="ext-speed" min="0.5" max="2.0" step="0.1" value="1.0" />
        </div>
      </div>
    `;

    root.appendChild(wrapper);
    this.container = wrapper;

    this.badgeElement = wrapper.querySelector('#ext-badge');
    this.previewElement = wrapper.querySelector('#ext-preview');
    this.playPauseBtn = wrapper.querySelector('#ext-btn-play');
    this.volumeSlider = wrapper.querySelector('#ext-vol');
    this.speedSlider = wrapper.querySelector('#ext-speed');

    this.setupListeners(wrapper);
  }

  private setupListeners(wrapper: HTMLElement): void {
    const handle = wrapper.querySelector('#ext-drag-handle') as HTMLElement;
    const closeBtn = wrapper.querySelector('#ext-btn-close');
    const minBtn = wrapper.querySelector('#ext-btn-min');
    const micBtn = wrapper.querySelector('#ext-btn-mic');
    const stopBtn = wrapper.querySelector('#ext-btn-stop');

    closeBtn?.addEventListener('click', () => {
      this.hide();
      this.onCloseClick?.();
    });

    minBtn?.addEventListener('click', () => this.hide());

    this.playPauseBtn?.addEventListener('click', () => this.onPlayPauseClick?.());
    micBtn?.addEventListener('click', () => this.onRecordClick?.());
    stopBtn?.addEventListener('click', () => this.onStopClick?.());

    this.volumeSlider?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.onVolumeChange?.(val);
    });

    this.speedSlider?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.onSpeedChange?.(val);
    });

    // Suporte a arrastar (Drag and drop)
    handle?.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      const rect = wrapper.getBoundingClientRect();
      this.posX = window.innerWidth - rect.right;
      this.posY = window.innerHeight - rect.bottom;

      const onMouseMove = (ev: MouseEvent) => {
        if (!this.isDragging) return;
        const dx = ev.clientX - this.dragStartX;
        const dy = ev.clientY - this.dragStartY;
        wrapper.style.right = `${Math.max(10, this.posX - dx)}px`;
        wrapper.style.bottom = `${Math.max(10, this.posY - dy)}px`;
      };

      const onMouseUp = (ev: MouseEvent) => {
        this.isDragging = false;
        const dx = ev.clientX - this.dragStartX;
        const dy = ev.clientY - this.dragStartY;
        this.posX = Math.max(10, this.posX - dx);
        this.posY = Math.max(10, this.posY - dy);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  public setStatus(badge: 'idle' | 'playing' | 'recording' | 'loading', label: string): void {
    if (this.badgeElement) {
      this.badgeElement.className = `ext-hud-badge ${badge}`;
      this.badgeElement.textContent = label;
    }
  }

  public setTextPreview(text: string): void {
    if (this.previewElement) {
      this.previewElement.textContent = text || 'Nenhum texto selecionado.';
    }
  }

  public setPlayingState(isPlaying: boolean): void {
    const label = this.container?.querySelector('#ext-play-label');
    if (label) {
      label.textContent = isPlaying ? '⏸ Pausar' : '▶ Ouvir';
    }
    if (isPlaying) {
      this.setStatus('playing', 'Lendo');
    } else {
      this.setStatus('idle', 'Pausado');
    }
  }

  public show(): void {
    this.container?.classList.remove('hidden');
  }

  public hide(): void {
    this.container?.classList.add('hidden');
  }

  public toggle(): void {
    if (this.container?.classList.contains('hidden')) {
      this.show();
    } else {
      this.hide();
    }
  }
}

export const hud = HudController.getInstance();
