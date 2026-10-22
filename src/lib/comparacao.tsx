import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Casa } from './casas'

export const MAX_COMPARACAO = 4
// A chave da Câmara é a original, para manter seleções salvas antes de existir o Senado.
const CHAVES: Record<Casa, string> = {
  camara: 'politicosbrasil:comparacao',
  senado: 'politicosbrasil:comparacao:senado',
}

type Selecoes = Record<Casa, number[]>

interface Ctx {
  ids: number[]
  alternar: (id: number) => void
  remover: (id: number) => void
  definir: (ids: number[]) => void
  limpar: () => void
}

const ComparacaoContext = createContext<{ selecoes: Selecoes; mudar: (casa: Casa, f: (ids: number[]) => number[]) => void } | null>(null)

function ler(casa: Casa): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVES[casa]) ?? '[]')
    return Array.isArray(v) ? v.filter((n) => typeof n === 'number').slice(0, MAX_COMPARACAO) : []
  } catch {
    return []
  }
}

export function ComparacaoProvider({ children }: { children: ReactNode }) {
  const [selecoes, setSelecoes] = useState<Selecoes>(() => ({ camara: ler('camara'), senado: ler('senado') }))

  useEffect(() => {
    try {
      for (const casa of Object.keys(CHAVES) as Casa[]) localStorage.setItem(CHAVES[casa], JSON.stringify(selecoes[casa]))
    } catch { /* armazenamento indisponível */ }
  }, [selecoes])

  const mudar = (casa: Casa, f: (ids: number[]) => number[]) =>
    setSelecoes((atual) => {
      const novos = f(atual[casa])
      return novos === atual[casa] ? atual : { ...atual, [casa]: novos }
    })

  return <ComparacaoContext.Provider value={{ selecoes, mudar }}>{children}</ComparacaoContext.Provider>
}

/** Seleção de comparação de uma casa (cada casa tem a sua). */
export function useComparacao(casa: Casa): Ctx {
  const ctx = useContext(ComparacaoContext)
  if (!ctx) throw new Error('useComparacao fora do ComparacaoProvider')
  const { selecoes, mudar } = ctx
  return {
    ids: selecoes[casa],
    alternar: (id) => mudar(casa, (atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : atual.length >= MAX_COMPARACAO ? atual : [...atual, id]),
    remover: (id) => mudar(casa, (atual) => atual.filter((x) => x !== id)),
    definir: (novos) => mudar(casa, () => novos.slice(0, MAX_COMPARACAO)),
    limpar: () => mudar(casa, () => []),
  }
}
