/**
 * Generates LoanFinder_Complete_Project_Report.pdf
 *
 * Every figure in this document was read out of the running application and
 * cross-checked (see the "Verification & Testing" section). Nothing here is
 * estimated. Simulated behaviour is labelled as simulated.
 *
 * FONT NOTE: the embedded Roboto build has no glyph for U+2192 (arrow),
 * U+2713/U+2717 (check/cross) or U+26A0 (warning). This generator therefore
 * uses "->", "Yes"/"No" and plain text instead of those characters, so nothing
 * silently renders as a blank box.
 */
const fs = require('fs');
const path = require('path');
const pdfMake = require('pdfmake');

const ROBOTO = path.join(__dirname, 'node_modules/pdfmake/build/fonts/Roboto');
pdfMake.setLocalAccessPolicy(p => path.normalize(p).indexOf(path.normalize(ROBOTO)) === 0);
pdfMake.setUrlAccessPolicy(() => false);
pdfMake.addFonts({
  Roboto: {
    normal: path.join(ROBOTO, 'Roboto-Regular.ttf'),
    bold: path.join(ROBOTO, 'Roboto-Medium.ttf'),
    italics: path.join(ROBOTO, 'Roboto-Italic.ttf'),
    bolditalics: path.join(ROBOTO, 'Roboto-MediumItalic.ttf')
  }
});

const C = {
  blue: '#2563eb',
  navy: '#0f172a',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#e11d48',
  slate: '#64748b',
  light: '#f8fafc',
  border: '#e2e8f0',
  zebra: '#f1f5f9'
};

// Page width 595pt - 80pt margins = 515pt usable.
const W = 515;

const H1 = t => ({ text: t, fontSize: 17, bold: true, color: C.navy, margin: [0, 26, 0, 12] });
const H2 = t => ({ text: t, fontSize: 12.5, bold: true, color: C.blue, margin: [0, 16, 0, 6] });
const P = (t, o = {}) => ({ text: t, fontSize: o.size || 9.5, color: o.color || '#1e293b', margin: [0, 0, 0, 7], lineHeight: o.lh || 1.42, alignment: o.align, italics: o.italics, bold: o.bold });
const B = t => ({ text: t, bullet: { type: 'bullet' }, fontSize: 9.5, color: '#1e293b', margin: [0, 0, 0, 4], lineHeight: 1.4 });
const RULE = (m = [0, 8, 0, 12]) => ({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: W, y2: 0, lineWidth: 1, lineColor: C.border }], margin: m });
const SPACER = h => ({ text: '', margin: [0, 0, 0, h || 8] });
const PAGEBREAK = () => ({ text: '', pageBreak: 'after' });

// 'w' is this file's sentinel for "size this column to its content".
// pdfmake only understands a number or 'auto'/'*', so translate it.
const head = (label, w) => ({
  text: label === undefined || label === null ? '' : String(label),
  fillColor: C.navy,
  color: '#fff',
  bold: true,
  fontSize: 8.5,
  alignment: 'left',
  width: w === 'w' || w === undefined || w === null ? 'auto' : w
});

// status pill: real work vs simulation vs stub
const st = (kind, label) => ({
  text: label || ({ real: 'Working', sim: 'Simulated', stub: 'Stub', unv: 'Unverified' })[kind],
  color: ({ real: C.emerald, sim: C.amber, stub: C.rose, unv: C.rose })[kind],
  bold: true,
  fontSize: 8
});

const CONTENT_W = 515; // 595.28pt A4 width - 40pt left - 40pt right page margins
const CELL_PAD = 10;  // paddingLeft 5 + paddingRight 5, added per column

function table(rows, widths) {
  // Header cells come from head('label', width); pdfmake needs a text key, so
  // fall back to an empty string when one is not supplied.
  const body = rows.map(r => r.map(cell =>
    (cell && typeof cell === 'object' && !('text' in cell)) ? { ...cell, text: '' } : cell
  ));

  // pdfmake lays each column out at its declared width PLUS the cell padding,
  // so a set of widths summing to CONTENT_W overflows the printable area by
  // ncols * CELL_PAD. Scale the columns down to the real available width,
  // preserving their proportions.
  const cols = rows[0].length;
  const avail = CONTENT_W - cols * CELL_PAD;
  let w = Array.isArray(widths) && widths.length === cols
    ? widths.map(x => (x === 'w' || x === undefined || x === null ? 'auto' : x))
    : null;
  if (w && w.every(x => typeof x === 'number')) {
    const sum = w.reduce((a, b) => a + b, 0);
    if (sum > avail) {
      const scale = avail / sum;
      w = w.map(x => Math.max(14, Math.round(x * scale)));
      // absorb rounding drift into the widest column
      let idx = w.indexOf(Math.max(...w));
      w[idx] += Math.round(avail - w.reduce((a, b) => a + b, 0));
    }
  }

  return {
    table: { widths: w, body },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => C.border,
      vLineColor: () => C.border,
      paddingTop: () => 4,
      paddingBottom: () => 4,
      paddingLeft: () => 5,
      paddingRight: () => 5
    },
    fontSize: 8.5,
    margin: [0, 4, 0, 10]
  };
}

const doc = {
  pageSize: 'A4',
  pageMargins: [40, 46, 40, 46],
  defaultStyle: { font: 'Roboto' },
  info: {
    title: 'LoanFinder - Complete Project Report',
    author: 'LoanFinder Team (HackIndia 2026)',
    subject: 'Complete technical and functional project report'
  },
  footer: (cur, total) => ({
    margin: [40, 12, 40, 0],
    columns: [
      { text: 'LoanFinder - Complete Project Report', fontSize: 7.5, color: C.slate },
      { text: `Page ${cur} of ${total}`, fontSize: 7.5, color: C.slate, alignment: 'right' }
    ]
  }),
  content: []
};

const c = doc.content;

// ============================== COVER ==============================
c.push(
  { text: 'LOANFINDER', fontSize: 44, bold: true, color: C.blue, alignment: 'center', margin: [0, 70, 0, 4] },
  { text: 'Loan Comparison, P2P Lending & Branch Discovery', fontSize: 15, color: C.navy, alignment: 'center', margin: [0, 0, 0, 26] },
  { text: 'COMPLETE PROJECT REPORT', fontSize: 19, bold: true, color: C.navy, alignment: 'center', margin: [0, 0, 0, 8] },
  { text: 'Full technical architecture, data model, algorithms, feature inventory,\nverification results, disclosures and known issues.', fontSize: 11, color: C.slate, alignment: 'center', margin: [0, 0, 0, 26], lineHeight: 1.5 },
  RULE([30, 0, 30, 20]),
  {
    columns: [
      { stack: [
        { text: 'Submission', fontSize: 8.5, color: C.slate, margin: [0, 0, 0, 2] },
        { text: 'HackIndia 2026', fontSize: 11, bold: true, color: C.navy }
      ] },
      { stack: [
        { text: 'Category', fontSize: 8.5, color: C.slate, alignment: 'right', margin: [0, 0, 0, 2] },
        { text: 'Fintech / Lending Technology', fontSize: 11, bold: true, color: C.navy, alignment: 'right' }
      ] }
    ],
    margin: [30, 0, 30, 14]
  },
  {
    columns: [
      { stack: [
        { text: 'Form factor', fontSize: 8.5, color: C.slate, margin: [0, 0, 0, 2] },
        { text: 'Responsive static web app (desktop + mobile)', fontSize: 10, color: '#1e293b' }
      ] },
      { stack: [
        { text: 'Runtime dependencies', fontSize: 8.5, color: C.slate, alignment: 'right', margin: [0, 0, 0, 2] },
        { text: 'None at runtime - opens from index.html', fontSize: 10, color: '#1e293b', alignment: 'right' }
      ] }
    ],
    margin: [30, 0, 30, 14]
  },
  {
    columns: [
      { stack: [
        { text: 'Source of record', fontSize: 8.5, color: C.slate, margin: [0, 0, 0, 2] },
        { text: '1try/p1 (app.js, styles.css, index.html)', fontSize: 10, color: '#1e293b' }
      ] },
      { stack: [
        { text: 'Report basis', fontSize: 8.5, color: C.slate, alignment: 'right', margin: [0, 0, 0, 2] },
        { text: 'Figures read from the running build', fontSize: 10, color: '#1e293b', alignment: 'right' }
      ] }
    ],
    margin: [30, 0, 30, 0]
  }
);

