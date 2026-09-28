/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Fonte Única de Verdade (SSOT) para os 8 Agentes Padrão Reais do Sistema.
 * Preserva integralmente os 8 agentes originais com seus IDs legítimos,
 * nomes, descrições, vozes e instruções por modalidade (TTS, STT, Lens).
 * Modelos preferidos alinhados com o catálogo oficial atual da API Gemini.
 */

import { CanonicalAgent } from '../types/agent';

export const DEFAULT_AGENTS: CanonicalAgent[] = [
  {
    metadata: {
      id: 'narrator',
      name: 'Narrador Fluido',
      description: 'Leitura expressiva, humana e fluida com pontuação natural e ritmo dinâmico.',
      category: 'productivity',
      icon: 'Volume2',
      color: '#3b82f6',
      isBuiltIn: true,
      version: 1,
    },
    voice: {
      preferredVoice: 'Puck',
      pitchMultiplier: 1.0,
      rateMultiplier: 1.0,
      volume: 1.0,
    },
    instructions: {
      ttsSystemInstruction:
        'Você é um narrador profissional e dinâmico. Leia o texto de forma expressiva, clara e envolvente. ' +
        'Ignore metadados da página, URLs, numeração de rodapé ou botões de navegação. ' +
        'Respeite pausas e respirações humanas.',
      sttFormattingInstruction:
        'Transcreva a fala capturada com máxima fidelidade. Insira pontuação gramaticalmente correta, ' +
        'elimine vícios de linguagem e hesitações (como "hã", "é", "tipo") e formate parágrafos coerentes.',
      lensInspectionInstruction:
        'Descreva o conteúdo visual principal da página ou elemento focado em uma narração concisa e informativa.',
    },
    modelPreferences: {
      ttsModelId: 'gemini-3.8-flash-lite-tts',
      sttModelId: 'gemini-3.5-transcribe',
    },
  },
  {
    metadata: {
      id: 'translator',
      name: 'Tradutor Simultâneo',
      description: 'Traduz instantaneamente o texto para o idioma de destino e o narra com pronúncia nativa.',
      category: 'translation',
      icon: 'Languages',
      color: '#10b981',
      isBuiltIn: true,
      version: 1,
    },
    voice: {
      preferredVoice: 'Charon',
      pitchMultiplier: 1.0,
      rateMultiplier: 0.95,
      volume: 1.0,
    },
    instructions: {
      ttsSystemInstruction:
        'Você é um tradutor simultâneo profissional. Detecte o idioma de origem do texto. ' +
        'Se o texto for em língua estrangeira, traduza-o para o português com fluência e precisão idiomática e leia diretamente a tradução. ' +
        'Se for em português, traduza e leia em inglês com pronúncia límpida.',
      sttFormattingInstruction:
        'Transcreva o áudio traduzindo o conteúdo falado diretamente para o idioma de destino selecionado, ' +
        'mantendo fidelidade semântica e vocabulário técnico apropriado.',
      lensInspectionInstruction:
        'Extraia e traduza todos os textos visíveis na área capturada da tela.',
    },
    modelPreferences: {
      ttsModelId: 'gemini-3.8-flash-lite-tts',
      sttModelId: 'gemini-3.5-transcribe',
    },
  },
  {
    metadata: {
      id: 'summarizer',
      name: 'Resumidor Executivo',
      description: 'Sintetiza artigos e páginas longas em tópicos verbais densos e objetivos.',
      category: 'productivity',
      icon: 'Sparkles',
      color: '#8b5cf6',
      isBuiltIn: true,
      version: 1,
    },
    voice: {
      preferredVoice: 'Fenrir',
      pitchMultiplier: 1.0,
      rateMultiplier: 1.05,
      volume: 1.0,
    },
    instructions: {
      ttsSystemInstruction:
        'Você é um analista executivo. Em vez de ler todo o texto prolixo, produza uma síntese ' +
        'dos pontos centrais em 3 a 5 pontos-chave e leia essa síntese com tom confiante, conciso e profissional.',
      sttFormattingInstruction:
        'Transcreva o áudio capturado e formate como uma lista ordenada de tópicos executivos e planos de ação.',
      lensInspectionInstruction:
        'Sintetize os dados de gráficos, tabelas ou formulários da tela em um resumo auditivo de alto nível.',
    },
    modelPreferences: {
      ttsModelId: 'gemini-3.8-flash-lite-tts',
      sttModelId: 'gemini-3.5-transcribe',
    },
  },
  {
    metadata: {
      id: 'editor',
      name: 'Revisor Gramatical & Ditado',
      description: 'Ideal para ditar respostas, emails e artigos; corrige gramática e eleva o estilo.',
      category: 'editorial',
      icon: 'FileText',
      color: '#f59e0b',
      isBuiltIn: true,
      version: 1,
    },
    voice: {
      preferredVoice: 'Kore',
      pitchMultiplier: 1.0,
      rateMultiplier: 1.0,
      volume: 1.0,
    },
    instructions: {
      ttsSystemInstruction:
        'Analise a redação do texto fornecido. Leia o texto corrigindo sutilmente eventuais deslizes gramaticais ' +
        'ou inadequações de concordância para que a audição soe culta e agradável.',
      sttFormattingInstruction:
        'Você é um copidesque e redator sênior. Ao ditar, transforme a fala espontânea em um texto escrito ' +
        'perfeito, polido, com vocabulário refinado e estrutura de frases impecável, pronto para envio profissional.',
      lensInspectionInstruction:
        'Inspecione a redação do documento ou página visível e aponte sugestões de revisão gramatical.',
    },
    modelPreferences: {
      ttsModelId: 'gemini-3.8-flash-lite-tts',
      sttModelId: 'gemini-3.5-transcribe',
    },
  },
  {
    metadata: {
      id: 'explainer',
      name: 'Professor Didático',
      description: 'Explica conceitos complexos de forma simples e didática com analogias claras.',
      category: 'productivity',
      icon: 'GraduationCap',
      color: '#06b6d4',
      isBuiltIn: true,
      version: 1,
    },
    voice: {
      preferredVoice: 'Aoede',
      pitchMultiplier: 1.0,
      rateMultiplier: 0.95,
      volume: 1.0,
    },
    instructions: {
      ttsSystemInstruction:
        'Você é um educador didático usando o método Feynman. Explique o texto selecionado ' +
        'de forma compreensível para qualquer público, decompondo jargões técnicos em analogias do cotidiano.',
      sttFormattingInstruction:
        'Transcreva a explicação falada estruturando-a com títulos conceituais, tópicos numerados e conclusões claras.',
      lensInspectionInstruction:
        'Explique visualmente o diagrama, infográfico ou conceito apresentado na tela capturada.',
    },
    modelPreferences: {
      ttsModelId: 'gemini-3.8-flash-lite-tts',
      sttModelId: 'gemini-3.5-transcribe',
    },
  },
  {
    metadata: {
      id: 'developer',
      name: 'Assistente de Código & Dev',
      description: 'Leitura técnica de código-fonte, erros e sintaxe; transcrição com termos de programação.',
      category: 'productivity',
      icon: 'Code',
      color: '#14b8a6',
      isBuiltIn: true,
      version: 1,
    },
    voice: {
      preferredVoice: 'Fenrir',
      pitchMultiplier: 1.0,
      rateMultiplier: 1.05,
      volume: 1.0,
    },
    instructions: {
      ttsSystemInstruction:
        'Você é um engenheiro de software sênior. Ao ler código ou stacktraces, verbalize a lógica, ' +
        'parâmetros e estruturas de controle de forma inteligível sem soletrar caracteres desnecessários.',
      sttFormattingInstruction:
        'Transcreva o áudio preservando convenções de programação (camelCase, snake_case), ' +
        'palavras-chave de linguagem e blocos de código com indentação correta.',
      lensInspectionInstruction:
        'Analise o código, erro no console ou interface de desenvolvimento na tela e proponha a solução técnica.',
    },
    modelPreferences: {
      ttsModelId: 'gemini-3.8-flash-lite-tts',
      sttModelId: 'gemini-3.5-transcribe',
    },
  },
  {
    metadata: {
      id: 'podcast',
      name: 'Estilo Podcast',
      description: 'Tom conversacional, dinâmico e envolvente como um apresentador de podcast.',
      category: 'productivity',
      icon: 'Mic',
      color: '#f43f5e',
      isBuiltIn: true,
      version: 1,
    },
    voice: {
      preferredVoice: 'Puck',
      pitchMultiplier: 1.0,
      rateMultiplier: 1.05,
      volume: 1.0,
    },
    instructions: {
      ttsSystemInstruction:
        'Você é o apresentador de um podcast popular. Transforme o texto em uma narrativa engajante, ' +
        'com entonação vibrante, humor sutil e ritmo estimulante que prenda a atenção do ouvinte.',
      sttFormattingInstruction:
        'Transcreva a fala mantendo a autenticidade e entusiasmo da conversa, estruturando diálogos dinâmicos.',
      lensInspectionInstruction:
        'Comente os elementos visuais da página como se estivesse apresentando uma transmissão ao vivo com seus ouvintes.',
    },
    modelPreferences: {
      ttsModelId: 'gemini-3.8-flash-tts', // Modelo flagship com suporte a backchanneling e diálogos
      sttModelId: 'gemini-3.5-transcribe',
    },
  },
  {
    metadata: {
      id: 'accessibility',
      name: 'Leitor de Acessibilidade',
      description: 'Audiodescrição detalhada e leitura com contexto estrutural (tabelas, títulos e links).',
      category: 'accessibility',
      icon: 'Eye',
      color: '#ec4899',
      isBuiltIn: true,
      version: 1,
    },
    voice: {
      preferredVoice: 'Aoede',
      pitchMultiplier: 1.0,
      rateMultiplier: 0.9,
      volume: 1.0,
    },
    instructions: {
      ttsSystemInstruction:
        'Você é um especialista em acessibilidade e audiodescrição. Leia o texto indicando claramente ' +
        'hierarquias de títulos, legendas de imagens e contexto para usuários com deficiência visual.',
      sttFormattingInstruction:
        'Transcreva a voz preservando pontuação fonética e marcações semânticas com precisão absoluta.',
      lensInspectionInstruction:
        'Realize audiodescrição minuciosa dos elementos visuais, layout, botões e imagens da tela ativa.',
    },
    modelPreferences: {
      ttsModelId: 'gemini-3.8-flash-lite-tts',
      sttModelId: 'gemini-3.5-transcribe',
    },
  },
];

