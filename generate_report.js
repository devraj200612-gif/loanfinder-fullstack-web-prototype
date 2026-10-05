const fs = require('fs');
const path = require('path');
const pdfMake = require('pdfmake');

const ROBOTO = path.join(__dirname, 'node_modules/pdfmake/build/fonts/Roboto');
pdfMake.setLocalAccessPolicy((p) => path.normalize(p).indexOf(path.normalize(ROBOTO)) === 0);
pdfMake.setUrlAccessPolicy(() => false);
pdfMake.addFonts({
  Roboto: {
    normal: path.join(ROBOTO, 'Roboto-Regular.ttf'),
    bold: path.join(ROBOTO, 'Roboto-Medium.ttf'),
    italics: path.join(ROBOTO, 'Roboto-Italic.ttf'),
    bolditalics: path.join(ROBOTO, 'Roboto-MediumItalic.ttf')
  }
});

const BRAND = {
  primary: '#2563eb',
  navy: '#0f172a',
  emerald: '#10b981',
  slate: '#64748b',
  light: '#f8fafc',
  border: '#e2e8f0'
};

function header() {
  return {
    margin: [40, 20, 40, 0],
    columns: [
      { text: 'LOANFINDER', color: BRAND.primary, bold: true, fontSize: 11 },
      { text: 'Project Status Report', color: BRAND.navy, fontSize: 11, alignment: 'right' }
    ]
  };
}

function footer(page, total) {
  return {
    margin: [40, 10, 40, 20],
    text: `Page ${page} of ${total}  ·  HackIndia 2026 Submission`,
    alignment: 'right',
    fontSize: 8,
    color: BRAND.slate
  };
}

const def = {
  pageSize: 'A4',
  pageMargins: [40, 50, 40, 50],
  defaultStyle: { font: 'Roboto' },
  info: {
    title: 'LoanFinder — Project Status Report',
    author: 'LoanFinder Team',
    subject: 'HackIndia 2026 Submission Status Report'
  },
  footer,
  content: []
};

// ---------------- COVER PAGE ----------------
def.content.push(
  { text: 'LOANFINDER', fontSize: 42, bold: true, color: BRAND.primary, alignment: 'center', margin: [0, 90, 0, 6] },
  { text: 'Modern Loan Comparison & P2P Lending Platform', fontSize: 16, color: BRAND.navy, alignment: 'center', margin: [0, 0, 0, 30] },
  { text: 'PROJECT STATUS REPORT', fontSize: 22, bold: true, color: BRAND.navy, alignment: 'center', margin: [0, 20, 0, 10] },
  { text: 'A complete overview of what has been built, how it works,\nand where the project currently stands.', alignment: 'center', color: BRAND.slate, fontSize: 12, margin: [40, 0, 40, 40], lineHeight: 1.5 },
  { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: BRAND.border }], margin: [40, 0, 40, 24] },
  {
    columns: [
      { text: 'Prepared for / by', fontSize: 9, color: BRAND.slate },
      { text: 'Date', fontSize: 9, color: BRAND.slate, alignment: 'right' }
    ],
    margin: [40, 0, 40, 4]
  },
  {
    columns: [
      { text: 'HackIndia 2026 Demo Team', fontSize: 11, bold: true, color: BRAND.navy },
      { text: 'September 2026', fontSize: 11, bold: true, color: BRAND.navy, alignment: 'right' }
    ],
    margin: [40, 0, 40, 0]
  }
);

// ---------------- TABLE OF CONTENTS ----------------
const tocSections = [
  ['1. Executive Summary', 1],
  ['2. Product Purpose & Positioning', 1],
  ['3. Technology & Architecture', 2],
  ['4. How the App Works (User Flows)', 2],
  ['5. Features Implemented', 3],
  ['6. The P2P Lending Marketplace', 5],
  ['7. Data Model & Persistence', 6],
  ['8. Demo Data & Constraints', 7],
  ['9. Current Stand & Verification', 7],
  ['10. How to Run', 7],
  ['11. Next Steps', 8]
];

