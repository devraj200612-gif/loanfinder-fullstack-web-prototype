/**
 * LoanFinder Frontend Application Core Logic
 * Handles UI state, multi-loan selection, real-time rate comparison,
 * documents checklist, and interactive Leaflet.js branch locator.
 */

// ==================== STATE MANAGEMENT ====================
const appState = {
  currentView: 'dashboard',
  selectedLoans: ['home'],
  loanAmount: 3500000,
  loanTenureYears: 20,
  annualIncome: 950000,
  employmentType: 'salaried',
  creditScore: 780,
  activeBankDetails: null,
  savedOffers: [],
  savedP2PRequests: [],
  activeBranchCity: 'Mumbai',
  activeBranchBank: 'State Bank',
  mapInstance: null,
  mapMarkers: [],
  mapTileLayer: null,
  mapTilesFailed: false,
  // Primary engine is MapLibre (Google-Maps-style). Leaflet is kept as a fallback
  // in case the MapLibre bundle fails to load, so the branch view never breaks.
  mapEngine: null,
  mapGL: null,
  mapGLMarkers: [],
  mapGoogle: null,
  mapGoogleMarkers: [],
  mapStyle: 'street',
  userLocation: null,
  // P2P Lending state
  p2pRequests: [],
  p2pInvestments: [],
  p2pMessages: {},
  p2pMode: 'lend',
  activeP2PLoan: null,
  p2pLenderPref: { amount: 50000, maxRate: 15, riskTolerance: 'medium', tenureMax: 24 },
  // Recommendations are revealed only after the user enters details and presses Find
  recommendationsVisible: false,
  p2pBorrowerMatchesVisible: false,
  p2pLenderMatchesVisible: false,
  // DigiLocker state
  digilockerConnected: false,
  digilockerAadhaar: '',
  digilockerDocs: [],
  digilockerImported: []
};

// ==================== LOAN TYPES DATA ====================
// Categories marked comingSoon have no verified bank offers in the catalogue yet,
// so no rate is advertised for them.
const LOAN_TYPES = [
  { id: 'home', name: 'Home Loan', icon: 'home', startingRate: '7.85% p.a.', popular: true, comingSoon: false },
  { id: 'personal', name: 'Personal Loan', icon: 'wallet', startingRate: '10.25% p.a.', popular: true, comingSoon: false },
  { id: 'car', name: 'Car Loan', icon: 'car', startingRate: null, popular: false, comingSoon: true },
  { id: 'education', name: 'Education Loan', icon: 'graduation-cap', startingRate: null, popular: false, comingSoon: true },
  { id: 'business', name: 'Business Loan', icon: 'building-2', startingRate: null, popular: false, comingSoon: true },
  { id: 'gold', name: 'Gold Loan', icon: 'gem', startingRate: null, popular: false, comingSoon: true }
];

// ==================== BANK OFFERS DATABASE ====================
// Populated at boot from the Phase 2C REST API (see window.app.loadBootData);
// the canonical dataset lives in data/loanfinder-data.json.
let BANK_OFFERS = [];

// ==================== HIDDEN CHARGES / FINE PRINT DATA ====================
// Fees & penalties beyond the advertised interest rate, per loan offer.
// Populated at boot from GET /api/loan-offers/:id/hidden-charges (per offer);
// the canonical dataset lives in data/loanfinder-data.json.
let HIDDEN_CHARGES = {};

// ==================== DOCUMENTS CHECKLIST DATA ====================
const DOCUMENTS_DATA = [
  {
    category: 'Identity Proof',
    title: 'Valid Government Photo ID',
    desc: 'PAN Card (Mandatory) along with Passport, Voter ID, or Driving License',
    icon: 'id-card',
    status: 'verified',
    tagText: 'Verified'
  },
  {
    category: 'Address Proof',
    title: 'Current Residence Proof',
    desc: 'Electricity bill (last 2 months), Registered Rent Agreement, or Aadhaar',
    icon: 'map-pin',
    status: 'pending',
    tagText: 'Action Needed'
  },
  {
    category: 'Income Proof',
    title: 'Salary Slips & Income Certificate',
    desc: 'Latest 3 months salary slips with complete breakdown of deductions',
    icon: 'banknote',
    status: 'verified',
    tagText: 'Verified'
  },
  {
    category: 'Banking History',
    title: 'Bank Account Statements',
    desc: 'Last 6 months operating salary bank account statement in official PDF',
    icon: 'file-spreadsheet',
    status: 'verified',
    tagText: 'Verified'
  },
  {
    category: 'Tax Filings',
    title: 'Income Tax Return (ITR) & Form 16',
    desc: 'Form 16 / ITR acknowledgments for the previous 2 financial assessment years',
    icon: 'file-check-2',
    status: 'pending',
    tagText: 'Pending'
  },
  {
    category: 'Property Details',
    title: 'Property Title Deeds & Allotment Letter',
    desc: 'Sale agreement, approved building plan, and chain deed history (for Home Loans)',
    icon: 'home',
    status: 'missing',
    tagText: 'Optional'
  },
  {
    category: 'Photographs',
    title: 'Recent Passport-size Photographs',
    desc: '3 recent passport-sized color photos of applicant and co-applicants',
    icon: 'user-check',
    status: 'verified',
    tagText: 'Verified'
  }
];

// ==================== DIGILOCKER AVAILABLE DOCUMENTS ====================
const DIGILOCKER_DOCS = [
  {
    id: 'aadhaar',
    name: 'Aadhaar Card',
    issuer: 'UIDAI',
    type: 'Identity Proof',
    icon: 'id-card',
    iconBg: '#EEF2FF',
    iconColor: '#4F46E5',
    verified: true,
    docNumber: 'XXXX-XXXX-7890',
    issuedDate: '12 Mar 2019',
    mapsTo: 'Identity Proof',
    desc: 'Aadhaar card linked to your DigiLocker account'
  },
  {
    id: 'pan',
    name: 'PAN Card',
    issuer: 'Income Tax Department',
    type: 'Identity Proof',
    icon: 'credit-card',
    iconBg: '#FEF3C7',
    iconColor: '#D97706',
    verified: true,
    docNumber: 'ABCDE1234F',
    issuedDate: '05 Jul 2020',
    mapsTo: 'Identity Proof',
    desc: 'Permanent Account Number card'
  },
  {
    id: 'driving_license',
    name: 'Driving License',
    issuer: 'Ministry of Road Transport',
    type: 'Identity Proof',
    icon: 'car',
    iconBg: '#ECFDF5',
    iconColor: '#059669',
    verified: true,
    docNumber: 'MH-01-2023-0045678',
    issuedDate: '22 Nov 2022',
    mapsTo: 'Identity Proof',
    desc: 'Valid driving license'
  },
  {
    id: 'class10_cert',
    name: 'Class X Certificate',
    issuer: 'CBSE',
    type: 'Education',
    icon: 'graduation-cap',
    iconBg: '#FDF2F8',
    iconColor: '#DB2777',
    verified: true,
    docNumber: 'CBSE-2018-456123',
    issuedDate: '28 May 2018',
    mapsTo: null,
    desc: 'Secondary school examination certificate'
  },
  {
    id: 'voter_id',
    name: 'Voter ID Card',
    issuer: 'Election Commission of India',
    type: 'Identity Proof',
    icon: 'check-square',
    iconBg: '#FFF7ED',
    iconColor: '#EA580C',
    verified: true,
    docNumber: 'ABC1234567',
    issuedDate: '10 Jan 2021',
    mapsTo: 'Identity Proof',
    desc: 'EPIC voter identification card'
  },
  {
    id: 'registration_cert',
    name: 'Vehicle Registration',
    issuer: 'Ministry of Road Transport',
    type: 'Property / Vehicle',
    icon: 'car',
    iconBg: '#F0F9FF',
    iconColor: '#0284C7',
    verified: true,
    docNumber: 'MH-02-AB-1234',
    issuedDate: '18 Sep 2021',
    mapsTo: null,
    desc: 'RC book for your registered vehicle'
  }
];

// ==================== BANK BRANCHES GEODATA ====================
// Legacy Mumbai / Delhi / Bengaluru records predate verification work. Their
// coordinates are illustrative sample data for this offline demo, never a
// claim about a real branch location, so they are tagged geoPrecision: 'demo'.
// Hyderabad & Pune records are compiled from official bank branch locators
// (sbi.bank.in, hdfc.bank.in, icici.bank.in, branch.axis.bank.in, kotak.bank.in).
// `ifsc` and `source` document provenance; `lat`/`lng` are only set where an
// OpenStreetMap bank node of the same bank was found in the same locality and are
// flagged by `geoPrecision` ('branch' | 'locality'). Null coords mean "not verified".
// Populated at boot from GET /api/branches into a city-keyed map;
// the canonical dataset lives in data/loanfinder-data.json.
let BRANCH_DATA = {};

// ==================== LOCAL DATABASE (single-file, localStorage-backed) ====================
// A tiny document store: one JSON document keyed in localStorage, split into
// logical "tables" (savedOffers, meta, p2p). Everything persists across reloads
// and is reset as one unit via app.resetDemoData(). No extra files or servers.
const LFDB_KEY = 'loanfinder.db.v1';

