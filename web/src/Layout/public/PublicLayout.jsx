import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import Header from './Header';
import Footer from './Footer';
import AnnouncementBanner from '../../components/AnnouncementBanner';
import MarketTickerBar from '../../components/MarketTickerBar';
import ConfirmModal from '../../components/ConfirmModal';

import {
  fetchScreener,
  fetchMarketXRay,
  fetchPublicAnnouncement,
  fetchPublicPlans,
  getMe,
  getSocket
} from '../../services/api';
import { updateUser, logout, loginSuccess } from '../../store/slices/authSlice';
import { setScreenerData, setMarketXRay } from '../../store/slices/screenerSlice';
import { setPlans } from '../../store/slices/contentSlice';

export default function PublicLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const isOrderFlow = location.pathname.startsWith('/order-flow');
  const authUser = useSelector((state) => state.auth.user);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const authToken = useSelector((state) => state.auth.token);

  const [screenerDataState, setScreenerDataState] = useState({
    allStocks: [],
    bullishSetups: [],
    bearishSetups: []
  });
  const [xrayDataState, setXrayDataState] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [user, setUser] = useState(authUser);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  /** Always send users to real Razorpay pricing — never the legacy fake modal */
  const openPricing = () => navigate('/pricing');
  const [apiBanner, setApiBanner] = useState('');

  const [liveUpdatedSymbols, setLiveUpdatedSymbols] = useState(new Set());
  const [niftyData, setNiftyData] = useState(null);
  const [bankNiftyData, setBankNiftyData] = useState(null);

  useEffect(() => {
    setUser(authUser);
  }, [authUser]);

  useEffect(() => {
    fetchScreener()
      .then((res) => {
        if (res.success) {
          setScreenerDataState(res.data);
          dispatch(
            setScreenerData({
              all: res.data.allStocks,
              bullish: res.data.bullishSetups,
              bearish: res.data.bearishSetups
            })
          );
        }
      })
      .catch((err) => {
        console.error('Screener fetch error:', err);
        setApiBanner(err.userMessage || 'Cannot load live screener right now.');
      });

    fetchMarketXRay()
      .then((res) => {
        if (res.success) {
          setXrayDataState(res.data);
          dispatch(setMarketXRay(res.data));
        }
      })
      .catch((err) => {
        console.error('X-Ray fetch error:', err);
        setApiBanner(err.userMessage || 'Cannot load Market X-Ray right now.');
      });

    fetchPublicAnnouncement()
      .then((res) => {
        if (res.success && res.enabled) {
          setAnnouncement(res.announcement);
        }
      })
      .catch((err) => console.error('Announcement fetch error:', err));

    fetchPublicPlans()
      .then((res) => {
        if (res.success && res.plans) {
          dispatch(setPlans(res.plans));
          setApiBanner('');
        }
      })
      .catch((err) => {
        console.error('Plans fetch error:', err);
        setApiBanner(err.userMessage || 'Cannot load membership plans right now.');
      });

    if (authToken) {
      getMe()
        .then((res) => {
          if (res.success) {
            setUser(res.user);
            dispatch(updateUser(res.user));
            dispatch(loginSuccess({ user: res.user, token: authToken }));
          }
        })
        .catch((err) => {
          // Only wipe session on real auth failure — not deploy/network blips
          const status = err?.response?.status;
          if (status === 401 || status === 403) {
            dispatch(logout());
            setUser(null);
            setApiBanner(err.userMessage || 'Session expired. Please sign in again.');
          }
        });
    }

    const socket = getSocket();

    const applyScreener = (screener) => {
      if (!screener) return;
      setScreenerDataState(screener);
      dispatch(
        setScreenerData({
          all: screener.allStocks,
          bullish: screener.bullishSetups,
          bearish: screener.bearishSetups
        })
      );
    };

    socket.on('INITIAL_STATE', (payload) => {
      applyScreener(payload.screener);
      if (payload.marketXRay) {
        setXrayDataState(payload.marketXRay);
        dispatch(setMarketXRay(payload.marketXRay));
      }
    });

    socket.on('SCREENER_UPDATE', (screener) => {
      applyScreener(screener);
    });

    socket.on('MARKET_XRAY', (data) => {
      if (data) {
        setXrayDataState(data);
        dispatch(setMarketXRay(data));
      }
    });

    socket.on('MARKET_TICK', (ticks) => {
      const updatedSet = new Set(ticks.map((t) => t.symbol));
      setLiveUpdatedSymbols(updatedSet);

      const nifty = ticks.find((t) => t.symbol === 'NIFTY 50');
      if (nifty) setNiftyData(nifty);

      const bnf = ticks.find((t) => t.symbol === 'BANKNIFTY');
      if (bnf) setBankNiftyData(bnf);

      setTimeout(() => {
        setLiveUpdatedSymbols(new Set());
      }, 900);

      setScreenerDataState((prev) => {
        if (!prev) return prev;
        const tickMap = new Map(ticks.map((t) => [t.symbol, t]));

        const updateList = (list) =>
          list.map((item) => {
            if (tickMap.has(item.symbol)) {
              const tick = tickMap.get(item.symbol);
              return {
                ...item,
                currentPrice: tick.currentPrice,
                change: tick.change
              };
            }
            return item;
          });

        return {
          ...prev,
          allStocks: updateList(prev.allStocks || []),
          bullishSetups: updateList(prev.bullishSetups || []),
          bearishSetups: updateList(prev.bearishSetups || [])
        };
      });
    });

    return () => {
      socket.off('INITIAL_STATE');
      socket.off('SCREENER_UPDATE');
      socket.off('MARKET_TICK');
      socket.off('MARKET_XRAY');
    };
  }, [dispatch, authToken]);

  const goToLogin = () => navigate('/login');

  const confirmLogout = () => {
    dispatch(logout());
    setUser(null);
    setShowLogoutConfirm(false);
    navigate('/');
  };

  const openStockChart = (sym) => {
    if (!sym) return;
    const code = String(sym).toUpperCase();
    if (!isAuthenticated) {
      navigate(`/login?next=${encodeURIComponent(`/chart/${code}`)}`);
      return;
    }
    navigate(`/chart/${code}`);
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans">
      {announcement && (
        <AnnouncementBanner text={announcement} onClose={() => setAnnouncement('')} />
      )}

      {apiBanner && !isOrderFlow && (
        <div className="bg-rose-950/90 border-b border-rose-800/80 text-rose-200 text-xs sm:text-sm px-4 py-2.5 flex items-start justify-between gap-3">
          <span>{apiBanner}</span>
          <button
            type="button"
            onClick={() => setApiBanner('')}
            className="shrink-0 text-rose-300/80 hover:text-white"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {!isOrderFlow && (
        <MarketTickerBar
          niftyData={niftyData}
          bankNiftyData={bankNiftyData}
          stocks={screenerDataState?.allStocks}
          onSelectStock={openStockChart}
        />
      )}

      {!isOrderFlow && (
        <Header
          user={user}
          onOpenAuth={goToLogin}
          onOpenPricing={openPricing}
          onLogout={() => setShowLogoutConfirm(true)}
          niftyData={niftyData}
          bankNiftyData={bankNiftyData}
        />
      )}

      <main
        className={
          isOrderFlow
            ? 'flex-1 w-full min-h-0'
            : 'flex-1 max-w-[1800px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6'
        }
      >
        <Outlet
          context={{
            screenerData: screenerDataState,
            xrayData: xrayDataState,
            onSelectStock: openStockChart,
            liveUpdatedSymbols,
            user,
            isAuthenticated,
            onOpenPricing: openPricing,
            onOpenAuth: goToLogin
          }}
        />
      </main>

      {!isOrderFlow && <Footer />}

      <ConfirmModal
        open={showLogoutConfirm}
        title="Sign out?"
        message="You will need to sign in again to access your dashboard and terminal."
        confirmLabel="Sign Out"
        cancelLabel="Stay Signed In"
        danger
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={confirmLogout}
      />
    </div>
  );
}
