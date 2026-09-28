/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Gerenciador singleton do Web AudioContext para o Web Studio.
 */

export class AudioContextManager {
  private static instance: AudioContextManager;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  public static getInstance(): AudioContextManager {
    if (!AudioContextManager.instance) {
      AudioContextManager.instance = new AudioContextManager();
    }
    return AudioContextManager.instance;
  }

  public getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx({ sampleRate: 24000 });
      this.masterGain = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(console.error);
    }
    return this.ctx;
  }

  public getMasterGain(): GainNode {
    this.getContext();
    return this.masterGain!;
  }

  public getAnalyser(): AnalyserNode {
    this.getContext();
    return this.analyser!;
  }

  public setMasterVolume(vol: number): void {
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, vol)), this.getContext().currentTime);
    }
  }
}

export const audioContextManager = AudioContextManager.getInstance();
