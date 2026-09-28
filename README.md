# STT-TTSbyAlee — Chrome Extension & Web Studio (Gemini Audio & Flash-Lite)

Suíte completa e modular para Text-to-Speech (TTS), Speech-to-Text (STT) e inspeção multimodal visual (Gemini Lens), alimentada diretamente pelo catálogo oficial de modelos da família Google Gemini (`@google/genai`).

O projeto é composto por dois módulos perfeitamente sincronizados que compartilham contratos, schemas de storage, catálogo de modelos e lógica pura em `shared/`:
1. **Extensão Chrome (Manifest V3)**: Injeção de voz e ditado na página web com controles flutuantes via Shadow DOM isolado, atalhos de teclado e popup/options em React 19.
2. **Web Studio (Full-Stack)**: Dashboard em React 19 + Express para Test Arena (TTS, STT, Visão e Mixer), CRUD de Personas/Agentes, catálogo de modelos congelado e distribuição de pacotes da extensão.

---

## 🏛️ Arquitetura do Repositório

```
/
├── assets/                     # Recursos gráficos estáticos oficiais (ícones PNG)
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── extension/                  # Código-fonte da Extensão Chrome (MV3)
│   ├── manifest.json           # Manifesto MV3 oficial
│   └── src/
│       ├── background/         # Service Worker ESM (mensagens, captura de aba, menus)
│       ├── content/            # Content Script nativo (Shadow DOM, HUD, atalhos, TTS/STT/Lens)
│       ├── popup/              # UI de Popup rápida (React 19 + Vite)
│       ├── options/            # Painel completo de Opções (React 19 + Vite)
│       └── services/           # Adaptadores de storage Chrome e chamadas diretas
├── server/                     # Backend Express Full-Stack
│   ├── index.ts                # Servidor Express, roteamento e integração com Vite
│   ├── routes/                 # Endpoints (/api/tts, /api/stt, /api/vision, /api/models, /api/extension)
│   └── services/               # Cliente Node @google/genai e empacotador de build
├── shared/                     # Single Source of Truth (SSOT) isomórfico puro
│   ├── constants/              # Agentes canônicos (8 personas), catálogo de modelos, configurações
│   ├── types/                  # Tipagens TypeScript estritas (Agentes, Mensagens, Storage, Modelos)
│   └── utils/                  # Chunking de texto, limpeza de DOM, conversor PCM -> WAV
├── web/                        # Web Studio Frontend (React 19 + Tailwind CSS)
│   ├── index.html              # Entrypoint HTML
│   └── src/
│       ├── audio/              # Implementação de Web Audio browser-only (Player, Recorder, Visualizer)
│       ├── components/         # Navbar, Test Arena (TTS, STT, Visão, Mixer, Histórico), Agent Studio, etc.
│       └── services/           # Adaptador de storage localStorage e cliente de API HTTP
├── scripts/                    # Scripts de build idempotentes
│   ├── buildExtension.ts       # Pipeline esbuild + Vite para dist/extension/
│   ├── buildWeb.ts             # Pipeline Vite para dist/web/
│   └── packExtension.ts        # Gerador do ZIP distribuível em dist/package/
└── server.ts                   # Entrypoint root oficial para o servidor full-stack
```

---

## ⚡ Requisitos e Instalação

- **Node.js**: v20+ ou v22+
- **NPM**: v10+

```bash
# 1. Instalar dependências
npm install

# 2. Configurar chave de API Gemini (opcional no .env ou diretamente na UI)
cp .env.example .env
```

---

## 🚀 Comandos Disponíveis

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor Full-Stack de desenvolvimento (porta 3000) |
| `npm run build` | Executa o pipeline completo: compila Web, Extensão e empacota o ZIP |
| `npm run build:ext` | Compila a extensão Chrome para `dist/extension/` |
| `npm run build:web` | Compila o Web Studio para `dist/web/` |
| `npm run pack:ext` | Empacota `dist/extension/` em `dist/package/extensao-extttsstt.zip` |
| `npm run lint` | Validação de tipagem TypeScript (`tsc --noEmit`) |
| `npm run clean` | Remove a pasta `dist/` |

