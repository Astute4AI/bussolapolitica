import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { moeda, moedaCurta } from '../lib/format'

const EIXO = { stroke: 'var(--grade)', tick: { fill: 'var(--texto-3)', fontSize: 12 }, tickLine: false }

interface ItemTooltip { name?: string | number; value?: number | string; color?: string; payload?: Record<string, unknown> }

function CaixaTooltip({ active, payload, label, formatar }: {
  active?: boolean; payload?: ItemTooltip[]; label?: string | number; formatar: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="tooltip">
      {label !== undefined && <div className="tooltip-titulo">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="tooltip-linha">
          {payload.length > 1 && <span className="tooltip-cor" style={{ background: p.color }} />}
          {payload.length > 1 && <span className="tooltip-nome">{p.name}</span>}
          <span className="tooltip-valor">{formatar(Number(p.value))}</span>
        </div>
      ))}
    </div>
  )
}

/** Barras horizontais de uma série (ranking). `cores` permite cor por entidade. */
export function BarrasHorizontais<T extends Record<string, unknown>>({
  dados, chave, valor, formatar = moeda, formatarEixo = moedaCurta, cor = 'var(--series-1)', cores, onClick, alturaBarra = 26, larguraRotulo = 150,
}: {
  dados: T[]; chave: keyof T & string; valor: keyof T & string
  formatar?: (v: number) => string; formatarEixo?: (v: number) => string
  cor?: string; cores?: string[]; onClick?: (item: T) => void; alturaBarra?: number; larguraRotulo?: number
}) {
  const altura = Math.max(80, dados.length * alturaBarra + 32)
  return (
    <div style={{ width: '100%', height: altura }}>
      <ResponsiveContainer>
        <BarChart data={dados as Record<string, unknown>[]} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }} barCategoryGap={4}>
          <CartesianGrid horizontal={false} stroke="var(--grade)" strokeDasharray="2 4" />
          <XAxis type="number" {...EIXO} tickFormatter={formatarEixo} axisLine={false} />
          <YAxis type="category" dataKey={chave as string} {...EIXO} width={larguraRotulo} axisLine={false}
            tick={{ fill: 'var(--texto-2)', fontSize: 12 }} interval={0} />
          <Tooltip cursor={{ fill: 'var(--hover)' }} content={<CaixaTooltip formatar={formatar} />} />
          <Bar dataKey={valor as string} fill={cor} radius={[0, 4, 4, 0]} maxBarSize={22}
            style={onClick ? { cursor: 'pointer' } : undefined}
            onClick={onClick ? (d) => onClick((d as unknown as { payload: T }).payload) : undefined}>
            {cores && dados.map((_, i) => <Cell key={i} fill={cores[i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Barras verticais de uma série (ex.: por UF, por mês). */
export function BarrasVerticais<T extends Record<string, unknown>>({
  dados, chave, valor, formatar = moeda, formatarEixo = moedaCurta, formatarRotulo, onClick, destaque, altura = 260,
}: {
  dados: T[]; chave: keyof T & string; valor: keyof T & string
  formatar?: (v: number) => string; formatarEixo?: (v: number) => string; formatarRotulo?: (v: string) => string
  onClick?: (item: T) => void; destaque?: (item: T) => boolean; altura?: number
}) {
  return (
    <div style={{ width: '100%', height: altura }}>
      <ResponsiveContainer>
        <BarChart data={dados as Record<string, unknown>[]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--grade)" strokeDasharray="2 4" />
          <XAxis dataKey={chave as string} {...EIXO} tickFormatter={formatarRotulo} interval="preserveStartEnd" minTickGap={4} />
          <YAxis {...EIXO} allowDecimals={false} tickFormatter={formatarEixo} axisLine={false} width={64} />
          <Tooltip cursor={{ fill: 'var(--hover)' }}
            labelFormatter={(l) => (formatarRotulo ? formatarRotulo(String(l)) : l)}
            content={(p) => <CaixaTooltip {...(p as object)} label={formatarRotulo ? formatarRotulo(String(p.label)) : p.label} formatar={formatar} />} />
          <Bar dataKey={valor as string} fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={36}
            style={onClick ? { cursor: 'pointer' } : undefined}
            onClick={onClick ? (d) => onClick((d as unknown as { payload: T }).payload) : undefined}>
            {destaque && dados.map((d, i) => <Cell key={i} fill={destaque(d) ? 'var(--series-1)' : 'var(--series-1-fraco)'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface Serie { chave: string; nome: string; cor: string }

/** Barras agrupadas horizontais: uma barra por série dentro de cada categoria. */
export function BarrasAgrupadas({ dados, chave, series, formatar = moeda, larguraRotulo = 160 }: {
  dados: Record<string, unknown>[]; chave: string; series: Serie[]; formatar?: (v: number) => string; larguraRotulo?: number
}) {
  const altura = Math.max(120, dados.length * (series.length * 12 + 18) + 60)
  return (
    <div style={{ width: '100%', height: altura }}>
      <ResponsiveContainer>
        <BarChart data={dados as Record<string, unknown>[]} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }} barCategoryGap={8} barGap={2}>
          <CartesianGrid horizontal={false} stroke="var(--grade)" strokeDasharray="2 4" />
          <XAxis type="number" {...EIXO} tickFormatter={moedaCurta} axisLine={false} />
          <YAxis type="category" dataKey={chave as string} {...EIXO} width={larguraRotulo} axisLine={false}
            tick={{ fill: 'var(--texto-2)', fontSize: 12 }} interval={0} />
          <Tooltip cursor={{ fill: 'var(--hover)' }} content={<CaixaTooltip formatar={formatar} />} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--texto-2)' }} />
          {series.map((s) => (
            <Bar key={s.chave} dataKey={s.chave} name={s.nome} fill={s.cor} radius={[0, 4, 4, 0]} maxBarSize={12} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Linhas ao longo do tempo, uma por série. */
export function Linhas({ dados, chave, series, formatarRotulo, formatar = moeda, altura = 300 }: {
  dados: Record<string, unknown>[]; chave: string; series: Serie[]
  formatarRotulo?: (v: string) => string; formatar?: (v: number) => string; altura?: number
}) {
  return (
    <div style={{ width: '100%', height: altura }}>
      <ResponsiveContainer>
        <LineChart data={dados} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grade)" strokeDasharray="2 4" />
          <XAxis dataKey={chave as string} {...EIXO} tickFormatter={formatarRotulo} minTickGap={16} />
          <YAxis {...EIXO} tickFormatter={moedaCurta} axisLine={false} width={64} />
          <Tooltip cursor={{ stroke: 'var(--texto-3)', strokeDasharray: '3 3' }}
            content={(p) => <CaixaTooltip {...(p as object)} label={formatarRotulo ? formatarRotulo(String(p.label)) : p.label} formatar={formatar} />} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--texto-2)' }} />
          {series.map((s) => (
            <Line key={s.chave} type="monotone" dataKey={s.chave} name={s.nome} stroke={s.cor} strokeWidth={2}
              dot={false} activeDot={{ r: 4, stroke: 'var(--superficie)', strokeWidth: 2 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
