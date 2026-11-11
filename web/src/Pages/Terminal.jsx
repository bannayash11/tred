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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center">
            Live Institutional Order Block Terminal
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Scanning NSE F&O stocks for institutional footprints — access limited by your membership plan.
          </p>
        </div>
        {membership.allowMarketXRay && (
          <button
            type="button"
            onClick={() => navigate('/xray')}
            className="text-xs font-semibold text-cyan-400 hover:underline flex items-center"
          >
            View Full Market X-Ray Heatmap →
          </button>
        )}
      </div>

      <MembershipBanner user={user} onOpenPricing={onOpenPricing} />

      <MarketXRayBar xrayData={localXRay} />

      {/* Terminal View Mode Switcher */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setTerminalTab('SCREENER')}
          className={`flex items-center space-x-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            terminalTab === 'SCREENER'
              ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Institutional Order Block Screener</span>
        </button>

        <button
          type="button"
          onClick={() => setTerminalTab('MOMENTUM')}
          className={`flex items-center space-x-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            terminalTab === 'MOMENTUM'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Zap className="h-4 w-4 text-amber-400" />
          <span>Opening 5-Minute Momentum Scanner</span>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-extrabold text-emerald-400 border border-emerald-500/30">
            09:20 LIVE
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
