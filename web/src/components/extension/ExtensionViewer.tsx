/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Extension Viewer & Downloader: Inspeção de arquivos reais da extensão e download do ZIP compilado.
 */

import React, { useState, useEffect } from 'react';
import { Download, FileCode, CheckCircle2, RefreshCw, Folder, File, ExternalLink, Terminal } from 'lucide-react';
import { geminiApi, ExtensionFileInfo } from '../../services/geminiApiClient';

export const ExtensionViewer: React.FC = () => {
  const [files, setFiles] = useState<ExtensionFileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<ExtensionFileInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const data = await geminiApi.getExtensionFiles();
      setFiles(data);
      if (data.length > 0 && !selectedFile) {
        const manifest = data.find((f) => f.name === 'manifest.json') || data[0];
        setSelectedFile(manifest);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* Banner de Download do ZIP Real */}
      <div className="bg-gradient-to-r from-blue-900/60 via-indigo-900/40 to-slate-900 border border-blue-500/30 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-base font-bold text-slate-100">Pacote da Extensão Pronto para Chrome (MV3)</h3>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
            Baixe o pacote ZIP oficial compilado diretamente pelo pipeline do backend.
            Contém o service worker, content scripts no Shadow DOM, popup React e options React.
          </p>
        </div>

        <a
          href="/api/extension/download"
          download="extensao-extttsstt.zip"
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-lg shadow-blue-600/30 transition cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Baixar Extensão (.ZIP)</span>
        </a>
      </div>

      {/* Grid: Explorador de Arquivos e Visualizador de Código */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Árvore de Arquivos Reais de dist/extension */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-slate-200">dist/extension/ ({files.length} arquivos)</span>
            </div>
            <button
              onClick={fetchFiles}
              disabled={isLoading}
              className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title="Recarregar arquivos"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex flex-col gap-1 max-h-[460px] overflow-y-auto">
            {files.map((file) => {
              const isSelected = selectedFile?.relativePath === file.relativePath;
              return (
                <button
                  key={file.relativePath}
                  onClick={() => setSelectedFile(file)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition text-left cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600/15 border border-blue-500/30 text-blue-300'
                      : 'hover:bg-slate-800/60 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                    <span className="truncate">{file.relativePath}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">
                    {(file.sizeBytes / 1024).toFixed(1)} KB
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Visualizador de Conteúdo */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <File className="w-4 h-4 text-slate-400" />
              <span className="font-mono">{selectedFile?.relativePath || 'Nenhum selecionado'}</span>
            </div>
            {selectedFile && (
              <span className="text-[10px] text-slate-500 font-mono">
                Modificado: {new Date(selectedFile.modifiedAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 h-[420px] overflow-auto font-mono text-xs text-slate-300 leading-relaxed">
            {selectedFile?.content ? (
              <pre className="whitespace-pre-wrap">{selectedFile.content}</pre>
            ) : selectedFile ? (
              <div className="flex items-center justify-center h-full text-slate-500">
                [Arquivo binário ou pacote de ícone: {selectedFile.sizeBytes} bytes]
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-600">
                Selecione um arquivo da lista para inspecionar.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Guia Rápido de Instalação */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-blue-400" />
          <span>Como Instalar a Extensão no Google Chrome</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold mb-2">1</span>
            <p className="text-slate-300 font-semibold mb-1">Baixe o ZIP</p>
            <p className="text-slate-500">Clique no botão azul acima e extraia os arquivos em qualquer pasta do computador.</p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold mb-2">2</span>
            <p className="text-slate-300 font-semibold mb-1">Abra as Extensões</p>
            <p className="text-slate-500">Acesse no Chrome: <code className="text-blue-400">chrome://extensions</code></p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold mb-2">3</span>
            <p className="text-slate-300 font-semibold mb-1">Modo do Desenvolvedor</p>
            <p className="text-slate-500">Ative o interruptor no canto superior direito da página de extensões.</p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold mb-2">4</span>
            <p className="text-slate-300 font-semibold mb-1">Carregar sem compactação</p>
            <p className="text-slate-500">Clique em "Carregar sem compactação" e selecione a pasta extraída da extensão.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
