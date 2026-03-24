/**
 * QR Code Scanner — Super Admin
 * Handles camera scanning, accession lookup, and borrow action dispatch.
 * Depends on: csrf-helper.js (fetchWithCsrf), Bootstrap Icons (bi-* classes)
 */
window.qrScanner = (() => {
  'use strict';

  let scanner = null;
  let scannerMode = null;
  let nativeStream = null;
  let nativeVideo = null;
  let nativeAnimationId = null;
  let nativeDetector = null;
  let lastScannedCode = null;
  let cooldownActive = false;
  let startInProgress = false;
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
      available:      { label: 'Available',     cls: 'badge-success' },
      borrowed:       { label: 'Borrowed',       cls: 'badge-warning' },
      picked_up:      { label: 'Borrowed',       cls: 'badge-warning' },
      pending_pickup: { label: 'Pending Pickup', cls: 'badge-warning' },
      overdue:        { label: 'Overdue',        cls: 'badge-danger' },
      claim_expired:  { label: 'Claim Expired',  cls: 'badge-secondary' },
      returned:       { label: 'Returned',       cls: 'badge-secondary' },
      cancelled:      { label: 'Cancelled',      cls: 'badge-secondary' },
      maintenance:    { label: 'Maintenance',    cls: 'badge-secondary' },
      lost:           { label: 'Lost',           cls: 'badge-danger' },
      retired:        { label: 'Retired',        cls: 'badge-secondary' },
    };
    return map[status] || { label: capitalize(status || ''), cls: 'badge-secondary' };
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (window.Html5Qrcode) {
          resolve(true);
          return;
        }
        existing.addEventListener('load', () => resolve(true), { once: true });
        existing.addEventListener('error', () => reject(new Error('Failed to load script')), { once: true });
        return;
      }

      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => reject(new Error('Failed to load script'));
      document.head.appendChild(s);
    });
  }

  async function ensureHtml5QrLibrary() {
    if (window.Html5Qrcode) return true;

    const sources = [
      '/js/vendor/html5-qrcode.min.js',
      'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/minified/html5-qrcode.min.js',
      'https://cdn.jsdelivr.net/npm/html5-qrcode/minified/html5-qrcode.min.js'
    ];

    for (const src of sources) {
      try {
        await loadScript(src);
        if (window.Html5Qrcode) return true;
      } catch (err) {
        console.warn('QR library load failed from source:', src, err.message);
      }
    }

    return false;
  }

  function canUseNativeBarcodeDetector() {
    return typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isRetryableCameraStartError(errorText) {
    const msg = String(errorText || '').toLowerCase();
    return msg.includes('aborterror')
      || msg.includes('timeout starting video source')
      || msg.includes('notreadableerror')
      || msg.includes('trackstarterror')
      || msg.includes('overconstrained')
      || msg.includes('facingmode')
      || msg.includes('constraint');
  }

  async function cleanupHtml5Scanner() {
    if (!scanner) return;
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch (_) {
      // Ignore stop errors during cleanup.
    }
    try {
      scanner.clear();
    } catch (_) {
      // Ignore clear errors during cleanup.
    }
    scanner = null;
    scannerMode = null;
  }

  async function startHtml5ScannerWithRetry() {
    const scanConfig = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
    const attempts = [
      { label: 'rear camera (ideal)', cameraConfig: { facingMode: { ideal: 'environment' } } },
      { label: 'rear camera (exact)', cameraConfig: { facingMode: 'environment' } },
      { label: 'front camera', cameraConfig: { facingMode: 'user' } }
    ];

    if (window.Html5Qrcode && typeof window.Html5Qrcode.getCameras === 'function') {
      try {
        const cameras = await window.Html5Qrcode.getCameras();
        cameras.slice(0, 2).forEach((cam, idx) => {
          attempts.push({
            label: `camera id ${idx + 1}`,
            cameraConfig: { deviceId: { exact: cam.id } }
          });
        });
      } catch (err) {
        console.warn('Unable to enumerate cameras for retry:', err && err.message ? err.message : err);
      }
    }

    let lastError = null;

    for (let i = 0; i < attempts.length; i += 1) {
      const attempt = attempts[i];
      await cleanupHtml5Scanner();
      scanner = new Html5Qrcode('qr-reader');

      try {
        await scanner.start(
          attempt.cameraConfig,
          scanConfig,
          onScanSuccess,
          () => { /* silent: fires constantly when no QR is in frame */ }
        );
        scannerMode = 'html5';
        return;
      } catch (err) {
        lastError = err;
        const msg = String(err);
        console.warn(`html5-qrcode start attempt failed (${attempt.label}):`, msg);

        if (!isRetryableCameraStartError(msg)) {
          break;
        }

        await delay(220);
      }
    }

    await cleanupHtml5Scanner();
    throw lastError || new Error('Unable to initialize camera source.');
  }

  function cleanupNativeScanner() {
    if (nativeAnimationId) {
      cancelAnimationFrame(nativeAnimationId);
      nativeAnimationId = null;
    }

    if (nativeVideo) {
      nativeVideo.pause();
      nativeVideo.srcObject = null;
      nativeVideo.remove();
      nativeVideo = null;
    }

    if (nativeStream) {
      nativeStream.getTracks().forEach((t) => t.stop());
      nativeStream = null;
    }

    nativeDetector = null;
  }

  async function startNativeScanner() {
    const reader = el('qr-reader');
    if (!reader) {
      setStatus('Scanner container not found.', 'error');
      return;
    }

    cleanupNativeScanner();

    nativeDetector = new BarcodeDetector({ formats: ['qr_code'] });
    nativeStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' }
      },
      audio: false
    });

    nativeVideo = document.createElement('video');
    nativeVideo.setAttribute('playsinline', 'true');
    nativeVideo.muted = true;
    nativeVideo.autoplay = true;
    nativeVideo.style.width = '100%';
    nativeVideo.style.height = '100%';
    nativeVideo.style.objectFit = 'cover';

    reader.innerHTML = '';
    reader.appendChild(nativeVideo);
    nativeVideo.srcObject = nativeStream;
    await nativeVideo.play();

    const detectLoop = async () => {
      if (!nativeVideo || nativeVideo.readyState < 2 || !nativeDetector) {
        nativeAnimationId = requestAnimationFrame(detectLoop);
        return;
      }

      try {
        const codes = await nativeDetector.detect(nativeVideo);
        if (codes && codes.length > 0) {
          const raw = (codes[0].rawValue || '').trim();
          if (raw) {
            onScanSuccess(raw);
          }
        }
      } catch (err) {
        console.warn('Native QR detect error:', err.message);
      }

      nativeAnimationId = requestAnimationFrame(detectLoop);
    };

    nativeAnimationId = requestAnimationFrame(detectLoop);
  }

  // ── Scanner control ─────────────────────────────────────────────────────────

  async function start() {
    if (startInProgress) return;
    startInProgress = true;

    try {

    // Reset previous scanner session first and wait for camera release.
    await stop();

    lastScannedCode = null;
    cooldownActive = false;

    const ready = await ensureHtml5QrLibrary();
    if (ready && window.Html5Qrcode) {
      try {
        await startHtml5ScannerWithRetry();
        el('startScanBtn').style.display = 'none';
        el('stopScanBtn').style.display  = 'inline-flex';
        setStatus('Scanner active — point camera at a QR code.', 'info');
        return;
      } catch (err) {
        const msg = String(err);
        console.warn('html5-qrcode start failed, trying native fallback:', msg);

        // Clean up partially initialized scanner instance before fallback.
        await cleanupHtml5Scanner();

        // If html5 mode fails for any reason, try native mode before surfacing error.
        if (canUseNativeBarcodeDetector()) {
          try {
            scannerMode = 'native';
            await startNativeScanner();
            el('startScanBtn').style.display = 'none';
            el('stopScanBtn').style.display  = 'inline-flex';
            setStatus('Scanner active (native mode) — point camera at a QR code.', 'info');
            return;
          } catch (nativeErr) {
            const nativeMsg = String(nativeErr);
            if (nativeMsg.toLowerCase().includes('permission') || nativeMsg.toLowerCase().includes('notallowed')) {
              setStatus('Camera permission denied. Please allow camera access and try again.', 'error');
            } else {
              setStatus('Native scanner error: ' + nativeMsg, 'error');
            }
            cleanupNativeScanner();
            scannerMode = null;
            return;
          }
        }

        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')) {
          setStatus('Camera permission denied. Please allow camera access and try again.', 'error');
        } else {
          setStatus('Camera error: ' + msg, 'error');
        }
        return;
      }
    }

    if (canUseNativeBarcodeDetector()) {
      try {
        scannerMode = 'native';
        await startNativeScanner();
        el('startScanBtn').style.display = 'none';
        el('stopScanBtn').style.display  = 'inline-flex';
        setStatus('Scanner active (native mode) — point camera at a QR code.', 'info');
        return;
      } catch (err) {
        const msg = String(err);
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')) {
          setStatus('Camera permission denied. Please allow camera access and try again.', 'error');
        } else {
          setStatus('Native scanner error: ' + msg, 'error');
        }
        cleanupNativeScanner();
      }
    }

    scannerMode = null;
    setStatus('QR scanner is unavailable. Try Chrome/Edge and allow camera permission.', 'error');
    } finally {
      startInProgress = false;
    }
  }

  async function stop() {
    if (scanner) {
      try {
        await cleanupHtml5Scanner();
        el('startScanBtn').style.display = 'inline-flex';
        el('stopScanBtn').style.display  = 'none';
        setStatus('Scanner stopped.', '');
        return;
      } catch (err) {
        console.warn('QR stop error:', err);
      }
    }

    if (scannerMode === 'native') {
      cleanupNativeScanner();
      scannerMode = null;
      el('startScanBtn').style.display = 'inline-flex';
      el('stopScanBtn').style.display  = 'none';
      setStatus('Scanner stopped.', '');
      return;
    }

    // Ensure buttons are in idle state even when no scanner instance exists.
    el('startScanBtn').style.display = 'inline-flex';
    el('stopScanBtn').style.display  = 'none';
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

  // ── Borrowing lifecycle helpers ────────────────────────────────────────────

  /**
   * Fetches the precise borrowing display_status for an accession number by
   * querying the admin borrowings list endpoint. Returns one of:
   * pending_pickup | picked_up | overdue | claim_expired | returned | cancelled | null
   */
  async function resolveDisplayStatus(accessionNumber, borrowingId) {
    try {
      const res = await fetch(
        '/api/admin/borrowings?search=' + encodeURIComponent(accessionNumber),
        { credentials: 'same-origin', headers: { 'Accept': 'application/json' } }
      );
      if (!res.ok) return null;
      const payload = await res.json();
      const records = Array.isArray(payload.data) ? payload.data
        : Array.isArray(payload) ? payload
        : null;
      if (!records || records.length === 0) return null;

      // Prefer exact borrowing ID match when known
      if (borrowingId) {
        const byId = records.find(r => String(r.id) === String(borrowingId));
        if (byId) return byId.display_status || null;
      }

      // Fallback: find the latest active record for this accession
      const active = records.find(r =>
        r.accession_number === accessionNumber &&
        !r.return_date &&
        r.status !== 'returned' &&
        r.status !== 'cancelled'
      );
      return active ? (active.display_status || null) : null;
    } catch (_) {
      return null;
    }
  }

  /** Lazily inject a styled info-message element above the blocked-warning div. */
  function ensureInfoMessageEl() {
    let msgEl = document.getElementById('qrmInfoMessage');
    if (!msgEl) {
      const ref = document.getElementById('qrmBlockedWarning');
      if (!ref || !ref.parentNode) return null;
      msgEl = document.createElement('div');
      msgEl.id = 'qrmInfoMessage';
      msgEl.style.display = 'none';
      ref.parentNode.insertBefore(msgEl, ref);
    }
    return msgEl;
  }

  function showInfoMessage(msgEl, text, type) {
    if (!msgEl) return;
    const themes = {
      info:    { bg: 'rgba(37,99,235,.08)',   border: 'rgba(37,99,235,.25)',   color: '#1d4ed8' },
      success: { bg: 'rgba(22,163,74,.08)',   border: 'rgba(22,163,74,.25)',   color: '#15803d' },
      neutral: { bg: 'rgba(107,114,128,.08)', border: 'rgba(107,114,128,.25)', color: '#4b5563' },
    };
    const t = themes[type] || themes.neutral;
    msgEl.textContent        = text;
    msgEl.style.display      = 'block';
    msgEl.style.background   = t.bg;
    msgEl.style.border       = '1px solid ' + t.border;
    msgEl.style.color        = t.color;
    msgEl.style.borderRadius = '8px';
    msgEl.style.padding      = '10px 14px';
    msgEl.style.fontSize     = '13px';
    msgEl.style.fontWeight   = '500';
    msgEl.style.marginBottom = '12px';
  }

  /** Update the most-recent scan entry's status and re-render the panel. */
  function refreshRecentScanStatus(accessionNumber, newStatus) {
    const entry = recentScans.find(r => r.accessionNumber === accessionNumber);
    if (entry) entry.status = newStatus;
    renderRecentScans();
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

      // Resolve precise lifecycle status (pending_pickup / picked_up / overdue / returned)
      // via the admin borrowings endpoint when a borrowing record may exist.
      if (copy.borrowing_id || copy.status === 'borrowed') {
        copy.displayStatus = await resolveDisplayStatus(accessionNumber, copy.borrowing_id);
      }

      setStatus('Found: ' + copy.title, 'success');
      addRecentScan(copy.accession_number, copy.title, copy.displayStatus || copy.status);
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
    const modal = el('qrResultModal');
    if (!modal) return;

    const copyStatus    = copy.status || 'available';
    const displayStatus = copy.displayStatus || null;

    // Use the most descriptive lifecycle status for the badge and status field
    const effectiveStatus = displayStatus || copyStatus;
    const badge = badgeForStatus(effectiveStatus);

    el('qrmStatusBadge').textContent = badge.label;
    el('qrmStatusBadge').className   = badge.cls;

    el('qrmTitle').textContent      = copy.title    || '—';
    el('qrmAuthor').textContent     = copy.author   || '—';
    el('qrmCategory').textContent   = copy.category || '—';
    el('qrmAccession').textContent  = copy.accession_number || '—';
    el('qrmCondition').textContent  = capitalize(copy.condition_status || '');
    el('qrmCopyStatus').textContent = capitalize(effectiveStatus.replace(/_/g, ' '));
    el('qrmBorrower').textContent   = copy.borrowed_by || '—';
    el('qrmDueDate').textContent    = formatDate(copy.due_date);

    // Persist references for action handlers
    modal.dataset.borrowingId = copy.borrowing_id || '';
    modal.dataset.accession   = copy.accession_number || '';

    // Reset all dynamic elements
    const pickupBtn      = el('qrmPickupBtn');
    const returnBtn      = el('qrmReturnBtn');
    const detailsBtn     = el('qrmDetailsBtn');
    const blockedWarn    = el('qrmBlockedWarning');
    const returnCondWrap = el('qrmReturnConditionWrap');
    const infoMsg        = ensureInfoMessageEl();

    pickupBtn.style.display      = 'none';
    returnBtn.style.display      = 'none';
    detailsBtn.style.display     = 'none';
    blockedWarn.style.display    = 'none';
    blockedWarn.textContent      = 'This copy is currently unavailable for borrowing (maintenance or lost status).';
    returnCondWrap.style.display = 'none';
    if (infoMsg) { infoMsg.style.display = 'none'; infoMsg.textContent = ''; }

    // ── Determine correct action based on borrowing lifecycle ────────────────

    if (displayStatus === 'pending_pickup' && copy.borrowing_id) {
      // Borrowing approved — admin physically hands the book to the student
      pickupBtn.style.display  = 'inline-flex';
      detailsBtn.style.display = 'inline-flex';

    } else if (copy.borrowing_id && (
      displayStatus === 'picked_up' ||
      displayStatus === 'overdue'   ||
      displayStatus === 'borrowed'  ||
      (!displayStatus && copyStatus === 'borrowed')
    )) {
      // Book is out with student — admin accepts return
      returnBtn.style.display      = 'inline-flex';
      returnCondWrap.style.display = 'block';
      detailsBtn.style.display     = 'inline-flex';

    } else if (displayStatus === 'returned') {
      showInfoMessage(infoMsg, 'This copy has already been returned.', 'neutral');

    } else if (displayStatus === 'claim_expired') {
      blockedWarn.textContent   = 'The pickup window for this borrowing has expired.';
      blockedWarn.style.display = 'block';

    } else if (!copy.borrowing_id && copyStatus === 'available') {
      showInfoMessage(infoMsg, 'No active borrowing on this copy.', 'info');

    } else if (copyStatus === 'maintenance') {
      blockedWarn.textContent   = 'This copy is currently under maintenance.';
      blockedWarn.style.display = 'block';

    } else if (copyStatus === 'lost' || copyStatus === 'retired') {
      blockedWarn.style.display = 'block';

    } else if (copy.borrowing_id) {
      // Fallback: status unknown but a borrowing record exists — show both and let backend validate
      pickupBtn.style.display      = 'inline-flex';
      returnBtn.style.display      = 'inline-flex';
      returnCondWrap.style.display = 'block';
      detailsBtn.style.display     = 'inline-flex';
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
    const pickupAccession = modal.dataset.accession;

    try {
      const res  = await fetchWithCsrf(
        '/api/admin/borrowings/' + encodeURIComponent(borrowingId) + '/confirm-pickup',
        { method: 'POST', credentials: 'same-origin' }
      );
      const data = await res.json();

      if (res.ok && data.success) {
        refreshRecentScanStatus(pickupAccession, 'picked_up');
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
    const returnAccession = modal.dataset.accession;

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
        refreshRecentScanStatus(returnAccession, 'returned');
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
    const isSystemAdminPage = window.location.pathname.startsWith('/admin-');
    const targetPath = isSystemAdminPage ? '/admin-borrowed-books' : '/super-admin-borrowed-books';
    window.location.href =
      `${targetPath}?highlight=${encodeURIComponent(borrowingId)}`;
  }

  // ── Keyboard accessibility and control binding ─────────────────────────────

  function bindControlButtons() {
    const startBtn = el('startScanBtn');
    const stopBtn = el('stopScanBtn');

    if (startBtn && startBtn.dataset.qrBound !== '1') {
      startBtn.dataset.qrBound = '1';
      startBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        start();
      });
    }

    if (stopBtn && stopBtn.dataset.qrBound !== '1') {
      stopBtn.dataset.qrBound = '1';
      stopBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        stop();
      });
    }
  }

  // Bind when script executes and after DOM is ready.
  bindControlButtons();
  document.addEventListener('DOMContentLoaded', () => {
    bindControlButtons();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  window.addEventListener('beforeunload', () => {
    // Fire-and-forget cleanup on navigation.
    stop();
  });

  // ── Public API ──────────────────────────────────────────────────────────────

  return { start, stop, closeModal, confirmPickup, confirmReturn, viewDetails };
})();
