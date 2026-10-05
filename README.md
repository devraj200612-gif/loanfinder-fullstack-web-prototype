# LoanFinder — Modern Loan Comparison & Bank Discovery Platform

A responsive fintech demo for multi-category loan comparison, advertised-rate discovery, document readiness tracking, and city bank branch location.

> **Scope note:** this is a self-contained frontend demo. Rates are advertised starting rates from a small built-in catalogue (5 banks, 7 offers), not live feeds. Branch data is partly sample data. There is no backend, no real authentication, and no live DigiLocker or P2P integration.

---

## Quick Start (Run Locally)

You can run this frontend immediately in any modern browser without any build steps or npm installations:

1. **Direct Browser Execution**:
   - Simply double-click `index.html` in your file explorer, or right-click and choose **Open with Chrome / Edge**.
   
2. **Local Development Server (Recommended)**:
   ```bash
   # Using Python
   python -m http.server 3000

   # Or using Node.js / npx
   npx serve .
   ```
   Open `http://localhost:3000` in your web browser.

---

## Implemented Architecture & UI Modules

| # | Screen / Module | Status | Features Included |
|---|----------------|:------:|-------------------|
| 1 | **Welcome / Landing Page** | Built | Hero value prop, stats counter, trust badges, quick search widget |
| 2 | **Login / Sign Up** | Demo only | Modal-based auth with remember me. No real authentication — no server, no password storage, no Aadhaar/OTP verification |
| 3 | **Sidebar & Navigation** | Built | Dark navy sidebar (`#0F172A`), active indicator pill, notification badge |
| 4 | **Multi-Loan Type Selection** | Built | Multi-select checkable cards for Home, Personal, Car, Education, Business, Gold Loans |
| 5 | **Loan Requirements Panel** | Built | Real-time amount range slider, tenure selector, income, employment type, credit score |
| 6 | **Lowest Rate Comparison Engine** | Built | Automatic sorting by lowest advertised starting rate, EMI calculation formula |
| 7 | **Best Offer Pinned Highlight** | Built | Emerald green border & badge (`#10B981`) showcasing the #1 ranked lowest rate |
| 8 | **Bank Details View** | Built | Comprehensive tabbed view: Overview, Documents, Eligibility, Branches |
| 9 | **Required Documents Checklist** | Demo only | Categorized checklist (ID, Address, Income, Tax, Property) with status badges & printable PDF. DigiLocker import uses sample documents, not the real DigiLocker API |
| 10 | **Bank Branch Locator & Map** | Built | Google-Maps-style map (MapLibre GL) with smooth zoom, drag-rotate, 3D pitch, a Map/Satellite switcher and a "fit all branches" control. Distances are calculated from your real location only when you grant geolocation permission — nothing is hardcoded, and no live open/closed status is shown. **Needs internet:** basemap tiles come from openfreemap.org (street) and Esri (satellite), so the background is blank without a connection; the branch list, IFSC codes and directions links still work |
| 11 | **Saved Offers** | Built | Bookmark loan offers to compare side-by-side or review later |
| 12 | **User Profile** | Built | Pre-filled applicant profile with personal & employment information |

---

## Backend Integration Guide

The frontend logic in [`app.js`](app.js) is decoupled and ready to connect to your backend API:

### 1. Fetching Bank Rates & Offers
Replace `BANK_OFFERS` in `app.js` with your backend endpoint:
```javascript
async function fetchBankOffers(loanTypes, loanAmount, tenureYears) {
  const query = new URLSearchParams({
    types: loanTypes.join(','),
    amount: loanAmount,
    tenure: tenureYears
  });
  const res = await fetch(`/api/loans/compare?${query}`);
  return await res.json();
}
```

### 2. Fetching Bank Branches by City
Replace `BRANCH_DATA` with your geo-query backend endpoint:
```javascript
async function fetchNearbyBranches(bankName, city, lat, lng) {
  const res = await fetch(`/api/branches?bank=${encodeURIComponent(bankName)}&city=${encodeURIComponent(city)}`);
  return await res.json();
}
```

### 3. Document Upload Endpoint
Handle file uploads in `app.js`:
```javascript
async function uploadDocument(docType, file) {
  const formData = new FormData();
  formData.append('type', docType);
  formData.append('document', file);
  return await fetch('/api/documents/upload', { method: 'POST', body: formData });
}
```
