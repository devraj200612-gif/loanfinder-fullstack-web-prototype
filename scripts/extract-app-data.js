'use strict';

// Loader that extracts LoanFinder's source-of-truth datasets straight from the
// frontend (app.js). The frontend declares BANK_OFFERS / BRANCH_DATA /
// HIDDEN_CHARGES / LOAN_TYPES as top-level `const`s inside a browser script, so
// we run it in a sandboxed VM with inert browser stubs and read the constants
// via a capture expression appended to the source. This keeps the seed bound to
// the exact running data: no transcription, no drift, nothing new invented.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const APP_JS = path.join(ROOT, 'app.js');

function makeSandbox() {
  const noop = () => {};
  const sandbox = {
    console,
    Intl,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    fetch: () => Promise.reject(new Error('fetch unavailable')),
    addEventListener: noop,
    removeEventListener: noop,
    matchMedia: () => ({ matches: false, addListener: noop, removeListener: noop }),
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    cancelAnimationFrame: clearTimeout,
    navigator: {},
    location: { href: 'file:///index.html' },
    localStorage: {
      getItem: () => null,
      setItem: noop,
      removeItem: noop,
    },
    document: {
      readyState: 'loading',
      addEventListener: noop,
      removeEventListener: noop,
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      createElement: () => ({
        style: {},
        dataset: {},
        classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
        setAttribute: noop,
        appendChild: noop,
        addEventListener: noop,
      }),
    },
    lucide: { createIcons: noop, icons: {} },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

const CAPTURE = [
  'BANK_OFFERS',
  'BRANCH_DATA',
  'HIDDEN_CHARGES',
  'LOAN_TYPES',
  'P2P_DEMO_REQUESTS',
  'P2P_DEMO_LENDERS',
];

function loadFrontendData() {
  if (!fs.existsSync(APP_JS)) {
    throw new Error(`app.js not found at ${APP_JS}`);
  }
  const src = fs.readFileSync(APP_JS, 'utf8');
  const sandbox = makeSandbox();
  const capture = `\n;globalThis.__LF = { ${CAPTURE.join(', ')} };`;
  vm.runInNewContext(src + capture, sandbox, { filename: 'app.js' });
  const raw = sandbox.__LF;

  const required = ['BANK_OFFERS', 'BRANCH_DATA', 'HIDDEN_CHARGES', 'LOAN_TYPES'];
  for (const key of required) {
    if (raw[key] === undefined) {
      throw new Error(`Failed to capture '${key}' from app.js`);
    }
  }
  if (!Array.isArray(raw.BANK_OFFERS) || typeof raw.BRANCH_DATA !== 'object' || raw.BRANCH_DATA === null) {
    throw new Error('Unexpected data shape captured from app.js');
  }
  return {
    bankOffers: raw.BANK_OFFERS,
    branchData: raw.BRANCH_DATA,
    hiddenCharges: raw.HIDDEN_CHARGES,
    loanTypes: raw.LOAN_TYPES,
    p2pDemoRequests: raw.P2P_DEMO_REQUESTS || [],
    p2pDemoLenders: raw.P2P_DEMO_LENDERS || [],
  };
}

module.exports = { loadFrontendData, CAPTURE };

if (require.main === module) {
  const d = loadFrontendData();
  let branches = 0;
  const perCity = {};
  Object.entries(d.branchData).forEach(([city, rows]) => {
    perCity[city] = rows.length;
    branches += rows.length;
  });
  const offers = d.bankOffers.reduce((a, o) => ((a[o.loanType] = (a[o.loanType] || 0) + 1), a), {});
  const hidden = Object.values(d.hiddenCharges).reduce((a, rows) => a + rows.length, 0);
  console.log('offers:', offers);
  console.log('total offers:', d.bankOffers.length);
  console.log('branches per city:', perCity);
  console.log('total branches:', branches);
  console.log('hidden-charge rows:', hidden);
  console.log('p2p demo requests:', d.p2pDemoRequests.length, '| lenders:', d.p2pDemoLenders.length);
  console.log('loan types:', d.loanTypes.map((t) => `${t.id}(${t.name})`).join(', '));
}