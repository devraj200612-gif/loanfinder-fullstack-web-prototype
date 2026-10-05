# LoanFinder — Phase 1 Completion Report

**Scope:** Phase 1 only. The prototype remains a zero-build, offline, static web app
(vanilla HTML/CSS/JS). No backend, database, or server architecture was introduced.

**Date:** 30 September 2026
**Result:** All 6 test suites pass (55 assertions) with zero browser console errors.
The mandatory critical loan-matching flow is unchanged and still passes.

---

## 1. Files changed

| File | Change |
|---|---|
| `app.js` | PDF checklist generation; data-driven bank Overview/Eligibility tabs; preference persistence; global Escape/sidebar-scrim handlers; WinAnsi text sanitiser; honest DigiLocker copy; sample-data badge for unverified branch records |
| `index.html` | Vendored `pdf-lib` script tag; PDF download button; stable preference control IDs + `role="switch"`/`aria`; corrected `for`/`aria-label` attributes; corrected DigiLocker simulation wording |
| `styles.css` | `:focus-visible` focus ring (+ fallback); mobile sidebar scrim; `.branch-sample-badge` |
| `generate_report.js` | Corrected "25+" bank/offer claims to 5 banks / 7 offers; removed unsupported trust-claim wording |
| `vendor/pdf-lib.min.js` | **New.** Copied from `node_modules` so the app stays fully offline |
| `README.md` | Fixed a broken absolute `app.js` link |
| `LoanFinder_Project_Status_Report.pdf` | Regenerated (7 pages) |

### Deliberately NOT changed
- **Loan matching / ranking logic.** The critical test passed on arrival, so no
  matching code was touched. No eligibility rule was weakened.
- **Branch coordinates and the branch locator.** Real GPS data was already
  implemented correctly; only the sample-data labelling was added.
- **HTML fallback for the checklist.** Kept as a fallback if `pdf-lib` is missing.

---

## 2. Bugs actually found and fixed

Each was reproduced through the browser before being changed.

1. **Checklist download produced no PDF.** The button downloaded an HTML file.
   Replaced with real client-side PDF generation via `pdf-lib`.
2. **PDF generation threw on the rupee sign.**
   `WinAnsi cannot encode "₹" (0x20b9)` — the standard-14 PDF fonts are
   WinAnsi-encoded. Added `pdfSafeText()` and routed *all* PDF text through a
   single `draw()` entry point so sanitising cannot be skipped. Wrapping now also
   measures sanitised text so line breaks match the rendered output.
3. **PDF generation threw on status-pill colour.**
   `` `red` must be of type `number`, but was actually of type `NaN` `` —
   pdf-lib's `Color` object does not expose `.r/.g/.b`. Replaced with explicit
   RGB triples.
4. **Broken label association.** `<label for="loan-amount">` pointed at a
   non-existent id; the range input is `loan-amount-range`. Fixed.
5. **Unlabelled exact-value inputs.** `sort-results`, the three eligibility
   numeric inputs, global search, support chat input, and the DigiLocker Aadhaar
   field had no accessible name. Added `aria-label` / `for` as appropriate.
6. **No keyboard focus ring.** Added `:focus-visible` plus a `@supports` fallback
   for older browsers. Verified by tabbing to a control and reading the computed
   outline (`solid`, `2px`).
7. **Escape did not close modals.** Only the support widget listened for Escape,
   and only when focus was already inside it. Added `bindGlobalDismiss()` which
   closes the topmost layer (modal → support panel → sidebar) and returns focus.
8. **Mobile drawer had no scrim and could not be dismissed by tapping outside.**
   Added `setSidebarOpen()` + `ensureSidebarScrim()`; tapping a nav item or the
   scrim now closes it.
9. **Duplicated word in the DigiLocker OTP step.** It read
   "your **your** registered mobile number" because the markup already contained
   "your" and the JS overwrote the `<strong>` with a phrase that repeated it.
