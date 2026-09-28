/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Script de Empacotamento do ZIP Oficial da Extensão Chrome.
 * Gera o arquivo em dist/package/extensao-extttsstt.zip a partir de dist/extension.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT_DIR = process.cwd();
const DIST_EXT = path.resolve(ROOT_DIR, 'dist/extension');
const DIST_PACKAGE = path.resolve(ROOT_DIR, 'dist/package');
const ZIP_PATH = path.join(DIST_PACKAGE, 'extensao-extttsstt.zip');

function main() {
  if (!fs.existsSync(DIST_EXT) || !fs.existsSync(path.join(DIST_EXT, 'manifest.json'))) {
    console.log('⚡ dist/extension ausente. Executando build da extensão primeiro...');
    execSync('npm run build:ext', { cwd: ROOT_DIR, stdio: 'inherit' });
  }

  fs.mkdirSync(DIST_PACKAGE, { recursive: true });

  console.log('📦 Empacotando dist/extension em dist/package/extensao-extttsstt.zip...');
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
  const size = fs.statSync(ZIP_PATH).size;
  console.log(`✅ Pacote ZIP gerado com sucesso (${size} bytes) em ${ZIP_PATH}`);
}

main();
