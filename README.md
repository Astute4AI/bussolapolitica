# Políticos Brasil

Dashboard em React dos dados abertos da [Câmara dos Deputados](https://dadosabertos.camara.leg.br/) e do [Senado Federal](https://www12.senado.leg.br/dados-abertos) (57ª legislatura, 2023–2027).

**Site:** https://bussolapolitica.astute4ai.com

- **Painéis** da Câmara e do Senado com filtros por nome, partido, estado e sexo.
- **Páginas de parlamentar** com cota parlamentar, proposições, discursos, presença e comissões.
- **Comparação** de até 4 deputados ou 4 senadores.
- **Pontos de atenção**: alertas automáticos sobre gastos da cota fora do padrão.

## Rodando

```bash
npm install
npm run dev             # http://localhost:5173
npm run dados:alertas   # regenera os alertas em public/dados/
npm run build && npm run preview
```

## Documentação

Tudo em [`docs/`](docs/README.md): visão geral, arquitetura, fontes de dados, metodologia dos alertas, histórico e próximas etapas.
