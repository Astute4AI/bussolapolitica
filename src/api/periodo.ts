// Períodos de consulta, comuns à Câmara e ao Senado (57ª legislatura).

export const LEGISLATURA_INICIO = '2023-02-01'
export const LEGISLATURA_FIM = '2027-01-31'

export const PERIODOS = ['legislatura', '2026', '2025', '2024', '2023']
export const rotuloPeriodo = (p: string) => (p === 'legislatura' ? 'Legislatura (2023–2027)' : p)

/** Intervalo de datas de um "período": um ano da legislatura ou a legislatura inteira. */
export function intervalo(periodo: string): [string, string] {
  if (periodo === 'legislatura') return [LEGISLATURA_INICIO, LEGISLATURA_FIM]
  const ano = Number(periodo)
  const inicio = ano === 2023 ? LEGISLATURA_INICIO : `${ano}-01-01`
  const fim = ano === 2027 ? LEGISLATURA_FIM : `${ano}-12-31`
  return [inicio, fim]
}

/** Anos civis cobertos pelo período (a legislatura vai até jan/2027, mas 2027 ainda não tem dados). */
export const anosDoPeriodo = (periodo: string) =>
  periodo === 'legislatura' ? PERIODOS.filter((p) => p !== 'legislatura').map(Number).sort() : [Number(periodo)]

/** Data "AAAA-MM-DD..." dentro do período? */
export function noPeriodo(data: string | null | undefined, periodo: string) {
  if (!data) return false
  const [inicio, fim] = intervalo(periodo)
  const d = data.slice(0, 10)
  return d >= inicio && d <= fim
}
