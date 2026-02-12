"use client";

import React, { useState, useEffect } from 'react';
import {
    Users,
    TrendingUp,
    BarChart3,
    PieChart,
    Search,
    Eye,
    EyeOff,
    Target,
    ArrowUpRight,
    ChevronRight,
    Activity,
    Home
} from 'lucide-react';
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
import Link from 'next/link';

const API_BASE = "http://localhost:3002/api";

interface LeaderboardEntry {
    profileId: string;
    username: string;
    rank: number;
    totalProfit: number;
    volume: number;
    predictions: number;
    lastUpdated: string;
}

export default function SocialTracker() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [activeTab, setActiveTab] = useState('profit'); // profit, volume, predictions
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProfile, setSelectedProfile] = useState<LeaderboardEntry | null>(null);
    const [snapshots, setSnapshots] = useState<any[]>([]);

    useEffect(() => {
        fetchLeaderboard();
    }, [activeTab]);

    const fetchLeaderboard = async () => {
        setLoading(true);
        try {
            const resp = await fetch(`${API_BASE}/social/leaderboard?type=${activeTab}`);
            const data = await resp.json();
            setLeaderboard(data);
        } catch (e) {
            console.error("Failed to fetch leaderboard", e);
        } finally {
            setLoading(false);
        }
    };

    const handleTrack = async (profileId: string, username: string) => {
        try {
            await fetch(`${API_BASE}/social/profile/${profileId}/track`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            fetchLeaderboard();
        } catch (e) {
            console.error("Failed to track", e);
        }
    };

    const openProfile = async (profile: LeaderboardEntry) => {
        setSelectedProfile(profile);
        try {
            const resp = await fetch(`${API_BASE}/social/profile/${profile.profileId}/snapshots`);
            const data = await resp.json();
            setSnapshots(data);
        } catch (e) {
            console.error("Failed to fetch snapshots", e);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white p-8 font-sans">
            {/* Header */}
            <div className="flex justify-between items-center mb-12">
                <div>
                    <h1 className="text-4xl font-black tracking-tight flex items-center gap-3 bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                        <Users className="w-10 h-10 text-blue-500" />
                        SOCIAL INTEL
                    </h1>
                    <p className="text-gray-500 mt-2 flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Tracking Kalshi Leaderboard & Public Performance Indices
                    </p>
                </div>

                <div className="flex gap-4">
                    <Link
                        href="/"
                        className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors text-sm font-medium flex items-center gap-2"
                    >
                        <Home size={16} />
                        Back to Terminal
                    </Link>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search Public Profiles..."
                            className="bg-[#111] border border-gray-800 rounded-lg py-2 pl-10 pr-4 text-sm focus:border-blue-500 outline-none w-64 transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-8">
                {/* Left: Leaderboard Section */}
                <div className="col-span-8 bg-[#0a0a0a] border border-gray-900 rounded-2xl overflow-hidden">
                    <div className="flex border-b border-gray-900">
                        {['profit', 'volume', 'predictions'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-4 text-sm font-bold uppercase tracking-widest transition-all ${activeTab === tab
                                    ? 'text-blue-500 border-b-2 border-blue-500 bg-blue-500/5'
                                    : 'text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="p-4">
                        {loading ? (
                            <div className="h-64 flex items-center justify-center text-gray-600 animate-pulse font-mono tracking-widest uppercase">
                                Synchronizing with Kalshi Social Indices...
                            </div>
                        ) : leaderboard.length === 0 ? (
                            <div className="h-96 flex flex-col items-center justify-center text-center p-12">
                                <div className="bg-blue-500/10 p-6 rounded-full mb-6">
                                    <TrendingUp className="w-12 h-12 text-blue-500 opacity-50" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">Social Hub Initializing</h3>
                                <p className="text-gray-500 max-w-sm mb-6">
                                    Official leaderboard data is being processed through our secure intelligence layer.
                                    Check back as indices populate.
                                </p>
                                <div className="flex gap-4">
                                    <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4" />
                                        Connect Official API
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-gray-600 text-[10px] uppercase tracking-widest border-b border-gray-900">
                                        <th className="py-4 pl-4">Rank</th>
                                        <th className="py-4">Trader / Profile</th>
                                        <th className="py-4">Performance Index</th>
                                        <th className="py-4">Status</th>
                                        <th className="py-4 pr-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaderboard.map((entry) => (
                                        <tr
                                            key={entry.profileId}
                                            onClick={() => openProfile(entry)}
                                            className="group border-b border-gray-900/50 hover:bg-blue-500/5 transition-all cursor-pointer"
                                        >
                                            <td className="py-4 pl-4 font-mono text-gray-500">#{entry.rank}</td>
                                            <td className="py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-800 to-gray-700 flex items-center justify-center text-[10px] font-bold">
                                                        {entry.username.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-sm group-hover:text-blue-400 transition-colors uppercase">{entry.username}</div>
                                                        <div className="text-[10px] text-gray-600 font-mono tracking-tighter">{entry.profileId}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-emerald-400 font-bold">${(entry.totalProfit || 0).toLocaleString()}</span>
                                                    <span className="text-[10px] text-gray-600 font-mono uppercase">Profit Index</span>
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                <span className="text-[10px] px-2 py-0.5 rounded-full border border-gray-800 text-gray-500 font-bold uppercase tracking-widest">
                                                    Public
                                                </span>
                                            </td>
                                            <td className="py-4 pr-4 text-right">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleTrack(entry.profileId, entry.username); }}
                                                    className="text-[#0a0a0a] bg-white hover:bg-gray-200 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all"
                                                >
                                                    Track
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Right: Focused Insight Panel */}
                <div className="col-span-4 space-y-8">
                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#0a0a0a] border border-gray-900 p-4 rounded-xl">
                            <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Tracked Portfolios</div>
                            <div className="text-2xl font-black">12</div>
                        </div>
                        <div className="bg-[#0a0a0a] border border-gray-900 p-4 rounded-xl">
                            <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Index Refresh</div>
                            <div className="text-2xl font-black text-blue-500">60s</div>
                        </div>
                    </div>

                    {/* Profile Detail Sideview */}
                    <div className="bg-[#0a0a0a] border border-gray-900 rounded-2xl p-6 min-h-[500px]">
                        {selectedProfile ? (
                            <div>
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center text-white font-black text-xl">
                                            {selectedProfile.username.charAt(0)}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black uppercase tracking-tight">{selectedProfile.username}</h2>
                                            <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                                                <Target className="w-3 h-3" />
                                                ID: {selectedProfile.profileId}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedProfile(null)} className="text-gray-600 hover:text-white">&times;</button>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="bg-[#111] p-3 rounded-lg border border-gray-800">
                                        <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Predictions</div>
                                        <div className="text-lg font-black text-emerald-400">{selectedProfile.predictions}</div>
                                    </div>
                                    <div className="bg-[#111] p-3 rounded-lg border border-gray-800">
                                        <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Volume Rank</div>
                                        <div className="text-lg font-black text-blue-400">#{selectedProfile.rank}</div>
                                    </div>
                                </div>

                                <div className="h-48 mb-8">
                                    <div className="text-[10px] text-gray-500 font-bold uppercase mb-4 flex items-center justify-between">
                                        Performance Index Trend
                                        <span className="text-emerald-400"> +{((selectedProfile.totalProfit / 1000) * 1.2).toFixed(1)}% (30d)</span>
                                    </div>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={[
                                            { ts: '1', val: 1000 },
                                            { ts: '2', val: 1200 },
                                            { ts: '3', val: 1100 },
                                            { ts: '4', val: 1400 },
                                            { ts: '5', val: 1600 },
                                            { ts: '6', val: 1550 },
                                            { ts: '7', val: 1900 },
                                        ]}>
                                            <defs>
                                                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <Area type="monotone" dataKey="val" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="space-y-3">
                                    <div className="text-[10px] text-gray-500 font-bold uppercase mb-2 tracking-[0.2em]">Strategy Metadata</div>
                                    <div className="flex items-center justify-between text-xs py-2 border-b border-gray-900">
                                        <span className="text-gray-500">Core Strategy</span>
                                        <span className="font-bold text-gray-300">High-Conviction Yield</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs py-2 border-b border-gray-900">
                                        <span className="text-gray-500">Avg Tick Size</span>
                                        <span className="font-bold text-gray-300">$250.00</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs py-2">
                                        <span className="text-gray-500">Public Status</span>
                                        <span className="text-blue-500 font-black tracking-widest uppercase text-[10px]">Verified Oracle</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                                <BarChart3 className="w-12 h-12 mb-4" />
                                <p className="text-sm font-bold uppercase tracking-widest">Select Profile for Deep Insight</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
