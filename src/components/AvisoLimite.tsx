import { useEffect, useState } from 'react'
import { aoPausar } from '../api/http'

/** Aviso discreto enquanto a API pede para aguardar (limite de requisições). */
export function AvisoLimite() {
  const [{ ate, fonte }, setPausa] = useState({ ate: 0, fonte: '' })
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => aoPausar((ate, fonte) => setPausa({ ate, fonte })), [])

  useEffect(() => {
    if (ate <= Date.now()) return
    const t = setInterval(() => setAgora(Date.now()), 500)
    return () => clearInterval(t)
  }, [ate])

  const restante = Math.ceil((ate - agora) / 1000)
  if (restante <= 0) return null
  return (
    <div className="aviso-limite" role="status">
      A API {fonte} pediu uma pausa (limite de requisições). Retomando em {restante}s…
    </div>
  )
}
