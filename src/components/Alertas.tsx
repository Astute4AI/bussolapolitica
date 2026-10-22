import { Link } from 'react-router-dom'
import { REGRAS, valorDoAlerta, type Alerta } from '../api/alertas'
import { useAlertas, useIndiceAlertas } from '../api/hooks'
import { Cartao } from './ui'
import { CASAS, type Casa } from '../lib/casas'
import { moeda, numero, pct, rotuloMes, tipoCurto } from '../lib/format'

const dataBr = (d: string) => d.split('-').reverse().join('/')

/** Uma frase por alerta, com os números que o justificam. */
function Descricao({ a, casa, ano }: { a: Alerta; casa: Casa; ano: number }) {
  const cfg = CASAS[casa]
  switch (a.regra) {
    case 'acima-dos-pares':
      return (
        <span>
          <strong>{tipoCurto(a.tipoDespesa)}</strong>: {moeda(a.valor)}, {String(a.razao).replace('.', ',')}× a mediana
          ({moeda(a.mediana)}) dos {numero(a.tamanhoGrupo)} {cfg.plural}{a.grupo === 'nacional' ? '' : ` de ${a.grupo}`} que usaram a categoria.
        </span>
      )
    case 'concentracao-fornecedor':
      return (
        <span>
          <strong>{a.fornecedor}</strong>{a.documento && <span className="mudo"> ({a.documento})</span>} recebeu {moeda(a.valor)},{' '}
          {pct(a.participacao)} de todo o gasto do ano.{' '}
          {a.clientes === 1 ? `Nenhum outro ${cfg.singular} pagou esse fornecedor.` : `Fornecedor de ${a.clientes} ${cfg.plural}.`}
        </span>
      )
    case 'documento-repetido':
      return (
        <span>
          Documento nº <strong>{a.numero}</strong> de <strong>{a.fornecedor}</strong>, {moeda(a.valorUnitario)}, lançado{' '}
          {a.ocorrencias} vezes.{' '}
          <span className="alerta-links">
            {a.lancamentos.map((l, i) => (
              <span key={i}>
                {i > 0 && ' · '}
                {l.url ? <a href={l.url} target="_blank" rel="noreferrer">{dataBr(l.data)}</a> : dataBr(l.data)}
                {' '}(ref. {rotuloMes(`${ano}-${String(l.mes).padStart(2, '0')}`)})
              </span>
            ))}
          </span>
        </span>
      )
    case 'pico-dezembro':
      return (
        <span>
          Dezembro: {moeda(a.valorDezembro)}, {String(a.razao).replace('.', ',')}× a média dos outros meses ({moeda(a.mediaOutrosMeses)}).
        </span>
      )
  }
}

export function ListaAlertas({ alertas, casa, ano }: { alertas: Alerta[]; casa: Casa; ano: number }) {
  const ordenados = [...alertas].sort((a, b) => valorDoAlerta(b) - valorDoAlerta(a))
  return (
    <ul className="alertas">
      {ordenados.map((a, i) => (
        <li key={i} className="alerta">
          <span className="alerta-regra" title={REGRAS[a.regra].resumo}>{REGRAS[a.regra].titulo}</span>
          <Descricao a={a} casa={casa} ano={ano} />
        </li>
      ))}
    </ul>
  )
}

export function AvisoMetodologia() {
  return (
    <p className="aviso-metodologia">
      <strong>Pontos de atenção não são acusações.</strong> São gastos que fogem do padrão segundo regras estatísticas simples
      e podem ter explicação legítima (contrato anual pago de uma vez, base eleitoral distante, erro de digitação na prestação
      de contas). Use-os como ponto de partida e confira os documentos originais.
    </p>
  )
}

/**
 * Pontos de atenção de um parlamentar no ano do período escolhido na página
 * (na legislatura, o ano completo mais recente). Não aparece se não houver arquivo gerado.
 */
export function AlertasDoParlamentar({ casa, id, periodo }: { casa: Casa; id: number; periodo: string }) {
  const indice = useIndiceAlertas()
  const anos = indice.data?.anos ?? []
  const ano = periodo === 'legislatura'
    ? anos.find((a) => a < new Date().getFullYear()) ?? null
    : anos.includes(Number(periodo)) ? Number(periodo) : null
  const arquivo = useAlertas(ano)
  if (ano === null || !arquivo.data) return null

  const p = arquivo.data.parlamentares.find((x) => x.casa === casa && x.id === id)
  const cfg = CASAS[casa]
  return (
    <Cartao
      titulo={`Pontos de atenção em ${ano}${arquivo.data.parcial ? ' (ano em andamento)' : ''}`}
      subtitulo={<>Regras automáticas sobre a cota; não indicam irregularidade. <Link to={`/atencao?ano=${ano}&casa=${casa}`}>Ver todos e a metodologia</Link></>}>
      {p ? <ListaAlertas alertas={p.alertas} casa={casa} ano={ano} />
        : <p className="vazio">Nenhum ponto de atenção para este {cfg.singular} em {ano}.</p>}
    </Cartao>
  )
}
