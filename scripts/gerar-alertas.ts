// Gera public/dados/alertas-AAAA.json com "pontos de atenção" nos gastos da cota.
//
// Uso: npm run dados:alertas [-- --anos 2024,2025,2026]
//
// Usa os arquivos anuais em lote (não a API paginada) para não esbarrar no limite de
// requisições: Câmara ~7 MB (zip) e Senado ~10 MB por ano. Os downloads ficam em cache em
// node_modules/.cache/politicosbrasil por 12 h. Metodologia: docs/alertas-de-gastos.md.

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { unzipSync, strFromU8 } from 'fflate'
import type {
  Alerta, AlertaDocumentoRepetido, ArquivoAlertas, IndiceAlertas, ParlamentarComAlertas,
} from '../src/api/alertas.ts'
import type { Casa } from '../src/lib/casas.ts'

const RAIZ = new URL('..', import.meta.url).pathname
const CACHE = join(RAIZ, 'node_modules/.cache/politicosbrasil')
const SAIDA = join(RAIZ, 'public/dados')
const VALIDADE_CACHE = 12 * 60 * 60 * 1000

const FONTES: Record<Casa, (ano: number) => string> = {
  camara: (ano) => `https://www.camara.leg.br/cotas/Ano-${ano}.csv.zip`,
  senado: (ano) => `https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/despesas_ceaps/${ano}`,
}
const LISTA_SENADORES = 'https://legis.senado.leg.br/dadosabertos/senador/lista/legislatura/57.json'
const LISTA_SENADORES_ATUAIS = 'https://legis.senado.leg.br/dadosabertos/senador/lista/atual.json'

// ---- Parâmetros das regras (calibrados com os dados de 2025; ver docs) ----
const PARES = { razaoMinima: 3, percentil: 0.95, valorMinimo: 20_000, grupoMinimo: 8 }
const CONCENTRACAO = { participacaoMinima: 0.4, valorMinimo: 50_000 }
const REPETIDO = { valorMinimo: 100 }
const DEZEMBRO = { razaoMinima: 2, valorMinimo: 30_000, mesesMinimos: 6 }

// Categorias em que a regra não faz sentido (ver docs/alertas-de-gastos.md)
const ehPassagem = (t: string) => /^passage/i.test(t)
const ehAluguel = (t: string) => /^aluguel/i.test(t)
const SEM_CONCENTRACAO = (t: string) => ehPassagem(t) || ehAluguel(t)
const SEM_REPETIDO = (t: string) => ehPassagem(t) || ehAluguel(t) || /^(telefonia|complementação)/i.test(t)

interface Lancamento {
  casa: Casa
  id: number
  nome: string
  partido: string | null
  uf: string | null
  tipo: string
  fornecedor: string
  /** CNPJ/CPF só com dígitos ('' se ausente). */
  documento: string
  numero: string
  data: string
  mes: number
  valor: number
  parcela: number
  url: string | null
  /** Câmara: o parlamentar devolveu o valor deste documento (ex.: lançamento em duplicidade já corrigido). */
  restituido: boolean
}

// ---- Download com cache ----