10. **Two unsupported DigiLocker claims.**
    - The login step claimed "a simulated OTP is shown on screen" while the OTP
      display had already been removed — stale and misleading.
    - A toast said "OTP sent to your Aadhaar-linked mobile number" when no OTP is
      ever sent. Replaced with an explicit simulation notice.
11. **Unverified branch records looked identical to verified ones.** The 18
    legacy placeholder records (Mumbai/Delhi/Bengaluru) now carry a visible
    "Sample data · not verified" badge.
12. **P2P "View Details" dialog overflowed the screen and locked the user out.**
    `.modal-card` had no height cap and no scroll container, while
    `.modal-overlay` centred its content with `align-items: center` and could
    not scroll. Measured on a 1440×900 desktop the dialog was 1240px tall, so
    **170px was clipped off the top *and* 170px off the bottom** — the close
    button sat at `top: -150px` and was completely unreachable. On a 390×844
    phone, 473px was clipped at each end, hiding the borrower header, amount
    and the Lend button entirely; Escape was the only escape route. Fixed by
    capping `.modal-card` at `90vh` and making it a flex column whose body
    scrolls (`min-height: 0` is required, otherwise a flex child refuses to
    shrink below its content height), making the overlay scrollable as a safety
    net, and giving the close button an opaque background so scrolled content
    cannot slide under it. The sibling `.modal-content` class (DigiLocker)
    already had `max-height: 90vh; overflow-y: auto`, so this brought
    `.modal-card` in line with the existing pattern.
13. **The branch map failed silently when the tile server was unreachable.**
    Leaflet is vendored, but the map imagery was fetched live from
    `tile.openstreetmap.org`. With tiles blocked, the map rendered a flat grey
    rectangle with 3 floating pins, **no explanation and no error**: 12 tile
    requests failed, 0 rendered, and nothing on screen said why.
14. **The map was a 2015-era raster slippy map, not a modern map experience.**
    Requested a real "Google Maps" interface. Google Maps needs an API key that
    this project does not have (verified: the embed endpoint returns HTTP 401
    without one), and shipping a key in client-side HTML exposes it. So the map
    was rebuilt on **MapLibre GL** with free vector basemaps, which gives the
    Google interface without a key, a billing account, or a secret in the repo:
    - smooth inertial zoom, drag-rotate, and 3D pitch (`maxPitch: 60`)
    - Map / **Satellite** switcher (Esri World Imagery)
    - "Fit all branches" framing control, plus a "My location" control
    - Google-style red teardrop pins and InfoWindow cards carrying IFSC, hours
      and a Google Maps directions link
    - **Leaflet is retained as an automatic fallback**, so a failed MapLibre
      bundle still yields a working branch view
    - The offline notice was rewritten to name the real sources, and the retry
      button now re-fetches the style (verified to recover once the network
      returns — `triggerRepaint()` alone cannot fix a failed style load).
    An optional `app.setMapProvider('google')` path loads the real Google Maps
    SDK if you supply a key via `window.LOANFINDER_GOOGLE_MAPS_KEY`. It is
    **documented but not verified**, because verifying it requires a billed key.

### Regression I caused and repaired
While editing `index.html` I used a PowerShell `Get-Content -Raw` /
`Set-Content -Encoding UTF8` round-trip, which read UTF-8 bytes as CP1252 and
re-encoded them. That silently corrupted all non-ASCII characters: **29 `₹`
signs and every em dash became mojibake**, and a BOM was added. Detected with
`check-encoding.js`, repaired with `fix-encoding.js` (a CP1252→UTF-8 round-trip
that only accepts a run if it re-decodes to valid UTF-8), and re-verified: 29
`₹` restored, 0 mojibake, no BOM, across all five source files.

---

## 3. Tests actually run

Playwright + Chromium, driven against the real UI over `file://`. All harnesses
are in `%TEMP%\opencode\lftest`.

