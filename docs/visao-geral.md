# Visão geral

O app mostra quem são os parlamentares em exercício, quanto gastam da cota parlamentar e como atuam (proposições, discursos, presença, comissões), com comparação lado a lado e alertas de gastos fora do padrão.

## Páginas

| Rota | Página | O que mostra |
|---|---|---|
| `/` | Painel da Câmara | 513 deputados em exercício; filtros por nome, partido, UF e sexo (na URL); bancadas por partido e por UF (clique filtra); composição por sexo |
| `/deputado/:id` | Deputado | Perfil, cota (mensal, por tipo, por fornecedor), proposições, discursos, presença no Plenário, frentes, comissões, proposições recentes e pontos de atenção |
| `/comparar?ids=…` | Comparar deputados | Até 4 deputados: tabela-resumo com destaques, presença, gasto total, atividade em pequenos múltiplos, gasto mensal e por categoria |
| `/senado` | Painel do Senado | 81 senadores em exercício (titulares e suplentes que assumiram), mesmos filtros e gráficos |
| `/senador/:id` | Senador | Mesma estrutura da página do deputado, com dados do Senado |
| `/senado/comparar?ids=…` | Comparar senadores | Mesma comparação, com métricas do Senado |
| `/atencao` | Pontos de atenção | Alertas automáticos sobre a cota das duas casas, por ano, com filtros por regra, casa, partido, UF e nome |

## Comportamentos importantes

- **Período**: as páginas de parlamentar e a comparação têm seletor de período: um ano (2023–2026) ou a legislatura inteira. 2023 começa em 1º de fevereiro (início da 57ª legislatura).
- **Seleção para comparar**: cada casa tem a sua (até 4), salva no navegador e refletida na URL (`?ids=`), então o link pode ser compartilhado. Uma bandeja no rodapé mostra os escolhidos.
- **Presença**:
  - Câmara: sessões deliberativas do Plenário em que o deputado registrou presença ÷ sessões encerradas no período. Ausência justificada conta como ausência (a API só informa presença).
  - Senado: votações nominais do Plenário em que o senador estava presente ÷ votações nominais. O Senado distingue ausência justificada (licença, missão, atividade parlamentar) de falta (`NCom`), e o app mostra as duas.
  - As duas medidas não são comparáveis entre si. Por isso deputados e senadores não se misturam na comparação.
- **Pontos de atenção**: são sinais para investigar, não acusações. A página e o cartão no perfil deixam isso explícito. Detalhes em [alertas-de-gastos.md](alertas-de-gastos.md).
- **Limite da API da Câmara**: quando a API pede pausa (403/429), uma faixa no topo mostra a contagem regressiva.