def.content.push(
  { text: 'Table of Contents', fontSize: 18, bold: true, color: BRAND.navy, margin: [0, 40, 0, 16] },
  ...tocSections.map(([title]) => ({
    columns: [
      { text: title, fontSize: 11, color: BRAND.navy, margin: [0, 3, 0, 3] },
    ],
    canvas: [{ type: 'line', x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 0.5, lineColor: BRAND.border }]
  })),
  { text: '', fontSize: 8 }
);

// ---------------- SECTION 1 ----------------
def.content.push(
  { text: '1. Executive Summary', fontSize: 16, bold: true, color: BRAND.primary, margin: [0, 30, 0, 10] },
  { text: 'LoanFinder is a browser-based fintech web application built as a self-contained demo for HackIndia 2026. It lets individual borrowers in India compare advertised loan rates side-by-side across 5 real Indian banks (7 published offers), calculate exact EMIs, check eligibility, locate branches on a live map, follow a document checklist, and additionally borrow or lend money in a built-in peer-to-peer (P2P) marketplace. The working pair "consumer borrower + P2P lender" is the core concept the team presents to judges.', fontSize: 10, color: BRAND.navy, lineHeight: 1.5, margin: [0, 0, 0, 8] },
  { text: 'The entire application runs as a static vanilla HTML/CSS/JavaScript codebase in the folder p1/ — no framework, no build step, no server required. It is fully offline-capable (Lucide icons and the Leaflet map library are vendored locally) and works by simply opening index.html or serving the folder with any static server. All app state is held in memory and persisted to the browser\'s localStorage.', fontSize: 10, color: BRAND.navy, lineHeight: 1.5 },
  {
    style: 'summaryBox',
    margin: [0, 14, 0, 0],
    table: {
      widths: ['33%', '33%', '34%'],
      body: [
        [{ text: 'Starting rate', bold: true, alignment: 'center', fillColor: BRAND.light }, { text: 'Partner banks', bold: true, alignment: 'center', fillColor: BRAND.light }, { text: 'Status', bold: true, alignment: 'center', fillColor: BRAND.light }],
        [{ text: '7.85% p.a.*', alignment: 'center', color: BRAND.emerald, bold: true }, { text: '5', alignment: 'center', bold: true }, { text: 'Working demo', alignment: 'center', bold: true, color: BRAND.emerald }]
      ]
    }
  },
  { text: 'The catalogue contains 5 real Indian banks (State Bank, HDFC Bank, ICICI Bank, Axis Bank, Kotak Mahindra) publishing 7 verified offers across 2 loan categories. Rates shown are advertised starting rates, not quotes. Any scale or security claim such as "25+ banks", "25,000+ borrowers" or "₹1,500 Cr+ facilitated" would be unsupported and is deliberately not made.', fontSize: 8, color: BRAND.slate, margin: [0, 6, 0, 0], italic: true }
);

// ---------------- SECTION 2 ----------------
def.content.push(
  { text: '2. Product Purpose & Positioning', fontSize: 16, bold: true, color: BRAND.primary, margin: [0, 30, 0, 10] },
  { text: 'Problem being solved', bold: true, fontSize: 11, color: BRAND.navy, margin: [0, 0, 0, 4] },
  { text: 'Choosing a loan in India means visiting many bank websites, comparing confusing advertised rates, hidden charges and document requirements, and having no single place to track it all. LoanFinder turns that multi-day research into a single dashboard where a visitor goes from "which loan should I pick" to a confident, comparison-backed loan decision (or a completed P2P funding match) in minutes.', fontSize: 10, color: BRAND.navy, lineHeight: 1.5, margin: [0, 0, 0, 10] },
  { text: 'Core users', bold: true, fontSize: 11, color: BRAND.navy, margin: [0, 0, 0, 4] },
  {
    ul: [
      { text: 'Consumer borrowers comparing home, personal and auto loans across banks to find the best advertised rate and lowest EMI before applying.', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] },
      { text: 'P2P marketplace participants — borrowers posting funding requests and lenders funding vetted borrowers.', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] }
    ],
    margin: [0, 0, 0, 10]
  },
  { text: 'What makes it different', bold: true, fontSize: 11, color: BRAND.navy, margin: [0, 0, 0, 4] },
  { text: 'The combination a neighboring product could not truthfully copy: side-by-side comparison of advertised bank offers (not invented aggregate rates) joined with branch-level discovery, an eligibility checker, document readiness, hidden-charge transparency, and a built-in P2P lending marketplace — all in one interface.', fontSize: 10, color: BRAND.navy, lineHeight: 1.5 }
);

