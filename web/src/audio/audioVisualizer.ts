/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Renderizador de Visualização de Áudio de Alta Performance (Osciloscópio / Barras).
 * Otimizado para Zero Alocação de Objetos por Frame e Zero GC Thrashing.
 */

export class AudioVisualizer {
  private animationId: number | null = null;
  private activeCanvases: Set<HTMLCanvasElement> = new Set();
  private gradientCache = new WeakMap<CanvasRenderingContext2D, { height: number; gradient: CanvasGradient }>();
  private readonly bufferLength = 32;
  private dataArray = new Uint8Array(this.bufferLength);

  /**
   * Inicia a renderização de barras de áudio para um ou mais canvases em um único loop coordenado.
   */
  public startBars(canvases: HTMLCanvasElement | HTMLCanvasElement[], analyser?: AnalyserNode): void {
    const list = Array.isArray(canvases) ? canvases : [canvases];
    for (const c of list) {
      if (c) this.activeCanvases.add(c);
    }

    if (this.activeCanvases.size === 0) return;

    // Se o loop já estiver rodando, não duplica requestAnimationFrame
    if (this.animationId !== null) return;

    const render = (timestamp: number) => {
      if (this.activeCanvases.size === 0) {
        this.animationId = null;
        return;
      }

      this.animationId = requestAnimationFrame(render);

      // Preenche dados de áudio
      if (analyser) {
        analyser.getByteFrequencyData(this.dataArray);
      } else {
        // Oscilação harmônica contínua e suave baseada em tempo (Zero Math.random)
        const t = timestamp * 0.005;
        for (let i = 0; i < this.bufferLength; i++) {
          const wave1 = Math.sin(t + i * 0.35);
          const wave2 = Math.cos(t * 0.7 + i * 0.2);
          const norm = (wave1 * 0.5 + wave2 * 0.5 + 1) * 0.5; // 0..1
          this.dataArray[i] = Math.floor(norm * 140) + 30; // 30..170
        }
      }

      // Renderiza em cada canvas registrado
      for (const canvas of this.activeCanvases) {
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        const width = canvas.width;
        const height = canvas.height;
        if (width === 0 || height === 0) continue;

        ctx.clearRect(0, 0, width, height);

        // Reutiliza ou atualiza o gradiente em cache (Zero alocação por barra)
        let cached = this.gradientCache.get(ctx);
        if (!cached || cached.height !== height) {
          const grad = ctx.createLinearGradient(0, height, 0, 0);
          grad.addColorStop(0, '#3b82f6');
          grad.addColorStop(1, '#60a5fa');
          cached = { height, gradient: grad };
          this.gradientCache.set(ctx, cached);
        }

        ctx.fillStyle = cached.gradient;

        const barWidth = (width / this.bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < this.bufferLength; i++) {
          const barHeight = (this.dataArray[i] / 255) * height;
          ctx.fillRect(x, height - barHeight, Math.max(1, barWidth - 2), barHeight);
          x += barWidth;
        }
      }
    };

    this.animationId = requestAnimationFrame(render);
  }

  /**
   * Adiciona um canvas adicional ao loop ativo sem interromper a animação.
   */
  public addCanvas(canvas: HTMLCanvasElement | null): void {
    if (canvas && !this.activeCanvases.has(canvas)) {
      this.activeCanvases.add(canvas);
      if (this.animationId === null) {
        this.startBars(canvas);
      }
    }
  }

  /**
   * Remove um canvas específico do loop.
   */
  public removeCanvas(canvas: HTMLCanvasElement | null): void {
    if (canvas) {
      this.activeCanvases.delete(canvas);
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (this.activeCanvases.size === 0) {
      this.stop();
    }
  }

  /**
   * Para completamente o loop de animação e limpa todos os canvases ativos.
   */
  public stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    for (const canvas of this.activeCanvases) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    this.activeCanvases.clear();
  }
}

export const audioVisualizer = new AudioVisualizer();
