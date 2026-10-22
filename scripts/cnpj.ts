// Consulta cadastral de CNPJs (Receita Federal) via Minha Receita, com cache versionado no repositório.
// https://minhareceita.org — projeto aberto, sem chave; consultas em sequência e com pausa para não sobrecarregar.
//
// O cache guarda só o necessário para as regras (nada de sócios ou contatos) e fica em
// dados/cnpj.json, que é commitado: a atualização diária só consulta CNPJs novos ou antigos.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface Cadastro {
  razaoSocial: string
  /** AAAA-MM-DD */
  abertura: string | null
  /** "ATIVA", "BAIXADA", "INAPTA", "SUSPENSA", "NULA" */
  situacao: string
  dataSituacao: string | null
  /** Motivo da situação (ex.: "EXTINCAO POR ENCERRAMENTO LIQUIDACAO VOLUNTARIA"); vazio quando ativa. */
  motivoSituacao?: string
  atividade: string
  municipio: string
  uf: string
  /** Quando foi consultado (AAAA-MM-DD) */
  consultadoEm: string
}

type Cache = Record<string, Cadastro | { naoEncontrado: true; consultadoEm: string }>

const API = 'https://minhareceita.org/'
const PAUSA_MS = 400
const REVALIDAR_DIAS = 180

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))
const hoje = () => new Date().toISOString().slice(0, 10)
const dias = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000

function digitoVerificador(base: string) {
  const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const r = [...base].reduce((s, d, i) => s + Number(d) * pesos[i], 0) % 11
  return r < 2 ? 0 : 11 - r
}

/** Dígitos verificadores do CNPJ (o dado oficial tem CNPJs inválidos, como 00000000000010). */
export function cnpjValido(c: string) {
  if (!/^\d{14}$/.test(c) || /^(\d)\1{13}$/.test(c)) return false
  const d1 = digitoVerificador(c.slice(0, 12))
  return d1 === Number(c[12]) && digitoVerificador(c.slice(0, 12) + d1) === Number(c[13])
}

/**
 * CNPJ da matriz de uma filial (ordem "0001"), ou null se já for a matriz. A data de abertura
 * de uma filial não diz a idade da empresa: uma locadora nacional abre filiais o tempo todo.
 */
export function matrizDe(c: string) {
  if (c.slice(8, 12) === '0001') return null
  const base = c.slice(0, 8) + '0001'
  const d1 = digitoVerificador(base)
  return `${base}${d1}${digitoVerificador(base + d1)}`
}

export async function lerCache(caminho: string): Promise<Cache> {
  try {
    return JSON.parse(await readFile(caminho, 'utf8')) as Cache
  } catch {
    return {}
  }
}

async function consultar(cnpj: string): Promise<Cadastro | null> {
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    let res: Response
    try {
      res = await fetch(API + cnpj, { headers: { Accept: 'application/json' } })
    } catch {
      await espera(2000 * (tentativa + 1))
      continue
    }
    // 404: não existe; 400: a API recusou o número (formato inválido)
    if (res.status === 404 || res.status === 400) return null
    if (res.status === 429 || res.status >= 500) {
      await espera((Number(res.headers.get('Retry-After')) || 5 * (tentativa + 1)) * 1000)
      continue
    }
    if (!res.ok) throw new Error(`Minha Receita respondeu ${res.status} para ${cnpj}`)
    const d = await res.json() as {
      razao_social: string; data_inicio_atividade: string | null; descricao_situacao_cadastral: string
      data_situacao_cadastral: string | null; cnae_fiscal_descricao: string; municipio: string; uf: string
      descricao_motivo_situacao_cadastral: string
    }
    return {
      razaoSocial: d.razao_social,
      abertura: d.data_inicio_atividade,
      situacao: d.descricao_situacao_cadastral,
      dataSituacao: d.data_situacao_cadastral,
      motivoSituacao: d.descricao_situacao_cadastral === 'ATIVA' ? '' : d.descricao_motivo_situacao_cadastral,
      atividade: d.cnae_fiscal_descricao,
      municipio: d.municipio,
      uf: d.uf,
      consultadoEm: hoje(),
    }
  }
  throw new Error(`Minha Receita indisponível para ${cnpj}`)
}

/**
 * Completa o cache para os CNPJs pedidos: primeiro os nunca consultados, depois os mais antigos
 * que REVALIDAR_DIAS. Consulta no máximo `limite` por execução (o resto fica para a próxima).
 */
export async function enriquecer(caminho: string, cnpjs: Iterable<string>, limite: number) {
  const cache = await lerCache(caminho)
  const pedidos = [...new Set(cnpjs)].filter(cnpjValido)
  const novos = pedidos.filter((c) => !cache[c])
  // Antigos, ou não ativos consultados antes de o cache guardar o motivo da situação
  const semMotivo = (c: string) => { const v = cache[c]; return ehCadastro(v) && v.situacao !== 'ATIVA' && v.motivoSituacao === undefined }
  const antigos = pedidos
    .filter((c) => cache[c] && (dias(cache[c].consultadoEm, hoje()) > REVALIDAR_DIAS || semMotivo(c)))
    .sort((a, b) => cache[a].consultadoEm.localeCompare(cache[b].consultadoEm))
  const fila = [...novos, ...antigos].slice(0, limite)

  console.log(`CNPJs: ${pedidos.length} pedidos, ${novos.length} novos, ${antigos.length} para revalidar; consultando ${fila.length}`)
  let feitos = 0
  const salvar = async () => {
    await mkdir(dirname(caminho), { recursive: true })
    // Chaves ordenadas: diffs pequenos no git
    const ordenado = Object.fromEntries(Object.keys(cache).sort().map((k) => [k, cache[k]]))
    await writeFile(caminho, JSON.stringify(ordenado, null, 0).replace(/},"/g, '},\n"'))
  }
  for (const cnpj of fila) {
    const c = await consultar(cnpj)
    cache[cnpj] = c ?? { naoEncontrado: true, consultadoEm: hoje() }
    if (++feitos % 100 === 0) {
      console.log(`  ${feitos}/${fila.length}`)
      await salvar() // progresso salvo se a execução for interrompida
    }
    await espera(PAUSA_MS)
  }
  if (fila.length) await salvar()
  const faltam = novos.length - Math.min(novos.length, fila.length)
  return { cache, faltam }
}

export const ehCadastro = (v: Cache[string] | undefined): v is Cadastro => !!v && !('naoEncontrado' in v)
