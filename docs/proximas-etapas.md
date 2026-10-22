# Próximas etapas

Em ordem de prioridade sugerida. Cada item diz por que importa e o que envolve.

## Feito

- ~~Colocar o projeto em git~~: https://github.com/Astute4AI/bussolapolitica
- ~~Atualização automática dos alertas~~: workflow diário (`atualizar-alertas.yml`) + CI (`ci.yml`)
- ~~Cruzamento com a Receita (CNPJ)~~: regra "Cadastro do fornecedor" com cache versionado

## Infra e manutenção

1. **Deploy na Vercel** com os rewrites já configurados em `vercel.json`; validar que os proxies funcionam em produção (especialmente o CEAPS de ~10 MB). Com o repositório no GitHub, basta importar o projeto na Vercel: cada commit do workflow diário gera um deploy novo.
2. **Testes automatizados** para as regras de alerta (casos sintéticos: contrato mensal não é repetição, restituição anula duplicidade, passagem por UF, empresa aberta depois do pagamento) e para a normalização das APIs.

## Alertas de gastos — fase 2

3. **Normalizar pelo teto da cota de cada estado** (Câmara) na regra "acima dos pares". **Bloqueado**: falta a tabela oficial vigente ("Valor da Cota por Federação"; a página da Câmara exige login). Impacto medido em 2025: 9 de 72 alertas mudam. Com a tabela em mãos, basta um arquivo `dados/teto-cota-camara.json` e dividir o valor pelo teto da UF antes de comparar.
4. **Atividade incompatível**: atividade principal do fornecedor (já no cache de CNPJ) que não combina com o tipo de despesa (ex.: posto de combustível em "consultoria"). Exige uma tabela de compatibilidade CNAE × categoria.
5. **Fornecedor ligado a vários gabinetes**: mesmo CNPJ recebendo de muitos parlamentares, especialmente com valores idênticos.
6. **Série histórica por parlamentar**: alertas de vários anos juntos na página do parlamentar.
7. **Feedback de falso positivo**: permitir marcar um alerta como "explicado" com uma nota/fonte, para melhorar as regras.

## Produto

8. **Performance do período "Legislatura"**: Câmara leva 10–20 s (eventos paginados) e o Senado baixa ~35 MB de CEAPS. Pré-calcular agregados por parlamentar (como nos alertas) resolveria os dois.
9. **Divisão do bundle** (o JS passa de 500 kB por causa do Recharts): carregar páginas sob demanda com `import()`.
10. **Votações**: como cada parlamentar votou nas principais matérias, e alinhamento com o partido/governo (o Senado já expõe orientação de bancada).
11. **Comparação entre casas** (deputado × senador), mostrando só métricas equivalentes (cota, proposições, discursos).
12. **Virada da legislatura (fev/2027)**: o app e o script assumem a 57ª legislatura (2023–2027); será preciso parametrizar a legislatura.