async function baixar(url: string, arquivo: string): Promise<Uint8Array> {
  const destino = join(CACHE, arquivo)
  try {
    const s = await stat(destino)
    if (Date.now() - s.mtimeMs < VALIDADE_CACHE) return new Uint8Array(await readFile(destino))
  } catch { /* sem cache */ }
  console.log(`  baixando ${url}`)
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${url} respondeu ${res.status}`)
  const dados = new Uint8Array(await res.arrayBuffer())
  await mkdir(CACHE, { recursive: true })
  await writeFile(destino, dados)
  return dados
}

// ---- Leitura: Câmara (CSV ; com aspas, UTF-8 com BOM) ----

function* linhasCsv(texto: string): Generator<string[]> {
  let campo = ''
  let linha: string[] = []
  let aspas = false
  for (let i = texto.charCodeAt(0) === 0xfeff ? 1 : 0; i < texto.length; i++) {
    const c = texto[i]
    if (aspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++ } else aspas = false
      } else campo += c
    } else if (c === '"') aspas = true
    else if (c === ';') { linha.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      linha.push(campo); campo = ''
      yield linha
      linha = []
    } else campo += c
  }
  if (campo || linha.length) { linha.push(campo); yield linha }
}

async function lerCamara(ano: number): Promise<Lancamento[]> {
  const zip = unzipSync(await baixar(FONTES.camara(ano), `camara-${ano}.csv.zip`))
  const csv = Object.values(zip)[0]
  const linhas = linhasCsv(strFromU8(csv))
  const cab = linhas.next().value as string[]
  const col = (n: string) => {
    const i = cab.indexOf(n)
    if (i < 0) throw new Error(`coluna ${n} não encontrada no CSV da Câmara`)
    return i
  }
  const c = {
    id: col('ideCadastro'), nome: col('txNomeParlamentar'), uf: col('sgUF'), partido: col('sgPartido'), leg: col('codLegislatura'),
    tipo: col('txtDescricao'), fornecedor: col('txtFornecedor'), doc: col('txtCNPJCPF'), numero: col('txtNumero'),
    data: col('datEmissao'), mes: col('numMes'), valor: col('vlrLiquido'), parcela: col('numParcela'), url: col('urlDocumento'),
    idDocumento: col('ideDocumento'), restituicao: col('vlrRestituicao'),
  }
  const saida: Lancamento[] = []
  const restituidos = new Set<string>()
  const idDoc = new Map<Lancamento, string>()
  for (const l of linhas) {
    // Sem ideCadastro: lideranças partidárias. Legislatura: o app trata só da 57ª (jan/2023 é da 56ª).
    if (l.length < cab.length || !l[c.id] || l[c.leg] !== '57') continue
    saida.push({
      casa: 'camara',
      id: Number(l[c.id]),
      nome: l[c.nome],
      partido: l[c.partido] || null,
      uf: l[c.uf] || null,
      tipo: l[c.tipo],
      fornecedor: l[c.fornecedor].trim(),
      documento: l[c.doc].replace(/\D/g, ''),
      numero: l[c.numero],
      data: l[c.data].slice(0, 10),
      mes: Number(l[c.mes]),
      // A devolução vem numa linha própria (valor líquido 0, vlrRestituicao > 0): entra negativa
      valor: (Number(l[c.valor]) || 0) - (Number(l[c.restituicao]) || 0),
      parcela: Number(l[c.parcela]) || 0,
      url: l[c.url] || null,
      restituido: false,
    })
    if (Number(l[c.restituicao]) > 0) restituidos.add(l[c.idDocumento])
    idDoc.set(saida[saida.length - 1], l[c.idDocumento])
  }
  for (const x of saida) if (restituidos.has(idDoc.get(x)!)) x.restituido = true
  return saida
}

// ---- Leitura: Senado (JSON) ----

interface CeapsCru {
  codSenador: number; nomeSenador: string; tipoDespesa: string | null; fornecedor: string | null; cpfCnpj: string | null
  documento: string | null; data: string | null; mes: number; valorReembolsado: number
}

type IdentificacaoSenador = { CodigoParlamentar: string; NomeParlamentar: string; SiglaPartidoParlamentar?: string; UfParlamentar?: string }

/** Nomes de todos os senadores da legislatura; partido e UF só existem na lista dos em exercício. */
async function senadoresDaLegislatura() {
  const [legislatura, atual] = await Promise.all([
    baixar(LISTA_SENADORES, 'senadores-57.json'),
    baixar(LISTA_SENADORES_ATUAIS, 'senadores-atuais.json'),
  ]).then((r) => r.map((b) => JSON.parse(strFromU8(b))))
  const lista = (v: { Parlamentar: unknown }) =>
    [v.Parlamentar].flat() as { IdentificacaoParlamentar: IdentificacaoSenador }[]
  const mapa = new Map<number, { nome: string; partido: string | null; uf: string | null }>()
  for (const { IdentificacaoParlamentar: i } of [
    ...lista(legislatura.ListaParlamentarLegislatura.Parlamentares),
    ...lista(atual.ListaParlamentarEmExercicio.Parlamentares),
  ]) {
    mapa.set(Number(i.CodigoParlamentar), { nome: i.NomeParlamentar, partido: i.SiglaPartidoParlamentar ?? null, uf: i.UfParlamentar ?? null })
  }
  return mapa
}

async function lerSenado(ano: number, senadores: Awaited<ReturnType<typeof senadoresDaLegislatura>>): Promise<Lancamento[]> {
  const dados = JSON.parse(strFromU8(await baixar(FONTES.senado(ano), `senado-${ano}.json`))) as CeapsCru[]
  return dados
    .filter((d) => !(ano === 2023 && d.mes < 2)) // 57ª legislatura começa em fev/2023
    .map((d) => {
      const s = senadores.get(d.codSenador)
      return {
        casa: 'senado' as const,
        id: d.codSenador,
        nome: s?.nome ?? d.nomeSenador,
        partido: s?.partido ?? null,
        uf: s?.uf ?? null,
        tipo: d.tipoDespesa?.trim() || 'Não informado',
        fornecedor: d.fornecedor?.trim() || 'Não informado',
        documento: (d.cpfCnpj ?? '').replace(/\D/g, ''),
        numero: d.documento ?? '',
        data: (d.data ?? '').slice(0, 10),
        mes: d.mes,
        valor: d.valorReembolsado,
        parcela: 0,
        url: null,
        restituido: false,
      }
    })
}

// ---- Utilidades ----

const somaPor = <K>(itens: Lancamento[], chave: (l: Lancamento) => K) => {
  const m = new Map<K, number>()
  for (const l of itens) m.set(chave(l), (m.get(chave(l)) ?? 0) + l.valor)
  return m
}

function mediana(v: number[]) {
  const o = [...v].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

const percentil = (v: number[], p: number) => [...v].sort((a, b) => a - b)[Math.floor(p * (v.length - 1))]
const centavos = (v: number) => Math.round(v * 100) / 100

/** CNPJ formatado; CPF (pessoa física) mascarado. */
function formatarDocumento(d: string) {
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`
  return d
}

