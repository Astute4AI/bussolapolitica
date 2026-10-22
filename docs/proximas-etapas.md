# Próximas etapas

Em ordem de prioridade sugerida. Cada item diz por que importa e o que envolve.

## Infra e manutenção

1. **Colocar o projeto em git** e definir onde ele vive (GitHub). É pré-requisito para o item 2 e para revisar mudanças.
2. **Atualização automática dos alertas.** Hoje `public/dados/` só muda quando alguém roda `npm run dados:alertas`. Opções:
   - GitHub Action agendada (diária) que roda o script e faz commit dos JSON, disparando o deploy;
   - ou rodar o script no build da Vercel (`prebuild`), o que deixa o build dependente das APIs externas.
   Recomendação: GitHub Action diária.
3. **Deploy na Vercel** com os rewrites já configurados em `vercel.json`; validar que os proxies funcionam em produção (especialmente o CEAPS de ~10 MB).
4. **Testes automatizados** para as regras de alerta (casos sintéticos: contrato mensal não é repetição, restituição anula duplicidade, passagem por UF) e para a normalização das APIs.

## Alertas de gastos — fase 2

5. **Normalizar pelo teto da cota de cada estado** (Câmara) na regra "acima dos pares", em vez de comparar valores absolutos nacionalmente.
6. **Fornecedor ligado a vários gabinetes**: mesmo CNPJ recebendo de muitos parlamentares, especialmente com valores idênticos.
7. **Cruzamento com a Receita (CNPJ)**: data de abertura (empresa aberta pouco antes do primeiro pagamento), situação cadastral (baixada/inapta), atividade principal incompatível com a despesa. Requer API externa de CNPJ (ex.: BrasilAPI ou Minha Receita) e cache, pois são milhares de CNPJs.
8. **Série histórica por parlamentar**: alertas de vários anos juntos na página do parlamentar.
9. **Feedback de falso positivo**: permitir marcar um alerta como "explicado" com uma nota/fonte, para melhorar as regras.

## Produto

10. **Performance do período "Legislatura"**: Câmara leva 10–20 s (eventos paginados) e o Senado baixa ~35 MB de CEAPS. Pré-calcular agregados por parlamentar (como nos alertas) resolveria os dois.
11. **Divisão do bundle** (o JS passa de 500 kB por causa do Recharts): carregar páginas sob demanda com `import()`.
12. **Votações**: como cada parlamentar votou nas principais matérias, e alinhamento com o partido/governo (o Senado já expõe orientação de bancada).
13. **Comparação entre casas** (deputado × senador), mostrando só métricas equivalentes (cota, proposições, discursos).