// ============================== CONTENTS ==============================
c.push(
  PAGEBREAK(),
  { text: 'Contents', fontSize: 18, bold: true, color: C.navy, margin: [0, 0, 0, 14] },
  ...[
    '1. Executive Summary',
    '2. Purpose, Scope and Design Goals',
    '3. Technology and Architecture',
    '4. Data Model - The Complete Catalogue',
    '5. Algorithms and Computation',
    '6. Feature Inventory (56 items)',
    '7. Primary User Flows',
    '8. Persistence Model',
    '9. Maps, Network and External Dependencies',
    '10. PDF Document Generation',
    '11. Accessibility and UX Engineering',
    '12. Verification and Testing',
    '13. Disclosure Register - What Is Real and What Is Simulated',
    '14. Audit Findings and Known Issues',
    '15. How to Run',
    '16. Limitations',
    '17. Roadmap'
  ].map((t, i) => ({
    columns: [
      { text: String(i + 1).padStart(2, ' '), fontSize: 10, bold: true, color: C.blue, width: 22 },
      { text: t.replace(/^\d+\.\s*/, ''), fontSize: 10, color: C.navy }
    ],
    margin: [0, 2, 0, 2]
  }))
);

// ============================== 1. EXEC SUMMARY ==============================
c.push(
  PAGEBREAK(),
  H1('1. Executive Summary'),
  P('LoanFinder is a browser-only fintech prototype that brings three things a loan applicant normally has to juggle across separate sites into one interface: comparing advertised interest rates, understanding what a loan actually costs once fees are counted, and finding the branch that will process the application. A fourth module, a peer-to-peer lending marketplace, is included as a demonstrator.'),

  H2('1.1 What is genuinely built and works'),
  B('A complete loan comparison engine over a built-in catalogue of 7 offers from 5 banks, with a real reducing-balance EMI calculation and a four-factor weighted match score.'),
  B('A hidden-charges module covering 35 fee line items across all 7 offers, with a live "total you pay" figure driven by the user\'s own loan amount.'),
  B('A real PDF generator. Downloading the document checklist produces an actual PDF file, generated in the browser, including the Indian rupee sign.'),
  B('A Google-Maps-style branch locator on WebGL vector tiles, with Map/Satellite switching, distance-from-your-real-location, and IFSC codes for 15 verified branch records.'),
  B('A 176-method application core, a 33-record branch database with explicit per-record data provenance, and a Playwright verification harness.'),

  H2('1.2 What is deliberately simulated'),
  B('DigiLocker import (any six digits pass; no service is contacted).'),
  B('Authentication (form validated in the browser; no credentials are transmitted or stored).'),
  B('The entire P2P marketplace (funding, portfolio and chat all operate on local state; the app states in the UI that no real money moves).'),

  H2('1.3 The single most important caveat'),
  P('Rates are static values written into the source file. They are not a live feed, and the app says so in the README and in the UI. Because the catalogue is frozen in source, any change to a bank rate is a code edit. Section 14 additionally records eight honesty defects found during an audit of this build, including a support-bot response that states an unverified phone number and response-time guarantee.'),

  H2('1.4 Scale, measured'),
  table([
    [head('Measure', 'w'), head('Value', 'w'), head('Notes', 'w')],
    ['Source files', '12,270 lines', 'app.js + styles.css + index.html, 419,736 bytes, excluding vendored libraries'],
    ['Application methods', '176', 'Public methods on the global app object'],
    ['Runtime state fields', '36', 'Single appState object'],
    ['Bank offers', '7', 'From 5 distinct banks'],
    ['Loan categories', '6', 'Only 2 currently have offers; 4 are marked coming soon'],
    ['Hidden charge line items', '35', 'Across all 7 offers'],
    ['Document checklist entries', '7', '4 verified, 2 pending, 1 missing'],
    ['Branch records', '33', '5 cities; 15 carry verified IFSC codes'],
    ['Branches plottable on the map', '26', '7 verified records have no coordinates'],
    ['P2P demo requests / lenders', '6 / 4', 'Simulation only'],
    ['Verification assertions passing', '114', 'Across 7 suites; see section 12']
  ], [150, 60, 305])
);

// ============================== 2. PURPOSE ==============================
c.push(
  PAGEBREAK(),
  H1('2. Purpose, Scope and Design Goals'),

  H2('2.1 The problem being addressed'),
  P('A retail borrower in India typically faces a fragmented process. Advertised "starting from" rates are the headline number but do not reflect eligibility or total cost. Processing fees, legal and technical fees, stamp duty and prepayment penalties are frequently disclosed only after the loan is sanctioned. Comparing lenders usually means visiting each bank\'s site separately. And locating the branch that will actually process the application requires another search.'),
  P('LoanFinder compresses that into one flow: set your requirements once, see every offer that could serve them, see the full fee breakdown for each, and find the nearest eligible branch.'),

  H2('2.2 Scope'),
  P('The scope is a self-contained frontend demonstrator. There is no backend, no database server, no real payment rail and no live third-party integration. Everything a user sees is computed in the browser from a built-in dataset.'),

  H2('2.3 Design goals and how each was met'),
  table([
    [head('Goal', 'w'), head('How it was met', 'w'), head('Evidence', 'w')],
    ['Zero build friction', 'Plain HTML, CSS and JavaScript. All libraries are vendored locally, so the app runs from the filesystem with no server, no install and no CDN.', 'vendor/ holds 6 libraries; no network needed to load the app'],
    ['Honest data', 'Every branch record carries a geoPrecision tag. Records that are illustrative placeholders are visibly badged in the UI rather than presented as confirmed branches.', '18 records badged "Sample data - not verified"'],
    ['Genuine computation', 'EMI, match scoring and fee totals are computed from the user\'s inputs rather than hardcoded, and the arithmetic has been independently reproduced.', 'Section 5; EMI verified to the rupee'],
    ['Real output, not a mock-up', 'The document checklist produces an actual PDF file via pdf-lib rather than opening a print dialog.', 'Verified %PDF header, 1 page, text extraction'],
    ['Accessible by default', 'Every visible control has an accessible name, focus is visible, and Escape closes overlays through one central manager.', 'Suite 12.4; a11y spot checks inside the regression suite'],
    ['Work without a network', 'The catalogue, calculator, PDF, documents and saved offers are fully functional offline. Only the map basemap requires internet, and the app says so when it is unavailable.', 'Blocked-tile tests'],
    ['No silent failure', 'When the map cannot load, an on-screen notice explains the real cause and offers a working retry, instead of leaving a blank grey rectangle.', 'Suite 12.5, assertions MAP-4 to MAP-8']
  ], [92, 260, 163])
);

// ============================== 3. TECH ==============================
c.push(
  PAGEBREAK(),
  H1('3. Technology and Architecture'),

  H2('3.1 Stack'),
  table([
    [head('Layer', 'w'), head('Choice', 'w'), head('Rationale', 'w')],
    ['Markup', 'HTML5, single page with 14 view panels', 'One index.html keeps the project trivially portable'],
    ['Styling', 'Hand-written CSS, utility classes plus component blocks', 'No framework; themeable via CSS custom properties'],
    ['Behaviour', 'Vanilla ES6+ JavaScript, one global script', '176 methods on a single app object, no modules to resolve'],
    ['Icons', 'Lucide, vendored', 'Tree-shaken icon set, wrapped in a safeIcons guard that cannot throw'],
    ['Primary map', 'MapLibre GL, vendored', 'WebGL vector map: smooth zoom, rotate, 3D pitch, no API key or billing'],
    ['Fallback map', 'Leaflet, vendored', 'Raster safety net if the MapLibre bundle fails to load'],
    ['PDF', 'pdf-lib, vendored', 'Real client-side PDF generation with embedded standard fonts'],
    ['Report tooling', 'pdfmake (dev only)', 'Build-time report generation; not shipped to the browser'],
    ['Persistence', 'localStorage', 'One JSON document under a single versioned key'],
    ['Testing', 'Playwright + Chromium', 'Drives the real UI over file://, matching how users run it']
  ], [70, 145, 300]),

  H2('3.2 File inventory'),
  table([
    [head('File', 'w'), head('Lines', 'w'), head('Bytes', 'w'), head('Role', 'w')],
    ['index.html', '1,822', '94,990', 'All 14 view panels, modals, app shell'],
    ['app.js', '5,197', '219,351', 'Data, state, algorithms, rendering, PDF, maps, P2P'],
    ['styles.css', '5,251', '105,395', 'Design system, components, responsive and print rules'],
    ['generate_report.js', '361', '27,065', 'Build-time status report generator (dev tool)'],
    ['generate_complete_report.js', '-', '-', 'Generator for this report; size self-referential, so not listed'],
    ['package.json', '6', '79', 'Declares pdf-lib and pdfmake for report tooling only'],
    ['package-lock.json', '310', '11,609', 'Locked dev-dependency versions for report tooling'],
    ['PHASE1_COMPLETION_REPORT.md', '272', '15,847', 'Engineering log of the Phase 1 work'],
    ['README.md', '83', '4,327', 'Setup, scope note, feature table'],
    ['PRODUCT.md (parent folder)', '52', '4,302', 'Product definition and honesty rules']
  ], [178, 44, 62, 231]),
  P('The three application source files total 419,736 bytes and 12,270 lines.', { size: 9, italics: true }),
  P('Vendored libraries, 1,918,555 bytes total, all loaded from vendor/ with no CDN:', { size: 9, italics: true }),
  table([
    [head('Library', 'w'), head('Bytes', 'w'), head('Purpose', 'w')],
    ['maplibre-gl.js', '803,086', 'Primary map engine'],
    ['pdf-lib.min.js', '525,099', 'Checklist PDF generation'],
    ['lucide.min.js', '355,975', 'Icon set'],
    ['maplibre-gl.css', '65,534', 'Map control styling (all assets are inline data URIs)'],
    ['leaflet.js', '147,552', 'Fallback map engine'],
    ['leaflet.css', '14,806', 'Fallback map styling'],
    ['images/ (5 files)', '6,503', 'Leaflet marker sprites']
  ], [150, 70, 295]),

  H2('3.3 Architecture'),
  P('The application is a single-page shell with one in-memory state object and a render-on-navigate model. Navigation does not reload the page; it swaps the active view panel and re-renders it from state.'),
  ...[
    ['appState', 'A 36-field plain object holding the active view, selected loan types, loan amount, tenure, income, employment type, credit score, active branch filters, map style and engine, geolocation, and P2P mode.'],
    ['Data constants', 'Immutable seed data defined once at the top of app.js: LOAN_TYPES, BANK_OFFERS, HIDDEN_CHARGES, DOCUMENTS_DATA, DIGILOCKER_DOCS and BRANCH_DATA.'],
    ['db layer', 'A 45-line localStorage wrapper with all(), save(), set(), clear(). Every call is wrapped in try/catch so storage failures degrade to a console warning instead of breaking the UI.'],
    ['Render functions', 'Views are built by string templates and injected, then passed through safeIcons() to hydrate Lucide icons.'],
    ['Overlay manager', 'bindGlobalDismiss() routes Escape to the topmost layer: modal, then support panel, then sidebar.']
  ].map(([k, v]) => ({
    columns: [
      { text: k, fontSize: 9.5, bold: true, color: C.blue, width: 92 },
      { text: v, fontSize: 9.5, color: '#1e293b' }
    ],
    margin: [0, 0, 0, 8]
  })),

  H2('3.4 Dependencies the app does NOT have'),
  P('No fetch, XMLHttpRequest, WebSocket, sessionStorage, cookies or IndexedDB appear in the application source. The only outbound requests the app can make are basemap tile and style requests from the map engine, and the Google Maps SDK load if the optional Google path is explicitly enabled by the user.')
);