---

## 🧩 Como Instalar a Extensão no Google Chrome

1. Execute o build da extensão:
   ```bash
   npm run build:ext
   ```
2. Abra o Google Chrome e navegue até `chrome://extensions`.
3. Ative o interruptor **"Modo do desenvolvedor"** no canto superior direito.
4. Clique em **"Carregar sem compactação"** (Load unpacked).
5. Selecione o diretório `dist/extension/` gerado no projeto.
6. A extensão estará ativa e pronta para uso em qualquer página web!

---

## ⌨️ Atalhos de Teclado na Extensão

- **`Ctrl + B`**: Lê o texto selecionado na página utilizando a voz da persona ativa.
- **`Pause / Break`**: Pausa ou retoma a reprodução do áudio.
- **`Ctrl + Shift + Espaço`**: Inicia ou encerra o ditado por voz com injeção automática de texto no campo ativo.
- **`Ctrl + Shift + Arrastar com Mouse`**: Ativa a seleção retangular do Gemini Lens para análise multimodal da área demarcada.
- **`Alt + Shift + S`**: Alterna a leitura do texto selecionado.
- **`Alt + Shift + D`**: Alterna o ditado por voz.
- **`Alt + Shift + H`**: Alterna a visibilidade do HUD flutuante.

---

## 🧠 Matriz de Modelos Gemini e Motor de Fallback (Zero-Retry)

O catálogo de modelos é estritamente congelado e unificado em `shared/constants/modelsCatalog.ts`:

### 1. TTS Nativo (Ordem Estrita e Whitelist de 4 Modelos)
1. `gemini-3.8-flash-lite-tts` (Padrão de síntese de áudio de alta eficiência e baixa latência)
2. `gemini-3.8-flash-tts` (Síntese expressiva e diálogos)
3. `gemini-3.1-flash-tts-preview` (Preview de síntese natural)
4. `gemini-2.5-flash-preview-tts` (Compatibilidade para síntese vocal)

*Cadeia de fallback: `3.8-flash-lite-tts` ➔ `3.8-flash-tts` ➔ `3.1-flash-tts-preview` ➔ `2.5-flash-preview-tts`.*

### 2. STT Unary / Visão Multimodal / Modelos Gerais (Ordem Estrita de 2 Modelos)
1. `gemini-3.5-flash-lite` (Transcrição STT Unary via `generateContent`, análise de imagem e texto)
2. `gemini-3.1-flash-lite` (Ultrabaixa latência para visão, transcrição e testes)

*Cadeia de fallback: `gemini-3.5-flash-lite` ➔ `gemini-3.1-flash-lite`.*

### 3. Teste de Conectividade e Autenticação de Chave de API
- Modelo inicial: `gemini-3.1-flash-lite`.

### 4. Regras do Motor Zero-Retry
- **Zero-Retry**: Nenhum modelo é chamado mais de uma vez por operação (`A ➔ B ➔ C`).
- **Zero-Backoff**: Ao ocorrer erro (4xx/5xx/quota/timeout), avança imediatamente para o próximo modelo da cadeia.
- **Independência**: `sttModelId !== ttsModelId`. Modelos TTS não aparecem em seletores de STT e vice-versa.

---

## 🔒 Garantias Arquiteturais e Isolamento

- **Zero Duplicação (SSOT)**: Os 8 agentes canônicos (`narrator`, `translator`, `summarizer`, `editor`, `explainer`, `developer`, `podcast`, `accessibility`), suas instruções e aliases residem exclusivamente em `shared/constants/defaultAgents.ts`.
- **Isolamento de Camadas**:
  - `shared/`: Código isomórfico puro sem React, DOM, Chrome ou Node.
  - `extension/src/content/`: Script nativo com **0 dependências de React/Server** e injeção em Shadow DOM encapsulado.
  - `extension/src/background/`: Service Worker ESM com **0 referências a DOM**.
  - `web/`: Aplicação React com **0 referências a `chrome.*`**.
  - `dist/`: Diretório de saída gerado por scripts — nenhum código-fonte importa `dist/`.
