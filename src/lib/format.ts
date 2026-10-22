const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const brlCompacto = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 })
const num = new Intl.NumberFormat('pt-BR')
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export const moeda = (v: number) => brl.format(v)
export const moedaCurta = (v: number) => brlCompacto.format(v)
export const numero = (v: number) => num.format(v)
export const pct = (v: number) => `${(v * 100).toFixed(1).replace('.', ',')}%`

/** "2025-03" -> "mar/25" */
export const rotuloMes = (k: string) => `${MESES[Number(k.slice(5, 7)) - 1]}/${k.slice(2, 4)}`

export function idade(dataNascimento: string | null) {
  if (!dataNascimento) return null
  const n = new Date(dataNascimento)
  const hoje = new Date()
  let a = hoje.getFullYear() - n.getFullYear()
  if (hoje < new Date(hoje.getFullYear(), n.getMonth(), n.getDate())) a--
  return a
}

/** Tipos de despesa vêm em CAIXA ALTA e longos; deixa legível. */
export function tipoCurto(tipo: string) {
  const mapa: Record<string, string> = {
    'MANUTENÇÃO DE ESCRITÓRIO DE APOIO À ATIVIDADE PARLAMENTAR': 'Escritório',
    'LOCOMOÇÃO, ALIMENTAÇÃO E  HOSPEDAGEM': 'Locomoção e hospedagem',
    'COMBUSTÍVEIS E LUBRIFICANTES.': 'Combustíveis',
    'CONSULTORIAS, PESQUISAS E TRABALHOS TÉCNICOS.': 'Consultorias',
    'DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR.': 'Divulgação',
    'PASSAGEM AÉREA - SIGEPA': 'Passagens (SIGEPA)',
    'PASSAGEM AÉREA - REEMBOLSO': 'Passagens (reembolso)',
    'PASSAGEM AÉREA - RPA': 'Passagens (RPA)',
    'PASSAGENS TERRESTRES, MARÍTIMAS OU FLUVIAIS': 'Passagens terrestres',
    'TELEFONIA': 'Telefonia',
    'SERVIÇOS POSTAIS': 'Correios',
    'SERVIÇO DE SEGURANÇA PRESTADO POR EMPRESA ESPECIALIZADA.': 'Segurança',
    'LOCAÇÃO OU FRETAMENTO DE VEÍCULOS AUTOMOTORES': 'Locação de veículos',
    'LOCAÇÃO OU FRETAMENTO DE AERONAVES': 'Fretamento de aeronaves',
    'LOCAÇÃO OU FRETAMENTO DE EMBARCAÇÕES': 'Fretamento de embarcações',
    'SERVIÇO DE TÁXI, PEDÁGIO E ESTACIONAMENTO': 'Táxi e estacionamento',
    'ASSINATURA DE PUBLICAÇÕES': 'Publicações',
    'FORNECIMENTO DE ALIMENTAÇÃO DO PARLAMENTAR': 'Alimentação',
    'HOSPEDAGEM ,EXCETO DO PARLAMENTAR NO DISTRITO FEDERAL.': 'Hospedagem',
    'PARTICIPAÇÃO EM CURSO, PALESTRA OU EVENTO SIMILAR': 'Cursos e eventos',
    'AQUISIÇÃO DE TOKENS E CERTIFICADOS DIGITAIS': 'Certificados digitais',
  }
  if (mapa[tipo]) return mapa[tipo]
  // Senado (CEAPS): frases longas; o começo basta para identificar
  const senado: [string, string][] = [
    ['Locomoção, hospedagem', 'Locomoção e hospedagem'],
    ['Aluguel de imóveis', 'Aluguel de escritório'],
    ['Passagens aéreas', 'Passagens'],
    ['Divulgação da atividade', 'Divulgação'],
    ['Contratação de consultorias', 'Consultorias e assessorias'],
    ['Aquisição de material de consumo', 'Material de escritório'],
    ['Serviços de Segurança', 'Segurança'],
  ]
  const curto = senado.find(([inicio]) => tipo.startsWith(inicio))
  if (curto) return curto[1]
  const t = tipo.toLowerCase().replace(/[.]$/, '')
  return t.charAt(0).toUpperCase() + t.slice(1)
}
