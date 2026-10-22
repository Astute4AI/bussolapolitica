# Alertas de gastos ("pontos de atenção")

Cinco regras automáticas que destacam despesas da cota parlamentar fora do padrão. **Não indicam irregularidade**: são pontos de partida para olhar os documentos. Muitos têm explicação legítima, e a interface diz isso em todo lugar onde os alertas aparecem.

## Como gerar

```bash
npm run dados:alertas                                   # ano anterior e atual
npm run dados:alertas -- --anos 2023,2024,2025,2026     # anos específicos
npm run dados:alertas -- --limite-cnpj 50               # limita as consultas de CNPJ (padrão: 1.500)
```

O script (`scripts/gerar-alertas.ts`, Node 22 com `--experimental-strip-types`):

1. baixa os arquivos anuais (Câmara: `cotas/Ano-AAAA.csv.zip`; Senado: `despesas_ceaps/{ano}`) e as listas de senadores, com cache de 12 h em `node_modules/.cache/politicosbrasil`;
2. normaliza tudo num formato único de lançamento;
3. consulta na Receita (via [Minha Receita](https://minhareceita.org)) os CNPJs que recebem R$ 20 mil ou mais de um mesmo parlamentar no ano, usando o cache `dados/cnpj.json`;
4. aplica as regras separadamente para cada casa;
5. grava `public/dados/alertas-AAAA.json` e `public/dados/indice.json` (anos disponíveis), **só se o conteúdo mudou**.

Sem consultas novas de CNPJ, leva cerca de 6 s para dois anos. A atualização é automática: o workflow `.github/workflows/atualizar-alertas.yml` roda todo dia às 10:00 UTC (e manualmente em *Actions → Atualizar pontos de atenção*, com opção de escolher os anos) e faz commit em `public/dados/` e `dados/` quando algo muda. Em pull requests que alteram o script, o mesmo workflow só valida a geração (com 20 consultas de CNPJ, sem commit).

### Cache de CNPJ

- `dados/cnpj.json` (versionado) guarda só razão social, data de abertura, situação cadastral e data, atividade principal, município/UF e a data da consulta. Não guarda sócios nem contatos.
- Cada execução consulta no máximo 1.500 CNPJs, um por vez com pausa de 400 ms: primeiro os nunca consultados, depois os consultados há mais de 180 dias. O que não couber fica para a execução seguinte.
- CNPJ não encontrado fica marcado para não ser consultado de novo antes de 180 dias.
- CNPJs com dígitos verificadores inválidos (existem no dado oficial, ex.: `00000000000010`) não são consultados.

Privacidade: o CPF do próprio deputado, que vem no arquivo da Câmara, não é lido. Fornecedores pessoa física têm o CPF mascarado (`***.456.789-**`).

## Regras

Parâmetros no topo do script; valores atuais abaixo.

### 1. Acima dos pares (`acima-dos-pares`)

Gasto anual do parlamentar numa categoria comparado com os colegas da mesma casa que também usaram a categoria.

- Dispara se: valor ≥ **3×** a mediana **e** ≥ percentil **95** **e** ≥ **R$ 20 mil**; grupo com pelo menos **8** parlamentares.
- Passagens aéreas da Câmara são comparadas só com deputados do **mesmo estado** (dependem da distância até Brasília).
- Passagens do Senado ficam de fora: com 3 senadores por estado, não há grupo comparável.

### 2. Fornecedor concentrado (`concentracao-fornecedor`)

- Dispara se um fornecedor recebeu ≥ **40%** do gasto total do parlamentar no ano **e** ≥ **R$ 50 mil**.
- Ignora passagens (agência/companhia aérea concentra naturalmente) e aluguel de escritório (o locador concentra naturalmente).
- Informa quantos parlamentares da mesma casa usam o fornecedor; "nenhum outro" é um reforço do sinal.

### 3. Documento repetido (`documento-repetido`)

- Mesmo parlamentar, mesmo fornecedor (CNPJ/CPF), mesmo número de documento (normalizado: `s/nº`, zeros à esquerda) e mesmo valor, lançado mais de uma vez **com a mesma data de emissão ou no mesmo mês de competência**.
- Ignora: passagens, aluguel, telefonia, complemento de auxílio-moradia, parcelas, valores < R$ 100 e documentos cujo valor já foi **restituído** (Câmara).
- Mostra cada lançamento com link para o PDF (Câmara).

### 4. Pico em dezembro (`pico-dezembro`)

- Dezembro ≥ **2×** a média dos meses com gasto (jan–nov) **e** ≥ **R$ 30 mil**, com pelo menos 6 meses com gasto.
- Só para anos completos (o ano atual é marcado como parcial e não recebe essa regra).

### 5. Cadastro do fornecedor (`cadastro-fornecedor`)

Só para fornecedores pessoa jurídica que receberam **R$ 20 mil ou mais** de um mesmo parlamentar no ano (passagens excluídas). Dois motivos:

- **Situação irregular**: situação cadastral diferente de "ATIVA" (baixada, inapta, suspensa, nula) **e** algum pagamento com data igual ou posterior à data dessa situação. Mostra o valor pago depois. Baixas por incorporação, fusão ou cisão não contam (a empresa continua sob outro CNPJ). O alerta mostra o motivo informado pela Receita (em 2026-10: 218 encerramentos voluntários e 92 inaptidões por omissão de declarações entre os fornecedores consultados).
- **Filiais**: a idade da empresa é a da matriz (CNPJ com ordem `0001`), consultada à parte. Sem isso, toda filial nova de uma grande empresa (ex.: locadoras) virava alerta.
- **Aberta recentemente**: data de abertura até **180 dias** antes do primeiro pagamento do ano (ou depois dele, o que é inconsistente e aparece como "dias depois").

Limitações: o primeiro pagamento considerado é o primeiro *do ano*, então uma empresa contratada desde o ano anterior aparece só no ano em que o intervalo é curto; a situação cadastral é a atual na Receita, e a data da situação nem sempre é atualizada; MEIs têm o nome do titular na razão social (dado público da Receita).

## Calibração (dados de 2025)

Antes de fixar as regras, cada uma foi testada num protótipo sobre 2025 (208 mil lançamentos da Câmara, 24 mil do Senado):

| Regra | Primeira versão | Problema | Ajuste |
|---|---|---|---|
| Documento repetido | 713 casos | Contratos mensais (aluguel, locação de veículo, prestador) repetem o número do contrato todo mês; variações de "s/nº" | Exigir mesma data ou mesmo mês; normalizar número; excluir categorias contratuais |
| Documento repetido | — | Duplicidades já devolvidas pelo deputado apareciam como alerta | Descontar `vlrRestituicao` e ignorar documentos restituídos |
| Concentração | Senado dominado por agências de viagem | Concentração natural | Excluir passagens e aluguel |
| Fracionamento (descartada) | 1.022 casos na Câmara | Quase todos eram passagens no mesmo dia, vários carros locados do mesmo fornecedor ou hotel com uma nota por quarto | Regra removida do MVP |

Resultado atual (parlamentares com ao menos um alerta / alertas por regra):

| Ano | Parlamentares | Acima dos pares | Concentração | Doc. repetido | Pico dezembro | Cadastro do fornecedor |
|---|---|---|---|---|---|---|
| 2023 | 369 | 122 | 78 | 97 | 102 | 148 |
| 2024 | 388 | 133 | 90 | 157 | 104 | 105 |
| 2025 | 325 | 105 | 99 | 112 | 46 | 113 |
| 2026 (parcial) | 282 | 77 | 165 | 68 | — | 56 |

A maioria tem um único alerta; a lista é ordenada por número de alertas e valor envolvido.

## Limitações conhecidas

- **Bases diferentes**: o arquivo anual da Câmara e a API não batem 100% (ver [fontes-de-dados.md](fontes-de-dados.md)). O "gasto no ano" dos alertas pode diferir do total mostrado na página do deputado.
- **Teto da cota varia por estado** na Câmara (de ~R$ 36,6 mil no DF a ~R$ 51,4 mil em RR) e a regra 1 (exceto passagens) compara valores absolutos nacionalmente. Teste em 2025 com uma tabela de tetos não oficial: normalizar pelo teto mudaria 9 de 72 alertas da Câmara (entram 6, saem 3, quase todos em "manutenção de escritório"). A normalização não foi aplicada porque a tabela oficial ("Valor da Cota por Federação") não pôde ser verificada: a página da Câmara exige login e as fontes públicas encontradas citam só alguns estados. Ver próximas etapas.
- **2026 é ano eleitoral**: há restrições de divulgação em parte do ano, o que muda padrões (por exemplo, mais alertas de concentração).
- **Documento repetido no Senado**: alguns casos têm a mesma data de emissão lançada em meses diferentes; pode ser forma de registro da CEAPS, e não pagamento em dobro. Conferir no portal do Senado.
- A regra 5 depende de um serviço gratuito e mantido por voluntários (Minha Receita). Se ele ficar indisponível, a execução falha e os arquivos anteriores continuam valendo.
