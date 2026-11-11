import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Layers, Zap } from 'lucide-react';
import MarketXRayBar from '../components/MarketXRayBar';
import ScreenerBoard from '../components/ScreenerBoard';
import OpeningMomentumScanner from '../components/OpeningMomentumScanner';
import MembershipBanner from '../components/MembershipBanner';
import MembershipLocked from '../components/MembershipLocked';
import { fetchScreener, fetchMarketXRay } from '../services/api';
import { setScreenerData, setMarketXRay } from '../store/slices/screenerSlice';
import { getMembership } from '../lib/membership';

export default function Terminal(props) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const context = useOutletContext() || {};
  const authUser = useSelector((state) => state.auth.user);
  const plans = useSelector((state) => state.content?.plans || []);

  const reduxScreener = useSelector((state) => state?.screener);
  const [localScreener, setLocalScreener] = useState(
    props.screenerData || context.screenerData || null
  );
  const [localXRay, setLocalXRay] = useState(
    props.xrayData || context.xrayData || reduxScreener?.marketXRay || null
  );
  const [terminalTab, setTerminalTab] = useState('SCREENER'); // 'SCREENER' | 'MOMENTUM'

  useEffect(() => {
    if (context.screenerData) {
      setLocalScreener(context.screenerData);
    } else {
      fetchScreener()
        .then((res) => {
          if (res.success && res.data) {
            setLocalScreener(res.data);
            dispatch(
              setScreenerData({
                all: res.data.allStocks,
                bullish: res.data.bullishSetups,
                bearish: res.data.bearishSetups
              })
            );
          }
        })
        .catch((err) => console.error('Error fetching screener in Terminal:', err));
    }

    if (context.xrayData) {
      setLocalXRay(context.xrayData);
    } else {
      fetchMarketXRay()
        .then((res) => {
          if (res.success && res.data) {
            setLocalXRay(res.data);
            dispatch(setMarketXRay(res.data));
          }
        })
        .catch((err) => console.error('Error fetching xray in Terminal:', err));
    }
  }, [context.screenerData, context.xrayData, dispatch]);

  const onSelectStock = props.onSelectStock || context.onSelectStock;
  const liveUpdatedSymbols = props.liveUpdatedSymbols || context.liveUpdatedSymbols;
  const user = props.user || context.user || authUser;
  const onOpenPricing = props.onOpenPricing || context.onOpenPricing || (() => navigate('/pricing'));
  const membership = getMembership(user, plans);

  if (!membership.allowTerminal) {
    return (
      <MembershipLocked
        title="Terminal locked"
        message={membership.upgradeHint || 'Your membership does not include Terminal access.'}
        onOpenPricing={onOpenPricing}
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Live Terminal
          </h1>
          <p className="text-[12px] text-slate-400 mt-1 max-w-xl leading-relaxed">
            NSE F&O order-block scanner — tap a stock to open its chart.
          </p>
        </div>
        {membership.allowMarketXRay && (
          <button
            type="button"
            onClick={() => navigate('/xray')}
            className="inline-flex items-center self-start sm:self-auto rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-colors"
          >
            Full Market X-Ray →
          </button>
        )}
      </div>

      <MembershipBanner user={user} onOpenPricing={onOpenPricing} />

      <MarketXRayBar xrayData={localXRay} />

      <div className="inline-flex w-full sm:w-auto rounded-xl border border-slate-800 bg-slate-950/70 p-1 gap-1">
        <button
          type="button"
          onClick={() => setTerminalTab('SCREENER')}
          className={`flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-[12px] font-semibold transition-colors ${
            terminalTab === 'SCREENER'
              ? 'bg-amber-500 text-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Order Block Screener</span>
        </button>

        <button
          type="button"
          onClick={() => setTerminalTab('MOMENTUM')}
          className={`flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-[12px] font-semibold transition-colors ${
            terminalTab === 'MOMENTUM'
              ? 'bg-amber-500 text-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
          }`}
        >
          <Zap className={`h-3.5 w-3.5 ${terminalTab === 'MOMENTUM' ? 'text-black' : 'text-amber-400'}`} />
          <span>5m Momentum</span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
              terminalTab === 'MOMENTUM'
                ? 'bg-black/15 text-black'
                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
            }`}
          >
            09:20
          </span>
        </button>
      </div>

      {terminalTab === 'SCREENER' ? (
        <ScreenerBoard
          screenerData={localScreener}
          onSelectStock={onSelectStock}
          liveUpdatedSymbols={liveUpdatedSymbols}
          user={user}
          onOpenPricing={onOpenPricing}
        />
      ) : (
        <OpeningMomentumScanner
          onSelectStock={onSelectStock}
          liveUpdatedSymbols={liveUpdatedSymbols}
          user={user}
          onOpenPricing={onOpenPricing}
        />
      )}
    </div>
  );
}