// ---------------- SECTION 3 ----------------
def.content.push(
  { text: '3. Technology & Architecture', fontSize: 16, bold: true, color: BRAND.primary, margin: [0, 30, 0, 10] },
  {
    table: {
      widths: ['34%', '66%'],
      body: [
        [{ text: 'Aspect', bold: true, fillColor: BRAND.navy, color: '#fff' }, { text: 'Detail', bold: true, fillColor: BRAND.navy, color: '#fff' }],
        [{ text: 'Platform', bold: true }, 'Web (browser), no-build static demo — runs offline except the branch map basemap, which needs internet'],
        [{ text: 'Stack', bold: true }, 'Vanilla HTML5 + CSS3 + JavaScript (ES6) — no framework, no build step'],
        [{ text: 'Files', bold: true }, 'p1/index.html · p1/styles.css · p1/app.js · p1/README.md'],
        [{ text: 'Vendored libraries', bold: true }, 'Lucide icons (safeIcons wrapper), MapLibre GL (primary map engine) and Leaflet (fallback) — saved in p1/vendor/ so the app loads with no CDN. Basemap tiles are still fetched at runtime from openfreemap.org and Esri'],
        [{ text: 'State management', bold: true }, 'Single appState object in memory plus a tiny localStorage document store ("LoanFinder DB v1")'],
        [{ text: 'Fonts / style', bold: true }, 'Plus Jakarta Sans preference; primary blue #2563eb, navy sidebar #0f172a, emerald #10b981'],
        [{ text: 'Number conventions', bold: true }, 'Indian ₹ formatting with lakh/crore; English copy'],
        [{ text: 'Run method', bold: true }, 'Double-click index.html OR any static server (python -m http.server 3000 or npx serve .)']
      ]
    },
    layout: 'lightHorizontalLines'
  },
  { text: 'EMI formula used throughout: EMI = P · r · (1+r)^n / ((1+r)^n − 1), where r is the monthly rate and n the number of months. The same engine powers the comparison cards, eligibility checker and P2P estimated-return previews.', fontSize: 9, color: BRAND.navy, lineHeight: 1.4, margin: [0, 10, 0, 0] }
);

// ---------------- SECTION 4 ----------------
def.content.push(
  { text: '4. How the App Works (User Flows)', fontSize: 16, bold: true, color: BRAND.primary, margin: [0, 30, 0, 10] },
  { text: 'Borrower / comparison flow', bold: true, fontSize: 11, color: BRAND.navy, margin: [0, 0, 0, 4] },
  {
    ol: [
      { text: 'Land on the public landing page → Sign In (demo auth) enters the dashboard.', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] },
      { text: 'Choose loan type(s) — Home, Personal, Car, Education, Business or Gold.', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] },
      { text: 'Set loan amount (slider ₹1 lakh to ₹1.5 crore), tenure, annual income, employment type and credit score.', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] },
      { text: 'Press "Find Matching Loan" — the top-3 ranked recommendations unlock (scored by rate, credit-fit, income-fit and fee).', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] },
      { text: 'Open any bank\'s details page: Overview, Documents checklist (with DigiLocker import), Eligibility guidelines, Hidden Charges with a full cost summary.', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] },
      { text: 'Locate branches on the Google-Maps-style map (smooth zoom, rotate, 3D pitch, Map/Satellite switcher), filtered by bank / city / search, with directions and call actions. Distances are shown only from your real GPS position once you grant permission; no live open/closed status is claimed.', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] },
      { text: 'Bookmark offers into "Saved" for later comparison.', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] }
    ],
    margin: [0, 0, 0, 10]
  },
  { text: 'P2P flow', bold: true, fontSize: 11, color: BRAND.navy, margin: [0, 0, 0, 4] },
  {
    ol: [
      { text: 'Enter "P2P Lending" and choose between Borrow Money or Lend Money.', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] },
      { text: 'Borrower: fill the loan request form (amount, purpose, rate, income, credit) → post it to the marketplace, see ranked lender matches, and chat with interested lenders.', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] },
      { text: 'Lender: set preferences (amount, max rate, risk tolerance, tenure) → ranked borrower matches, full funding preview with estimated returns, confirm a demo investment.', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] },
      { text: 'Track the portfolio (invested, expected returns, interest earned), view repayment schedules, and chat with borrowers.', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] }
    ],
    margin: [0, 0, 0, 0]
  }
);

