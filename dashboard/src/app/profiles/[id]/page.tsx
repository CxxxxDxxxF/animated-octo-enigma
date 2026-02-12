"use client";

import { useEffect, useState, use } from 'react';
import {
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    Activity,
    History,
    Calendar,
    Wallet,
    Loader2,
    AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import { format } from 'date-fns';

interface Snapshot {
    id: number;
    ts: string;
    equity: number;
    realized_pnl: number;
    unrealized_pnl: number;
    open_positions: number;
    volume: number;
}

interface Profile {
    profileKey: string;
    username: string;
    profileId: string;
    lastUpdated?: string;
}

export default function ProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [pRes, sRes] = await Promise.all([
                    fetch(`http://localhost:3002/api/kalshi/profiles/${id}`),
                    fetch(`http://localhost:3002/api/kalshi/profiles/${id}/snapshots?range=30d`)
                ]);
                const pData = await pRes.json();
                const sData = await sRes.json();
                setProfile(pData);
                setSnapshots(sData);
            } catch (e) {
                console.error('Failed to fetch profile details');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
        );
    }

    const chartData = snapshots.map(s => ({
        time: format(new Date(s.ts), 'MMM dd'),
        equity: s.equity,
        pnl: s.realized_pnl
    }));

    const latest = snapshots[snapshots.length - 1];

    return (
        <main className="min-h-screen p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <Link href="/profiles" className="p-3 rounded-2xl bg-gray-900 border border-white/5 hover:border-primary/50 transition-all">
                        <ArrowLeft className="text-white w-6 h-6" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white mb-1">{profile?.username}</h1>
                        <p className="text-gray-500 font-mono text-xs uppercase tracking-widest">Kalshi Wallet Index: {profile?.profileId}</p>
                    </div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 px-4 py-2 rounded-xl flex items-center gap-2 text-yellow-500 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Portfolio details unavailable via standard public API</span>
                </div>
            </div>

            {/* Grid Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gray-900/40 rounded-3xl p-6 border border-white/5 overflow-hidden relative">
                    <div className="relative z-10">
                        <p className="text-gray-500 text-sm mb-1 uppercase font-bold tracking-tighter">Est. Equity</p>
                        <h2 className="text-3xl font-bold text-white font-mono">${latest?.equity.toFixed(2) || '0.00'}</h2>
                    </div>
                    <Wallet className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5 rotate-12" />
                </div>
                <div className="bg-gray-900/40 rounded-3xl p-6 border border-white/5">
                    <p className="text-gray-500 text-sm mb-1 uppercase font-bold tracking-tighter">Realized PnL</p>
                    <h2 className={`text-3xl font-bold font-mono ${latest?.realized_pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {latest?.realized_pnl >= 0 ? '+' : ''}${latest?.realized_pnl.toFixed(2) || '0.00'}
                    </h2>
                </div>
                <div className="bg-gray-900/40 rounded-3xl p-6 border border-white/5">
                    <p className="text-gray-500 text-sm mb-1 uppercase font-bold tracking-tighter">Open Trades</p>
                    <h2 className="text-3xl font-bold text-white font-mono">{latest?.open_positions || 0}</h2>
                </div>
                <div className="bg-gray-900/40 rounded-3xl p-6 border border-white/5">
                    <p className="text-gray-500 text-sm mb-1 uppercase font-bold tracking-tighter">24h Volume</p>
                    <h2 className="text-3xl font-bold text-white font-mono">${(latest?.volume / 100).toFixed(2) || '0.00'}k</h2>
                </div>
            </div>

            {/* Chart Section */}
            <div className="bg-gray-900/50 rounded-3xl p-8 border border-white/5 shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <TrendingUp className="text-primary w-6 h-6" />
                        <h3 className="text-xl font-bold text-white">Performance Overview</h3>
                    </div>
                    <div className="flex gap-2">
                        <span className="px-3 py-1 bg-primary/20 text-primary text-xs rounded-full font-bold">30D History</span>
                    </div>
                </div>

                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                            <XAxis
                                dataKey="time"
                                stroke="#666"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="#666"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `$${value}`}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '12px' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="equity"
                                stroke="#22c55e"
                                fillOpacity={1}
                                fill="url(#colorEquity)"
                                strokeWidth={3}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Snapshot History Table */}
            <div className="bg-gray-900/30 rounded-3xl border border-white/5 overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <History className="text-gray-400 w-5 h-5" />
                        <h3 className="font-bold text-white">Daily Snapshots</h3>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-gray-500 text-xs uppercase tracking-tighter">
                                <th className="px-6 py-4 font-bold">Date</th>
                                <th className="px-6 py-4 font-bold">Equity</th>
                                <th className="px-6 py-4 font-bold">Realized PnL</th>
                                <th className="px-6 py-4 font-bold">Positions</th>
                                <th className="px-6 py-4 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {snapshots.map((s) => (
                                <tr key={s.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-white font-medium">
                                            <Calendar className="w-4 h-4 text-gray-500" />
                                            {format(new Date(s.ts), 'yyyy-MM-dd')}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-white font-mono">${s.equity.toFixed(2)}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`font-mono font-bold ${s.realized_pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {s.realized_pnl >= 0 ? '+' : ''}{s.realized_pnl.toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-400">{s.open_positions}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-gray-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                                            Export CSV
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {snapshots.length === 0 && (
                    <div className="p-20 text-center text-gray-500 uppercase text-xs tracking-widest">
                        Awaiting first daily snapshot...
                    </div>
                )}
            </div>
        </main>
    );
}
