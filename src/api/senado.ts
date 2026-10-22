// Cliente dos Dados Abertos do Senado Federal
// https://www12.senado.leg.br/dados-abertos
// - Legislativo: https://legis.senado.leg.br/dadosabertos/api-docs/swagger-ui/index.html
// - Administrativo (cota CEAPS): https://adm.senado.gov.br/adm-dadosabertos/swagger-ui/index.html

import { criarCliente, montarUrl, type Params } from './http'
import { LEGISLATURA_FIM, LEGISLATURA_INICIO, anosDoPeriodo, intervalo } from './periodo'
import type { Despesa } from './camara'

// Em dev/preview o Vite faz proxy; em produção, o rewrite do vercel.json.
// A API administrativa não envia cabeçalhos CORS, então o proxy é obrigatório para ela.
const BASE_LEGIS = '/api/senado-legis'
const BASE_ADM = '/api/senado-adm'

const buscar = criarCliente('do Senado')

const get = <T>(base: string, path: string, params: Params = {}, signal?: AbortSignal) =>
  buscar<T>(montarUrl(base, path, params), signal).then((r) => r.json)

/** A API em XML convertida para JSON devolve um objeto (em vez de lista) quando há um só item. */
const lista = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v])

// "AAAA-MM-DD" -> "AAAAMMDD" (formato dos serviços legados)
const compacta = (d: string) => d.replaceAll('-', '')

// ---- Tipos (já normalizados para o app) ----

export interface Senador {
  id: number
  nome: string
  nomeCompleto: string
  partido: string
  uf: string
  sexo: 'F' | 'M'
  urlFoto: string
  urlPagina: string
  email: string | null
  /** "Titular", "1º Suplente"… */
  participacao: string
  bloco: string | null
  /** Fim do mandato (segunda legislatura do mandato). */
  fimMandato: string | null
}

export interface SenadorDetalhe {
  dataNascimento: string | null
  naturalidade: string | null
  ufNaturalidade: string | null
  endereco: string | null
  telefones: string[]
}

export interface ComissaoSenado {
  codigo: number
  sigla: string
  nome: string
  casa: string
  participacao: string
  dataInicio: string
  tipo: 'comissao' | 'frente' | 'grupo'
}

export interface Autoria {
  id: number
  codigoMateria: number | null
  identificacao: string
  ementa: string
  dataApresentacao: string
}

/** Voto do senador numa votação nominal do Plenário. */
export interface VotoSenador {
  codigoSessaoVotacao: number
  data: string
  sigla: string
}

// Votos que indicam presença: votou (aberto ou secreto), presente sem registrar voto ou presidindo.
const VOTOS_PRESENTE = new Set(['Sim', 'Não', 'Abstenção', 'Votou', 'P-NRV', 'NA', 'Obstrução', 'P-OD'])
/** "NCom": não compareceu. Outros códigos (licença, missão, atividade parlamentar...) são ausências justificadas. */
export type Comparecimento = 'presente' | 'justificada' | 'falta'
export function comparecimento(sigla: string): Comparecimento {
  if (VOTOS_PRESENTE.has(sigla) || sigla.startsWith('Presidente')) return 'presente'
  return sigla === 'NCom' ? 'falta' : 'justificada'
}

// ---- Formatos crus (só o que usamos) ----

interface IdentificacaoCru {
  CodigoParlamentar: string
  NomeParlamentar: string
  NomeCompletoParlamentar: string
  SexoParlamentar: string
  UrlFotoParlamentar?: string
  UrlPaginaParlamentar?: string
  EmailParlamentar?: string
  SiglaPartidoParlamentar?: string
  UfParlamentar?: string
  Bloco?: { NomeApelido?: string; NomeBloco?: string }
}

interface ParlamentarListaCru {
  IdentificacaoParlamentar: IdentificacaoCru
  Mandato?: {
    DescricaoParticipacao?: string
    PrimeiraLegislaturaDoMandato?: { DataFim?: string }
    SegundaLegislaturaDoMandato?: { DataFim?: string }
  }
}

interface DespesaCeapsCru {
  ano: number
  mes: number
  codSenador: number
  tipoDespesa: string | null
  cpfCnpj: string | null
  fornecedor: string | null
  data: string | null
  valorReembolsado: number
}

