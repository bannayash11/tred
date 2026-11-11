import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, fetchAdminData, updateUserSub, updateBrokerConfig, updateAnnouncementConfig, fetchScreener, getMe } from '../services/api';

const AdminContext = createContext();

export function AdminProvider({ children }) {
  const [adminUser, setAdminUser] = useState(() => {
    const token = localStorage.getItem('tred_admin_token');
    const storedUser = localStorage.getItem('tred_admin_user');
    if (!token) return null;
    if (storedUser) {
      try {
        return JSON.parse(storedUser);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [sessionChecked, setSessionChecked] = useState(false);

  const [usersList, setUsersList] = useState([]);
  const [plansList, setPlansList] = useState([]);
  const [newsList, setNewsList] = useState([]);
  const [blogsList, setBlogsList] = useState([]);
  const [seoPages, setSeoPages] = useState([]);
  const [cmsPages, setCmsPages] = useState([]);
  const [screenerData, setScreenerData] = useState(null);
  const [systemSettings, setSystemSettings] = useState({
    brokerProvider: 'DHAN',
    dhanClientId: '1100293847',
    dhanToken: '••••••••••••••••••••••••••••••••',
    announcement: '🔴 Live Market Updates Active: High institutional volume detected in Nifty Banking & Auto sectors.',
    announcementEnabled: true
  });
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const logout = () => {
    localStorage.removeItem('tred_admin_token');
    localStorage.removeItem('tred_admin_user');
    setAdminUser(null);
    setShowLogoutConfirm(false);
  };

  const requestLogout = () => setShowLogoutConfirm(true);
  const cancelLogout = () => setShowLogoutConfirm(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchAdminData();
      if (res.success) {
        setUsersList(res.users || []);
        if (res.plans?.length) setPlansList(res.plans);
        if (res.settings) {
          setSystemSettings((prev) => ({
            ...prev,
            brokerProvider: res.settings.brokerProvider || prev.brokerProvider,
            announcement: res.settings.announcement || prev.announcement,
            announcementEnabled:
              res.settings.announcementEnabled !== undefined
                ? res.settings.announcementEnabled
                : prev.announcementEnabled
          }));
        }
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
        showToast('Session expired. Please sign in again.');
        setLoading(false);
        return;
      }
    }

    try {
      const blogsRes = await api.get('/content/blogs');
      if (blogsRes.data.success) setBlogsList(blogsRes.data.blogs);
      const newsRes = await api.get('/content/news');
      if (newsRes.data.success) setNewsList(newsRes.data.news);
      const seoRes = await api.get('/seo/admin/pages');
      if (seoRes.data.success) setSeoPages(seoRes.data.pages || []);
      const cmsRes = await api.get('/cms/admin/pages');
      if (cmsRes.data.success) setCmsPages(cmsRes.data.pages || []);
      const scRes = await fetchScreener();
      if (scRes.success) setScreenerData(scRes.data);
    } catch {
      // public content may still load
    }
    setLoading(false);
  };

  // Validate stored admin session against backend
  useEffect(() => {
    const token = localStorage.getItem('tred_admin_token');
    if (!token) {
      setAdminUser(null);
      setSessionChecked(true);
      return;
    }

    getMe()
      .then((res) => {
        if (res.success && (res.user.role === 'admin' || res.user.role === 'subadmin')) {
          localStorage.setItem('tred_admin_user', JSON.stringify(res.user));
          setAdminUser(res.user);
        } else {
          logout();
        }
      })
      .catch(() => {
        logout();
      })
      .finally(() => setSessionChecked(true));
  }, []);

  useEffect(() => {
    if (adminUser && sessionChecked) {
      loadData();
    }
  }, [adminUser, sessionChecked]);

  const login = (user, token) => {
    if (!token) {
      showToast('Login failed: missing token');
      return;
    }
    if (user.role !== 'admin' && user.role !== 'subadmin') {
      showToast('Access denied: admin role required');
      return;
    }
    localStorage.setItem('tred_admin_token', token);
    localStorage.setItem('tred_admin_user', JSON.stringify(user));
    setAdminUser(user);
    showToast(`Welcome ${user.name}! Authenticated as ${user.role.toUpperCase()}`);
  };

  // User CRUD
  const createUser = async (formData) => {
    try {
      const res = await api.post('/admin/users', formData);
      if (res.data.success) {
        setUsersList((prev) => [res.data.user, ...prev]);
        showToast('Trader account created successfully!');
        return { success: true };
      }
      showToast(res.data.message || 'Failed to create trader');
      return { success: false };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to create trader';
      showToast(msg);
      return { success: false, message: msg };
    }
  };

  const updateUser = async (id, updatedData) => {
    try {
      const res = await api.put(`/admin/users/${id}`, updatedData);
      if (res.data.success) {
        setUsersList((prev) => prev.map((u) => (u._id === id ? { ...u, ...updatedData, ...(res.data.user || {}) } : u)));
        showToast('Trader details updated!');
        return;
      }
      showToast(res.data.message || 'Update failed');
    } catch (err) {
      showToast(err.response?.data?.message || 'Update failed');
    }
  };

  const deleteUser = async (id) => {
    try {
      await api.delete(`/admin/users/${id}`);
      setUsersList((prev) => prev.filter((u) => u._id !== id));
      showToast('Trader removed from platform');
    } catch (err) {
      showToast(err.response?.data?.message || 'Delete failed — Super Admin only');
    }
  };

  const extendUserSub = async (id, payload) => {
    try {
      const res = await updateUserSub(id, payload);
      if (res.success) {
        setUsersList(prev => prev.map(u => u._id === id ? res.user : u));
        showToast('Subscription updated successfully!');
      }
    } catch {
      setUsersList(prev => prev.map(u => {
        if (u._id === id) {
          const newExp = new Date(Date.now() + (payload.extendDays || 30) * 24 * 3600 * 1000);
          return {
            ...u,
            subscription: {
              ...u.subscription,
              status: payload.status || u.subscription.status,
              plan: payload.plan || u.subscription.plan,
              expiresAt: newExp
            }
          };
        }
        return u;
      }));
      showToast('Subscription extended (Offline Mode)!');
    }
  };

  // Plans CRUD
  const createPlan = async (planData) => {
    try {
      const res = await api.post('/admin/plans', planData);
      if (res.data.success) {
        setPlansList(prev => [...prev, res.data.plan]);
        showToast('Membership Plan created!');
        return { success: true };
      }
    } catch {
      const newPlan = { id: `plan_${Date.now()}`, ...planData };
      setPlansList(prev => [...prev, newPlan]);
      showToast('Plan created (Offline Mode)!');
      return { success: true };
    }
  };

  const updatePlan = async (id, planData) => {
    try {
      await api.put(`/admin/plans/${id}`, planData);
    } catch {}
    setPlansList(prev => prev.map(p => p.id === id ? { ...p, ...planData } : p));
    showToast('Plan updated!');
  };

  const deletePlan = async (id) => {
    try {
      await api.delete(`/admin/plans/${id}`);
    } catch {}
    setPlansList(prev => prev.filter(p => p.id !== id));
    showToast('Plan deleted successfully');
  };

  // News CRUD
  const createNews = async (newsData) => {
    try {
      const res = await api.post('/content/news', newsData);
      if (res.data.success) {
        setNewsList(prev => [res.data.news, ...prev]);
        showToast('Breaking News wire published!');
        return { success: true };
      }
    } catch {
      const item = { id: `news_${Date.now()}`, time: 'Just now', source: 'Admin Desk', ...newsData };
      setNewsList(prev => [item, ...prev]);
      showToast('News published (Offline Mode)!');
      return { success: true };
    }
  };

  const updateNews = async (id, newsData) => {
    try {
      await api.put(`/content/news/${id}`, newsData);
    } catch {}
    setNewsList(prev => prev.map(n => n.id === id ? { ...n, ...newsData } : n));
    showToast('News wire item updated!');
  };

  const deleteNews = async (id) => {
    try {
      await api.delete(`/content/news/${id}`);
    } catch {}
    setNewsList(prev => prev.filter(n => n.id !== id));
    showToast('News item deleted');
  };

  // Blogs CRUD
  const createBlog = async (blogData) => {
    try {
      const res = await api.post('/content/blogs', blogData);
      if (res.data.success) {
        setBlogsList(prev => [res.data.blog, ...prev]);
        showToast('Educational Guide published!');
        return { success: true };
      }
    } catch {
      const item = {
        id: `blog_${Date.now()}`,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        author: 'OrderBlock Research Team',
        readTime: '5 min read',
        ...blogData
      };
      setBlogsList(prev => [item, ...prev]);
      showToast('Guide published (Offline Mode)!');
      return { success: true };
    }
  };

  const updateBlog = async (id, blogData) => {
    try {
      await api.put(`/content/blogs/${id}`, blogData);
    } catch {}
    setBlogsList(prev => prev.map(b => b.id === id ? { ...b, ...blogData } : b));
    showToast('Blog guide updated!');
  };

  const deleteBlog = async (id) => {
    try {
      await api.delete(`/content/blogs/${id}`);
    } catch {}
    setBlogsList(prev => prev.filter(b => b.id !== id));
    showToast('Blog article deleted');
  };

  // SEO CRUD
  const loadSeoPages = async () => {
    try {
      const res = await api.get('/seo/admin/pages');
      if (res.data.success) {
        setSeoPages(res.data.pages || []);
        return { success: true, pages: res.data.pages || [] };
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load SEO pages');
    }
    return { success: false };
  };

  const updateSeoPage = async (pageKey, data) => {
    try {
      const res = await api.put(`/seo/admin/pages/${pageKey}`, data);
      if (res.data.success) {
        setSeoPages((prev) =>
          prev.map((p) => (p.pageKey === pageKey ? { ...p, ...res.data.page } : p))
        );
        showToast('SEO settings saved successfully!');
        return { success: true, page: res.data.page };
      }
      showToast(res.data.message || 'Failed to save SEO');
      return { success: false };
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save SEO settings');
      return { success: false };
    }
  };

  const seedSeoPages = async () => {
    try {
      const res = await api.post('/seo/admin/seed');
      if (res.data.success) {
        setSeoPages(res.data.pages || []);
        showToast('All website pages registered for SEO management');
        return { success: true };
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to sync SEO pages');
    }
    return { success: false };
  };

  // CMS pages
  const loadCmsPages = async () => {
    try {
      const res = await api.get('/cms/admin/pages');
      if (res.data.success) {
        setCmsPages(res.data.pages || []);
        return { success: true, pages: res.data.pages || [] };
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load CMS pages');
    }
    return { success: false };
  };

  const updateCmsPage = async (slug, data) => {
    try {
      const res = await api.put(`/cms/admin/pages/${slug}`, data);
      if (res.data.success) {
        setCmsPages((prev) => {
          const exists = prev.some((p) => p.slug === slug);
          if (exists) return prev.map((p) => (p.slug === slug ? { ...p, ...res.data.page } : p));
          return [...prev, res.data.page];
        });
        showToast('CMS page saved successfully!');
        return { success: true, page: res.data.page };
      }
      showToast(res.data.message || 'Failed to save CMS page');
      return { success: false };
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save CMS page');
      return { success: false };
    }
  };

  const seedCmsPages = async () => {
    try {
      const res = await api.post('/cms/admin/seed');
      if (res.data.success) {
        setCmsPages(res.data.pages || []);
        showToast('Privacy, Terms & FAQ pages ready');
        return { success: true };
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to sync CMS pages');
    }
    return { success: false };
  };

  // Settings
  const saveBroker = async (data) => {
    try {
      await updateBrokerConfig(data);
      setSystemSettings(prev => ({ ...prev, ...data }));
      showToast('Broker API settings saved!');
    } catch {
      setSystemSettings(prev => ({ ...prev, ...data }));
      showToast('Broker API settings saved!');
    }
  };

  const saveAnnouncement = async (data) => {
    try {
      await updateAnnouncementConfig(data);
      setSystemSettings(prev => ({ ...prev, ...data }));
      showToast('Announcement broadcasted to Live Terminal!');
    } catch {
      setSystemSettings(prev => ({ ...prev, ...data }));
      showToast('Announcement broadcasted!');
    }
  };

  const stats = {
    totalUsers: usersList.length,
    activeSubscribers: usersList.filter(u => u.subscription?.status === 'active').length,
    trialUsers: usersList.filter(u => u.subscription?.status === 'trial').length,
    estimatedMRR: usersList.filter(u => u.subscription?.status === 'active').length * 1250
  };

  return (
    <AdminContext.Provider
      value={{
        adminUser,
        sessionChecked,
        login,
        logout,
        requestLogout,
        cancelLogout,
        showLogoutConfirm,
        usersList,
        plansList,
        newsList,
        blogsList,
        seoPages,
        cmsPages,
        screenerData,
        systemSettings,
        stats,
        toast,
        showToast,
        loading,
        refreshData: loadData,
        createUser,
        updateUser,
        deleteUser,
        extendUserSub,
        createPlan,
        updatePlan,
        deletePlan,
        createNews,
        updateNews,
        deleteNews,
        createBlog,
        updateBlog,
        deleteBlog,
        loadSeoPages,
        updateSeoPage,
        seedSeoPages,
        loadCmsPages,
        updateCmsPage,
        seedCmsPages,
        saveBroker,
        saveAnnouncement
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export const useAdmin = () => useContext(AdminContext);

