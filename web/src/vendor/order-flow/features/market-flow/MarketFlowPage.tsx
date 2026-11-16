import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageBar } from '@/components/chrome/PageBar';
import { ThemeToggle } from '@/components/chrome/ThemeToggle';
import { applyTheme, readStoredTheme } from '@/lib/applyTheme';
import { CapsuleSegmented } from '@/components/common/CapsuleSegmented';
import { useFitScrollerHeight } from '@/hooks/useFitScrollerHeight';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { Underlying } from '@/lib/underlyings';
import { FlowBoard, type FlowLayout } from './FlowBoard';
import { FlowMobileView } from './FlowMobileView';
import { FlowStatus } from './FlowStatus';
import { DEFAULT_FLOW_SETTINGS, type FlowSettings } from './marketFlowModel';
import { inUniverse, loadUniverse, saveUniverse, type FlowUniverse } from './nifty50';
import { useMarketFlow } from './useMarketFlow';

/*
 * The workspace stylesheet chain: colour system → theme → oi tokens → board → brand.
 * website-brand.css must load last (same as order-flow-main): Chartist fonts + ink.
 */
import '@/styles/ui-colour-system.css';
import '@/styles/ui-theme.css';
import '@/styles/ui-typography.css';
import '@/styles/oi-design-tokens.css';
import './market-flow.css';
import '../underlying/pages-finish.css';
import '@/styles/website-brand.css';

/**
 * Order Flow. Every F&O underlying, read from its future: the day's flow as
 * one chart on the left (bulls rising above the zero rule, bears falling
 * below it), the Bullish half over the Bearish half on the right, each a grid
 * of small tiles ranked by the move and one or two large cards. Hovering a
 * tile lights its line and opens its detail; hovering a line lights its tile.
 *
 * The page keeps nothing of its own. The market file and the futures are the
 * Options Scanner's reads (useMarketFlow), the build-up words are the
 * scanner's, the levels are the chain's open interest. The one choice, the
 * NIFTY 50 or every F&O underlying, is remembered in this browser.
 */

/** The board always reads the whole day, every line drawn, at the day's own floor. */
const SETTINGS: FlowSettings = DEFAULT_FLOW_SETTINGS;
const CHART = { named: SETTINGS.named, lines: SETTINGS.lines };

interface MarketFlowPageProps {
  universe: Underlying[];
}

const UNIVERSES: Array<{ value: FlowUniverse; label: string; title: string }> = [
  { value: 'nifty50', label: 'Nifty 50', title: 'The NIFTY 50 constituents' },
  { value: 'fno', label: 'All F&O', title: 'Every F&O underlying: stocks and indices' },
];

/** Back only — brand wordmark removed so the board keeps the full strip. */
const BRAND = (
  <Link to="/terminal" className="mf-back" aria-label="Back to Charts">
    <span className="mf-back__chev" aria-hidden="true" />
    <span className="mf-back__label">Back</span>
  </Link>
);

type FlowViewMode = 'auto' | 'mobile' | 'desktop';
const FLOW_VIEW_KEY = 'tred_orderflow_view_mode';

function readFlowViewMode(): FlowViewMode {
  try {
    const v = sessionStorage.getItem(FLOW_VIEW_KEY);
    if (v === 'auto' || v === 'mobile' || v === 'desktop') return v;
  } catch {
    /* ignore */
  }
  return 'auto';
}