// Foto oficial por HTTPS (a URL da API é http:, bloqueada como conteúdo misto em produção)
export const fotoSenador = (id: number) => `https://www.senado.leg.br/senadores/img/fotos-oficiais/senador${id}.jpg`

function senadorDaLista(p: ParlamentarListaCru): Senador {
  const i = p.IdentificacaoParlamentar
  const id = Number(i.CodigoParlamentar)
  return {
    id,
    nome: i.NomeParlamentar,
    nomeCompleto: i.NomeCompletoParlamentar,
    partido: i.SiglaPartidoParlamentar ?? 'S/Partido',
    uf: i.UfParlamentar ?? '',
    sexo: i.SexoParlamentar === 'Feminino' ? 'F' : 'M',
    urlFoto: fotoSenador(id),
    urlPagina: i.UrlPaginaParlamentar?.replace(/^http:/, 'https:') ?? `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${id}`,
    email: i.EmailParlamentar ?? null,
    participacao: p.Mandato?.DescricaoParticipacao ?? 'Titular',
    bloco: i.Bloco?.NomeApelido ?? i.Bloco?.NomeBloco ?? null,
    fimMandato: p.Mandato?.SegundaLegislaturaDoMandato?.DataFim ?? p.Mandato?.PrimeiraLegislaturaDoMandato?.DataFim ?? null,
  }
}

function tipoComissao(nome: string): ComissaoSenado['tipo'] {
  if (nome.startsWith('Frente Parlamentar')) return 'frente'
  if (nome.startsWith('Grupo Parlamentar')) return 'grupo'
  return 'comissao'
}

// ---- Endpoints ----

