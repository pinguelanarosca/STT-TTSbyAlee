/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Controlador de Speech-to-Text (STT) no Content Script.
 * - Fila FIFO real de transcrição: novos pedidos não cancelam os anteriores.
 * - Normalização estrita de mimeType para 'audio/webm' (sem ;codecs=opus) evitando HTTP 400.
 * - Injeção segura no campo de texto ativo.
 */

import { hud } from '../ui/hudController';
import { injectTranscribedText } from '../dom/inputInjector';

interface SttTask {
  id: number;
  blob: Blob;
  mimeType: string;
  agentId?: string;
  targetElement: Element | null;
}

export class SttController {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private targetElement: Element | null = null;
  private activeStream: MediaStream | null = null;

  // Fila FIFO de transcrições
  private queue: SttTask[] = [];
  private isProcessingStt = false;
  private nextTaskId = 1;

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
      this.activeStream = stream;
      this.audioChunks = [];

      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      this.mediaRecorder = new MediaRecorder(stream, { mimeType: preferredMime });

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
    const recorder = this.mediaRecorder;
    const stream = this.activeStream;
    const target = this.targetElement;

    recorder.onstop = async () => {
      // Fecha todas as trilhas do microfone
      stream?.getTracks().forEach((track) => track.stop());
      this.activeStream = null;

      const rawMime = recorder.mimeType || 'audio/webm';
      // Normaliza para 'audio/webm' removendo ;codecs=opus para evitar HTTP 400
      const normalizedMime = rawMime.split(';')[0].trim() || 'audio/webm';
      const blob = new Blob(this.audioChunks, { type: normalizedMime });

      const task: SttTask = {
        id: this.nextTaskId++,
        blob,
        mimeType: normalizedMime,
        agentId,
        targetElement: target,
      };

      this.queue.push(task);
      this.audioChunks = [];

      if (!this.isProcessingStt) {
        this.processNextInQueue();
      }
    };

    recorder.stop();
  }

  public cancelRecording(): void {
    if (this.isRecording && this.mediaRecorder) {
      this.isRecording = false;
      try {
        this.mediaRecorder.stop();
      } catch {}
      this.activeStream?.getTracks().forEach((track) => track.stop());
      this.activeStream = null;
      this.audioChunks = [];
    }
    this.queue = [];
    this.isProcessingStt = false;
  }

  private async processNextInQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.isProcessingStt = false;
      return;
    }

    this.isProcessingStt = true;
    const task = this.queue[0];

    hud.setStatus('loading', 'Transcrevendo');
    hud.setTextPreview(`Processando áudio (${task.blob.size} bytes)...`);

    try {
      const base64 = await this.blobToBase64(task.blob);

      chrome.runtime.sendMessage(
        {
          type: 'STT_TRANSCRIBE_REQUEST',
          payload: {
            audioBase64: base64,
            mimeType: task.mimeType,
            agentId: task.agentId,
          },
        },
        (response) => {
          if (!response || !response.success || !response.data?.text) {
            const err = response?.error || 'Erro na transcrição';
            console.error('[STT Controller]', err);
            hud.setStatus('idle', 'Falha no STT');
            hud.setTextPreview(`❌ Erro: ${err}`);
          } else {
            const transcribed = response.data.text;
            hud.setStatus('idle', 'Pronto');
            hud.setTextPreview(`Ditado: "${transcribed}"`);

            // Tenta injetar no campo ativo preservado da tarefa
            injectTranscribedText(transcribed, undefined, task.targetElement);
          }

          // Avança na fila FIFO independentemente de sucesso ou falha
          this.queue.shift();
          this.processNextInQueue();
        }
      );
    } catch (err) {
      console.error('[STT Controller] Erro ao processar item da fila STT:', err);
      hud.setStatus('idle', 'Erro no STT');
      this.queue.shift();
      this.processNextInQueue();
    }
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