export function MarketFlowPage({ universe }: MarketFlowPageProps) {
  const [scope, setScope] = useState<FlowUniverse>(loadUniverse);
  const [viewMode, setViewMode] = useState<FlowViewMode>(readFlowViewMode);
  const pageRef = useRef<HTMLDivElement>(null);
  const wider = useMediaQuery('(min-width: 1280px)');
  const wide = useMediaQuery('(min-width: 1100px)');
  const phoneWidth = useMediaQuery('(max-width: 768px)');
  const landscape = useMediaQuery('(orientation: landscape)');

  const setViewModePersist = (mode: FlowViewMode) => {
    setViewMode(mode);
    try {
      sessionStorage.setItem(FLOW_VIEW_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  // Portrait phone → mobile cards UI; landscape phone → desktop board; or force via toggle.
  const useMobileView =
    viewMode === 'mobile' || (viewMode === 'auto' && phoneWidth && !landscape);
  const forceBoard =
    viewMode === 'desktop' || (viewMode === 'auto' && phoneWidth && landscape);

  const layout: FlowLayout = wider
    ? 'diagram'
    : wide
      ? 'desktop'
      : forceBoard
        ? phoneWidth
          ? 'tablet'
          : 'desktop'
        : phoneWidth
          ? 'phone'
          : 'tablet';

  // Desktop/diagram fit the window; landscape-forced board also fits to avoid page overflow.
  const fits = layout === 'desktop' || layout === 'diagram' || (forceBoard && phoneWidth);
  useFitScrollerHeight(pageRef, fits && !useMobileView);
  useEffect(() => { applyTheme(readStoredTheme(), false); }, []);
  useEffect(() => { saveUniverse(scope); }, [scope]);

  const shown = useMemo(() => universe.filter(item => inUniverse(item.symbol, scope)), [universe, scope]);
  const { flow, market, loading, error, provider, futuresRead, futuresTotal, rescan } = useMarketFlow(shown, SETTINGS);

  const viewToggle = phoneWidth ? (
    <div className="mf-view-toggle" role="group" aria-label="Order Flow layout">
      <button
        type="button"
        className={viewMode === 'mobile' ? 'is-on' : undefined}
        onClick={() => setViewModePersist('mobile')}
        title="Mobile view"
      >
        Mobile
      </button>
      <button
        type="button"
        className={viewMode === 'auto' ? 'is-on' : undefined}
        onClick={() => setViewModePersist('auto')}
        title="Auto: portrait mobile, landscape desktop"
      >
        Auto
      </button>
      <button
        type="button"
        className={viewMode === 'desktop' ? 'is-on' : undefined}
        onClick={() => setViewModePersist('desktop')}
        title="Desktop board"
      >
        Desktop
      </button>
    </div>
  ) : null;

  const pageActions = (
    <>
      {viewToggle}
      <CapsuleSegmented options={UNIVERSES} value={scope} onChange={setScope} ariaLabel="Underlyings" groupId="flow-universe" size="page" className="ui-flow-universe" />
      <ThemeToggle onChange={theme => applyTheme(theme)} size="md" className="ui-flow-theme" />
    </>
  );

  if (useMobileView) {
    return (
      <FlowMobileView
        flow={flow}
        universe={universe}
        scope={scope}
        setScope={setScope}
        loading={loading}
        error={error}
        provider={provider}
        market={market}
        futuresRead={futuresRead}
        futuresTotal={futuresTotal}
        onRescan={rescan}
        settings={CHART}
        layoutMode={viewMode}
        onLayoutModeChange={setViewModePersist}
      />
    );
  }

  return (
    <div
      className="ui-flow oi-design"
      data-window="day"
      data-universe={scope}
      data-layout={layout}
      data-fit={fits ? 'true' : undefined}
      data-phone-board={forceBoard && phoneWidth ? 'true' : undefined}
      ref={pageRef}
    >
      <h1 className="is-visually-hidden">Order Flow</h1>
      <PageBar current="Order Flow" crumbs={false} className="oi-design ui-flow-pagebar" brand={BRAND}>{pageActions}</PageBar>
      <FlowBoard key={`${scope}-${layout}`} flow={flow} settings={CHART} layout={layout}
        status={<FlowStatus flow={flow} at={market?.at ?? null} loading={loading} error={error} provider={provider} futuresRead={futuresRead} futuresTotal={futuresTotal} onRescan={rescan} />} />
    </div>
  );
}