| Suite | Result | Covers |
|---|---|---|
| `test-e2e.js` | PASS | Critical matching flow, real click-through |
| `test-matrix.js` | PASS | 10 loan-type/amount/income combinations, empty states |
| `regression.js` | **29/29** | The 19 required flows + 3 a11y spot checks |
| `test-p2p-overflow.js` | **28/28** | P2P dialog fit + scroll reachability at 4 viewports |
| `test-googlemap.js` | **21/21** | Google-style map: WebGL canvas, vector tiles, controls, pins, InfoWindow cards, Map/Satellite switch, fit-all, filters |
| `test-map-pixels.js` | **9/9** | Proves real basemap data renders (`queryRenderedFeatures`: 265 features across 16 layers incl. `label_city`, highways, boundaries) and that blocking tiles yields 0 features |
| `test-map.js` | **8/8** | Map background loads; honest notice + working retry when it cannot |
| `test-geo-branch.js` | **10/10** | GPS granted, GPS denied, branch cards, markers, filters, empty combo, provenance |
| `test-digilocker.js` | **9/9** | Full DigiLocker flow, OTP gating, rejection, import, no duplicates |
| `test-consistency.js` | PASS | Catalog counts vs. displayed counts, branch provenance, no stale claims |
| `test-checklist-pdf.js` | PASS | Real download; PDF header, page count, extracted text |
| `test-labels.js` | PASS | Every visible form control has an accessible name |

**Browser console errors: none** across every run.

### Test-harness bugs I had to fix (not app bugs)
Recording these because they initially looked like product failures:
- The landing assertion sampled the stat count-up mid-animation and read
  `7.51%` instead of the final `7.85%`.
- An EMI assertion expected a *longer* tenure to raise the EMI. The correct
  expectation is the opposite.
- The P2P test called non-existent `app.investInP2P`. The real flow is
  `openLendModal()` → `confirmInvestment()`; the chat method is
  `sendChatMessage()`, not `sendP2PMessage`.
- The `:focus-visible` check read `styleSheets[].cssRules`, which throws over
  `file://` (cross-origin). Replaced with a check of the computed outline on a
  keyboard-focused element.
- The label audit reported 4 "unlabelled" inputs; those controls are labelled via
  `closest('label')`/`placeholder`, which the first heuristic ignored.
- A branch test raced two city/bank switches on shared `appState`.

---

## 4. Critical flow result (unchanged, as required)

Input: Home Loan · ₹35,00,000 · 20 years · ₹9,50,000 income · Salaried · 780 score

Top 3 recommendations, in order:

| # | Bank | Rate | Match |
|---|---|---|---|
| 1 | State Bank | 7.85% p.a. | 100% |
| 2 | HDFC Bank | 8.1% p.a. | 73% |
| 3 | Axis Bank | 8.4% p.a. | — |

Full comparison lists all 5 Home Loan offers: `7.85, 8.1, 8.35, 8.4, 8.45`.
SBI hero card renders `EST. EMI ₹28,950/mo`, fee 0.25%, 30 yr max, ₹1.5 Cr.
No matching code was modified.

---

## 5. Branch data and sources

33 records across 5 cities. Two clearly separated tiers:

### Verified tier — Hyderabad (7) and Pune (8)
All 15 records carry an **IFSC** and a **link to the official bank locator** that
was used, and the UI renders both. Source domains: `sbi.bank.in`,
`icici.bank.in`, `hdfc.bank.in`, `branch.axis.bank.in`, `kotak.bank.in`.
Example: SBI's Hyderabad circle branch list at
`https://sbi.bank.in/documents/17826/2704985/012020-Hyderabad+Circle+%26+branches.xls`

Coordinates: 26 of 33 records have coordinates; the remaining 7 have `null` and
are **not plotted**. Records marked `locality` are area-level (from
OpenStreetMap) rather than an exact branch pin, and the card says
"Approx. area". Records marked `branch` are an exact branch location.

