/**
 * What: Request/Response header transforms
 * Why: Normalize cross-service contracts and apply tenant/region context
 * How: Apply declarative add/remove transforms defined on the route policy
 */

import { IncomingMessage } from 'http';
import { TransformsPolicy } from '../types/gateway';

export function applyRequestTransforms(headers: Record<string, any>, policy?: TransformsPolicy): Record<string, any> {
  if (!policy) return headers;
  const out = { ...headers };
  if (policy.requestHeadersRemove) {
    for (const h of policy.requestHeadersRemove) delete out[h.toLowerCase()];
  }
  if (policy.requestHeadersAdd) {
    for (const [k, v] of Object.entries(policy.requestHeadersAdd)) out[k.toLowerCase()] = v;
  }
  return out;
}

export function applyResponseTransforms(res: IncomingMessage, policy?: TransformsPolicy) {
  if (!policy) return;
  if (policy.responseHeadersRemove) {
    for (const h of policy.responseHeadersRemove) {
      try {
        delete (res.headers as any)[h.toLowerCase()];
      } catch (e) {
        // no-op
      }
    }
  }
  if (policy.responseHeadersAdd) {
    for (const [k, v] of Object.entries(policy.responseHeadersAdd)) {
      try {
        (res.headers as any)[k.toLowerCase()] = v;
      } catch (e) {
        // no-op
      }
    }
  }
}