// ============================== 4. DATA MODEL ==============================
c.push(
  PAGEBREAK(),
  H1('4. Data Model - The Complete Catalogue'),

  H2('4.1 Bank offers - all 7 records'),
  P('This is the complete catalogue. Every field below is a literal in app.js.'),
  table([
    [head('Offer id', 'w'), head('Bank', 'w'), head('Type', 'w'), head('Rate', 'w'), head('Fee %', 'w'), head('Fee cap', 'w'), head('Max amount', 'w'), head('Max yrs', 'w'), head('Min CIBIL', 'w'), head('Min monthly', 'w')],
    ['sbi-home', 'State Bank', 'Home', '7.85%', '0.25%', '10,000', '1.5 Cr', '30', '750', '40,000'],
    ['hdfc-home', 'HDFC Bank', 'Home', '8.10%', '0.50%', '15,000', '2 Cr', '30', '700', '40,000'],
    ['icici-home', 'ICICI Bank', 'Home', '8.35%', '0.60%', '20,000', '3 Cr', '25', '700', '35,000'],
    ['axis-home', 'Axis Bank', 'Home', '8.40%', '0.45%', '12,000', '1.5 Cr', '30', '700', '35,000'],
    ['kotak-home', 'Kotak Mahindra', 'Home', '8.45%', '0.50%', '10,000', '1.2 Cr', '25', '700', '30,000'],
    ['sbi-pers', 'State Bank', 'Personal', '10.25%', '1.00%', '10,000', '10 L', '7', '700', '25,000'],
    ['hdfc-pers', 'HDFC Bank', 'Personal', '10.50%', '1.00%', '15,000', '20 L', '5', '700', '25,000']
  ], [52, 62, 42, 32, 32, 40, 48, 36, 38, 43]),
  P('Interest rates are stored as numbers, not strings. Fees are stored as a percentage plus a rupee cap, matching how banks actually charge. Max tenure is stored in years.', { size: 8.5, color: C.slate, italics: true }),
  P('Note the counter-intuitive result this catalogue produces: ICICI Bank at 8.35% is cheaper than Axis Bank at 8.40%, but ranks below it in the weighted top 3 because ICICI charges a higher processing fee (0.60% against 0.45%). That is the scoring model working as designed, not a bug.', { size: 9 }),

  H2('4.2 Loan categories'),
  table([
    [head('Category', 'w'), head('Advertised starting rate', 'w'), head('Status', 'w'), head('Comment', 'w')],
    ['Home Loan', '7.85% p.a.', st('real', 'Live in catalogue'), '5 offers'],
    ['Personal Loan', '10.25% p.a.', st('real', 'Live in catalogue'), '2 offers'],
    ['Car Loan', 'Not advertised', st('sim', 'Coming soon'), 'No verified offers exist, so no rate is advertised'],
    ['Education Loan', 'Not advertised', st('sim', 'Coming soon'), 'No verified offers exist, so no rate is advertised'],
    ['Business Loan', 'Not advertised', st('sim', 'Coming soon'), 'No verified offers exist, so no rate is advertised'],
    ['Gold Loan', 'Not advertised', st('sim', 'Coming soon'), 'No verified offers exist, so no rate is advertised']
  ], [70, 110, 105, 230]),
  P('The four coming-soon categories are deliberately shown with no rate rather than a fabricated one. A user can select them, and the match list will correctly come back empty. This is a known product weakness, recorded in section 16.', { size: 8.5, color: C.slate, italics: true }),

  H2('4.3 Hidden charges'),
  P('35 individual fee entries spread across all 7 offers, covering legal and technical fees, stamp duty, bounce charges, prepayment penalties and penal interest. Each carries a display range and a representative numeric fee so the "total you pay" figure can be computed against the user\'s actual loan amount rather than shown as a static number.'),
  table([
    [head('Charge category', 'w'), head('Treatment', 'w')],
    ['Legal and technical', 'Valuation and vetting billed at actuals by the bank; a representative fee is stored for calculation'],
    ['Stamp duty', 'State-dependent, shown as a range, representative value used in the total'],
    ['Prepayment / foreclosure', 'Charge or NIL depending on floating versus fixed rate; SBI home is Nil for floating rates'],
    ['Bounce and penal interest', 'Flat charges plus rate-per-month penalties, shown with the amount basis stated'],
    ['Total You Pay', 'Computed live from the user\'s loan amount using the stored representative fees']
  ], [130, 385])
);

