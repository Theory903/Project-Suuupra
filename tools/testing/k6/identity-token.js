import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = { vus: 50, duration: '2m' };

export default function () {
  const url = `${__ENV.IDENTITY_BASE || 'https://identity.local'}/oauth2/token`;
  const payload = {
    grant_type: 'client_credentials',
    client_id: __ENV.CLIENT_ID,
    client_secret: __ENV.CLIENT_SECRET,
    scope: 'api'
  };
  const res = http.post(url, payload, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}


