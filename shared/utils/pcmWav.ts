/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Funções matemáticas e binárias puras de processamento PCM e WAV.
 * 100% agnóstico de ambiente (Zero DOM, Zero AudioContext, Zero Node.js fs).
 */

import { AudioMetadata } from '../types/audio';

/**
 * Converte base64 string para Uint8Array de forma agnóstica e segura.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  // Limpeza de possíveis quebras de linha ou prefixos de data URI
  const cleanBase64 = base64.replace(/^data:audio\/[a-z0-9]+;base64,/, '').replace(/\s/g, '');
  
  // Suporte universal (Browser, Service Worker, Node)
  if (typeof atob === 'function') {
    const binaryString = atob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
  
  // Fallback para ambientes sem atob nativo
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }
  
  let bufferLength = cleanBase64.length * 0.75;
  if (cleanBase64[cleanBase64.length - 1] === '=') {
    bufferLength--;
    if (cleanBase64[cleanBase64.length - 2] === '=') {
      bufferLength--;
    }
  }

  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < cleanBase64.length; i += 4) {
    const encoded1 = lookup[cleanBase64.charCodeAt(i)];
    const encoded2 = lookup[cleanBase64.charCodeAt(i + 1)];
    const encoded3 = lookup[cleanBase64.charCodeAt(i + 2)];
    const encoded4 = lookup[cleanBase64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (encoded3 !== 64 && p < bufferLength) {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (encoded4 !== 64 && p < bufferLength) {
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
  }

  return bytes;
}

/**
 * Converte Uint8Array para base64 string de forma agnóstica.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';
  const byteLength = bytes.byteLength;
  const byteRemainder = byteLength % 3;
  const mainLength = byteLength - byteRemainder;

  let a: number, b: number, c: number, d: number;
  let chunk: number;

  for (let i = 0; i < mainLength; i += 3) {
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    a = (chunk & 16515072) >> 18;
    b = (chunk & 258048) >> 12;
    c = (chunk & 4032) >> 6;
    d = chunk & 63;
    base64 += chars[a] + chars[b] + chars[c] + chars[d];
  }

  if (byteRemainder === 1) {
    chunk = bytes[mainLength];
    a = (chunk & 252) >> 2;
    b = (chunk & 3) << 4;
    base64 += chars[a] + chars[b] + '==';
  } else if (byteRemainder === 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];
    a = (chunk & 64512) >> 10;
    b = (chunk & 1008) >> 4;
    c = (chunk & 15) << 2;
    base64 += chars[a] + chars[b] + chars[c] + '=';
  }

  return base64;
}

/**
 * Cria cabeçalho WAV de 44 bytes para dados PCM Linear 16-bit.
 */
export function createWavHeader(
  dataLength: number,
  sampleRate: number = 24000,
  numChannels: number = 1,
  bitDepth: number = 16
): Uint8Array {
  const header = new Uint8Array(44);
  const view = new DataView(header.buffer);

  const byteRate = (sampleRate * numChannels * bitDepth) / 8;
  const blockAlign = (numChannels * bitDepth) / 8;

  // "RIFF" chunk
  header[0] = 0x52; // R
  header[1] = 0x49; // I
  header[2] = 0x46; // F
  header[3] = 0x46; // F
  view.setUint32(4, 36 + dataLength, true); // chunkSize

  // "WAVE" format
  header[8] = 0x57;  // W
  header[9] = 0x41;  // A
  header[10] = 0x56; // V
  header[11] = 0x45; // E

  // "fmt " sub-chunk
  header[12] = 0x66; // f
  header[13] = 0x6d; // m
  header[14] = 0x74; // t
  header[15] = 0x20; // " "
  view.setUint32(16, 16, true);             // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);              // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);    // NumChannels
  view.setUint32(24, sampleRate, true);     // SampleRate
  view.setUint32(28, byteRate, true);       // ByteRate
  view.setUint16(32, blockAlign, true);     // BlockAlign
  view.setUint16(34, bitDepth, true);       // BitsPerSample

  // "data" sub-chunk
  header[36] = 0x64; // d
  header[37] = 0x61; // a
  header[38] = 0x74; // t
  header[39] = 0x61; // a
  view.setUint32(40, dataLength, true);     // Subchunk2Size

  return header;
}

/**
 * Converte dados brutos PCM 16-bit para container WAV completo.
 */
export function pcmToWav(
  pcmData: Uint8Array,
  sampleRate: number = 24000,
  numChannels: number = 1,
  bitDepth: number = 16
): Uint8Array {
  const header = createWavHeader(pcmData.byteLength, sampleRate, numChannels, bitDepth);
  const wavBytes = new Uint8Array(header.byteLength + pcmData.byteLength);
  wavBytes.set(header, 0);
  wavBytes.set(pcmData, header.byteLength);
  return wavBytes;
}

/**
 * Extrai dados PCM puros de um container WAV válido.
 */
export function wavToPcm(wavBytes: Uint8Array): {
  pcmData: Uint8Array;
  metadata: AudioMetadata;
} {
  const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);
  
  // Validar "RIFF" e "WAVE"
  const isRiff = wavBytes[0] === 0x52 && wavBytes[1] === 0x49 && wavBytes[2] === 0x46 && wavBytes[3] === 0x46;
  const isWave = wavBytes[8] === 0x57 && wavBytes[9] === 0x41 && wavBytes[10] === 0x56 && wavBytes[11] === 0x45;
  
  if (!isRiff || !isWave) {
    throw new Error('Arquivo fornecido não é um container WAV válido.');
  }

  let offset = 12;
  let sampleRate = 24000;
  let numChannels = 1;
  let bitDepth = 16;
  let pcmData = new Uint8Array(0);

  while (offset < wavBytes.byteLength - 8) {
    const chunkId = String.fromCharCode(
      wavBytes[offset],
      wavBytes[offset + 1],
      wavBytes[offset + 2],
      wavBytes[offset + 3]
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      numChannels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitDepth = view.getUint16(offset + 22, true);
    } else if (chunkId === 'data') {
      pcmData = wavBytes.slice(offset + 8, offset + 8 + chunkSize);
      break;
    }

    offset += 8 + chunkSize;
  }

  const durationMs = calculatePcmDurationMs(pcmData.byteLength, sampleRate, numChannels, bitDepth);

  return {
    pcmData,
    metadata: {
      sampleRate,
      channels: numChannels,
      bitDepth,
      byteLength: pcmData.byteLength,
      durationMs,
    },
  };
}

/**
 * Calcula a duração aproximada em ms a partir do tamanho dos bytes PCM.
 */
export function calculatePcmDurationMs(
  byteLength: number,
  sampleRate: number,
  numChannels: number = 1,
  bitDepth: number = 16
): number {
  const bytesPerSample = (bitDepth / 8) * numChannels;
  if (bytesPerSample === 0 || sampleRate === 0) return 0;
  const totalSamples = byteLength / bytesPerSample;
  return Math.round((totalSamples / sampleRate) * 1000);
}
