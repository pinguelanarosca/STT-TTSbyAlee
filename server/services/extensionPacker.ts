/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Serviço de Inspeção e Empacotamento da Extensão Chrome no Servidor.
 * Lê diretamente os artefatos reais compilados em dist/extension/
 * sem jamais reconstruir arquivos a partir de strings hardcoded.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT_DIR = process.cwd();
const DIST_EXT = path.resolve(ROOT_DIR, 'dist/extension');
const DIST_PACKAGE = path.resolve(ROOT_DIR, 'dist/package');
const ZIP_PATH = path.join(DIST_PACKAGE, 'extensao-extttsstt.zip');

export interface ExtensionFileInfo {
  name: string;
  relativePath: string;
  sizeBytes: number;
  isText: boolean;
  content?: string;
  modifiedAt: string;
}

export class ExtensionPackerService {
  /**
   * Garante que a extensão esteja compilada.
   */
  public ensureExtensionBuilt(): boolean {
    if (!fs.existsSync(DIST_EXT) || !fs.existsSync(path.join(DIST_EXT, 'manifest.json'))) {
      try {
        console.log('[Server] dist/extension ausente. Executando build da extensão...');
        execSync('npm run build:ext', { cwd: ROOT_DIR, stdio: 'inherit' });
      } catch (err) {
        console.error('[Server] Falha ao rodar build:ext:', err);
        return false;
      }
    }
    return true;
  }

  /**
   * Retorna metadados e conteúdo dos arquivos da extensão para o Extension Viewer.
   */
  public getExtensionFiles(): ExtensionFileInfo[] {
    this.ensureExtensionBuilt();
    if (!fs.existsSync(DIST_EXT)) return [];

    const results: ExtensionFileInfo[] = [];
    const textExtensions = ['.json', '.js', '.css', '.html', '.txt', '.md'];

    const scanDir = (dir: string, base: string = '') => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relPath = base ? `${base}/${item}` : item;
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          scanDir(fullPath, relPath);
        } else {
          const ext = path.extname(item).toLowerCase();
          const isText = textExtensions.includes(ext);
          let content: string | undefined = undefined;

          if (isText && stat.size < 500000) {
            content = fs.readFileSync(fullPath, 'utf-8');
          }

          results.push({
            name: item,
            relativePath: relPath,
            sizeBytes: stat.size,
            isText,
            content,
            modifiedAt: stat.mtime.toISOString(),
          });
        }
      }
    };

    scanDir(DIST_EXT);
    return results;
  }

  /**
   * Retorna o arquivo individual da extensão.
   */
  public getSingleFile(relativePath: string): { buffer: Buffer; mimeType: string } | null {
    this.ensureExtensionBuilt();
    // Sanitização de path traversal
    const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
    const fullPath = path.join(DIST_EXT, safePath);

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return null;
    }

    const buffer = fs.readFileSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.json': 'application/json',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.html': 'text/html',
      '.png': 'image/png',
    };

    return {
      buffer,
      mimeType: mimeMap[ext] || 'application/octet-stream',
    };
  }

  /**
   * Empacota a pasta dist/extension em um arquivo ZIP real e retorna o caminho.
   */
  public generateOrGetZip(): string {
    this.ensureExtensionBuilt();
    fs.mkdirSync(DIST_PACKAGE, { recursive: true });

    // Gera o ZIP usando python3 zipfile de alta performance nativo
    const pythonScript = `
import zipfile, os
with zipfile.ZipFile('${ZIP_PATH}', 'w', zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk('${DIST_EXT}'):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, '${DIST_EXT}')
            z.write(full, rel)
`;
    execSync(`python3 -c "${pythonScript.replace(/"/g, '\\"')}"`, { cwd: ROOT_DIR });
    return ZIP_PATH;
  }
}

export const extensionPacker = new ExtensionPackerService();
