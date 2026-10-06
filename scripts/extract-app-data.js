'use strict';

// Loader for LoanFinder's source-of-truth datasets (Phase 2D).
//
// The datasets (BANK_OFFERS / BRANCH_DATA / HIDDEN_CHARGES / LOAN_TYPES) were
// originally declared as `const`s inside app.js and extracted by running the
// browser script in a sandboxed VM. Phase 2D migrates the frontend to fetch
// this data from the Phase 2C REST API, so the constants are removed from
// app.js and the seed now reads the committed canonical snapshot instead:
//
//   data/loanfinder-data.json
//
// The snapshot was generated verbatim from the app.js constants before the
// migration, so the database is still bound to the exact shipped data: no
// transcription, no drift, nothing new invented.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_JSON = path.join(ROOT, 'data', 'loanfinder-data.json');

function loadFrontendData() {
  if (!fs.existsSync(DATA_JSON)) {
    throw new Error(`Canonical dataset not found at ${DATA_JSON}.`);
  }
  const parsed = JSON.parse(fs.readFileSync(DATA_JSON, 'utf8'));

  if (!Array.isArray(parsed.bankOffers) || typeof parsed.branchData !== 'object' || parsed.branchData === null) {
    throw new Error('Unexpected data shape in canonical dataset');
  }
  if (typeof parsed.hiddenCharges !== 'object' || parsed.hiddenCharges === null) {
    throw new Error('Unexpected hiddenCharges shape in canonical dataset');
  }

  return {
    bankOffers: parsed.bankOffers,
    branchData: parsed.branchData,
    hiddenCharges: parsed.hiddenCharges,
    loanTypes: parsed.loanTypes || [],
    p2pDemoRequests: parsed.p2pDemoRequests || [],
    p2pDemoLenders: parsed.p2pDemoLenders || [],
  };
}

module.exports = { loadFrontendData };

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
  console.log('canonical dataset:', path.relative(ROOT, DATA_JSON));
  console.log('offers:', offers);
  console.log('total offers:', d.bankOffers.length);
  console.log('branches per city:', perCity);
  console.log('total branches:', branches);
  console.log('hidden-charge rows:', hidden);
  console.log('p2p demo requests:', d.p2pDemoRequests.length, '| lenders:', d.p2pDemoLenders.length);
  console.log('loan types:', d.loanTypes.map((t) => `${t.id}(${t.name})`).join(', '));
}