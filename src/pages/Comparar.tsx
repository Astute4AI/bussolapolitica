import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  faltas, filtrarPeriodo, mesesDoPeriodo, porMes, porTipo, somar,
  taxaPresenca, useAtividadeVarios, useDespesasVarios, useParlamentares, type Atividade, type Parlamentar,
} from '../api/hooks'
import type { Despesa } from '../api/camara'
import { rotuloPeriodo } from '../api/periodo'
import { BarrasAgrupadas, BarrasHorizontais, Linhas, type Serie } from '../components/graficos'
import { Cartao, Carregando, Erro, Foto, SeletorPeriodo } from '../components/ui'
import { CASAS, type Casa, type ConfigCasa } from '../lib/casas'
import { MAX_COMPARACAO, useComparacao } from '../lib/comparacao'
import { moeda, numero, pct, rotuloMes, tipoCurto } from '../lib/format'

const cor = (i: number) => `var(--series-${i + 1})`

export function Comparar({ casa }: { casa: Casa }) {
  const cfg = CASAS[casa]
  const { ids, definir, remover, alternar } = useComparacao(casa)
  const [params, setParams] = useSearchParams()
  const [periodo, setPeriodo] = useState('2025')
  const deputados = useParlamentares(casa)
  // URL ?ids= tem prioridade na primeira carga (link compartilhado); depois a URL segue a seleção.
  const pendente = useRef<number[] | null>(
    (() => {
      const daUrl = (params.get('ids') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0)
      return daUrl.length ? daUrl.slice(0, MAX_COMPARACAO) : null
    })(),
  )

  useEffect(() => {
    if (pendente.current) definir(pendente.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pendente.current) {
      // Espera a seleção vinda da URL ser aplicada antes de reescrever a URL
      // (pode chegar menor: IDs inválidos são descartados no App)
      const esperado = pendente.current
      if (ids.length === 0 || !ids.every((id) => esperado.includes(id))) return
      pendente.current = null
    }
    setParams((atual) => {
      const p = new URLSearchParams(atual)
      if (ids.length) p.set('ids', ids.join(','))
      else p.delete('ids')
      return p
    }, { replace: true })
  }, [ids]) // eslint-disable-line react-hooks/exhaustive-deps

  const escolhidos = useMemo(
    () => ids.map((id) => deputados.data?.find((d) => d.id === id)).filter((d): d is Parlamentar => !!d),
    [ids, deputados.data],
  )

  const despesas = useDespesasVarios(casa, ids, periodo)
  const atividade = useAtividadeVarios(casa, ids, periodo)

  if (deputados.isLoading) return <Carregando />
  if (deputados.error) return <Erro erro={deputados.error} tentar={() => deputados.refetch()} />

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <h1>Comparar {cfg.plural}</h1>
        <p>Escolha até {MAX_COMPARACAO} {cfg.plural} para comparar uso da cota parlamentar, presença e atividade legislativa.</p>
      </div>

      <div className="comparados">
        {escolhidos.map((d, i) => (
          <div key={d.id} className="comparado" style={{ ['--cor' as string]: cor(i) }}>
            <Foto src={d.urlFoto} nome={d.nome} tamanho={44} />
            <div>
              <Link to={cfg.perfil(d.id)}><strong>{d.nome}</strong></Link>
              <div className="etiqueta">{d.partido} · {d.uf}</div>
            </div>
            <button className="x" onClick={() => remover(d.id)} aria-label={`Remover ${d.nome}`}>×</button>
          </div>
        ))}
        {ids.length < MAX_COMPARACAO && (
          <BuscaParlamentar cfg={cfg} parlamentares={deputados.data ?? []} excluir={ids} onEscolher={(id) => alternar(id)} />
        )}
      </div>

      {escolhidos.length === 0 ? (
        <p className="vazio">Nenhum {cfg.singular} selecionado. Busque acima ou marque “Comparar” no <Link to={cfg.inicio}>painel</Link>.</p>
      ) : (
        <>
          <div className="barra-periodo">
            <h2>Período: {rotuloPeriodo(periodo)}</h2>
            <SeletorPeriodo valor={periodo} onChange={setPeriodo} />
          </div>
          <Resultados
            cfg={cfg}
            escolhidos={escolhidos}
            periodo={periodo}
            despesas={despesas.map((q) => q.data)}
            carregandoDespesas={despesas.some((q) => q.isLoading)}
            erroDespesas={despesas.find((q) => q.error)?.error}
            atividade={atividade.map((q) => q.data)}
          />
        </>
      )}
    </div>
  )
}

