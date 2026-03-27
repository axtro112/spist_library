/**
 * Shared UI utility functions
 * Handles modals, notifications, loading states, and common UI interactions
 */

/**
 * Show modal by ID
 * @param {string} modalId - Modal element ID
 */
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

/**
 * Close all modals
 */
function closeModal() {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    modal.style.display = 'none';
  });
  document.body.style.overflow = 'auto';
}

/**
 * Show toast notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, error, warning, info)
 * @param {number} duration - Duration in milliseconds (default 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(toastContainer);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    padding: 15px 20px;
    background: ${getToastColor(type)};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    min-width: 250px;
    max-width: 400px;
    animation: slideIn 0.3s ease;
  `;
  toast.textContent = message;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Get toast background color based on type
 * @param {string} type - Toast type
 * @returns {string} CSS color
 */
function getToastColor(type) {
  const colors = {
    success: '#4CAF50',
    error: '#f44336',
    warning: '#ff9800',
    info: '#2196F3'
  };
  return colors[type] || colors.info;
}

/**
 * Show loading spinner
 * @param {string} message - Loading message (optional)
 */
function showLoading(message = 'Loading...') {
  let loader = document.getElementById('global-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'global-loader';
    loader.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;
    
    loader.innerHTML = `
      <div style="
        background: white;
        padding: 30px;
        border-radius: 12px;
        text-align: center;
      ">
        <div class="spinner"></div>
        <p style="margin-top: 15px; color: #333;">${message}</p>
      </div>
    `;
    
    document.body.appendChild(loader);
  }
  loader.style.display = 'flex';
}

/**
 * Hide loading spinner
 */
function hideLoading() {
  const loader = document.getElementById('global-loader');
  if (loader) {
    loader.style.display = 'none';
  }
}

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return d.toLocaleDateString('en-US', options);
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Disable button and show loading state
 * @param {HTMLButtonElement} button - Button element
 * @param {string} loadingText - Loading text (optional)
 * @returns {Function} Function to restore button state
 */
function disableButton(button, loadingText = 'Processing...') {
  const originalText = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<span class="spinner-small"></span> ${loadingText}`;
  
  return () => {
    button.disabled = false;
    button.innerHTML = originalText;
  };
}

function getDialogRoot() {
  let root = document.getElementById('ui-dialog-root');
  if (root) return root;

  root = document.createElement('div');
  root.id = 'ui-dialog-root';
  root.style.cssText = `
    position: fixed;
    inset: 0;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(15, 23, 42, 0.45);
    z-index: 10050;
  `;

  root.innerHTML = `
    <div id="ui-dialog-card" role="dialog" aria-modal="true" style="
      width: min(520px, 100%);
      background: #ffffff;
      border-radius: 14px;
      box-shadow: 0 20px 40px rgba(15, 23, 42, 0.22);
      overflow: hidden;
    ">
      <div style="padding: 18px 20px 10px; border-bottom: 1px solid #e2e8f0;">
        <h3 id="ui-dialog-title" style="margin: 0; font-size: 20px; color: #0f172a;">Notice</h3>
      </div>
      <div style="padding: 16px 20px 10px;">
        <p id="ui-dialog-message" style="margin: 0; color: #334155; line-height: 1.55;"></p>
        <input id="ui-dialog-input" type="text" style="display:none; width:100%; margin-top:12px; padding:10px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px;" />
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px 20px;">
        <button id="ui-dialog-cancel" type="button" class="cancel-btn" style="display:none;">Cancel</button>
        <button id="ui-dialog-confirm" type="button" class="submit-btn">OK</button>
      </div>
    </div>
  `;

  document.body.appendChild(root);
  return root;
}

function showDialog(options = {}) {
  return new Promise((resolve) => {
    const root = getDialogRoot();
    const titleEl = document.getElementById('ui-dialog-title');
    const messageEl = document.getElementById('ui-dialog-message');
    const inputEl = document.getElementById('ui-dialog-input');
    const cancelBtn = document.getElementById('ui-dialog-cancel');
    const confirmBtn = document.getElementById('ui-dialog-confirm');

    const mode = options.mode === 'prompt' ? 'prompt' : options.mode === 'confirm' ? 'confirm' : 'alert';
    const title = options.title || (mode === 'confirm' ? 'Confirm Action' : 'Notice');
    const message = options.message || '';

    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmBtn.textContent = options.confirmText || 'OK';
    cancelBtn.textContent = options.cancelText || 'Cancel';
    cancelBtn.style.display = (mode === 'confirm' || mode === 'prompt') ? '' : 'none';
    inputEl.style.display = mode === 'prompt' ? '' : 'none';
    inputEl.value = options.defaultValue || '';
    inputEl.placeholder = options.placeholder || '';

    function cleanup(result) {
      root.style.display = 'none';
      document.body.style.overflow = 'auto';
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      root.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKeyDown);
      resolve(result);
    }

    function onConfirm() {
      if (mode === 'prompt') {
        cleanup(String(inputEl.value || ''));
        return;
      }
      cleanup(true);
    }
    function onCancel() {
      cleanup(mode === 'prompt' ? null : false);
    }
    function onBackdrop(event) {
      if (event.target === root) cleanup(false);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') cleanup(mode === 'prompt' ? null : false);
      if (event.key === 'Enter') onConfirm();
    }

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    root.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKeyDown);

    root.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (mode === 'prompt') {
      setTimeout(() => inputEl.focus(), 0);
    } else {
      setTimeout(() => confirmBtn.focus(), 0);
    }
  });
}

function showAppAlert(message, title = 'Notice') {
  return showDialog({ mode: 'alert', title, message, confirmText: 'OK' });
}

function showAppConfirm(message, title = 'Confirm Action', confirmText = 'Confirm', cancelText = 'Cancel') {
  return showDialog({ mode: 'confirm', title, message, confirmText, cancelText });
}

function showAppPrompt(message, title = 'Input Required', defaultValue = '', placeholder = '', confirmText = 'Submit', cancelText = 'Cancel') {
  return showDialog({ mode: 'prompt', title, message, defaultValue, placeholder, confirmText, cancelText });
}

// Export UI utilities
window.ui = {
  showModal,
  closeModal,
  showToast,
  showLoading,
  hideLoading,
  formatDate,
  debounce,
  disableButton,
  showAppAlert,
  showAppConfirm,
  showAppPrompt
};

if (!window.__customAlertInstalled) {
  window.__customAlertInstalled = true;
  window.alert = function customAppAlert(message) {
    showAppAlert(String(message || ''));
  };
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #4CAF50;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto;
  }
  
  .spinner-small {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #4CAF50;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    vertical-align: middle;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);
