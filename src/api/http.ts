// Infra comum às APIs: fila com concorrência limitada + retry com backoff.

// As APIs limitam requisições por IP (403/429 com Retry-After). Cada fonte tem sua fila com
// poucas requisições simultâneas e, ao receber um bloqueio, pausa *todas* as dela até o prazo.
const MAX_CONCORRENTES = 3
const MAX_TENTATIVAS = 5

type OuvintePausa = (ate: number, fonte: string) => void
const ouvintesPausa = new Set<OuvintePausa>()

/** Permite à interface mostrar que uma API pediu para aguardar. */
export function aoPausar(fn: OuvintePausa) {
  ouvintesPausa.add(fn)
  return () => { ouvintesPausa.delete(fn) }
}

export const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type Params = Record<string, string | number | undefined>

/** Monta URL relativa ao próprio domínio (proxy) ou absoluta, ignorando parâmetros vazios. */
export function montarUrl(base: string, path: string, params: Params = {}) {
  const url = new URL(base + path, window.location.origin)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
  }
  return url
}

/** Cria um cliente para uma fonte (ex.: "Câmara"), com fila e pausa próprias. */
export function criarCliente(fonte: string) {
  let ativos = 0
  let pausadoAte = 0
  const fila: Array<() => void> = []

  function pausar(segundos: number) {
    const ate = Date.now() + segundos * 1000
    if (ate > pausadoAte) {
      pausadoAte = ate
      ouvintesPausa.forEach((fn) => fn(ate, fonte))
    }
  }

  async function aguardarPausa() {
    while (Date.now() < pausadoAte) await espera(pausadoAte - Date.now())
  }

  function adquirir(): Promise<void> {
    if (ativos < MAX_CONCORRENTES) {
      ativos++
      return Promise.resolve()
    }
    return new Promise((resolve) => fila.push(() => { ativos++; resolve() }))
  }

  function liberar() {
    ativos--
    fila.shift()?.()
  }

  /** GET JSON; devolve o corpo já interpretado e os cabeçalhos. */
  return async function buscar<T>(url: URL, signal?: AbortSignal): Promise<{ json: T; headers: Headers }> {
    await adquirir()
    try {
      for (let tentativa = 0; ; tentativa++) {
        await aguardarPausa()
        signal?.throwIfAborted()
        let res: Response
        try {
          res = await fetch(url, { headers: { Accept: 'application/json' }, signal })
        } catch (e) {
          // Falha de rede: tenta de novo, a menos que a requisição tenha sido cancelada
          if (signal?.aborted || tentativa >= 2) throw e
          await espera(800 * 2 ** tentativa)
          continue
        }
        if (res.ok) return { json: (await res.json()) as T, headers: res.headers }
        if ((res.status === 429 || res.status === 403) && tentativa < MAX_TENTATIVAS) {
          pausar(Number(res.headers.get('Retry-After')) || 5 * (tentativa + 1))
          continue
        }
        if (res.status >= 500 && tentativa < 2) {
          await espera(800 * 2 ** tentativa)
          continue
        }
        throw new Error(
          res.status === 403 || res.status === 429
            ? `a API ${fonte} está limitando requisições; tente de novo em alguns segundos`
            : `API ${fonte} respondeu ${res.status} em ${url.pathname}`,
        )
      }
    } finally {
      liberar()
    }
  }
}