// ---------------- SECTION 5 ----------------
def.content.push(
  { text: '5. Features Implemented', fontSize: 16, bold: true, color: BRAND.primary, margin: [0, 30, 0, 10] },
  {
    table: {
      widths: ['8%', '48%', '44%'],
      body: [
        [{ text: '#', bold: true, fillColor: BRAND.navy, color: '#fff', alignment: 'center' }, { text: 'Feature / Module', bold: true, fillColor: BRAND.navy, color: '#fff' }, { text: 'What it does', bold: true, fillColor: BRAND.navy, color: '#fff' }],
        ['1', { bold: true, text: 'Landing page' }, 'Hero value prop, honest trust stats (7.85% starting, 5 banks, 7 live offers, 5 cities), features grid, "How it works" steps, CTA'],
        ['2', { bold: true, text: 'Demo Auth (Login / Sign Up)' }, 'Modal and full-page login/signup with password toggle, remember-me, "safe & secure" badges'],
        ['3', { bold: true, text: 'Sidebar navigation' }, 'Dark navy sidebar, active indicator, notification badge, P2P open-request counter, logout'],
        ['4', { bold: true, text: 'Multi-loan type selection' }, 'Selectable cards for Home, Personal, Car, Education, Business, Gold with starting rates'],
        ['5', { bold: true, text: 'Loan requirements panel' }, 'Amount slider (real-time display), tenure dropdown, annual income, employment type, credit score'],
        ['6', { bold: true, text: 'Comparison engine' }, 'Sorts offers by lowest advertised rate, EMI computed live; global search across banks/rates/tags'],
        ['7', { bold: true, text: 'Top-3 Recommendation ranking' }, 'Scoring: rate 40%, credit-fit 25%, income-fit 20%, processing fee 15%. Shows % match, notes, EMI'],
        ['8', { bold: true, text: 'Best-offer pinned card' }, 'Emerald "Best Match: Lowest Rate" highlight above the full comparison'],
        ['9', { bold: true, text: 'Full comparison + sorting' }, 'Sort by rate, EMI, processing fee, or max amount; empty states handled'],
        ['10', { bold: true, text: 'Bank details & tabs' }, 'Overview, Documents, Eligibility criteria, Hidden Charges for each bank offer'],
        ['11', { bold: true, text: 'Document checklist' }, 'Categorized list (Identity, Address, Income, Tax, Property, Photos) with Ready / In Review / Required statuses'],
        ['12', { bold: true, text: 'DigiLocker integration (demo)' }, 'Aadhaar → OTP → fetch flow, select & import verified documents, marks checklist items verified'],
        ['13', { bold: true, text: 'Hidden charges transparency' }, 'Per-offer fees (legal, stamp duty, bounce, prepayment, penal interest) + "Your Real Loan Cost" summary'],
        ['14', { bold: true, text: 'Branch locator' }, 'Google-Maps-style MapLibre map (Map/Satellite switch, fit-all, InfoWindow cards) + side cards, bank/city filters, GPS distance, phone, Google directions. No live open/closed status'],
        ['15', { bold: true, text: 'Eligibility checker' }, 'Income/EMI/credit/employment sliders, max eligible amount via FOIR rule, per-loan breakdown, personalized tips'],
        ['16', { bold: true, text: 'Saved offers' }, 'Bookmark bank offers and P2P requests; persists across reloads in localStorage'],
        ['17', { bold: true, text: 'Profile & settings' }, 'Pre-filled applicant profile; notification toggles; one-click "Reset Demo Data"'],
        ['18', { bold: true, text: 'Support chatbot widget' }, 'In-app floating helper with quick replies about loans, EMI, eligibility, P2P, branches'],
        ['19', { bold: true, text: 'P2P Lending marketplace' }, 'Borrow/lend modes, marketplace feed, funding progress bars, risk badges, match scores'],
        ['20', { bold: true, text: 'P2P Portfolio & chat' }, 'Investment tracking with amortization schedules, expected vs earned interest, per-loan chat with peers']
      ]
    },
    layout: 'lightHorizontalLines'
  }
);

