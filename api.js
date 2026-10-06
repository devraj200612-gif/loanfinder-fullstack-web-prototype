// LoanFinder frontend API layer (Phase 2D).
//
// Thin read-only client for the Phase 2C REST API. All URLs are RELATIVE to
// the page origin, so the app works wherever it is served (http://localhost:8080
// via `npm start`, or any other host) with no hardcoded host, no CORS, and no
// credentials. There is deliberately NO fallback to any hardcoded dataset:
// callers surface failures (see window.app.loadBootData) instead.
//
// Methods return the unwrapped payload from { "data": ... }; errors throw an
// Error carrying the server's message when there is one.
(function () {
  'use strict';

  function extend(url, params) {
    if (!params || !params.length) return url;
    const qs = params.map((kv) => kv[0] + '=' + encodeURIComponent(kv[1])).join('&');
    return url + '?' + qs;
  }

  async function apiFetch(url) {
    let res;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' } });
    } catch (e) {
      throw new Error('Network error reaching the LoanFinder API: ' + (e && e.message ? e.message : String(e)));
    }
    if (!res.ok) {
      let message = 'LoanFinder API request failed (HTTP ' + res.status + ')';
      try {
        const body = await res.json();
        if (body && typeof body.error === 'string' && body.error) message = body.error;
      } catch (e) { /* keep the default message */ }
      throw new Error(message);
    }
    const body = await res.json();
    if (!body || body.data === undefined) {
      throw new Error('LoanFinder API returned an unexpected response');
    }
    return body.data;
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
  };

  window.LoanFinderAPI = LoanFinderAPI;
})();