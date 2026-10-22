import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  faltas, taxaPresenca, useAtividade, useAutorias, useComissoesSenado, useDespesas, useSenador, useSenadores,
} from '../api/hooks'
import { rotuloPeriodo } from '../api/periodo'
import { urlMateria } from '../api/senado'
import { AlertasDoParlamentar } from '../components/Alertas'
import { GraficosDespesas, useResumoDespesas } from '../components/Despesas'
import { Cartao, Carregando, Erro, Foto, Kpi, SeletorPeriodo } from '../components/ui'
import { MAX_COMPARACAO, useComparacao } from '../lib/comparacao'
import { idade, moeda, numero, pct } from '../lib/format'

// "33036333" -> "(61) 3303-6333"
const telefone = (t: string) => (t.length === 8 ? `(61) ${t.slice(0, 4)}-${t.slice(4)}` : t)
const dataBr = (d: string) => d.slice(0, 10).split('-').reverse().join('/')

export function PaginaSenador() {
  const id = Number(useParams().id)
  const [periodo, setPeriodo] = useState('2025')
  const senadores = useSenadores()
  const detalhe = useSenador(id)
  const despesas = useDespesas('senado', id, periodo)
  const atividade = useAtividade('senado', id, periodo)
  const comissoes = useComissoesSenado(id)
  const autorias = useAutorias(id)
  const { ids, alternar } = useComparacao('senado')

  const resumo = useResumoDespesas(despesas.data, periodo)
  const { doPeriodo, total, mesesComGasto } = resumo

  if (senadores.isLoading) return <Carregando />
  const s = senadores.data?.find((x) => x.id === id)
  if (senadores.error || !s) {
    return <Erro erro={senadores.error ?? 'Senador não encontrado entre os em exercício'} tentar={() => senadores.refetch()} />
  }

  const d = detalhe.data
  const anos = idade(d?.dataNascimento ?? null)
  const marcado = ids.includes(id)
  const a = atividade.data
  const comissoesAtuais = (comissoes.data ?? []).filter((c) => c.tipo === 'comissao')

  return (
    <div className="pagina">
      <Link to="/senado" className="voltar">← Painel do Senado</Link>

      <section className="perfil">
        <Foto src={s.urlFoto} nome={s.nome} tamanho={112} />
        <div className="perfil-info">
          <h1>{s.nome}</h1>
          <p className="perfil-sub">
            {s.partido} · {s.uf} · {s.participacao === 'Titular' ? 'Titular' : `${s.participacao} em exercício`}
            {s.bloco ? ` · ${s.bloco}` : ''}
          </p>
          <dl className="perfil-dados">
            <div><dt>Nome completo</dt><dd>{s.nomeCompleto}</dd></div>
            {anos !== null && <div><dt>Idade</dt><dd>{anos} anos</dd></div>}
            {d?.naturalidade && <div><dt>Naturalidade</dt><dd>{d.naturalidade}/{d.ufNaturalidade}</dd></div>}
            {s.fimMandato && <div><dt>Mandato até</dt><dd>{dataBr(s.fimMandato)}</dd></div>}
            {s.email && <div><dt>E-mail</dt><dd><a href={`mailto:${s.email}`}>{s.email}</a></dd></div>}
            {d && d.telefones.length > 0 && <div><dt>Gabinete</dt><dd>{d.endereco ? `${d.endereco} · ` : ''}{d.telefones.map(telefone).join(', ')}</dd></div>}
          </dl>
          <div className="redes">
            <a href={s.urlPagina} target="_blank" rel="noreferrer">Página no Senado</a>
          </div>
        </div>
        <button className={`botao ${marcado ? 'botao-sec' : ''}`} onClick={() => alternar(id)}
          disabled={!marcado && ids.length >= MAX_COMPARACAO}>
          {marcado ? '✓ Na comparação' : '+ Comparar'}
        </button>
      </section>

      <div className="barra-periodo">
        <h2>Período: {rotuloPeriodo(periodo)}</h2>
        <SeletorPeriodo valor={periodo} onChange={setPeriodo} />
      </div>

      <div className="kpis kpis-6">
        <Kpi rotulo="Cota parlamentar" valor={moeda(total)} carregando={despesas.isLoading} detalhe={`${numero(doPeriodo.length)} documentos`} />
        <Kpi rotulo="Média mensal" valor={moeda(mesesComGasto ? total / mesesComGasto : 0)} carregando={despesas.isLoading} detalhe={`${mesesComGasto} meses com gasto`} />
        <Kpi rotulo="Proposições" valor={numero(a?.proposicoes ?? 0)} carregando={atividade.isLoading} detalhe="como autor ou coautor" />
        <Kpi rotulo="Discursos" valor={numero(a?.discursos ?? 0)} carregando={atividade.isLoading} detalhe="pronunciamentos" />
        <Kpi rotulo="Presença em votações" valor={a?.sessoes ? pct(taxaPresenca(a)) : '—'} carregando={atividade.isLoading}
          detalhe={a ? `${numero(a.presencas)} de ${numero(a.sessoes)} · ${numero(a.justificadas ?? 0)} justif. · ${numero(faltas(a))} faltas` : 'votações nominais'} />
        <Kpi rotulo="Comissões" valor={numero(a?.comissoes ?? 0)} carregando={atividade.isLoading} detalhe={`e ${numero(a?.frentes ?? 0)} frentes`} />
      </div>
      {atividade.error && <Erro erro={atividade.error} tentar={() => atividade.refetch()} />}

      <GraficosDespesas consulta={despesas} resumo={resumo}
        carregando="Carregando despesas (o Senado publica um arquivo por ano com todos os senadores; pode levar alguns segundos)…" />

      <AlertasDoParlamentar casa="senado" id={id} periodo={periodo} />

      <div className="grade-2">
        <Cartao titulo="Comissões atuais" subtitulo="Frentes e grupos parlamentares não incluídos">
          {comissoes.isLoading ? <Carregando texto="Carregando…" /> : comissoesAtuais.length ? (
            <ul className="lista-simples">
              {comissoesAtuais.map((c) => (
                <li key={`${c.codigo}-${c.participacao}`}>
                  <span className="etiqueta">{c.sigla}</span> {c.nome} <span className="mudo">— {c.participacao}</span>
                </li>
              ))}
            </ul>
          ) : <p className="vazio">Nenhuma comissão ativa.</p>}
        </Cartao>
        <Cartao titulo="Proposições recentes" subtitulo="Últimas de autoria ou coautoria">
          {autorias.isLoading ? <Carregando texto="Carregando…" /> : autorias.data?.length ? (
            <ul className="lista-simples">
              {autorias.data.slice(0, 10).map((p) => {
                const url = urlMateria(p)
                return (
                  <li key={p.id}>
                    {url ? <a href={url} target="_blank" rel="noreferrer" className="etiqueta">{p.identificacao}</a>
                      : <span className="etiqueta">{p.identificacao}</span>}{' '}
                    <span className="ementa">{p.ementa}</span>
                  </li>
                )
              })}
            </ul>
          ) : <p className="vazio">Nenhuma proposição.</p>}
        </Cartao>
      </div>
    </div>
  )
}
