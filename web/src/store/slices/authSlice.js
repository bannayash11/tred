import { createSlice } from '@reduxjs/toolkit';

const TOKEN_KEY = 'tred_auth_token';
const USER_KEY = 'tred_auth_user';

// Migrate / clear legacy keys and static demo tokens once
try {
  localStorage.removeItem('tradrift_token');
  localStorage.removeItem('tradrift_user');
  const legacy = localStorage.getItem(TOKEN_KEY);
  if (
    legacy === 'demo-user-token' ||
    legacy === 'demo-admin-token' ||
    legacy === 'demo-subadmin-token'
  ) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
} catch {
  // ignore
}

const getInitialUser = () => {
  try {
    const saved = localStorage.getItem(USER_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // Ignore error
  }
  return null;
};

const getInitialToken = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (
    !token ||
    token === 'demo-user-token' ||
    token === 'demo-admin-token' ||
    token === 'demo-subadmin-token'
  ) {
    return null;
  }
  return token;
};

const initialToken = getInitialToken();
const initialUser = getInitialUser();

const initialState = {
  user: initialUser,
  token: initialToken,
  isAuthenticated: !!(initialToken && initialUser),
  twoFactorEnabled: !!initialUser?.twoFactorEnabled,
  activeSessions: [],
  securityScore: initialUser?.twoFactorEnabled ? 88 : 55,
  loading: false,
  error: null
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.twoFactorEnabled = !!action.payload.user?.twoFactorEnabled;
      state.securityScore = state.twoFactorEnabled ? 88 : 55;
      localStorage.setItem(TOKEN_KEY, action.payload.token);
      localStorage.setItem(USER_KEY, JSON.stringify(action.payload.user));
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.twoFactorEnabled = false;
      state.activeSessions = [];
      state.securityScore = 40;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
    updateUser: (state, action) => {
      if (!state.user) {
        state.user = action.payload;
      } else {
        state.user = { ...state.user, ...action.payload };
      }
      if (state.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(state.user));
      }
    },
    setTwoFactor: (state, action) => {
      state.twoFactorEnabled = action.payload;
      if (state.user) state.user.twoFactorEnabled = action.payload;
      state.securityScore = action.payload ? 88 : 55;
      if (state.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(state.user));
      }
    },
    upgradeSubscription: (state, action) => {
      const payload = action.payload || {};
      const planName = payload.plan || payload.name || 'Membership Plan';
      const days = Number(payload.durationDays) || (Number(payload.durationMonths) || 12) * 30;
      const mode = payload.mode === 'byok' ? 'byok' : payload.mode === 'server' ? 'server' : 'server';
      if (state.user) {
        state.user.subscription = {
          status: 'active',
          plan: planName,
          planId: payload.planId || payload.id || null,
          mode,
          byokGranted: mode === 'byok' ? true : !!state.user.subscription?.byokGranted,
          expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
        };
        localStorage.setItem(USER_KEY, JSON.stringify(state.user));
      }
    },
    setSessions: (state, action) => {
      state.activeSessions = action.payload || [];
    },
    revokeOtherSessions: (state) => {
      state.activeSessions = state.activeSessions.filter((s) => s.isCurrent);
    }
  }
});

export const {
  loginSuccess,
  logout,
  updateUser,
  setTwoFactor,
  upgradeSubscription,
  setSessions,
  revokeOtherSessions
} = authSlice.actions;

export default authSlice.reducer;
