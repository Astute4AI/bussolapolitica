import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { taxaPresenca, useAtividade, useDeputado, useDespesas, useOrgaos, useProposicoesRecentes } from '../api/hooks'
import { rotuloPeriodo } from '../api/periodo'
import { AlertasDoParlamentar } from '../components/Alertas'
import { GraficosDespesas, useResumoDespesas } from '../components/Despesas'
import { Cartao, Carregando, Erro, Foto, Kpi, SeletorPeriodo } from '../components/ui'
import { MAX_COMPARACAO, useComparacao } from '../lib/comparacao'
import { idade, moeda, numero, pct } from '../lib/format'

export function PaginaDeputado() {
  const id = Number(useParams().id)
  const [periodo, setPeriodo] = useState('2025')
  const deputado = useDeputado(id)
  const despesas = useDespesas('camara', id, periodo)
  const atividade = useAtividade('camara', id, periodo)
  const orgaos = useOrgaos(id)
  const proposicoes = useProposicoesRecentes(id)
  const { ids, alternar } = useComparacao('camara')

  const resumo = useResumoDespesas(despesas.data, periodo)
  const { doPeriodo, total, mesesComGasto } = resumo

  const orgaosAtuais = useMemo(() => {
    const vistos = new Map<number, NonNullable<typeof orgaos.data>[number]>()
    for (const o of orgaos.data ?? []) if (!o.dataFim || new Date(o.dataFim) > new Date()) vistos.set(o.idOrgao, o)
    return [...vistos.values()]
  }, [orgaos.data])

  if (deputado.isLoading) return <Carregando />
  if (deputado.error || !deputado.data) return <Erro erro={deputado.error ?? 'Deputado não encontrado'} tentar={() => deputado.refetch()} />

  const d = deputado.data
  const s = d.ultimoStatus
  const marcado = ids.includes(id)
  const anos = idade(d.dataNascimento)

  return (
    <div className="pagina">
      <Link to="/" className="voltar">← Painel</Link>

      <section className="perfil">
        <Foto src={s.urlFoto} nome={s.nome} tamanho={112} />
        <div className="perfil-info">
          <h1>{s.nomeEleitoral || s.nome}</h1>
          <p className="perfil-sub">{s.siglaPartido} · {s.siglaUf} · {s.situacao ?? '—'}{s.condicaoEleitoral ? ` · ${s.condicaoEleitoral}` : ''}</p>
          <dl className="perfil-dados">
            <div><dt>Nome civil</dt><dd>{d.nomeCivil}</dd></div>
            {anos !== null && <div><dt>Idade</dt><dd>{anos} anos</dd></div>}
            {d.municipioNascimento && <div><dt>Naturalidade</dt><dd>{d.municipioNascimento}/{d.ufNascimento}</dd></div>}
            {d.escolaridade && <div><dt>Escolaridade</dt><dd>{d.escolaridade}</dd></div>}
            {s.gabinete?.email && <div><dt>E-mail</dt><dd><a href={`mailto:${s.gabinete.email}`}>{s.gabinete.email}</a></dd></div>}
            {s.gabinete?.telefone && <div><dt>Gabinete</dt><dd>Sala {s.gabinete.sala}, anexo {s.gabinete.predio} · (61) {s.gabinete.telefone}</dd></div>}
          </dl>
          {d.redeSocial.length > 0 && (
            <div className="redes">
              {d.redeSocial.map((r) => <a key={r} href={r} target="_blank" rel="noreferrer">{new URL(r).hostname.replace('www.', '')}</a>)}
            </div>
          )}
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
        <Kpi rotulo="Proposições" valor={numero(atividade.data?.proposicoes ?? 0)} carregando={atividade.isLoading} detalhe="como autor" />
        <Kpi rotulo="Discursos" valor={numero(atividade.data?.discursos ?? 0)} carregando={atividade.isLoading} detalhe="em plenário" />
        <Kpi rotulo="Presença no Plenário" valor={atividade.data ? pct(taxaPresenca(atividade.data)) : '—'} carregando={atividade.isLoading}
          detalhe={atividade.data ? `${numero(atividade.data.presencas)} de ${numero(atividade.data.sessoes)} sessões` : 'sessões deliberativas'} />
        <Kpi rotulo="Frentes" valor={numero(atividade.data?.frentes ?? 0)} carregando={atividade.isLoading} detalhe="parlamentares" />
      </div>

      <GraficosDespesas consulta={despesas} resumo={resumo} />

      <AlertasDoParlamentar casa="camara" id={id} periodo={periodo} />

      <div className="grade-2">
        <Cartao titulo="Comissões e órgãos atuais">
          {orgaos.isLoading ? <Carregando texto="Carregando…" /> : orgaosAtuais.length ? (
            <ul className="lista-simples">
              {orgaosAtuais.map((o) => (
                <li key={o.idOrgao}><span className="etiqueta">{o.siglaOrgao}</span> {o.nomeOrgao} <span className="mudo">— {o.titulo}</span></li>
              ))}
            </ul>
          ) : <p className="vazio">Nenhum órgão ativo.</p>}
        </Cartao>
        <Cartao titulo="Proposições recentes" subtitulo="Últimas de autoria na legislatura">
          {proposicoes.isLoading ? <Carregando texto="Carregando…" /> : proposicoes.data?.length ? (
            <ul className="lista-simples">
              {proposicoes.data.map((p) => (
                <li key={p.id}>
                  <a href={`https://www.camara.leg.br/propostas-legislativas/${p.id}`} target="_blank" rel="noreferrer" className="etiqueta">
                    {p.siglaTipo} {p.numero}/{p.ano}
                  </a>{' '}
                  <span className="ementa">{p.ementa}</span>
                </li>
              ))}
            </ul>
          ) : <p className="vazio">Nenhuma proposição.</p>}
        </Cartao>
      </div>
    </div>
  )
}
