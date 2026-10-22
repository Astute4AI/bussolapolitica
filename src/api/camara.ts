// Cliente da API de Dados Abertos da Câmara dos Deputados
// https://dadosabertos.camara.leg.br/swagger/api.html

import { criarCliente, montarUrl, type Params } from './http'
import { LEGISLATURA_INICIO } from './periodo'

// Em dev/preview o Vite faz proxy de /api/camara; em produção, o rewrite do vercel.json.
// Defina VITE_API_BASE=https://dadosabertos.camara.leg.br/api/v2 para chamar a API direto.
const BASE = import.meta.env.VITE_API_BASE ?? '/api/camara'

export const LEGISLATURA_ATUAL = 57

export interface Deputado {
  id: number
  nome: string
  siglaPartido: string
  siglaUf: string
  idLegislatura: number
  urlFoto: string
  email: string | null
}

export interface DeputadoDetalhe {
  id: number
  nomeCivil: string
  sexo: string
  dataNascimento: string | null
  ufNascimento: string | null
  municipioNascimento: string | null
  escolaridade: string | null
  urlWebsite: string | null
  redeSocial: string[]
  ultimoStatus: {
    nome: string
    nomeEleitoral: string
    siglaPartido: string
    siglaUf: string
    urlFoto: string
    situacao: string | null
    condicaoEleitoral: string | null
    gabinete: { sala: string | null; predio: string | null; telefone: string | null; email: string | null }
  }
}

export interface Despesa {
  ano: number
  mes: number
  tipoDespesa: string
  dataDocumento: string | null
  valorLiquido: number
  nomeFornecedor: string
  cnpjCpfFornecedor: string
  urlDocumento: string | null
}

export interface Orgao {
  idOrgao: number
  siglaOrgao: string
  nomeOrgao: string
  titulo: string
  dataInicio: string
  dataFim: string | null
}

export interface Frente {
  id: number
  titulo: string
}

export const ID_PLENARIO = 180
export const TIPO_SESSAO_DELIBERATIVA = 110

export interface Evento {
  id: number
  dataHoraInicio: string
  situacao: string
  descricaoTipo: string
  orgaos: { id: number; sigla: string }[]
}

/** Sessão que de fato aconteceu ("Encerrada", "Encerrada (Final)"...) — exclui canceladas e futuras. */
export const sessaoRealizada = (e: Evento) => e.situacao.startsWith('Encerrada')

export interface Proposicao {
  id: number
  siglaTipo: string
  numero: number
  ano: number
  ementa: string
}

// ---- Requisições ----

const buscar = criarCliente('da Câmara')

interface Resposta<T> {
  dados: T
  total: number | null
}

async function get<T>(path: string, params: Params = {}, signal?: AbortSignal): Promise<Resposta<T>> {
  const { json, headers } = await buscar<{ dados: T }>(montarUrl(BASE, path, params), signal)
  const total = headers.get('X-Total-Count')
  return { dados: json.dados, total: total === null ? null : Number(total) }
}

/** Busca todas as páginas de um recurso paginado (máx. 100 itens por página). */
async function getTodos<T>(path: string, params: Params = {}, signal?: AbortSignal): Promise<T[]> {
  const itens = 100
  const primeira = await get<T[]>(path, { ...params, itens, pagina: 1 }, signal)
  const total = primeira.total ?? primeira.dados.length
  const paginas = Math.ceil(total / itens)
  if (paginas <= 1) return primeira.dados
  const resto = await Promise.all(
    Array.from({ length: paginas - 1 }, (_, i) => get<T[]>(path, { ...params, itens, pagina: i + 2 }, signal)),
  )
  return primeira.dados.concat(...resto.map((r) => r.dados))
}

/** Só a contagem (X-Total-Count) — pede 1 item para ser barato. */
async function contar(path: string, params: Params = {}, signal?: AbortSignal): Promise<number> {
  const r = await get<unknown[]>(path, { ...params, itens: 1 }, signal)
  return r.total ?? r.dados.length
}

// ---- Endpoints ----

export const api = {
  deputados: (signal?: AbortSignal) =>
    get<Deputado[]>('/deputados', { ordem: 'ASC', ordenarPor: 'nome' }, signal).then((r) => r.dados),

  idsMulheres: (signal?: AbortSignal) =>
    get<Deputado[]>('/deputados', { siglaSexo: 'F' }, signal).then((r) => new Set(r.dados.map((d) => d.id))),

  deputado: (id: number, signal?: AbortSignal) =>
    get<DeputadoDetalhe>(`/deputados/${id}`, {}, signal).then((r) => r.dados),

  // Obs.: o filtro `ano` sozinho retorna vazio; só funciona junto com `idLegislatura`.
  despesas: (id: number, periodo: string, signal?: AbortSignal) =>
    getTodos<Despesa>(`/deputados/${id}/despesas`, {
      idLegislatura: LEGISLATURA_ATUAL, ano: periodo === 'legislatura' ? undefined : periodo, ordem: 'ASC', ordenarPor: 'ano',
    }, signal),

  orgaos: (id: number, signal?: AbortSignal) =>
    getTodos<Orgao>(`/deputados/${id}/orgaos`, { dataInicio: LEGISLATURA_INICIO }, signal),

  frentes: (id: number, signal?: AbortSignal) =>
    get<Frente[]>(`/deputados/${id}/frentes`, {}, signal).then((r) => r.dados),

  proposicoesRecentes: (id: number, signal?: AbortSignal) =>
    get<Proposicao[]>('/proposicoes', {
      idDeputadoAutor: id, dataApresentacaoInicio: LEGISLATURA_INICIO, ordem: 'DESC', ordenarPor: 'id', itens: 10,
    }, signal).then((r) => r.dados),

  // /proposicoes recusa intervalos de data > 3 meses: usamos `ano` para um ano e só a data
  // inicial para a legislatura inteira.
  contarProposicoes: (id: number, periodo: string, signal?: AbortSignal) =>
    contar('/proposicoes', periodo === 'legislatura'
      ? { idDeputadoAutor: id, dataApresentacaoInicio: LEGISLATURA_INICIO }
      : { idDeputadoAutor: id, ano: periodo }, signal),

  contarDiscursos: (id: number, inicio: string, fim: string, signal?: AbortSignal) =>
    contar(`/deputados/${id}/discursos`, { dataInicio: inicio, dataFim: fim }, signal),

  /** Eventos com participação registrada do deputado (inclui sessões do Plenário em que esteve presente). */
  eventosDeputado: (id: number, inicio: string, fim: string, signal?: AbortSignal) =>
    getTodos<Evento>(`/deputados/${id}/eventos`, { dataInicio: inicio, dataFim: fim }, signal),

  /** Sessões deliberativas do Plenário (órgão 180, tipo 110) no intervalo. */
  sessoesPlenario: (inicio: string, fim: string, signal?: AbortSignal) =>
    getTodos<Evento>('/eventos', {
      idOrgao: ID_PLENARIO, codTipoEvento: TIPO_SESSAO_DELIBERATIVA, dataInicio: inicio, dataFim: fim,
    }, signal),
}

/** Foto oficial pelo id (mesmo padrão de `urlFoto` da API). */
export const fotoDeputado = (id: number) => `https://www.camara.leg.br/internet/deputado/bandep/${id}.jpg`
