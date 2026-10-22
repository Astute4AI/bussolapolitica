# Alertas de gastos ("pontos de atenção")

Regras automáticas que destacam despesas da cota parlamentar fora do padrão. **Não indicam irregularidade**: são pontos de partida para olhar os documentos. Muitos têm explicação legítima, e a interface diz isso em todo lugar onde os alertas aparecem.

## Como gerar

```bash
npm run dados:alertas                                   # ano anterior e atual
npm run dados:alertas -- --anos 2023,2024,2025,2026     # anos específicos
```

O script (`scripts/gerar-alertas.ts`, Node 22 com `--experimental-strip-types`):

1. baixa os arquivos anuais (Câmara: `cotas/Ano-AAAA.csv.zip`; Senado: `despesas_ceaps/{ano}`) e as listas de senadores, com cache de 12 h em `node_modules/.cache/politicosbrasil`;
2. normaliza tudo num formato único de lançamento;
3. aplica as regras separadamente para cada casa;
4. grava `public/dados/alertas-AAAA.json` e `public/dados/indice.json` (anos disponíveis).

Leva cerca de 6 s para dois anos (com download). Os arquivos gerados são estáticos e vão junto no deploy, então **precisam ser regenerados periodicamente** (ver [próximas etapas](proximas-etapas.md)).

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

## Calibração (dados de 2025)

Antes de fixar as regras, cada uma foi testada num protótipo sobre 2025 (208 mil lançamentos da Câmara, 24 mil do Senado):

| Regra | Primeira versão | Problema | Ajuste |
|---|---|---|---|
| Documento repetido | 713 casos | Contratos mensais (aluguel, locação de veículo, prestador) repetem o número do contrato todo mês; variações de "s/nº" | Exigir mesma data ou mesmo mês; normalizar número; excluir categorias contratuais |
| Documento repetido | — | Duplicidades já devolvidas pelo deputado apareciam como alerta | Descontar `vlrRestituicao` e ignorar documentos restituídos |
| Concentração | Senado dominado por agências de viagem | Concentração natural | Excluir passagens e aluguel |
| Fracionamento (descartada) | 1.022 casos na Câmara | Quase todos eram passagens no mesmo dia, vários carros locados do mesmo fornecedor ou hotel com uma nota por quarto | Regra removida do MVP |

Resultado atual (parlamentares com ao menos um alerta / alertas por regra):

| Ano | Parlamentares | Acima dos pares | Concentração | Doc. repetido | Pico dezembro |
|---|---|---|---|---|---|
| 2023 | 286 | 122 | 78 | 97 | 102 |
| 2024 | 332 | 133 | 90 | 157 | 104 |
| 2025 | 264 | 105 | 99 | 112 | 46 |
| 2026 (parcial) | 249 | 77 | 165 | 68 | — |

A maioria tem um único alerta; a lista é ordenada por número de alertas e valor envolvido.

## Limitações conhecidas

- **Bases diferentes**: o arquivo anual da Câmara e a API não batem 100% (ver [fontes-de-dados.md](fontes-de-dados.md)). O "gasto no ano" dos alertas pode diferir do total mostrado na página do deputado.
- **Teto da cota varia por estado** na Câmara e a regra 1 (exceto passagens) compara nacionalmente. Normalizar pelo teto é uma próxima etapa.
- **2026 é ano eleitoral**: há restrições de divulgação em parte do ano, o que muda padrões (por exemplo, mais alertas de concentração).
- **Documento repetido no Senado**: alguns casos têm a mesma data de emissão lançada em meses diferentes; pode ser forma de registro da CEAPS, e não pagamento em dobro. Conferir no portal do Senado.
- As regras não olham dados externos (situação do CNPJ, data de abertura, sócios). Ver próximas etapas.
