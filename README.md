# OrderBlock Pro — MERN Multi-Page Institutional Trading Platform

A complete, production-grade **MERN stack (MongoDB, Express, React, Node.js)** platform with full multi-page capabilities, tier-based feature access, and a bulletproof, secure Admin Gateway.

---

## 📁 Architectural Separation

```text
tred/
├── web/           # Dedicated Trader Web Platform (Port 3003)
│   ├── Home Page (High-converting marketing landing page)
│   ├── Terminal (Live Order Block screener & charts)
│   ├── Market X-Ray (Macro breadth & sector heatmap)
│   ├── Market News (Live Indian financial catalysts wire)
│   ├── SMC Blog (Educational guides on Order Blocks & Liquidity)
│   ├── Trading Journal (Multi-day trade logger & expectancy curve)
│   └── User Dashboard (Profile, Membership tier, Days left, Upgrade CTAs)
│
├── admin/         # Restricted Super Admin Command Console (Port 3004)
│   ├── Admin Security Gate (Email, Password, Security Key)
│   ├── Forgot Password / Recovery System (6-digit OTP reset)
│   ├── Traders & Subscriptions Manager (Extend +30d / +365d, revoke)
│   ├── Membership Tier Rules (Set Free vs Starter vs Pro feature limits)
│   ├── News & Blog Publisher (Publish directly to web portal)
│   └── Broker API Settings (DhanHQ / Fyers live feed credentials)
│
└── backend/       # Node.js + Express + Socket.io + MongoDB (Port 5001)
    ├── Smart Money Concepts (SMC) calculation engine
    ├── Real-time tick simulator + DhanHQ API adapter
    └── JWT authentication & role-based middleware
```

---

## 🚀 Live Access URLs

* **Trader Web Platform:** `http://localhost:3003`
* **Super Admin Portal:** `http://localhost:3004`
* **Backend API Server:** `http://localhost:5001`

---

## 🔑 Demo Credentials

### 1. Super Admin Portal (`http://localhost:3004`)
* **Email:** `admin@orderblock.local`
* **Password:** `admin123`
* **Sub-Admin:** `subadmin@orderblock.local` / `subadmin123`
* Forgot-password issues a **one-time random 6-digit code** (shown in response for local demo only).

### 2. Trader Web App (`http://localhost:3003`)
* **Email:** `trader@orderblock.local`
* **Password:** `password123`
* `/journal` and `/dashboard` require login. API routes reject missing/invalid JWTs (no anonymous admin fallback).