### Sample tier — Mumbai (9), Delhi (7), Bengaluru (2)
These 18 are pre-existing placeholder records with `geoPrecision: 'demo'`. They
have no IFSC and no source. They are now badged **"Sample data · not verified"**
in the UI so they are not mistaken for confirmed branches.

Empty combinations are never fabricated: e.g. HDFC Bank in Bengaluru renders
"No HDFC Bank branches on record for Bengaluru yet" with zero map markers.

### Geolocation honesty — verified
- **Permission granted:** real coordinates are stored (`lat 17.385, lng 78.4867`)
  and the nearest covered city resolves correctly.
- **Permission denied:** no location is invented (`lat` stays `null`), the
  manually chosen city survives, and the toast says
  "Could not read your location (User denied Geolocation). Please pick your city manually."

---

## 6. Features that remain simulated or unverified

These are honest prototype simulations, labelled as such in the UI. None of them
should be described as a working integration.

| Feature | Actual state |
|---|---|
| **DigiLocker** | No DigiLocker connection. Any 6 digits are accepted; the UI says so. Aadhaar stays in the tab. The "Connect" flow, fetching animation, document selection, and import all work locally. |
| **OTP / login** | Client-side only. No server, no credential checking, no password reset. |
| **OTP auto-send** | Nothing is sent anywhere. |
| **P2P lending** | Local state only. Funding, portfolio, and chat work in-memory; nothing persists to a server. |
| **Branch map background** | **Requires internet.** Basemap tiles come from `openfreemap.org` (street) and Esri (satellite); without a connection the background is blank and an on-screen notice explains why. The branch list, IFSC codes and directions links still work offline. |
| **"Book Visit"** | Shows a toast only. No booking exists. |
| **Email / rate-drop alerts** | Preference toggles persist to `localStorage`; **no email is ever sent**. |
| **Password reset** | Explicitly blocked with a "needs a server" message. |
| **Rates** | Advertised starting rates from bank marketing, not quotes. Not re-fetched from any live source. |
| **Branch hours/phones** | Static seed data for verified records. Not a live feed. |
| **18 demo branch records** | Mumbai/Delhi/Bengaluru are placeholders, now badged as such. |

---

## 7. Remaining issues

1. **The 18 sample branch records still exist** (Mumbai/Delhi/Bengaluru). They are
   now honestly labelled, but they are still not real data. Verifying them against
   official locators, or removing them, is the natural Phase 2 task.
2. **7 verified branch records have no coordinates** and therefore never appear on
   the map. They are listed in the card rail, but the map cannot place them.
3. **No automated tests are committed to the project.** Everything lives in
   `%TEMP%\opencode\lftest` and will be lost. Wiring the suites into the repo
   needs a test runner, which the project deliberately does not have.
4. **`1try\LoanFinder_Complete_Project_Report.pdf` is stale** (dated before this
   work). No script in the project generates it, so it cannot be regenerated
   without knowing its source. I did not fabricate a replacement.
5. **The status report PDF is generated, not hand-written**, so it is only as
   current as `generate_report.js`. It was regenerated after the final code change.
6. **Lending amounts and P2P data reset on reload** — only preferences persist to
   `localStorage`. That is consistent with the no-backend constraint.
7. **Only the 4 modals and the support panel close on Escape.** A future modal
   added to `bindGlobalDismiss()`'s id list must be registered there or it will
   not be dismissible by keyboard.

---

## 8. Bank and offer counts (verified consistent)

The catalog holds **5 real banks** (State Bank, HDFC Bank, ICICI Bank, Axis Bank,
Kotak Mahindra) and **7 offers**, of which **5 are Home Loans** at a lowest
advertised rate of **7.85%**. The landing stats render `7.85% | 5 | 7 | 5`, which
matches the catalog exactly. The strings "25+" and "Bank-Grade" appear nowhere in
the UI; the security card honestly reads **"Your Data Stays Local"**.

---

## 9. How to run

Open `p1/index.html` directly in a browser. No build, no server, no install —
`pdf-lib`, Leaflet, and Lucide are all vendored locally.
