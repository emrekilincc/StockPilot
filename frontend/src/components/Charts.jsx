import { useId } from 'react'
import { money, number } from '../utils/format'
import { Empty } from './ui'

export function SalesChart({ data }) {
  const gradient = useId().replaceAll(':', '')
  const max = Math.max(...data.map((row) => row.amount), 10000) * 1.15
  const width = 650, height = 205, left = 62, bottom = 178
  const points = data.map((row, i) => [left + i * (width - left - 20) / Math.max(data.length - 1, 1), bottom - row.amount / max * 150])
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.join(',')}`).join(' ')
  return <div className="sales-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Son altı aylık tamamlanan siparişlerin satış tutarları"><defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity=".2" /><stop offset="100%" stopColor="#6366f1" stopOpacity=".015" /></linearGradient></defs>
    {[0, 1, 2, 3].map((i) => { const y = bottom - i * 50; return <g key={i}><line x1={left} x2={width - 10} y1={y} y2={y} className="chart-grid" /><text x={left - 12} y={y + 4} textAnchor="end" className="chart-label">{number(Math.round(max * i / 3 / 100))} ₺</text></g> })}
    <path d={`${line} L${points.at(-1)?.[0]},${bottom} L${left},${bottom} Z`} fill={`url(#${gradient})`} />
    <path d={line} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    {data.map((row, i) => <g key={row.month}><circle cx={points[i][0]} cy={points[i][1]} r="4" fill="var(--surface)" stroke="#6366f1" strokeWidth="2"><title>{row.month}: {money(row.amount)}</title></circle><text x={points[i][0]} y={height - 4} textAnchor="middle" className="chart-label">{new Intl.DateTimeFormat('tr-TR', { month: 'short' }).format(new Date(`${row.month}-15T12:00:00`))}</text></g>)}
  </svg><div className="sr-only">{data.map((row) => <p key={row.month}>{row.month}: {money(row.amount)}</p>)}</div></div>
}

const palette = ['#6366f1', '#14b8a6', '#f59e0b', '#9ca3af', '#f472b6', '#8b5cf6']
export function Distribution({ data, labels = {}, donut = false }) {
  const total = data.reduce((sum, row) => sum + row.count, 0)
  if (!total) return <Empty title="Henüz veri yok" description="Kayıtlarınız burada özetlenecek." />
  let offset = 0
  return <div className={donut ? 'distribution with-donut' : 'distribution'}>{donut && <div className="donut-chart"><svg viewBox="0 0 120 120" role="img" aria-label={`Toplam ${number(total)} sipariş`}>
    {data.map((row, i) => { const length = row.count / total * 301.6; const element = <circle key={row.label} cx="60" cy="60" r="48" fill="none" stroke={palette[i % palette.length]} strokeWidth="13" strokeDasharray={`${length} ${301.6 - length}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />; offset += length; return element })}
  </svg><div><strong>{number(total)}</strong><span>sipariş</span></div></div>}
    <div className="distribution-legend">{data.map((row, i) => <div key={row.label} className="distribution-row"><div><span className="legend-label"><i style={{ background: palette[i % palette.length] }} />{labels[row.label] || row.label}</span><strong>{number(row.count)}</strong></div>{!donut && <div className="bar-track"><span style={{ width: `${row.count / total * 100}%`, background: palette[i % palette.length] }} /></div>}</div>)}</div>
  </div>
}