c.push(
  PAGEBREAK(),
  H2('4.4 Document checklist'),
  table([
    [head('Category', 'w'), head('Document', 'w'), head('Seed status', 'w'), head('Badge shown', 'w')],
    ['Identity Proof', 'Valid Government Photo ID', 'verified', 'Verified'],
    ['Address Proof', 'Current Residence Proof', 'pending', 'Action Needed'],
    ['Income Proof', 'Salary Slips and Income Certificate', 'verified', 'Verified'],
    ['Banking History', 'Bank Account Statements', 'verified', 'Verified'],
    ['Tax Filings', 'Income Tax Return and Form 16', 'pending', 'Pending'],
    ['Property Details', 'Property Title Deeds and Allotment Letter', 'missing', 'Optional'],
    ['Photographs', 'Recent Passport-size Photographs', 'verified', 'Verified']
  ], [78, 215, 60, 90]),
  P('Distribution: 4 verified, 2 pending, 1 missing. These statuses are seed values baked into the source, not a derived result of any user state, and the manual-upload path that would change them is a stub (section 14, finding 7).', { size: 8.5, color: C.slate, italics: true }),

  H2('4.5 Branch records - 33 records across 5 cities'),
  P('Branch data is the part of this project most likely to be mistaken for real information, so it is the part most carefully tiered. Every record carries an explicit geoPrecision tag recording how its coordinates were obtained.'),
  table([
    [head('City', 'w'), head('Records', 'w'), head('With IFSC', 'w'), head('Source link', 'w'), head('geoPrecision', 'w'), head('Mappable', 'w')],
    ['Mumbai', '9', '0', '0', 'demo x 9', '9'],
    ['Delhi', '7', '0', '0', 'demo x 7', '7'],
    ['Bengaluru', '2', '0', '0', 'demo x 2', '2'],
    ['Hyderabad', '7', '7', '7', 'locality x 4, branch x 1', '5 of 7'],
    ['Pune', '8', '8', '8', 'locality x 2, branch x 1', '3 of 8'],
    [{ text: 'TOTAL', bold: true }, { text: '33', bold: true }, { text: '15', bold: true }, { text: '15', bold: true }, { text: '18 demo / 6 locality / 2 branch', bold: true }, { text: '26 of 33', bold: true }]
  ], [70, 55, 62, 66, 155, 75]),
  ...[
    ['demo', '18 records', 'Coordinates are illustrative placeholders. These carry no IFSC and no source link, and the UI badges every one of them "Sample data - not verified" with an explanatory tooltip. The source comment states they are "never a claim about a real branch location".'],
    ['locality', '6 records', 'Coordinates resolve to the city or locality level. An IFSC code and an official bank source link are present.'],
    ['branch', '2 records', 'Coordinates resolve to a specific branch site, with IFSC and source link.'],
    ['(none)', '7 records', 'Verified records that have no coordinates at all. These are never plotted on the map; they appear only in the card list.']
  ].map(([k, n, v]) => ({
    columns: [
      { text: k, fontSize: 9, bold: true, color: k === 'demo' ? C.rose : C.navy, width: 52 },
      { text: n, fontSize: 9, bold: true, color: C.slate, width: 58 },
      { text: v, fontSize: 9, color: '#1e293b' }
    ],
    margin: [0, 0, 0, 6]
  })),
  P('Verified records cite official bank locator URLs on sbi.bank.in, hdfc.bank.in, icici.bank.in, branch.axis.bank.in and kotak.bank.in. Example verified record:', { size: 9 }),
  {
    margin: [0, 2, 0, 10],
    fillColor: C.light,
    fontSize: 8.5,
    table: {
      widths: [CONTENT_W - 16],
      body: [[
        { stack: [
          { text: 'State Bank Hyderabad Main Branch - Koti', fontSize: 8.5, bold: true, color: C.navy },
          { text: 'Bank Street, Koti, Hyderabad, Telangana 500095', fontSize: 8, color: '#1e293b' },
          { text: '17.443317, 78.476855   |   10:30 AM - 4:30 PM (Mon-Sat)', fontSize: 8, color: C.slate },
          { text: 'IFSC SBIN0000847   |   geoPrecision: locality', fontSize: 8, color: C.emerald, bold: true },
          { text: 'Source: sbi.bank.in official Hyderabad circle branch list', fontSize: 7.5, color: C.slate, italics: true }
        ] }
      ]]
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => C.border,
      vLineColor: () => C.border,
      paddingTop: () => 6,
      paddingBottom: () => 6,
      paddingLeft: () => 8,
      paddingRight: () => 8
    }
  },

  H2('4.6 P2P demonstration data'),
  table([
    [head('Record', 'w'), head('Borrower', 'w'), head('Purpose', 'w'), head('Amount', 'w'), head('Rate', 'w'), head('Tenure', 'w'), head('CIBIL', 'w'), head('Risk', 'w'), head('Status', 'w')],
    ['p2p-r1', 'Priya Sharma', 'Medical Emergency', '80,000', '11.5%', '12 mo', '745', 'Medium', 'Open'],
    ['p2p-r2', 'Rohit Mehta', 'Wedding Expenses', '150,000', '12.0%', '24 mo', '700', 'Medium', 'Open'],
    ['p2p-r3', 'Ananya Iyer', 'Business Expansion', '200,000', '13.5%', '18 mo', '690', 'High', 'Open'],
    ['p2p-r4', 'Vikram Singh', 'Education Fees', '100,000', '10.5%', '12 mo', '780', 'Low', 'Repaying'],
    ['p2p-r5', 'Sneha Kulkarni', 'Home Renovation', '60,000', '11.0%', '9 mo', '730', 'Medium', 'Open'],
    ['p2p-u1', 'Alex Johnson (you)', 'Home Renovation', '120,000', '10.8%', '12 mo', '760', 'Low', 'Repaying']
  ], [42, 92, 92, 50, 34, 40, 34, 42, 47]),
  P('Four simulated lenders are seeded with distinct ticket sizes, rate ceilings, risk appetites and maximum tenures, so that match scoring produces meaningfully different results rather than a uniform answer. A pre-existing investment of 45,000 into Priya Sharma\'s loan is seeded so the portfolio view is populated on first run.', { size: 9 }),
  P('All of the above is demonstration data. The UI carries an explicit prototype notice stating that no real money transfers, loans, investments, KYC verification, credit decisions or financial contracts are performed.', { size: 8.5, color: C.rose, italics: true })
);

// ============================== 5. ALGORITHMS ==============================
c.push(
  PAGEBREAK(),
  H1('5. Algorithms and Computation'),
  P('Four pieces of genuine computation drive the product. All were independently re-implemented and verified against the shipped code.'),

  H2('5.1 EMI - reducing-balance annuity'),
  P('The standard Indian retail EMI formula, computed monthly:'),
  {
    margin: [0, 2, 0, 8],
    table: {
      widths: [CONTENT_W - 10],
      body: [[{ text: 'r = annualRate / 12 / 100        n = tenureYears x 12        g = (1 + r)^n\nEMI = (principal x r x g) / (g - 1)', fontSize: 9.5, color: C.navy, alignment: 'center' }]]
    },
    layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => C.border, vLineColor: () => C.border, paddingTop: () => 7, paddingBottom: () => 7 },
    fillColor: C.light
  },
  P('Guards: any non-finite or non-positive input returns 0; a zero-rate loan falls back to principal divided by months. Verified: 35,00,000 at 7.85% over 20 years returns exactly 28,950 per month.', { size: 9 }),

  H2('5.2 Offer ranking - two stages'),
  P('The product uses two different ranking mechanisms, and the distinction matters.'),
  P('Stage 1 - the hero offer', { bold: true, size: 10, color: C.navy, margin: [0, 8, 0, 3] }),
  P('Offers are filtered to the user\'s selected loan categories and sorted strictly ascending by interest rate. The first entry becomes the hero "best offer" card. This is the lowest advertised rate among eligible categories, and nothing more subtle.'),
  P('Stage 2 - the weighted top 3', { bold: true, size: 10, color: C.navy, margin: [0, 8, 0, 3] }),
  P('Recommendations stay locked behind a "Find Matching Loan" action until the user has committed. Once unlocked, a four-factor weighted score runs. The declared weights are interest rate 40%, credit fit 25%, income fit 20%, processing fee 15%.'),
  B('Hard eligibility filter first: an offer is discarded entirely if the loan amount exceeds its maximum, the tenure exceeds its maximum, or the employment type is not permitted.'),
  B('Rate and fee scores are min-max normalised across the surviving candidate set only, then inverted, so the cheapest rate and the lowest fee in that group both score exactly 100. This is relative scoring against peers, not an absolute quality measure.'),
  B('Credit fit is 100 when the user\'s CIBIL meets the minimum, otherwise it deducts 2 points per point short.'),
  B('Income fit is 100 when monthly income clears the minimum, otherwise it deducts up to 100.'),
  B('Final score = 0.40 x rateFit + 0.25 x creditFit + 0.20 x incomeFit + 0.15 x feeFit, rounded. Ties break on the lower rate. Exactly 3 cards are returned.'),
  P('Reproduced result for the default profile - Home Loan, 35,00,000, 20 years, 9,50,000 annual income, salaried, 780 CIBIL:', { size: 9, margin: [0, 8, 0, 4] }),
  table([
    [head('Rank', 'w'), head('Bank', 'w'), head('Rate', 'w'), head('rateFit', 'w'), head('creditFit', 'w'), head('incomeFit', 'w'), head('feeFit', 'w'), head('Match score', 'w')],
    ['1', 'State Bank', '7.85%', '100', '100', '100', '100', { text: '100%', bold: true, color: C.emerald }],
    ['2', 'HDFC Bank', '8.10%', '58.3', '100', '100', '28.6', { text: '73%', bold: true }],
    ['3', 'Axis Bank', '8.40%', '8.3', '100', '100', '42.9', { text: '55%', bold: true }],
    ['4', 'ICICI Bank', '8.35%', '16.7', '100', '100', '0', '52%'],
    ['5', 'Kotak Mahindra', '8.45%', '0', '100', '100', '28.6', '49%']
  ], [38, 100, 44, 52, 58, 58, 48, 75]),
  P('Axis Bank displaces ICICI Bank despite a higher headline rate, because ICICI\'s 0.60% processing fee scores 0 against Axis\'s 0.45%. This was confirmed against the shipped implementation.', { size: 8.5, color: C.slate, italics: true }),

  H2('5.3 P2P match scoring - demonstration only'),
  P('The P2P module uses a separate, simpler scoring pass, labelled in the source as a demo scoring algorithm. It starts from 100 and subtracts penalties for exceeding the investor\'s rate ceiling, ticket size, tenure, risk appetite, a low CIBIL floor, and a non-open status.'),
  P('Critically, the result is clamped to a floor of 55 and a ceiling of 99. Every P2P match therefore renders as a plausibly high percentage between 55% and 99% regardless of how good the actual fit is. It is a cosmetic confidence indicator and must not be read as a probability. This is recorded as a product limitation in section 16.', { size: 9, color: C.amber }),

  H2('5.4 Distance - great-circle formula'),
  P('Branch distance uses the haversine formula on the WGS-84 mean radius of 6,371 km. Distances are only ever computed from a real GPS reading obtained after the user grants geolocation permission. When permission is refused or the read fails, the app says so and offers manual city selection rather than inventing a location.')
);

