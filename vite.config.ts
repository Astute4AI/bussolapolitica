import react from '@vitejs/plugin-react'
import { defineConfig, type ProxyOptions } from 'vite'

// A API da Câmara às vezes devolve respostas em cache sem o cabeçalho CORS;
// por isso o app chama /api/camara no próprio domínio e o servidor repassa.
// O mesmo vale para o Senado: a API administrativa (cota CEAPS) não envia cabeçalhos CORS.
function repassar(prefixo: string, origem: string, caminho: string): ProxyOptions {
  return {
    target: origem,
    changeOrigin: true,
    rewrite: (path) => path.replace(new RegExp(`^${prefixo}`), caminho),
    // Não repassa cookies/identificação do navegador: os cookies de localhost (de outros
    // projetos) vazariam para a API e o firewall da Câmara responde 403 a cabeçalhos grandes.
    configure: (p) => {
      p.on('proxyReq', (req) => {
        for (const h of ['cookie', 'referer', 'origin', 'authorization']) req.removeHeader(h)
      })
    },
  }
}

const proxy: Record<string, ProxyOptions> = {
  '/api/camara': repassar('/api/camara', 'https://dadosabertos.camara.leg.br', '/api/v2'),
  '/api/senado-legis': repassar('/api/senado-legis', 'https://legis.senado.leg.br', '/dadosabertos'),
  '/api/senado-adm': repassar('/api/senado-adm', 'https://adm.senado.gov.br', '/adm-dadosabertos/api/v1'),
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
})
