/**
 * What: Circuit breaker factory and registry backed by Opossum
 * Why: Encapsulate breaker creation and configuration without leaking internals
 * How: Expose getBreaker(serviceName, options) which rebuilds or returns cached breaker
 */

import Opossum from 'opossum';

export interface BreakerOptions {
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
}

const defaultBreakerOptions: BreakerOptions = {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};

type ProxyAction = (req: any, serviceUrl: string) => Promise<any>;

const breakerRegistry: Record<string, Opossum<any>> = {};

export function getBreaker(
  serviceName: string,
  action: ProxyAction,
  opts?: Partial<BreakerOptions>
): Opossum<any> {
  const key = serviceName;
  const combined: BreakerOptions = { ...defaultBreakerOptions, ...(opts || {}) };
  const existing = breakerRegistry[key];
  if (existing) return existing;
  const breaker = new Opossum(action, combined as any);
  breakerRegistry[key] = breaker;
  return breaker;
}