// ============================== 6. FEATURES ==============================
c.push(
  PAGEBREAK(),
  H1('6. Feature Inventory'),
  P('56 user-visible capabilities were identified across the 14 view panels, numbered 1 to 56 without gaps. The status column is an honest assessment of what each one actually does today.'),

  H2('6.1 Onboarding and shell'),
  table([
    [head('#', 'w'), head('Feature', 'w'), head('Status', 'w'), head('Notes', 'w')],
    ['1', 'Landing page with product mockup', st('real', 'Working'), 'Static presentation. The Apply and Compare buttons on the phone mockup have no handler'],
    ['2', 'Animated statistics band', st('real', 'Working'), 'Renders 7.85% / 5 banks / 7 offers / 5 home loans. Labelled "Live Offers" - see finding 4'],
    ['3', 'Feature and how-it-works sections', st('real', 'Working'), 'Static copy'],
    ['4', 'Sign in / create account modal', st('sim', 'Simulated'), 'Browser-only validation. Forgot-password, Google and Apple buttons are inert and say so'],
    ['5', 'Sidebar navigation, 8 views', st('real', 'Working'), 'With notification badge and mobile drawer'],
    ['6', 'Responsive drawer with scrim', st('real', 'Working'), 'Scrim closes the drawer; Escape handled centrally'],
    ['7', 'Global search', st('real', 'Working'), 'Filters loan types and offers client-side on each keystroke'],
    ['8', 'Support chat widget and bot', st('real', 'Working'), '11 keyword-matched intents. See finding 1 for a disclosure defect'],
    ['9', 'Escape overlay manager', st('real', 'Working'), 'Routes to the topmost of modal, support panel, sidebar'],
    ['10', 'Toast notifications', st('real', 'Working'), 'Used consistently for feedback on every action']
  ], [24, 148, 62, 281]),

  H2('6.2 Loan discovery, matching and comparison'),
  table([
    [head('#', 'w'), head('Feature', 'w'), head('Status', 'w'), head('Notes', 'w')],
    ['11', 'Multi-select loan category cards', st('real', 'Working'), '6 categories; 4 marked coming soon with no rate'],
    ['12', 'Requirements panel', st('real', 'Working'), 'Amount slider, tenure, income, employment, CIBIL; live recalculation'],
    ['13', 'EMI calculator', st('real', 'Working'), 'Reducing-balance, verified to the rupee'],
    ['14', 'Eligibility checker', st('real', 'Working'), 'CIBIL tiers, income-versus-EMI principal derivation, per-category grid, tailored tips'],
    ['15', 'Gated recommendations', st('real', 'Working'), 'Locked until "Find Matching Loan" is pressed'],
    ['16', 'Weighted top-3 recommendations', st('real', 'Working'), 'Four-factor score, detailed in section 5.2'],
    ['17', 'Best-offer hero card', st('real', 'Working'), 'Always the lowest-rate offer, not the top match score - worth noting'],
    ['18', 'Full comparison list', st('real', 'Working'), 'Sortable by rate, EMI or processing fee'],
    ['19', 'Bank details - Overview', st('real', 'Working'), 'Data-driven from the catalogue'],
    ['20', 'Bank details - Eligibility', st('real', 'Working'), 'Per-offer eligibility rules'],
    ['21', 'Bank details - Hidden charges', st('real', 'Working'), '35 fee items plus a live total-you-pay figure'],
    ['22', 'Saved offers and saved P2P requests', st('real', 'Working'), 'Persisted to localStorage'],
    ['23', 'User profile view', st('sim', 'Display only'), 'Pre-filled sample applicant data; not editable, nothing persisted'],
    ['24', 'Settings with 3 toggles', st('real', 'Working'), 'Persisted, with distinct saved versus unsaved status text'],
    ['25', 'Reset demo data', st('real', 'Working'), 'Clears storage and reseeds']
  ], [24, 148, 62, 281]),

  H2('6.3 Documents and PDF'),
  table([
    [head('#', 'w'), head('Feature', 'w'), head('Status', 'w'), head('Notes', 'w')],
    ['26', 'Categorised document checklist', st('real', 'Working'), '7 entries with status badges; statuses are seed values'],
    ['27', 'Download checklist as PDF', st('real', 'Working'), 'A real PDF is produced in-browser by pdf-lib'],
    ['28', 'Manual document upload', st('stub', 'Stub'), 'Shows a toast saying the portal is ready for backend integration'],
    ['29', 'DigiLocker connect and Aadhaar entry', st('sim', 'Simulated'), 'No service contacted; the number stays in the browser tab'],
    ['30', 'DigiLocker OTP step', st('sim', 'Simulated'), 'Any six digits pass. The UI states no OTP was sent'],
    ['31', 'DigiLocker document selection', st('sim', 'Simulated'), '6 sample documents, clearly labelled as samples'],
    ['32', 'DigiLocker import into application', st('real', 'Working'), 'Correctly links documents without creating duplicates']
  ], [24, 148, 62, 281]),

  H2('6.4 Branch locator and maps'),
  table([
    [head('#', 'w'), head('Feature', 'w'), head('Status', 'w'), head('Notes', 'w')],
    ['33', 'MapLibre GL vector map', st('real', 'Working'), 'WebGL, smooth zoom, drag-rotate, 3D pitch to 60 degrees'],
    ['34', 'Map and Satellite switcher', st('real', 'Working'), 'Street from a free vector style; satellite from Esri World Imagery'],
    ['35', 'Fit-all-branches control', st('real', 'Working'), 'Frames the current result set with animation'],
    ['36', 'My-location control', st('real', 'Working'), 'Tracks user position and heading'],
    ['37', 'Google-style pins and InfoWindow cards', st('real', 'Working'), 'Cards carry IFSC, hours and a Google Maps directions link'],
    ['38', 'Branch list, search and filters', st('real', 'Working'), 'By bank, city and free-text search'],
    ['39', 'Data provenance badges', st('real', 'Working'), 'Sample records visibly badged as unverified'],
    ['40', 'Geolocation and nearest-city detection', st('real', 'Working'), 'Honest denial path; no invented coordinates'],
    ['41', 'IFSC codes and directions links', st('real', 'Working'), 'Present on the 15 verified records'],
    ['42', 'Leaflet fallback engine', st('real', 'Working'), 'Automatic safety net if MapLibre fails to initialise'],
    ['43', 'Offline map notice with working retry', st('real', 'Working'), 'Explains the real cause and recovers when the network returns'],
    ['44', 'Optional Google Maps SDK path', st('unv', 'Unverified'), 'Documented, but cannot be tested without a billed API key'],
    ['45', 'Book a branch visit', st('stub', 'Stub'), 'Toast only; no booking exists']
  ], [24, 148, 62, 281])
);

c.push(
  PAGEBREAK(),
  H2('6.5 P2P lending module'),
  P('Implemented as a demonstrator. All 11 capabilities below (features 46 to 56) operate on local state, and the interface states in three separate places that no real money moves.', { size: 9 }),
  table([
    [head('#', 'w'), head('Feature', 'w'), head('Status', 'w'), head('Notes', 'w')],
    ['46', 'P2P overview and mode switch', st('real', 'Working'), 'Borrower and lender modes'],
    ['47', 'Post a loan request', st('sim', 'Simulated'), 'Capped at 5,00,000 for the demo'],
    ['48', 'Discover borrowers', st('sim', 'Simulated'), '6 seeded requests with filters'],
    ['49', 'Investor preferences panel', st('sim', 'Simulated'), 'Amount, rate ceiling, risk tolerance, tenure'],
    ['50', 'Match scoring both directions', st('sim', 'Simulated'), 'Clamped 55-99, so always flattering. See section 5.3'],
    ['51', 'Loan detail and funding modal', st('sim', 'Simulated'), 'Full amortisation schedule shown'],
    ['52', 'Confirm investment', st('sim', 'Simulated'), 'Button reads "Confirm Demo Investment"; toast confirms no money moved'],
    ['53', 'Portfolio with projected returns', st('sim', 'Simulated'), 'Progress is frozen at seed time, so interest earned never grows. Finding 8'],
    ['54', 'My requests with funding progress', st('sim', 'Simulated'), 'Tracks funding against a target'],
    ['55', 'Borrower-lender chat', st('sim', 'Simulated'), 'Local message list per request'],
    ['56', 'Request deletion', st('sim', 'Simulated'), 'Local only']
  ], [24, 148, 62, 281]),
  P('Feature identifiers are unique across sections 6.1 to 6.5 and run continuously from 1 to 56.', { size: 8, color: C.slate, italics: true })
);

