/**
 * Session Timeout Handler
 * Tracks user activity and shows warning before automatic logout
 */

(function() {
  const TIMEOUT_DURATION = 30 * 60 * 1000; // 30 minutes
  const WARNING_TIME = 25 * 60 * 1000; // Show warning at 25 minutes
  const CHECK_INTERVAL = 60 * 1000; // Check every 60 seconds

  console.log('[Session Timeout] Initializing with settings:', {
    timeout: TIMEOUT_DURATION / 1000 + 's',
    warning: WARNING_TIME / 1000 + 's',
    checkInterval: CHECK_INTERVAL / 1000 + 's'
  });

  let lastActivity = Date.now();
  let warningShown = false;
  let checkInterval;

  // Activity events to track
  const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

  // Update last activity timestamp
  function updateActivity() {
    lastActivity = Date.now();
    warningShown = false;
    hideWarning();
  }

  // Check if session has expired
  function checkTimeout() {
    const now = Date.now();
    const timeSinceActivity = now - lastActivity;

    console.log('[Session Timeout] Check:', {
      timeSinceActivity: Math.floor(timeSinceActivity / 1000) + 's',
      warningTime: Math.floor(WARNING_TIME / 1000) + 's',
      timeoutTime: Math.floor(TIMEOUT_DURATION / 1000) + 's'
    });

    // Show warning if approaching timeout
    if (timeSinceActivity >= WARNING_TIME && !warningShown) {
      console.log('[Session Timeout] Showing warning modal');
      showWarning();
      warningShown = true;
    }

    // Logout if timeout exceeded
    if (timeSinceActivity >= TIMEOUT_DURATION) {
      console.log('[Session Timeout] Timeout reached, logging out');
      logout();
    }
  }

  // Show timeout warning modal
  function showWarning() {
    const existingModal = document.getElementById('session-timeout-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'session-timeout-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      backdrop-filter: blur(2px);
    `;

    const timeRemaining = Math.ceil((TIMEOUT_DURATION - WARNING_TIME) / 1000);

    modal.innerHTML = `
      <div style="
        background: white;
        padding: 40px;
        border-radius: 12px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        animation: slideDown 0.3s ease-out;
      ">
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 24px;
        ">
          <div style="
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 20px;
            box-shadow: 0 4px 12px rgba(253, 160, 133, 0.4);
          ">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <h2 style="
            margin: 0;
            color: #2d5c3f;
            font-size: 26px;
            font-weight: 700;
            text-align: center;
          ">Session Expiring Soon</h2>
        </div>

        <div style="
          background: linear-gradient(135deg, #fff5e6 0%, #ffe4e1 100%);
          border-left: 4px solid #fda085;
          padding: 16px 20px;
          border-radius: 8px;
          margin-bottom: 24px;
        ">
          <p style="
            margin: 0;
            color: #555;
            line-height: 1.6;
            font-size: 15px;
            text-align: center;
          ">
            Your session will expire in <strong style="
              color: #d32f2f;
              font-size: 24px;
              display: inline-block;
              font-weight: 700;
            "><span id="countdown">${timeRemaining}</span></strong> seconds due to inactivity.
          </p>
          <p style="
            margin: 12px 0 0 0;
            color: #666;
            line-height: 1.5;
            font-size: 14px;
            text-align: center;
          ">
            Click "Stay Logged In" to continue your session.
          </p>
        </div>

        <div style="
          display: flex;
          gap: 12px;
          flex-direction: column;
        ">
          <button id="stay-logged-in" style="
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #4A8B5C 0%, #3d7349 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 4px 12px rgba(74, 139, 92, 0.3);
          " 
          onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(74, 139, 92, 0.4)'"
          onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(74, 139, 92, 0.3)'"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
            Stay Logged In
          </button>
          <button id="logout-now" style="
            width: 100%;
            padding: 14px;
            background: white;
            color: #666;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
          "
          onmouseover="this.style.borderColor='#d32f2f'; this.style.color='#d32f2f'"
          onmouseout="this.style.borderColor='#e0e0e0'; this.style.color='#666'"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Logout Now
          </button>
        </div>
      </div>
      <style>
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      </style>
    `;

    document.body.appendChild(modal);

    // Countdown timer
    const countdownEl = document.getElementById('countdown');
    let remaining = timeRemaining;
    const countdownInterval = setInterval(() => {
      remaining--;
      if (countdownEl) {
        countdownEl.textContent = remaining;
      }
      if (remaining <= 0) {
        clearInterval(countdownInterval);
        logout();
      }
    }, 1000);

    // Stay logged in button
    document.getElementById('stay-logged-in').addEventListener('click', () => {
      clearInterval(countdownInterval);
      updateActivity();
      hideWarning();
    });

    // Logout now button
    document.getElementById('logout-now').addEventListener('click', () => {
      clearInterval(countdownInterval);
      logout();
    });
  }

  // Hide warning modal
  function hideWarning() {
    const modal = document.getElementById('session-timeout-modal');
    if (modal) {
      modal.remove();
    }
  }

  // Logout and redirect to login page
  function logout() {
    // Clear any intervals
    if (checkInterval) {
      clearInterval(checkInterval);
    }

    // Clear session storage
    sessionStorage.clear();
    
    // Clear local storage (optional)
    localStorage.clear();

    // Show logout message
    alert('Your session has expired due to inactivity. You will be redirected to the login page.');

    // Redirect to login
    window.location.href = '/login';
  }

  // Initialize timeout tracking
  function init() {
    console.log('[Session Timeout] Starting session timeout tracker');
    
    // Track user activity
    activityEvents.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });

    // Start checking for timeout
    checkInterval = setInterval(checkTimeout, CHECK_INTERVAL);
    console.log('[Session Timeout] Check interval started');

    // Initial activity timestamp
    updateActivity();
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
