import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import Header from './Header';
import Footer from './Footer';
import AnnouncementBanner from '../../components/AnnouncementBanner';
import MarketTickerBar from '../../components/MarketTickerBar';
import PricingModal from '../../components/PricingModal';
import ConfirmModal from '../../components/ConfirmModal';

import {
  fetchScreener,
  fetchMarketXRay,
  fetchPublicAnnouncement,
  fetchPublicPlans,
  getMe,
  getSocket,
  createTrade
} from '../../services/api';
import { updateUser, logout, loginSuccess } from '../../store/slices/authSlice';
import { setScreenerData, setMarketXRay } from '../../store/slices/screenerSlice';
import { setPlans } from '../../store/slices/contentSlice';

export default function PublicLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
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

  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
      .catch((err) => console.error('Screener fetch error:', err));

    fetchMarketXRay()
      .then((res) => {
        if (res.success) {
          setXrayDataState(res.data);
          dispatch(setMarketXRay(res.data));
        }
      })
      .catch((err) => console.error('X-Ray fetch error:', err));

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
        }
      })
      .catch((err) => console.error('Plans fetch error:', err));

    if (authToken) {
      getMe()
        .then((res) => {
          if (res.success) {
            setUser(res.user);
            dispatch(updateUser(res.user));
            dispatch(loginSuccess({ user: res.user, token: authToken }));
          }
        })
        .catch(() => {
          dispatch(logout());
          setUser(null);
        });
    }

    const socket = getSocket();

    socket.on('INITIAL_STATE', (payload) => {
      if (payload.screener) {
        setScreenerDataState(payload.screener);
        dispatch(
          setScreenerData({
            all: payload.screener.allStocks,
            bullish: payload.screener.bullishSetups,
            bearish: payload.screener.bearishSetups
          })
        );
      }
      if (payload.marketXRay) {
        setXrayDataState(payload.marketXRay);
        dispatch(setMarketXRay(payload.marketXRay));
      }
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

  const handleLogTradeFromChart = async (tradeEntry) => {
    if (!isAuthenticated) {
      navigate('/login?next=/trade-log');
      return;
    }
    try {
      await createTrade(tradeEntry);
    } catch (err) {
      console.error('Error logging trade from chart:', err);
    }
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

      {/* Live Market Scrolling Ticker Tape Slider */}
      <MarketTickerBar
        niftyData={niftyData}
        bankNiftyData={bankNiftyData}
        stocks={screenerDataState?.allStocks}
        onSelectStock={openStockChart}
      />

      <Header
        user={user}
        onOpenAuth={goToLogin}
        onOpenPricing={() => setShowPricingModal(true)}
        onLogout={() => setShowLogoutConfirm(true)}
        niftyData={niftyData}
        bankNiftyData={bankNiftyData}
      />

      <main className="flex-1 max-w-[1800px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet
          context={{
            screenerData: screenerDataState,
            xrayData: xrayDataState,
            onSelectStock: openStockChart,
            onLogTrade: handleLogTradeFromChart,
            liveUpdatedSymbols,
            user,
            isAuthenticated,
            onOpenPricing: () => setShowPricingModal(true),
            onOpenAuth: goToLogin
          }}
        />
      </main>

      <Footer />

      {showPricingModal && (
        <PricingModal
          onClose={() => setShowPricingModal(false)}
          currentPlan={user?.subscription?.plan}
        />
      )}

      <ConfirmModal
        open={showLogoutConfirm}
        title="Sign out?"
        message="You will need to sign in again to access your Trade Log and dashboard."
        confirmLabel="Sign Out"
        cancelLabel="Stay Signed In"
        danger
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={confirmLogout}
      />
    </div>
  );
}
