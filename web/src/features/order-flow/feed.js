import { api } from '../../services/api';
import { parseMarketFile } from './parseMarket';
import { combineMonths } from './futuresModel';

export async function fetchOrderFlowStatus() {
  const { data } = await api.get('/order-flow/status');
  return data;
}

export async function fetchOrderFlowMarket() {
  const { data } = await api.get('/order-flow/market');
  return parseMarketFile(data);
}

export async function fetchOrderFlowFutures(symbol, session) {
  const { data } = await api.get(`/order-flow/futures/${encodeURIComponent(symbol)}`, {
    params: { session }
  });
  return combineMonths(symbol, data.months || []);
}

export async function fetchOrderFlowUniverse() {
  const { data } = await api.get('/order-flow/universe');
  return data.underlyings || [];
}
