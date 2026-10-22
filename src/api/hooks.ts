import { useQueries, useQuery, type QueryClient, type UseQueryResult } from '@tanstack/react-query'
import { api, sessaoRealizada, type Despesa } from './camara'
import { comparecimento, senado } from './senado'
import { anosDoPeriodo, intervalo, noPeriodo } from './periodo'
import type { Casa } from '../lib/casas'
import type { ArquivoAlertas, IndiceAlertas } from './alertas'

const HORA = 60 * 60 * 1000

// ---- Parlamentares (formato comum às duas casas) ----

export interface Parlamentar {
  id: number
  nome: string
  partido: string
  uf: string
  urlFoto: string
  sexo: 'F' | 'M'
}

const opcoesDeputados = {
  queryKey: ['deputados'],
  staleTime: HORA,
  queryFn: async ({ signal }: { signal: AbortSignal }) => {
    const [lista, mulheres] = await Promise.all([api.deputados(signal), api.idsMulheres(signal)])
    return lista.map((d): Parlamentar => ({
      id: d.id, nome: d.nome, partido: d.siglaPartido, uf: d.siglaUf, urlFoto: d.urlFoto, sexo: mulheres.has(d.id) ? 'F' : 'M',
    }))
  },
}

const opcoesSenadores = {
  queryKey: ['senadores'],
  staleTime: HORA,
  queryFn: ({ signal }: { signal: AbortSignal }) => senado.senadores(signal),
}

export const useSenadores = () => useQuery(opcoesSenadores)

/** Lista de parlamentares em exercício da casa. */
export function useParlamentares(casa: Casa): UseQueryResult<Parlamentar[]> {
  const deputados = useQuery({ ...opcoesDeputados, enabled: casa === 'camara' })
  const senadores = useQuery({ ...opcoesSenadores, enabled: casa === 'senado' })
  return casa === 'camara' ? deputados : senadores
}

// ---- Câmara: detalhes ----

export function useDeputado(id: number) {
  return useQuery({ queryKey: ['deputado', id], queryFn: ({ signal }) => api.deputado(id, signal), staleTime: HORA })
}

export function useOrgaos(id: number) {
  return useQuery({ queryKey: ['orgaos', id], queryFn: ({ signal }) => api.orgaos(id, signal), staleTime: HORA })
}

export function useProposicoesRecentes(id: number) {
  return useQuery({ queryKey: ['proposicoes', id], queryFn: ({ signal }) => api.proposicoesRecentes(id, signal), staleTime: HORA })
}

// ---- Senado: detalhes ----

export function useSenador(id: number) {
  return useQuery({ queryKey: ['senador', id], queryFn: ({ signal }) => senado.senador(id, signal), staleTime: HORA })
}

const opcoesComissoes = (id: number) => ({
  queryKey: ['senado-comissoes', id], staleTime: HORA, queryFn: ({ signal }: { signal: AbortSignal }) => senado.comissoes(id, signal),
})
const opcoesAutorias = (id: number) => ({
  queryKey: ['senado-autorias', id], staleTime: HORA, queryFn: ({ signal }: { signal: AbortSignal }) => senado.autorias(id, signal),
})
const opcoesVotos = (id: number) => ({
  queryKey: ['senado-votos', id], staleTime: HORA, queryFn: ({ signal }: { signal: AbortSignal }) => senado.votos(id, signal),
})

export const useComissoesSenado = (id: number) => useQuery(opcoesComissoes(id))
export const useAutorias = (id: number) => useQuery(opcoesAutorias(id))

// ---- Despesas da cota (as duas casas no formato da Câmara) ----

// O Senado publica a cota de todos os senadores num arquivo por ano: baixa uma vez por ano e reaproveita.
// Sem `signal` de propósito, para que um cancelamento não estrague a promessa compartilhada.
const cacheCeaps = new Map<number, Promise<Map<number, Despesa[]>>>()

function ceapsDoAno(ano: number) {
  let p = cacheCeaps.get(ano)
  if (!p) {
    p = senado.despesasDoAno(ano)
    p.catch(() => cacheCeaps.delete(ano))
    cacheCeaps.set(ano, p)
  }
  return p
}

