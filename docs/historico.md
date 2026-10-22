# Histórico

Registro do que foi construído, em ordem. O projeto ainda não está num repositório git.

## 1. Dashboard da Câmara (out/2026)

- Projeto Vite + React + TypeScript; TanStack Query, React Router, Recharts.
- Painel com os 513 deputados, filtros na URL, gráficos por partido/UF e composição por sexo.
- Página do deputado: perfil, cota (mensal, por tipo, por fornecedor), proposições, discursos, eventos, frentes, comissões.
- Comparação de até 4 deputados, com seleção persistida e URL compartilhável.
- Paleta e gráficos seguindo boas práticas de visualização (cores por entidade, eixo único, tooltip próprio, modo escuro).
- Problemas resolvidos:
  - CORS intermitente da API → proxy `/api/camara` (Vite e Vercel);
  - cookies de outros projetos em `localhost` geravam 403 → o proxy remove cookies e cabeçalhos de identificação;
  - bloqueio por excesso de requisições (inclusive um bloqueio de IP de 25+ min durante testes) → fila com 3 simultâneas, retry e pausa global com aviso na interface.

## 2. Presença no Plenário (out/2026)

- Presença = sessões deliberativas do Plenário (órgão 180, tipo 110) com presença registrada ÷ sessões encerradas no período.
- Linha na tabela-resumo, cartão com barras de 0–100% na comparação e KPI na página do deputado.
- Conferido manualmente: Acácio Favacho 105/120, Airton Faleiro 111/120, Adilson Barroso 106/120 (2025).

## 3. Senado Federal (15/10/2026)

- Cliente das APIs legislativa e administrativa do Senado (`src/api/senado.ts`) e proxies `/api/senado-legis` e `/api/senado-adm`.
- Refatoração para duas casas: fila HTTP compartilhada (`http.ts`), períodos (`periodo.ts`), configuração por casa (`casas.ts`), painel e comparação genéricos, seleção de comparação por casa.
- Página do senador; presença em votações nominais com ausências justificadas × faltas.
- Conferido: Alan Rick 2025 — cota R$ 435.216 (igual ao total oficial), 93 proposições, 14 discursos, 120/128 presenças (8 justificadas).

## 4. Pontos de atenção nos gastos (21/10/2026)

- Script `npm run dados:alertas` com os arquivos anuais em lote das duas casas, gerando JSON estático por ano.
- Quatro regras: acima dos pares, fornecedor concentrado, documento repetido, pico em dezembro (calibração em [alertas-de-gastos.md](alertas-de-gastos.md)).
- Página `/atencao` com filtros e cartão "Pontos de atenção" nas páginas de deputado e senador.
- Pasta `docs/` criada.
