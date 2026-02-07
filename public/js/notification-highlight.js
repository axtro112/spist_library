/**
 * Notification Target Highlight Module
 * Highlights and scrolls to the target item on destination pages
 */

class NotificationHighlight {
  constructor() {
    this.highlightClass = 'notif-highlight';
    this.init();
  }

  init() {
    // Add CSS for highlight effect
    this.injectStyles();
    
    // Check URL params on page load
    window.addEventListener('DOMContentLoaded', () => {
      this.checkAndHighlight();
    });
  }

  injectStyles() {
    if (document.getElementById('notif-highlight-styles')) return;

    const style = document.createElement('style');
    style.id = 'notif-highlight-styles';
    style.textContent = `
      .notif-highlight {
        animation: notif-pulse 2s ease-in-out;
        background-color: #fff3cd !important;
        border-left: 4px solid #ffc107 !important;
        box-shadow: 0 2px 8px rgba(255, 193, 7, 0.3) !important;
      }

      @keyframes notif-pulse {
        0%, 100% {
          background-color: transparent;
          border-left-color: transparent;
        }
        20%, 80% {
          background-color: #fff3cd;
          border-left-color: #ffc107;
        }
      }

      .notif-scroll-target {
        scroll-margin-top: 100px;
      }
    `;
    document.head.appendChild(style);
  }

  checkAndHighlight() {
    const params = new URLSearchParams(window.location.search);
    
    const bookId = params.get('bookId');
    const borrowingId = params.get('borrowingId');
    const userId = params.get('userId');
    const adminId = params.get('adminId');
    const logId = params.get('logId');
    const notifId = params.get('notifId');

    console.log('[Highlight] URL params:', { bookId, borrowingId, userId, adminId, logId, notifId });

    if (bookId) {
      this.highlightBook(bookId);
    } else if (borrowingId) {
      this.highlightBorrowing(borrowingId);
    } else if (userId) {
      this.highlightUser(userId);
    } else if (adminId) {
      this.highlightAdmin(adminId);
    } else if (logId) {
      this.highlightLog(logId);
    }
  }

  /**
   * Generic highlight function
   * @param {string} selector - CSS selector for the target element
   * @param {number} retries - Number of retries (for delayed rendering)
   */
  highlightElement(selector, retries = 5) {
    console.log('[Highlight] Looking for element:', selector);
    
    const element = document.querySelector(selector);
    
    if (element) {
      console.log('[Highlight] Element found, highlighting...');
      
      // Scroll into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Add highlight class
      element.classList.add(this.highlightClass, 'notif-scroll-target');
      
      // Remove highlight after 3 seconds
      setTimeout(() => {
        element.classList.remove(this.highlightClass);
      }, 3000);
      
      return true;
    } else if (retries > 0) {
      console.log('[Highlight] Element not found, retrying in 500ms...');
      
      // Retry after delay (in case content is loading)
      setTimeout(() => {
        this.highlightElement(selector, retries - 1);
      }, 500);
    } else {
      console.warn('[Highlight] Element not found after retries:', selector);
      this.showNotFoundMessage();
    }
    
    return false;
  }

  highlightBook(bookId) {
    // Try common selectors for book cards/rows
    const selectors = [
      `[data-book-id="${bookId}"]`,
      `#book-${bookId}`,
      `.book-card[data-id="${bookId}"]`,
      `.book-row[data-id="${bookId}"]`,
      `tr[data-book-id="${bookId}"]`
    ];

    for (const selector of selectors) {
      if (this.highlightElement(selector)) return;
    }
  }

  highlightBorrowing(borrowingId) {
    // Try common selectors for borrowing records
    const selectors = [
      `[data-borrowing-id="${borrowingId}"]`,
      `#borrowing-${borrowingId}`,
      `.borrowing-card[data-id="${borrowingId}"]`,
      `.borrowing-row[data-id="${borrowingId}"]`,
      `tr[data-borrowing-id="${borrowingId}"]`
    ];

    for (const selector of selectors) {
      if (this.highlightElement(selector)) return;
    }
  }

  highlightUser(userId) {
    const selectors = [
      `[data-user-id="${userId}"]`,
      `#user-${userId}`,
      `.user-card[data-id="${userId}"]`,
      `tr[data-user-id="${userId}"]`
    ];

    for (const selector of selectors) {
      if (this.highlightElement(selector)) return;
    }
  }

  highlightAdmin(adminId) {
    const selectors = [
      `[data-admin-id="${adminId}"]`,
      `#admin-${adminId}`,
      `.admin-card[data-id="${adminId}"]`,
      `tr[data-admin-id="${adminId}"]`
    ];

    for (const selector of selectors) {
      if (this.highlightElement(selector)) return;
    }
  }

  highlightLog(logId) {
    const selectors = [
      `[data-log-id="${logId}"]`,
      `#log-${logId}`,
      `tr[data-log-id="${logId}"]`
    ];

    for (const selector of selectors) {
      if (this.highlightElement(selector)) return;
    }
  }

  showNotFoundMessage() {
    // Show a non-intrusive message
    const existingMsg = document.getElementById('notif-target-not-found');
    if (existingMsg) return;

    const msg = document.createElement('div');
    msg.id = 'notif-target-not-found';
    msg.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 4px;
      padding: 12px 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      z-index: 9999;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;
    msg.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="material-symbols-outlined" style="color: #ff9800;">info</span>
        <span style="font-size: 14px; color: #333;">The item you're looking for may have been removed or is not visible.</span>
      </div>
    `;
    
    document.body.appendChild(msg);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      msg.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => msg.remove(), 300);
    }, 5000);
  }
}

// Auto-initialize
window.notificationHighlight = new NotificationHighlight();