async function despesasSenador(id: number, periodo: string) {
  const resultado: Despesa[] = []
  // Um ano por vez: cada arquivo tem ~10 MB
  for (const ano of anosDoPeriodo(periodo)) {
    const doAno = (await ceapsDoAno(ano)).get(id) ?? []
    resultado.push(...doAno.filter((d) => noPeriodo(`${d.ano}-${String(d.mes).padStart(2, '0')}-01`, periodo)))
  }
  return resultado
}

const opcoesDespesas = (casa: Casa, id: number, periodo: string) => ({
  queryKey: ['despesas', casa, id, periodo],
  staleTime: HORA,
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    casa === 'camara' ? api.despesas(id, periodo, signal) : despesasSenador(id, periodo),
})

export const useDespesas = (casa: Casa, id: number, periodo: string) => useQuery(opcoesDespesas(casa, id, periodo))

export const useDespesasVarios = (casa: Casa, ids: number[], periodo: string) =>
  useQueries({ queries: ids.map((id) => opcoesDespesas(casa, id, periodo)) })

// ---- Atividade ----

export interface Atividade {
  proposicoes: number
  discursos: number
  frentes: number
  /** Câmara: sessões deliberativas do Plenário com presença. Senado: votações nominais com presença. */
  presencas: number
  /** Total de sessões (Câmara) ou votações nominais (Senado) no período. */
  sessoes: number
  /** Só no Senado, que distingue ausência justificada (licença, missão…) de falta. */
  justificadas?: number
  /** Câmara: eventos realizados com participação registrada. */
  eventos?: number
  /** Senado: comissões das quais é membro hoje. */
  comissoes?: number
}

const opcoesAtividade = (casa: Casa, id: number, periodo: string) => ({
  queryKey: ['atividade', casa, id, periodo],
  staleTime: HORA,
  queryFn: ({ signal, client }: { signal: AbortSignal; client: QueryClient }) =>
    casa === 'camara' ? atividadeDeputado(id, periodo, signal) : atividadeSenador(id, periodo, signal, client),
})

export const useAtividade = (casa: Casa, id: number, periodo: string) => useQuery(opcoesAtividade(casa, id, periodo))

export const useAtividadeVarios = (casa: Casa, ids: number[], periodo: string) =>
  useQueries({ queries: ids.map((id) => opcoesAtividade(casa, id, periodo)) })

// As sessões do Plenário da Câmara são as mesmas para todos os deputados: busca uma vez por período.
const cacheSessoes = new Map<string, Promise<Set<number>>>()

function sessoesRealizadas(periodo: string) {
  let p = cacheSessoes.get(periodo)
  if (!p) {
    const [inicio, fim] = intervalo(periodo)
    p = api.sessoesPlenario(inicio, fim).then((s) => new Set(s.filter(sessaoRealizada).map((e) => e.id)))
    p.catch(() => cacheSessoes.delete(periodo))
    cacheSessoes.set(periodo, p)
  }
  return p
}

async function atividadeDeputado(id: number, periodo: string, signal: AbortSignal): Promise<Atividade> {
  const [inicio, fim] = intervalo(periodo)
  const [proposicoes, discursos, eventos, frentes, sessoes] = await Promise.all([
    api.contarProposicoes(id, periodo, signal),
    api.contarDiscursos(id, inicio, fim, signal),
    api.eventosDeputado(id, inicio, fim, signal),
    api.frentes(id, signal).then((f) => f.length),
    sessoesRealizadas(periodo),
  ])
  const presencas = new Set(eventos.filter((e) => sessoes.has(e.id)).map((e) => e.id)).size
  return { proposicoes, discursos, eventos: eventos.filter(sessaoRealizada).length, frentes, presencas, sessoes: sessoes.size }
}

