import { useMemo } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { Despesa } from '../api/camara'
import { filtrarPeriodo, mesesDoPeriodo, porFornecedor, porMes, porTipo, somar } from '../api/hooks'
import { BarrasHorizontais, BarrasVerticais } from './graficos'
import { Cartao, Carregando, Erro } from './ui'
import { moeda, rotuloMes, tipoCurto } from '../lib/format'

/** Agregações das despesas da cota no período (comum às páginas de deputado e senador). */
export function useResumoDespesas(despesas: Despesa[] | undefined, periodo: string) {
  return useMemo(() => {
    const doPeriodo = filtrarPeriodo(despesas ?? [], periodo)
    const m = porMes(doPeriodo)
    const mensal = mesesDoPeriodo(periodo).map((mes) => ({ mes, valor: m.get(mes) ?? 0 }))
    return {
      doPeriodo,
      total: somar(doPeriodo),
      tipos: porTipo(doPeriodo).map((t) => ({ ...t, rotulo: tipoCurto(t.tipo) })),
      fornecedores: porFornecedor(doPeriodo),
      mensal,
      mesesComGasto: mensal.filter((x) => x.valor > 0).length,
    }
  }, [despesas, periodo])
}

export function GraficosDespesas({ consulta, resumo, carregando = 'Carregando despesas…' }: {
  consulta: UseQueryResult<Despesa[]>; resumo: ReturnType<typeof useResumoDespesas>; carregando?: string
}) {
  if (consulta.error) return <Erro erro={consulta.error} tentar={() => consulta.refetch()} />
  if (consulta.isLoading) return <Carregando texto={carregando} />
  const { tipos, fornecedores, mensal } = resumo
  return (
    <>
      <Cartao titulo="Gasto mensal da cota" subtitulo="Valor reembolsado por mês">
        <BarrasVerticais dados={mensal} chave="mes" valor="valor" formatarRotulo={rotuloMes} />
      </Cartao>

      <div className="grade-2">
        <Cartao titulo="Gasto por tipo de despesa">
          {tipos.length ? <BarrasHorizontais dados={tipos} chave="rotulo" valor="valor" larguraRotulo={170} />
            : <p className="vazio">Sem despesas no período.</p>}
        </Cartao>
        <Cartao titulo="Maiores fornecedores">
          {fornecedores.length ? (
            <table className="tabela">
              <thead><tr><th>Fornecedor</th><th className="num">Docs</th><th className="num">Valor</th></tr></thead>
              <tbody>
                {fornecedores.map((f) => (
                  <tr key={f.nome}><td>{f.nome}</td><td className="num">{f.qtd}</td><td className="num">{moeda(f.valor)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="vazio">Sem despesas no período.</p>}
        </Cartao>
      </div>
    </>
  )
}
