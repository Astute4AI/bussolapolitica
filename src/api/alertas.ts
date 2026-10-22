// Formato do arquivo gerado por scripts/gerar-alertas.ts (public/dados/alertas-AAAA.json)
// e leitura dele no app. As regras estão descritas em docs/alertas-de-gastos.md.

import type { Casa } from '../lib/casas.ts'

export type RegraId = 'acima-dos-pares' | 'concentracao-fornecedor' | 'documento-repetido' | 'pico-dezembro'

export interface AlertaAcimaDosPares {
  regra: 'acima-dos-pares'
  tipoDespesa: string
  valor: number
  mediana: number
  /** valor / mediana */
  razao: number
  /** "nacional" ou a UF, quando a comparação é só com o mesmo estado (passagens da Câmara). */
  grupo: string
  /** Parlamentares com gasto na categoria, no grupo. */
  tamanhoGrupo: number
}

export interface AlertaConcentracao {
  regra: 'concentracao-fornecedor'
  fornecedor: string
  documento: string
  valor: number
  /** Fração do gasto total do parlamentar no ano (0–1). */
  participacao: number
  /** Quantos parlamentares da mesma casa pagaram esse fornecedor no ano (inclui este). */
  clientes: number
}

export interface AlertaDocumentoRepetido {
  regra: 'documento-repetido'
  fornecedor: string
  documento: string
  numero: string
  valorUnitario: number
  ocorrencias: number
  /** Datas de emissão (AAAA-MM-DD) e mês de competência de cada ocorrência. */
  lancamentos: { data: string; mes: number; url: string | null }[]
}

export interface AlertaPicoDezembro {
  regra: 'pico-dezembro'
  valorDezembro: number
  mediaOutrosMeses: number
  razao: number
}

export type Alerta = AlertaAcimaDosPares | AlertaConcentracao | AlertaDocumentoRepetido | AlertaPicoDezembro

export interface ParlamentarComAlertas {
  casa: Casa
  id: number
  nome: string
  partido: string | null
  uf: string | null
  totalAno: number
  alertas: Alerta[]
}

export interface ArquivoAlertas {
  ano: number
  /** Ano ainda em andamento: algumas regras (pico de dezembro) não se aplicam. */
  parcial: boolean
  geradoEm: string
  fontes: Record<Casa, string>
  parlamentares: ParlamentarComAlertas[]
}

export interface IndiceAlertas {
  anos: number[]
  geradoEm: string
}

export const REGRAS: Record<RegraId, { titulo: string; resumo: string }> = {
  'acima-dos-pares': {
    titulo: 'Acima dos pares',
    resumo: 'Gasto numa categoria pelo menos 3× a mediana dos colegas da mesma casa e entre os 5% maiores.',
  },
  'concentracao-fornecedor': {
    titulo: 'Fornecedor concentrado',
    resumo: 'Um único fornecedor recebeu 40% ou mais de tudo o que o parlamentar gastou no ano.',
  },
  'documento-repetido': {
    titulo: 'Documento repetido',
    resumo: 'Mesmo fornecedor, mesmo número de documento e mesmo valor lançados mais de uma vez.',
  },
  'pico-dezembro': {
    titulo: 'Pico em dezembro',
    resumo: 'Gasto de dezembro pelo menos 2× a média dos outros meses, padrão de quem esgota a cota no fim do ano.',
  },
}

/** Valor envolvido no alerta, usado para ordenar. */
export function valorDoAlerta(a: Alerta) {
  switch (a.regra) {
    case 'acima-dos-pares': return a.valor - a.mediana
    case 'concentracao-fornecedor': return a.valor
    case 'documento-repetido': return a.valorUnitario * (a.ocorrencias - 1)
    case 'pico-dezembro': return a.valorDezembro - a.mediaOutrosMeses
  }
}
