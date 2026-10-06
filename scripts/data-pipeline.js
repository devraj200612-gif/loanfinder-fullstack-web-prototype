'use strict';

// Shared data-pipeline helpers used by both the seeder (init-db.js) and the
// validator (validate-db.js) so the two always agree on the canonical shape of
// the seeded data.

const crypto = require('crypto');

function sha256(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniqueSlug(base, used) {
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

function normalize(frontend) {
  const { bankOffers, branchData, hiddenCharges } = frontend;

  // ---- banks: derived from the union of offer and branch bank names ----
  const bankNameToShort = {};
  for (const offer of bankOffers) bankNameToShort[offer.bankName] = offer.shortCode;
  for (const cityRows of Object.values(branchData)) {
    for (const b of cityRows) {
      if (bankNameToShort[b.bank] === undefined) bankNameToShort[b.bank] = null;
    }
  }
  const bankNames = Object.keys(bankNameToShort);
  const banks = bankNames.map((name, i) => ({
    id: i + 1,
    name,
    short_code: bankNameToShort[name],
  }));
  const bankIdByName = {};
  banks.forEach((b) => {
    bankIdByName[b.name] = b.id;
  });

  // ---- loan offers ----
  const offers = bankOffers.map((o) => ({
    id: o.id,
    bank_id: bankIdByName[o.bankName],
    loan_type_id: o.loanTypeId,
    loan_type: o.loanType,
    name: `${o.bankName} ${o.loanType}`,
    interest_rate: o.interestRate,
    processing_fee_percent: o.processingFeePercent,
    processing_fee_max: o.processingFeeMax,
    max_amount: o.maxAmount,
    max_tenure: o.maxTenure,
    tag: o.tag ?? null,
    tag_type: o.tagType ?? null,
    badge: o.badge ?? null,
    color: o.color ?? null,
    eligibility: o.eligibility ?? null,
    min_credit_score: o.minCreditScore ?? null,
    min_monthly_income: o.minMonthly ?? null,
    employment_types: JSON.stringify(o.allowedEmployment ?? []),
    other_charges: o.otherCharges ?? null,
    last_updated: o.lastUpdated ?? null,
    source_url: null,
    source_name: null,
    verification_status: 'sample',
    last_verified_at: null,
  }));

  // ---- branches ----
  const usedBranchIds = new Set();
  const branches = [];
  for (const [city, rows] of Object.entries(branchData)) {
    for (const b of rows) {
      const source = b.source ? String(b.source) : null;
      const isUrl = source !== null && /^https?:\/\//i.test(source);
      branches.push({
        id: uniqueSlug(`${slugify(city)}-${slugify(b.name)}`, usedBranchIds),
        bank_id: bankIdByName[b.bank],
        city,
        branch_name: b.name,
        address: b.address ?? null,
        hours: b.hours ?? null,
        phone: b.phone ?? null,
        latitude: typeof b.lat === 'number' ? b.lat : null,
        longitude: typeof b.lng === 'number' ? b.lng : null,
        geo_precision: b.geoPrecision ?? null,
        ifsc: b.ifsc ?? null,
        source_url: isUrl ? source : null,
        source_name: !isUrl ? source : null,
        verification_status: b.ifsc ? 'verified' : 'demo',
        last_verified_at: null,
      });
    }
  }

  // ---- hidden charges ----
  const usedChargeSlugs = new Set();
  const chargeRows = [];
  for (const [offerId, rows] of Object.entries(hiddenCharges)) {
    for (const h of rows) {
      chargeRows.push({
        id: uniqueSlug(`${offerId}-${slugify(h.name)}`, usedChargeSlugs),
        offer_id: offerId,
        name: h.name,
        description: h.desc ?? null,
        fee_text: h.amount ?? null,
        fee: typeof h.fee === 'number' ? h.fee : null,
        fee_percent: h.feePercent ? 1 : 0,
        icon: h.icon ?? null,
        informational: h.informational ? 1 : 0,
      });
    }
  }

  return { banks, offers, branches, chargeRows, hiddenCharges, branchData };
}

function checkSourceInvariants(frontend) {
  const { bankOffers, branchData, hiddenCharges } = frontend;

  const offerLoanTypes = {};
  for (const o of bankOffers) offerLoanTypes[o.loanType] = (offerLoanTypes[o.loanType] || 0) + 1;
  if (bankOffers.length !== 7) throw new Error(`Expected 7 loan offers, found ${bankOffers.length}`);
  if (offerLoanTypes['Home Loan'] !== 5) throw new Error(`Expected 5 Home Loan offers, found ${offerLoanTypes['Home Loan']}`);
  if (offerLoanTypes['Personal Loan'] !== 2) throw new Error(`Expected 2 Personal Loan offers, found ${offerLoanTypes['Personal Loan']}`);

  const offerBankNames = new Set(bankOffers.map((o) => o.bankName));
  for (const cityRows of Object.values(branchData)) {
    for (const b of cityRows) {
      if (!offerBankNames.has(b.bank)) throw new Error(`Branch "${b.name}" references unknown bank "${b.bank}"`);
    }
  }

  const totalBranches = Object.values(branchData).reduce((a, rows) => a + rows.length, 0);
  if (totalBranches !== 33) throw new Error(`Expected 33 branch records, found ${totalBranches}`);

  const totalCharges = Object.values(hiddenCharges).reduce((a, rows) => a + rows.length, 0);
  if (totalCharges < Object.keys(hiddenCharges).length)
    throw new Error('HIDDEN_CHARGES must contain at least one row per offer');
}

module.exports = { normalize, checkSourceInvariants, sha256, slugify, uniqueSlug };