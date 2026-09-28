/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Controlador de Speech-to-Text (STT) no Content Script.
 * Captura áudio do microfone, converte para payload binário e coordena transcrição.
 */

import { hud } from '../ui/hudController';
import { injectTranscribedText } from '../dom/inputInjector';

export class SttController {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private targetElement: Element | null = null;

  public async toggleRecording(agentId?: string): Promise<void> {
    if (this.isRecording) {
      this.stopRecording(agentId);
    } else {
      await this.startRecording();
    }
  }

  public async startRecording(): Promise<void> {
    try {
      this.targetElement = document.activeElement;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      this.mediaRecorder = new MediaRecorder(stream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(250); // Coleta a cada 250ms
      this.isRecording = true;

      hud.show();
      hud.setStatus('recording', 'Gravando...');
      hud.setTextPreview('Fale no microfone. Pressione Ctrl+Shift+Espaço para concluir.');
    } catch (err) {
      console.error('[STT Controller] Falha ao acessar microfone:', err);
      hud.setStatus('idle', 'Permissão negada');
      this.isRecording = false;
    }
  }

  public stopRecording(agentId?: string): void {
    if (!this.mediaRecorder || !this.isRecording) return;

    this.isRecording = false;
    hud.setStatus('loading', 'Transcrevendo');

    this.mediaRecorder.onstop = async () => {
      // Fecha todas as trilhas do microfone
      this.mediaRecorder?.stream.getTracks().forEach((track) => track.stop());

      const blob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
      const base64 = await this.blobToBase64(blob);

      chrome.runtime.sendMessage(
        {
          type: 'STT_TRANSCRIBE_REQUEST',
          payload: {
            audioBase64: base64,
            mimeType: blob.type,
            agentId,
          },
        },
        (response) => {
          if (!response || !response.success || !response.data?.text) {
            const err = response?.error || 'Erro na transcrição';
            hud.setStatus('idle', 'Falha no STT');
            hud.setTextPreview(`Erro: ${err}`);
            return;
          }

          const transcribed = response.data.text;
          hud.setStatus('idle', 'Pronto');
          hud.setTextPreview(`Ditado: "${transcribed}"`);

          // Tenta injetar no campo ativo preservado
          injectTranscribedText(transcribed, undefined, this.targetElement);
        }
      );
    };

    this.mediaRecorder.stop();
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.replace(/^data:[a-z0-9/]+;base64,/, '');
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export const stt = new SttController();
