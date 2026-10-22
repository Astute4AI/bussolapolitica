import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { REGRAS, valorDoAlerta, type ParlamentarComAlertas, type RegraId } from '../api/alertas'
import { fotoDeputado } from '../api/camara'
import { fotoSenador } from '../api/senado'
import { useAlertas, useIndiceAlertas, useSenadores } from '../api/hooks'
import { AvisoMetodologia, ListaAlertas } from '../components/Alertas'
import { Cartao, Carregando, Erro, Foto } from '../components/ui'
import { CASAS, type Casa } from '../lib/casas'
import { moeda, numero } from '../lib/format'

const POR_PAGINA = 30
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function Atencao() {
  const [params, setParams] = useSearchParams()
  const [limite, setLimite] = useState(POR_PAGINA)
  const indice = useIndiceAlertas()
  const senadores = useSenadores()

  // Padrão: o ano completo mais recente (o atual ainda está em andamento)
  const anos = indice.data?.anos ?? []
  const anoPadrao = anos.find((a) => a < new Date().getFullYear()) ?? anos[0] ?? null
  const ano = Number(params.get('ano')) || anoPadrao
  const alertas = useAlertas(ano)

  const casa = (params.get('casa') ?? '') as Casa | ''
  const regra = (params.get('regra') ?? '') as RegraId | ''
  const partido = params.get('partido') ?? ''
  const uf = params.get('uf') ?? ''
  const busca = params.get('q') ?? ''

  const definir = (chave: string, valor: string) => {
    const p = new URLSearchParams(params)
    if (valor) p.set(chave, valor)
    else p.delete(chave)
    setParams(p, { replace: true })
    setLimite(POR_PAGINA)
  }

  const todos = useMemo(() => alertas.data?.parlamentares ?? [], [alertas.data])
  const partidos = useMemo(() => [...new Set(todos.map((p) => p.partido).filter((p): p is string => !!p))].sort(), [todos])
  const ufs = useMemo(() => [...new Set(todos.map((p) => p.uf).filter((u): u is string => !!u && u !== 'NA'))].sort(), [todos])

  // Filtros de casa/partido/UF/nome primeiro; a regra filtra os alertas de cada parlamentar
  const base = useMemo(() => {
    const q = normalizar(busca.trim())
    return todos.filter((p) =>
      (!casa || p.casa === casa) && (!partido || p.partido === partido) && (!uf || p.uf === uf) &&
      (!q || normalizar(p.nome).includes(q)))
  }, [todos, casa, partido, uf, busca])

  const filtrados = useMemo(() =>
    base
      .map((p) => (regra ? { ...p, alertas: p.alertas.filter((a) => a.regra === regra) } : p))
      .filter((p) => p.alertas.length > 0)
      .sort((a, b) => b.alertas.length - a.alertas.length ||
        b.alertas.reduce((s, x) => s + valorDoAlerta(x), 0) - a.alertas.reduce((s, x) => s + valorDoAlerta(x), 0)),
  [base, regra])

  const contagem = useMemo(() => {
    const m = new Map<RegraId, number>()
    for (const p of base) for (const a of p.alertas) m.set(a.regra, (m.get(a.regra) ?? 0) + 1)
    return m
  }, [base])

  const senadoresAtuais = useMemo(() => new Set(senadores.data?.map((s) => s.id)), [senadores.data])

  if (indice.isLoading) return <Carregando />
  if (indice.error) return <Erro erro={indice.error} tentar={() => indice.refetch()} />

  const temFiltro = casa || regra || partido || uf || busca

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <h1>Pontos de atenção nos gastos</h1>
        <p>
          Despesas da cota parlamentar de deputados e senadores que fogem do padrão, segundo quatro regras automáticas.
          Calculado sobre os arquivos anuais completos das duas casas.
        </p>
      </div>

      <AvisoMetodologia />

      <div className="barra-periodo">
        <h2>Ano: {ano}{alertas.data?.parcial ? ' (em andamento)' : ''}</h2>
        <div className="segmentado" role="radiogroup" aria-label="Ano">
          {anos.map((a) => (
            <button key={a} role="radio" aria-checked={a === ano} className={a === ano ? 'ativo' : ''}
              onClick={() => definir('ano', a === anoPadrao ? '' : String(a))}>
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="filtros" role="search">
        <input type="search" placeholder="Buscar por nome…" value={busca} onChange={(e) => definir('q', e.target.value)} aria-label="Buscar por nome" />
        <select value={casa} onChange={(e) => definir('casa', e.target.value)} aria-label="Casa">
          <option value="">Câmara e Senado</option>
          <option value="camara">Câmara</option>
          <option value="senado">Senado</option>
        </select>
        <select value={partido} onChange={(e) => definir('partido', e.target.value)} aria-label="Partido">
          <option value="">Todos os partidos</option>
          {partidos.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={uf} onChange={(e) => definir('uf', e.target.value)} aria-label="Estado">
          <option value="">Todos os estados</option>
          {ufs.map((u) => <option key={u}>{u}</option>)}
        </select>
        {temFiltro && <button className="botao botao-sec" onClick={() => { setParams(ano === anoPadrao ? {} : { ano: String(ano) }, { replace: true }); setLimite(POR_PAGINA) }}>Limpar filtros</button>}
      </div>

      {alertas.error ? <Erro erro={alertas.error} tentar={() => alertas.refetch()} /> : alertas.isLoading ? <Carregando /> : (
        <>
          <div className="kpis">
            {(Object.keys(REGRAS) as RegraId[]).map((r) => (
              <button key={r} className="kpi kpi-botao" aria-pressed={regra === r} title={REGRAS[r].resumo}
                onClick={() => definir('regra', regra === r ? '' : r)}>
                <div className="kpi-rotulo">{REGRAS[r].titulo}</div>
                <div className="kpi-valor">{numero(contagem.get(r) ?? 0)}</div>
                <div className="kpi-detalhe">
                  {r === 'pico-dezembro' && alertas.data?.parcial ? 'só para anos completos' : regra === r ? 'filtrando · clique para limpar' : 'clique para filtrar'}
                </div>
              </button>
            ))}
          </div>

          <Cartao titulo={`${numero(filtrados.length)} parlamentares com pontos de atenção`}
            subtitulo={regra ? REGRAS[regra].resumo : 'Ordenados por número de alertas e valor envolvido'}>
            {filtrados.length === 0 ? <p className="vazio">Nenhum alerta com esses filtros.</p> : (
              <>
                <div className="lista-alertas">
                  {filtrados.slice(0, limite).map((p) => (
                    <CartaoAlertas key={`${p.casa}-${p.id}`} p={p} ano={ano!}
                      linkPerfil={p.casa === 'camara' || senadoresAtuais.has(p.id)} />
                  ))}
                </div>
                {filtrados.length > limite && (
                  <div className="centro">
                    <button className="botao botao-sec" onClick={() => setLimite((l) => l + POR_PAGINA)}>
                      Mostrar mais ({numero(filtrados.length - limite)} restantes)
                    </button>
                  </div>
                )}
              </>
            )}
          </Cartao>

          <p className="mudo">
            Gerado em {new Date(alertas.data!.geradoEm).toLocaleString('pt-BR')} a partir de{' '}
            <a href={alertas.data!.fontes.camara}>arquivo da Câmara</a> e <a href={alertas.data!.fontes.senado}>arquivo do Senado</a>.
            Senadores: valores da CEAPS; a Câmara tem teto de cota diferente por estado.
          </p>
        </>
      )}
    </div>
  )
}

function CartaoAlertas({ p, ano, linkPerfil }: { p: ParlamentarComAlertas; ano: number; linkPerfil: boolean }) {
  const cfg = CASAS[p.casa]
  const foto = p.casa === 'camara' ? fotoDeputado(p.id) : fotoSenador(p.id)
  return (
    <article className="parlamentar-alertas">
      <div className="parlamentar-alertas-topo">
        <Foto src={foto} nome={p.nome} tamanho={36} />
        <div>
          {linkPerfil ? <Link to={cfg.perfil(p.id)} className="nome">{p.nome}</Link> : <span className="nome">{p.nome}</span>}
          <div className="etiqueta">{[p.partido, p.uf].filter(Boolean).join(' · ') || '—'}</div>
        </div>
        <span className="selo-casa">{cfg.curto}</span>
        <span className="total">Gasto no ano: {moeda(p.totalAno)}</span>
      </div>
      <ListaAlertas alertas={p.alertas} casa={p.casa} ano={ano} />
    </article>
  )
}
