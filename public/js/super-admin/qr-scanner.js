/**
 * QR Code Scanner — Super Admin
 * Handles camera scanning, accession lookup, and borrow action dispatch.
 * Depends on: csrf-helper.js (fetchWithCsrf), Bootstrap Icons (bi-* classes)
 */
const qrScanner = (() => {
  'use strict';

  let scanner = null;
  let lastScannedCode = null;
  let cooldownActive = false;
  const recentScans = [];

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const el = (id) => document.getElementById(id);

  function setStatus(msg, type) {
    const s = el('qrStatusText');
    if (!s) return;
    s.textContent = msg;
    s.className = 'qr-status-text' + (type ? ' qr-status-' + type : '');
  }

  function formatDate(str) {
    if (!str) return '—';
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function capitalize(str) {
    if (!str) return '—';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function badgeForStatus(status) {
    const map = {
      available:   { label: 'Available',   cls: 'badge-success' },
      borrowed:    { label: 'Borrowed',     cls: 'badge-warning' },
      maintenance: { label: 'Maintenance',  cls: 'badge-secondary' },
      lost:        { label: 'Lost',         cls: 'badge-danger' },
      retired:     { label: 'Retired',      cls: 'badge-secondary' },
    };
    return map[status] || { label: capitalize(status), cls: 'badge-secondary' };
  }

  // ── Scanner control ─────────────────────────────────────────────────────────

  function start() {
    if (!window.Html5Qrcode) {
      setStatus('QR library not loaded — please refresh the page.', 'error');
      return;
    }
    lastScannedCode = null;
    cooldownActive = false;
    scanner = new Html5Qrcode('qr-reader');

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
      onScanSuccess,
      () => { /* silent: fires constantly when no QR is in frame */ }
    ).then(() => {
      el('startScanBtn').style.display = 'none';
      el('stopScanBtn').style.display  = 'inline-flex';
      setStatus('Scanner active — point camera at a QR code.', 'info');
    }).catch((err) => {
      const msg = String(err);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')) {
        setStatus('Camera permission denied. Please allow camera access and try again.', 'error');
      } else {
        setStatus('Camera error: ' + msg, 'error');
      }
    });
  }

  function stop() {
    if (scanner && scanner.isScanning) {
      scanner.stop().then(() => {
        scanner.clear();
        scanner = null;
        el('startScanBtn').style.display = 'inline-flex';
        el('stopScanBtn').style.display  = 'none';
        setStatus('Scanner stopped.', '');
      }).catch((err) => {
        console.warn('QR stop error:', err);
      });
    }
  }

  function onScanSuccess(decodedText) {
    if (cooldownActive) return;
    const code = decodedText.trim();
    if (!code || code === lastScannedCode) return;

    lastScannedCode  = code;
    cooldownActive   = true;
    // After 4 s allow re-scanning the same code (useful if action was dismissed)
    setTimeout(() => { cooldownActive = false; }, 4000);

    lookupAccession(code);
  }

  // ── API lookup ──────────────────────────────────────────────────────────────

  async function lookupAccession(accessionNumber) {
    // Validate input — accession numbers are alphanumeric with dashes/underscores
    if (!/^[A-Za-z0-9\-_]+$/.test(accessionNumber)) {
      setStatus('Invalid QR code value — expected an accession number.', 'error');
      return;
    }

    setStatus('Looking up: ' + accessionNumber + ' …', 'info');

    try {
      const res = await fetch(
        '/api/book-copies/accession/' + encodeURIComponent(accessionNumber),
        { credentials: 'same-origin', headers: { 'Accept': 'application/json' } }
      );
      const payload = await res.json();

      if (!res.ok || !payload.success) {
        const msg = (payload && payload.message) ? payload.message : 'Copy not found.';
        setStatus('Not found: ' + accessionNumber, 'error');
        showNotFoundModal(accessionNumber, msg);
        return;
      }

      const copy = payload.data;
      setStatus('Found: ' + copy.title, 'success');
      addRecentScan(copy.accession_number, copy.title, copy.status);
      showResultModal(copy);

    } catch (err) {
      setStatus('Network error — please check your connection.', 'error');
      console.error('QR lookup error:', err);
    }
  }

  // ── Recent scans log ────────────────────────────────────────────────────────

  function addRecentScan(accessionNumber, title, status) {
    recentScans.unshift({ accessionNumber, title, status, time: new Date() });
    if (recentScans.length > 5) recentScans.pop();
    renderRecentScans();
  }

  function renderRecentScans() {
    const panel = el('recentScansPanel');
    const list  = el('recentScansList');
    if (!panel || !list) return;
    panel.style.display = 'block';
    const badge = (s) => {
      const b = badgeForStatus(s);
      return `<span class="${b.cls}">${b.label}</span>`;
    };
    list.innerHTML = recentScans.map((s) =>
      `<div class="qr-recent-item">
        <span class="qr-recent-accession">${escapeHtml(s.accessionNumber)}</span>
        <span class="qr-recent-title">${escapeHtml(s.title)}</span>
        ${badge(s.status)}
        <span class="qr-recent-time">${s.time.toLocaleTimeString()}</span>
      </div>`
    ).join('');
  }

  // ── Result Modal ────────────────────────────────────────────────────────────

  function showResultModal(copy) {
    const modal  = el('qrResultModal');
    if (!modal) return;

    const status = copy.status || 'available';
    const badge  = badgeForStatus(status);

    el('qrmStatusBadge').textContent = badge.label;
    el('qrmStatusBadge').className   = badge.cls;

    el('qrmTitle').textContent     = copy.title    || '—';
    el('qrmAuthor').textContent    = copy.author   || '—';
    el('qrmCategory').textContent  = copy.category || '—';
    el('qrmAccession').textContent = copy.accession_number || '—';
    el('qrmCondition').textContent = capitalize(copy.condition_status || '');
    el('qrmCopyStatus').textContent= capitalize(status);
    el('qrmBorrower').textContent  = copy.borrowed_by || '—';
    el('qrmDueDate').textContent   = formatDate(copy.due_date);

    // Persist references for action handlers
    modal.dataset.borrowingId = copy.borrowing_id || '';
    modal.dataset.accession   = copy.accession_number || '';

    // Reset all action buttons and warnings
    const pickupBtn      = el('qrmPickupBtn');
    const returnBtn      = el('qrmReturnBtn');
    const detailsBtn     = el('qrmDetailsBtn');
    const blockedWarn    = el('qrmBlockedWarning');
    const returnCondWrap = el('qrmReturnConditionWrap');

    pickupBtn.style.display      = 'none';
    returnBtn.style.display      = 'none';
    detailsBtn.style.display     = 'none';
    blockedWarn.style.display    = 'none';
    returnCondWrap.style.display = 'none';

    if (status === 'borrowed' && copy.borrowing_id) {
      // Show both actions — backend validates the exact state (pending vs picked-up)
      pickupBtn.style.display      = 'inline-flex';
      returnBtn.style.display      = 'inline-flex';
      returnCondWrap.style.display = 'block';
      detailsBtn.style.display     = 'inline-flex';
    } else if (status === 'maintenance' || status === 'lost' || status === 'retired') {
      blockedWarn.style.display = 'block';
    }

    openModal();
  }

  function showNotFoundModal(accessionNumber, message) {
    // Surface the error in-page rather than opening an empty modal
    setStatus('Error: ' + message + ' (' + accessionNumber + ')', 'error');
  }

  function openModal() {
    const modal = el('qrResultModal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal = el('qrResultModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    // Allow the same accession to be re-scanned after the modal is closed
    lastScannedCode = null;
  }

  // ── Borrow actions ──────────────────────────────────────────────────────────

  async function confirmPickup() {
    const modal      = el('qrResultModal');
    const borrowingId = modal.dataset.borrowingId;
    if (!borrowingId) return;

    const btn = el('qrmPickupBtn');
    btn.disabled    = true;
    btn.textContent = 'Confirming…';

    try {
      const res  = await fetchWithCsrf(
        '/api/admin/borrowings/' + encodeURIComponent(borrowingId) + '/confirm-pickup',
        { method: 'POST', credentials: 'same-origin' }
      );
      const data = await res.json();

      if (res.ok && data.success) {
        closeModal();
        setStatus('Pickup confirmed for borrowing #' + borrowingId + '.', 'success');
      } else {
        alert((data && data.message) ? data.message : 'Failed to confirm pickup.');
      }
    } catch (err) {
      alert('Network error while confirming pickup.');
      console.error(err);
    } finally {
      btn.disabled   = false;
      btn.innerHTML  = '<i class="bi bi-check-circle"></i> Confirm Pickup';
    }
  }

  async function confirmReturn() {
    const modal       = el('qrResultModal');
    const borrowingId = modal.dataset.borrowingId;
    if (!borrowingId) return;

    const conditionEl = el('qrmReturnCondition');
    const condition   = conditionEl ? conditionEl.value : 'good';

    const btn = el('qrmReturnBtn');
    btn.disabled    = true;
    btn.textContent = 'Processing…';

    try {
      const res  = await fetchWithCsrf(
        '/api/book-borrowings/return/' + encodeURIComponent(borrowingId),
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ condition_at_return: condition }),
        }
      );
      const data = await res.json();

      if (res.ok && data.success) {
        closeModal();
        setStatus('Return confirmed for borrowing #' + borrowingId + '.', 'success');
      } else {
        alert((data && data.message) ? data.message : 'Failed to confirm return.');
      }
    } catch (err) {
      alert('Network error while confirming return.');
      console.error(err);
    } finally {
      btn.disabled  = false;
      btn.innerHTML = '<i class="bi bi-arrow-return-left"></i> Confirm Return';
    }
  }

  function viewDetails() {
    const modal       = el('qrResultModal');
    const borrowingId = modal.dataset.borrowingId;
    if (!borrowingId) return;
    window.location.href =
      '/super-admin-borrowed-books?highlight=' + encodeURIComponent(borrowingId);
  }

  // ── Keyboard accessibility ──────────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // ── Public API ──────────────────────────────────────────────────────────────

  return { start, stop, closeModal, confirmPickup, confirmReturn, viewDetails };
})();
