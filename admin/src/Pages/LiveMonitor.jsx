import React from 'react';
import { Activity, Radio, Cpu, Zap, CheckCircle2 } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import PageHeader from '../components/ui/PageHeader';
import Panel from '../components/ui/Panel';

export default function LiveMonitor() {
  const { screenerData } = useAdmin();

  const stocks = screenerData?.allStocks || [];
  const totalStocks = stocks.length;
  const bullishCount = screenerData?.bullishSetups?.length || 0;
  const bearishCount = screenerData?.bearishSetups?.length || 0;
  const hasLive = totalStocks > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitor"
        description="Live SMC engine status and scanned universe."
        icon={Activity}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Panel className="space-y-2 p-5">
          <div className="flex items-center justify-between text-xs text-admin-muted">
            <span>Universe size</span>
            <Cpu className="h-4 w-4 text-admin-accent" />
          </div>
          <div className="font-mono text-2xl font-semibold text-white">
            {hasLive ? `${totalStocks} stocks` : 'Waiting…'}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-admin-muted">
            <CheckCircle2 className="h-3.5 w-3.5 text-admin-success" />
            {hasLive ? 'Feed data received' : 'No screener payload yet'}
          </div>
        </Panel>

        <Panel className="space-y-2 p-5">
          <div className="flex items-center justify-between text-xs text-admin-muted">
            <span>Active setups</span>
            <Radio className="h-4 w-4 text-admin-success" />
          </div>
          <div className="font-mono text-2xl font-semibold text-admin-success">
            {bullishCount + bearishCount}
          </div>
          <div className="text-xs text-admin-muted">
            {bullishCount} bullish · {bearishCount} bearish
          </div>
        </Panel>

        <Panel className="space-y-2 p-5">
          <div className="flex items-center justify-between text-xs text-admin-muted">
            <span>Socket</span>
            <Zap className="h-4 w-4 text-admin-accent" />
          </div>
          <div className="font-mono text-2xl font-semibold text-white">Socket.io</div>
          <div className="flex items-center gap-1.5 text-xs text-admin-success">
            <span className="h-2 w-2 rounded-full bg-admin-success" />
            Backend :5001
          </div>
        </Panel>
      </div>

      <Panel className="space-y-4 p-5">
        <h3 className="text-sm font-semibold text-white">
          Scanned symbols {hasLive ? `(${totalStocks})` : ''}
        </h3>
        {hasLive ? (
          <div className="flex flex-wrap gap-2">
            {stocks.map((sym, idx) => (
              <span
                key={idx}
                className="rounded-lg border border-admin-border bg-admin-bg px-2.5 py-1 font-mono text-[11px] text-slate-300"
              >
                {typeof sym === 'string' ? sym : sym.symbol}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-admin-muted">
            Live symbols will appear here when the market feed / screener pushes data.
          </p>
        )}
      </Panel>
    </div>
  );
}
