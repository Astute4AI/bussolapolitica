import { useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { useParlamentares } from './api/hooks'
import { CASAS, casaDaRota, type Casa } from './lib/casas'
import { useComparacao } from './lib/comparacao'
import { BandejaComparacao } from './components/BandejaComparacao'
import { AvisoLimite } from './components/AvisoLimite'
import { Painel } from './pages/Painel'
import { PaginaDeputado } from './pages/PaginaDeputado'
import { PaginaSenador } from './pages/PaginaSenador'
import { Comparar } from './pages/Comparar'
import { Atencao } from './pages/Atencao'

export default function App() {
  const { pathname } = useLocation()
  const casa = casaDaRota(pathname)
  const cfg = CASAS[casa]
  const { ids } = useComparacao(casa)
  const emAtencao = pathname === '/atencao'

  return (
    <div className="app">
      <ValidarSelecao casa={casa} />
      <header className="topo">
        <div className="topo-interno">
          <Link to="/" className="marca">
            <span className="marca-selo" aria-hidden>◆</span>
            <span className="marca-nome">Políticos Brasil</span>
          </Link>
          <nav className="nav" aria-label="Seções">
            {(['camara', 'senado'] as Casa[]).map((c) => (
              <Link key={c} to={CASAS[c].inicio} className={casa === c && pathname !== cfg.comparar && !emAtencao ? 'active' : ''}
                aria-current={casa === c && !emAtencao ? 'page' : undefined}>
                {CASAS[c].curto}
              </Link>
            ))}
            <Link to={cfg.comparar} className={pathname === cfg.comparar ? 'active' : ''}>
              Comparar{ids.length > 0 && <span className="contador">{ids.length}</span>}
            </Link>
            <Link to="/atencao" className={emAtencao ? 'active' : ''}>Atenção</Link>
          </nav>
        </div>
      </header>

      <AvisoLimite />

      <main className="conteudo">
        <Routes>
          <Route path="/" element={<Painel key="camara" casa="camara" />} />
          <Route path="/deputado/:id" element={<PaginaDeputado />} />
          <Route path="/comparar" element={<Comparar key="camara" casa="camara" />} />
          <Route path="/senado" element={<Painel key="senado" casa="senado" />} />
          <Route path="/senador/:id" element={<PaginaSenador />} />
          <Route path="/senado/comparar" element={<Comparar key="senado" casa="senado" />} />
          <Route path="/atencao" element={<Atencao />} />
          <Route path="*" element={<p className="vazio">Página não encontrada.</p>} />
        </Routes>
      </main>

      <BandejaComparacao />

      <footer className="rodape">
        Dados: <a href={cfg.fonte.url} target="_blank" rel="noreferrer">{cfg.fonte.nome}</a>
        {' · '}57ª legislatura (2023–2027).{' '}
        {emAtencao
          ? 'Pontos de atenção calculados a partir dos arquivos anuais da cota da Câmara e do Senado.'
          : casa === 'camara'
          ? 'Despesas: Cota para o Exercício da Atividade Parlamentar (valor líquido).'
          : 'Despesas: Cota para o Exercício da Atividade Parlamentar dos Senadores (CEAPS, valor reembolsado).'}
      </footer>
    </div>
  )
}

/** Descarta da seleção IDs que não são de parlamentares em exercício (ex.: link antigo). */
function ValidarSelecao({ casa }: { casa: Casa }) {
  const { ids, definir } = useComparacao(casa)
  const { data } = useParlamentares(casa)

  useEffect(() => {
    if (!data) return
    const validos = ids.filter((id) => data.some((d) => d.id === id))
    if (validos.length !== ids.length) definir(validos)
  }, [ids, data]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
