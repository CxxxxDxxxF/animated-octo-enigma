"use client";

import { useEffect, useState } from 'react';
import {
    Users,
    Search,
    Trash2,
    ExternalLink,
    Loader2,
    ChevronRight,
    Plus,
    TrendingUp,
    TrendingDown
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface Profile {
    profileKey: string;
    username: string;
    profileId: string;
    lastUpdated?: string;
    isTracking?: boolean;
    equity?: number;
    realizedPnl?: number;
    openPositions?: number;
}

export default function ProfilesPage() {
    const [tracked, setTracked] = useState<Profile[]>([]);
    const [searchResults, setSearchResults] = useState<Profile | null>(null);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);

    const fetchTracked = async () => {
        try {
            const res = await fetch('http://localhost:3002/api/kalshi/tracked-profiles');
            const data = await res.json();
            setTracked(data);
        } catch (e) {
            console.error('Failed to fetch tracked profiles');
        }
    };

    useEffect(() => {
        fetchTracked();
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query) return;
        setSearching(true);
        setSearchResults(null);
        try {
            const res = await fetch(`http://localhost:3002/api/kalshi/profiles/${query}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setSearchResults(data);
        } catch (e) {
            alert('Profile not found via API');
        } finally {
            setSearching(false);
        }
    };

    const toggleTrack = async (key: string, isTracked: boolean) => {
        setLoading(true);
        try {
            const method = isTracked ? 'DELETE' : 'POST';
            await fetch(`http://localhost:3002/api/kalshi/profiles/${key}/track`, { method });
            await fetchTracked();
            if (searchResults?.profileKey === key) {
                setSearchResults(null);
                setQuery('');
            }
        } catch (e) {
            console.error('Toggle track failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
                        <Users className="text-primary w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Kalshi Profiles</h1>
                        <p className="text-gray-400">Track and analyze whale performance</p>
                    </div>
                </div>
                <Link href="/" className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors text-sm font-medium">
                    Back to Terminal
                </Link>
            </div>

            {/* Search Section */}
            <div className="bg-gray-900/50 rounded-3xl p-6 border border-white/5 shadow-2xl backdrop-blur-xl">
                <form onSubmit={handleSearch} className="flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search username or profile ID..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono"
                        />
                    </div>
                    <button
                        disabled={searching}
                        className="px-8 bg-primary text-primary-foreground font-bold rounded-2xl hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-2"
                    >
                        {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                        Search
                    </button>
                </form>

                <AnimatePresence>
                    {searchResults && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-6 pt-6 border-t border-white/5"
                        >
                            <div className="bg-black/20 rounded-2xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl uppercase">
                                        {searchResults.username[0]}
                                    </div>
                                    <div>
                                        <p className="font-bold text-white text-lg">{searchResults.username}</p>
                                        <p className="text-xs text-gray-500 font-mono">ID: {searchResults.profileId}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => toggleTrack(searchResults.profileKey, false)}
                                    className="px-6 py-2 bg-primary/20 text-primary rounded-xl border border-primary/30 hover:bg-primary/30 transition-all flex items-center gap-2 font-bold"
                                >
                                    <Plus className="w-4 h-4" />
                                    Track Profile
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tracked.map((p) => (
                    <motion.div
                        key={p.profileKey}
                        layout
                        className="group relative bg-gray-900/40 border border-white/5 rounded-3xl p-6 hover:border-primary/30 transition-all cursor-pointer overflow-hidden"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                                    {p.username[0].toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white group-hover:text-primary transition-colors">{p.username}</h3>
                                    <span className="text-[10px] text-gray-600 font-mono uppercase">Live Tracking</span>
                                </div>
                            </div>
                            <button
                                onClick={(e) => { e.preventDefault(); toggleTrack(p.profileKey, true); }}
                                className="p-2 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-3 pt-2 border-t border-white/5">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Equity</span>
                                <span className="text-white font-mono">${(p.equity || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">P/L (Realized)</span>
                                <span className={`${(p.realizedPnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'} flex items-center gap-1 text-xs`}>
                                    {(p.realizedPnl || 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    ${(p.realizedPnl || 0).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <Link href={`/profiles/${p.profileKey}`} className="mt-4 w-full py-2 bg-gray-800 group-hover:bg-primary group-hover:text-primary-foreground rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all">
                            View Analytics <ChevronRight className="w-4 h-4" />
                        </Link>
                    </motion.div>
                ))}

                {tracked.length === 0 && (
                    <div className="col-span-full py-20 text-center space-y-4 bg-gray-900/20 rounded-3xl border-2 border-dashed border-white/5">
                        <Users className="w-12 h-12 text-gray-700 mx-auto" />
                        <div className="text-gray-500 px-4">
                            <p className="font-bold text-lg">No profiles tracked yet</p>
                            <p className="text-sm">Search for a username above to start recording snapshots.</p>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
