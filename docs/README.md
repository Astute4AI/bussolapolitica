# Documentação — Políticos Brasil

Dashboard em React com dados abertos da Câmara dos Deputados e do Senado Federal (57ª legislatura, 2023–2027).

| Documento | Conteúdo |
|---|---|
| [Visão geral](visao-geral.md) | O que o app faz, páginas e rotas |
| [Arquitetura](arquitetura.md) | Organização do código, fluxo de dados, proxies e cache |
| [Fontes de dados](fontes-de-dados.md) | APIs da Câmara e do Senado e as peculiaridades de cada uma |
| [Alertas de gastos](alertas-de-gastos.md) | Metodologia dos "pontos de atenção": regras, parâmetros, calibração e limitações |
| [Histórico](historico.md) | O que já foi feito, em ordem |
| [Próximas etapas](proximas-etapas.md) | Ideias priorizadas para continuar |

## Comandos

```bash
npm install
npm run dev             # http://localhost:5173
npm run build           # checagem de tipos + build de produção
npm run lint
npm run dados:alertas   # regenera public/dados/alertas-*.json (ano anterior e atual)
npm run dados:alertas -- --anos 2023,2024,2025,2026
```

Repositório: https://github.com/Astute4AI/bussolapolitica. Os alertas são atualizados todo dia por GitHub Action.