// ============================== 7. FLOWS ==============================
c.push(
  H1('7. Primary User Flows'),

  H2('7.1 Compare a home loan'),
  B('Land on the page, press "Start Comparing Free", sign in with the pre-filled demo credentials.'),
  B('On the dashboard, Home Loan is pre-selected. Adjust amount, tenure, income, employment type or CIBIL if needed; every change recalculates live.'),
  B('Press "Find Matching Loan". This is a deliberate gate: nothing is recommended until the user asks.'),
  B('Receive three weighted recommendations, the lowest-rate offer as the hero card, and a sortable full comparison list.'),
  B('Open any bank\'s "Details and Docs" to see Overview, Eligibility and Hidden Charges, including the total you would pay.'),
  B('Download the document checklist as a real PDF.'),
  B('Open the Branches tab for that bank to see the map and the branch list for the filtered city.'),

  H2('7.2 Find a branch using your real location'),
  B('Open Branch Locator from the sidebar or from a bank\'s detail page.'),
  B('Choose a city, or press "Current Location" and grant geolocation permission.'),
  B('If permission is granted, the app selects your nearest covered city by great-circle distance and shows each branch\'s real distance from you. If refused, it says so plainly and leaves the city selector alone.'),
  B('Click a branch card to fly the map to it, or click a pin to open its InfoWindow with IFSC, hours and a directions link.'),
  B('Filter further by bank or free-text search; the map and the list update together.'),
  B('If the basemap cannot load, an overlay explains that tiles come from a remote server and offers a retry button that genuinely works.'),

  H2('7.3 Explore the P2P marketplace'),
  B('Switch to Lender mode, set preferences, and press "Find Borrowers".'),
  B('Review scored matches, open one to see the full amortisation schedule, and confirm a demonstration investment.'),
  B('The portfolio view shows the position and projected interest, with an explicit notice that no real payment was made.'),
  B('Switch to Borrower mode to post a request and message matched lenders.')
);

// ============================== 8. PERSISTENCE ==============================
c.push(
  H1('8. Persistence Model'),
  P('There is exactly one localStorage key, holding one JSON document.'),
  {
    margin: [0, 2, 0, 10],
    table: {
      widths: [140, 351],
      body: [
        [head('Key', 'w'), head('loanfinder.db.v1', 'w')],
        ['Logical tables', 'savedOffers, savedP2PRequests, meta, prefs, prefsSavedAt, p2p'],
        ['p2p document', 'p2pRequests, p2pInvestments and p2pMessages'],
        ['prefs', 'emailAlerts (false), rateDropAlerts (true), inrDisplay (true)'],
        ['meta', 'demoSeeded flag and seededAt timestamp'],
        ['Legacy migration', 'An older key, loanfinder.p2p.v1, is read once, copied into db.p2p, then permanently deleted'],
        ['Failure handling', 'Every access is wrapped in try/catch; a full or blocked storage degrades to a console warning and the app keeps working in memory']
      ]
    },
    layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => C.border, vLineColor: () => C.border, paddingTop: () => 5, paddingBottom: () => 5, paddingLeft: () => 6, paddingRight: () => 6 },
    fontSize: 8.5
  },
  H2('8.1 What survives a page reload'),
  table([
    [head('Persisted', 'w'), head('Not persisted (reset on reload)', 'w')],
    ['Saved offers', 'Loan amount, tenure, income, employment type, credit score'],
    ['Saved P2P request ids', 'Selected loan categories and credit tier'],
    ['P2P requests, investments and chat messages', 'Active bank and match-visibility state'],
    ['Settings toggles and when they were saved', 'Map style, map engine and geolocation'],
    ['', 'DigiLocker Aadhaar number and imported documents'],
    ['', 'P2P mode, active loan and portfolio progress']
  ], [200, 315])
);

// ============================== 9. MAPS ==============================
c.push(
  PAGEBREAK(),
  H1('9. Maps, Network and External Dependencies'),

  H2('9.1 Engine selection'),
  P('The branch map prefers MapLibre GL and falls back to Leaflet automatically if the MapLibre bundle fails to initialise. Both engines are vendored, so neither depends on a CDN.'),
  table([
    [head('Provider', 'w'), head('Used for', 'w'), head('API key', 'w'), head('Cost', 'w'), head('Network', 'w')],
    ['MapLibre + OpenFreeMap', 'Primary, street view', 'None', 'Free, no limits', 'Required'],
    ['Esri World Imagery', 'Satellite view', 'None', 'Free for this use', 'Required'],
    ['OpenStreetMap raster', 'Leaflet fallback', 'None', 'Free, usage policy applies', 'Required'],
    ['Google Maps SDK', 'Optional, user-enabled', 'Yes, user must supply', 'Billed per request', 'Required']
  ], [120, 130, 105, 90, 70]),

  H2('9.2 Why MapLibre rather than the Google Maps SDK'),
  B('Google Maps requires an API key from a Google Cloud project with billing enabled. The embed endpoint was tested during development and returns HTTP 401 Unauthorized without one.'),
  B('This project ships no key, so a Google-Maps-styled interface was built on MapLibre with free vector basemaps. It delivers the same interface qualities - smooth inertial zoom, drag-rotate, 3D pitch, styled controls, InfoWindow cards - with no key, no billing account and no secret committed to the repository.'),
  B('The real Google Maps SDK is still reachable. Setting window.LOANFINDER_GOOGLE_MAPS_KEY in index.html and calling app.setMapProvider(\'google\') switches to it, with native ROADMAP and HYBRID layer control and Google InfoWindows. This path is documented but was NOT verified, because verifying it requires a billed key. Anyone enabling it must restrict the key by HTTP referrer and set a usage quota, because a key in client-side HTML is readable by anyone who loads the page.'),

  H2('9.3 The one genuine offline limitation'),
  P('Every library is vendored, so the application loads and runs with no network. The map basemap is the exception: it fetches vector tiles and a style document from a remote server at runtime. With no network the map area is blank.'),
  P('This was originally a silent failure - a flat grey rectangle with floating pins and no explanation. It has since been fixed: the map engine tracks tile and style load errors, and after a grace period raises an on-screen overlay naming the real cause and offering a retry button that re-fetches the style and genuinely recovers when the network returns. The branch list, IFSC codes and directions links remain fully usable without a connection.', { size: 9 })
);

// ============================== 10. PDF ==============================
c.push(
  H1('10. PDF Document Generation'),

  H2('10.1 How it works'),
  P('The document checklist download produces a genuine PDF in the browser using the vendored pdf-lib build. No print dialog, no server-side renderer, no placeholder file.'),
  B('pdfSafeText() strips characters the embedded standard fonts cannot encode.'),
  B('pdfWrap() performs width-aware line breaking against the measured font metrics.'),
  B('Status colours are plain RGB, not theme-derived, because the standard-14 fonts have no colour space support for theme tokens.'),
  B('A separate HTML print path exists as a fallback if PDF generation fails outright.'),

  H2('10.2 The rupee-sign problem'),
  P('The Indian rupee sign U+20B9 sits outside the WinAnsi encoding used by the PDF standard-14 fonts. Rendering a naive "₹" produced an unmappable glyph and silently dropped the character - a real bug that corrupted every amount in the document. The fix routes all monetary text through a sanitiser, and all amounts in the generated PDF now display correctly with the rupee sign intact.', { size: 9 }),

  H2('10.3 Verification'),
  table([
    [head('Check', 'w'), head('Result', 'w')],
    ['File header', 'Valid %PDF- signature, opens in a standard reader'],
    ['Page count', 'Exactly 1 page'],
    ['Size', '3,546 bytes for the checklist'],
    ['Text extraction', 'Document titles and rupee-denominated amounts extract as expected'],
    ['Rupee glyph', 'Present and correctly mapped after the sanitiser fix']
  ], [170, 345])
);

// ============================== 11. A11Y ==============================
c.push(
  H1('11. Accessibility and UX Engineering'),
  B('Every visible control carries an accessible name, supplied by a label element, an aria-label, or visible text. This was verified by a dedicated suite that enumerates focusable elements and fails on any unnamed control.'),
  B('Focus is visible through a :focus-visible ring, with an @supports fallback for browsers without :focus-visible support.'),
  B('Escape closes the topmost overlay through one central manager, in the correct order: modal, then support panel, then sidebar. Any future modal must be registered in that manager\'s id list.'),
  B('Modal dialogs are height-capped at 90vh with a scrollable body and a pinned, opaque close button, so the close control can never be pushed out of reach on a short viewport. This was verified across desktop, laptop, tablet, phone and short-window viewports.'),
  B('The mobile sidebar has a scrim that closes the drawer on outside click.'),
  B('The map layer switcher uses aria-pressed on toggle buttons, and each branch pin is a real button with an accessible label rather than a decorative image.'),
  B('Icons are hydrated through a safe wrapper that cannot throw if the icon bundle fails to load, so a missing library degrades appearance rather than breaking rendering.')
);