function BuscaParlamentar({ cfg, parlamentares, excluir, onEscolher }: {
  cfg: ConfigCasa; parlamentares: Parlamentar[]; excluir: number[]; onEscolher: (id: number) => void
}) {
  const [q, setQ] = useState('')
  const [aberto, setAberto] = useState(false)
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const resultados = q.trim().length < 2 ? [] : parlamentares
    .filter((d) => !excluir.includes(d.id) && norm(`${d.nome} ${d.partido} ${d.uf}`).includes(norm(q.trim())))
    .slice(0, 8)

  return (
    <div className="busca-deputado">
      <input type="search" placeholder={`+ Adicionar ${cfg.singular} (nome, partido ou UF)`} value={q}
        onChange={(e) => { setQ(e.target.value); setAberto(true) }}
        onFocus={() => setAberto(true)} onBlur={() => setTimeout(() => setAberto(false), 150)}
        aria-label={`Adicionar ${cfg.singular} à comparação`} />
      {aberto && resultados.length > 0 && (
        <ul className="sugestoes" role="listbox">
          {resultados.map((d) => (
            <li key={d.id} role="option" aria-selected={false}>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => { onEscolher(d.id); setQ('') }}>
                <Foto src={d.urlFoto} nome={d.nome} tamanho={24} />
                <span>{d.nome}</span> <span className="etiqueta">{d.partido} · {d.uf}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Resultados({ cfg, escolhidos, periodo, despesas, carregandoDespesas, erroDespesas, atividade }: {
  cfg: ConfigCasa; escolhidos: Parlamentar[]; periodo: string
  despesas: (Despesa[] | undefined)[]; carregandoDespesas: boolean; erroDespesas: unknown
  atividade: (Atividade | undefined)[]
}) {
  const METRICAS = cfg.metricas
  const series: Serie[] = escolhidos.map((d, i) => ({ chave: `d${d.id}`, nome: d.nome, cor: cor(i) }))
  const doPeriodo = despesas.map((ds) => filtrarPeriodo(ds ?? [], periodo))
  const totais = doPeriodo.map(somar)

  const tiposComparados = (() => {
    const agregados = doPeriodo.map(porTipo)
    const geral = porTipo(doPeriodo.flat()).slice(0, 8)
    return geral.map(({ tipo }) => {
      const linha: Record<string, unknown> = { tipo: tipoCurto(tipo) }
      escolhidos.forEach((d, i) => { linha[`d${d.id}`] = agregados[i].find((t) => t.tipo === tipo)?.valor ?? 0 })
      return linha
    })
  })()

  const mensal = (() => {
    const mapas = doPeriodo.map(porMes)
    return mesesDoPeriodo(periodo).map((mes) => {
      const linha: Record<string, unknown> = { mes }
      escolhidos.forEach((d, i) => { linha[`d${d.id}`] = mapas[i].get(mes) ?? 0 })
      return linha
    })
  })()

  const meses = mensal.length || 1

  // Linhas da tabela-resumo; "melhor" marca o maior valor (ou menor, para gasto)
  const taxas = atividade.map((a) => (a ? taxaPresenca(a) : undefined))
  const linhas: { rotulo: string; valores: (number | undefined)[]; formatar: (v: number, i: number) => string; menorMelhor?: boolean }[] = [
    { rotulo: cfg.presenca.rotulo, valores: taxas, formatar: (v, i) => `${pct(v)} (${atividade[i]?.presencas}/${atividade[i]?.sessoes})` },
    { rotulo: 'Gasto total da cota', valores: carregandoDespesas ? [] : totais, formatar: moeda, menorMelhor: true },
    { rotulo: 'Média mensal', valores: carregandoDespesas ? [] : totais.map((t) => t / meses), formatar: moeda, menorMelhor: true },
    ...METRICAS.map((m) => ({ rotulo: m.rotulo, valores: atividade.map((a) => a?.[m.chave]), formatar: numero })),
  ]

  return (
    <>
      <Cartao titulo="Resumo" subtitulo="Destaque: menor gasto e maior atividade no período">
        <div className="rolagem-x">
          <table className="tabela tabela-comparacao">
            <thead>
              <tr>
                <th />
                {escolhidos.map((d, i) => (
                  <th key={d.id} className="num"><span className="ponto" style={{ background: cor(i) }} />{d.nome}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const validos = l.valores.filter((v): v is number => v !== undefined)
                // Gasto zero geralmente é deputado afastado no período: não conta como "melhor"
                const candidatos = l.menorMelhor ? validos.filter((v) => v > 0) : validos
                const alvo = validos.length === escolhidos.length && escolhidos.length > 1 && candidatos.length
                  ? (l.menorMelhor ? Math.min(...candidatos) : Math.max(...candidatos)) : null
                return (
                  <tr key={l.rotulo}>
                    <th scope="row">{l.rotulo}</th>
                    {escolhidos.map((d, i) => {
                      const v = l.valores[i]
                      return (
                        <td key={d.id} className={`num ${v !== undefined && v === alvo ? 'melhor' : ''}`}>
                          {v === undefined ? <span className="esqueleto" style={{ width: '6ch' }} /> : l.formatar(v, i)}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Cartao>

      <Cartao titulo={cfg.presenca.titulo} subtitulo={cfg.presenca.explicacao}>
        <div className="presencas">
          {escolhidos.map((d, i) => {
            const a = atividade[i]
            const t = a ? taxaPresenca(a) : 0
            return (
              <div key={d.id} className="presenca">
                <div className="presenca-topo">
                  <span><span className="ponto" style={{ background: cor(i) }} />{d.nome}</span>
                  {a ? <strong className="num">{pct(t)}</strong> : <span className="esqueleto" style={{ width: '5ch' }} />}
                </div>
                <div className="presenca-trilho" role="img"
                  aria-label={a ? `${d.nome}: ${a.presencas} presenças em ${a.sessoes} ${cfg.presenca.unidade}` : `${d.nome}: carregando`}>
                  <span style={{ width: `${t * 100}%`, background: cor(i) }} />
                </div>
                <div className="presenca-detalhe">
                  {a ? <>{numero(a.presencas)} de {numero(a.sessoes)} {cfg.presenca.unidade} · <Ausencias a={a} /></> : 'Carregando…'}
                </div>
              </div>
            )
          })}
        </div>
      </Cartao>

      {erroDespesas ? <Erro erro={erroDespesas} /> : null}
      {carregandoDespesas ? <Carregando texto="Carregando despesas (pode levar alguns segundos)…" /> : (
        <>
          <div className="grade-2">
            <Cartao titulo="Gasto total da cota">
              <BarrasHorizontais
                dados={escolhidos.map((d, i) => ({ nome: d.nome, valor: totais[i] }))}
                chave="nome" valor="valor" cores={escolhidos.map((_, i) => cor(i))} alturaBarra={40} larguraRotulo={140} />
            </Cartao>
            <Cartao titulo="Atividade legislativa" subtitulo="Cada métrica em sua própria escala">
              <div className="multiplos">
                {METRICAS.map((m) => (
                  <div key={m.chave}>
                    <h3 className="multiplo-titulo">{m.rotulo}</h3>
                    <BarrasHorizontais
                      dados={escolhidos.map((d, i) => ({ nome: d.nome.split(' ')[0], valor: atividade[i]?.[m.chave] ?? 0 }))}
                      chave="nome" valor="valor" cores={escolhidos.map((_, i) => cor(i))}
                      formatar={numero} formatarEixo={numero} alturaBarra={22} larguraRotulo={80} />
                  </div>
                ))}
              </div>
            </Cartao>
          </div>

          <Cartao titulo="Gasto mensal" subtitulo="Valor da cota por mês">
            <Linhas dados={mensal} chave="mes" series={series} formatarRotulo={rotuloMes} />
          </Cartao>

          <Cartao titulo="Gasto por tipo de despesa" subtitulo="As 8 categorias com maior gasto somado">
            {tiposComparados.length ? <BarrasAgrupadas dados={tiposComparados} chave="tipo" series={series} />
              : <p className="vazio">Sem despesas no período.</p>}
          </Cartao>
        </>
      )}
    </>
  )
}

/** Câmara: só o total de ausências. Senado: separa justificadas de faltas. */
function Ausencias({ a }: { a: Atividade }) {
  if (a.justificadas === undefined) return <>{numero(faltas(a))} ausências</>
  return <>{numero(a.justificadas)} justificadas · {numero(faltas(a))} {faltas(a) === 1 ? 'falta' : 'faltas'}</>
}
