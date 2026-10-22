# Arquitetura

## Stack

Vite 8, React 19, TypeScript, TanStack Query (cache e estado das requisições), React Router 7, Recharts 3 e oxlint. Não há backend próprio: o app chama as APIs públicas por proxies (Vite em dev/preview, rewrites do `vercel.json` em produção) e lê arquivos estáticos pré-calculados em `public/dados/`.

## Organização

```
scripts/
  gerar-alertas.ts      # baixa os arquivos anuais da cota e gera public/dados/alertas-*.json
public/dados/           # saída do script (estático, servido pelo app)
src/
  api/
    http.ts             # cliente comum: fila (3 simultâneas por fonte), retry, pausa global em 403/429
    periodo.ts          # legislatura, anos, intervalo de datas de um período
    camara.ts           # endpoints da Câmara + tipos
    senado.ts           # endpoints do Senado (legislativo + administrativo) normalizados
    alertas.ts          # formato dos arquivos de alertas + textos das regras
    hooks.ts            # hooks do TanStack Query; normaliza as duas casas no mesmo formato
  lib/
    casas.ts            # o que muda entre Câmara e Senado: textos, rotas, métricas
    comparacao.tsx      # seleção para comparar (por casa), localStorage
    format.ts           # moeda, número, %, mês, nomes curtos de despesas
  components/           # ui (Kpi, Cartao…), gráficos, despesas, alertas, bandeja, aviso de limite
  pages/                # Painel, Comparar (genéricos por casa), PaginaDeputado, PaginaSenador, Atencao
```

## Modelo comum às duas casas

As páginas genéricas (`Painel`, `Comparar`) recebem `casa` e usam:

- `Parlamentar` (`id`, `nome`, `partido`, `uf`, `urlFoto`, `sexo`): lista de cada casa normalizada em `useParlamentares(casa)`.
- `Despesa`: formato da Câmara; as despesas do Senado (CEAPS) são convertidas para ele em `senado.despesasDoAno`. Assim os mesmos agregadores (`porTipo`, `porMes`, `porFornecedor`) e componentes servem às duas.
- `Atividade`: `proposicoes`, `discursos`, `frentes`, `presencas`, `sessoes` e campos específicos (`eventos` só na Câmara; `comissoes` e `justificadas` só no Senado). As métricas exibidas na comparação vêm de `CASAS[casa].metricas`.

## Cache e volume de requisições

- TanStack Query com `staleTime` de 1 h e sem refetch ao focar a janela.
- Dados compartilhados entre parlamentares são buscados uma vez por sessão e guardados em promessas de módulo (sem `signal`, para um cancelamento não estragar o compartilhamento):
  - sessões deliberativas do Plenário da Câmara, por período;
  - arquivo anual da CEAPS do Senado (~10 MB, todos os senadores), por ano.
- No Senado, autorias, votos e comissões vêm em uma chamada para a legislatura inteira e são reaproveitados entre períodos (`client.ensureQueryData`).

## Proxies

| Prefixo no app | Destino |
|---|---|
| `/api/camara` | `https://dadosabertos.camara.leg.br/api/v2` |
| `/api/senado-legis` | `https://legis.senado.leg.br/dadosabertos` |
| `/api/senado-adm` | `https://adm.senado.gov.br/adm-dadosabertos/api/v1` |

Motivos: a API da Câmara às vezes devolve respostas em cache sem CORS, e a API administrativa do Senado nunca envia CORS. O proxy de dev remove `cookie`, `referer`, `origin` e `authorization`, porque cookies de outros projetos em `localhost` deixavam o cabeçalho grande demais e o firewall da Câmara respondia 403.

Para chamar a API da Câmara direto, sem proxy, defina `VITE_API_BASE=https://dadosabertos.camara.leg.br/api/v2`.

## Alertas: por que pré-calculados

Comparar um parlamentar com os pares exige as despesas de todos (513 deputados + 81 senadores). Pela API paginada da Câmara isso seria milhares de requisições, o que já bloqueou o IP por mais de 25 minutos durante o desenvolvimento. O script usa os arquivos anuais em lote (um download por ano e casa) e grava JSON estático (~120 KB por ano). Ver [alertas-de-gastos.md](alertas-de-gastos.md).
