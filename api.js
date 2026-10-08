// LoanFinder frontend API layer (Phase 2D, extended in Phase 2E).
//
// Thin client for the Phase 2C REST API plus the Phase 2E auth and saved-offer
// endpoints. All URLs are RELATIVE to the page origin, so the app works
// wherever it is served (http://localhost:8080 via `npm start`, or any other
// host) with no hardcoded host, no CORS, and no credentials. Session cookies
// ride along automatically because every call is same-origin. There is
// deliberately NO fallback to any hardcoded dataset: callers surface failures
// (see window.app.loadBootData) instead.
//
// Methods return the unwrapped payload from { "data": ... }; errors throw an
// Error carrying the server's message when there is one, with .status set to
// the HTTP status so callers can tell 401/409 apart from network failures.
(function () {
  'use strict';

  function extend(url, params) {
    if (!params || !params.length) return url;
    const qs = params.map((kv) => kv[0] + '=' + encodeURIComponent(kv[1])).join('&');
    return url + '?' + qs;
  }

  async function request(url, options) {
    let res;
    try {
      res = await fetch(url, Object.assign({ headers: { Accept: 'application/json' } }, options));
    } catch (e) {
      throw new Error('Network error reaching the LoanFinder API: ' + (e && e.message ? e.message : String(e)));
    }
    let body = null;
    try {
      body = await res.json();
    } catch (e) { /* non-JSON body: keep null and fall back to the HTTP status */ }
    return { status: res.status, ok: res.ok, body: body };
  }

  async function apiFetch(url, options) {
    const res = await request(url, options);
    if (!res.ok) {
      let message = 'LoanFinder API request failed (HTTP ' + res.status + ')';
      if (res.body && typeof res.body.error === 'string' && res.body.error) message = res.body.error;
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }
    if (!res.body || res.body.data === undefined) {
      throw new Error('LoanFinder API returned an unexpected response');
    }
    return res.body.data;
  }

  function post(url, payload) {
    return apiFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
  }

  const LoanFinderAPI = {
    getBanks() {
      return apiFetch('/api/banks');
    },

    getLoanOffers(loanType) {
      const url = extend('/api/loan-offers', loanType ? [['loan_type', loanType]] : []);
      return apiFetch(url);
    },

    getLoanOffer(id) {
      return apiFetch('/api/loan-offers/' + encodeURIComponent(id));
    },

    getBranches(city) {
      const url = extend('/api/branches', city ? [['city', city]] : []);
      return apiFetch(url);
    },

    getBranch(id) {
      return apiFetch('/api/branches/' + encodeURIComponent(id));
    },

    getHiddenCharges(offerId) {
      return apiFetch('/api/loan-offers/' + encodeURIComponent(offerId) + '/hidden-charges');
    },

    // ---- Phase 2E: authenticated session ----

    register(email, password) {
      return post('/api/auth/register', { email: email, password: password })
        .then(data => data && data.user);
    },

    login(email, password) {
      return post('/api/auth/login', { email: email, password: password })
        .then(data => data && data.user);
    },

    logout() {
      return post('/api/auth/logout');
    },

    // Returns the signed-in user, or null when there is no valid session
    // (HTTP 401 is an expected outcome here, not an error).
    me() {
      return apiFetch('/api/auth/me').then(data => data && data.user).catch(err => {
        if (err && err.status === 401) return null;
        throw err;
      });
    },

    // ---- Phase 2E: saved offers (database-backed, per account) ----

    getSavedOffers() {
      return apiFetch('/api/saved-offers');
    },

    saveOffer(offerId) {
      return post('/api/saved-offers', { offer_id: offerId });
    },

    removeSavedOffer(savedId) {
      return apiFetch('/api/saved-offers/' + encodeURIComponent(savedId), { method: 'DELETE' });
    },
  };

  window.LoanFinderAPI = LoanFinderAPI;
})();