// ---------------- SECTION 6 ----------------
def.content.push(
  { text: '6. The P2P Lending Marketplace', fontSize: 16, bold: true, color: BRAND.primary, margin: [0, 30, 0, 10] },
  { text: 'The P2P side is a full two-sided demo: a borrower posts a request, lenders discover and fund it, and both sides track their position in a portfolio with a chat thread. It carries equal design weight to the comparison engine, as documented in the product\'s brand commitments.', fontSize: 10, color: BRAND.navy, lineHeight: 1.5, margin: [0, 0, 0, 10] },
  {
    table: {
      widths: ['34%', '66%'],
      body: [
        [{ text: 'Area', bold: true, fillColor: BRAND.navy, color: '#fff' }, { text: 'Status', bold: true, fillColor: BRAND.navy, color: '#fff' }],
        [{ text: 'Marketplace feed', bold: true }, 'Seeded borrower requests (medical, wedding, business, education, renovation) with purposes, risk badges and match scores'],
        [{ text: 'Borrow money', bold: true }, 'Request form (amount ₹5k–₹5L, rate 5–24%, tenure, income, credit) → post → ranked lender matches → chat'],
        [{ text: 'Lend money', bold: true }, 'Lender preferences → ranked matches → lend modal with live estimated-returns preview → confirm demo investment'],
        [{ text: 'Portfolio', bold: true }, 'Summaries (total invested, expected returns, interest earned, active loans) + per-investment amortization and chat'],
        [{ text: 'Chat', bold: true }, 'Borrower ↔ lender, borrower ↔ investor, and user ↔ recommended lender; persisted messages'],
        [{ text: 'Persistence', bold: true }, 'Stored in localStorage under loanfinder.p2p.v1 and the shared LoanFinder DB (reset as one unit)'],
        [{ text: 'Validation rules', bold: true }, 'Minimum lending ₹1,000, can\'t exceed remaining funding, credit-score based risk tiering, confirm-before-delete for requests']
      ]
    },
    layout: 'lightHorizontalLines'
  }
);