// ============================== 12. TESTING ==============================
c.push(
  PAGEBREAK(),
  H1('12. Verification and Testing'),
  P('The application is verified by Playwright driving Chromium against the real user interface over file://, which is exactly how a user opens it. No mocking of application state. 114 assertions pass across seven suites, with zero console or page errors reported in any run.'),

  H2('12.1 Suite results'),
  table([
    [head('Suite', 'w'), head('Result', 'w'), head('Coverage', 'w')],
    ['test-googlemap.js', '21 / 21', 'WebGL canvas present and sized, vector tiles loaded, zoom and geolocate controls, one pin per geocoded branch, InfoWindow contents, Map/Satellite switch and switch back, markers surviving a layer change, fit-all re-framing, card-click fly-to, city filter re-rendering, real IFSC shown on verified records and absent on demo records, blocked-tile notice, list usable offline'],
    ['test-map-pixels.js', '9 / 9', 'Proves real basemap data renders by querying MapLibre for rendered features'],
    ['test-map.js', '8 / 8', 'Map background loads; offline notice appears with the correct message; retry recovers the map once the network returns'],
    ['regression.js', '29 / 29', '19 required flows end to end plus accessibility spot checks, including matching, EMI, bank details, charges, saved offers, profile, settings and the branch map'],
    ['test-p2p-overflow.js', '28 / 28', 'Dialog fit and scroll reachability across 4 viewport sizes, including a deliberately short window'],
    ['test-geo-branch.js', '10 / 10', 'Geolocation granted and denied, nearest-city detection, cards, markers, filters, search, empty states, IFSC and source display, sample badges'],
    ['test-digilocker.js', '9 / 9', 'Full connect flow, OTP gating, wrong-OTP rejection, document selection, import, and no duplicate documents']
  ], [110, 50, 355]),
  P('Supporting checks: a critical end-to-end flow test, a 10-combination matching matrix covering empty states, a catalogue-versus-display consistency audit, a checklist PDF test that validates the header and extracts text, an accessible-name sweep, and an encoding scanner that verifies no byte-order mark or mojibake has entered the source files.', { size: 8.5, color: C.slate }),

  H2('12.2 How the map render was actually proved'),
  P('Asserting that a map "loaded" is weak evidence, because a canvas can be created and still be empty. Two independent proofs were used.'),
  B('Rendered-feature query. Asking the map engine what is actually on screen returns 265 features across 16 distinct basemap layers, including city and town label layers, motorway inner and casing layers, and administrative boundary layers. As a control, the same query with tile requests blocked returns 0 features, which proves the check can fail and is therefore meaningful.'),
  B('Source identity. The active street style is backed by the OpenMapTiles vector source; switching to satellite replaces it with the Esri raster source. Both were confirmed by reading the live style.'),
  P('An earlier attempt to read pixels directly from the WebGL canvas via drawImage returned a single flat colour in every case, including the known-good case. That is a property of WebGL compositing rather than a defect in the app: the drawing buffer is cleared after compositing unless preserveDrawingBuffer is set. The check was discarded as incapable of proving anything and replaced with the two methods above.', { size: 8.5, color: C.slate, italics: true }),

  H2('12.3 Arithmetic verification'),
  P('The EMI formula and the four-factor match score were re-implemented independently from the specification and compared against the shipped code. Both reproduce exactly, including the counter-intuitive Axis-over-ICICI ranking. Verified figures: EMI of 28,950 for 35,00,000 at 7.85% over 20 years, and match scores of 100, 73 and 55 for the default profile.'),

  H2('12.4 Honest limits of this verification'),
  B('The tests are not committed to the repository. They live in a temporary directory and will be lost. Wiring them in requires a test runner, which this project deliberately does not have.'),
  B('No unit tests exist for the algorithms; the arithmetic was verified by independent re-implementation and comparison, which is weaker than committed unit tests.'),
  B('The Google Maps SDK path is untested, as it requires a billed key.'),
  B('No accessibility audit against a formal standard such as WCAG was performed. The checks confirm accessible names, focus visibility and keyboard dismissal, which is a meaningful subset but not a conformance claim.')
);

// ============================== 13. DISCLOSURES ==============================
c.push(
  PAGEBREAK(),
  H1('13. Disclosure Register'),
  P('This section states plainly what is real and what is simulated. It is the part of the report a reader should not skip.'),

  H2('13.1 Genuinely implemented'),
  table([
    [head('Capability', 'w'), head('What is real', 'w')],
    ['EMI calculation', 'Mathematically correct reducing-balance annuity, verified to the rupee'],
    ['Weighted match scoring', 'Four-factor weighted model with a hard eligibility filter; reproduced independently'],
    ['Hidden charges and total cost', '35 fee line items; totals computed from the user\'s actual loan amount'],
    ['PDF checklist', 'A real PDF file is generated client-side; rupee sign handled correctly'],
    ['Branch map', 'WebGL vector rendering with 265 rendered features verified; satellite layer; controls work'],
    ['Branch data for 15 records', 'Real IFSC codes with official bank source links'],
    ['Distance calculation', 'Great-circle maths on a real GPS reading, only after explicit permission'],
    ['Persistence', 'Genuinely written to and read from localStorage'],
    ['Accessibility mechanics', 'Accessible names, focus rings, keyboard dismissal, reachable close buttons']
  ], [130, 385]),

  H2('13.2 Simulated, and labelled as such in the interface'),
  table([
    [head('Capability', 'w'), head('What actually happens', 'w'), head('In-app disclosure', 'w')],
    ['DigiLocker import', 'Six simulated documents; any six-digit OTP passes; no service contacted', 'Yes - states no OTP is sent and no data leaves the browser'],
    ['Authentication', 'Form validated in the browser only; no credentials transmitted or stored', 'Yes - password reset and social sign-in marked not wired up'],
    ['P2P lending', 'Funding, portfolio and chat run entirely on local state', 'Yes - three prototype notices, and the confirm button reads "Confirm Demo Investment"'],
    ['P2P match percentages', 'Clamped between 55 and 99 regardless of true fit', 'Partially - labelled demo scoring, but the clamp itself is not explained to the user'],
    ['Loan rates', 'Static literals in source; not a live feed', 'Yes - README and landing copy state rates are illustrative'],
    ['Branch records for 18 of 33', 'Illustrative placeholder coordinates with no IFSC and no source', 'Yes - badged "Sample data - not verified" with a tooltip'],
    ['Branch hours and phone numbers', 'Static literals, never refreshed', 'Not disclosed to the user'],
    ['Email and rate-drop alerts', 'Settings toggles with no delivery mechanism', 'Partially - described as browser-only preferences']
  ], [120, 205, 190]),

  H2('13.3 Stubs with no implementation'),
  B('Manual document upload - shows a toast saying the portal is ready for backend integration.'),
  B('Book a branch visit - a toast only; no booking capability exists.'),
  B('Forgot password, Google sign-in and Apple sign-in - each states in the UI that it is not wired up.')
);