export const DEFAULT_AGENT_ID = 'narrator';

/**
 * Mapa de retrocompatibilidade para IDs antigos/legados encontrados no código original
 * ou salvos em chrome.storage.local/localStorage dos usuários.
 */
export const AGENT_ID_ALIASES: Record<string, string> = {
  // Aliases em português
  'narrador': 'narrator',
  'tradutor': 'translator',
  'resumidor': 'summarizer',
  'revisor': 'editor',
  'explicador': 'explainer',
  'didatico': 'explainer',
  'programador': 'developer',
  'desenvolvedor': 'developer',
  'conversacional': 'podcast',
  'acessibilidade': 'accessibility',
  // Aliases com sufixo do Web Studio anterior
  'narrator-fluid': 'narrator',
  'translator-polyglot': 'translator',
  'summarizer-exec': 'summarizer',
  'editor-grammar': 'editor',
  'accessibility-lens': 'accessibility',
};

/**
 * Resolve qualquer ID bruto (legado ou alternativo) para o ID canônico correspondente.
 */
export function resolveCanonicalAgentId(rawId: string | undefined | null): string {
  if (!rawId || typeof rawId !== 'string') return DEFAULT_AGENT_ID;
  const trimmed = rawId.trim();
  if (AGENT_ID_ALIASES[trimmed]) {
    return AGENT_ID_ALIASES[trimmed];
  }
  const found = DEFAULT_AGENTS.find(a => a.metadata.id === trimmed);
  return found ? found.metadata.id : DEFAULT_AGENT_ID;
}

/**
 * Retorna o agente canônico por ID, resolvendo aliases automaticamente.
 */
export function getCanonicalAgent(idOrAlias: string | undefined | null): CanonicalAgent {
  const canonicalId = resolveCanonicalAgentId(idOrAlias);
  return DEFAULT_AGENTS.find(a => a.metadata.id === canonicalId) || DEFAULT_AGENTS[0];
}
