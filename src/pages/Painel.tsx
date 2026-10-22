import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useParlamentares, type Parlamentar } from '../api/hooks'
import { BarrasHorizontais, BarrasVerticais } from '../components/graficos'
import { Cartao, Carregando, Erro, Foto, Kpi } from '../components/ui'
import { CASAS, type Casa, type ConfigCasa } from '../lib/casas'
import { MAX_COMPARACAO, useComparacao } from '../lib/comparacao'
import { numero, pct } from '../lib/format'

const POR_PAGINA = 48
const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function contar<T>(itens: T[], chave: (t: T) => string) {
  const m = new Map<string, number>()
  for (const i of itens) m.set(chave(i), (m.get(chave(i)) ?? 0) + 1)
  return m
}

export function Painel({ casa }: { casa: Casa }) {
  const cfg = CASAS[casa]
  const { data, isLoading, error, refetch } = useParlamentares(casa)
  const [params, setParams] = useSearchParams()
  const [limite, setLimite] = useState(POR_PAGINA)

  const busca = params.get('q') ?? ''
  const partido = params.get('partido') ?? ''
  const uf = params.get('uf') ?? ''
  const sexo = params.get('sexo') ?? ''

  const definir = (chave: string, valor: string) => {
    const p = new URLSearchParams(params)
    if (valor) p.set(chave, valor)
    else p.delete(chave)
    setParams(p, { replace: true })
    setLimite(POR_PAGINA)
  }

  const todos = useMemo(() => data ?? [], [data])
  const partidos = useMemo(() => [...new Set(todos.map((d) => d.partido))].sort(), [todos])
  const ufs = useMemo(() => [...new Set(todos.map((d) => d.uf))].sort(), [todos])

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim())
    return todos.filter((d) =>
      (!q || normalizar(d.nome).includes(q)) &&
      (!partido || d.partido === partido) &&
      (!uf || d.uf === uf) &&
      (!sexo || d.sexo === sexo))
  }, [todos, busca, partido, uf, sexo])

  const porPartido = useMemo(() =>
    [...contar(filtrados, (d) => d.partido)].map(([sigla, qtd]) => ({ sigla, qtd })).sort((a, b) => b.qtd - a.qtd),
  [filtrados])

  const porUf = useMemo(() =>
    [...contar(filtrados, (d) => d.uf)].map(([sigla, qtd]) => ({ sigla, qtd })).sort((a, b) => b.qtd - a.qtd),
  [filtrados])

  if (isLoading) return <Carregando />
  if (error) return <Erro erro={error} tentar={() => refetch()} />

  const mulheres = filtrados.filter((d) => d.sexo === 'F').length
  const temFiltro = busca || partido || uf || sexo

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <h1>{cfg.nome}</h1>
        <p>{cfg.descricao(todos.length)} Filtre, explore e escolha até {MAX_COMPARACAO} para comparar.</p>
      </div>

      <div className="filtros" role="search">
        <input type="search" placeholder="Buscar por nome…" value={busca} onChange={(e) => definir('q', e.target.value)} aria-label="Buscar por nome" />
        <select value={partido} onChange={(e) => definir('partido', e.target.value)} aria-label="Partido">
          <option value="">Todos os partidos</option>
          {partidos.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={uf} onChange={(e) => definir('uf', e.target.value)} aria-label="Estado">
          <option value="">Todos os estados</option>
          {ufs.map((u) => <option key={u}>{u}</option>)}
        </select>
        <select value={sexo} onChange={(e) => definir('sexo', e.target.value)} aria-label="Sexo">
          <option value="">Todos os sexos</option>
          <option value="F">Mulheres</option>
          <option value="M">Homens</option>
        </select>
        {temFiltro && <button className="botao botao-sec" onClick={() => { setParams({}, { replace: true }); setLimite(POR_PAGINA) }}>Limpar filtros</button>}
      </div>

      <div className="kpis">
        <Kpi rotulo={capitalizar(cfg.plural)} valor={numero(filtrados.length)} detalhe={temFiltro ? `de ${numero(todos.length)}` : 'em exercício'} />
        <Kpi rotulo="Mulheres" valor={filtrados.length ? pct(mulheres / filtrados.length) : '—'} detalhe={`${numero(mulheres)} ${cfg.femininoPlural}`} />
        <Kpi rotulo="Partidos" valor={numero(porPartido.length)} detalhe={porPartido[0] ? `maior: ${porPartido[0].sigla} (${porPartido[0].qtd})` : undefined} />
        <Kpi rotulo="Estados" valor={numero(porUf.length)} detalhe={porUf[0] ? `maior bancada: ${porUf[0].sigla} (${porUf[0].qtd})` : undefined} />
      </div>

      <div className="grade-2">
        <Cartao titulo={`${capitalizar(cfg.plural)} por partido`} subtitulo="Clique numa barra para filtrar">
          <div className="rolagem" style={{ maxHeight: 420 }}>
            <BarrasHorizontais dados={porPartido} chave="sigla" valor="qtd" larguraRotulo={112}
              formatar={(v) => `${numero(v)} ${cfg.plural}`} formatarEixo={numero}
              onClick={(d) => definir('partido', partido === d.sigla ? '' : d.sigla)} />
          </div>
        </Cartao>
        <Cartao titulo={`${capitalizar(cfg.plural)} por estado`} subtitulo="Clique numa barra para filtrar">
          <BarrasVerticais dados={porUf} chave="sigla" valor="qtd" altura={300}
            formatar={(v) => `${numero(v)} ${cfg.plural}`} formatarEixo={numero}
            destaque={uf ? (d) => d.sigla === uf : undefined}
            onClick={(d) => definir('uf', uf === d.sigla ? '' : d.sigla)} />
          <ComposicaoSexo homens={filtrados.length - mulheres} mulheres={mulheres} />
        </Cartao>
      </div>

      <Cartao titulo={`${numero(filtrados.length)} ${cfg.plural}`} subtitulo="Marque até 4 para comparar gastos e atividade">
        {filtrados.length === 0 ? <p className="vazio">Nenhum {cfg.singular} com esses filtros.</p> : (
          <>
            <div className="lista-deputados">
              {filtrados.slice(0, limite).map((d) => <CartaoParlamentar key={d.id} d={d} cfg={cfg} />)}
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
    </div>
  )
}

function ComposicaoSexo({ homens, mulheres }: { homens: number; mulheres: number }) {
  const total = homens + mulheres || 1
  return (
    <div className="composicao">
      <div className="composicao-barra" role="img" aria-label={`${mulheres} mulheres e ${homens} homens`}>
        <span style={{ width: `${(mulheres / total) * 100}%`, background: 'var(--series-2)' }} />
        <span style={{ width: `${(homens / total) * 100}%`, background: 'var(--series-1)' }} />
      </div>
      <div className="composicao-legenda">
        <span><i style={{ background: 'var(--series-2)' }} />Mulheres {numero(mulheres)} ({pct(mulheres / total)})</span>
        <span><i style={{ background: 'var(--series-1)' }} />Homens {numero(homens)} ({pct(homens / total)})</span>
      </div>
    </div>
  )
}

function CartaoParlamentar({ d, cfg }: { d: Parlamentar; cfg: ConfigCasa }) {
  const { ids, alternar } = useComparacao(cfg.casa)
  const marcado = ids.includes(d.id)
  const cheio = ids.length >= MAX_COMPARACAO && !marcado
  return (
    <div className={`deputado ${marcado ? 'marcado' : ''}`}>
      <Link to={cfg.perfil(d.id)} className="deputado-link">
        <Foto src={d.urlFoto} nome={d.nome} tamanho={52} />
        <div className="deputado-info">
          <strong>{d.nome}</strong>
          <span className="etiqueta">{d.partido} · {d.uf}</span>
        </div>
      </Link>
      <label className={`comparar-check ${cheio ? 'desabilitado' : ''}`} title={cheio ? `Máximo de ${MAX_COMPARACAO}` : 'Comparar'}>
        <input type="checkbox" checked={marcado} disabled={cheio} onChange={() => alternar(d.id)} />
        Comparar
      </label>
    </div>
  )
}
