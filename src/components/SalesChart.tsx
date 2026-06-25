'use client'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function SalesChart({ data }: { data: { day: string; revenue: number; profit: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ left: -10, right: 8, top: 4 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b8cff" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#5b8cff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#262c3a" vertical={false} />
        <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
        <YAxis stroke="#64748b" fontSize={11} tickLine={false} width={48} />
        <Tooltip contentStyle={{ background: '#161a23', border: '1px solid #262c3a', borderRadius: 8, fontSize: 12 }} />
        <Area type="monotone" dataKey="revenue" stroke="#5b8cff" fill="url(#rev)" strokeWidth={2} />
        <Area type="monotone" dataKey="profit" stroke="#3ecf8e" fill="none" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