/** "s/nº", "0001234" e "1234" viram a mesma coisa; sem número útil devolve ''. */
function normalizarNumero(n: string) {
  const s = n.replace(/[^0-9a-z]/gi, '').toUpperCase().replace(/^0+/, '')
  return s.length < 2 || /^S?N[O]?$/.test(s) || s === 'SN' ? '' : s
}

const chaveFornecedor = (l: Lancamento) => l.documento || l.fornecedor.toUpperCase()

// ---- Regras ----

type Achados = Map<number, Alerta[]>
const registrar = (achados: Achados, id: number, a: Alerta) => achados.set(id, [...(achados.get(id) ?? []), a])

function acimaDosPares(casa: Casa, itens: Lancamento[], achados: Achados) {
  const uf = new Map(itens.map((l) => [l.id, l.uf]))
  // Passagens dependem da distância até Brasília: na Câmara compara só com o mesmo estado;
  // no Senado (3 por estado) não há grupo grande o bastante, então passagens ficam de fora.
  const grupos = new Map<string, { tipo: string; grupo: string; valores: Map<number, number> }>()
  for (const [chave, valor] of somaPor(itens, (l) => `${l.id}\u0000${l.tipo}`)) {
    const [idTxt, tipo] = chave.split('\u0000')
    const id = Number(idTxt)
    if (valor <= 0) continue
    let grupo = 'nacional'
    if (ehPassagem(tipo)) {
      if (casa === 'senado' || !uf.get(id)) continue
      grupo = uf.get(id)!
    }
    const k = `${tipo}\u0000${grupo}`
    if (!grupos.has(k)) grupos.set(k, { tipo, grupo, valores: new Map() })
    grupos.get(k)!.valores.set(id, valor)
  }
  for (const { tipo, grupo, valores } of grupos.values()) {
    if (valores.size < PARES.grupoMinimo) continue
    const lista = [...valores.values()]
    const med = mediana(lista)
    const corte = percentil(lista, PARES.percentil)
    for (const [id, valor] of valores) {
      if (valor >= PARES.razaoMinima * med && valor >= corte && valor >= PARES.valorMinimo) {
        registrar(achados, id, {
          regra: 'acima-dos-pares', tipoDespesa: tipo, valor: centavos(valor), mediana: centavos(med),
          razao: Math.round((valor / med) * 10) / 10, grupo, tamanhoGrupo: valores.size,
        })
      }
    }
  }
}