// Autorias, votos e comissões vêm da legislatura inteira (uma chamada cada) e são
// compartilhados com a página do senador; o recorte por período é feito aqui.
async function atividadeSenador(id: number, periodo: string, signal: AbortSignal, client: QueryClient): Promise<Atividade> {
  const [autorias, votos, comissoes, discursos] = await Promise.all([
    client.ensureQueryData(opcoesAutorias(id)),
    client.ensureQueryData(opcoesVotos(id)),
    client.ensureQueryData(opcoesComissoes(id)),
    senado.contarDiscursos(id, periodo, signal),
  ])
  const doPeriodo = votos.filter((v) => noPeriodo(v.data, periodo)).map((v) => comparecimento(v.sigla))
  return {
    proposicoes: autorias.filter((a) => noPeriodo(a.dataApresentacao, periodo)).length,
    discursos,
    frentes: comissoes.filter((c) => c.tipo === 'frente').length,
    comissoes: comissoes.filter((c) => c.tipo === 'comissao').length,
    presencas: doPeriodo.filter((c) => c === 'presente').length,
    justificadas: doPeriodo.filter((c) => c === 'justificada').length,
    sessoes: doPeriodo.length,
  }
}

export const taxaPresenca = (a: Pick<Atividade, 'presencas' | 'sessoes'>) => (a.sessoes ? a.presencas / a.sessoes : 0)

/** Ausências sem justificativa (na Câmara, toda ausência entra aqui). */
export const faltas = (a: Atividade) => a.sessoes - a.presencas - (a.justificadas ?? 0)

// ---- Agregações de despesas ----

export function filtrarPeriodo(despesas: Despesa[], periodo: string) {
  return periodo === 'legislatura' ? despesas : despesas.filter((d) => d.ano === Number(periodo))
}

export function somar(despesas: Despesa[]) {
  return despesas.reduce((s, d) => s + d.valorLiquido, 0)
}

export function porTipo(despesas: Despesa[]) {
  const m = new Map<string, number>()
  for (const d of despesas) m.set(d.tipoDespesa, (m.get(d.tipoDespesa) ?? 0) + d.valorLiquido)
  return [...m.entries()].map(([tipo, valor]) => ({ tipo, valor })).sort((a, b) => b.valor - a.valor)
}

export function porFornecedor(despesas: Despesa[], limite = 10) {
  const m = new Map<string, { nome: string; valor: number; qtd: number }>()
  for (const d of despesas) {
    const k = d.cnpjCpfFornecedor || d.nomeFornecedor
    const atual = m.get(k) ?? { nome: d.nomeFornecedor, valor: 0, qtd: 0 }
    atual.valor += d.valorLiquido
    atual.qtd++
    m.set(k, atual)
  }
  return [...m.values()].sort((a, b) => b.valor - a.valor).slice(0, limite)
}

/** Série mensal (chave "AAAA-MM") cobrindo o período. */
export function porMes(despesas: Despesa[]) {
  const m = new Map<string, number>()
  for (const d of despesas) {
    const k = `${d.ano}-${String(d.mes).padStart(2, '0')}`
    m.set(k, (m.get(k) ?? 0) + d.valorLiquido)
  }
  return m
}

export function mesesDoPeriodo(periodo: string, ate = new Date()): string[] {
  const [inicio, fim] = intervalo(periodo)
  const limite = new Date(Math.min(new Date(fim).getTime(), ate.getTime()))
  const meses: string[] = []
  const d = new Date(Number(inicio.slice(0, 4)), Number(inicio.slice(5, 7)) - 1, 1)
  while (d <= limite) {
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() + 1)
  }
  return meses
}

// ---- Pontos de atenção (arquivos estáticos gerados por scripts/gerar-alertas.ts) ----

async function lerEstatico<T>(caminho: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(caminho, { signal })
  if (!res.ok) throw new Error(`arquivo ${caminho} indisponível (${res.status}); rode npm run dados:alertas`)
  return res.json() as Promise<T>
}

export const useIndiceAlertas = () => useQuery({
  queryKey: ['alertas-indice'],
  staleTime: HORA,
  queryFn: ({ signal }) => lerEstatico<IndiceAlertas>('/dados/indice.json', signal),
})

export const useAlertas = (ano: number | null) => useQuery({
  queryKey: ['alertas', ano],
  staleTime: HORA,
  enabled: ano !== null,
  queryFn: ({ signal }) => lerEstatico<ArquivoAlertas>(`/dados/alertas-${ano}.json`, signal),
})