// ---------------- SECTION 7 ----------------
def.content.push(
  { text: '7. Data Model & Persistence', fontSize: 16, bold: true, color: BRAND.primary, margin: [0, 30, 0, 10] },
  { text: 'Everything ships as static data inside app.js — no external database is required for the demo.', fontSize: 10, color: BRAND.navy, lineHeight: 1.5, margin: [0, 0, 0, 8] },
  {
    table: {
      widths: ['30%', '70%'],
      body: [
        [{ text: 'Dataset', bold: true, fillColor: BRAND.navy, color: '#fff' }, { text: 'Contents', bold: true, fillColor: BRAND.navy, color: '#fff' }],
        [{ text: 'LOAN_TYPES', bold: true }, '6 loan categories with starting rates and popularity flags'],
        [{ text: 'BANK_OFFERS', bold: true }, 'Advertised offers for State Bank, HDFC, ICICI, Axis, Kotak (home + personal) with rates, fees, max amount/tenure, eligibility, employment rules'],
        [{ text: 'HIDDEN_CHARGES', bold: true }, 'Per-offer fine-print items with amounts and % fees, plus informational rows'],
        [{ text: 'DOCUMENTS_DATA', bold: true }, 'Checklist categories with icons, descriptions and status'],
        [{ text: 'DIGILOCKER_DOCS', bold: true }, 'Sample verified documents (Aadhaar, PAN, Driving License, etc.) for the import demo'],
        [{ text: 'BRANCH_DATA', bold: true }, 'Geo-coded branches across Mumbai, Delhi & Bengaluru with hours, phone, open status'],
        [{ text: 'P2P data', bold: true }, 'Demo borrower requests, lender profiles, investments and chat threads'],
        [{ text: 'localStorage DB', bold: true }, 'loanfinder.db.v1 (savedOffers, savedP2P, p2p, meta) — read/written via a tiny db helper']
      ]
    },
    layout: 'lightHorizontalLines'
  },
  { text: 'Note: README.md documents where the static BANK_OFFERS and BRANCH_DATA blocks would be swapped for live backend endpoints (/api/loans/compare, /api/branches, /api/documents/upload) in future work.', fontSize: 9, color: BRAND.slate, italic: true, margin: [0, 8, 0, 0] }
);

// ---------------- SECTION 8 ----------------
def.content.push(
  { text: '8. Demo Data & Constraints', fontSize: 16, bold: true, color: BRAND.primary, margin: [0, 30, 0, 10] },
  {
    ul: [
      { text: 'Rates and EMI outputs are computed from the published advertised rates. The bank count shown anywhere in the product (5 banks, 7 offers) matches the actual catalogue exactly; inflated counts such as "25+ banks" are never displayed.', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] },
      { text: 'Real Indian bank names and their offer cards are trusted content kept exactly as-is.', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] },
      { text: 'Unsupported trust claims ("Bank-Grade Security", "256-bit bank-level SSL", "25,000+ borrowers") were deliberately removed. There is no server, so an SSL claim could not be true here. The card now reads "Your Data Stays Local", which is accurate for a localStorage demo.', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] },
      { text: 'Branch records for Hyderabad and Pune are attributed to official bank locators with IFSC codes and source links; coordinates are only plotted where an OpenStreetMap node of the same bank was found in the same locality. Records without verified coordinates are listed but not plotted. Older Mumbai / Delhi / Bengaluru records are clearly labelled illustrative demo data.', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] },
      { text: 'The app is static and self-contained; it must keep working by opening index.html.', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] },
      { text: 'No real customer testimonials, case studies, press mentions or audited statistics exist today — future work must not manufacture additional formal evidence.', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] }
    ],
    margin: [0, 0, 0, 0]
  }
);

// ---------------- SECTION 9 ----------------
def.content.push(
  { text: '9. Current Stand & Verification', fontSize: 16, bold: true, color: BRAND.primary, margin: [0, 30, 0, 10] },
  { text: 'Where the project stands right now', bold: true, fontSize: 11, color: BRAND.navy, margin: [0, 0, 0, 4] },
  { text: 'LoanFinder is a complete, working, self-contained demo. All listed modules render and function in a modern browser from a single static folder. The comparison engine, eligibility logic, branch map, document checklist and the full two-sided P2P marketplace (post → match → fund → track → chat) are implemented and run end-to-end.', fontSize: 10, color: BRAND.navy, lineHeight: 1.5, margin: [0, 0, 0, 8] },
  { text: 'Verification checklist', bold: true, fontSize: 11, color: BRAND.navy, margin: [0, 0, 0, 4] },
  {
    table: {
      widths: ['12%', '70%', '18%'],
      body: [
        [{ text: 'Item', bold: true, fillColor: BRAND.navy, color: '#fff' }, { text: 'Check', bold: true, fillColor: BRAND.navy, color: '#fff' }, { text: 'Status', bold: true, fillColor: BRAND.navy, color: '#fff' }],
        ['1', 'App opens directly from index.html (no build step; only the map basemap needs internet)', { text: 'Done', color: BRAND.emerald, bold: true }],
        ['2', 'Loan comparison, EMI and top-3 ranking work live', { text: 'Done', color: BRAND.emerald, bold: true }],
        ['3', 'Bank details: docs, eligibility, hidden charges', { text: 'Done', color: BRAND.emerald, bold: true }],
        ['4', 'Branch locator map with filters & directions', { text: 'Done', color: BRAND.emerald, bold: true }],
        ['5', 'Eligibility checker with live recomputation', { text: 'Done', color: BRAND.emerald, bold: true }],
        ['6', 'Saved offers persist after reload', { text: 'Done', color: BRAND.emerald, bold: true }],
        ['7', 'P2P: post request, match, fund, portfolio, chat', { text: 'Done', color: BRAND.emerald, bold: true }],
        ['8', 'Demo data reset restores the original seed', { text: 'Done', color: BRAND.emerald, bold: true }]
      ]
    },
    layout: 'lightHorizontalLines'
  }
);

