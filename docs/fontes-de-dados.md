# Fontes de dados

## Câmara dos Deputados

- Portal: https://dadosabertos.camara.leg.br/ · API v2: https://dadosabertos.camara.leg.br/swagger/api.html
- Arquivos anuais da cota (usados pelos alertas): `https://www.camara.leg.br/cotas/Ano-AAAA.csv.zip` (~7 MB; atualizado diariamente)

| Uso no app | Endpoint | Observações |
|---|---|---|
| Lista de deputados | `/deputados` (+ `siglaSexo=F` para saber quem é mulher) | |
| Perfil | `/deputados/{id}` | |
| Despesas | `/deputados/{id}/despesas?idLegislatura=57&ano=` | `ano` sozinho volta vazio; precisa de `idLegislatura`. Paginado (100 por página) |
| Proposições (contagem) | `/proposicoes?idDeputadoAutor=` | Recusa intervalos de datas > 3 meses: usa `ano`, ou só `dataApresentacaoInicio` para a legislatura |
| Discursos (contagem) | `/deputados/{id}/discursos` | Contagens usam `X-Total-Count` com `itens=1` |
| Eventos do deputado | `/deputados/{id}/eventos` | Não aceita `codTipoEvento` nem `idOrgao` (400): filtragem no cliente. Em comissões inclui reuniões canceladas; no Plenário reflete presença |
| Sessões do Plenário | `/eventos?idOrgao=180&codTipoEvento=110` | Deliberativas; "realizada" = situação começa com "Encerrada" |
| Frentes, órgãos | `/deputados/{id}/frentes`, `/orgaos` | |

Cuidados:

- **Limite por IP**: muitas requisições levam a 403/429 com `Retry-After` e, em excesso, a timeout de conexão por dezenas de minutos. O cliente limita a 3 simultâneas e pausa todas ao receber bloqueio.
- **Parâmetros desconhecidos** retornam 400.
- **API × arquivo anual**: as duas bases não são idênticas. Exemplo verificado (deputado 73433, 2025): a API tem passagens aéreas recentes (SIGEPA, ago–dez) que o arquivo ainda não trazia (~R$ 30 mil), e o arquivo tem linhas de telefonia (celular funcional, ramal; ~R$ 5 mil) sem documento na API. Por isso o "gasto no ano" da página de alertas pode diferir do total da página do deputado.
- **Restituições** (arquivo anual): quando o deputado devolve um valor, aparece uma linha com `vlrLiquido = 0` e `vlrRestituicao > 0` no mesmo `ideDocumento`. O script desconta esse valor.
- Linhas sem `ideCadastro` são de lideranças partidárias e são ignoradas.

## Senado Federal

- Portal: https://www12.senado.leg.br/dados-abertos
- Legislativo: `https://legis.senado.leg.br/dadosabertos` (swagger em `/api-docs/swagger-ui/index.html`)
- Administrativo: `https://adm.senado.gov.br/adm-dadosabertos` (swagger em `/swagger-ui/index.html`); **sem CORS**

| Uso no app | Endpoint | Observações |
|---|---|---|
| Lista de senadores | `/senador/lista/atual.json` | Titulares e suplentes em exercício; inclui bloco e mandato |
| Perfil | `/senador/{id}.json` | Nascimento, naturalidade, endereço e telefones |
| Comissões | `/senador/{id}/comissoes.json` | Inclui frentes ("Frente Parlamentar…") e grupos ("Grupo Parlamentar…"); o app separa pelo nome |
| Proposições | `/processo?codigoParlamentarAutor=` | Sem datas devolve todas do mandato numa chamada (autoria e coautoria) |
| Votos (presença) | `/votacao?codigoParlamentar=&dataInicio=&dataFim=` | Legislatura numa chamada (~900 KB) |
| Discursos | `/senador/{id}/discursos.json?dataInicio=AAAAMMDD&dataFim=` | Devolve no máximo 1 ano antes de `dataFim`: legislatura é consultada ano a ano |
| Cota (CEAPS) | `/api/v1/senadores/despesas_ceaps/{ano}` (administrativo) | Sem filtro por senador: ~10 MB por ano, todos juntos |
| Lista da legislatura (alertas) | `/senador/lista/legislatura/57.json` | Sem partido/UF; o script completa com a lista atual |

Cuidados:

- Respostas convertidas de XML: um item sozinho vem como objeto em vez de lista (`lista()` em `senado.ts` normaliza).
- Serviços antigos `/senador/{id}/autorias` e `/senador/{id}/votacoes` estão marcados como descontinuados; o app usa `/processo` e `/votacao`.
- URLs de foto vêm em `http:`; o app usa a versão `https:`.
- O código `codSenador` da CEAPS é o mesmo `CodigoParlamentar` da API legislativa.
- Códigos de voto: presença = `Sim`, `Não`, `Abstenção`, `Votou` (secreta), `P-NRV` (presente sem registrar voto), `NA`, `Presidente…`; falta = `NCom`; os demais (`AP`, `MIS`, `LS`, `LP`…) = ausência justificada.
