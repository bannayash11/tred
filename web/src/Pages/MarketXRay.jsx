import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import MarketXRayView from '../components/MarketXRayView';
import MembershipBanner from '../components/MembershipBanner';
import MembershipLocked from '../components/MembershipLocked';
import { fetchMarketXRay } from '../services/api';
import { setMarketXRay } from '../store/slices/screenerSlice';
import { getMembership } from '../lib/membership';

export default function MarketXRay(props) {
  const navigate = useNavigate();
  const context = useOutletContext() || {};
  const dispatch = useDispatch();
  const authUser = useSelector((state) => state.auth.user);
  const plans = useSelector((state) => state.content?.plans || []);
  const reduxXRay = useSelector((state) => state?.screener?.marketXRay);

  const [localData, setLocalData] = useState(
    props.xrayData || context.xrayData || reduxXRay || null
  );
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    if (context.xrayData) {
      setLocalData(context.xrayData);
      setFetchError('');
      return;
    }
    fetchMarketXRay()
      .then((res) => {
        if (res.success && res.data) {
          setLocalData(res.data);
          dispatch(setMarketXRay(res.data));
          setFetchError('');
        }
      })
      .catch((err) => {
        console.error('Error fetching Market X-Ray:', err);
        setFetchError(err.userMessage || 'Could not load Market X-Ray.');
      });
  }, [context.xrayData, dispatch]);

  const onSelectStock = props.onSelectStock || context.onSelectStock;
  const user = props.user || context.user || authUser;
  const onOpenPricing = props.onOpenPricing || context.onOpenPricing || (() => navigate('/pricing'));
  const membership = getMembership(user, plans);

  if (!membership.allowMarketXRay) {
    return (
      <MembershipLocked
        title="Market X-Ray locked"
        message={membership.upgradeHint || 'Your membership does not include Market X-Ray.'}
        onOpenPricing={onOpenPricing}
      />
    );
  }

  return (
    <div className="space-y-5">
      <MembershipBanner user={user} onOpenPricing={onOpenPricing} />
      <MarketXRayView
        xrayData={localData}
        onSelectStock={onSelectStock}
        errorMessage={fetchError}
      />
    </div>
  );
}