const db = {
  all() {
    try {
      const raw = localStorage.getItem(LFDB_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn('DB read failed:', e);
      return {};
    }
  },
  save(doc) {
    try {
      localStorage.setItem(LFDB_KEY, JSON.stringify(doc));
    } catch (e) {
      console.warn('DB write failed:', e);
    }
  },
  get(table, fallback) {
    const doc = this.all();
    return doc[table] !== undefined ? doc[table] : fallback;
  },
  set(table, value) {
    const doc = this.all();
    if (JSON.stringify(doc[table]) !== JSON.stringify(value)) {
      doc[table] = value;
      this.save(doc);
    }
  },
  remove(table) {
    const doc = this.all();
    if (table in doc) {
      delete doc[table];
      this.save(doc);
    }
  },
  clear() {
    try {
      localStorage.removeItem(LFDB_KEY);
    } catch (e) {
      /* ignore */
    }
  }
};

// Unified feedback: drop-in replacement for alert() that renders a toast.
// Falls back to a console warning only if the app object is unavailable.
function toast(message, type) {
  try {
    return window.app.showToast(message, type);
  } catch (e) {
    console.warn('Toast unavailable:', e);
  }
}

// ==================== P2P LENDING DATA ====================
const P2P_STORAGE_KEY = 'loanfinder.p2p.v1';

// Demo borrower loan requests (marketplace + one seeded request owned by the user).
const P2P_DEMO_REQUESTS = [
  {
    id: 'p2p-r1',
    borrowerName: 'Priya Sharma',
    initials: 'PS',
    avatarColor: '#2563eb',
    purpose: 'Medical Emergency',
    amount: 80000,
    funded: 0,
    rate: 11.5,
    tenureMonths: 12,
    monthlyIncome: 48000,
    employmentType: 'Salaried - IT Professional',
    creditScore: 745,
    risk: 'Medium',
    description: 'Need urgent funds for my father\u2019s surgery. Will repay in 12 monthly installments from my salary.',
    repaymentDate: '5th of every month',
    requestedDate: '2 days ago',
    status: 'open',
    isMine: false
  },
  {
    id: 'p2p-r2',
    borrowerName: 'Rohit Mehta',
    initials: 'RM',
    avatarColor: '#7c3aed',
    purpose: 'Wedding Expenses',
    amount: 150000,
    funded: 0,
    rate: 12.0,
    tenureMonths: 24,
    monthlyIncome: 62000,
    employmentType: 'Salaried - Banking',
    creditScore: 700,
    risk: 'Medium',
    description: 'Organizing my wedding next month. Loan will be repaid from salary over two years.',
    repaymentDate: '10th of every month',
    requestedDate: '5 days ago',
    status: 'open',
    isMine: false
  },
  {
    id: 'p2p-r3',
    borrowerName: 'Ananya Iyer',
    initials: 'AI',
    avatarColor: '#0891b2',
    purpose: 'Business Expansion',
    amount: 200000,
    funded: 0,
    rate: 13.5,
    tenureMonths: 18,
    monthlyIncome: 85000,
    employmentType: 'Self-Employed - Boutique Owner',
    creditScore: 690,
    risk: 'High',
    description: 'Expanding my boutique and adding an online store. Stable revenue, need working capital.',
    repaymentDate: '15th of every month',
    requestedDate: 'Today',
    status: 'open',
    isMine: false
  },
  {
    id: 'p2p-r4',
    borrowerName: 'Vikram Singh',
    initials: 'VS',
    avatarColor: '#059669',
    purpose: 'Education Fees',
    amount: 100000,
    funded: 100000,
    rate: 10.5,
    tenureMonths: 12,
    monthlyIncome: 55000,
    employmentType: 'Salaried - Engineer',
    creditScore: 780,
    risk: 'Low',
    description: 'Funding my daughter\u2019s engineering semester fees. Loan sanctioned and currently in repayment.',
    repaymentDate: '1st of every month',
    requestedDate: '1 week ago',
    status: 'repaying',
    isMine: false
  },
  {
    id: 'p2p-r5',
    borrowerName: 'Sneha Kulkarni',
    initials: 'SK',
    avatarColor: '#d97706',
    purpose: 'Home Renovation',
    amount: 60000,
    funded: 0,
    rate: 11.0,
    tenureMonths: 9,
    monthlyIncome: 40000,
    employmentType: 'Salaried - Teacher',
    creditScore: 730,
    risk: 'Medium',
    description: 'Renovating my kitchen and bathroom. Prefer to borrow rather than touch savings.',
    repaymentDate: '5th of every month',
    requestedDate: '3 days ago',
    status: 'open',
    isMine: false
  },
  {
    id: 'p2p-u1',
    borrowerName: 'Alex Johnson',
    initials: 'AJ',
    avatarColor: '#2563eb',
    purpose: 'Home Renovation',
    amount: 120000,
    funded: 110000,
    rate: 10.8,
    tenureMonths: 12,
    monthlyIncome: 79000,
    employmentType: 'Salaried - Product Manager',
    creditScore: 760,
    risk: 'Low',
    description: 'Seeded demo request: repaying a home renovation loan with one lender.',
    repaymentDate: '5th of every month',
    requestedDate: '3 weeks ago',
    status: 'repaying',
    isMine: true,
    lenderName: 'Rahul Verma'
  }
];

// Demo lender profiles used for borrower-side match recommendations.
const P2P_DEMO_LENDERS = [
  { name: 'Rahul Verma', initials: 'RV', minAmount: 20000, maxAmount: 200000, maxRate: 12, risk: ['low', 'medium'], tenureMax: 24 },
  { name: 'Kavita Reddy', initials: 'KR', minAmount: 10000, maxAmount: 150000, maxRate: 12, risk: ['low'], tenureMax: 12 },
  { name: 'Neha Gupta', initials: 'NG', minAmount: 5000, maxAmount: 50000, maxRate: 13, risk: ['low', 'medium'], tenureMax: 18 },
  { name: 'Amit Thakur', initials: 'AT', minAmount: 25000, maxAmount: 300000, maxRate: 16, risk: ['low', 'medium', 'high'], tenureMax: 36 }
];

// Safe icon initializer that never throws when Lucide is unavailable/blocked.
function safeIcons() {
  if (typeof window !== 'undefined' && window.lucide && typeof lucide.createIcons === 'function') {
    try { lucide.createIcons(); } catch (e) { console.warn('Icon render skipped:', e); }
  }
}

// Safe checker for the Leaflet map library.
function isLeafletLoaded() {
  return typeof window !== 'undefined' && !!window.L && typeof L.map === 'function';
}

// Safe checker for the MapLibre map library (primary, Google-Maps-style engine).
function isMapLibreLoaded() {
  return typeof window !== 'undefined' && !!window.maplibregl && typeof maplibregl.Map === 'function';
}

// Empty-state card shown in P2P match grids until the user actively finds matches.
function p2pMatchPlaceholder(msg) {
  return `
    <div class="p-8 text-center text-slate-500 rounded-xl border border-dashed border-blue-300 bg-blue-50 col-span-3">
      <i data-lucide="sparkles" class="w-10 h-10 mx-auto mb-2 text-blue-500"></i>
      <h4 class="font-bold text-slate-700">No matches shown yet</h4>
      <p class="text-sm">${msg}</p>
    </div>
  `;
}

// ==================== APP CONTROLLER OBJECT ====================
window.app = {

  // Read-only access to the live map instance and the active basemap style.
  // The map lives in the module-scoped appState, so without this the browser
  // tests have no way to inspect what MapLibre actually rendered.
  get map() { return appState.mapGL || appState.mapGoogle || appState.mapInstance || null; },
  get mapStyle() { return appState.mapStyle; },

  init() {
    // Phase 2D: the app now reads its catalogue data from the Phase 2C REST API
    // at boot instead of inline constants. Show a loading state, fetch and
    // transform the data into the module stores, then initialise the UI exactly
    // as before. On failure the user sees an explicit error and can Retry -
    // there is deliberately no silent fallback to hardcoded data.
    this.showBootLoading();
    this.loadBootData()
      .then(() => {
        this.hideBootOverlay();
        this.booted();
      })
      .catch(err => {
        console.error('[LoanFinder] boot failed:', err && err.message ? err.message : err);
        this.showBootFailure(err);
      });
  },

  // Runs after the API data is loaded, matching the pre-Phase-2D init() order.
  // Guarded: the Retry path calls init() again, which must never re-bind the
  // global listeners a second time.
  _booted: false,
  booted() {
    if (this._booted) return;
    this._booted = true;
    this.loadDemoState();
    this.renderLoanTypes();
    this.bindRangeSlider();
    this.bindRequirementsRefresh();
    this.bindNavigation();
    this.bindAuthModal();
    this.bindGlobalSearch();
    this.bindSupportWidget();
    this.calculateAndCompare();
    this.renderDocumentChecklist();
    this.initEligibility();
    this.initMap();
    appState.activeBankDetails = BANK_OFFERS[0];
    this.initP2P();
    this.applyPrefsToUI();
    this.showLanding();
  },

  // Fetches the full read set from the API and rebuilds the module stores that
  // every renderer/matcher reads. Values are mapped 1:1 from the API shape to
  // the legacy frontend shape so matching and rendering are unchanged.
  loadBootData() {
    const api = window.LoanFinderAPI;
    if (!api || typeof api.getBanks !== 'function' || typeof api.getLoanOffers !== 'function') {
      return Promise.reject(new Error('The frontend API layer (api.js) did not load.'));
    }
    let offers = [];
    return api
      .getBanks()
      .catch(err => {
        throw new Error('Could not reach the LoanFinder API (' + (err && err.message ? err.message : err) + ').');
      })
      .then(() => api.getLoanOffers())
      .then(list => {
        if (!Array.isArray(list) || list.length === 0) {
          throw new Error('The loan offers API returned no data.');
        }
        offers = list;
        return Promise.all(list.map(o => api.getHiddenCharges(o.id)));
      })
      .then(chargeLists => {
        const map = {};
        chargeLists.forEach(rows => {
          if (Array.isArray(rows) && rows.length) {
            map[rows[0].offer_id] = rows.map(c => this.mapHiddenCharge(c));
          }
        });
        HIDDEN_CHARGES = map;
        return api.getBranches();
      })
      .then(branches => {
        if (!Array.isArray(branches)) {
          throw new Error('The branches API returned no data.');
        }
        const byCity = {};
        branches.forEach(b => {
          const city = b.city || 'Other';
          if (!byCity[city]) byCity[city] = [];
          byCity[city].push(this.mapBranch(b));
        });
        BRANCH_DATA = byCity;
      })
      .then(() => {
        BANK_OFFERS = offers.map(o => this.mapOffer(o));
      });
  },

  // API offer -> frontend offer (kept identical to the Phase 1 field names).
  mapOffer(o) {
    return {
      id: o.id,
      bankName: o.bank.name,
      shortCode: o.bank.short_code,
      loanType: o.loan_type,
      loanTypeId: o.loan_type_id,
      interestRate: o.interest_rate,
      processingFeePercent: o.processing_fee_percent,
      processingFeeMax: o.processing_fee_max,
      maxAmount: o.max_amount,
      maxTenure: o.max_tenure,
      tag: o.tag || undefined,
      tagType: o.tag_type || undefined,
      badge: o.badge || undefined,
      color: o.color || undefined,
      eligibility: o.eligibility || undefined,
      minCreditScore: o.min_credit_score,
      minMonthly: o.min_monthly_income,
      allowedEmployment: Array.isArray(o.employment_types) ? o.employment_types : [],
      otherCharges: o.other_charges || undefined,
      lastUpdated: o.last_updated || undefined,
      name: o.name,
      bank: o.bank,
      sourceUrl: o.source_url || undefined,
      sourceName: o.source_name || undefined,
      verificationStatus: o.verification_status,
    };
  },

  // API branch -> frontend branch (city-keyed map entry).
  mapBranch(b) {
    return {
      id: b.id,
      bank: b.bank.name,
      name: b.branch_name,
      address: b.address,
      hours: b.hours,
      phone: b.phone,
      lat: b.latitude,
      lng: b.longitude,
      geoPrecision: b.geo_precision || undefined,
      ifsc: b.ifsc || undefined,
      source: b.source_url || b.source_name || undefined,
      city: b.city,
      bankShortCode: b.bank.short_code,
      verificationStatus: b.verification_status,
    };
  },

  // API hidden charge -> frontend hidden-charge entry.
  mapHiddenCharge(c) {
    return {
      icon: c.icon || 'file-text',
      name: c.name,
      desc: c.description,
      amount: c.fee_text,
      fee: c.fee,
      feePercent: !!c.fee_percent,
      informational: !!c.informational,
    };
  },

  // ---- Boot overlay (loading / failure / retry) -----------------------------
  showBootLoading() {
    const overlay = document.getElementById('boot-overlay');
    if (!overlay) return;
    overlay.classList.remove('boot-hidden');
    const message = document.getElementById('boot-message');
    if (message) message.textContent = 'Loading LoanFinder...';
    const retry = document.getElementById('boot-retry');
    if (retry) retry.hidden = true;
  },

  hideBootOverlay() {
    const overlay = document.getElementById('boot-overlay');
    if (overlay) overlay.classList.add('boot-hidden');
  },

  showBootFailure(err) {
    const overlay = document.getElementById('boot-overlay');
    if (!overlay) return;
    overlay.classList.remove('boot-hidden');
    const message = document.getElementById('boot-message');
    if (message) message.textContent = 'Could not load LoanFinder data.';
    const detail = document.getElementById('boot-error-detail');
    if (detail) detail.textContent = (err && err.message) ? err.message : 'Unknown error';
    const retry = document.getElementById('boot-retry');
    if (retry) retry.hidden = false;
  },

  retryBoot() {
    this.init();
  },

  // Toast feedback system (one container, created on demand)
  showToast(message, type) {
    type = type || 'info';
    let host = document.getElementById('toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toast-host';
      host.className = 'toast-host';
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML = '<i data-lucide="' + (type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info') + '"></i><span></span>';
    el.querySelector('span').textContent = message;
    host.appendChild(el);
    safeIcons();
    setTimeout(() => el.classList.add('toast-out'), 3200);
    setTimeout(() => el.remove(), 3600);
  },

  // Load persisted demo state; on first run, seed bookmarked offers so the
  // Saved Results view is never blank when a judge opens it.
  loadDemoState() {
    const stored = db.get('savedOffers', null);
    if (Array.isArray(stored)) {
      appState.savedOffers = stored;
    } else {
      appState.savedOffers = BANK_OFFERS.filter(o => o.id === 'sbi-home' || o.id === 'hdfc-pers');
      db.set('savedOffers', appState.savedOffers);
      db.set('meta', { demoSeeded: true, seededAt: Date.now() });
    }
    const savedP2P = db.get('savedP2PRequests', null);
    if (Array.isArray(savedP2P)) {
      appState.savedP2PRequests = savedP2P;
    } else {
      appState.savedP2PRequests = [];
      db.set('savedP2PRequests', appState.savedP2PRequests);
    }
  },

  // ---- Settings preferences (persisted to localStorage via the db store) ----
  // Only the three toggles shown in Settings are persisted. Anything toggled but
  // not yet saved is marked as an unsaved change so the UI never claims a save
  // that did not happen.
  defaultPrefs() {
    return { emailAlerts: false, rateDropAlerts: true, inrDisplay: true };
  },

  prefDraft() {
    const stored = db.get('prefs', null);
    return Object.assign(this.defaultPrefs(), (stored && typeof stored === 'object') ? stored : {});
  },

  PREF_TOGGLE_IDS: {
    emailAlerts: 'pref-email-alerts',
    rateDropAlerts: 'pref-rate-drop-alerts',
    inrDisplay: 'pref-inr-display'
  },

  // Reflect the saved values into the switches on first render.
  applyPrefsToUI() {
    const prefs = this.prefDraft();
    Object.keys(this.PREF_TOGGLE_IDS).forEach(key => {
      const el = document.getElementById(this.PREF_TOGGLE_IDS[key]);
      if (!el) return;
      const on = !!prefs[key];
      el.classList.toggle('on', on);
      el.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    this.updatePrefsStatus(true);
  },

  togglePref(key, el) {
    if (!(key in this.defaultPrefs())) return;
    const on = el.classList.toggle('on');
    el.setAttribute('aria-checked', on ? 'true' : 'false');
    this.updatePrefsStatus(false);
  },

  updatePrefsStatus(isSavedState) {
    const el = document.getElementById('prefs-status');
    if (!el) return;
    const savedAt = db.get('prefsSavedAt', null);
    el.textContent = isSavedState
      ? 'Preferences are stored in this browser only (localStorage). No data is sent anywhere.' +
        (savedAt ? ' Last saved ' + new Date(savedAt).toLocaleString('en-IN') + '.' : '')
      : 'You have unsaved changes. Press "Save Preferences" to store them in this browser.';
    el.style.color = isSavedState ? '' : '#b45309';
  },

  savePreferences() {
    const prefs = {};
    Object.keys(this.PREF_TOGGLE_IDS).forEach(key => {
      const el = document.getElementById(this.PREF_TOGGLE_IDS[key]);
      prefs[key] = !!(el && el.classList.contains('on'));
    });
    db.set('prefs', prefs);
    db.set('prefsSavedAt', Date.now());
    this.updatePrefsStatus(true);
    this.showToast('Preferences saved to this browser.', 'success');
  },

  // One-click demo reset: wipe the local database + P2P store and reseed.
  resetDemoData() {
    db.clear();
    try {
      localStorage.removeItem(P2P_STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
    this.showToast('Demo data reset. Loading fresh seeded data\u2026', 'success');
    setTimeout(() => location.reload(), 700);
  },

  // Landing / Dashboard switching
  showLanding() {
    const landing = document.getElementById('landing');
    const app = document.getElementById('app');
    const auth = document.getElementById('auth-page');
    if (landing) landing.style.display = 'block';
    if (app) app.classList.add('hidden');
    if (auth) auth.style.display = 'none';
    window.scrollTo(0, 0);
    safeIcons();
  },

  launchApp() {
    const landing = document.getElementById('landing');
    const app = document.getElementById('app');
    const auth = document.getElementById('auth-page');
    if (landing) landing.style.display = 'none';
    if (app) app.classList.remove('hidden');
    if (auth) auth.style.display = 'none';
    const widget = document.getElementById('support-widget');
    if (widget) widget.classList.remove('hidden');
    this.navigateTo('dashboard');
      this.refreshMapSize(200);
  },

  showAuth() {
    const landing = document.getElementById('landing');
    const app = document.getElementById('app');
    const auth = document.getElementById('auth-page');
    if (landing) landing.style.display = 'none';
    if (app) app.classList.add('hidden');
    if (auth) auth.style.display = 'flex';
    const widget = document.getElementById('support-widget');
    if (widget) widget.classList.add('hidden');
    this.switchAuthTab('login');
    window.scrollTo(0, 0);
    safeIcons();
  },

  closeAuth() {
    const auth = document.getElementById('auth-page');
    if (auth) auth.style.display = 'none';
    this.showLanding();
  },

  switchAuthTab(tab) {
    const loginForm = document.getElementById('auth-login-form');
    const signupForm = document.getElementById('auth-signup-form');
    const loginTab = document.getElementById('auth-tab-login');
    const signupTab = document.getElementById('auth-tab-signup');

    if (tab === 'signup') {
      if (loginForm) loginForm.style.display = 'none';
      if (signupForm) signupForm.style.display = 'block';
      if (loginTab) loginTab.classList.remove('active');
      if (signupTab) signupTab.classList.add('active');
    } else {
      if (signupForm) signupForm.style.display = 'none';
      if (loginForm) loginForm.style.display = 'block';
      if (signupTab) signupTab.classList.remove('active');
      if (loginTab) loginTab.classList.add('active');
    }
  },

  togglePassword(btn) {
    const input = btn.previousElementSibling;
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.innerHTML = isPassword ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
    safeIcons();
  },

  eligibilityCreditTier(score) {
    if (score >= 780) return { label: 'Excellent', sub: 'Clears every published minimum' };
    if (score >= 740) return { label: 'Good', sub: 'Clears most published minimums' };
    if (score >= 680) return { label: 'Fair', sub: 'Some offers will not qualify' };
    return { label: 'Low', sub: 'Most offers will not qualify' };
  },

  // Eligibility inputs are read from the published catalogue so the rates and
  // tenures shown here always match the offer cards. Nothing is invented.
  eligibilityLoanTypes() {
    const byType = {};
    BANK_OFFERS.forEach(o => {
      if (!byType[o.loanTypeId]) byType[o.loanTypeId] = [];
      byType[o.loanTypeId].push(o);
    });
    return LOAN_TYPES.filter(l => byType[l.id]).map(l => {
      const offers = byType[l.id];
      const cheapest = offers.reduce((a, b) => (b.interestRate < a.interestRate ? b : a));
      const widest = offers.reduce((a, b) => (b.maxTenure > a.maxTenure ? b : a));
      return {
        key: l.id,
        name: l.name,
        icon: l.icon,
        offers,
        rate: cheapest.interestRate,
        years: widest.maxTenure,
        minCredit: Math.min(...offers.map(o => o.minCreditScore)),
        strictestCredit: Math.max(...offers.map(o => o.minCreditScore)),
        allowedEmployment: widest.allowedEmployment,
        maxAmount: Math.max(...offers.map(o => o.maxAmount))
      };
    });
  },

  // Processing fee is always quoted with the bank's own published cap, never an invented floor
  processingFeeLabel(offer) {
    if (!offer) return '—';
    const pct = offer.processingFeePercent + '%';
    return offer.processingFeeMax ? `${pct}, capped at ${this.fmtINR(offer.processingFeeMax)}` : pct;
  },

  eligiblePrincipalFromEMI(emi, ratePct, years) {
    const r = ratePct / 100 / 12;
    const n = years * 12;
    if (r <= 0) return Math.round(emi * n);
    return Math.round(emi * (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n)));
  },

  syncEligRange(rangeEl) {
    const num = document.getElementById(rangeEl.id.replace('-range', '-num'));
    if (num) num.value = rangeEl.value;
    this.recalcEligibility();
  },

  syncEligNum(numEl) {
    const range = document.getElementById(numEl.id.replace('-num', '-range'));
    if (range) range.value = numEl.value;
    this.recalcEligibility();
  },

  initEligibility() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    if (document.getElementById('elig-income-num')) {
      set('elig-income-range', appState.annualIncome);
      set('elig-income-num', appState.annualIncome);
      set('elig-credit-range', appState.creditScore);
      set('elig-credit-num', appState.creditScore);
      set('elig-employment', appState.employmentType);
    }
  },

  launchEligibility() {
    // Pull the latest values from the dashboard form so the checker starts in sync
    const incomeEl = document.getElementById('annual-income');
    const empEl = document.getElementById('employment-type');
    const credEl = document.getElementById('credit-score');
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    if (incomeEl) {
      set('elig-income-range', incomeEl.value);
      set('elig-income-num', incomeEl.value);
    }
    if (credEl) {
      set('elig-credit-range', credEl.value);
      set('elig-credit-num', credEl.value);
    }
    if (empEl) set('elig-employment', empEl.value);

    this.navigateTo('eligibility');
    this.recalcEligibility();
  },

  recalcEligibility() {
    if (!document.getElementById('elig-income-num')) return;

    const income = parseInt(document.getElementById('elig-income-num').value, 10) || 0;
    const existingEMIs = parseInt(document.getElementById('elig-emi-num').value, 10) || 0;
    let credit = parseInt(document.getElementById('elig-credit-num').value, 10) || 600;
    credit = Math.min(850, Math.max(550, credit));
    const employment = document.getElementById('elig-employment').value;
    const requested = appState.loanAmount || 0;

    const monthlyIncome = income / 12;
    // 50% of net monthly income is the common affordability rule of thumb.
    // It is a planning estimate, not a bank sanction.
    const affordableEMI = Math.max(0, Math.round(monthlyIncome * 0.5 - existingEMIs));

    const types = this.eligibilityLoanTypes();

    const results = types.map(t => {
      const reasons = [];
      if (credit < t.minCredit) reasons.push('Credit below ' + t.minCredit);
      if (!t.allowedEmployment.includes(employment)) reasons.push(t.allowedEmployment.length === 1 && t.allowedEmployment[0] === 'salaried' ? 'Salaried applicants only' : 'Employment type not accepted');
      if (affordableEMI <= 0) reasons.push('No spare EMI capacity');
      const eligible = reasons.length === 0;
      const amount = eligible ? Math.min(this.eligiblePrincipalFromEMI(affordableEMI, t.rate, t.years), t.maxAmount) : 0;
      return { ...t, eligible, amount, reasons };
    });

    const maxEligible = Math.max(0, ...results.map(r => r.amount));
    const roundL = v => Math.round(v / 1000) * 1000;
    const coveragePct = requested > 0 ? Math.min(100, Math.round(maxEligible / requested * 100)) : 0;

    const num = v => '₹' + roundL(v).toLocaleString('en-IN');
    this.setText('eligible-amount', num(maxEligible));
    this.setText('eligible-emi', '₹' + affordableEMI.toLocaleString('en-IN'));
    this.setText('eligible-income', '₹' + income.toLocaleString('en-IN'));
    this.setText('elig-request-note', 'Comparing a ' + num(requested) + ' loan');

    const tier = this.eligibilityCreditTier(credit);
    const badgeEl = document.getElementById('elig-credit-tier');
    if (badgeEl) {
      badgeEl.textContent = tier.label + ' · ' + tier.sub;
      badgeEl.className = 'credit-tier-badge tier-' + (credit >= 740 ? 'great' : credit >= 680 ? 'ok' : 'low');
    }

    let verdict, barCls = '';
    if (maxEligible <= 0) { verdict = 'Not eligible yet'; barCls = 'bar-low'; }
    else if (coveragePct >= 100) { verdict = 'Fully covered'; barCls = 'bar-good'; }
    else if (coveragePct >= 60) { verdict = 'Partially covered'; barCls = 'bar-mid'; }
    else { verdict = 'Reduce your ask'; barCls = 'bar-low'; }

    this.setText('elig-cover-label', 'How close you are to your ' + num(requested || maxEligible) + ' ask');
    this.setText('elig-verdict', verdict);
    const bar = document.getElementById('elig-cover-bar');
    if (bar) {
      bar.style.width = '0%';
      requestAnimationFrame(() => { bar.style.width = coveragePct + '%'; bar.className = 'elig-bar-fill ' + barCls; });
    }

    this.renderEligibilityLoanGrid(results, requested, num);
    this.renderEligibilityTips({
      income, existingEMIs, credit, employment, requested, coveragePct, maxEligible, results, affordableEMI,
      lowestMinCredit: Math.min(...types.map(t => t.minCredit)),
      strictestMinCredit: Math.max(...types.map(t => t.strictestCredit))
    });
  },

  setText(id, v) {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  },

  renderEligibilityLoanGrid(results, requested, num) {
    const grid = document.getElementById('elig-loan-grid');
    if (!grid) return;
    grid.innerHTML = results.map(r => {
      let cls, badge;
      if (!r.eligible) { cls = 'tier-red'; badge = 'Not eligible'; }
      else if (r.amount >= requested) { cls = 'tier-green'; badge = 'Eligible'; }
      else { cls = 'tier-amber'; badge = 'Reduce your ask'; }
      return `
        <div class="loan-tier-card">
          <div class="loan-tier-head">
            <i data-lucide="${r.icon}" class="w-4 h-4"></i>
            <span class="font-bold text-slate-900 text-sm">${r.name}</span>
          </div>
          <div>
            <span class="loan-tier-chip ${cls}">${badge}</span>
          </div>
          <div class="loan-tier-amt">${r.eligible ? num(r.amount) : '—'}</div>
          <div class="text-xs text-slate-500">${r.eligible ? 'at ' + r.rate + '% p.a. · up to ' + r.years + ' yrs' : (r.reasons.join(' · ') || 'Not available')}</div>
          <div class="loan-tier-reason">${r.eligible
            ? (r.amount >= requested
                ? 'Covers your ' + num(requested) + ' request.'
                : 'Below your ' + num(requested) + ' ask under the 50% income rule.')
            : r.reasons.join(' and ') + '.'}</div>
        </div>
      `;
    }).join('');
    safeIcons();
  },

  renderEligibilityTips(ctx) {
    const list = document.getElementById('elig-tips');
    if (!list) return;
    const tips = [];

    if (ctx.existingEMIs > 0) {
      const home = ctx.results.find(r => r.key === 'home');
      const freed = home ? this.eligiblePrincipalFromEMI(ctx.existingEMIs, home.rate, home.years) : 0;
      if (freed > 0) {
        tips.push('Closing ' + this.fmtINR(ctx.existingEMIs) + '/month of existing EMIs frees that same amount of EMI capacity, worth about ' + this.fmtINR(freed) + ' more borrowing at today\'s lowest advertised home-loan rate.');
      }
    }

    if (ctx.credit < ctx.lowestMinCredit) {
      tips.push('Your score of ' + ctx.credit + ' is below the lowest published minimum in our catalogue (' + ctx.lowestMinCredit + '), so no offer currently qualifies.');
    } else if (ctx.credit < ctx.strictestMinCredit) {
      tips.push('Your score of ' + ctx.credit + ' clears some published offers but not the strictest (' + ctx.strictestMinCredit + '+).');
    } else {
      tips.push('Your score of ' + ctx.credit + ' clears every credit minimum published in our catalogue.');
    }

    const blocked = ctx.results.filter(r => !r.eligible && r.reasons.some(x => /applicants only|employment type/i.test(x)));
    if (blocked.length) {
      tips.push(blocked.map(r => r.name).join(' and ') + ' offers here are published for salaried applicants only. Self-employed applicants should check the offer card directly.');
    }

    if (ctx.maxEligible > 0 && ctx.coveragePct < 100 && ctx.requested > 0) {
      tips.push('A request of about ' + this.fmtINR(ctx.maxEligible) + ' matches your profile under the 50% income rule — resize the amount on the Dashboard and every recommendation re-scores.');
    }

    tips.push('This is a planning estimate based on published rates and a 50% income rule. Final approval and amount are decided by the bank.');

    if (tips.length === 0) {
      tips.push('You are fully covered for your request. Try raising the requested amount to see where the limit sits.');
    }

    list.innerHTML = tips.map(t => `
      <li><i data-lucide="lightbulb" class="w-4 h-4 text-amber-500"></i><span>${t}</span></li>
    `).join('');
    safeIcons();
  },

  // 1. Render Loan Type Cards with Multi-Select Checkboxes
  renderLoanTypes() {
    const container = document.getElementById('loan-types-grid');
    if (!container) return;

    container.innerHTML = LOAN_TYPES.map(loan => {
      const isSelected = appState.selectedLoans.includes(loan.id);
      return `
        <div class="loan-type-card ${isSelected ? 'selected' : ''}" onclick="app.toggleLoanSelection('${loan.id}', this)">
          <div class="loan-checkbox">
            ${isSelected ? '<i data-lucide="check" class="w-3.5 h-3.5"></i>' : ''}
          </div>
          <div class="loan-icon-box">
            <i data-lucide="${loan.icon}" class="w-6 h-6"></i>
          </div>
          <div class="loan-card-title">${loan.name}</div>
          ${loan.comingSoon
            ? '<div class="loan-card-rate" style="color:#94a3b8;">Coming soon</div>'
            : `<div class="loan-card-rate">${loan.startingRate}</div>`}
        </div>
      `;
    }).join('');

    safeIcons();
    this.updateSelectedCounter();
  },

  toggleLoanSelection(loanId, cardElement) {
    if (appState.selectedLoans.length === 1 && appState.selectedLoans[0] === loanId) {
      toast('This loan type is already selected.');
      return;
    }
    appState.selectedLoans = [loanId];
    this.renderLoanTypes();
    this.calculateAndCompare();
  },

  updateSelectedCounter() {
    const countBadge = document.getElementById('selected-loans-count');
    if (countBadge) countBadge.textContent = appState.selectedLoans.length;
  },

  resetFilters() {
    appState.selectedLoans = ['home'];
    appState.loanAmount = 3500000;
    appState.loanTenureYears = 20;
    appState.annualIncome = 950000;
    appState.employmentType = 'salaried';
    appState.creditScore = 780;

    const setVal = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    };
    setVal('loan-amount-range', appState.loanAmount);
    setVal('loan-tenure', String(appState.loanTenureYears));
    setVal('annual-income', appState.annualIncome);
    setVal('employment-type', appState.employmentType);
    setVal('credit-score', appState.creditScore);
    const display = document.getElementById('loan-amount-display');
    if (display) display.textContent = '₹' + Number(appState.loanAmount).toLocaleString('en-IN');

    this.renderLoanTypes();
    this.calculateAndCompare();
  },

  bindGlobalSearch() {
    const input = document.getElementById('global-search');
    if (!input) return;
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      const base = BANK_OFFERS.filter(offer => {
        const inSelected = appState.selectedLoans.includes(offer.loanTypeId);
        return inSelected && (q === '' ||
          offer.bankName.toLowerCase().includes(q) ||
          offer.loanType.toLowerCase().includes(q) ||
          String(offer.interestRate).includes(q) ||
          (offer.tag || '').toLowerCase().includes(q));
      });
      const results = q === '' ? base : base.length ? base : [];
      this.renderComparisonList(results.sort((a, b) => a.interestRate - b.interestRate));
      if (q && base.length === 0) {
        const container = document.getElementById('comparison-list-container');
        if (container) {
          container.innerHTML = `
            <div class="p-8 text-center text-slate-500 col-span-2">
              <i data-lucide="search-x" class="w-10 h-10 mx-auto mb-2 text-slate-400"></i>
              <h4 class="font-bold text-slate-700">No banks match "${input.value.trim()}"</h4>
              <p class="text-sm">Try a bank name, loan type, or interest rate.</p>
            </div>
          `;
        }
      }
      safeIcons();
    });
  },

  // 2. Loan Amount Slider Realtime Binding
  bindRangeSlider() {
    const range = document.getElementById('loan-amount-range');
    const display = document.getElementById('loan-amount-display');
    if (!range || !display) return;

    range.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      appState.loanAmount = val;
      display.textContent = '₹' + Number(val).toLocaleString('en-IN');
      this.scheduleRefresh();
    });

    const tenureSelect = document.getElementById('loan-tenure');
    if (tenureSelect) {
      tenureSelect.addEventListener('change', (e) => {
        appState.loanTenureYears = parseInt(e.target.value, 10);
        this.scheduleRefresh();
      });
    }
  },

  // Recompute recommendations as the user edits income, employment or credit score
  bindRequirementsRefresh() {
    const binders = [
      { id: 'annual-income', key: 'annualIncome', parse: v => parseInt(v, 10) || 0 },
      { id: 'employment-type', key: 'employmentType', parse: v => v },
      { id: 'credit-score', key: 'creditScore', parse: v => parseInt(v, 10) || 0 },
    ];
    binders.forEach(b => {
      const el = document.getElementById(b.id);
      if (!el) return;
      const eventName = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(eventName, (e) => {
        appState[b.key] = b.parse(e.target.value);
        this.scheduleRefresh();
      });
    });
  },

  scheduleRefresh() {
    clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => this.calculateAndCompare(), 250);
  },

  // Calculate Monthly EMI Formula
  calcEMI(principal, annualRate, tenureYears) {
    if (!Number.isFinite(principal) || !Number.isFinite(annualRate) || !Number.isFinite(tenureYears)) return 0;
    if (principal <= 0 || tenureYears <= 0) return 0;
    const totalMonths = Math.round(tenureYears * 12);
    if (totalMonths <= 0) return 0;
    // Interest-free loans have no reducing-balance interest component
    if (annualRate <= 0) return Math.round(principal / totalMonths);
    const monthlyRate = (annualRate / 12) / 100;
    const growth = Math.pow(1 + monthlyRate, totalMonths);
    const emi = (principal * monthlyRate * growth) / (growth - 1);
    return Number.isFinite(emi) ? Math.round(emi) : 0;
  },

  // 3. Compare Loans & Rank by Lowest Advertised Interest Rate
  // "Find Matching Loan" action: reveal personalised recommendations and scroll to them
  findBestMatches() {
    appState.recommendationsVisible = true;
    this.calculateAndCompare();
    const section = document.getElementById('quick-compare-preview');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  // Reveal / collapse the full "All Offers" comparison below the top-3 picks
  toggleFullComparison() {
    const wrap = document.getElementById('full-comparison-wrap');
    const btn = document.getElementById('view-all-btn');
    const link = document.getElementById('toggle-comparison-btn');
    if (!wrap) return;

    const opening = wrap.classList.contains('hidden');
    if (opening) {
      wrap.classList.remove('hidden');
      // Default ordering is the same one calculateAndCompare() guarantees:
      // lowest advertised rate first. Sorting here (rather than relying on the
      // order offers happen to arrive in) keeps the expanded comparison stable.
      const sorted = BANK_OFFERS
        .filter(offer => appState.selectedLoans.includes(offer.loanTypeId))
        .sort((a, b) => a.interestRate - b.interestRate);
      this.renderComparisonList(sorted);
      if (btn) btn.innerHTML = '<i data-lucide="chevron-up"></i> Hide Comparison';
      if (link) link.innerHTML = 'Hide Comparison &uarr;';
      const sectionEl = document.getElementById('all-offers-section');
      if (sectionEl) sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      wrap.classList.add('hidden');
      if (btn) btn.innerHTML = '<i data-lucide="chevron-down"></i> View All Comparison';
      if (link) link.innerHTML = 'View All Comparison &darr;';
      const sectionEl = document.getElementById('all-offers-section');
      if (sectionEl) sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    safeIcons();
  },

  calculateAndCompare() {
    // Match offers that belong to the selected loan categories
    let matchingOffers = BANK_OFFERS.filter(offer => appState.selectedLoans.includes(offer.loanTypeId));

    // Sort strictly by lowest advertised interest rate
    matchingOffers.sort((a, b) => a.interestRate - b.interestRate);

    const bestOffer = matchingOffers[0];
    appState.activeBankDetails = bestOffer || null;

    // Update Badges
    const badgeCount = document.getElementById('badge-match-count');
    if (badgeCount) badgeCount.textContent = matchingOffers.length;

    // Recommendations are hidden until the user taps "Find Matching Loan"
    if (appState.recommendationsVisible) {
      this.renderBestOfferCard(bestOffer);
      this.renderRecommendedOffers(this.topMatchRecommendations(matchingOffers));
    } else {
      this.renderRecommendationsPlaceholder();
    }

    // Render Full List
    this.renderComparisonList(matchingOffers);
  },

  renderRecommendationsPlaceholder() {
    const rec = [document.getElementById('hero-best-offer-container'), document.getElementById('recommended-offers-container')].filter(Boolean);
    const hero = document.getElementById('best-offer-hero');
    const locked = `
      <div class="p-8 text-center text-slate-500 rounded-xl border border-dashed border-blue-300 bg-blue-50">
        <i data-lucide="sparkles" class="w-10 h-10 mx-auto mb-2 text-blue-500"></i>
        <h4 class="font-bold text-slate-700">Personalised recommendations await</h4>
        <p class="text-sm">Enter your loan details above, then click <strong>Find Matching Loan</strong> to unlock your top bank matches.</p>
        <button class="btn btn-primary btn-sm mt-3" onclick="app.findBestMatches()"><i data-lucide="sparkles"></i> Find Matching Loan</button>
      </div>
    `;
    rec.forEach(c => { if (c) c.innerHTML = locked; });
    if (hero) hero.innerHTML = locked;
    safeIcons();
  },

  // Score each matching offer against the user's profile and return the top 3.
  // Weights: interest rate 40%, credit-fit 25%, income-fit 20%, processing fee 15%.
  topMatchRecommendations(offers) {
    const monthly = Math.round(appState.annualIncome / 12);

    const candidates = offers.filter(o =>
      appState.loanAmount <= o.maxAmount &&
      appState.loanTenureYears <= o.maxTenure &&
      o.allowedEmployment.includes(appState.employmentType)
    );
    if (candidates.length === 0) return [];

    const rates = candidates.map(o => o.interestRate);
    const fees = candidates.map(o => o.processingFeePercent);
    const minRate = Math.min(...rates), maxRate = Math.max(...rates);
    const minFee = Math.min(...fees), maxFee = Math.max(...fees);
    const invert = (v, lo, hi) => lo === hi ? 100 : Math.max(0, Math.min(100, 100 - ((v - lo) / (hi - lo)) * 100));

    return candidates.map(o => {
      const rateFit = invert(o.interestRate, minRate, maxRate);
      const feeFit = invert(o.processingFeePercent, minFee, maxFee);
      const creditFit = appState.creditScore >= o.minCreditScore
        ? 100
        : Math.max(0, Math.min(100, 100 - (o.minCreditScore - appState.creditScore) * 2));
      const incomeFit = monthly >= o.minMonthly
        ? 100
        : Math.max(0, Math.min(100, 100 - ((o.minMonthly - monthly) / o.minMonthly) * 200));
      const matchScore = Math.round(0.40 * rateFit + 0.25 * creditFit + 0.20 * incomeFit + 0.15 * feeFit);

      return { ...o, matchScore, creditFit, incomeFit };
    }).sort((a, b) => b.matchScore - a.matchScore || a.interestRate - b.interestRate)
      .slice(0, 3);
  },

  renderRecommendedOffers(recommendations) {
    const containers = [
      document.getElementById('hero-best-offer-container'),
      document.getElementById('recommended-offers-container'),
    ].filter(Boolean);

    if (recommendations.length === 0) {
      const noOffersAtAll = !BANK_OFFERS.some(o => appState.selectedLoans.includes(o.loanTypeId));
      const names = appState.selectedLoans
        .map(id => (LOAN_TYPES.find(l => l.id === id) || {}).name)
        .filter(Boolean);
      const emptyHTML = noOffersAtAll
        ? `
        <div class="p-8 text-center text-slate-500 rounded-xl border border-dashed border-slate-300 bg-slate-50 col-span-3">
          <i data-lucide="clock" class="w-10 h-10 mx-auto mb-2 text-slate-400"></i>
          <h4 class="font-bold text-slate-700">${names.join(' / ') || 'This category'} is coming soon</h4>
          <p class="text-sm">We only publish rates verified against a bank's own source. Home Loan and Personal Loan offers are live today.</p>
        </div>`
        : `
        <div class="p-8 text-center text-slate-500 rounded-xl border border-dashed border-slate-300 bg-slate-50 col-span-3">
          <i data-lucide="search-x" class="w-10 h-10 mx-auto mb-2 text-slate-400"></i>
          <h4 class="font-bold text-slate-700">No bank matches your profile yet</h4>
          <p class="text-sm">Try widening the loan amount, tenure, or income so a bank's eligibility criteria match your data.</p>
        </div>`;
      containers.forEach(c => { c.innerHTML = emptyHTML; });
      safeIcons();
      return;
    }

    const monthly = Math.round(appState.annualIncome / 12);
    const cardHTML = recommendations.map((o, idx) => {
      const emi = this.calcEMI(appState.loanAmount, o.interestRate, appState.loanTenureYears);
      const isSaved = appState.savedOffers.some(s => s.id === o.id);
      const notes = [];
      if (appState.creditScore < o.minCreditScore) {
        notes.push(`credit score ${appState.creditScore} is below ${o.minCreditScore}+ suggested`);
      }
      if (monthly < o.minMonthly) {
        notes.push(`income of ₹${monthly.toLocaleString('en-IN')}/mo is below the ₹${o.minMonthly.toLocaleString('en-IN')} needed`);
      }
      const note = notes.length
        ? `<i data-lucide="info" class="w-3.5 h-3.5 align-middle"></i> Review: ${notes.join('; ')}.`
        : `<i data-lucide="badge-check" class="w-3.5 h-3.5 align-middle"></i> Strong match — meets this bank's credit, income and employment criteria.`;

      return `
        <div class="recommend-card ${idx === 0 ? 'recommend-top' : ''}">
          <div class="recommend-head">
            <div class="bank-profile">
              <div class="bank-logo-sq">${o.shortCode}</div>
              <div>
                <div class="bank-name-large" style="font-size:1.05rem">${o.bankName}</div>
                <div class="loan-category-label">${o.loanType} &bull; ${o.tag}</div>
              </div>
            </div>
            <span class="match-badge ${idx === 0 ? '' : 'badge-blue'}">
              ${idx === 0 ? '★ ' : ''}${o.matchScore}% Match
            </span>
          </div>

          <div class="recommend-rate-row">
            <div>
              <div class="mini-stat-label">Interest Rate</div>
              <div class="recommend-rate">${o.interestRate}<span>% p.a.</span></div>
            </div>
            <div class="text-right">
              <div class="mini-stat-label">Est. EMI</div>
              <div class="font-bold text-slate-800">₹${emi.toLocaleString('en-IN')}/mo</div>
            </div>
          </div>

          <div class="recommend-meta">
            <span>Fee <strong>${o.processingFeePercent}%</strong></span>
            <span>Tenure <strong>${o.maxTenure} Yr</strong></span>
            <span>Max <strong>₹${(o.maxAmount / 10000000).toFixed(1)} Cr</strong></span>
          </div>

          <div class="recommend-note">${note}</div>

          <div class="recommend-actions">
            <button class="btn btn-outline btn-sm flex-1" onclick="app.viewBankDetails('${o.id}')">
              <i data-lucide="file-text"></i> Details &amp; Docs
            </button>
            <button class="btn btn-secondary btn-sm" title="Save Offer" onclick="app.toggleSaveOffer('${o.id}')">
              <i data-lucide="${isSaved ? 'bookmark-check' : 'bookmark'}" class="${isSaved ? 'text-blue-600' : ''}"></i>
            </button>
            <button class="btn btn-primary btn-sm" onclick="app.navigateToBranchLocator('${o.bankName}')">
              <i data-lucide="map-pin"></i> Branches
            </button>
          </div>
        </div>
      `;
    }).join('');

    containers.forEach(c => { c.innerHTML = cardHTML; });
    safeIcons();
  },

  renderBestOfferCard(offer) {
    const container = document.getElementById('best-offer-hero');
    if (!container) return;

    if (!offer) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-500 rounded-xl border border-dashed border-slate-300 bg-slate-50">
          <i data-lucide="clock" class="w-10 h-10 mx-auto mb-2 text-slate-400"></i>
          <h4 class="font-bold text-slate-700">This loan category is coming soon</h4>
          <p class="text-sm">We only publish rates verified against a bank's own source. Choose Home Loan or Personal Loan to see live offers.</p>
        </div>
      `;
      return;
    }

    const emi = this.calcEMI(appState.loanAmount, offer.interestRate, appState.loanTenureYears);

    const cardHTML = `
      <div class="best-offer-card">
        <div class="best-offer-ribbon">
          <i data-lucide="award" class="w-3.5 h-3.5"></i> Best Match: Lowest Rate
        </div>
        <div class="best-offer-content">
          <div class="bank-profile">
            <div class="bank-logo-sq">${offer.shortCode}</div>
            <div>
              <div class="bank-name-large">${offer.bankName}</div>
              <div class="loan-category-label">${offer.loanType} &bull; ${offer.tag}</div>
            </div>
          </div>

          <div class="offer-rate-highlight">
            <div class="rate-val">${offer.interestRate}% <span class="text-sm font-normal text-slate-500">p.a.</span></div>
            <div class="rate-label">Advertised Starting Rate</div>
          </div>

          <div class="offer-stats-row">
            <div class="mini-stat">
              <div class="mini-stat-label">Estimated EMI</div>
              <div class="mini-stat-val text-blue-600">₹${emi.toLocaleString('en-IN')}/mo</div>
            </div>
            <div class="mini-stat">
              <div class="mini-stat-label">Processing Fee</div>
              <div class="mini-stat-val">${this.processingFeeLabel(offer)}</div>
            </div>
            <div class="mini-stat">
              <div class="mini-stat-label">Max Tenure</div>
              <div class="mini-stat-val">${offer.maxTenure} Years</div>
            </div>
          </div>

          <div class="offer-actions">
            <button class="btn btn-outline btn-sm" onclick="app.viewBankDetails('${offer.id}')">
              <i data-lucide="file-text"></i> View Details & Docs
            </button>
            <button class="btn btn-primary" onclick="app.navigateToBranchLocator('${offer.bankName}')">
              <i data-lucide="map-pin"></i> Find Branches
            </button>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = cardHTML;
    safeIcons();
  },

  renderComparisonList(offers) {
    const container = document.getElementById('comparison-list-container');
    if (!container) return;

    if (offers.length === 0) {
      const names = appState.selectedLoans
        .map(id => (LOAN_TYPES.find(l => l.id === id) || {}).name)
        .filter(Boolean);
      const label = names.length ? names.join(' / ') : 'the selected loan type';
      const live = LOAN_TYPES.filter(l => !l.comingSoon).map(l => l.name).join(' and ');
      container.innerHTML = `
        <div class="p-8 text-center text-slate-500 rounded-xl border border-dashed border-slate-300 bg-slate-50 col-span-2">
          <i data-lucide="clock" class="w-10 h-10 mx-auto mb-2 text-slate-400"></i>
          <h4 class="font-bold text-slate-700">${label} offers are coming soon</h4>
          <p class="text-sm">We only publish rates we have verified against a bank's own source, so this category is not listed yet.</p>
          <p class="text-sm mt-1">Live offers are available for <strong>${live}</strong>.</p>
        </div>
      `;
      safeIcons();
      return;
    }

    // Skip the first pinned offer or show all
    container.innerHTML = offers.map((offer, idx) => {
      const emi = this.calcEMI(appState.loanAmount, offer.interestRate, appState.loanTenureYears);
      const isSaved = appState.savedOffers.some(o => o.id === offer.id);

      return `
        <div class="bank-card">
          <div class="bank-card-header">
            <div class="bank-info">
              <div class="bank-logo-sm">${offer.shortCode}</div>
              <div>
                <h4 class="font-bold text-slate-900">${offer.bankName}</h4>
                <div class="text-xs text-slate-500">${offer.loanType}</div>
              </div>
            </div>
            <span class="tag-pill ${idx === 0 ? 'tag-pill-success' : 'tag-pill-blue'}">
              ${idx === 0 ? '★ Lowest Rate' : offer.badge}
            </span>
          </div>

          <div class="bank-card-body">
            <div class="rate-banner">
              <div>
                <span class="text-xs text-slate-500 font-medium">Interest Rate</span>
                <div class="main-rate ${idx === 0 ? 'text-emerald-600' : ''}">${offer.interestRate}% <span class="text-xs font-normal">p.a.</span></div>
              </div>
              <div class="text-right">
                <span class="text-xs text-slate-500 font-medium">Monthly EMI</span>
                <div class="font-bold text-slate-800 text-sm">₹${emi.toLocaleString('en-IN')}</div>
              </div>
            </div>

            <div class="card-metrics-grid">
              <div>
                <div class="text-xs text-slate-400">Processing Fee</div>
                <div class="text-xs font-semibold text-slate-700">${this.processingFeeLabel(offer)}</div>
              </div>
              <div>
                <div class="text-xs text-slate-400">Max Tenure</div>
                <div class="text-xs font-semibold text-slate-700">${offer.maxTenure} Yrs</div>
              </div>
              <div>
                <div class="text-xs text-slate-400">Max Loan</div>
                <div class="text-xs font-semibold text-slate-700">₹${(offer.maxAmount / 10000000).toFixed(1)} Cr</div>
              </div>
            </div>
          </div>

          <div class="bank-card-footer">
            <button class="btn btn-outline btn-sm flex-1" onclick="app.viewBankDetails('${offer.id}')">
              Details &amp; Docs
            </button>
            <button class="btn btn-secondary btn-sm" title="Save Offer" onclick="app.toggleSaveOffer('${offer.id}')">
              <i data-lucide="${isSaved ? 'bookmark-check' : 'bookmark'}" class="${isSaved ? 'text-blue-600' : ''}"></i>
            </button>
            <button class="btn btn-primary btn-sm" onclick="app.navigateToBranchLocator('${offer.bankName}')" title="Locate City Branch">
              <i data-lucide="map-pin"></i> Branches
            </button>
          </div>
        </div>
      `;
    }).join('');

    safeIcons();
  },

  handleSortChange(criteria) {
    let sorted = [...BANK_OFFERS].filter(o => appState.selectedLoans.includes(o.loanTypeId));

    if (criteria === 'rate-asc') {
      sorted.sort((a, b) => a.interestRate - b.interestRate);
    } else if (criteria === 'emi-asc') {
      sorted.sort((a, b) => this.calcEMI(appState.loanAmount, a.interestRate, appState.loanTenureYears) - this.calcEMI(appState.loanAmount, b.interestRate, appState.loanTenureYears));
    } else if (criteria === 'fee-asc') {
      sorted.sort((a, b) => a.processingFeePercent - b.processingFeePercent);
    } else if (criteria === 'amount-desc') {
      sorted.sort((a, b) => b.maxAmount - a.maxAmount);
    }

    this.renderComparisonList(sorted);
  },

  // 4. View Bank Details & Documents
  viewBankDetails(bankId) {
    const offer = BANK_OFFERS.find(b => b.id === bankId) || BANK_OFFERS[0];
    appState.activeBankDetails = offer;

    // Populate header card
    const logo = document.getElementById('detail-bank-logo');
    const name = document.getElementById('detail-bank-name');
    const category = document.getElementById('detail-loan-category');
    const rate = document.getElementById('detail-rate');
    const fee = document.getElementById('detail-fee');
    const tenure = document.getElementById('detail-tenure');
    const amount = document.getElementById('detail-amount');

    if (logo) logo.textContent = offer.shortCode;
    if (name) name.textContent = offer.bankName;
    if (category) category.textContent = `${offer.loanType} • Floating Scheme`;
    if (rate) rate.textContent = `${offer.interestRate}% p.a.`;
    if (fee) fee.textContent = `${offer.processingFeePercent}%`;
    if (tenure) tenure.textContent = `${offer.maxTenure} Years`;
    if (amount) amount.textContent = `₹${(offer.maxAmount / 10000000).toFixed(2)} Cr`;

    this.renderBankOverviewTab(offer);
    this.renderBankEligibilityTab(offer);

    // Populate the "Browse another bank" switcher with matching offers
    const switcher = document.getElementById('bank-detail-switch');
    if (switcher) {
      const candidates = BANK_OFFERS
        .filter(b => appState.selectedLoans.includes(b.loanTypeId) || b.id === offer.id)
        .sort((a, b) => a.interestRate - b.interestRate);
      const opts = candidates.map(b =>
        `<option value="${b.id}" ${b.id === offer.id ? 'selected' : ''}>${b.bankName} • ${b.loanType} • ${b.interestRate}% p.a.</option>`
      ).join('');
      switcher.innerHTML = '<option value="">Browse another bank...</option>' + opts;
    }

    this.navigateTo('documents');
    this.renderHiddenCharges();
  },

  // Overview tab copy is rendered from the selected offer's own catalogue
  // fields, so switching banks never leaves another bank's wording on screen.
  renderBankOverviewTab(offer) {
    const summary = document.getElementById('detail-overview-summary');
    const foreclosure = document.getElementById('detail-foreclosure');
    const fee = document.getElementById('detail-processing-fee');
    if (!offer) return;

    if (summary) {
      summary.textContent = `${offer.bankName} lists this ${offer.loanType} at an advertised starting rate of ${offer.interestRate}% p.a. for amounts up to ₹${(offer.maxAmount / 10000000).toFixed(2)} Cr over up to ${offer.maxTenure} years. ${offer.tag}.`;
    }
    if (foreclosure) foreclosure.textContent = offer.otherCharges || 'Not disclosed in this catalogue.';
    if (fee) fee.textContent = this.processingFeeLabel(offer);
  },

  // Eligibility tab lists the actual published thresholds for this offer.
  renderBankEligibilityTab(offer) {
    const list = document.getElementById('detail-eligibility-list');
    const source = document.getElementById('detail-eligibility-source');
    if (!list || !offer) return;

    const employmentLabels = {
      'salaried': 'Salaried (Corporate / Govt)',
      'self-employed-professional': 'Self-Employed Professional',
      'business-owner': 'Business Owner / Entrepreneur'
    };
    const employment = (offer.allowedEmployment || []).map(e => employmentLabels[e] || e);
    const userMonthly = Math.round((appState.annualIncome || 0) / 12);
    const meetsIncome = userMonthly >= offer.minMonthly;
    const meetsCredit = (appState.creditScore || 0) >= offer.minCreditScore;

    const rows = [
      { ok: true, text: `Minimum credit score: ${offer.minCreditScore}+${meetsCredit ? ` — your ${appState.creditScore} clears this.` : ` — your ${appState.creditScore} does not clear this yet.`}` },
      { ok: true, text: `Minimum monthly net income: ₹${offer.minMonthly.toLocaleString('en-IN')}${meetsIncome ? ` — your ₹${userMonthly.toLocaleString('en-IN')}/mo clears this.` : ` — your ₹${userMonthly.toLocaleString('en-IN')}/mo is below this.`}` },
      { ok: true, text: `Accepted employment: ${employment.join(', ')}.` },
      { ok: true, text: `Maximum loan amount: ₹${(offer.maxAmount / 10000000).toFixed(2)} Cr.` },
      { ok: true, text: `Maximum tenure: ${offer.maxTenure} years.` },
      { ok: true, text: `Stated criterion: ${offer.eligibility}.` }
    ];

    list.innerHTML = rows.map(r => `
      <li>
        <i data-lucide="${r.ok ? 'check' : 'alert-circle'}" class="${r.ok ? 'text-emerald-500' : 'text-amber-500'}"></i> ${r.text}
      </li>`).join('');

    if (source) {
      source.textContent = `Published criteria for ${offer.bankName} · ${offer.loanType} · ${offer.interestRate}% p.a. Advertised starting rate, last updated ${offer.lastUpdated.toLowerCase()}.`;
    }
    safeIcons();
  },

  renderHiddenCharges() {
    const offer = appState.activeBankDetails;
    const container = document.getElementById('hidden-charges-items');
    const summary = document.getElementById('hidden-charges-summary');
    if (!container) return;

    const items = (offer && HIDDEN_CHARGES[offer.id]) || [];
    if (items.length === 0) {
      container.innerHTML = `
        <div class="p-6 text-center text-slate-500 rounded-xl border border-dashed border-slate-300 bg-slate-50">
          <i data-lucide="shield-check" class="w-8 h-8 mx-auto mb-2 text-slate-400"></i>
          <h4 class="font-bold text-slate-700">No hidden charges disclosed</h4>
          <p class="text-sm">This lender has not listed any additional fees beyond the advertised rate.</p>
        </div>
      `;
      safeIcons();
      return;
    }

    // Estimate the one-time, up-front hidden charges a typical borrower would pay,
    // so the user can see the REAL total cost including hidden fees.
    const loanAmount = appState.loanAmount || 0;
    const rate = offer.interestRate || 0;
    const years = appState.loanTenureYears || 1;
    const upFrontEstimate = items.reduce((sum, it) => {
      if (it.informational) return sum;
      if (it.feePercent) {
        // Stamp duty / registation is a % of the loan; most penal & foreclosure
        // charges are conditional, so we estimate the guaranteed up-front % costs.
        if (it.name && /Stamp|Registration/i.test(it.name)) {
          return sum + loanAmount * (it.fee / 100);
        }
        return sum;
      }
      return sum + it.fee;
    }, 0);

    const emi = loanAmount > 0 ? this.calcEMI(loanAmount, rate, years) : 0;
    const totalInterest = loanAmount > 0 ? (emi * years * 12) - loanAmount : 0;
    const processingFee = loanAmount > 0 ? Math.min(offer.processingFeeMax || 0, loanAmount * (offer.processingFeePercent / 100)) : 0;
    const totalBorrowing = loanAmount + totalInterest;
    const grandTotal = totalBorrowing + processingFee + upFrontEstimate;

    const money = n => '₹' + Math.round(n).toLocaleString('en-IN');

    container.innerHTML = items.map(item => `
      <div class="hidden-charge-item">
        <div class="hidden-charge-icon">
          <i data-lucide="${item.icon}" class="w-5 h-5"></i>
        </div>
        <div class="hidden-charge-body">
          <h4>${item.name} ${item.informational ? '<span class="hidden-charge-note">(informational)</span>' : ''}</h4>
          <p>${item.desc}</p>
        </div>
        <div class="hidden-charge-amount">${item.amount}</div>
      </div>
    `).join('');

    if (summary) {
      summary.innerHTML = `
        <div class="hidden-charge-summary">
          <div class="hc-summary-head">
            <h4><i data-lucide="calculator" class="w-4 h-4"></i> Your Real Loan Cost (including hidden charges)</h4>
            <p class="hc-summary-sub">Estimate based on your loan amount of ${money(loanAmount)} at ${rate}% p.a. over ${years} years.</p>
          </div>
          <div class="hc-summary-grid">
            <div class="hc-summary-row"><span>Loan Principal</span><strong>${money(loanAmount)}</strong></div>
            <div class="hc-summary-row"><span>Total Interest (${years} yrs)</span><strong>${money(totalInterest)}</strong></div>
            <div class="hc-summary-row"><span>Processing Fee (${offer.processingFeePercent}%, max ${money(offer.processingFeeMax || 0)})</span><strong>${money(processingFee)}</strong></div>
            <div class="hc-summary-row hc-estimate"><span>Est. Up-front Hidden Charges</span><strong>${money(upFrontEstimate)}</strong></div>
            <div class="hc-summary-row hc-total"><span>Total You Pay (incl. hidden)</span><strong>${money(grandTotal)}</strong></div>
          </div>
          <p class="hc-disclaimer">* Estimate for guaranteed up-front costs only. Conditional fees (late payment, prepayment, EMI bounce) are excluded and vary by usage. Final figures depend on the sanctioned amount and state registration duties.</p>
        </div>
      `;
    }
    safeIcons();
  },

  // Go back to the All Offers comparison on the dashboard
  backToOffers() {
    this.navigateTo('dashboard');
  },

  // From the branch locator, return to the Bank Details & Docs page for the same bank
  backToBankDetails() {
    const bankName = (document.getElementById('branch-bank-select') || {}).value;
    const offer = BANK_OFFERS.find(o => o.bankName === bankName);
    if (appState.activeBankDetails && appState.activeBankDetails.bankName === bankName) {
      this.navigateTo('documents');
      return;
    }
    if (offer) {
      this.viewBankDetails(offer.id);
      return;
    }
    this.navigateTo('dashboard');
  },

  // Jump straight to another bank's details from the switcher dropdown
  switchBankDetails(bankId) {
    if (!bankId) return;
    const switcher = document.getElementById('bank-detail-switch');
    if (switcher) switcher.value = '';
    this.viewBankDetails(bankId);
  },

  renderDocumentChecklist() {
    const container = document.getElementById('doc-checklist-container');
    if (!container) return;

    // Update DigiLocker UI state
    this.updateDigiLockerUI();

    container.innerHTML = DOCUMENTS_DATA.map((doc, idx) => {
      let statusBadge = '';
      if (doc.status === 'verified') {
        statusBadge = `<span class="doc-status-badge doc-status-verified"><i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> Ready</span>`;
      } else if (doc.status === 'pending') {
        statusBadge = `<span class="doc-status-badge doc-status-pending"><i data-lucide="clock" class="w-3.5 h-3.5"></i> In Review</span>`;
      } else {
        statusBadge = `<span class="doc-status-badge doc-status-missing"><i data-lucide="alert-circle" class="w-3.5 h-3.5"></i> Required</span>`;
      }

      // Check if this doc category was imported via DigiLocker
      const digilockerImported = appState.digilockerImported.some(d => d.mapsTo === doc.category);
      const importedBadge = digilockerImported
        ? `<span class="digilocker-imported-badge"><svg viewBox="0 0 24 24" width="12" height="12" fill="none"><rect width="24" height="24" rx="4" fill="#1E40AF"/><path d="M6 8.5C6 7.67 6.67 7 7.5 7h9c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5h-9C6.67 17 6 16.33 6 15.5v-7zM8 10h8v1H8v-1zm0 3h6v1H8v-1z" fill="#fff"/></svg> DigiLocker</span>`
        : '';

      return `
        <div class="doc-item-row">
          <div class="doc-main-info">
            <div class="doc-icon-badge">
              <i data-lucide="${doc.icon}" class="w-5 h-5"></i>
            </div>
            <div>
              <div class="doc-title">${doc.title} ${importedBadge}</div>
              <div class="doc-desc">${doc.desc}</div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            ${statusBadge}
            <label class="btn btn-outline btn-sm" style="cursor:pointer;">
              <i data-lucide="upload" class="w-3.5 h-3.5"></i> Upload
              <input type="file" accept="image/*,.pdf" style="display:none" onchange="app.handleManualUpload('${doc.category}', this.files)">
            </label>
          </div>
        </div>
      `;
    }).join('');

    safeIcons();
  },

  // Generates a real PDF in the browser with the vendored pdf-lib build.
  // Falls back to a printable HTML export if pdf-lib failed to load.
  async downloadDocChecklist() {
    const offer = appState.activeBankDetails;
    const bankName = offer ? offer.bankName : 'the selected bank';
    const loanType = offer
      ? offer.loanType
      : ((LOAN_TYPES.find(l => l.id === appState.selectedLoans[0]) || {}).name || 'Loan');

    if (typeof window.PDFLib === 'undefined' || !window.PDFLib.PDFDocument) {
      this.downloadDocChecklistHtml();
      return;
    }

    const emi = offer ? this.calcEMI(appState.loanAmount, offer.interestRate, appState.loanTenureYears) : 0;
    const statusLabel = { verified: 'Ready', pending: 'Action needed', missing: 'Optional' };
    const inr = n => 'Rs. ' + Math.round(n).toLocaleString('en-IN');

    try {
      toast('Building your checklist PDF...');
      const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
      const doc = await PDFDocument.create();
      const regular = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);

      const NAVY = rgb(0.059, 0.090, 0.165);
      const SLATE = rgb(0.275, 0.318, 0.380);
      const LINE = rgb(0.886, 0.910, 0.941);
      const HEAD_BG = rgb(0.945, 0.961, 0.973);
      const GREEN = rgb(0.016, 0.373, 0.290);
      const BLUE = rgb(0.145, 0.388, 0.922);
      const WHITE = rgb(1, 1, 1);

      const PAGE_W = 595.28;
      const PAGE_H = 841.89;
      const M = 48;
      const CONTENT_W = PAGE_W - M * 2;

      // Status pill colour per checklist state. Plain triples, because pdf-lib's
      // Color object does not expose its channels for tinting.
      const STATUS_RGB = {
        verified: { r: 0.016, g: 0.373, b: 0.290 },
        pending: { r: 0.851, g: 0.549, b: 0.043 },
        missing: { r: 0.275, g: 0.318, b: 0.380 }
      };
      const statusRgb = s => STATUS_RGB[s] || STATUS_RGB.missing;
      const tint = c => rgb(c.r + (1 - c.r) * 0.88, c.g + (1 - c.g) * 0.88, c.b + (1 - c.b) * 0.88);

      const pages = [];
      let page, y;
      const newPage = () => {
        page = doc.addPage([PAGE_W, PAGE_H]);
        pages.push(page);
        y = PAGE_H - M;
      };
      newPage();

      // The standard-14 fonts are WinAnsi-encoded and cannot represent the
      // rupee sign (U+20B9) or other non-Latin1 characters, so every string is
      // transliterated before it reaches drawText.
      const pdfSafe = this.pdfSafeText;

      // Single entry point for all PDF text so sanitising can never be skipped.
      const draw = (str, opts) => {
        const o = opts || {};
        page.drawText(pdfSafe(str), {
          x: o.x != null ? o.x : M,
          y: o.y != null ? o.y : y,
          size: o.size || 10,
          font: o.bold ? bold : regular,
          color: o.color || NAVY,
          maxWidth: o.maxWidth || CONTENT_W,
        });
      };

      const text = (str, opts = {}) => draw(str, Object.assign({}, opts, { y: opts.y != null ? opts.y : y }));
      const ensure = h => { if (y - h < M + 24) newPage(); };
      const rule = () => {
        page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 0.7, color: LINE });
        y -= 12;
      };

      // ---- Header ----
      page.drawRectangle({ x: 0, y: PAGE_H - 92, width: PAGE_W, height: 92, color: NAVY });
      draw('LoanFinder', { x: M, y: PAGE_H - 40, size: 17, bold: true, color: WHITE });
      draw('Document Checklist', { x: M, y: PAGE_H - 60, size: 12, color: rgb(0.580, 0.639, 0.722) });
      draw(new Date().toLocaleDateString('en-IN'), {
        x: PAGE_W - M - 100, y: PAGE_H - 58, size: 10, color: rgb(0.580, 0.639, 0.722),
      });
      y = PAGE_H - 118;

      // ---- Offer summary (only when an offer is active) ----
      if (offer) {
        const meta = [
          ['Bank', offer.bankName, 'Loan type', offer.loanType],
          ['Interest rate', `${offer.interestRate}% p.a. (advertised)`, 'Processing fee', this.processingFeeLabel(offer)],
          ['Requested amount', inr(appState.loanAmount), 'Tenure', `${appState.loanTenureYears} years`],
          ['Estimated EMI', `${inr(emi)} / month`, 'Max tenure', `${offer.maxTenure} years`]
        ];
        const rowH = 17;
        const boxH = meta.length * rowH + 26;
        page.drawRectangle({ x: M, y: y - boxH + rowH + 6, width: CONTENT_W, height: boxH, color: HEAD_BG, borderColor: LINE, borderWidth: 0.7 });
        y -= 12;
        meta.forEach(([k1, v1, k2, v2]) => {
          draw(k1, { x: M + 10, y, size: 8, bold: true, color: SLATE });
          draw(v1, { x: M + 10 + 78, y, size: 9, color: NAVY });
          draw(k2, { x: M + 258, y, size: 8, bold: true, color: SLATE });
          draw(v2, { x: M + 258 + 74, y, size: 9, color: NAVY });
          y -= rowH;
        });
        y -= 6;
        text('Typical documents required', { size: 13, bold: true });
        y -= 6;
      } else {
        text('Typical documents required', { size: 13, bold: true });
        y -= 4;
        text('Select a loan category on the dashboard to include loan-specific details.', { size: 9, color: SLATE });
        y -= 6;
      }

      // ---- Table header ----
      const COLS = { doc: M + 10, cat: M + 250, st: M + 372 };
      const drawHead = () => {
        page.drawRectangle({ x: M, y: y - 4, width: CONTENT_W, height: 16, color: HEAD_BG });
        draw('DOCUMENT', { x: COLS.doc, y, size: 7.5, bold: true, color: SLATE });
        draw('CATEGORY', { x: COLS.cat, y, size: 7.5, bold: true, color: SLATE });
        draw('STATUS', { x: COLS.st, y, size: 7.5, bold: true, color: SLATE });
        y -= 22;
      };
      drawHead();

      // ---- Rows ----
      DOCUMENTS_DATA.forEach(d => {
        const descLines = this.pdfWrap(d.desc, regular, 8, 236);
        const rowH = 14 + descLines.length * 10 + 8;
        ensure(rowH + 8);

        draw(d.title, { x: COLS.doc, y, size: 9.5, bold: true, color: NAVY, maxWidth: 236 });
        y -= 11;
        descLines.forEach(line => {
          draw(line, { x: COLS.doc, y, size: 8, color: SLATE, maxWidth: 236 });
          y -= 10;
        });
        y -= 2;

        // Category (wrap if needed)
        const catLines = this.pdfWrap(d.category, regular, 8, 110);
        let cy = y + 10;
        catLines.forEach(line => {
          draw(line, { x: COLS.cat, y: cy, size: 8, color: SLATE, maxWidth: 110 });
          cy -= 10;
        });

        // Status pill
        const label = statusLabel[d.status] || d.status;
        const c = statusRgb(d.status);
        const pw = label.length * 4.6 + 14;
        page.drawRectangle({ x: COLS.st, y: y + 2, width: pw, height: 12, color: tint(c), borderColor: rgb(c.r, c.g, c.b), borderWidth: 0.6 });
        draw(label, { x: COLS.st + 7, y: y + 5, size: 7.5, bold: true, color: rgb(c.r, c.g, c.b) });

        y -= 4;
        page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 0.5, color: LINE });
        y -= 8;
      });

      // ---- Footer note on every page ----
      pages.forEach((p, i) => {
        p.drawLine({ start: { x: M, y: M + 18 }, end: { x: PAGE_W - M, y: M + 18 }, thickness: 0.7, color: LINE });
        const savedPage = page;
        page = p;
        draw(`Requirements differ per bank and product. Confirm the final list with ${bankName} before applying.`, {
          x: M, y: M + 6, size: 7.5, color: SLATE, maxWidth: CONTENT_W - 60,
        });
        draw(`Page ${i + 1} of ${pages.length}`, {
          x: PAGE_W - M - 46, y: M + 6, size: 7.5, color: SLATE,
        });
        page = savedPage;
      });

      const bytes = await doc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `LoanFinder-Checklist-${(bankName || 'loan').replace(/[^a-z0-9]+/gi, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('Checklist PDF downloaded (' + link.download + ')', 'success');
    } catch (e) {
      console.error('PDF generation failed:', e);
      toast('PDF generation failed (' + e.message + '). Downloading a printable file instead.', 'error');
      this.downloadDocChecklistHtml();
    }
  },

  // Transliterate text into the WinAnsi range the standard-14 PDF fonts
  // support. Without this, a single rupee sign (U+20B9) anywhere in the source
  // data makes pdf-lib throw instead of drawing.
  pdfSafeText(s) {
    return String(s == null ? '' : s)
      .replace(/₹/g, 'Rs. ')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...')
      .replace(/•/g, '-')
      .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');
  },

  // Greedy word-wrap helper for the PDF text layout.
  pdfWrap(str, font, size, maxWidth) {
    const words = this.pdfSafeText(str).split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach(w => {
      const test = line ? line + ' ' + w : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    return lines;
  },

  // Fallback: a self-contained printable HTML file, used only if pdf-lib is unavailable.
  downloadDocChecklistHtml() {
    const offer = appState.activeBankDetails;
    const bankName = offer ? offer.bankName : 'the selected bank';
    const loanType = offer
      ? offer.loanType
      : ((LOAN_TYPES.find(l => l.id === appState.selectedLoans[0]) || {}).name || 'Loan');
    const emi = offer ? this.calcEMI(appState.loanAmount, offer.interestRate, appState.loanTenureYears) : 0;
    const statusLabel = { verified: 'Ready', pending: 'Action needed', missing: 'Optional' };

    const rows = DOCUMENTS_DATA.map(d => `
      <tr>
        <td><strong>${d.title}</strong><br><span class="muted">${d.desc}</span></td>
        <td>${d.category}</td>
        <td>${statusLabel[d.status] || d.status}</td>
      </tr>`).join('');

    const summary = offer
      ? `<table class="meta">
           <tr><th>Bank</th><td>${bankName}</td><th>Loan type</th><td>${loanType}</td></tr>
           <tr><th>Interest rate</th><td>${offer.interestRate}% p.a. (advertised)</td><th>Processing fee</th><td>${this.processingFeeLabel(offer)}</td></tr>
           <tr><th>Requested amount</th><td>&#8377;${appState.loanAmount.toLocaleString('en-IN')}</td><th>Tenure</th><td>${appState.loanTenureYears} years</td></tr>
           <tr><th>Estimated EMI</th><td>&#8377;${emi.toLocaleString('en-IN')} / month</td><th>Generated</th><td>${new Date().toLocaleDateString('en-IN')}</td></tr>
         </table>`
      : '<p>Select a loan category on the dashboard to include loan-specific details.</p>';

    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>LoanFinder &mdash; Document Checklist</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 40px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  p.sub { color: #64748b; margin: 0 0 24px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; vertical-align: top; font-size: 13px; }
  thead th, .meta th { background: #f1f5f9; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  .muted { color: #64748b; font-size: 12px; }
  .note { font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  @media print { body { margin: 0; } }
</style></head><body>
  <h1>Document Checklist</h1>
  <p class="sub">Prepared by LoanFinder (prototype). Print this page or use your browser's "Save as PDF".</p>
  ${summary}
  <table>
    <thead><tr><th>Document</th><th>Category</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="note">Requirements differ per bank and product. Confirm the final list with ${bankName} before applying.</p>
</body></html>`;

    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'LoanFinder-Document-Checklist.html';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast('Checklist downloaded. Open the file and choose Print > Save as PDF.');
    } catch (e) {
      toast('Could not build the checklist file: ' + e.message, 'error');
    }
  },

  // ==================== DIGILOCKER INTEGRATION ====================

  connectDigiLocker() {
    const modal = document.getElementById('digilocker-modal');
    if (modal) modal.classList.remove('hidden');
    this.showDigiLockerStep('login');
    // Reset aadhaar input
    const aadhaarInput = document.getElementById('digilocker-aadhaar');
    if (aadhaarInput) aadhaarInput.value = '';
    const sendBtn = document.getElementById('digilocker-send-otp-btn');
    if (sendBtn) sendBtn.disabled = true;
  },

  closeDigiLockerModal() {
    const modal = document.getElementById('digilocker-modal');
    if (modal) modal.classList.add('hidden');
    // Reset all steps
    document.querySelectorAll('.digilocker-step').forEach(s => s.classList.add('hidden'));
  },

  showDigiLockerStep(step) {
    document.querySelectorAll('.digilocker-step').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById('digilocker-step-' + step);
    if (target) target.classList.remove('hidden');
  },

  formatAadhaar(input) {
    let val = input.value.replace(/\D/g, '').substring(0, 12);
    let formatted = val.replace(/(\d{4})(?=\d)/g, '$1 ');
    input.value = formatted;
    const sendBtn = document.getElementById('digilocker-send-otp-btn');
    if (sendBtn) sendBtn.disabled = val.length !== 12;
  },

  sendDigiLockerOTP() {
    const aadhaarInput = document.getElementById('digilocker-aadhaar');
    const aadhaar = aadhaarInput ? aadhaarInput.value.replace(/\s/g, '') : '';
    if (aadhaar.length !== 12) {
      toast('Please enter a valid 12-digit Aadhaar number', 'error');
      return;
    }
    appState.digilockerAadhaar = aadhaar;

    // Show OTP step
    const sendBtn = document.getElementById('digilocker-send-otp-btn');
    if (sendBtn) sendBtn.disabled = true;

    // DigiLocker sends the OTP to the mobile registered against the Aadhaar;
    // this prototype has no DigiLocker connection, so no number is invented here.
    const mobileMask = document.getElementById('digilocker-mobile-mask');
    if (mobileMask) mobileMask.textContent = 'your registered mobile number';

    this.showDigiLockerStep('otp');

    // Focus first OTP input
    setTimeout(() => {
      const firstOtp = document.querySelector('#digilocker-otp-group .otp-input');
      if (firstOtp) firstOtp.focus();
    }, 300);

    // Reset OTP inputs
    document.querySelectorAll('#digilocker-otp-group .otp-input').forEach(inp => inp.value = '');
    const verifyBtn = document.getElementById('digilocker-verify-btn');
    if (verifyBtn) verifyBtn.disabled = true;

    // Be honest: no DigiLocker connection exists, so no OTP is generated or
    // delivered. The UI tells the user to type any 6 digits.
    if (mobileMask) mobileMask.textContent = 'registered mobile number';
    toast('No OTP was sent. This is a simulation - type any 6 digits to continue.', 'info');
  },

  handleOTPInput(input, index) {
    const val = input.value.replace(/\D/g, '');
    input.value = val.charAt(0) || '';

    if (val && index < 5) {
      const next = document.querySelector(`#digilocker-otp-group .otp-input[data-otp="${index + 1}"]`);
      if (next) next.focus();
    }

    // Check if all OTP fields are filled
    const allOtp = document.querySelectorAll('#digilocker-otp-group .otp-input');
    const otp = Array.from(allOtp).map(i => i.value).join('');
    const verifyBtn = document.getElementById('digilocker-verify-btn');
    if (verifyBtn) verifyBtn.disabled = otp.length !== 6;

    // Handle backspace
    if (!val && index > 0) {
      const prev = document.querySelector(`#digilocker-otp-group .otp-input[data-otp="${index - 1}"]`);
      if (prev) prev.focus();
    }
  },

  handleOTPKeydown(event, index) {
    if (event.key === 'Backspace') {
      const input = event.target;
      if (!input.value && index > 0) {
        event.preventDefault();
        const prev = document.querySelector(`#digilocker-otp-group .otp-input[data-otp="${index - 1}"]`);
        if (prev) {
          prev.focus();
          prev.value = '';
        }
        // Recheck verify button
        const allOtp = document.querySelectorAll('#digilocker-otp-group .otp-input');
        const otp = Array.from(allOtp).map(i => i.value).join('');
        const verifyBtn = document.getElementById('digilocker-verify-btn');
        if (verifyBtn) verifyBtn.disabled = otp.length !== 6;
      }
    }
  },

  verifyDigiLockerOTP() {
    const allOtp = document.querySelectorAll('#digilocker-otp-group .otp-input');
    const otp = Array.from(allOtp).map(i => i.value).join('');
    if (otp.length !== 6) {
      toast('Please enter the complete 6-digit OTP', 'error');
      return;
    }

    // Simulate OTP verification (any 6-digit code works)
    toast('Verifying OTP...', 'info');

    setTimeout(() => {
      // Move to fetching step
      this.showDigiLockerStep('fetching');
      this.simulateFetchingDigiLockerDocs();
    }, 800);
  },

  resendDigiLockerOTP() {
    const resendBtn = document.getElementById('digilocker-resend-btn');
    if (resendBtn) {
      resendBtn.disabled = true;
      let countdown = 30;
      resendBtn.textContent = `Resend in ${countdown}s`;
      const timer = setInterval(() => {
        countdown--;
        resendBtn.textContent = `Resend in ${countdown}s`;
        if (countdown <= 0) {
          clearInterval(timer);
          resendBtn.textContent = 'Resend OTP';
          resendBtn.disabled = false;
        }
      }, 1000);
    }
    toast('OTP resent to your mobile number', 'success');
  },

  simulateFetchingDigiLockerDocs() {
    // The progress list is generated from the catalogue so it can never drift
    // out of sync with the documents actually offered.
    const list = document.getElementById('digilocker-fetch-progress');
    if (list) {
      list.innerHTML = DIGILOCKER_DOCS.map((d, i) => `
        <div class="fetching-item ${i === 0 ? '' : 'pending'}">
          <i data-lucide="${i === 0 ? 'loader' : 'circle'}" class="w-4 h-4 ${i === 0 ? 'spin' : ''}"></i>
          <span>${d.name}</span>
          <span class="fetch-status">${i === 0 ? 'Fetching...' : 'Waiting...'}</span>
        </div>`).join('');
      safeIcons();
    }

    const items = document.querySelectorAll('#digilocker-fetch-progress .fetching-item');
    const docsToFetch = DIGILOCKER_DOCS.map(d => d.id);
    let delay = 600;

    items.forEach((item, i) => {
      // Reset item state
      item.className = i === 0 ? 'fetching-item' : 'fetching-item pending';
      const icon = item.querySelector('i');
      if (icon) icon.setAttribute('data-lucide', i === 0 ? 'loader' : 'circle');
      const status = item.querySelector('.fetch-status');
      if (status) status.textContent = i === 0 ? 'Fetching...' : 'Waiting...';
    });

    safeIcons();

    docsToFetch.forEach((docId, i) => {
      setTimeout(() => {
        items.forEach((item, j) => {
          if (j < i) {
            item.className = 'fetching-item done';
            const icon = item.querySelector('i');
            if (icon) icon.setAttribute('data-lucide', 'check-circle');
            const status = item.querySelector('.fetch-status');
            if (status) status.textContent = 'Found';
          } else if (j === i) {
            item.className = 'fetching-item';
            const icon = item.querySelector('i');
            if (icon) icon.setAttribute('data-lucide', 'loader');
            const status = item.querySelector('.fetch-status');
            if (status) status.textContent = 'Fetching...';
          }
        });
        safeIcons();
      }, delay * (i + 1));
    });

    // After all fetching done
    setTimeout(() => {
      items.forEach(item => {
        item.className = 'fetching-item done';
        const icon = item.querySelector('i');
        if (icon) icon.setAttribute('data-lucide', 'check-circle');
        const status = item.querySelector('.fetch-status');
        if (status) status.textContent = 'Found';
      });
      safeIcons();

      // Mark as connected
      appState.digilockerConnected = true;

      // Show selection step
      setTimeout(() => {
        this.showDigiLockerStep('select');
        this.renderDigiLockerDocList();
      }, 500);
    }, delay * (docsToFetch.length + 1));
  },

  renderDigiLockerDocList() {
    const container = document.getElementById('digilocker-doc-list');
    if (!container) return;

    // Build list: only docs that are not already imported
    const importedIds = appState.digilockerImported.map(d => d.id);
    const available = DIGILOCKER_DOCS.filter(d => !importedIds.includes(d.id));

    container.innerHTML = available.map(doc => {
      const isSelected = appState.digilockerDocs.includes(doc.id);
      return `
        <div class="digilocker-doc-item ${isSelected ? 'selected' : ''}" onclick="app.toggleDigiLockerDoc('${doc.id}', this)">
          <div class="digilocker-doc-checkbox">
            ${isSelected ? '<i data-lucide="check" class="w-3.5 h-3.5"></i>' : ''}
          </div>
          <div class="digilocker-doc-icon" style="background:${doc.iconBg};color:${doc.iconColor}">
            <i data-lucide="${doc.icon}" class="w-4 h-4"></i>
          </div>
          <div class="digilocker-doc-info">
            <div class="digilocker-doc-name">${doc.name}</div>
            <div class="digilocker-doc-meta">${doc.issuer} &bull; ${doc.docNumber}</div>
          </div>
          <span class="digilocker-doc-badge verified">Verified</span>
        </div>
      `;
    }).join('');

    if (available.length === 0) {
      container.innerHTML = '<div class="p-6 text-center text-slate-500 text-sm">All available documents have been imported.</div>';
    }

    this.updateDigiLockerImportBtn();
    safeIcons();
  },

  toggleDigiLockerDoc(docId, el) {
    const idx = appState.digilockerDocs.indexOf(docId);
    if (idx >= 0) {
      appState.digilockerDocs.splice(idx, 1);
      el.classList.remove('selected');
      el.querySelector('.digilocker-doc-checkbox').innerHTML = '';
    } else {
      appState.digilockerDocs.push(docId);
      el.classList.add('selected');
      el.querySelector('.digilocker-doc-checkbox').innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i>';
    }
    this.updateDigiLockerImportBtn();
    safeIcons();
  },

  updateDigiLockerImportBtn() {
    const count = appState.digilockerDocs.length;
    const countEl = document.getElementById('digilocker-selected-count');
    if (countEl) countEl.textContent = count;
    const importBtn = document.getElementById('digilocker-import-btn');
    if (importBtn) importBtn.disabled = count === 0;
  },

  importSelectedDigiLockerDocs() {
    const selectedIds = [...appState.digilockerDocs];
    if (selectedIds.length === 0) {
      toast('Please select at least one document to import', 'error');
      return;
    }

    const importedDocs = [];
    selectedIds.forEach(docId => {
      const doc = DIGILOCKER_DOCS.find(d => d.id === docId);
      if (doc && !appState.digilockerImported.find(d => d.id === docId)) {
        appState.digilockerImported.push(doc);
        importedDocs.push(doc);
      }
    });

    // Update DOCUMENTS_DATA statuses based on imported docs
    importedDocs.forEach(doc => {
      if (doc.mapsTo) {
        const match = DOCUMENTS_DATA.find(d => d.category === doc.mapsTo);
        if (match) {
          match.status = 'verified';
          match.tagText = 'Verified';
        }
      }
    });

    // Clear selection
    appState.digilockerDocs = [];

    // Show success step
    this.showDigiLockerStep('success');

    // Render imported summary
    const summaryEl = document.getElementById('digilocker-imported-summary');
    if (summaryEl) {
      summaryEl.innerHTML = importedDocs.map(doc => `
        <div class="imported-doc-row">
          <i data-lucide="check-circle-2" class="w-4 h-4"></i>
          <span class="font-semibold">${doc.name}</span>
          <span class="text-xs text-slate-500 ml-auto">${doc.docNumber}</span>
        </div>
      `).join('');
    }

    safeIcons();

    // Update banner and status
    this.updateDigiLockerUI();
    this.renderDocumentChecklist();

    toast(`${importedDocs.length} document(s) imported from DigiLocker!`, 'success');
  },

  updateDigiLockerUI() {
    const banner = document.getElementById('digilocker-banner');
    const status = document.getElementById('digilocker-status');
    const countEl = document.getElementById('digilocker-doc-count');

    if (appState.digilockerConnected) {
      if (banner) banner.style.display = 'none';
      if (status) status.style.display = 'block';
      if (countEl) countEl.textContent = `${appState.digilockerImported.length} document(s) imported`;
    } else {
      if (banner) banner.style.display = 'block';
      if (status) status.style.display = 'none';
    }
  },

  fetchDigiLockerDocs() {
    toast('Refreshing DigiLocker documents...', 'info');
    const modal = document.getElementById('digilocker-modal');
    if (modal) modal.classList.remove('hidden');
    this.showDigiLockerStep('select');
    this.renderDigiLockerDocList();
  },

  disconnectDigiLocker() {
    appState.digilockerConnected = false;
    appState.digilockerAadhaar = '';
    appState.digilockerDocs = [];
    appState.digilockerImported = [];
    this.updateDigiLockerUI();
    this.renderDocumentChecklist();
    toast('DigiLocker disconnected', 'info');
  },

  handleManualUpload(category, files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const match = DOCUMENTS_DATA.find(d => d.category === category);
    if (match) {
      match.status = 'verified';
      match.tagText = 'Verified';
    }
    this.renderDocumentChecklist();
    toast(`Uploaded "${file.name}" for ${category} successfully!`, 'success');
  },

  // 5. Bank Branch Locator with an interactive, Google-Maps-style map
  initMap() {
    const mapEl = document.getElementById('map-element');
    if (!mapEl || appState.mapEngine) return;
    // Prefer MapLibre (smooth vector tiles, rotate/pitch, Google-style controls).
    if (isMapLibreLoaded() && this.initMapLibreMap(mapEl)) return;
    // Fall back to Leaflet so the branch view still works if MapLibre fails.
    if (isLeafletLoaded()) this.initLeafletMap(mapEl);
  },

  // ---- MapLibre engine: the Google-Maps-style experience -------------------
  initMapLibreMap(mapEl) {
    try {
      const map = new maplibregl.Map({
        container: mapEl,
        style: this.mapStyleSpec(),
        center: [72.84, 18.96],
        zoom: 11,
        // Google-like feel: smooth frames, inertial zoom, rotate & pitch, keyboard.
        fadeDuration: 120,
        maxPitch: 60,
        dragRotate: true,
        attributionControl: false,
      });
      appState.mapGL = map;
      appState.mapEngine = 'maplibre';

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
      map.addControl(new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
      }), 'bottom-right');
      map.addControl(new maplibregl.AttributionControl({
        compact: true,
        customAttribution: '<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a>',
      }), 'bottom-left');

      // Same honest failure detection as the Leaflet path: vector tiles and the
      // style JSON are network assets, so "blank map" must never fail silently.
      let errors = 0;
      let loaded = false;
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        this.updateMapOfflineNotice(!loaded && errors > 0);
      };
      const timer = setTimeout(settle, 6000);
      map.on('error', () => {
        errors++;
        if (!settled && errors >= 3) { clearTimeout(timer); settle(); }
      });
      map.on('idle', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.updateMapOfflineNotice(errors > 0 && !loaded);
      });
      map.once('styledata', () => { loaded = true; });
      map.on('load', () => { loaded = true; });

      this.updateBranchListAndMarkers();
      return true;
    } catch (e) {
      console.warn('MapLibre failed to initialise, falling back to Leaflet:', e);
      appState.mapGL = null;
      appState.mapEngine = null;
      return false;
    }
  },

  // Single source of truth for the two basemaps, shared by init, switching and
  // retry. Street is a free vector style; satellite is raster imagery.
  mapStyleSpec() {
    if (appState.mapStyle === 'satellite') {
      return {
        version: 8,
        sources: {
          satellite: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
          },
        },
        layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
      };
    }
    return 'https://tiles.openfreemap.org/styles/positron';
  },

  // Google-Maps-style layer switcher: clean street map or satellite imagery.
  setMapStyle(kind) {
    const next = kind === 'satellite' ? 'satellite' : 'street';
    document.querySelectorAll('.map-layer-btn').forEach(btn => {
      const on = btn.dataset.mapStyle === next;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    if (next === appState.mapStyle) return;
    appState.mapStyle = next;
    safeIcons();

    // Google Maps has a native layer control, so just drive its map type.
    if (appState.mapEngine === 'google' && appState.mapGoogle) {
      appState.mapGoogle.setMapTypeId(next === 'satellite' ? 'hybrid' : 'roadmap');
      return;
    }

    if (appState.mapEngine === 'maplibre' && appState.mapGL) {
      try {
        // setStyle forces a fresh fetch of the style JSON and its sources, which
        // is exactly what recovers a map whose first load failed.
        appState.mapGL.setStyle(this.mapStyleSpec());
        this.updateMapOfflineNotice(false);
        appState.mapGL.once('idle', () => {
          this.updateMapOfflineNotice(false);
          this.fitAllBranches();
        });
      } catch (e) {
        console.warn('Could not switch map style:', e);
      }
      return;
    }

    // Leaflet fallback: swap the raster tile source.
    appState.mapTilesFailed = false;
    this.addMapTileLayer();
    this.fitAllBranches();
  },

  // Frame every currently visible branch, Google-Maps style.
  fitAllBranches() {
    const pts = this.mappedBranches();
    if (!pts.length) return;
    if (appState.mapEngine === 'google' && appState.mapGoogle) {
      const bounds = new google.maps.LatLngBounds();
      pts.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));
      appState.mapGoogle.fitBounds(bounds, 60);
    } else if (appState.mapEngine === 'maplibre' && appState.mapGL) {
      const bounds = pts.reduce((b, p) => b.extend([p.lng, p.lat]), new maplibregl.LngLatBounds());
      appState.mapGL.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 800 });
    } else if (appState.mapInstance) {
      appState.mapInstance.fitBounds(pts.map(p => [p.lat, p.lng]), { padding: [40, 40], maxZoom: 14 });
    }
  },

  // Leaflet fallback engine (kept only as a safety net).
  initLeafletMap(mapEl) {
    try {
      appState.mapInstance = L.map(mapEl.id || 'map-element').setView([18.96, 72.84], 12);
      appState.mapEngine = 'leaflet';
      this.addMapTileLayer();
      this.updateBranchListAndMarkers();
    } catch (e) {
      console.warn('Leaflet map error or already initialized:', e);
    }
  },

  // Branch records that actually have coordinates we are willing to plot.
  mappedBranches() {
    return this.branchList().branches.filter(b => b.lat != null && b.lng != null);
  },

  // Release whichever engine is live so another one can take over the container.
  teardownMapEngine() {
    if (appState.mapGL) {
      try {
        appState.mapGLMarkers.forEach(m => m.remove());
        appState.mapGL.remove();
      } catch (e) { /* already gone */ }
    }
    if (appState.mapInstance) {
      try { appState.mapInstance.remove(); } catch (e) { /* already gone */ }
    }
    if (appState.mapGoogle) {
      appState.mapGoogleMarkers.forEach(m => m.setMap(null));
      appState.mapGoogle = null;
    }
    const mapEl = document.getElementById('map-element');
    if (mapEl) mapEl.innerHTML = '';
    appState.mapGL = null;
    appState.mapInstance = null;
    appState.mapGoogle = null;
    appState.mapGLMarkers = [];
    appState.mapMarkers = [];
    appState.mapGoogleMarkers = [];
    appState.mapTileLayer = null;
    appState.mapEngine = null;
  },

  // OPTIONAL provider swap. The app ships with the keyless MapLibre map, which
  // already gives the Google-Maps-style experience. Call
  // app.setMapProvider('google') with a key set in window.LOANFINDER_GOOGLE_MAPS_KEY
  // to drive the real Google Maps SDK instead. Google charges for this, and the
  // key is readable in page source, so restrict it by HTTP referrer and set a
  // quota before shipping. Note this path cannot be verified without a key.
  setMapProvider(provider) {
    if (provider !== 'google') {
      this.teardownMapEngine();
      this.initMap();
      this.updateBranchListAndMarkers();
      toast('Switched back to the built-in map.', 'info');
      return;
    }
    const key = (typeof window !== 'undefined' && window.LOANFINDER_GOOGLE_MAPS_KEY) || '';
    if (!key) {
      toast('Add your Google Maps API key in window.LOANFINDER_GOOGLE_MAPS_KEY first (see index.html).', 'error');
      return;
    }
    this.teardownMapEngine();
    this.loadGoogleMaps(key);
  },

  loadGoogleMaps(key) {
    const go = () => {
      const mapEl = document.getElementById('map-element');
      if (!mapEl || typeof google === 'undefined' || !google.maps) return;
      appState.mapGoogle = new google.maps.Map(mapEl, {
        center: { lat: 18.96, lng: 72.84 },
        zoom: 11,
        mapTypeControl: true,
        mapTypeControlStyle: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        streetViewControl: true,
        fullscreenControl: true,
        clickableIcons: false,
        gestureHandling: 'greedy',
      });
      appState.mapEngine = 'google';
      this.updateBranchListAndMarkers();
    };

    if (typeof google !== 'undefined' && google.maps) { go(); return; }
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
    s.onload = go;
    s.onerror = () => toast('Google Maps failed to load. Check the API key and its restrictions.', 'error');
    document.head.appendChild(s);
  },

  renderGoogleMarkers(branches) {
    const map = appState.mapGoogle;
    if (!map) return;
    appState.mapGoogleMarkers.forEach(m => m.setMap(null));
    appState.mapGoogleMarkers = [];

    const bounds = new google.maps.LatLngBounds();
    branches.filter(b => b.lat != null && b.lng != null).forEach(b => {
      const marker = new google.maps.Marker({
        position: { lat: b.lat, lng: b.lng },
        map,
        title: b.name,
      });
      const info = new google.maps.InfoWindow({
        content: this.branchPopupContent(b),
      });
      marker.addListener('click', () => info.open({ anchor: marker, map }));
      appState.mapGoogleMarkers.push(marker);
      bounds.extend({ lat: b.lat, lng: b.lng });
    });
    if (!bounds.isEmpty()) map.fitBounds(bounds, 60);
  },

  // Render the MapLibre markers + auto-fit. Markers use real DOM elements so
  // they stay crisp and keyboard reachable, and popups mimic an InfoWindow card.
  renderMapLibreMarkers(branches) {
    const map = appState.mapGL;
    if (!map) return;

    appState.mapGLMarkers.forEach(m => m.remove());
    appState.mapGLMarkers = [];

    const mapped = branches.filter(b => b.lat != null && b.lng != null);
    mapped.forEach(b => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'gl-branch-pin';
      el.setAttribute('aria-label', `Show ${b.name} on the map`);
      el.innerHTML = '<span class="gl-branch-pin-dot"></span>';

      const popup = new maplibregl.Popup({ offset: 18, closeButton: false, maxWidth: '260px' })
        .setDOMContent(this.branchPopupContent(b));

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([b.lng, b.lat])
        .setPopup(popup)
        .addTo(map);
      appState.mapGLMarkers.push(marker);
    });

    if (mapped.length > 0) this.fitAllBranches();
  },

  // Shared InfoWindow-style card used by both engines.
  branchPopupContent(b) {
    const wrap = document.createElement('div');
    wrap.className = 'gl-info-card';
    const rows = [];
    rows.push(`<div class="gl-info-name">${b.name}</div>`);
    rows.push(`<div class="gl-info-addr">${b.address}</div>`);
    if (b.ifsc) rows.push(`<div class="gl-info-ifsc">IFSC ${b.ifsc}</div>`);
    if (b.hours) rows.push(`<div class="gl-info-hours">${b.hours}</div>`);
    rows.push(`<a class="gl-info-link" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}">Get directions</a>`);
    wrap.innerHTML = rows.join('');
    return wrap;
  },

  // Street tiles are the only asset this app fetches over the network: Leaflet
  // itself is vendored, but the map imagery comes from the OpenStreetMap tile
  // servers. When they are unreachable the map is just a grey box, so detect
  // that and tell the user instead of failing silently.
  addMapTileLayer() {
    if (!appState.mapInstance) return;
    if (appState.mapTileLayer) {
      appState.mapInstance.removeLayer(appState.mapTileLayer);
      appState.mapTileLayer = null;
    }

    const satellite = appState.mapStyle === 'satellite';
    const layer = L.tileLayer(
      satellite
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: satellite
          ? 'Imagery &copy; Esri, Maxar, Earthstar Geographics'
          : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        crossOrigin: true,
        maxZoom: 19,
      }
    ).addTo(appState.mapInstance);
    appState.mapTileLayer = layer;

    let loaded = 0;
    let errored = 0;
    // Only judge the server once a few tiles have had time to answer, so a
    // single slow tile does not flash an error over a working map.
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      this.updateMapOfflineNotice(loaded === 0 && errored > 0);
    };
    const timer = setTimeout(settle, 4000);

    layer.on('tileload', () => {
      loaded++;
      if (!settled) { clearTimeout(timer); this.updateMapOfflineNotice(false); }
    });
    layer.on('tileerror', () => {
      errored++;
      if (!settled && errored >= 3) { clearTimeout(timer); settle(); }
    });
  },

  updateMapOfflineNotice(show) {
    const notice = document.getElementById('map-offline-notice');
    if (notice) notice.classList.toggle('hidden', !show);
    appState.mapTilesFailed = !!show;
  },

  retryMapTiles() {
    if (appState.mapEngine === 'google' && appState.mapGoogle) {
      this.updateMapOfflineNotice(false);
      appState.mapGoogle.triggerRepaint();
      this.fitAllBranches();
      return;
    }
    if (appState.mapEngine === 'maplibre' && appState.mapGL) {
      try {
        appState.mapGL.setStyle(this.mapStyleSpec());
        appState.mapGL.once('idle', () => {
          this.updateMapOfflineNotice(false);
          this.fitAllBranches();
        });
      } catch (e) {
        console.warn('Map retry failed:', e);
      }
      return;
    }
    this.addMapTileLayer();
    this.refreshMapSize();
  },

  // Leaflet needs an explicit invalidateSize when its container changes size.
  // MapLibre observes resizes itself, so this is a no-op on the primary engine.
  refreshMapSize(delay = 0) {
    if (appState.mapInstance) {
      const run = () => { try { appState.mapInstance.invalidateSize(); } catch (e) { /* container may be gone */ } };
      if (delay) setTimeout(run, delay); else run();
    }
  },

  // Great-circle distance in km between two coordinates (no fabrication, pure math)
  haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  },

  // Distance label for a branch. Computed only from a real user location; never fabricated.
  branchDistanceLabel(b) {
    const loc = appState.userLocation;
    if (!loc || b.lat == null || b.lng == null) return null;
    const km = this.haversineKm(loc.lat, loc.lng, b.lat, b.lng);
    return km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`;
  },

  branchList() {
    const city = appState.activeBranchCity;
    const bank = appState.activeBranchBank;
    let branches = (BRANCH_DATA[city] || []).filter(b => b.bank === bank || bank === 'All');
    const loc = appState.userLocation;
    if (loc) {
      const withDist = branches.map(b => ({
        b,
        d: (b.lat != null && b.lng != null) ? this.haversineKm(loc.lat, loc.lng, b.lat, b.lng) : Infinity
      }));
      branches = withDist
        .sort((x, y) => (x.d - y.d) || x.b.name.localeCompare(y.b.name))
        .map(x => x.b);
    }
    return { city, bank, branches };
  },

  branchSortLabel() {
    const { branches } = this.branchList();
    if (!appState.userLocation) return 'Sorted by city';
    return branches.some(b => this.branchDistanceLabel(b))
      ? 'Sorted by distance from you'
      : 'Sorted by city';
  },

  updateBranchListAndMarkers() {
    const { city, bank, branches } = this.branchList();

    // Update Counter
    const countEl = document.getElementById('branch-results-count');
    if (countEl) countEl.textContent = `${branches.length} ${bank} branches in ${city}`;
    const sortEl = document.getElementById('branch-sort-label');
    if (sortEl) sortEl.textContent = this.branchSortLabel();

    // Render Left Cards
    const container = document.getElementById('branch-cards-container');
    if (container) {
      if (branches.length === 0) {
        container.innerHTML = `
          <div class="p-6 text-center text-slate-500">
            <i data-lucide="map-pin-off" class="w-10 h-10 mx-auto mb-2 text-slate-400"></i>
            <p>No ${bank} branches on record for ${city} yet. Try another bank or city (Mumbai, Delhi, Bengaluru, Hyderabad, Pune).</p>
          </div>
        `;
      } else {
        container.innerHTML = branches.map((b, idx) => {
          const dist = this.branchDistanceLabel(b);
          const geoNote = !dist && b.geoPrecision === 'locality'
            ? '<span class="branch-status-closed" title="Area-level location from OpenStreetMap">Approx. area</span>'
            : '';
          const ifscLine = b.ifsc
            ? `<div class="branch-address" style="margin-top:2px;">IFSC: <strong>${b.ifsc}</strong>${b.source ? ` &middot; <a href="${b.source}" target="_blank" rel="noopener" class="text-blue-600 hover:underline">source</a>` : ''}</div>`
            : '';
          // Records that were never verified against an official bank locator are
          // labelled as sample data so they are not read as confirmed branches.
          const sampleBadge = b.geoPrecision === 'demo'
            ? '<div class="branch-address" style="margin-top:2px;"><span class="branch-sample-badge" title="Placeholder record - not verified against an official bank branch list">Sample data &middot; not verified</span></div>'
            : '';
          return `
          <div class="branch-card ${idx === 0 ? 'active' : ''}" onclick="app.panToBranchByIndex(${idx}, this)">
            <div class="branch-card-top">
              <span class="branch-name">${b.name}</span>
              ${dist ? `<span class="branch-distance">${dist}</span>` : geoNote}
            </div>
            <div class="branch-address">${b.address}</div>
            ${ifscLine}
            ${sampleBadge}
            <div class="branch-meta-row">
              <span class="branch-status-open" title="Typical branch timings">
                <i data-lucide="clock" class="w-3.5 h-3.5"></i> ${b.hours}
              </span>
              <a href="tel:${b.phone}" class="text-blue-600 font-semibold hover:underline">${b.phone}</a>
            </div>
            <div class="mt-3 flex gap-2">
              <a href="https://maps.google.com/?q=${encodeURIComponent(b.address)}" target="_blank" class="btn btn-primary btn-sm flex-1 text-xs">
                <i data-lucide="navigation" class="w-3.5 h-3.5"></i> Get Directions
              </a>
              <button class="btn btn-secondary btn-sm text-xs" onclick="toast('Appointment booking with ${b.name} Loan Desk requested!')">
                Book Visit
              </button>
            </div>
          </div>`;
        }).join('');
      }
      safeIcons();
    }

    // Render Markers on Map (only for branches with verified coordinates)
    if (appState.mapEngine === 'google' && appState.mapGoogle) {
      this.renderGoogleMarkers(branches);
    } else if (appState.mapEngine === 'maplibre' && appState.mapGL) {
      this.renderMapLibreMarkers(branches);
    } else if (appState.mapInstance) {
      appState.mapMarkers.forEach(m => appState.mapInstance.removeLayer(m));
      appState.mapMarkers = [];

      const mapped = branches.filter(b => b.lat != null && b.lng != null);
      if (mapped.length > 0) {
        const bounds = [];
        mapped.forEach(b => {
          const marker = L.marker([b.lat, b.lng]).addTo(appState.mapInstance);
          marker.bindPopup(this.branchPopupContent(b));
          appState.mapMarkers.push(marker);
          bounds.push([b.lat, b.lng]);
        });

        appState.mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    }
  },

  panToBranchByIndex(idx, cardEl) {
    const { branches } = this.branchList();
    const b = branches[idx];
    document.querySelectorAll('.branch-card').forEach(c => c.classList.remove('active'));
    if (cardEl) cardEl.classList.add('active');
    if (!b || b.lat == null || b.lng == null) return;

    if (appState.mapEngine === 'google' && appState.mapGoogle) {
      appState.mapGoogle.panTo({ lat: b.lat, lng: b.lng });
      appState.mapGoogle.setZoom(15);
      return;
    }

    if (appState.mapEngine === 'maplibre' && appState.mapGL) {
      appState.mapGL.flyTo({ center: [b.lng, b.lat], zoom: 15, duration: 1200, essential: true });
      const marker = appState.mapGLMarkers.find(m => {
        const pos = m.getLngLat();
        return Math.abs(pos.lat - b.lat) < 0.001 && Math.abs(pos.lng - b.lng) < 0.001;
      });
      if (marker) setTimeout(() => marker.togglePopup(), 700);
      return;
    }

    if (!appState.mapInstance) return;
    appState.mapInstance.flyTo([b.lat, b.lng], 15, { duration: 1.2 });
    const marker = appState.mapMarkers.find(m => {
      const pos = m.getLatLng();
      return Math.abs(pos.lat - b.lat) < 0.001 && Math.abs(pos.lng - b.lng) < 0.001;
    });
    if (marker) marker.openPopup();
  },

  handleBranchFilter() {
    const bankSelect = document.getElementById('branch-bank-select');
    const citySelect = document.getElementById('branch-city-select');

    if (bankSelect) appState.activeBranchBank = bankSelect.value;
    if (citySelect) appState.activeBranchCity = citySelect.value;

    this.updateBranchListAndMarkers();
  },

  handleBranchSearch(query) {
    const q = query.toLowerCase().trim();
    const cards = document.querySelectorAll('.branch-card');
    let visibleCount = 0;
    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      const show = text.includes(q);
      card.style.display = show ? 'block' : 'none';
      if (show) visibleCount++;
    });

    const list = document.querySelector('.branch-cards-list');
    let empty = document.getElementById('branch-search-empty');
    if (visibleCount === 0 && list) {
      if (!empty) {
        empty = document.createElement('div');
        empty.id = 'branch-search-empty';
        empty.className = 'p-6 text-center text-slate-500';
        empty.innerHTML = `
          <i data-lucide="search-x" class="w-10 h-10 mx-auto mb-2 text-slate-400"></i>
          <h4 class="font-bold text-slate-700">No branches match "${query.trim()}"</h4>
          <p class="text-sm">Try a different area, bank, or clear the search box.</p>
        `;
        list.appendChild(empty);
        safeIcons();
      }
    } else if (empty) {
      empty.remove();
    }
  },

  useCurrentLocation() {
    if (!navigator.geolocation) {
      toast('Geolocation is not supported by this browser. Please pick your city manually.');
      return;
    }
    toast('Requesting your location...');
    navigator.geolocation.getCurrentPosition(
      pos => {
        appState.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const nearest = this.nearestBranchCity(appState.userLocation);
        if (nearest) {
          appState.activeBranchCity = nearest;
          const citySelect = document.getElementById('branch-city-select');
          if (citySelect) citySelect.value = nearest;
        }
        this.updateBranchListAndMarkers();
        toast(nearest
          ? `Location detected. Showing ${nearest} branches with live distances.`
          : 'Location detected, but you are outside the covered cities. Pick a city manually.');
      },
      err => {
        toast('Could not read your location (' + (err.message || 'permission denied') + '). Please pick your city manually.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  },

  // Nearest covered city that has at least one geocoded branch, or null if none exist
  nearestBranchCity(loc) {
    let best = null;
    let bestKm = Infinity;
    Object.keys(BRANCH_DATA).forEach(city => {
      (BRANCH_DATA[city] || []).forEach(b => {
        if (b.lat == null || b.lng == null) return;
        const km = this.haversineKm(loc.lat, loc.lng, b.lat, b.lng);
        if (km < bestKm) { bestKm = km; best = city; }
      });
    });
    return best;
  },

  navigateToBranchLocator(bankName) {
    appState.activeBranchBank = bankName;
    const bankSelect = document.getElementById('branch-bank-select');
    if (bankSelect) bankSelect.value = bankName;

      this.navigateTo('branches');
      setTimeout(() => {
        this.refreshMapSize();
        this.updateBranchListAndMarkers();
      }, 200);
  },

  // Open the branch locator filtered to the bank shown in Details & Docs
  viewBranchesForCurrentBank() {
    const offer = appState.activeBankDetails;
    const bankName = offer ? offer.bankName : (document.getElementById('branch-bank-select') || {}).value || 'State Bank';
    this.navigateToBranchLocator(bankName);
  },

  // 6. Navigation and View Switching
  navigateTo(viewId) {
    // The full comparison now lives on the dashboard below the top-3 picks
    if (viewId === 'compare') viewId = 'dashboard';

    appState.currentView = viewId;

    // Toggle active classes on view sections
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.remove('active');
    });

    const targetPanel = document.getElementById(`view-${viewId}`);
    if (targetPanel) {
      targetPanel.classList.add('active');
    }

    // saved-bank / saved-p2p live in the single #view-saved panel.
    // "Saved" opens the Bank Offers tab by default.
    if (viewId === 'saved' || viewId === 'saved-bank' || viewId === 'saved-p2p') {
      const savedPanel = document.getElementById('view-saved');
      if (savedPanel) savedPanel.classList.add('active');
      const tab = viewId === 'saved-p2p' ? 'saved-p2p-tab' : 'saved-bank-tab';
      this.switchSavedTab(tab);
      this.renderSavedView();
    }

    // Toggle active sidebar item
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('data-view') === viewId) {
        item.classList.add('active');
      }
    });

    // Bank details (documents) and branch locator pages are reached from the
    // offers list; keep "Dashboard" highlighted
    if (viewId === 'documents' || viewId === 'branches') {
      const dashNav = document.querySelector('.nav-item[data-view="dashboard"]');
      if (dashNav) dashNav.classList.add('active');
    }

    // Keep "Saved" highlighted while inside a saved sub-feature
    if (viewId === 'saved' || viewId === 'saved-bank' || viewId === 'saved-p2p') {
      const savedNav = document.querySelector('.nav-item[data-view="saved"]');
      if (savedNav) savedNav.classList.add('active');
    }

    // Special behavior for Branch map resizing
      if (viewId === 'branches') {
        setTimeout(() => {
          this.refreshMapSize();
        }, 150);
      }

    // Refresh P2P views each time one is opened (hub + sub-features)
    if (viewId.indexOf('p2p') === 0) {
      this.renderP2P();
    }

    // Keep "P2P Lending" highlighted while inside a P2P sub-feature
    if (viewId === 'p2p-borrow' || viewId === 'p2p-lend') {
      const p2pNav = document.querySelector('.nav-item[data-view="p2p"]');
      if (p2pNav) p2pNav.classList.add('active');
    }

    // Scroll to top of content
    const scroller = document.getElementById('content-scroll');
    if (scroller) scroller.scrollTop = 0;
  },

  scrollToSection(sectionId) {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  },

  bindNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        if (view) this.navigateTo(view);
      });
    });

    // Tab buttons in Bank Details
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabTarget = btn.getAttribute('data-tab');
        if (!tabTarget || tabTarget === 'tab-branches') return;

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const content = document.getElementById(tabTarget);
        if (content) content.classList.add('active');
      });
    });

    // Mobile sidebar toggle
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        this.setSidebarOpen(!sidebar.classList.contains('open'));
      });
      this.ensureSidebarScrim();
      // Tapping any nav item on mobile should dismiss the drawer
      sidebar.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => this.setSidebarOpen(false));
      });
    }

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        appState.savedOffers = [];
        this.showAuth();
      });
    }

    this.bindGlobalDismiss();
  },

  // Open/close the off-canvas mobile sidebar together with its scrim, so the
  // drawer can be dismissed by tapping outside it.
  setSidebarOpen(open) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('open', !!open);
    const scrim = this.ensureSidebarScrim();
    if (scrim) scrim.classList.toggle('visible', !!open);
    const toggle = document.getElementById('sidebar-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    sidebar.setAttribute('aria-hidden', open ? 'false' : 'true');
  },

  ensureSidebarScrim() {
    let scrim = document.getElementById('sidebar-scrim');
    if (!scrim) {
      scrim = document.createElement('div');
      scrim.id = 'sidebar-scrim';
      scrim.className = 'sidebar-scrim';
      scrim.addEventListener('click', () => this.setSidebarOpen(false));
      document.body.appendChild(scrim);
    }
    return scrim;
  },

  // Escape closes the topmost transient layer: an open modal first, then the
  // support panel, then the mobile sidebar.
  bindGlobalDismiss() {
    if (this._dismissBound) return;
    this._dismissBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const modals = ['digilocker-modal', 'p2p-chat-modal', 'p2p-lend-modal', 'p2p-details-modal']
        .map(id => document.getElementById(id))
        .filter(el => el && !el.classList.contains('hidden'));
      if (modals.length) {
        const top = modals[modals.length - 1];
        if (typeof this.closeDigiLockerModal === 'function' && top.id === 'digilocker-modal') this.closeDigiLockerModal();
        else this.closeP2PModal(top.id);
        if (top.id !== 'digilocker-modal') {
          const focusable = top.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          if (focusable) focusable.focus();
        }
        return;
      }

      const panel = document.getElementById('support-panel');
      if (panel && !panel.classList.contains('hidden')) {
        this.toggleSupportWidget(false);
        const fab = document.getElementById('support-fab');
        if (fab) fab.focus();
        return;
      }

      const sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('open')) this.setSidebarOpen(false);
    });
  },

  // 7. Saved Offers & Bookmarking
  toggleSaveOffer(offerId) {
    const offer = BANK_OFFERS.find(o => o.id === offerId);
    if (!offer) return;

    const idx = appState.savedOffers.findIndex(o => o.id === offerId);
    if (idx > -1) {
      appState.savedOffers.splice(idx, 1);
      toast(`${offer.bankName} removed from saved offers.`, 'info');
    } else {
      appState.savedOffers.push(offer);
      toast(`${offer.bankName} (${offer.interestRate}% p.a.) saved successfully!`, 'success');
    }

    db.set('savedOffers', appState.savedOffers);
    this.renderSavedView();
    this.calculateAndCompare();
  },

  renderSavedView() {
    const container = document.getElementById('saved-cards-container');
    if (!container) return;

    if (appState.savedOffers.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-500 col-span-2">
          <i data-lucide="bookmark" class="w-12 h-12 mx-auto mb-2 text-slate-300"></i>
          <h4 class="font-bold text-slate-700">No Saved Bank Offers</h4>
          <p class="text-sm">Click the bookmark icon on any loan card to save it here for later.</p>
        </div>
      `;
    } else {
      container.innerHTML = appState.savedOffers.map(offer => `
        <div class="bank-card">
          <div class="bank-card-header">
            <div class="bank-info">
              <div class="bank-logo-sm">${offer.shortCode}</div>
              <div>
                <h4 class="font-bold text-slate-900">${offer.bankName}</h4>
                <div class="text-xs text-slate-500">${offer.loanType}</div>
              </div>
            </div>
            <span class="tag-pill tag-pill-success">${offer.interestRate}% p.a.</span>
          </div>
          <div class="bank-card-footer">
            <button class="btn btn-primary btn-sm flex-1" onclick="app.viewBankDetails('${offer.id}')">View Details</button>
            <button class="btn btn-secondary btn-sm" onclick="app.toggleSaveOffer('${offer.id}')">Remove</button>
          </div>
        </div>
      `).join('');
    }
    this.renderSavedP2PView();
    safeIcons();
  },

  switchSavedTab(tabId) {
    document.querySelectorAll('[data-saved-tab]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-saved-tab') === tabId);
    });
    document.querySelectorAll('.saved-tab-content').forEach(c => {
      c.classList.toggle('active', c.id === tabId);
    });
    safeIcons();
  },

  toggleSaveP2PRequest(requestId) {
    const req = appState.p2pRequests.find(r => r.id === requestId);
    if (!req) return;

    const idx = appState.savedP2PRequests.findIndex(r => r.id === requestId);
    if (idx > -1) {
      appState.savedP2PRequests.splice(idx, 1);
      toast(`${req.borrowerName}'s request removed from saved.`, 'info');
    } else {
      appState.savedP2PRequests.push({ ...req });
      toast(`${req.borrowerName}'s request saved!`, 'success');
    }

    db.set('savedP2PRequests', appState.savedP2PRequests);
    this.renderSavedP2PView();
    this.renderMarketplace();
    safeIcons();
  },

  renderSavedP2PView() {
    const container = document.getElementById('saved-p2p-container');
    if (!container) return;

    if (appState.savedP2PRequests.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-500 col-span-2">
          <i data-lucide="hand-coins" class="w-12 h-12 mx-auto mb-2 text-slate-300"></i>
          <h4 class="font-bold text-slate-700">No Saved P2P Requests</h4>
          <p class="text-sm">Bookmark borrower requests from the P2P marketplace to track them here.</p>
        </div>
      `;
    } else {
      container.innerHTML = appState.savedP2PRequests.map(req => {
        const pct = req.amount ? Math.min(100, Math.round((req.funded / req.amount) * 100)) : 0;
        const remaining = Math.max(0, req.amount - req.funded);
        const riskClass = req.risk === 'High' ? 'risk-badge-high' : req.risk === 'Low' ? 'risk-badge-low' : 'risk-badge-medium';
        return `
          <div class="bank-card">
            <div class="bank-card-header">
              <div class="bank-info">
                <div class="bank-logo-sm" style="background:${req.avatarColor}20;color:${req.avatarColor}">${req.initials}</div>
                <div>
                  <h4 class="font-bold text-slate-900">${req.borrowerName}</h4>
                  <div class="text-xs text-slate-500">${req.purpose} &bull; ${req.requestedDate}</div>
                </div>
              </div>
              <span class="risk-badge ${riskClass}">${req.risk} Risk</span>
            </div>
            <div class="p2p-borrower-amounts mb-3">
              <div><span class="mini-stat-label">Requested</span><span class="mini-stat-val">${this.fmtINR(req.amount)}</span></div>
              <div><span class="mini-stat-label">Rate</span><span class="mini-stat-val text-emerald-600">${req.rate}%</span></div>
              <div><span class="mini-stat-label">Tenure</span><span class="mini-stat-val">${req.tenureMonths} mo</span></div>
            </div>
            ${this.fundingProgressHTML(req)}
            <div class="mt-2 text-xs text-slate-500">
              Remaining to fund: <strong class="text-slate-800">${this.fmtINR(remaining)}</strong>
            </div>
            <div class="bank-card-footer mt-3">
              <button class="btn btn-primary btn-sm flex-1" onclick="app.openLendModal('${req.id}')"><i data-lucide="hand-coins"></i> Lend Now</button>
              <button class="btn btn-secondary btn-sm" onclick="app.toggleSaveP2PRequest('${req.id}')">Remove</button>
            </div>
          </div>
        `;
      }).join('');
    }
    safeIcons();
  },

  // 8. P2P Lending
  fmtINR(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN');
  },

  amend(principal, annualRate, tenureMonths, elapsedMonths) {
    const emi = this.calcEMI(principal, annualRate, tenureMonths / 12);
    const r = (annualRate / 12) / 100;
    let bal = principal;
    let principalRepaid = 0;
    let interestPaid = 0;
    for (let m = 0; m < Math.min(elapsedMonths, tenureMonths); m++) {
      const interest = bal * r;
      const principalPart = emi - interest;
      bal = Math.max(0, bal - principalPart);
      principalRepaid += principalPart;
      interestPaid += interest;
    }
    return { emi, principalRepaid: Math.round(principalRepaid), interestPaid: Math.round(interestPaid), remainingBalance: Math.round(bal) };
  },

  initP2P() {
    let data = db.get('p2p', null);
    if (!data) {
      // One-time migration from the pre-v1 P2P key, then it is dropped for good
      try {
        const raw = localStorage.getItem(P2P_STORAGE_KEY);
        if (raw) {
          data = JSON.parse(raw);
          localStorage.removeItem(P2P_STORAGE_KEY);
        }
      } catch (e) {
        console.warn('Legacy P2P storage unreadable:', e);
      }
    }
    if (data) {
      appState.p2pRequests = data.p2pRequests || [];
      appState.p2pInvestments = data.p2pInvestments || [];
      appState.p2pMessages = data.p2pMessages || {};
      this.persistP2P();
      this.renderP2P();
      return;
    }
    this.seedP2PData();
  },

  seedP2PData() {
    appState.p2pRequests = P2P_DEMO_REQUESTS.map(r => ({ ...r }));
    appState.p2pInvestments = [
      {
        id: 'inv-demo-1',
        requestId: 'p2p-r1',
        borrowerName: 'Priya Sharma',
        initials: 'PS',
        purpose: 'Medical Emergency',
        amount: 45000,
        rate: 11.5,
        tenureMonths: 12,
        monthsElapsed: 3,
        status: 'Repaying'
      }
    ];
    appState.p2pMessages = {
      'p2p-r1': [
        { from: 'borrower', text: 'Thank you for funding my loan. I will make the first repayment on the scheduled date.', time: new Date(Date.now() - 1000 * 60 * 60 * 26).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) },
        { from: 'me', text: "You're welcome. Please let me know if there is any issue with the repayment schedule.", time: new Date(Date.now() - 1000 * 60 * 60 * 24).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }
      ],
      'p2p-u1': [
        { from: 'lender', text: 'Hi Alex, glad to support your home renovation. First EMI on the 5th.', time: '10:12 AM' },
        { from: 'me', text: 'Thank you, Rahul! I will make sure repayments are always on time.', time: '10:20 AM' }
      ]
    };
    // Reflect the seeded investment in the marketplace funding progress
    const priya = appState.p2pRequests.find(r => r.id === 'p2p-r1');
    if (priya) priya.funded = 45000;
    this.persistP2P();
    this.renderP2P();
  },

  persistP2P() {
    // Single source of truth: the localStorage-backed document store
    db.set('p2p', {
      p2pRequests: appState.p2pRequests,
      p2pInvestments: appState.p2pInvestments,
      p2pMessages: appState.p2pMessages
    });
  },

  setP2PMode(mode) {
    // Borrow Money and Lend Money are separate sub-features of P2P Lending;
    // each one opens as its own view so users can access them independently.
    appState.p2pMode = mode;
    this.navigateTo(mode === 'borrow' ? 'p2p-borrow' : 'p2p-lend');
  },

  switchLendTab(tabId) {
    document.querySelectorAll('.lend-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-lend-tab') === tabId);
    });
    document.querySelectorAll('.lend-tab-content').forEach(c => {
      c.classList.toggle('active', c.id === tabId);
    });
    safeIcons();
  },

  renderP2P() {
    const badge = document.getElementById('p2p-open-badge');
    const openCount = appState.p2pRequests.filter(r => !r.isMine && r.status === 'open').length;
    if (badge) badge.textContent = openCount + appState.p2pRequests.filter(r => !r.isMine && r.status === 'funding').length;

    this.updateBorrowerPreview();
    this.syncLenderPrefInputs();
    this.renderMarketplace();
    this.renderBorrowerMatches();
    this.renderLenderMatches();
    this.renderMyRequests();
    this.renderPortfolio();
    safeIcons();
  },

  // ---- Matching (demo scoring algorithm) ----
  clampScore(score) {
    return Math.max(55, Math.min(99, Math.round(score)));
  },

  lenderMatchScore(req) {
    const pref = appState.p2pLenderPref;
    let score = 100;
    if (req.rate > pref.maxRate) score -= (req.rate - pref.maxRate) * 3;
    if (req.amount > pref.amount * 3) score -= 8;
    if (req.tenureMonths > pref.tenureMax) score -= 7;
    if (req.risk === 'High' && pref.riskTolerance !== 'high') score -= 14;
    if (req.risk === 'Medium' && pref.riskTolerance === 'low') score -= 7;
    if (req.creditScore < 680) score -= 8;
    if (req.status !== 'open') score -= 12;
    return this.clampScore(score);
  },

  borrowerMatchScore(lender, req) {
    let score = 100;
    if (req.rate > lender.maxRate) score -= 12;
    if (req.amount < lender.minAmount) score -= 10;
    if (req.amount > lender.maxAmount) score -= 12;
    if (!lender.risk.includes((req.risk || 'medium').toLowerCase())) score -= 10;
    if (req.tenureMonths > lender.tenureMax) score -= 8;
    return this.clampScore(score);
  },

  // ---- Borrower form ----
  getBorrowerField(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  },

  updateBorrowerPreview() {
    const amount = parseInt(this.getBorrowerField('p2p-loan-amount'), 10) || 0;
    const rate = parseFloat(this.getBorrowerField('p2p-max-rate')) || 0;
    const tenure = parseInt(this.getBorrowerField('p2p-tenure'), 10) || 12;
    const emi = amount > 0 && rate > 0 ? this.calcEMI(amount, rate, tenure / 12) : 0;
    const total = emi * tenure;

    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set('preview-amount', this.fmtINR(amount));
    set('preview-emi', this.fmtINR(emi));
    set('preview-rate', rate + '% p.a.');
    set('preview-tenure', tenure + ' months');
    set('preview-total', this.fmtINR(total));
  },

  // Build a request-like draft from the current borrower form values so
  // lender recommendations always reflect what the user has typed.
  currentBorrowerDraft() {
    const amount = parseInt(this.getBorrowerField('p2p-loan-amount'), 10) || 0;
    const tenure = parseInt(this.getBorrowerField('p2p-tenure'), 10) || 12;
    const rate = parseFloat(this.getBorrowerField('p2p-max-rate')) || 0;
    const credit = parseInt(this.getBorrowerField('p2p-credit-score'), 10) || 600;
    return {
      amount,
      rate,
      tenureMonths: tenure,
      creditScore: credit,
      risk: credit >= 750 ? 'Low' : credit >= 700 ? 'Medium' : 'High'
    };
  },

  findBorrowerMatches() {
    const draft = this.currentBorrowerDraft();
    if (draft.amount < 5000) { toast('Please enter a loan amount of at least ₹5,000 to find matching lenders.'); return; }
    if (draft.amount > 500000) { toast('Loan amount cannot exceed ₹5,00,000 for this demo.'); return; }
    if (draft.rate < 5 || draft.rate > 24) { toast('Please enter an acceptable interest rate between 5% and 24%.'); return; }

    appState.p2pBorrowerMatchesVisible = true;
    this.renderBorrowerMatches();
    const target = document.getElementById('p2p-borrower-matches');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  resetBorrowerForm() {
    const defs = { 'p2p-loan-amount': 80000, 'p2p-max-rate': 13, 'p2p-monthly-income': 60000 };
    Object.keys(defs).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = defs[id];
    });
    const selects = { 'p2p-purpose': 'Medical Emergency', 'p2p-tenure': '12', 'p2p-employment': 'Salaried', 'p2p-credit-score': '720', 'p2p-repay-date': '5th of every month' };
    Object.keys(selects).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = selects[id];
    });
    const desc = document.getElementById('p2p-description');
    if (desc) desc.value = 'Need funds urgently and will repay through steady monthly salary.';
    this.hideBorrowerSuccess();
    appState.p2pBorrowerMatchesVisible = false;
    this.renderBorrowerMatches();
    this.updateBorrowerPreview();
  },

  hideBorrowerSuccess() {
    const s = document.getElementById('p2p-borrow-success');
    if (s) s.classList.add('hidden');
  },

  showBorrowerSuccess(msg) {
    const s = document.getElementById('p2p-borrow-success');
    if (!s) return;
    const span = s.querySelector('span');
    if (span) span.textContent = msg;
    s.classList.remove('hidden');
    clearTimeout(this._borrowSuccessTimer);
    this._borrowSuccessTimer = setTimeout(() => s.classList.add('hidden'), 6000);
  },

  submitLoanRequest() {
    const amount = parseInt(this.getBorrowerField('p2p-loan-amount'), 10) || 0;
    const purpose = this.getBorrowerField('p2p-purpose');
    const tenure = parseInt(this.getBorrowerField('p2p-tenure'), 10) || 0;
    const rate = parseFloat(this.getBorrowerField('p2p-max-rate')) || 0;
    const income = parseInt(this.getBorrowerField('p2p-monthly-income'), 10) || 0;
    const employment = this.getBorrowerField('p2p-employment');
    const credit = parseInt(this.getBorrowerField('p2p-credit-score'), 10) || 600;
    const repayDate = this.getBorrowerField('p2p-repay-date');
    const description = this.getBorrowerField('p2p-description');

    if (amount < 5000) { toast('Please enter a loan amount of at least ₹5,000.'); return; }
    if (amount > 500000) { toast('Loan amount cannot exceed ₹5,00,000 for this demo.'); return; }
    if (rate < 5 || rate > 24) { toast('Please enter an acceptable interest rate between 5% and 24%.'); return; }
    if (income < 10000) { toast('Please enter a valid monthly income (min ₹10,000).'); return; }
    if (!description.trim()) { toast('Please add a short description/reason for borrowing.'); return; }

    const request = {
      id: 'p2p-u' + Date.now(),
      borrowerName: 'Alex Johnson',
      initials: 'AJ',
      avatarColor: '#2563eb',
      purpose,
      amount,
      funded: 0,
      rate,
      tenureMonths: tenure,
      monthlyIncome: income,
      employmentType: employment,
      creditScore: credit,
      risk: credit >= 750 ? 'Low' : credit >= 700 ? 'Medium' : 'High',
      description: description.trim(),
      repaymentDate: repayDate,
      requestedDate: 'Today',
      status: 'open',
      isMine: true
    };

    appState.p2pRequests.unshift(request);
    this.persistP2P();
    this.showBorrowerSuccess('Your loan request for ' + this.fmtINR(amount) + ' was posted successfully! Lenders can now discover it in the marketplace score.');
    this.updateBorrowerPreview();
    this.renderMyRequests();
    this.renderBorrowerMatches();
    this.renderMarketplace();
    safeIcons();
  },

  // ---- Remove a posted loan request ----
  startRemoveRequest(id) {
    const btn = document.getElementById('remove-req-' + id);
    if (!btn) return;

    // First click: arm the button so an accidental tap cannot delete instantly.
    btn.classList.remove('btn-outline', 'btn-remove');
    btn.classList.add('btn-secondary');
    btn.innerHTML = '<i data-lucide="alert-triangle"></i> Click to confirm';
    btn.onclick = () => this.deleteLoanRequest(id);

    setTimeout(() => {
      const el = document.getElementById('remove-req-' + id);
      if (!el) return;
      el.classList.add('btn-outline', 'btn-remove');
      el.classList.remove('btn-secondary');
      el.innerHTML = '<i data-lucide="trash-2"></i> Remove';
      el.onclick = () => this.startRemoveRequest(id);
      safeIcons();
    }, 4000);
    safeIcons();
  },

  deleteLoanRequest(id) {
    const req = appState.p2pRequests.find(r => r.id === id && r.isMine);
    if (!req) return;
    if (req.funded >= req.amount) {
      toast('This loan request is fully funded and cannot be removed.');
      return;
    }
    appState.p2pRequests = appState.p2pRequests.filter(r => r.id !== id);
    delete appState.p2pMessages[id];
    this.persistP2P();
    this.renderP2P();
    toast('Your loan request was removed.');
  },

  // ---- Marketplace (lender) ----
  visibleMarketplaceRequests() {
    return appState.p2pRequests.filter(r => !r.isMine);
  },

  filterP2PMarketplace() {
    this.renderMarketplace();
  },

  renderMarketplace() {
    const container = document.getElementById('p2p-marketplace');
    if (!container) return;

    let requests = this.visibleMarketplaceRequests();
    const search = (document.getElementById('p2p-market-search') || {}).value || '';
    const risk = (document.getElementById('p2p-risk-filter') || {}).value || 'all';
    const sort = (document.getElementById('p2p-sort') || {}).value || 'match';

    if (search.trim()) {
      const q = search.toLowerCase();
      requests = requests.filter(r => (r.purpose + ' ' + r.borrowerName).toLowerCase().includes(q));
    }
    if (risk !== 'all') {
      requests = requests.filter(r => r.risk === risk);
    }

    if (sort === 'rate-asc') requests.sort((a, b) => a.rate - b.rate);
    else if (sort === 'amount-desc') requests.sort((a, b) => b.amount - a.amount);
    else if (sort === 'tenure-asc') requests.sort((a, b) => a.tenureMonths - b.tenureMonths);
    else requests.sort((a, b) => this.lenderMatchScore(b) - this.lenderMatchScore(a));

    if (requests.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-500 col-span-2">
          <i data-lucide="search-x" class="w-12 h-12 mx-auto mb-2 text-slate-300"></i>
          <h4 class="font-bold text-slate-700">No matching borrowers found</h4>
          <p class="text-sm">Try changing your search, risk filter or sort criteria.</p>
        </div>
      `;
    } else {
      container.innerHTML = requests.map(req => this.borrowerCardHTML(req)).join('');
    }
    safeIcons();
  },

  riskRow(req) {
    const riskClass = req.risk === 'High' ? 'risk-badge-high' : req.risk === 'Low' ? 'risk-badge-low' : 'risk-badge-medium';
    return `<span class="risk-badge ${riskClass}">${req.risk} Risk</span>`;
  },

  fundingProgressHTML(req) {
    const pct = req.amount ? Math.min(100, Math.round((req.funded / req.amount) * 100)) : 0;
    const riskKey = (req.risk || '').toLowerCase() === 'low' ? 'low' : (req.risk || '').toLowerCase() === 'high' ? 'high' : 'med';
    return `
      <div class="p2p-progress"><div class="p2p-progress-fill p2p-fill-${riskKey}" style="width:${pct}%"></div></div>
      <div class="flex-between mt-1 text-xs">
        <span class="text-xs font-semibold text-slate-700">${this.fmtINR(req.funded)} funded</span>
        <span class="text-xs text-slate-500">${pct}% of ${this.fmtINR(req.amount)}</span>
      </div>
    `;
  },

  requestStatusBadge(req) {
    if (req.status === 'full' || req.funded >= req.amount) return `<span class="tag-pill tag-pill-success">Fully Funded</span>`;
    if (req.status === 'repaying') return `<span class="tag-pill tag-pill-blue">Repaying</span>`;
    if (req.status === 'completed') return `<span class="tag-pill tag-pill-success">Completed</span>`;
    if (req.funded > 0) return `<span class="tag-pill tag-pill-blue">Partially Funded</span>`;
    return `<span class="tag-pill tag-pill-success">Open</span>`;
  },

  openMatchesCount(req) {
    return req.status === 'open' && req.funded < req.amount;
  },

  borrowerCardHTML(req) {
    const emi = this.calcEMI(req.amount, req.rate, req.tenureMonths / 12);
    const remaining = Math.max(0, req.amount - req.funded);
    const canLend = this.openMatchesCount(req);
    const pct = req.amount ? Math.min(100, Math.round((req.funded / req.amount) * 100)) : 0;
    const matchScore = this.lenderMatchScore(req);
    const isSaved = appState.savedP2PRequests.some(r => r.id === req.id);

    return `
      <div class="p2p-borrower-card">
        <div class="bank-card-header">
          <div class="bank-info">
            <div class="bank-logo-sm" style="background:${req.avatarColor}20;color:${req.avatarColor}">${req.initials}</div>
            <div>
              <h4 class="font-bold text-slate-900">${req.borrowerName}</h4>
              <div class="text-xs text-slate-500">${req.requestedDate} &bull; ${req.employmentType}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button class="p2p-save-btn ${isSaved ? 'saved' : ''}" title="${isSaved ? 'Remove from saved' : 'Save request'}" onclick="app.toggleSaveP2PRequest('${req.id}')">
              <i data-lucide="${isSaved ? 'bookmark' : 'bookmark-plus'}" class="w-4 h-4"></i>
            </button>
            ${req.status === 'open' || req.funded < req.amount ? `<span class="tag-pill tag-pill-success">${matchScore}% Match</span>` : this.requestStatusBadge(req)}
          </div>
        </div>

        <div class="p2p-borrower-top">
          <div>
            <span class="text-xs text-slate-500 font-medium">Purpose</span>
            <div class="font-bold text-slate-900">${req.purpose}</div>
          </div>
          ${this.riskRow(req)}
        </div>

        <div class="p2p-borrower-amounts">
          <div><span class="mini-stat-label">Requested</span><span class="mini-stat-val">${this.fmtINR(req.amount)}</span></div>
          <div><span class="mini-stat-label">Rate</span><span class="mini-stat-val text-emerald-600">${req.rate}%</span></div>
          <div><span class="mini-stat-label">Tenure</span><span class="mini-stat-val">${req.tenureMonths} mo</span></div>
          <div><span class="mini-stat-label">Est. EMI</span><span class="mini-stat-val">${this.fmtINR(emi)}</span></div>
        </div>

        ${this.fundingProgressHTML(req)}

        <div class="mt-2 text-xs text-slate-500">
          Remaining to fund: <strong class="text-slate-800">${this.fmtINR(remaining)}</strong>
        </div>

        <div class="bank-card-footer mt-3">
          ${canLend
            ? `<button class="btn btn-outline btn-sm flex-1" onclick="app.openP2PDetails('${req.id}')"><i data-lucide="eye"></i> View Details</button>
               <button class="btn btn-primary btn-sm flex-1" onclick="app.openLendModal('${req.id}')"><i data-lucide="hand-coins"></i> Lend Now</button>`
            : `<button class="btn btn-outline btn-sm flex-1" onclick="app.openP2PDetails('${req.id}')"><i data-lucide="eye"></i> View Details</button>
               <span class="tag-pill tag-pill-success ml-auto">${pct >= 100 ? 'Fully Funded' : 'Repaying'}</span>`}
        </div>
      </div>
    `;
  },

  // ---- Borrower details modal ----
  // Builds the amortisation table. Long tenures are summarised after the
  // first 12 months instead of silently dropping the remaining rows.
  modalScheduleRows(req, maxRows) {
    const limit = maxRows || 12;
    const r = (req.rate / 12) / 100;
    const emi = this.calcEMI(req.amount, req.rate, req.tenureMonths / 12);
    const totalMonths = Math.max(0, Math.round(req.tenureMonths));
    let bal = req.amount;
    let totalInterest = 0;
    const rows = [];

    for (let m = 1; m <= totalMonths; m++) {
      const interest = bal * r;
      const principal = m === totalMonths ? bal : emi - interest;
      const applied = Math.min(bal, Math.max(0, principal));
      totalInterest += interest;
      bal = Math.max(0, bal - applied);
      if (m <= limit) {
        rows.push(`<tr><td>${m}</td><td>${this.fmtINR(Math.round(applied))}</td><td>${this.fmtINR(Math.round(interest))}</td><td>${this.fmtINR(Math.round(bal))}</td></tr>`);
      }
    }

    if (totalMonths > limit) {
      rows.push(`<tr class="font-semibold"><td>${limit + 1}-${totalMonths}</td><td colspan="3">${totalMonths - limit} more monthly instalments &mdash; closing balance ${this.fmtINR(Math.round(bal))}, total interest ${this.fmtINR(Math.round(totalInterest))}</td></tr>`);
    }
    return rows.join('');
  },

  modalScheduleHeading(req) {
    const n = Math.max(0, Math.round(req.tenureMonths));
    return n > 12
      ? `Repayment Schedule Preview (first 12 of ${n} months)`
      : `Repayment Schedule (full ${n}-month schedule)`;
  },

  openP2PDetails(id) {
    const req = appState.p2pRequests.find(r => r.id === id);
    if (!req) return;
    appState.activeP2PLoan = req;

    const remaining = Math.max(0, req.amount - req.funded);
    const pct = req.amount ? Math.min(100, Math.round((req.funded / req.amount) * 100)) : 0;
    const emi = this.calcEMI(req.amount, req.rate, req.tenureMonths / 12);
    const canLend = this.openMatchesCount(req);

    const body = document.getElementById('p2p-details-body');
    if (!body) return;

    body.innerHTML = `
      <div class="modal-head">
        <div class="bank-info">
          <div class="bank-avatar-lg" style="background:${req.avatarColor}20;color:${req.avatarColor}">${req.initials}</div>
          <div>
            <h3 class="text-xl font-extrabold text-slate-900">${req.borrowerName}</h3>
            <div class="flex items-center gap-2 mt-1 flex-wrap">
              ${this.riskRow(req)}
              ${this.requestStatusBadge(req)}
              <span class="text-xs text-slate-400">Requested ${req.requestedDate}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="p2p-detail-amounts">
        <div><span class="mini-stat-label">Requested Amount</span><span class="mini-stat-val text-slate-900 text-lg">${this.fmtINR(req.amount)}</span></div>
        <div><span class="mini-stat-label">Funded Amount</span><span class="mini-stat-val text-emerald-600">${this.fmtINR(req.funded)}</span></div>
        <div><span class="mini-stat-label">Remaining</span><span class="mini-stat-val text-blue-600">${this.fmtINR(remaining)}</span></div>
        <div><span class="mini-stat-label">Interest Rate</span><span class="mini-stat-val text-emerald-600">${req.rate}% p.a.</span></div>
        <div><span class="mini-stat-label">Tenure</span><span class="mini-stat-val">${req.tenureMonths} months</span></div>
        <div><span class="mini-stat-label">Est. Monthly EMI</span><span class="mini-stat-val">${this.fmtINR(emi)}</span></div>
        <div><span class="mini-stat-label">Credit Score</span><span class="mini-stat-val">${req.creditScore}</span></div>
        <div><span class="mini-stat-label">Repayment Date</span><span class="mini-stat-val">${req.repaymentDate}</span></div>
      </div>

      <div class="mt-4">
        <div class="mini-stat-label mb-1">Funding Status</div>
        ${this.fundingProgressHTML(req)}
      </div>

      <div class="p2p-detail-blocks mt-4">
        <div class="p2p-detail-block">
          <h4 class="font-bold text-slate-800 text-sm mb-1"><i data-lucide="briefcase" class="w-4 h-4"></i> Employment</h4>
          <p class="text-sm text-slate-600">${req.employmentType} &bull; Monthly income ${this.fmtINR(req.monthlyIncome)}</p>
        </div>
        <div class="p2p-detail-block">
          <h4 class="font-bold text-slate-800 text-sm mb-1"><i data-lucide="file-text" class="w-4 h-4"></i> Borrower's Description</h4>
          <p class="text-sm text-slate-600">${req.description}</p>
        </div>
        <div class="p2p-detail-block p2p-risk-note">
          <i data-lucide="shield-alert" class="w-4 h-4"></i>
          <p class="text-xs">Risk warning: Borrower information is self-reported in this demo. Returns are not guaranteed and the borrower may delay or fail to repay.</p>
        </div>
      </div>

      <div class="mt-4">
        <h4 class="font-bold text-slate-800 text-sm mb-2">${this.modalScheduleHeading(req)}</h4>
        <table class="schedule-table">
          <thead><tr><th>Month</th><th>Principal</th><th>Interest</th><th>Balance</th></tr></thead>
          <tbody>${this.modalScheduleRows(req)}</tbody>
        </table>
      </div>

      ${canLend ? `
        <div class="mt-5 flex justify-end gap-3">
          <button class="btn btn-secondary" onclick="app.closeP2PModal('p2p-details-modal')">Close</button>
          <button class="btn btn-primary" onclick="app.closeP2PModal('p2p-details-modal'); app.openLendModal('${req.id}')"><i data-lucide="hand-coins"></i> Lend ${this.fmtINR(remaining)}</button>
        </div>
      ` : `
        <div class="mt-5 flex justify-end">
          <button class="btn btn-secondary" onclick="app.closeP2PModal('p2p-details-modal')">Close</button>
        </div>
      `}
    `;

    const modal = document.getElementById('p2p-details-modal');
    if (modal) modal.classList.remove('hidden');
    safeIcons();
  },

  // ---- Lend amount modal ----
  openLendModal(id) {
    const req = appState.p2pRequests.find(r => r.id === id);
    if (!req) return;
    appState.activeP2PLoan = req;

    const remaining = Math.max(0, req.amount - req.funded);
    const body = document.getElementById('p2p-lend-body');
    if (!body) return;

    body.innerHTML = `
      <div class="modal-head">
        <div class="bank-info">
          <div class="bank-logo-sm" style="background:${req.avatarColor}20;color:${req.avatarColor}">${req.initials}</div>
          <div>
            <h3 class="text-lg font-extrabold text-slate-900">Lend to ${req.borrowerName}</h3>
            <div class="text-xs text-slate-500">${req.purpose} &bull; ${req.rate}% p.a. &bull; ${req.tenureMonths} months</div>
          </div>
        </div>
      </div>

      <div class="card p-4 my-4">
        <div class="flex-between text-sm">
          <span class="mini-stat-label">Available Loan Request</span>
          <span class="font-bold text-slate-900">${this.fmtINR(req.amount)}</span>
        </div>
        <div class="flex-between text-sm mt-1">
          <span class="mini-stat-label">Remaining to fund</span>
          <span class="font-bold text-blue-600">${this.fmtINR(remaining)}</span>
        </div>
      </div>

      <div class="form-group mb-2">
        <label for="p2p-lend-amount">Amount you want to lend</label>
        <div class="input-icon-wrapper">
          <span class="input-prefix">₹</span>
          <input type="number" id="p2p-lend-amount" class="form-input with-prefix" min="1000" max="${remaining}" value="${Math.min(10000, remaining)}" oninput="app.updateLendPreview()" onchange="app.updateLendPreview()" />
        </div>
        <span class="text-xs text-slate-400">Minimum ₹1,000. Cannot exceed the remaining funding amount of ${this.fmtINR(remaining)}.</span>
      </div>
      <div id="p2p-lend-error" class="p2p-error hidden"></div>

      <div class="p2p-preview mt-4">
        <div class="p2p-preview-head"><i data-lucide="calculator" class="w-4 h-4"></i> Estimated Returns <span class="text-xs font-normal text-slate-400">(estimates)</span></div>
        <div class="p2p-preview-grid" id="p2p-lend-preview"></div>
      </div>

      <div class="mt-4 p2p-risk-note">
        <i data-lucide="shield-alert" class="w-4 h-4"></i>
        <p class="text-xs">Demo only — no real payment is made. Lending returns are estimates, not guaranteed.</p>
      </div>

      <div class="modal-actions flex justify-end gap-3 mt-5">
        <button class="btn btn-secondary" onclick="app.closeP2PModal('p2p-lend-modal')">Cancel</button>
        <button class="btn btn-primary" onclick="app.confirmInvestment()"><i data-lucide="check"></i> Confirm Demo Investment</button>
      </div>
    `;

    this.updateLendPreview();
    const modal = document.getElementById('p2p-lend-modal');
    if (modal) modal.classList.remove('hidden');
    safeIcons();
  },

  updateLendPreview() {
    const req = appState.activeP2PLoan;
    const remaining = req ? Math.max(0, req.amount - req.funded) : 0;
    const input = document.getElementById('p2p-lend-amount');
    const error = document.getElementById('p2p-lend-error');
    const amount = parseInt(input ? input.value : 0, 10) || 0;

    if (error) error.classList.add('hidden');
    if (input) {
      input.style.borderColor = '';
    }

    const preview = document.getElementById('p2p-lend-preview');
    if (!preview || !req) return;

    const valid = amount >= 1000 && amount <= remaining;
    if (!valid && amount > remaining) {
      if (error) { error.textContent = 'Amount exceeds the remaining funding amount of ' + this.fmtINR(remaining) + '.'; error.classList.remove('hidden'); }
      if (input) input.style.borderColor = '#ef4444';
    } else if (!valid && amount > 0) {
      if (error) { error.textContent = 'Minimum lending amount is ₹1,000.'; error.classList.remove('hidden'); }
      if (input) input.style.borderColor = '#ef4444';
    }

    const emi = valid ? this.calcEMI(amount, req.rate, req.tenureMonths / 12) : 0;
    const interest = emi * req.tenureMonths - amount;
    const total = emi * req.tenureMonths;

    preview.innerHTML = `
      <div><div class="mini-stat-label">Investment Amount</div><div class="mini-stat-val text-blue-600">${this.fmtINR(amount)}</div></div>
      <div><div class="mini-stat-label">Interest Rate</div><div class="mini-stat-val text-emerald-600">${req.rate}% p.a.</div></div>
      <div><div class="mini-stat-label">Estimated Interest Earned</div><div class="mini-stat-val text-emerald-600">${this.fmtINR(Math.max(0, Math.round(interest)))}</div></div>
      <div><div class="mini-stat-label">Estimated Total Repayment</div><div class="mini-stat-val">${this.fmtINR(Math.round(total))}</div></div>
      <div><div class="mini-stat-label">Estimated Monthly Repayment</div><div class="mini-stat-val">${this.fmtINR(emi)}</div></div>
    `;
  },

  confirmInvestment() {
    const req = appState.activeP2PLoan;
    if (!req) return;
    const remaining = Math.max(0, req.amount - req.funded);
    const amount = parseInt((document.getElementById('p2p-lend-amount') || {}).value, 10) || 0;

    if (amount < 1000) { toast('Minimum lending amount is ₹1,000.'); return; }
    if (amount > remaining) {
      toast('Amount cannot exceed the remaining funding amount of ' + this.fmtINR(remaining) + '.');
      return;
    }

    // Update request funding
    req.funded += amount;
    if (req.funded >= req.amount) req.status = 'full';

    // Create the investment
    appState.p2pInvestments.unshift({
      id: 'inv-' + Date.now(),
      requestId: req.id,
      borrowerName: req.borrowerName,
      initials: req.initials,
      purpose: req.purpose,
      amount,
      rate: req.rate,
      tenureMonths: req.tenureMonths,
      monthsElapsed: 0,
      status: 'Repaying'
    });

    // Seed a chat conversation
    if (!appState.p2pMessages[req.id]) {
      const now = new Date();
      appState.p2pMessages[req.id] = [
        { from: 'borrower', text: 'Thank you for funding my loan. I will make the first repayment on the scheduled date.', time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) },
        { from: 'me', text: "You're welcome. Please let me know if there is any issue with the repayment schedule.", time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }
      ];
    }

    this.persistP2P();
    this.closeP2PModal('p2p-lend-modal');
    this.renderP2P();
    toast('Demo investment of ' + this.fmtINR(amount) + ' confirmed in ' + req.borrowerName + ' (' + req.purpose + '). No real money was transferred.');
  },

  // ---- Portfolio ----
  renderPortfolio() {
    const container = document.getElementById('p2p-portfolio');
    if (!container) return;

    const now = new Date().getTime();
    let totalInvested = 0;
    let expectedReturns = 0;
    let interestEarned = 0;
    let activeCount = 0;

    const investments = appState.p2pInvestments.map(inv => {
      // Simulate progress over time for demo
      const rate = inv.rate, tenure = inv.tenureMonths;
      const amort = this.amend(inv.amount, rate, tenure, inv.monthsElapsed);
      const totalRepayment = amort.emi * tenure;
      const expectedInterest = Math.max(0, totalRepayment - inv.amount);
      totalInvested += inv.amount;
      expectedReturns += expectedInterest;
      interestEarned += amort.interestPaid;
      if (inv.status === 'Repaying') activeCount++;
      return { ...inv, amort, expectedInterest };
    });

    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set('p2p-total-invested', this.fmtINR(totalInvested));
    set('p2p-expected-returns', this.fmtINR(expectedReturns));
    set('p2p-interest-earned', this.fmtINR(interestEarned));
    set('p2p-active-loans', activeCount);

    if (investments.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-500 col-span-2">
          <i data-lucide="wallet" class="w-12 h-12 mx-auto mb-2 text-slate-300"></i>
          <h4 class="font-bold text-slate-700">No Investments Yet</h4>
          <p class="text-sm">Lend to a borrower in the marketplace to build your P2P portfolio.</p>
        </div>
      `;
    } else {
      container.innerHTML = investments.map(inv => `
        <div class="bank-card">
          <div class="bank-card-header">
            <div class="bank-info">
              <div class="bank-logo-sm">${inv.initials}</div>
              <div>
                <h4 class="font-bold text-slate-900">${inv.purpose}</h4>
                <div class="text-xs text-slate-500">${inv.borrowerName}</div>
              </div>
            </div>
            <span class="tag-pill tag-pill-blue">${inv.status}</span>
          </div>
          <div class="card-metrics-grid">
            <div><div class="text-xs text-slate-400">Invested</div><div class="text-xs font-semibold text-slate-700">${this.fmtINR(inv.amount)}</div></div>
            <div><div class="text-xs text-slate-400">Rate</div><div class="text-xs font-semibold text-slate-700">${inv.rate}%</div></div>
            <div><div class="text-xs text-slate-400">Tenure</div><div class="text-xs font-semibold text-slate-700">${inv.tenureMonths} mo</div></div>
          </div>
          <div class="rate-banner mt-3">
            <div>
              <span class="text-xs text-slate-500 font-medium">Monthly Expected</span>
              <div class="font-bold text-slate-800 text-sm mt-0.5">${this.fmtINR(inv.amort.emi)}</div>
            </div>
            <div class="text-right">
              <span class="text-xs text-slate-500 font-medium">Principal Repaid</span>
              <div class="font-bold text-emerald-600 text-sm mt-0.5">${this.fmtINR(inv.amort.principalRepaid)}</div>
            </div>
          </div>
          <div class="card-metrics-grid">
            <div><div class="text-xs text-slate-400">Interest Earned</div><div class="text-xs font-semibold text-emerald-600">${this.fmtINR(inv.amort.interestPaid)}</div></div>
            <div><div class="text-xs text-slate-400">Remaining Balance</div><div class="text-xs font-semibold text-slate-700">${this.fmtINR(inv.amort.remainingBalance)}</div></div>
            <div><div class="text-xs text-slate-400">Expected Returns</div><div class="text-xs font-semibold text-emerald-600">${this.fmtINR(inv.expectedInterest)}</div></div>
          </div>
          <div class="bank-card-footer">
            <button class="btn btn-primary btn-sm flex-1" onclick="app.openChat('${inv.requestId}', 'investor')"><i data-lucide="message-circle"></i> Chat</button>
          </div>
        </div>
      `).join('');
    }
    safeIcons();
  },

  // ---- My Loan Requests (borrower) ----
  renderMyRequests() {
    const container = document.getElementById('p2p-my-requests');
    if (!container) return;

    const mine = appState.p2pRequests.filter(r => r.isMine);
    if (mine.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-500 col-span-2">
          <i data-lucide="file-plus-2" class="w-12 h-12 mx-auto mb-2 text-slate-300"></i>
          <h4 class="font-bold text-slate-700">No Loan Requests Yet</h4>
          <p class="text-sm">Use the form above to post your first loan request.</p>
        </div>
      `;
    } else {
      container.innerHTML = mine.map(req => {
        const pct = req.amount ? Math.min(100, Math.round((req.funded / req.amount) * 100)) : 0;
        const remaining = Math.max(0, req.amount - req.funded);
        const hasFunding = req.funded > 0;
        return `
          <div class="bank-card">
            <div class="bank-card-header">
              <div class="bank-info">
                <div class="bank-logo-sm" style="background:${req.avatarColor}20;color:${req.avatarColor}">${req.initials}</div>
                <div>
                  <h4 class="font-bold text-slate-900">${req.purpose}</h4>
                  <div class="text-xs text-slate-500">Posted ${req.requestedDate} &bull; ${req.rate}% p.a. &bull; ${req.tenureMonths} months</div>
                </div>
              </div>
              ${this.requestStatusBadge(req)}
            </div>
            <div class="p2p-borrower-amounts mb-3">
              <div><span class="mini-stat-label">Requested</span><span class="mini-stat-val">${this.fmtINR(req.amount)}</span></div>
              <div><span class="mini-stat-label">Funded</span><span class="mini-stat-val text-emerald-600">${this.fmtINR(req.funded)}</span></div>
              <div><span class="mini-stat-label">Remaining</span><span class="mini-stat-val text-blue-600">${this.fmtINR(remaining)}</span></div>
            </div>
            ${this.fundingProgressHTML(req)}
            <div class="bank-card-footer mt-3">
              ${hasFunding
                ? `<button class="btn btn-primary btn-sm flex-1" onclick="app.openChat('${req.id}', 'borrower')"><i data-lucide="message-circle"></i> Chat with Lender</button>`
                : `<span class="text-xs text-slate-400 flex items-center gap-2 flex-1"><i data-lucide="clock" class="w-3.5 h-3.5"></i> Waiting for lenders to fund this request</span>`}
              ${req.funded < req.amount
                ? `<button class="btn btn-outline btn-sm btn-remove" id="remove-req-${req.id}" onclick="app.startRemoveRequest('${req.id}')"><i data-lucide="trash-2"></i> Remove</button>`
                : ''}
            </div>
          </div>
        `;
      }).join('');
    }
    safeIcons();
  },

  // ---- Recommended Matches ----
  renderBorrowerMatches() {
    const container = document.getElementById('p2p-borrower-matches');
    if (!container) return 0;

    if (!appState.p2pBorrowerMatchesVisible) {
      container.innerHTML = p2pMatchPlaceholder('Fill in your loan details and click <strong>Find Matching Lenders</strong> to see which lenders fund requests like yours.');
      safeIcons();
      return 0;
    }

    const draft = this.currentBorrowerDraft();
    const mine = appState.p2pRequests.filter(r => r.isMine && r.status === 'open');
    const sampleReq = draft.amount > 0
      ? draft
      : (mine[0] || appState.p2pRequests.find(r => r.isMine) || appState.p2pRequests[0]);
    if (!sampleReq) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-500 col-span-2">
          <i data-lucide="users" class="w-10 h-10 mx-auto mb-2 text-slate-300"></i>
          <h4 class="font-bold text-slate-700">No lender matches yet</h4>
          <p class="text-sm">Fill in your loan details and click <strong>Find Matching Lenders</strong>.</p>
        </div>
      `;
      safeIcons();
      return 0;
    }

    const lenders = [...P2P_DEMO_LENDERS]
      .map(l => ({ ...l, score: this.borrowerMatchScore(l, sampleReq) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    container.innerHTML = lenders.map(l => `
      <div class="p2p-match-card p2p-match-card-click" onclick="app.openChat('lender:${l.name}|${l.initials}', 'lender')">
        <div class="bank-info">
          <div class="bank-logo-sm" style="background:#eff6ff;color:#2563eb">${l.initials}</div>
          <div>
            <h4 class="font-bold text-slate-900 text-sm">${l.name}</h4>
            <div class="text-xs text-slate-500">Lender &bull; up to ${l.maxRate}% p.a.</div>
          </div>
        </div>
        <div class="p2p-match-score">${l.score}% Match</div>
        <div class="text-xs text-slate-500 mt-2">Fits your amount (${this.fmtINR(sampleReq.amount)}), tenure (${sampleReq.tenureMonths} mo) and rate (${sampleReq.rate}% max).</div>
        <div class="mt-2">
          <button class="btn btn-primary btn-sm w-full" onclick="event.stopPropagation(); app.openChat('lender:${l.name}|${l.initials}', 'lender')"><i data-lucide="message-circle"></i> Message Lender</button>
        </div>
      </div>
    `).join('');
    safeIcons();
    return lenders.length;
  },

  findLenderMatches() {
    const amount = parseInt(this.getBorrowerField('p2p-lender-amount'), 10) || 0;
    const maxRate = parseFloat(this.getBorrowerField('p2p-lender-maxrate')) || 0;
    const risk = this.getBorrowerField('p2p-lender-risk') || 'medium';
    const tenureMax = parseInt(this.getBorrowerField('p2p-lender-tenure'), 10) || 24;

    if (amount < 5000) { toast('Please enter a lending amount of at least ₹5,000.'); return; }
    if (maxRate < 5 || maxRate > 24) { toast('Please enter a maximum interest rate between 5% and 24%.'); return; }

    appState.p2pLenderPref = { amount, maxRate, riskTolerance: risk, tenureMax };
    appState.p2pLenderMatchesVisible = true;
    this.renderMarketplace();
    this.renderLenderMatches();
    safeIcons();
    const target = document.getElementById('p2p-lender-matches');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  syncLenderPrefInputs() {
    const pref = appState.p2pLenderPref || { amount: 50000, maxRate: 15, riskTolerance: 'medium', tenureMax: 24 };
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v;
    };
    set('p2p-lender-amount', pref.amount);
    set('p2p-lender-maxrate', pref.maxRate);
    set('p2p-lender-risk', pref.riskTolerance);
    set('p2p-lender-tenure', pref.tenureMax);
  },

  renderLenderMatches() {
    const container = document.getElementById('p2p-lender-matches');
    if (!container) return 0;

    if (!appState.p2pLenderMatchesVisible) {
      container.innerHTML = p2pMatchPlaceholder('Set your lending preferences and click <strong>Find Borrowers</strong> to see ranked matches.');
      safeIcons();
      return 0;
    }

    const scored = this.visibleMarketplaceRequests()
      .filter(r => this.openMatchesCount(r))
      .map(r => ({ ...r, score: this.lenderMatchScore(r) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (scored.length === 0) {
      container.innerHTML = p2pMatchPlaceholder('No borrowers match your current preferences. Loosen the rate, risk or amount and try again.');
      safeIcons();
      return 0;
    }

    container.innerHTML = scored.map(r => `
      <div class="p2p-match-card p2p-match-card-click" onclick="app.openLendModal('${r.id}')">
        <div class="bank-info">
          <div class="bank-logo-sm" style="background:${r.avatarColor}20;color:${r.avatarColor}">${r.initials}</div>
          <div>
            <h4 class="font-bold text-slate-900 text-sm">${r.borrowerName}</h4>
            <div class="text-xs text-slate-500">${r.purpose} &bull; ${r.rate}% p.a. &bull; ${r.tenureMonths} mo</div>
          </div>
        </div>
        <div class="p2p-match-score">${r.score}% Match</div>
        <div class="mt-2">
          <button class="btn btn-primary btn-sm w-full" onclick="event.stopPropagation(); app.openLendModal('${r.id}')"><i data-lucide="hand-coins"></i> Lend ${this.fmtINR(Math.max(0, r.amount - r.funded))}</button>
        </div>
      </div>
    `).join('');
    safeIcons();
  },

  // ---- Chat ----
  openChat(requestId, who) {
    let req;
    if (typeof requestId === 'string' && requestId.indexOf('lender:') === 0) {
      const parts = requestId.split('|');
      req = {
        id: requestId,
        lenderName: (parts[0] || 'lender:').replace('lender:', '') || 'Lender',
        initials: parts[1] || 'LR'
      };
    } else {
      req = appState.p2pRequests.find(r => r.id === requestId);
    }
    if (!req) return;
    appState.activeP2PLoan = req;

    const body = document.getElementById('p2p-chat-body');
    if (!body) return;

    let headerName, peerInitials, peerColor, sub;
    if (who === 'lender') {
      headerName = req.lenderName || 'Lender';
      peerInitials = req.initials || 'LR';
      peerColor = '#059669';
      sub = 'Recommended lender &bull; interested in funding your request';
    } else if (who === 'investor') {
      headerName = req.borrowerName;
      peerInitials = req.initials;
      peerColor = req.avatarColor;
      sub = req.purpose;
    } else {
      headerName = req.lenderName || 'Lender';
      peerInitials = 'LR';
      peerColor = '#059669';
      sub = req.purpose + ' &bull; ' + (req.lenderName || 'Lender');
    }

    body.innerHTML = `
      <div class="chat-header">
        <div class="bank-info">
          <div class="bank-logo-sm" style="background:${peerColor}20;color:${peerColor}">${peerInitials}</div>
          <div>
            <h3 class="font-bold text-slate-900">Chat with ${headerName}</h3>
            <div class="text-xs text-slate-500">${sub}</div>
          </div>
        </div>
        <button class="modal-close-btn" onclick="app.closeP2PModal('p2p-chat-modal')"><i data-lucide="x"></i></button>
      </div>
      <div class="chat-messages" id="chat-messages"></div>
      <div class="chat-input-row">
        <input type="text" id="chat-input" class="form-input" placeholder="Type a message..." maxlength="200" onkeydown="if(event.key==='Enter')app.sendChatMessage()" />
        <button class="btn btn-primary" onclick="app.sendChatMessage()"><i data-lucide="send"></i></button>
      </div>
    `;

    this.renderChat();
    const modal = document.getElementById('p2p-chat-modal');
    if (modal) modal.classList.remove('hidden');
    safeIcons();

    const messagesEl = document.getElementById('chat-messages');
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    const input = document.getElementById('chat-input');
    if (input) setTimeout(() => input.focus(), 100);
  },

  renderChat() {
    const req = appState.activeP2PLoan;
    const container = document.getElementById('chat-messages');
    if (!container || !req) return;

    const conv = appState.p2pMessages[req.id] || [];
    if (conv.length === 0) {
      container.innerHTML = `<div class="text-center text-slate-400 text-xs p-4">No messages yet. Say hello to your peer!</div>`;
      return;
    }

    container.innerHTML = conv.map(m => {
      const mine = m.from === 'me';
      return `
        <div class="chat-msg ${mine ? 'chat-msg-mine' : 'chat-msg-theirs'}">
          <div class="chat-bubble">${m.text}</div>
          <div class="chat-time">${m.time}</div>
        </div>
      `;
    }).join('');
    container.scrollTop = container.scrollHeight;
  },

  sendChatMessage() {
    const req = appState.activeP2PLoan;
    const input = document.getElementById('chat-input');
    if (!req || !input) return;
    const text = input.value.trim();
    if (!text) return;

    if (!appState.p2pMessages[req.id]) appState.p2pMessages[req.id] = [];
    appState.p2pMessages[req.id].push({
      from: 'me',
      text,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    });
    input.value = '';
    this.persistP2P();
    this.renderChat();
  },

  closeP2PModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  },

  // 8b. Customer Support Chatbot
  bindSupportWidget() {
    const input = document.getElementById('support-input');
    if (!input) return;
    const widget = document.getElementById('support-widget');
    if (widget) {
      widget.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.toggleSupportWidget(false);
      });
    }
    if (widget && !this._supportLoaded) {
      this._supportLoaded = true;
      this.addSupportMessage('bot', 'Hi Alex 👋 Welcome to LoanFinder! I can help you with loans, EMI, eligibility, documents, hidden charges, P2P lending and branches. Ask me anything or tap a shortcut below.');
      this.renderSupportQuickReplies();
    }
  },

  toggleSupportWidget(force) {
    const panel = document.getElementById('support-panel');
    const fab = document.getElementById('support-fab');
    if (!panel || !fab) return;

    const shouldOpen = typeof force === 'boolean' ? force : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !shouldOpen);
    fab.classList.toggle('support-fab-open', shouldOpen);

    if (shouldOpen) {
      this.bindSupportWidget();
      const input = document.getElementById('support-input');
      if (input) setTimeout(() => input.focus(), 120);
    }
  },

  addSupportMessage(role, text) {
    const container = document.getElementById('support-messages');
    if (!container) return;
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const isBot = role === 'bot';
    container.insertAdjacentHTML('beforeend', `
      <div class="chat-msg ${isBot ? 'chat-msg-theirs' : 'chat-msg-mine'}">
        <div class="chat-bubble">${text}</div>
        <div class="chat-time">${time}</div>
      </div>
    `);
    container.scrollTop = container.scrollHeight;
    safeIcons();
  },

  renderSupportQuickReplies() {
    const container = document.getElementById('support-quick');
    if (!container) return;
    const chips = [
      'How do I apply?',
      'What documents are needed?',
      'Explain hidden charges',
      'How does P2P lending work?',
      'EMI for my loan',
      'Talk to a human'
    ];
    container.innerHTML = chips.map(c => `<button class="support-chip" onclick="app.quickSupport('${c.replace(/'/g, "\\'")}')">${c}</button>`).join('');
  },

  quickSupport(text) {
    this.toggleSupportWidget(true);
    const input = document.getElementById('support-input');
    if (input) input.value = text;
    this.sendSupportMessage();
  },

  sendSupportMessage() {
    const input = document.getElementById('support-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    this.addSupportMessage('me', text.replace(/[<>&]/g, ''));
    this.showSupportTyping();
    setTimeout(() => {
      this.hideSupportTyping();
      const reply = this.supportBotReply(text);
      this.addSupportMessage('bot', reply);
    }, 850 + Math.random() * 600);
  },

  showSupportTyping() {
    const container = document.getElementById('support-messages');
    if (!container) return;
    container.insertAdjacentHTML('beforeend', `
      <div class="chat-msg chat-msg-theirs" id="support-typing">
        <div class="chat-bubble support-typing-bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
      </div>
    `);
    container.scrollTop = container.scrollHeight;
  },

  hideSupportTyping() {
    const t = document.getElementById('support-typing');
    if (t) t.remove();
  },

  supportBotReply(text) {
    const t = text.toLowerCase();
    const money = n => '₹' + Math.round(n).toLocaleString('en-IN');

    if (/\b(hi|hii|hello|hey|namaste|greetings)\b/.test(t)) {
      return 'Hello again! 😊 How can I help you today? You can ask about <strong>applying for a loan</strong>, <strong>documents</strong>, <strong>EMI/rates</strong>, <strong>hidden charges</strong>, <strong>P2P lending</strong> or <strong>branches</strong>.';
    }
    if (/(bye|goodbye|thank|thanks|great|awesome|nice)/.test(t)) {
      return 'You\u2019re welcome! 🙌 If you need anything else, just type here. Wish you a great loan experience!';
    }
    if (/(human|agent|executive|representative|talk to someone|support person|complaint|escalat|real person)/.test(t)) {
      return 'I\u2019d love to connect you with a human! 🧑‍💼 You can reach our loan experts at <strong>1800-419-0000</strong> (toll-free, 9 AM - 9 PM) or email <strong>support@loanfinder.in</strong>. Average response time is under 5 minutes.';
    }
    if (/(hidden charge|hidden|fine print|processing fee|prepayment|foreclosure|prepayment|penalt)/.test(t)) {
      const offer = appState.activeBankDetails || BANK_OFFERS[0];
      return `Great question! Each bank lists <em>hidden charges</em> beyond the advertised rate. We've added a dedicated tab on every bank's <strong>Details & Docs</strong> page. For example, ${offer.bankName} shows ${(HIDDEN_CHARGES[offer.id] || []).length} charges (legal/vetting, stamp duty, EMI bounce, late payment etc.). Open <strong>Details & Docs &rarr; Hidden Charges</strong> to see the <strong>Total You Pay including hidden fees</strong> based on your loan amount.`;
    }
    if (/(emi|interest|rate|amount|monthly)/.test(t)) {
      const amount = appState.loanAmount || 3500000;
      const years = appState.loanTenureYears || 20;
      const rate = (appState.activeBankDetails || BANK_OFFERS[0]).interestRate || 8;
      const emi = this.calcEMI(amount, rate, years);
      const total = emi * years * 12;
      return `For a ${money(amount)} loan at ${rate}% p.a. over ${years} years, your estimated EMI is <strong>${money(emi)}/mo</strong> and total repayment is ${money(total)}. Change the amount, tenure or income on the Dashboard and click <strong>Find Matching Loan</strong> to see your top 3 banks.`;
    }
    if (/(apply|eligib|qualify|how do i|process|sanction)/.test(t)) {
      return 'Applying is easy! 🚀 (1) Fill your income, credit score and loan details on the <strong>Dashboard</strong>. (2) Click <strong>Find Matching Loan</strong> to see your top 3 banks. (3) Hit <strong>Details &amp; Docs</strong> on any card to check the checklist, then download or upload documents. Timelines after you submit are set by the bank, not by this app.';
    }
    if (/(document|papers|cheque|checklist|itr|salary slip|pan|identity)/.test(t)) {
      return 'Typical documents: 🪪 <strong>Identity</strong> (PAN + Aadhaar/Driving License), 🏠 <strong>Address proof</strong> (electricity bill/rent agreement), 💰 <strong>Income proof</strong> (3 salary slips), 🏦 <strong>6-month bank statements</strong> and <strong>ITR/Form 16</strong> for the last 2 years. Open a bank\u2019s <strong>Details &amp; Docs</strong> page and hit <strong>Download Checklist</strong> for the full list.';
    }
    if (/(p2p|lend|borrow|peer to peer|invest)/.test(t)) {
      return 'P2P lending connects you directly with other users. 💸 To <strong>borrow</strong>: give your amount, rate and tenure, hit <strong>Find Matching Lenders</strong>, then message a lender. To <strong>lend</strong>: set your amount, max rate, risk and tenure in the investor panel, hit <strong>Find Borrowers</strong>, then click <strong>Lend</strong> on any match. Your portfolio tracker updates instantly.';
    }
    if (/(branch|locat|atm|office|visit|bank find)/.test(t)) {
      return '📍 To find branches: open any bank\u2019s <strong>Details &amp; Docs</strong> page and click the <strong>Branches</strong> tab, or press <strong>Branches</strong> on any loan card. You\u2019ll get branch cards plus a live map for Mumbai, Delhi or your city.';
    }
    if (/(save|bookmark|saved|favourite|favorite)/.test(t)) {
      return '⭐ You can save any offer using the <strong>bookmark icon</strong> on its card (including the top-3 recommendations). Open <strong>Saved Results</strong> in the sidebar to compare or remove them anytime.';
    }
    if (/(oi|hey there|yo)/.test(t)) {
      return 'Hey! 👋 What would you like to know about LoanFinder today?';
    }
    return `I\u2019m not 100% sure about that one. 🤔 Try asking about <strong>loan eligibility</strong>, <strong>EMI</strong>, <strong>documents</strong>, <strong>hidden charges</strong>, <strong>P2P lending</strong>, <strong>branches</strong> or <strong>saved offers</strong> - or say <strong>"talk to a human"</strong> to reach our team.`;
  },

  // 9. Auth Page (Login / Sign Up)
  bindAuthModal() {
    const closeBtn = document.getElementById('auth-page-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeAuth());
    }

    const backBtn = document.getElementById('auth-back-link');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.closeAuth();
      });
    }
  },

  // Prototype sign-in. Validates the form in the browser only - there is no
  // server, so nothing is transmitted and no credential is stored.
  activeAuthTab() {
    const signupTab = document.getElementById('auth-tab-signup');
    if (signupTab && signupTab.classList.contains('active')) return 'signup';
    const signupForm = document.getElementById('auth-signup-form');
    if (signupForm && signupForm.style.display !== 'none' && signupForm.style.display !== '') return 'signup';
    return 'login';
  },

  handleAuthSuccess() {
    const isLogin = this.activeAuthTab() === 'login';
    const problems = [];
    let name = 'there';

    if (isLogin) {
      const email = (document.getElementById('login-email').value || '').trim();
      const pass = document.getElementById('login-password').value || '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) problems.push('Enter a valid email address');
      if (pass.length < 8) problems.push('Password must be at least 8 characters');
      name = email.split('@')[0] || name;
    } else {
      const first = (document.getElementById('signup-first').value || '').trim();
      const last = (document.getElementById('signup-last').value || '').trim();
      const email = (document.getElementById('signup-email').value || '').trim();
      const pass = document.getElementById('signup-password').value || '';
      if (first.length < 2) problems.push('Enter your first name');
      if (last.length < 2) problems.push('Enter your last name');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) problems.push('Enter a valid email address');
      if (pass.length < 8) problems.push('Password must be at least 8 characters');
      if (pass.length > 0 && !/\d/.test(pass)) problems.push('Include at least one number in the password');
      name = (first + ' ' + last).trim() || name;
    }

    if (problems.length) {
      toast(problems[0], 'error');
      return;
    }

    this.launchApp();
    toast('Welcome, ' + name + '! This prototype runs entirely in your browser - no credentials were sent or stored.');
  },
};

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