// ---------------- SECTION 10 ----------------
def.content.push(
  { text: '10. How to Run', fontSize: 16, bold: true, color: BRAND.primary, margin: [0, 30, 0, 10] },
  {
    ol: [
      { text: 'Open the folder p1/ in the repository.', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] },
      { text: 'Double-click index.html (or right-click → Open with Chrome / Edge).', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] },
      { text: 'Recommended dev server: python -m http.server 3000 then open http://localhost:3000 — or npx serve .', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] },
      { text: 'Suggested demo path for judges: landing → Sign In → Home loan → Find Matching Loan → SBI details & Docs → Hidden Charges → Branches map → Saved → P2P Lending (Lend Money → fund a borrower) → Portfolio → Chat.', fontSize: 10, color: BRAND.navy, margin: [0, 2, 0, 2] }
    ],
    margin: [0, 0, 0, 10]
  },
  { text: 'Suggestions: use the Reset Demo Data button in Settings before each new demo so judges always start from the clean seeded state.', fontSize: 9, color: BRAND.slate, italic: true }
);

// ---------------- SECTION 11 ----------------
def.content.push(
  { text: '11. Next Steps', fontSize: 16, bold: true, color: BRAND.primary, margin: [0, 30, 0, 10] },
  {
    table: {
      widths: ['8%', '70%', '22%'],
      body: [
        [{ text: 'Priority', bold: true, fillColor: BRAND.navy, color: '#fff', alignment: 'center' }, { text: 'Planned improvement', bold: true, fillColor: BRAND.navy, color: '#fff' }, { text: 'Type', bold: true, fillColor: BRAND.navy, color: '#fff' }],
        ['High', 'Real backend endpoints feeding BANK_OFFERS / BRANCH_DATA (API stubs are documented in README.md)', 'Backend'],
        ['High', 'Record a polished walkthrough / demo script to rehearse the judge\'s path', 'Demo prep'],
        ['Medium', 'Connect DigiLocker import to the real DigiLocker APIs', 'Integration'],
        ['Medium', 'Add remaining loan categories (car, education, business, gold) to BANK_OFFERS for full coverage', 'Content'],
        ['Medium', 'Formal evidence: testimonials, case studies or audited stats — only if available and truthful', 'Validation'],
        ['Low', 'Unit tests / linting for app.js to harden the demo build', 'Engineering'],
        ['Low', 'Deploy the static folder to any host for a shareable live URL', 'Deployment']
      ]
    },
    layout: 'lightHorizontalLines'
  },
  { text: '\n\nPrepared automatically from the project source (index.html, app.js, styles.css, README.md, PRODUCT.md).', fontSize: 8, color: BRAND.slate, italic: true, margin: [0, 20, 0, 0] }
);

// Generate the PDF
(async () => {
  const outPath = path.join(__dirname, 'LoanFinder_Project_Status_Report.pdf');
  const pdfDoc = pdfMake.createPdf(def);
  await pdfDoc.write(outPath);
  console.log('PDF created at: ' + outPath);
})().catch(err => {
  console.error(err);
  process.exit(1);
});