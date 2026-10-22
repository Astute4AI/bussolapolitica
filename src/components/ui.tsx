import type { ReactNode } from 'react'
import { PERIODOS } from '../api/periodo'

export function Kpi({ rotulo, valor, detalhe, carregando }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; carregando?: boolean }) {
  return (
    <div className="kpi">
      <div className="kpi-rotulo">{rotulo}</div>
      <div className="kpi-valor">{carregando ? <span className="esqueleto" style={{ width: '5ch' }} /> : valor}</div>
      {detalhe && <div className="kpi-detalhe">{detalhe}</div>}
    </div>
  )
}

export function Cartao({ titulo, subtitulo, acoes, children, className = '' }: {
  titulo: ReactNode; subtitulo?: ReactNode; acoes?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={`cartao ${className}`}>
      <header className="cartao-topo">
        <div>
          <h2 className="cartao-titulo">{titulo}</h2>
          {subtitulo && <p className="cartao-sub">{subtitulo}</p>}
        </div>
        {acoes}
      </header>
      {children}
    </section>
  )
}

export function Carregando({ texto = 'Carregando dados…' }: { texto?: string }) {
  return <div className="estado"><span className="girador" aria-hidden /> {texto}</div>
}

export function Erro({ erro, tentar }: { erro: unknown; tentar?: () => void }) {
  return (
    <div className="estado estado-erro" role="alert">
      Não foi possível carregar: {erro instanceof Error ? erro.message : String(erro)}
      {tentar && <button className="botao botao-sec" onClick={tentar}>Tentar de novo</button>}
    </div>
  )
}

export function SeletorPeriodo({ valor, onChange }: { valor: string; onChange: (p: string) => void }) {
  return (
    <div className="segmentado" role="radiogroup" aria-label="Período">
      {PERIODOS.map((p) => (
        <button key={p} role="radio" aria-checked={valor === p} className={valor === p ? 'ativo' : ''} onClick={() => onChange(p)}>
          {p === 'legislatura' ? 'Legislatura' : p}
        </button>
      ))}
    </div>
  )
}


export function Foto({ src, nome, tamanho = 48 }: { src: string; nome: string; tamanho?: number }) {
  return (
    <img className="foto" src={src} alt={nome} width={tamanho} height={tamanho * 4 / 3} loading="lazy"
      style={{ width: tamanho, height: tamanho * 4 / 3 }} />
  )
}
