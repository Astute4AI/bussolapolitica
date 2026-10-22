import { Link, useLocation } from 'react-router-dom'
import { useParlamentares } from '../api/hooks'
import { CASAS, casaDaRota } from '../lib/casas'
import { MAX_COMPARACAO, useComparacao } from '../lib/comparacao'
import { Foto } from './ui'

/** Barra fixa no rodapé com os parlamentares escolhidos para comparação (da casa da página atual). */
export function BandejaComparacao() {
  const { pathname } = useLocation()
  const cfg = CASAS[casaDaRota(pathname)]
  const { ids, remover, limpar } = useComparacao(cfg.casa)
  const { data } = useParlamentares(cfg.casa)
  if (ids.length === 0 || pathname === cfg.comparar) return null

  const escolhidos = ids.map((id) => data?.find((d) => d.id === id)).filter((d) => d !== undefined)

  return (
    <aside className="bandeja" aria-label={`${cfg.plural} selecionados para comparação`}>
      <div className="bandeja-itens">
        {escolhidos.map((d, i) => (
          <span key={d.id} className="bandeja-item" style={{ ['--cor' as string]: `var(--series-${i + 1})` }}>
            <Foto src={d.urlFoto} nome={d.nome} tamanho={24} />
            <span className="bandeja-nome">{d.nome}</span>
            <button className="x" onClick={() => remover(d.id)} aria-label={`Remover ${d.nome}`}>×</button>
          </span>
        ))}
        <span className="bandeja-dica">{ids.length}/{MAX_COMPARACAO}</span>
      </div>
      <div className="bandeja-acoes">
        <button className="botao botao-sec" onClick={limpar}>Limpar</button>
        <Link className="botao" to={`${cfg.comparar}?ids=${ids.join(',')}`}>Comparar {ids.length > 1 ? ids.length : ''}</Link>
      </div>
    </aside>
  )
}
