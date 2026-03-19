/**
 * Session Timeout Manager
 * Cross-tab safe idle tracking with keepalive and duplicate-init protection.
 */

(function sessionTimeoutBootstrap() {
  if (window.__spistSessionTimeoutManager) {
    return;
  }

  const CONFIG = {
    idleTimeoutMs: 30 * 60 * 1000, // 30 minutes
    warningBeforeMs: 5 * 60 * 1000, // 5 minutes
    checkEveryMs: 15 * 1000, // 15 seconds
    keepAliveEveryMs: 5 * 60 * 1000, // 5 minutes
    activityWriteThrottleMs: 15 * 1000 // throttle writes
  };

  const DEBUG_COUNTDOWN_LOG = true;

  const STORAGE_KEY_LAST_ACTIVITY = 'spist:last-activity';
  const STORAGE_KEY_TIMEOUT_MARKER = 'timeout-logout';
  const MODAL_ID = 'session-timeout-modal';
  const ACTIVITY_EVENTS = [
    'mousedown',
    'mousemove',
    'keydown',
    'scroll',
    'touchstart',
    'click',
    'input',
    'focus'
  ];

  const state = {
    lastActivity: Date.now(),
    warningShown: false,
    isLoggingOut: false,
    checkTimer: null,
    keepAliveTimer: null,
    countdownTimer: null,
    lastWriteAt: 0
  };

  function nowMs() {
    return Date.now();
  }

  function isLoginPage() {
    return /^\/login(?:\/)?$/i.test(window.location.pathname);
  }

  function readStoredActivity() {
    const raw = localStorage.getItem(STORAGE_KEY_LAST_ACTIVITY);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function writeStoredActivity(ts) {
    localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(ts));
  }

  function setActivity(forceWrite) {
    const ts = nowMs();
    state.lastActivity = ts;

    if (state.warningShown) {
      state.warningShown = false;
      hideWarning();
    }

    const shouldWrite = forceWrite || (ts - state.lastWriteAt >= CONFIG.activityWriteThrottleMs);
    if (shouldWrite) {
      state.lastWriteAt = ts;
      writeStoredActivity(ts);
    }
  }

  function syncActivityFromStorage() {
    const stored = readStoredActivity();
    if (stored && stored > state.lastActivity) {
      state.lastActivity = stored;
      if (state.warningShown) {
        state.warningShown = false;
        hideWarning();
      }
    }
  }

  function getIdleMs() {
    return nowMs() - state.lastActivity;
  }

  function getWarningWindowMs() {
    return Math.max(0, CONFIG.idleTimeoutMs - CONFIG.warningBeforeMs);
  }

  function hideWarning() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) {
      modal.remove();
    }
    if (state.countdownTimer) {
      clearInterval(state.countdownTimer);
      state.countdownTimer = null;
    }
  }

  function getCountdownSeconds() {
    const remainingMs = CONFIG.idleTimeoutMs - getIdleMs();
    return Math.max(0, Math.ceil(remainingMs / 1000));
  }

  function showWarning() {
    if (document.getElementById(MODAL_ID)) {
      return;
    }

    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'width: 100%',
      'height: 100%',
      'background: rgba(0, 0, 0, 0.6)',
      'display: flex',
      'justify-content: center',
      'align-items: center',
      'z-index: 10000'
    ].join(';');

    const seconds = getCountdownSeconds();

    if (DEBUG_COUNTDOWN_LOG) {
      console.log('[SessionTimeout] Warning shown. Countdown starts at', seconds, 'seconds');
    }

    modal.innerHTML = `
      <div style="background:#fff;padding:28px;border-radius:10px;max-width:460px;width:90%;box-shadow:0 8px 24px rgba(0,0,0,.2)">
        <h3 style="margin:0 0 10px 0;color:#2d5c3f">Session Expiring Soon</h3>
        <p style="margin:0 0 14px 0;color:#555;line-height:1.5">
          You will be logged out due to inactivity in
          <strong id="session-timeout-countdown" style="color:#c62828">${seconds}</strong>
          seconds.
        </p>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button id="session-stay-logged-in" type="button" style="border:0;background:#2d7a3e;color:#fff;padding:10px 16px;border-radius:7px;cursor:pointer">Stay Logged In</button>
          <button id="session-logout-now" type="button" style="border:1px solid #ccc;background:#fff;color:#444;padding:10px 16px;border-radius:7px;cursor:pointer">Logout Now</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const stayBtn = document.getElementById('session-stay-logged-in');
    const logoutBtn = document.getElementById('session-logout-now');
    const countdownEl = document.getElementById('session-timeout-countdown');

    if (stayBtn) {
      stayBtn.addEventListener('click', () => {
        setActivity(true);
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        doLogout('manual');
      });
    }

    state.countdownTimer = setInterval(() => {
      const remaining = getCountdownSeconds();
      if (countdownEl) {
        countdownEl.textContent = String(remaining);
      }
      if (DEBUG_COUNTDOWN_LOG) {
        console.log('[SessionTimeout] Seconds remaining:', remaining);
      }
      if (remaining <= 0) {
        doLogout('timeout');
      }
    }, 1000);
  }

  function shouldSendKeepAlive() {
    if (document.hidden) {
      return false;
    }
    return getIdleMs() < CONFIG.idleTimeoutMs;
  }

  function sendKeepAlive() {
    if (!shouldSendKeepAlive()) {
      return;
    }

    fetch('/auth/csrf-token', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      keepalive: true
    }).catch(() => {
      // Keepalive is best-effort.
    });
  }

  function stopTimers() {
    if (state.checkTimer) {
      clearInterval(state.checkTimer);
      state.checkTimer = null;
    }
    if (state.keepAliveTimer) {
      clearInterval(state.keepAliveTimer);
      state.keepAliveTimer = null;
    }
    hideWarning();
  }

  function doLogout(reason) {
    if (state.isLoggingOut) {
      return;
    }

    state.isLoggingOut = true;
    stopTimers();
    sessionStorage.setItem(STORAGE_KEY_TIMEOUT_MARKER, reason === 'timeout' ? 'true' : 'manual');

    fetch('/auth/logout', {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' }
    }).catch(() => {
      // Ignore network errors; always redirect.
    }).finally(() => {
      window.location.href = '/login';
    });
  }

  function runTimeoutCheck() {
    syncActivityFromStorage();
    const idleMs = getIdleMs();
    const warningAt = getWarningWindowMs();
    const remainingMs = Math.max(0, CONFIG.idleTimeoutMs - idleMs);

    if (DEBUG_COUNTDOWN_LOG) {
      console.log('[SessionTimeout] check', {
        idleSeconds: Math.floor(idleMs / 1000),
        remainingSeconds: Math.ceil(remainingMs / 1000),
        warningStartsInSeconds: Math.max(0, Math.ceil((warningAt - idleMs) / 1000)),
        warningShown: state.warningShown,
        hidden: document.hidden
      });
    }

    if (idleMs >= CONFIG.idleTimeoutMs) {
      doLogout('timeout');
      return;
    }

    if (idleMs >= warningAt) {
      if (!state.warningShown) {
        state.warningShown = true;
        showWarning();
      }
      return;
    }

    if (state.warningShown) {
      state.warningShown = false;
      hideWarning();
    }
  }

  function onStorageChange(event) {
    if (event.key !== STORAGE_KEY_LAST_ACTIVITY) {
      return;
    }
    syncActivityFromStorage();
  }

  function onVisibilityChange() {
    if (!document.hidden) {
      setActivity(true);
      sendKeepAlive();
    }
  }

  function bindActivityEvents() {
    ACTIVITY_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, () => {
        setActivity(false);
      }, true);
    });
  }

  function startTimers() {
    state.checkTimer = setInterval(runTimeoutCheck, CONFIG.checkEveryMs);
    state.keepAliveTimer = setInterval(sendKeepAlive, CONFIG.keepAliveEveryMs);
  }

  function init() {
    if (isLoginPage()) {
      return;
    }

    if (DEBUG_COUNTDOWN_LOG) {
      console.log('[SessionTimeout] init', {
        idleTimeoutMs: CONFIG.idleTimeoutMs,
        warningBeforeMs: CONFIG.warningBeforeMs,
        checkEveryMs: CONFIG.checkEveryMs,
        keepAliveEveryMs: CONFIG.keepAliveEveryMs,
        path: window.location.pathname
      });
    }

    // Start a fresh idle window on page bootstrap so stale timestamps
    // from older sessions do not trigger immediate timeout redirects.
    state.lastActivity = nowMs();
    writeStoredActivity(state.lastActivity);

    bindActivityEvents();
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('storage', onStorageChange);

    startTimers();
    runTimeoutCheck();
  }

  window.__spistSessionTimeoutManager = {
    init,
    touch: () => setActivity(true),
    getLastActivity: () => state.lastActivity
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