function concentracaoFornecedor(itens: Lancamento[], totais: Map<number, number>, achados: Achados) {
  const clientes = new Map<string, Set<number>>()
  for (const l of itens) {
    const k = chaveFornecedor(l)
    if (!clientes.has(k)) clientes.set(k, new Set())
    clientes.get(k)!.add(l.id)
  }
  const nomes = new Map(itens.map((l) => [chaveFornecedor(l), l.fornecedor]))
  const considerados = itens.filter((l) => !SEM_CONCENTRACAO(l.tipo))
  for (const [chave, valor] of somaPor(considerados, (l) => `${l.id}\u0000${chaveFornecedor(l)}`)) {
    const [idTxt, fornecedor] = chave.split('\u0000')
    const id = Number(idTxt)
    const total = totais.get(id) ?? 0
    if (total <= 0 || valor < CONCENTRACAO.valorMinimo || valor / total < CONCENTRACAO.participacaoMinima) continue
    registrar(achados, id, {
      regra: 'concentracao-fornecedor', fornecedor: nomes.get(fornecedor) ?? fornecedor,
      documento: /^\d+$/.test(fornecedor) ? formatarDocumento(fornecedor) : '',
      valor: centavos(valor), participacao: Math.round((valor / total) * 1000) / 1000, clientes: clientes.get(fornecedor)!.size,
    })
  }
}

function documentoRepetido(itens: Lancamento[], achados: Achados) {
  const grupos = new Map<string, Lancamento[]>()
  for (const l of itens) {
    // Parcelas (bilhetes parcelados na Câmara) repetem número e valor legitimamente
    if (SEM_REPETIDO(l.tipo) || l.parcela !== 0 || l.restituido || l.valor < REPETIDO.valorMinimo) continue
    const numero = normalizarNumero(l.numero)
    if (!numero) continue
    const k = [l.id, chaveFornecedor(l), numero, l.valor.toFixed(2)].join('\u0000')
    grupos.set(k, [...(grupos.get(k) ?? []), l])
  }
  for (const todos of grupos.values()) {
    // Contratos mensais (aluguel, locação de veículo) costumam repetir o número do contrato com
    // o mesmo valor todo mês: isso é normal. Só conta como repetição a mesma nota lançada com
    // a mesma data de emissão ou no mesmo mês de competência.
    const contar = (f: (x: Lancamento) => string | number) => {
      const m = new Map<string | number, number>()
      for (const x of todos) m.set(f(x), (m.get(f(x)) ?? 0) + 1)
      return m
    }
    const porData = contar((x) => x.data)
    const porMes = contar((x) => x.mes)
    const lista = todos.filter((x) => porData.get(x.data)! > 1 || porMes.get(x.mes)! > 1)
    if (lista.length < 2) continue
    const l = lista[0]
    const alerta: AlertaDocumentoRepetido = {
      regra: 'documento-repetido', fornecedor: l.fornecedor, documento: formatarDocumento(l.documento),
      numero: l.numero.trim(), valorUnitario: centavos(l.valor), ocorrencias: lista.length,
      lancamentos: lista.map((x) => ({ data: x.data, mes: x.mes, url: x.url })),
    }
    registrar(achados, l.id, alerta)
  }
}

function picoDezembro(itens: Lancamento[], achados: Achados) {
  const porMes = somaPor(itens, (l) => `${l.id}\u0000${l.mes}`)
  for (const id of new Set(itens.map((l) => l.id))) {
    const outros = Array.from({ length: 11 }, (_, i) => porMes.get(`${id}\u0000${i + 1}`) ?? 0).filter((v) => v > 0)
    const dezembro = porMes.get(`${id}\u000012`) ?? 0
    if (outros.length < DEZEMBRO.mesesMinimos) continue
    const media = outros.reduce((s, v) => s + v, 0) / outros.length
    if (dezembro >= DEZEMBRO.razaoMinima * media && dezembro >= DEZEMBRO.valorMinimo) {
      registrar(achados, id, {
        regra: 'pico-dezembro', valorDezembro: centavos(dezembro), mediaOutrosMeses: centavos(media),
        razao: Math.round((dezembro / media) * 10) / 10,
      })
    }
  }
}

