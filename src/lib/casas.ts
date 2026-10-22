// O que muda entre Câmara e Senado na interface: textos, rotas e métricas comparáveis.

export type Casa = 'camara' | 'senado'

export interface ConfigCasa {
  casa: Casa
  nome: string
  curto: string
  singular: string
  plural: string
  femininoPlural: string
  /** Rota do painel. */
  inicio: string
  comparar: string
  perfil: (id: number) => string
  descricao: (total: number) => string
  fonte: { nome: string; url: string }
  presenca: {
    rotulo: string
    /** Plural do que é contado ("sessões", "votações"). */
    unidade: string
    titulo: string
    explicacao: string
  }
  /** Métricas de atividade em pequenos múltiplos na comparação. */
  metricas: { chave: 'proposicoes' | 'discursos' | 'eventos' | 'frentes' | 'comissoes'; rotulo: string }[]
}

export const CASAS: Record<Casa, ConfigCasa> = {
  camara: {
    casa: 'camara',
    nome: 'Câmara dos Deputados',
    curto: 'Câmara',
    singular: 'deputado',
    plural: 'deputados',
    femininoPlural: 'deputadas',
    inicio: '/',
    comparar: '/comparar',
    perfil: (id) => `/deputado/${id}`,
    descricao: (n) => `Os ${n} deputados em exercício na 57ª legislatura.`,
    fonte: { nome: 'Dados Abertos da Câmara dos Deputados', url: 'https://dadosabertos.camara.leg.br/' },
    presenca: {
      rotulo: 'Presença no Plenário',
      unidade: 'sessões',
      titulo: 'Presença em sessões deliberativas do Plenário',
      explicacao: 'Sessões realizadas no período em que o deputado registrou presença (ausências justificadas contam como ausência)',
    },
    metricas: [
      { chave: 'proposicoes', rotulo: 'Proposições de autoria' },
      { chave: 'discursos', rotulo: 'Discursos' },
      { chave: 'eventos', rotulo: 'Eventos (sessões e reuniões)' },
      { chave: 'frentes', rotulo: 'Frentes parlamentares' },
    ],
  },
  senado: {
    casa: 'senado',
    nome: 'Senado Federal',
    curto: 'Senado',
    singular: 'senador',
    plural: 'senadores',
    femininoPlural: 'senadoras',
    inicio: '/senado',
    comparar: '/senado/comparar',
    perfil: (id) => `/senador/${id}`,
    descricao: (n) => `Os ${n} senadores em exercício (titulares e suplentes que assumiram).`,
    fonte: { nome: 'Dados Abertos do Senado Federal', url: 'https://www12.senado.leg.br/dados-abertos' },
    presenca: {
      rotulo: 'Presença em votações',
      unidade: 'votações',
      titulo: 'Presença em votações nominais do Plenário',
      explicacao: 'Votações nominais do período em que o senador estava presente. O Senado separa ausências justificadas (licença, missão, atividade parlamentar) de faltas',
    },
    metricas: [
      { chave: 'proposicoes', rotulo: 'Proposições de autoria' },
      { chave: 'discursos', rotulo: 'Discursos' },
      { chave: 'comissoes', rotulo: 'Comissões (membro atual)' },
      { chave: 'frentes', rotulo: 'Frentes parlamentares' },
    ],
  },
}

/** Casa da página atual, pelo caminho da URL. */
export const casaDaRota = (pathname: string): Casa =>
  pathname.startsWith('/senado') ? 'senado' : 'camara'
