/*
  FILE: admin/pickup-terminal.js
  
  PURPOSE:
  Admin pickup terminal for processing student book pickups via QR code scanning.
  - Scans QR codes containing pickup tokens
  - Validates tokens and displays book/student details
  - Submits pickup confirmation to backend
  - Tracks recent activity
*/

(function () {
  'use strict';

  let html5QrcodeScanner = null;
  let isScanning = false;
  let recentPickups = [];

  // Initialize
  function init() {
    setupEventListeners();
    loadRecentPickups();
  }

  function setupEventListeners() {
    const startBtn = document.getElementById('pt-start-btn');
    const stopBtn = document.getElementById('pt-stop-btn');
    const manualBtn = document.getElementById('pt-manual-btn');
    const newScanBtn = document.getElementById('pt-new-scan-btn');
    const closeResultBtn = document.getElementById('pt-close-result-btn');

    if (startBtn) startBtn.addEventListener('click', startScanner);
    if (stopBtn) stopBtn.addEventListener('click', stopScanner);
    if (manualBtn) manualBtn.addEventListener('click', openManualModal);
    if (newScanBtn) newScanBtn.addEventListener('click', resetSession);
    if (closeResultBtn) closeResultBtn.addEventListener('click', closeResult);
  }

  function startScanner() {
    if (isScanning) return;

    try {
      html5QrcodeScanner = new Html5Qrcode('pt-reader');
      
      html5QrcodeScanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onQrcodeSuccess,
        onQrcodeError
      );

      isScanning = true;
      updateUI();
      setStatus('Scanning... point camera at QR code', 'info');
    } catch (err) {
      console.error('[PickupTerminal] Scanner init error:', err);
      setStatus('Failed to start camera: ' + err.message, 'error');
    }
  }

  function stopScanner() {
    if (!html5QrcodeScanner) return;

    html5QrcodeScanner.stop()
      .then(() => {
        isScanning = false;
        html5QrcodeScanner = null;
        updateUI();
        setStatus('Scanner stopped', 'info');
      })
      .catch((err) => {
        console.error('[PickupTerminal] Stop error:', err);
      });
  }

  function onQrcodeSuccess(decodedText) {
    if (!isScanning) return;

    // Stop scanning briefly to prevent duplicate processing
    stopScanner();
    setStatus('Processing token...', 'info');

    // decodedText could be the full token or just be extracted from URL
    processToken(decodedText);
  }

  function onQrcodeError(error) {
    // Silently ignore scanning errors
    // console.debug('QR scan attempt (expected):', error);
  }

  async function processToken(tokenOrUrl) {
    try {
      let token = tokenOrUrl;

      // Extract token from URL if it's in format /pickup?token=...
      if (tokenOrUrl.includes('/pickup?token=')) {
        const url = new URL(tokenOrUrl, window.location.origin);
        token = url.searchParams.get('token');
      }

      if (!token || token.length < 10) {
        setStatus('Invalid QR code data', 'error');
        return;
      }

      const doFetch = typeof fetchWithCsrf === 'function' ? fetchWithCsrf : fetch;
      const response = await doFetch('/api/pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token })
      });

      const result = await response.json();

      if (!response.ok) {
        showPickupResult({
          success: false,
          message: result.message || 'Pickup failed',
          error: result.error
        });
        return;
      }

      // Success
      const borrowing = result.data.borrowing;
      const book = result.data.book;

      addRecentPickup({
        success: true,
        borrowingId: borrowing.id,
        bookTitle: book.title,
        studentName: borrowing.student_name || 'Student',
        timestamp: new Date()
      });

      showPickupResult({
        success: true,
        borrowing: borrowing,
        book: book,
        message: 'Book pickup confirmed successfully!'
      });

      setStatus('✓ Pickup completed', 'success');
    } catch (err) {
      console.error('[PickupTerminal] processToken:', err);
      setStatus('Error: ' + err.message, 'error');
      showPickupResult({
        success: false,
        message: 'Failed to process token: ' + err.message
      });
    }
  }

  function showPickupResult(result) {
    const resultSection = document.getElementById('pt-result-section');
    const resultContent = document.getElementById('pt-result-content');

    if (!resultSection || !resultContent) return;

    if (result.success) {
      const borrowing = result.borrowing;
      const book = result.book;
      const pickedUpAt = new Date(borrowing.picked_up_at);

      resultContent.innerHTML = `
        <div class="pt-result-badge success">
          <i class="bi bi-check-circle"></i> Success
        </div>
        <div class="pt-result-message success">
          ${result.message}
        </div>
        <div class="pt-result-info">
          <div class="pt-result-item title">
            <span class="pt-result-value title">${book.title}</span>
          </div>
          <div class="pt-result-item">
            <span class="pt-result-label">Author</span>
            <span class="pt-result-value">${book.author || 'N/A'}</span>
          </div>
          <div class="pt-result-item">
            <span class="pt-result-label">Student</span>
            <span class="pt-result-value">${borrowing.student_name || 'N/A'}</span>
          </div>
          <div class="pt-result-item">
            <span class="pt-result-label">Picked Up At</span>
            <span class="pt-result-value">${pickedUpAt.toLocaleString()}</span>
          </div>
          <div class="pt-result-item">
            <span class="pt-result-label">Accession No.</span>
            <span class="pt-result-value" style="font-family: monospace; font-weight: 600;">${book.accession_number || 'N/A'}</span>
          </div>
          <div class="pt-result-item">
            <span class="pt-result-label">Category</span>
            <span class="pt-result-value">${book.category || 'N/A'}</span>
          </div>
        </div>
      `;
    } else {
      resultContent.innerHTML = `
        <div class="pt-result-badge error">
          <i class="bi bi-x-circle"></i> Failed
        </div>
        <div class="pt-result-message error">
          ${result.message}
        </div>
        ${result.error ? `
          <div style="margin-top: 12px; padding: 10px; background: #f3f4f6; border-radius: 6px; font-size: 12px; color: #6b7280;">
            <strong>Error:</strong> ${result.error}
          </div>
        ` : ''}
      `;
    }

    resultSection.style.display = 'block';
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeResult() {
    const resultSection = document.getElementById('pt-result-section');
    if (resultSection) {
      resultSection.style.display = 'none';
    }
  }

  function resetSession() {
    closeResult();
    setStatus('Ready to scan. Click "Start Scanner" to begin.', 'info');
    if (!isScanning) {
      startScanner();
    }
  }

  function setStatus(message, type = 'info') {
    const statusEl = document.getElementById('pt-status');
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.className = 'pt-status-text ' + type;
  }

  function updateUI() {
    const startBtn = document.getElementById('pt-start-btn');
    const stopBtn = document.getElementById('pt-stop-btn');
    const manualBtn = document.getElementById('pt-manual-btn');

    if (isScanning) {
      if (startBtn) startBtn.style.display = 'none';
      if (stopBtn) stopBtn.style.display = 'inline-flex';
      if (manualBtn) manualBtn.disabled = true;
    } else {
      if (startBtn) startBtn.style.display = 'inline-flex';
      if (stopBtn) stopBtn.style.display = 'none';
      if (manualBtn) manualBtn.disabled = false;
    }
  }

  function openManualModal() {
    const modal = document.getElementById('pt-manual-modal');
    if (modal) {
      modal.style.display = 'flex';
      const textarea = document.getElementById('pt-manual-token');
      if (textarea) textarea.focus();
    }
  }

  function closeManualModal() {
    const modal = document.getElementById('pt-manual-modal');
    if (modal) {
      modal.style.display = 'none';
      const textarea = document.getElementById('pt-manual-token');
      if (textarea) textarea.value = '';
    }
  }

  function submitManualToken() {
    const textarea = document.getElementById('pt-manual-token');
    if (!textarea) return;

    const token = textarea.value.trim();
    if (!token) {
      alert('Please paste a token');
      return;
    }

    closeManualModal();
    setStatus('Processing token...', 'info');
    processToken(token);
  }

  function addRecentPickup(data) {
    recentPickups.unshift(data);
    if (recentPickups.length > 20) {
      recentPickups = recentPickups.slice(0, 20);
    }
    renderRecentPickups();
  }

  function renderRecentPickups() {
    const list = document.getElementById('pt-recent-list');
    if (!list) return;

    if (recentPickups.length === 0) {
      list.innerHTML = '<p class="pt-empty-state">No pickups yet</p>';
      return;
    }

    list.innerHTML = recentPickups.map(function (pickup) {
      const timeStr = pickup.timestamp ? new Date(pickup.timestamp).toLocaleTimeString() : 'Just now';
      const statusClass = pickup.success ? 'success' : 'error';

      return `
        <div class="pt-recent-item ${statusClass}">
          <div class="pt-recent-info">
            <div class="pt-recent-book">${pickup.bookTitle}</div>
            <div class="pt-recent-student">${pickup.studentName}</div>
          </div>
          <div class="pt-recent-time">${timeStr}</div>
        </div>
      `;
    }).join('');
  }

  function loadRecentPickups() {
    // Load from sessionStorage if available
    try {
      const stored = sessionStorage.getItem('pt-recent-pickups');
      if (stored) {
        recentPickups = JSON.parse(stored);
        renderRecentPickups();
      }
    } catch (err) {
      console.error('[PickupTerminal] Load recent error:', err);
    }
  }

  // Hook to manually trigger token submission (for testing)
  window.PickupTerminal = window.PickupTerminal || {};
  window.PickupTerminal.closeManualModal = closeManualModal;
  window.PickupTerminal.submitManualToken = submitManualToken;
  window.PickupTerminal.processToken = processToken;

  // Cleanup on page unload
  window.addEventListener('beforeunload', function () {
    if (isScanning && html5QrcodeScanner) {
      stopScanner();
    }
  });

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
