"use client";

import { useEffect, useState, useRef } from 'react';
import {
  Activity,
  Wallet,
  History,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  ZapOff,
  Bell,
  Target,
  Settings,
  ShieldAlert,
  BarChart3,
  Terminal as TerminalIcon,
  Wifi,
  WifiOff,
  Briefcase,
  Users,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface BotState {
  kalshiBalance: number;
  initialDailyBalance: number;
  currentExposure: number;
  dailyPL: number;
  lastPollTime: string;
  status: 'idle' | 'polling' | 'executing' | 'error' | 'stopped';
  activeExchanges: string[];
  errorCount: number;
  lastError?: string;
  monitoredMarkets: any[];
  tradeHistory: any[];
  executionSignals: any[];
  autoTradeEnabled: boolean;
  consoleLogs: string[];
  activePositions: any[];
  schedulerHealth?: {
    readUsage: number;
    writeUsage: number;
    queueSize: number;
    circuitBroken: boolean;
  };
}

export default function Dashboard() {
  const [state, setState] = useState<BotState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoTrade, setAutoTrade] = useState(false);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('http://localhost:3002/api/state');
        if (!res.ok) throw new Error('API offline');
        const data = await res.json();
        setState(data);
        setAutoTrade(data.autoTradeEnabled);
        setLastSync(new Date());
        setError(null);
      } catch (err) {
        setError('Connection to bot lost. Retrying...');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [state?.consoleLogs]);

  const toggleAutoTrade = async () => {
    try {
      const res = await fetch('http://localhost:3002/api/config/toggle-auto', { method: 'POST' });
      const data = await res.json();
      setAutoTrade(data.enabled);
    } catch (e) {
      console.error('Toggle failed');
    }
  };

  const isConnected = state && !error && (new Date().getTime() - lastSync.getTime() < 5000);

  return (
    <main className="min-h-screen p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
            <ShieldCheck className="text-primary w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-white">PMXT <span className="text-primary/80 font-normal">Production Engine</span></h1>
              <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-primary/10 border border-primary/20 rounded-xl">
                <ShieldCheck size={14} className="text-primary" />
                <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">Defensive Spread Capture Active</span>
              </div>
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isConnected ? 'bg-success/10 text-success border border-success/20' : 'bg-error/10 text-error border border-error/20'
                }`}>
                {isConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
                {isConnected ? 'Live Engine Connected' : 'Engine Disconnected'}
              </div>
            </div>
            <p className="text-secondary text-sm">Disciplined capital preservation & market monitoring</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/profiles"
            className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-white rounded-full font-bold hover:bg-white/10 transition-all active:scale-95"
          >
            <Users size={18} className="text-primary" />
            PROFILES
          </Link>

          <Link
            href="/social"
            className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-white rounded-full font-bold hover:bg-white/10 transition-all active:scale-95"
          >
            <TrendingUp size={18} className="text-primary" />
            SOCIAL INTEL
          </Link>

          <button
            onClick={toggleAutoTrade}
            disabled={state?.status === 'stopped'}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all shadow-lg active:scale-95 ${autoTrade
              ? 'bg-error text-white shadow-error/20'
              : 'bg-primary text-black shadow-primary/20 hover:bg-primary/90'
              } disabled:opacity-50 disabled:grayscale`}
          >
            {autoTrade ? <ZapOff size={18} /> : <RefreshCw className={state?.status === 'polling' ? 'animate-spin' : ''} size={18} />}
            {autoTrade ? 'STOP AUTO-TRADE' : 'START AUTO-TRADE'}
          </button>

          <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${state?.status === 'stopped' ? 'bg-error animate-pulse' :
              state?.status === 'polling' ? 'bg-primary animate-pulse' : 'bg-success'
              }`} />
            <span className="text-xs font-bold uppercase tracking-widest text-white/80">
              {state?.status || 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="animate-spin text-primary" size={32} />
        </div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-error/10 border border-error/20 text-error flex items-center gap-3"
        >
          <AlertCircle size={20} />
          <p className="font-medium">{error}</p>
        </motion.div>
      )}

      {/* Risk Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Bankroll"
          value={`$${(state?.kalshiBalance ?? 0).toFixed(2)}`}
          icon={<Wallet className="text-accent" />}
          subTitle={`Starts Day: $${(state?.initialDailyBalance ?? 0).toFixed(2)}`}
        />
        <StatCard
          title="Exposure"
          value={`$${(state?.currentExposure ?? 0).toFixed(2)}`}
          icon={<Target className="text-primary" />}
          subTitle="Max Limit: $10.00"
          status={(state?.currentExposure ?? 0) > 8 ? 'warning' : 'ok'}
        />
        <StatCard
          title="Daily P/L"
          value={`$${(state?.dailyPL ?? 0).toFixed(2)}`}
          icon={<BarChart3 className={(state?.dailyPL ?? 0) >= 0 ? 'text-success' : 'text-error'} />}
          subTitle="Limit: -$9.00"
          status={(state?.dailyPL ?? 0) <= -7 ? 'warning' : 'ok'}
        />
        <StatCard
          title="Scheduler"
          value={state?.schedulerHealth ? `${(state.schedulerHealth.readUsage * 100).toFixed(0)}% RPS` : 'Idle'}
          icon={<RefreshCw className={state?.schedulerHealth?.circuitBroken ? "text-error" : "text-primary"} />}
          subTitle={`Queue: ${state?.schedulerHealth?.queueSize || 0} reqs`}
          status={state?.schedulerHealth?.circuitBroken ? 'warning' : 'ok'}
        />
        <StatCard
          title="Heartbeat"
          value={state?.lastPollTime || '--:--'}
          icon={<Activity className="text-success" />}
          subTitle="Secure Feed"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Monitored Markets */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <Activity className="text-primary" size={20} />
            <h3 className="text-xl font-semibold">Discovery Feed</h3>
            <span className="text-xs text-secondary ml-auto bg-white/5 px-2 py-0.5 rounded">Vol &gt; $10k only</span>
          </div>
          <div className="grid grid-cols-1 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {state?.monitoredMarkets?.map((market, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 rounded-xl bg-white/5 border border-white/10 flex justify-between items-center group hover:border-primary/50 transition-colors"
              >
                <div>
                  <h4 className="font-bold text-white text-lg">{market.displayTitle}</h4>
                  <div className="flex gap-2 items-center">
                    <span className="text-[10px] text-secondary font-mono uppercase tracking-widest">{market.marketId}</span>
                    <span className="text-[10px] text-success font-bold uppercase tracking-tight">Vol: ${((market.volume24h || 0) / 1000).toFixed(1)}k</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  {market.outcomes?.map((outcome: any, j: number) => (
                    <div key={j} className={`flex flex-col items-center px-4 py-2 rounded-lg border ${outcome.label === 'Yes' ? 'bg-primary/5 border-primary/20' : 'bg-white/5 border-white/10'
                      }`}>
                      <span className="text-[10px] text-secondary font-medium uppercase">{outcome.label}</span>
                      <span className={`text-xl font-mono font-bold ${outcome.label === 'Yes' ? 'text-primary' : 'text-white/80'}`}>
                        {(outcome.price * 100).toFixed(0)}¢
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Portfolio / Active Positions */}
          <div className="space-y-4 mt-8">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <Briefcase className="text-accent" size={20} />
              <h3 className="text-xl font-semibold">Active Portfolio</h3>
              <span className="text-xs text-secondary ml-auto">{state?.activePositions?.length || 0} Open Positions</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {state?.activePositions?.map((pos, i) => (
                <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 flex justify-between items-center group">
                  <div>
                    <h4 className="font-bold text-white">{pos.displayTitle || pos.marketId}</h4>
                    <div className="flex gap-2 text-[10px] font-mono text-secondary">
                      <span className="uppercase tracking-widest">{pos.marketId}</span>
                      <span>|</span>
                      <span>Size: {Math.abs(pos.size)}</span>
                      <span>Avg: {(pos.entryPrice * 100).toFixed(0)}¢</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${(pos.unrealizedPnL || 0) >= 0 ? 'text-success' : 'text-error'}`}>
                      {(pos.unrealizedPnL || 0) >= 0 ? '+' : ''}${pos.unrealizedPnL?.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-white/50 tracking-tighter uppercase font-bold">Unrealized P/L</div>
                  </div>
                </div>
              ))}
              {(!state?.activePositions || state.activePositions.length === 0) && (
                <div className="md:col-span-2 py-8 text-center text-secondary italic text-sm border border-dashed border-white/10 rounded-xl">
                  No active holdings. Ready for sniper entries.
                </div>
              )}
            </div>
          </div>

          {/* Bot Console */}
          <div className="space-y-4 mt-8">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <TerminalIcon className="text-primary" size={20} />
              <h3 className="text-xl font-semibold">Bot Console</h3>
            </div>
            <div
              ref={terminalRef}
              className="bg-black/80 rounded-xl p-4 font-mono text-xs h-[300px] overflow-y-auto border border-white/10 custom-scrollbar"
            >
              {state?.consoleLogs?.map((log, i) => (
                <div key={i} className={`mb-1 ${log.includes('❌') ? 'text-error' :
                  log.includes('✅') ? 'text-success' :
                    log.includes('🛑') ? 'text-error font-bold' : 'text-white/70'
                  }`}>
                  <span className="text-primary opacity-50 mr-2">$</span>
                  {log}
                </div>
              ))}
              {(!state?.consoleLogs || state.consoleLogs.length === 0) && (
                <p className="text-secondary italic">Terminal initialized. Awaiting logs...</p>
              )}
            </div>
          </div>
        </div>

        {/* Signals */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <Bell className="text-error" size={20} />
            <h3 className="text-lg font-semibold">Safety & Signals</h3>
          </div>
          <div className="glass-card rounded-xl p-4 space-y-3 h-[calc(100%-48px)]">
            <AnimatePresence initial={false}>
              {state?.executionSignals?.map((signal) => (
                <motion.div
                  key={signal.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-xs p-3 rounded border ${signal.type === 'trade' ? 'bg-success/20 border-success/30 text-success' : 'bg-white/5 border-white/10 text-white'
                    }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold uppercase tracking-tighter opacity-80">{signal.type}</span>
                    <span className="opacity-50 font-mono text-[10px]">{signal.time}</span>
                  </div>
                  <p className="font-medium">{signal.message}</p>
                </motion.div>
              ))}
              {(!state?.executionSignals || state.executionSignals.length === 0) && (
                <p className="text-center text-secondary py-12 italic text-sm">Waiting for market signals...</p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({ title, value, icon, subTitle, status = 'ok' }: { title: string, value: string, icon: React.ReactNode, subTitle?: string, status?: 'ok' | 'warning' }) {
  return (
    <div className={`glass-card rounded-2xl p-6 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300 ${status === 'warning' ? 'border-error/40' : 'border-white/5'}`}>
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        {icon}
      </div>
      <p className="text-secondary text-xs font-semibold mb-1 uppercase tracking-widest">{title}</p>
      <div className={`text-3xl font-bold tracking-tight ${status === 'warning' ? 'text-error' : 'text-white'}`}>{value}</div>
      {subTitle && <p className="mt-2 text-[10px] text-secondary uppercase font-bold tracking-tighter">{subTitle}</p>}
    </div>
  );
}