function analisar(casa: Casa, itens: Lancamento[], parcial: boolean): ParlamentarComAlertas[] {
  const totais = somaPor(itens, (l) => l.id)
  const achados: Achados = new Map()
  acimaDosPares(casa, itens, achados)
  concentracaoFornecedor(itens, totais, achados)
  documentoRepetido(itens, achados)
  if (!parcial) picoDezembro(itens, achados)

  // Dados mais recentes do parlamentar (partido pode mudar ao longo do ano)
  const ultimo = new Map<number, Lancamento>()
  for (const l of itens) if (!ultimo.has(l.id) || l.data > ultimo.get(l.id)!.data) ultimo.set(l.id, l)

  return [...achados].map(([id, alertas]) => {
    const l = ultimo.get(id)!
    return { casa, id, nome: l.nome, partido: l.partido, uf: l.uf, totalAno: centavos(totais.get(id) ?? 0), alertas }
  })
}

// ---- Principal ----

/**
 * Grava o JSON só se o conteúdo (ignorando `geradoEm`) mudou, preservando a data anterior.
 * Assim a atualização agendada não gera commit quando os dados não mudam.
 */
async function gravarSeMudou<T extends { geradoEm: string }>(caminho: string, novo: T): Promise<boolean> {
  try {
    const antigo = JSON.parse(await readFile(caminho, 'utf8')) as T
    if (JSON.stringify({ ...antigo, geradoEm: '' }) === JSON.stringify({ ...novo, geradoEm: '' })) return false
  } catch { /* arquivo novo ou ilegível */ }
  await writeFile(caminho, JSON.stringify(novo))
  return true
}

async function main() {
  const anoAtual = new Date().getFullYear()
  const arg = process.argv.indexOf('--anos')
  const anos = arg > 0
    ? process.argv[arg + 1].split(',').map(Number)
    : [anoAtual - 1, anoAtual]
  if (anos.some((a) => !Number.isInteger(a) || a < 2023 || a > anoAtual)) throw new Error('anos válidos: 2023 até o atual')

  await mkdir(SAIDA, { recursive: true })
  const senadores = await senadoresDaLegislatura()
  const geradoEm = new Date().toISOString()
  let mudou = false

  for (const ano of anos) {
    console.log(`Ano ${ano}`)
    const parcial = ano === anoAtual
    const [camara, senado] = await Promise.all([lerCamara(ano), lerSenado(ano, senadores)])
    const parlamentares = [...analisar('camara', camara, parcial), ...analisar('senado', senado, parcial)]
      .sort((a, b) => b.alertas.length - a.alertas.length || b.totalAno - a.totalAno)
    const arquivo: ArquivoAlertas = {
      ano, parcial, geradoEm,
      fontes: { camara: FONTES.camara(ano), senado: FONTES.senado(ano) },
      parlamentares,
    }
    const gravou = await gravarSeMudou(join(SAIDA, `alertas-${ano}.json`), arquivo)
    mudou ||= gravou
    const porRegra = new Map<string, number>()
    for (const p of parlamentares) for (const a of p.alertas) porRegra.set(a.regra, (porRegra.get(a.regra) ?? 0) + 1)
    console.log(`  ${camara.length} lançamentos da Câmara, ${senado.length} do Senado`)
    console.log(`  ${parlamentares.length} parlamentares com alertas:`, Object.fromEntries(porRegra))
    console.log(gravou ? '  arquivo atualizado' : '  sem mudanças')
  }

  // Índice com todos os anos já gerados (inclusive de execuções anteriores)
  const existentes: number[] = []
  for (let a = 2023; a <= anoAtual; a++) {
    try { await stat(join(SAIDA, `alertas-${a}.json`)); existentes.push(a) } catch { /* não gerado */ }
  }
  // A data do índice só avança quando algum ano mudou
  const caminhoIndice = join(SAIDA, 'indice.json')
  let dataIndice = geradoEm
  if (!mudou) {
    try { dataIndice = (JSON.parse(await readFile(caminhoIndice, 'utf8')) as IndiceAlertas).geradoEm } catch { /* sem índice */ }
  }
  await gravarSeMudou(caminhoIndice, { anos: existentes.sort((a, b) => b - a), geradoEm: dataIndice } satisfies IndiceAlertas)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