// ============================== 14. FINDINGS ==============================
c.push(
  PAGEBREAK(),
  H1('14. Audit Findings and Known Issues'),
  P('An audit of this build for unsupported claims and inaccurate numbers identified the eight items below. Each was verified directly against the source. None has been fixed yet; they are recorded here rather than quietly omitted.'),

  H2('14.1 Unsupported or inaccurate claims'),
  table([
    [head('#', 'w'), head('Finding', 'w'), head('Location', 'w'), head('Severity', 'w')],
    ['1', 'The support bot states a toll-free number 1800-419-0000, an email support@loanfinder.in, and an average response time of under 5 minutes. None of these can be verified, and this branch of the conversation carries no disclaimer. The project\'s own written rule forbids manufacturing formal evidence. This is the clearest honesty violation in the build.', 'app.js:5099', { text: 'High', color: C.rose, bold: true }],
    ['2', 'The support bot tells users they will get branch cards "plus a live map". All 18 Mumbai, Delhi and Bengaluru records are explicitly labelled sample placeholders, so calling them live contradicts the badge shown on the very same screen.', 'app.js:5123', { text: 'High', color: C.rose, bold: true }],
    ['3', 'The landing page phone mockup shows an EMI of 27,704 per month. The app\'s own calculator returns 28,950 for the displayed default profile, a difference of 1,246. The figure also matches no tenure up to 40 years for that principal and rate, so it appears to be fabricated.', 'index.html:96', { text: 'High', color: C.rose, bold: true }],
    ['4', 'The statistics band labels the 7 built-in offers "Live Offers" in five places. This directly contradicts the landing copy stating rates are illustrative and the README scope note stating they are not live feeds.', 'index.html:119 and 4 more', { text: 'Medium', color: C.amber, bold: true }],
    ['5', 'Every offer carries a hardcoded lastUpdated string such as "Today" or "2 days ago". A literal can never become stale, so it presents a false freshness signal that will still read "Today" in a year.', 'app.js:86 and per offer', { text: 'Medium', color: C.amber, bold: true }],
    ['6', 'The landing page invites users to "Join thousands of smart borrowers". No user count exists and none can be substantiated. This is precisely the class of fabricated scale claim the project\'s own product rules prohibit.', 'index.html:197', { text: 'Medium', color: C.amber, bold: true }],
    ['7', 'The maintenance report shows the third match score as unavailable when the algorithm produces 55%. An omission that understates the project\'s own matching logic.', 'PHASE1 report:174', { text: 'Low', color: C.slate, bold: true }],
    ['8', 'The maintenance report states that P2P data resets on reload. It does not: requests, investments and messages are all persisted through db.p2p. The report is wrong in the project\'s favour, but it is still wrong.', 'PHASE1 report:252', { text: 'Low', color: C.slate, bold: true }]
  ], [22, 340, 100, 53]),

  H2('14.2 Functional and product weaknesses'),
  table([
    [head('#', 'w'), head('Finding', 'w'), head('Impact', 'w')],
    ['9', 'The support bot is keyword matching against 11 hardcoded intents, not natural language understanding. Anything outside those patterns falls through to a canned reply.', 'Low for a demo; would be unacceptable in production'],
    ['10', 'Four of six loan categories - car, education, business and gold - can be selected but match zero offers, producing an empty result. The app is honest about this, but it is a dead end for the user.', 'Noticeable. Four of six entry points lead nowhere'],
    ['11', 'Seven verified branch records have no coordinates and therefore never appear on the map, appearing only in the card list. Users may assume those branches do not exist.', 'Moderate'],
    ['12', 'The P2P portfolio never progresses. monthsElapsed is frozen at seed time, so "Interest Earned" does not grow with real time even across days.', 'Undermines the realism of the demo'],
    ['13', 'The best-offer hero card always shows the lowest-rate offer rather than the highest match score, which can differ, as ICICI versus Axis demonstrates.', 'Low, but could confuse'],
    ['14', 'The user profile view displays hardcoded sample applicant data and persists nothing editable. There is no user data model at all.', 'Significant for any real deployment'],
    ['15', 'The catalogue is frozen in source. Adding a bank or changing a rate requires editing app.js.', 'Maintenance burden'],
    ['16', 'No tests are committed to the repository and no test runner is configured, so the entire verification harness in section 12 is one directory deletion from being lost.', 'High for maintainability']
  ], [22, 355, 138]),

  H2('14.3 Engineering work already completed'),
  P('To keep this report balanced, the defects found and repaired during development are listed in section 12 and in the accompanying PHASE1 completion report. In summary: real client-side PDF generation, the rupee glyph failure, thirteen UI defects including modal overflow on short viewports, an accessibility labelling pass, an encoding corruption that was introduced and then fully repaired, an incorrect feature count on the landing page, and the silent map failure described in section 9.3.')
);

// ============================== 15. RUN ==============================
c.push(
  PAGEBREAK(),
  H1('15. How to Run'),
  P('There is no build step, no package install and no server required for the application itself.'),
  ...[
    ['Option 1 - direct', 'Double-click index.html. The app opens in the default browser. Note that some browsers restrict geolocation on file:// URLs; if "Current Location" does not work, serve over localhost using option 2.'],
    ['Option 2 - local server', 'From the p1 directory run python -m http.server 3000, or npx serve . , then open http://localhost:3000. This is the recommended method for testing geolocation.'],
    ['Option 3 - any static host', 'Deploy the p1 folder as-is to any static host. No server-side runtime is needed because there is no backend.']
  ].map(([k, v]) => ({
    columns: [
      { text: k, fontSize: 9.5, bold: true, color: C.blue, width: 105 },
      { text: v, fontSize: 9.5, color: '#1e293b' }
    ],
    margin: [0, 0, 0, 9]
  })),
  H2('15.1 Requirements'),
  B('Any modern browser with WebGL support. Internet access is required only for the map basemap.'),
  B('Geolocation additionally requires HTTPS or file://. On a plain http:// origin the browser blocks it, which is a browser rule rather than an application limitation.'),
  H2('15.2 Sign-in'),
  P('The sign-in modal is pre-filled with demo credentials (alex.j@example.com / password123). Any input is accepted, because the form performs client-side validation only and never transmits or stores anything.'),

  H2('15.3 Regenerating this report'),
  P('This document is generated by generate_complete_report.js in the p1 directory, using the pdfmake build-time dependency declared in package.json. That dependency exists only for report generation and is never loaded by the application. To regenerate: node generate_complete_report.js')
);

// ============================== 16. LIMITATIONS ==============================
c.push(
  H1('16. Limitations'),
  B('Rates are static. Seven offers from five banks, frozen in source, not a live feed, and never refreshed.'),
  B('There is no backend, so no real authentication, no real KYC and no server-side persistence.'),
  B('DigiLocker is fully simulated. No API is integrated and no document ever leaves the browser.'),
  B('P2P is a demonstration. No money moves, no credit decision is made and no contract exists.'),
  B('18 of 33 branch records are illustrative placeholders. Only the 15 with IFSC codes and official source links represent verified data.'),
  B('Branch hours and phone numbers are static literals that are never refreshed, and the app does not disclose this to the user.'),
  B('The map basemap requires internet. Everything else works offline.'),
  B('The Google Maps SDK path is implemented but unverified.'),
  B('Match percentages in the P2P module are clamped between 55 and 99 and are not meaningful as probabilities.'),
  B('No tests are committed and no test runner is configured.'),
  B('No formal accessibility conformance audit has been performed.'),
  B('There is no user data model. The profile view displays sample data and persists nothing.'),
  B('Eight unsupported or inaccurate claims remain in the build, detailed in section 14.1. The three marked High should be fixed before any public demonstration.')
);

// ============================== 17. ROADMAP ==============================
c.push(
  H1('17. Roadmap'),
  P('Ordered by value against effort, assuming the project continues beyond the hackathon.'),

  H2('Tier 1 - correctness and trust (do first)'),
  B('Remove the three High-severity claims in findings 1, 2 and 3: the fabricated support contact details and response-time guarantee, the "live map" description of sample data, and the incorrect mockup EMI.'),
  B('Replace the "Live Offers" label with "Offers in catalogue" and remove or make truthful the "Join thousands" claim.'),
  B('Derive lastUpdated from an actual data timestamp, or remove the field.'),
  B('Commit the test harness with a runner, so the 114 passing assertions are not one deletion from being lost.'),

  H2('Tier 2 - product depth'),
  B('Build the manual upload path so document statuses become derived from user state rather than seed values.'),
  B('Source IFSC and coordinates for the 7 verified branches that lack coordinates, or mark them clearly as list-only.'),
  B('Either populate the four coming-soon loan categories with sourced offers or disable them, so no entry point leads to an empty result.'),
  B('Add a real applicant profile model so the profile view reflects and persists user input.'),
  B('Make the P2P portfolio progress with elapsed time, or label the figures as a fixed snapshot.'),

  H2('Tier 3 - production readiness'),
  B('Introduce a backend and move authentication, KYC and document storage server-side.'),
  B('Integrate a real DigiLocker OAuth flow.'),
  B('Replace the frozen catalogue with a scheduled data source, with the freshness guarantee that implies.'),
  B('Commission a formal WCAG 2.2 AA audit.'),
  B('Decide the map strategy deliberately: keep keyless MapLibre, or budget for a Google Maps key with referrer restrictions and a usage cap.')
);

// ============================== CLOSING ==============================
c.push(
  SPACER(14),
  RULE([0, 0, 0, 10]),
  P('End of report. All figures in this document were read from the running application and independently cross-checked. Where behaviour is simulated, this report says so; where a claim in the build is unsupported, section 14 records it.', { size: 9, italics: true, color: C.slate, align: 'center' })
);

const target = path.join(__dirname, '..', 'LoanFinder_Complete_Project_Report.pdf');
(async () => {
  const pdfDoc = pdfMake.createPdf(doc);
  await pdfDoc.write(target);
  console.log('PDF created at: ' + target);
  console.log('Size: ' + fs.statSync(target).size.toLocaleString('en-IN') + ' bytes');
})().catch(err => {
  console.error('FAILED: ' + err.message);
  process.exit(1);
});