export const senado = {
  /** Senadores em exercício (titulares e suplentes que assumiram). */
  senadores: (signal?: AbortSignal) =>
    get<{ ListaParlamentarEmExercicio: { Parlamentares: { Parlamentar: ParlamentarListaCru | ParlamentarListaCru[] } } }>(
      BASE_LEGIS, '/senador/lista/atual.json', {}, signal,
    ).then((r) => lista(r.ListaParlamentarEmExercicio.Parlamentares.Parlamentar)
      .map(senadorDaLista)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))),

  senador: (id: number, signal?: AbortSignal) =>
    get<{ DetalheParlamentar: { Parlamentar: {
      DadosBasicosParlamentar?: { DataNascimento?: string; Naturalidade?: string; UfNaturalidade?: string; EnderecoParlamentar?: string }
      Telefones?: { Telefone: { NumeroTelefone: string; IndicadorFax?: string } | { NumeroTelefone: string; IndicadorFax?: string }[] }
    } } }>(BASE_LEGIS, `/senador/${id}.json`, {}, signal).then((r): SenadorDetalhe => {
      const p = r.DetalheParlamentar.Parlamentar
      const b = p.DadosBasicosParlamentar ?? {}
      return {
        dataNascimento: b.DataNascimento ?? null,
        naturalidade: b.Naturalidade ?? null,
        ufNaturalidade: b.UfNaturalidade ?? null,
        endereco: b.EnderecoParlamentar?.replace(/\s+/g, ' ').trim() ?? null,
        telefones: lista(p.Telefones?.Telefone).filter((t) => t.IndicadorFax !== 'Sim').map((t) => t.NumeroTelefone),
      }
    }),

  /** Comissões, frentes e grupos dos quais o senador é membro hoje. */
  comissoes: (id: number, signal?: AbortSignal) =>
    get<{ MembroComissaoParlamentar: { Parlamentar: { MembroComissoes?: { Comissao: unknown } } } }>(
      BASE_LEGIS, `/senador/${id}/comissoes.json`, {}, signal,
    ).then((r) => lista(r.MembroComissaoParlamentar.Parlamentar.MembroComissoes?.Comissao as {
      IdentificacaoComissao: { CodigoComissao: string; SiglaComissao: string; NomeComissao: string; SiglaCasaComissao: string }
      DescricaoParticipacao: string; DataInicio: string; DataFim?: string
    }[]).filter((c) => !c.DataFim || c.DataFim >= new Date().toISOString().slice(0, 10))
      .map((c): ComissaoSenado => ({
        codigo: Number(c.IdentificacaoComissao.CodigoComissao),
        sigla: c.IdentificacaoComissao.SiglaComissao,
        nome: c.IdentificacaoComissao.NomeComissao,
        casa: c.IdentificacaoComissao.SiglaCasaComissao,
        participacao: c.DescricaoParticipacao,
        dataInicio: c.DataInicio,
        tipo: tipoComissao(c.IdentificacaoComissao.NomeComissao),
      }))),

  /**
   * Proposições de autoria ou coautoria. Sem filtro de data, `/processo` devolve todas do
   * mandato atual numa só chamada; o recorte por período é feito no cliente.
   */
  autorias: (id: number, signal?: AbortSignal) =>
    get<{ id: number; codigoMateria: number | null; identificacao: string; ementa: string; dataApresentacao: string }[]>(
      BASE_LEGIS, '/processo', { codigoParlamentarAutor: id }, signal,
    ).then((r) => r.map((p): Autoria => ({
      id: p.id, codigoMateria: p.codigoMateria, identificacao: p.identificacao, ementa: p.ementa, dataApresentacao: p.dataApresentacao,
    })).sort((a, b) => b.dataApresentacao.localeCompare(a.dataApresentacao))),

  /** Votações nominais do Plenário na legislatura, com o voto do senador. */
  votos: (id: number, signal?: AbortSignal) =>
    get<{ codigoSessaoVotacao: number; dataSessao: string; votos: { codigoParlamentar: number; siglaVotoParlamentar: string }[] }[]>(
      BASE_LEGIS, '/votacao', { codigoParlamentar: id, dataInicio: LEGISLATURA_INICIO, dataFim: LEGISLATURA_FIM }, signal,
    ).then((r) => r.flatMap((v): VotoSenador[] => {
      const voto = v.votos.find((x) => x.codigoParlamentar === id)
      return voto ? [{ codigoSessaoVotacao: v.codigoSessaoVotacao, data: v.dataSessao, sigla: voto.siglaVotoParlamentar }] : []
    })),

  /**
   * Quantidade de discursos no período. O serviço devolve no máximo um ano antes de `dataFim`,
   * então a legislatura é consultada ano a ano.
   */
  contarDiscursos: async (id: number, periodo: string, signal?: AbortSignal) => {
    const [inicio, fim] = intervalo(periodo)
    const anos = anosDoPeriodo(periodo)
    const contagens = await Promise.all(anos.map((ano) => {
      const de = `${ano}-01-01` < inicio ? inicio : `${ano}-01-01`
      const ate = `${ano}-12-31` > fim ? fim : `${ano}-12-31`
      return get<{ DiscursosParlamentar: { Parlamentar: { Pronunciamentos?: { Pronunciamento: unknown } } } }>(
        BASE_LEGIS, `/senador/${id}/discursos.json`, { dataInicio: compacta(de), dataFim: compacta(ate) }, signal,
      ).then((r) => lista(r.DiscursosParlamentar.Parlamentar.Pronunciamentos?.Pronunciamento).length)
    }))
    return contagens.reduce((s, n) => s + n, 0)
  },

  /**
   * Todas as despesas da cota (CEAPS) de um ano, de todos os senadores, agrupadas por código.
   * Não há filtro por senador nesse serviço: o arquivo do ano tem cerca de 10 MB.
   */
  despesasDoAno: (ano: number) =>
    get<DespesaCeapsCru[]>(BASE_ADM, `/senadores/despesas_ceaps/${ano}`).then((r) => {
      const porSenador = new Map<number, Despesa[]>()
      for (const d of r) {
        const lista = porSenador.get(d.codSenador) ?? []
        lista.push({
          ano: d.ano,
          mes: d.mes,
          tipoDespesa: d.tipoDespesa?.trim() || 'Não informado',
          dataDocumento: d.data,
          valorLiquido: d.valorReembolsado,
          nomeFornecedor: d.fornecedor?.trim() || 'Não informado',
          cnpjCpfFornecedor: d.cpfCnpj ?? '',
          urlDocumento: null,
        })
        porSenador.set(d.codSenador, lista)
      }
      return porSenador
    }),
}

/** Link da matéria no portal do Senado (só existe para quem tem código legado). */
export const urlMateria = (a: Autoria) =>
  a.codigoMateria ? `https://www25.senado.leg.br/web/atividade/materias/-/materia/${a.codigoMateria}` : null
