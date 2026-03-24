/**
 * Facebook-Style Notification System
 * Handles real-time notifications via SSE with grouped display and tabs
 */

const ADMIN_NOTIF_DEBUG = false;
const notifLog = (...args) => {
  if (ADMIN_NOTIF_DEBUG) console.log(...args);
};
const notifWarn = (...args) => {
  if (ADMIN_NOTIF_DEBUG) console.warn(...args);
};

class NotificationManager {
  constructor() {
    this.eventSource = null;
    this.unreadCount = 0;
    this.isOpen = false;
    this.notifications = [];
    this.activeTab = 'all'; // 'all' or 'unread'
    this.currentLimit = 20;
    this.isLoadingNotifications = false; // Prevent duplicate loads
    this.modalHandlersAttached = false; // Track if modal handlers are attached
    this.init();
  }

  async init() {
    notifLog('[Notifications] Initializing NotificationManager...');
    
    // Detect if notification bell already exists (student page style)
    const existingBell = document.getElementById('studentNotificationContainer') || 
                        document.getElementById('adminNotificationContainer') ||
                        document.getElementById('superAdminNotificationContainer');
    
    notifLog('[Notifications] Existing bell found:', !!existingBell);
    
    if (existingBell) {
      // Page has pre-rendered notification bell
      this.bindNotificationUI();
    } else {
      // Dynamically create notification bell (fallback)
      this.createNotificationUI();
      this.attachEventListeners();
    }
    
    notifLog('[Notifications] About to load unread count...');
    await this.loadUnreadCount();
    notifLog('[Notifications] About to load notifications...');
    await this.loadNotifications();
    notifLog('[Notifications] About to connect SSE...');
    this.connectSSE();
    notifLog('[Notifications] Init complete');
  }

  // Detect page type based on elements or sessionStorage
  getUserType() {
    const userRole = sessionStorage.getItem('userRole');
    const adminRole = sessionStorage.getItem('adminRole');
    
    if (userRole === 'student') return 'student';
    if (userRole === 'admin' && adminRole === 'super_admin') return 'super_admin';
    if (userRole === 'admin') return 'admin';
    
    return 'guest';
  }

  bindNotificationUI() {
    // Universal binding - works for student, admin, and super-admin
    const bellBtn = document.getElementById('studentNotifBell') || 
                    document.getElementById('adminNotifBell') ||
                    document.getElementById('superAdminNotifBell');
                    
    const markAllBtn = document.getElementById('notifMarkAllBtn');
    const settingsBtn = document.getElementById('notifSettingsBtn');
    const seeMoreBtn = document.getElementById('notifSeeMore');
    
    const panel = document.getElementById('studentNotifPanel') ||
                  document.getElementById('adminNotifPanel') ||
                  document.getElementById('superAdminNotifPanel');
                  
    const tabAll = document.getElementById('tabAll');
    const tabUnread = document.getElementById('tabUnread');

    // PORTAL FIX: Move dropdown to document.body to escape parent stacking contexts
    // Why this is needed: Parent containers with overflow:hidden, transform, filter,
    // or positioned ancestors create new stacking contexts that trap z-index.
    // Moving to body ensures the dropdown is always at the root level.
    if (panel && !panel.dataset.portaled) {
      document.body.appendChild(panel);
      panel.dataset.portaled = 'true';
      notifLog('✓ Notification dropdown moved to body (portal fix)');
    }

    if (bellBtn) {
      bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdown();
      });
      
      // ESC key closes dropdown
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.closeDropdown();
        }
      });
      
      // Reposition on scroll and resize to keep dropdown aligned with bell
      window.addEventListener('scroll', () => {
        if (this.isOpen) {
          this.positionDropdown();
        }
      }, { passive: true });
      
      window.addEventListener('resize', () => {
        if (this.isOpen) {
          this.positionDropdown();
        }
      }, { passive: true });
    }

    if (markAllBtn) {
      markAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.markAllAsRead();
      });
    }

    if (settingsBtn) {
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openPreferences();
      });
    }

    if (seeMoreBtn) {
      seeMoreBtn.addEventListener('click', () => {
        this.loadMoreNotifications();
      });
    }

    if (tabAll) {
      tabAll.addEventListener('click', () => this.setActiveTab('all'));
    }

    if (tabUnread) {
      tabUnread.addEventListener('click', () => this.setActiveTab('unread'));
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (panel && !panel.contains(e.target) && !bellBtn?.contains(e.target)) {
        this.closeDropdown();
      }
    });
  }

  // Lazy-load the notification modal module once
  async ensureModalModule() {
    if (window.notificationModal) return;
    if (this.modalLoaderPromise) {
      return this.modalLoaderPromise;
    }

    this.modalLoaderPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-notif-modal="true"]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error('Failed to load notification modal script')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = '/js/notifications-modal.js';
      script.async = true;
      script.dataset.notifModal = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load notification modal script'));
      document.head.appendChild(script);
    });

    return this.modalLoaderPromise;
  }

  setActiveTab(tab) {
    this.activeTab = tab;
    
    // Update tab UI
    const tabAll = document.getElementById('tabAll');
    const tabUnread = document.getElementById('tabUnread');
    
    if (tabAll && tabUnread) {
      tabAll.classList.toggle('active', tab === 'all');
      tabUnread.classList.toggle('active', tab === 'unread');
    }
    
    // Re-render with filtered data
    this.renderNotifications();
  }

  async toggleDropdown() {
    const panel = document.getElementById('studentNotifPanel') ||
                  document.getElementById('adminNotifPanel') ||
                  document.getElementById('superAdminNotifPanel');
                  
    const bellBtn = document.getElementById('studentNotifBell') ||
                    document.getElementById('adminNotifBell') ||
                    document.getElementById('superAdminNotifBell');
                    
    if (!panel || !bellBtn) {
      notifWarn('[Notifications] Panel or bell button not found');
      return;
    }

    this.isOpen = !this.isOpen;
    panel.style.display = this.isOpen ? 'block' : 'none';
    panel.classList.toggle('visible', this.isOpen);
    bellBtn.setAttribute('aria-expanded', this.isOpen);

    if (this.isOpen) {
      notifLog('[Notifications] ▼ Dropdown opened');
      this.positionDropdown();
      
      // CRITICAL: Attach click handlers immediately when opening
      this.attachModalHandlers();
      
      // If notifications already loaded, render immediately
      if (this.notifications.length > 0) {
        this.renderNotifications();
      }
      
      // Always reload to get latest data (will re-render when done)
      await this.loadNotifications();
    } else {
      this.closeDropdown();
    }
  }

  /**
   * Position dropdown using fixed positioning with viewport boundary detection
   * This method calculates position based on bell icon and ensures dropdown stays on screen
   */
  positionDropdown() {
    const panel = document.getElementById('studentNotifPanel') ||
                  document.getElementById('adminNotifPanel') ||
                  document.getElementById('superAdminNotifPanel');
                  
    const bellBtn = document.getElementById('studentNotifBell') ||
                    document.getElementById('adminNotifBell') ||
                    document.getElementById('superAdminNotifBell');
                    
    if (!panel || !bellBtn) return;

    const bellRect = bellBtn.getBoundingClientRect();
    const panelWidth = 420;
    const panelHeight = panel.offsetHeight || 520; // Estimate if not rendered yet
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const spacing = 12; // Gap between bell and dropdown
    const padding = 10; // Minimum distance from viewport edges

    // Calculate horizontal position (align right edge with bell)
    let left = bellRect.right - panelWidth;
    
    // Keep within left boundary
    if (left < padding) {
      left = padding;
    }
    
    // Keep within right boundary
    if (left + panelWidth > viewportWidth - padding) {
      left = viewportWidth - panelWidth - padding;
    }

    // Calculate vertical position (default: below bell)
    let top = bellRect.bottom + spacing;
    let positionAbove = false;

    // If dropdown would go off bottom of screen, position it above the bell
    if (top + panelHeight > viewportHeight - padding) {
      const topAlt = bellRect.top - panelHeight - spacing;
      if (topAlt > padding) {
        top = topAlt;
        positionAbove = true;
      }
    }

    // Apply positioning
    panel.style.position = 'fixed';
    panel.style.top = top + 'px';
    panel.style.left = left + 'px';
    panel.style.right = 'auto';
    
    // Add class for styling adjustments if positioned above
    panel.classList.toggle('positioned-above', positionAbove);
  }

  closeDropdown() {
    const panel = document.getElementById('studentNotifPanel') ||
                  document.getElementById('adminNotifPanel') ||
                  document.getElementById('superAdminNotifPanel');
                  
    const bellBtn = document.getElementById('studentNotifBell') ||
                    document.getElementById('adminNotifBell') ||
                    document.getElementById('superAdminNotifBell');
    
    if (panel) panel.style.display = 'none';
    if (bellBtn) bellBtn.setAttribute('aria-expanded', 'false');
    this.isOpen = false;
    notifLog('[Notifications] Dropdown closed');
  }

  createNotificationUI() {
    // Check if notification bell already exists
    if (document.getElementById('notification-bell')) return;

    // Find the admin-profile or profile-info section
    const profileSection = document.querySelector('.admin-profile') || 
                          document.querySelector('.profile-info') || 
                          document.querySelector('.sidebar') ||
                          document.querySelector('header');
    
    if (!profileSection) {
      notifWarn('No suitable location found to add notification bell');
      return;
    }

    // Create notification bell container
    const bellContainer = document.createElement('div');
    bellContainer.id = 'notification-bell';
    bellContainer.className = 'notification-bell';
    bellContainer.innerHTML = `

      <div class="notification-dropdown" id="notification-dropdown" style="display: none;">
        <div class="notification-header">
          <h3>Notifications</h3>
          <div class="notification-actions">
            <button class="notification-action-btn" id="mark-all-read" title="Mark all as read">
              <span class="material-symbols-outlined">done_all</span>
            </button>
            <button class="notification-action-btn" id="notification-settings" title="Notification settings">
              <span class="material-symbols-outlined">settings</span>
            </button>
          </div>
        </div>
        <div class="notification-list" id="notification-list">
          <div class="notification-loading">Loading notifications...</div>
        </div>
        <div class="notification-footer">
          <button class="notification-view-all" id="view-all-notifications">
            View All Notifications
          </button>
        </div>
      </div>
    `;

    // Add to profile section
    profileSection.appendChild(bellContainer);
  }

  attachEventListeners() {
    const notificationBtn = document.getElementById('notification-btn');
    const markAllReadBtn = document.getElementById('mark-all-read');
    const settingsBtn = document.getElementById('notification-settings');

    if (notificationBtn) {
      notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdown();
      });
    }

    if (markAllReadBtn) {
      markAllReadBtn.addEventListener('click', () => {
        this.markAllAsRead();
      });
    }

    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.openPreferences();
      });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('notification-dropdown');
      const bellContainer = document.getElementById('notification-bell');
      
      if (dropdown && bellContainer && !bellContainer.contains(e.target)) {
        dropdown.style.display = 'none';
        this.isOpen = false;
      }
    });
  }

  async loadUnreadCount() {
    try {
      notifLog('[Notifications] Loading unread count...');
      const response = await fetchWithCsrf('/api/notifications/unread-count');
      notifLog('[Notifications] Unread count response status:', response.status);
      
      const data = await response.json();
      notifLog('[Notifications] Unread count data:', data);
      
      if (data.success) {
        const count = data.data?.count ?? data.count ?? 0;
        notifLog('[Notifications] Setting badge to:', count);
        this.updateUnreadBadge(count);
      } else {
        console.error('Unread count API returned success: false');
      }
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  }

  async loadNotifications(limit = 20) {
    // Prevent multiple simultaneous loads
    if (this.isLoadingNotifications) {
      notifLog('⏳ Already loading notifications, skipping...');
      return;
    }
    
    this.isLoadingNotifications = true;
    
    // Only show loading state if dropdown is open
    if (this.isOpen) {
      this.showLoadingState();
    }
    
    try {
      notifLog('[Notifications] Loading notifications, limit:', limit);
      const response = await fetchWithCsrf(`/api/notifications?limit=${limit}`);
      
      notifLog('[Notifications] Response status:', response.status, response.statusText);
      
      // Handle HTTP errors with specific messages
      if (!response.ok) {
        if (response.status === 401) {
          throw { statusCode: 401, message: 'Session expired. Please log in again.' };
        } else if (response.status === 403) {
          throw { statusCode: 403, message: 'Access denied.' };
        } else if (response.status === 429) {
          throw { statusCode: 429, message: 'Too many requests. Please wait.' };
        } else if (response.status >= 500) {
          throw { statusCode: response.status, message: 'Server error. Please try again later.' };
        } else {
          throw { statusCode: response.status, message: `Failed to load notifications (${response.status})` };
        }
      }
      
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        throw { message: 'Invalid response from server.' };
      }
      
      notifLog('[Notifications] Response data:', data);
      notifLog('[Notifications] Data structure:', {
        success: data.success,
        hasNotifications: !!data.notifications,
        hasData: !!data.data,
        notificationsIsArray: Array.isArray(data.notifications),
        notificationsLength: data.notifications?.length || data.data?.length || 0
      });
      
      if (data.success) {
        // NEW FORMAT: {success: true, notifications: [...], unreadCount: 0}
        // OLD FORMAT: {success: true, data: [...]} (fallback)
        const rawData = data.notifications || data.data || [];
        this.notifications = Array.isArray(rawData) ? rawData : [];
        
        notifLog('[Notifications] ✓ Loaded:', this.notifications.length, 'notifications');
        
        // Debug: Log first notification structure
        if (this.notifications.length > 0) {
          const sample = this.notifications[0];
          notifLog('[Notifications] 📋 Sample notification fields:', {
            id: sample.id,
            type: sample.type,
            target_type: sample.target_type,
            target_id: sample.target_id,
            book_title: sample.book_title,
            borrowing_id: sample.borrowing_id,
            hasAllFields: !!(sample.target_type && sample.target_id)
          });
        }
        
        // Update unread count if provided
        if (typeof data.unreadCount === 'number') {
          notifLog('[Notifications] ✓ Updating badge from API:', data.unreadCount);
          this.updateUnreadBadge(data.unreadCount);
        }
        
        // ALWAYS render after loading (dropdown may be open OR may open later)
        this.renderNotifications();
      } else {
        console.error('[Notifications] ✗ API returned success: false, message:', data.message);
        this.notifications = [];
        
        // Show error only if dropdown is currently open
        if (this.isOpen) {
          this.showError(data.message || 'Failed to load notifications.');
        }
      }
    } catch (error) {
      console.error('[Notifications] ✗ Load error:', error);
      this.notifications = [];
      
      // Show error only if dropdown is currently open
      if (this.isOpen) {
        const errorMsg = error.message || 'Failed to load notifications. Please try again.';
        this.showError(errorMsg);
      }
    } finally {
      // ALWAYS clear loading flag to prevent stuck state
      this.isLoadingNotifications = false;
      notifLog('[Notifications] ✓ Loading complete, flag cleared');
    }
  }

  async loadMoreNotifications() {
    this.currentLimit += 20;
    await this.loadNotifications(this.currentLimit);
  }

  showLoadingState() {
    const container = document.getElementById('notifListContainer') || document.getElementById('notifList');
    if (container) {
      container.innerHTML = `
        <div class="notif-loading" style="text-align: center; padding: 40px 20px;">
          <div class="spinner" style="margin: 0 auto 16px; width: 40px; height: 40px; border: 3px solid #f3f3f3; border-top: 3px solid #4CAF50; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <p style="color: #666; font-size: 14px;">Loading notifications...</p>
        </div>
      `;
    }
  }

  showError(message) {
    const container = document.getElementById('notifListContainer') || document.getElementById('notifList');
    if (container) {
      container.innerHTML = `
        <div class="notif-error" style="text-align: center; padding: 30px 16px;">
          <span class="material-symbols-outlined" style="font-size: 48px; color: #ff9800; margin-bottom: 12px; display: block;">warning</span>
          <p style="color: #333; font-size: 13px; margin: 0 0 16px 0; line-height: 1.5;">${this.escapeHtml(message)}</p>
          <button onclick="if(window.notificationManager) { window.notificationManager.loadNotifications(); }" style="background: #4CAF50; color: #fff; border: none; border-radius: 6px; padding: 8px 16px; font-size: 13px; cursor: pointer;">Try Again</button>
        </div>
      `;
    }
  }

  /**
   * Group notifications by time period (New, Today, Earlier)
   */
  groupNotifications(notifications) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const groups = {
      new: [],
      today: [],
      earlier: []
    };

    notifications.forEach(notif => {
      if (!notif.created_at) return;
      
      const notifDate = new Date(notif.created_at.replace(' ', 'T'));
      if (isNaN(notifDate.getTime())) return;

      if (notifDate > last24h) {
        groups.new.push(notif);
      } else if (notifDate >= todayStart) {
        groups.today.push(notif);
      } else {
        groups.earlier.push(notif);
      }
    });

    return groups;
  }

  renderNotifications() {
    notifLog('[Notifications] 🎨 renderNotifications() called');
    notifLog('[Notifications]   - notifications count:', this.notifications.length);
    notifLog('[Notifications]   - activeTab:', this.activeTab);
    notifLog('[Notifications]   - isOpen:', this.isOpen);
    
    // Try both container IDs (student pages use notifListContainer, admin pages use notifList)
    const container = document.getElementById('notifListContainer') || document.getElementById('notifList');
    if (!container) {
      notifWarn('[Notifications] ⚠ Notification list container not found (page may not have notification UI)');
      return;
    }
    notifLog('[Notifications] ✓ Container found:', container.id);

    // Ensure notifications is an array
    if (!Array.isArray(this.notifications)) {
      console.error('❌ this.notifications is not an array:', this.notifications);
      this.notifications = [];
    }

    // Filter by active tab
    let filteredNotifications = this.notifications;
    if (this.activeTab === 'unread') {
      filteredNotifications = this.notifications.filter(n => {
        const isUnread = !n.is_read || n.is_read === 0 || n.is_read === '0';
        return isUnread;
      });
    }

    if (filteredNotifications.length === 0) {
      container.innerHTML = this.renderEmptyState();
      return;
    }

    try {
      // Group notifications
      const groups = this.groupNotifications(filteredNotifications);
      
      let html = '';
      
      // New section
      if (groups.new.length > 0) {
        html += '<div class="notif-section">';
        html += '<h4 class="notif-section-title">New</h4>';
        html += '<a class="notif-section-link">See all</a>';
        html += '</div>';
        html += groups.new.map(n => this.renderNotificationItem(n)).join('');
      }

      // Today section
      if (groups.today.length > 0) {
        html += '<div class="notif-section">';
        html += '<h4 class="notif-section-title">Today</h4>';
        html += '</div>';
        html += groups.today.map(n => this.renderNotificationItem(n)).join('');
      }

      // Earlier section
      if (groups.earlier.length > 0) {
        html += '<div class="notif-section">';
        html += '<h4 class="notif-section-title">Earlier</h4>';
        html += '</div>';
        html += groups.earlier.map(n => this.renderNotificationItem(n)).join('');
      }

      container.innerHTML = html;

      // Attach modal click handlers (no page navigation)
      this.attachModalHandlers();
    } catch (error) {
      console.error('[Notifications] ✗ Render error:', error);
      this.showError('Error displaying notifications');
    }
  }

  // Attach click handlers to notification items using the modal module
  async attachModalHandlers() {
    if (this.modalHandlersAttached) {
      return;
    }

    const container = document.getElementById('notifListContainer') || document.getElementById('notifList');
    if (!container) return;

    try {
      await this.ensureModalModule();

      if (window.notificationModal) {
        window.notificationModal.attachClickHandlers(container, (notifId) => this.markAsRead(notifId));
        this.modalHandlersAttached = true;
        return;
      }
    } catch (err) {
      console.error('[Notifications] ✗ Failed to initialize notification modal module:', err);
    }

    // Fallback: basic click to mark as read
    container.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', () => {
        const notifId = item.dataset.id;
        this.markAsRead(notifId);
      });
    });
  }

  renderNotificationItem(notification) {
    // Defensive null checks
    if (!notification) {
      console.error('Attempted to render null notification');
      return '';
    }
    
        const isUnread = notification.is_read === 0 || notification.is_read === false;
        const timeAgo = this.formatTimeAgo(notification.created_at);
        const iconType = this.getNotificationIcon(notification.type);
        const title = notification.title || notification.type || 'Notification';
        const message = notification.message || notification.description || notification.body || 'No message available';
        const notifId = notification.id || notification._id || '';

        // Deep-link fields: prefer explicit deep_link_* then fall back to target_*
        const linkType = (notification.deep_link_type || notification.target_type || '').toLowerCase();
        const linkId = notification.deep_link_id || notification.target_id || notification.student_id || '';
    
    // Store full notification data for deep linking
    const notifDataJson = JSON.stringify(notification).replace(/"/g, '&quot;');

    return `
      <div class="notif-item ${isUnread ? 'unread' : ''}" 
           data-id="${notifId}"
          data-link-id="${this.escapeHtml(linkId)}"
          data-link-type="${this.escapeHtml(linkType)}"
          data-notif-id="${notifId}"
           data-notif-data="${notifDataJson}"
           style="cursor: pointer;">
        <div class="notif-avatar">
          <span class="material-symbols-outlined">${iconType}</span>
        </div>
        <div class="notif-content">
          <p class="notif-message">
            <strong>${this.escapeHtml(title)}</strong><br>
            ${this.escapeHtml(message)}
          </p>
          <div class="notif-time">
            <span class="material-symbols-outlined">schedule</span>
            ${timeAgo}
          </div>
        </div>
        ${isUnread ? '<div class="notif-unread-dot"></div>' : ''}
      </div>
    `;
  }

  renderEmptyState() {
    return `
      <div class="notif-empty">
        <span class="material-symbols-outlined">notifications_off</span>
        <h4 class="notif-empty-title">No notifications</h4>
        <p class="notif-empty-text">
          ${this.activeTab === 'unread' 
            ? "You're all caught up! No unread notifications." 
            : "You don't have any notifications yet."}
        </p>
      </div>
    `;
  }

  getNotificationIcon(type) {
    const icons = {
      DUE_SOON: 'schedule',
      OVERDUE: 'warning',
      BORROW_APPROVED: 'check_circle',
      BORROWED: 'local_library',
      RETURNED: 'assignment_return',
      SYSTEM: 'info'
    };
    return icons[type] || 'notifications';
  }

  /**
   * Format date to Facebook-style time ago (4h, 18h, 2d, etc.)
   */
  formatTimeAgo(dateString) {
    if (!dateString) return '—';
    
    const isoDateString = dateString.replace(' ', 'T');
    const now = new Date();
    const date = new Date(isoDateString);
    
    if (isNaN(date.getTime())) {
      notifWarn('Invalid date:', dateString);
      return '—';
    }
    
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
    if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getNotificationIcon(type) {
    const icons = {
      DUE_SOON: 'schedule',
      OVERDUE: 'warning',
      BORROW_APPROVED: 'check_circle',
      BORROWED: 'local_library',
      RETURNED: 'assignment_return',
      SYSTEM: 'info'
    };
    return icons[type] || 'notifications';
  }

  formatTimeAgo(dateString) {
    if (!dateString) return '—';
    
    // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS) by replacing space with T
    const isoDateString = dateString.replace(' ', 'T');
    
    const now = new Date();
    const date = new Date(isoDateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      notifWarn('Invalid date:', dateString);
      return '—';
    }
    
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  updateUnreadBadge(count) {
    notifLog('[Notifications] updateUnreadBadge called with count:', count);
    this.unreadCount = count;
    
    // Support all notification badge IDs across all roles
    const badge = document.getElementById('studentNotifBadge') ||
                  document.getElementById('adminNotifBadge') ||
                  document.getElementById('superAdminNotifBadge') ||
                  document.getElementById('notification-badge');
    
    notifLog('[Notifications] Badge element found:', !!badge, badge?.id);
    
    if (!badge) {
      notifWarn('[Notifications] No badge element found!');
      return;
    }

    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'block';
      notifLog('[Notifications] Badge updated to show:', badge.textContent);
    } else {
      badge.style.display = 'none';
      notifLog('[Notifications] Badge hidden (count is 0)');
    }
  }

  async markAsRead(notificationId) {
    try {
      const response = await fetchWithCsrf(`/api/notifications/${notificationId}/read`, {
        method: 'PUT'
      });
      const data = await response.json();

      if (data.success) {
        // Update local notification state
        const notification = this.notifications.find(n => n.id === parseInt(notificationId));
        if (notification) {
          notification.is_read = 1;
        }

        // Update unread count
        if (this.unreadCount > 0) {
          this.updateUnreadBadge(this.unreadCount - 1);
        }

        // Re-render notifications
        this.renderNotifications();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  async markAllAsRead() {
    try {
      const response = await fetchWithCsrf('/api/notifications/read-all', {
        method: 'PUT'
      });
      const data = await response.json();

      if (data.success) {
        // Update all notifications to read
        this.notifications.forEach(n => n.is_read = 1);
        this.updateUnreadBadge(0);
        this.renderNotifications();
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }

  connectSSE() {
    // Close existing connection if any
    if (this.eventSource) {
      this.eventSource.close();
    }

    try {
      this.eventSource = new EventSource('/api/notifications/stream');

      this.eventSource.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data);
          notifLog('SSE notification received:', notification);
          
          // Handle keepalive and connection messages (don't update badge)
          if (notification.type === 'keepalive' || notification.type === 'connected') {
            return;
          }

          // Only process actual notification objects with required fields
          if (!notification.id || !notification.title) {
            notifWarn('[Notifications] SSE message missing required fields, ignoring');
            return;
          }

          // Add new notification to the list
          this.notifications.unshift(notification);
          
          // Keep only recent notifications in memory
          if (this.notifications.length > 50) {
            this.notifications = this.notifications.slice(0, 50);
          }

          // Update unread count (only for actual new notifications)
          this.updateUnreadBadge(this.unreadCount + 1);

          // Re-render if dropdown is open
          if (this.isOpen) {
            this.renderNotifications();
          }

          // Show browser notification if supported and permitted
          this.showBrowserNotification(notification);

          // Play notification sound (optional)
          this.playNotificationSound();
        } catch (error) {
          console.error('Error processing notification:', error, 'Event data:', event.data);
        }
      };

      this.eventSource.onerror = (error) => {
        notifLog('[Notifications] Connection lost, will reconnect in 5 seconds...');
        this.eventSource.close();
        
        // Reconnect after 5 seconds
        setTimeout(() => {
          notifLog('[Notifications] Reconnecting to notification stream...');
          this.connectSSE();
        }, 5000);
      };

      this.eventSource.onopen = () => {
        notifLog('Connected to notification stream');
      };
    } catch (error) {
      console.error('Error connecting to SSE:', error);
    }
  }

  showBrowserNotification(notification) {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/img/logo.png', // Add your logo path
        tag: notification.id.toString(),
        requireInteraction: notification.type === 'OVERDUE'
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          this.showBrowserNotification(notification);
        }
      });
    }
  }

  playNotificationSound() {
    // Optional: Add notification sound
    // const audio = new Audio('/sounds/notification.mp3');
    // audio.play().catch(e => notifLog('Could not play sound'));
  }

  openPreferences() {
    this.toggleDropdown();
    this.showPreferencesModal();
  }

  async showPreferencesModal() {
    // Check if modal already exists
    let modal = document.getElementById('notification-preferences-modal');
    
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'notification-preferences-modal';
      modal.className = 'modal';
      document.body.appendChild(modal);
    }

    // Load current preferences
    try {
      const response = await fetchWithCsrf('/api/notifications/preferences');
      const data = await response.json();
      if (data.success) {
        this.renderPreferencesModal(modal, data.data);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  }

  renderPreferencesModal(modal, preferences) {
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Notification Preferences</h2>
          <button class="modal-close" id="close-preferences-modal">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="modal-body">
          <form id="notification-preferences-form">
            <div class="form-section">
              <h3>General Settings</h3>
              
              <div class="form-group checkbox-group">
                <label>
                  <input type="checkbox" id="enable_in_app" ${preferences.enable_in_app ? 'checked' : ''}>
                  <span>Enable in-app notifications</span>
                </label>
              </div>

              <div class="form-group checkbox-group">
                <label>
                  <input type="checkbox" id="enable_realtime" ${preferences.enable_realtime ? 'checked' : ''}>
                  <span>Enable real-time notifications</span>
                </label>
              </div>
            </div>

            <div class="form-section">
              <h3>Notification Types</h3>
              
              <div class="form-group checkbox-group">
                <label>
                  <input type="checkbox" id="enable_due_reminders" ${preferences.enable_due_reminders ? 'checked' : ''}>
                  <span>Due date reminders</span>
                </label>
              </div>

              <div class="form-group checkbox-group">
                <label>
                  <input type="checkbox" id="enable_overdue_alerts" ${preferences.enable_overdue_alerts ? 'checked' : ''}>
                  <span>Overdue book alerts</span>
                </label>
              </div>

              <div class="form-group">
                <label for="reminder_days_before">
                  Remind me
                  <select id="reminder_days_before" class="form-control">
                    ${[1, 2, 3, 4, 5, 6, 7].map(days => `
                      <option value="${days}" ${preferences.reminder_days_before === days ? 'selected' : ''}>
                        ${days} day${days > 1 ? 's' : ''} before
                      </option>
                    `).join('')}
                  </select>
                  due date
                </label>
              </div>
            </div>

            <div class="form-section">
              <h3>Quiet Hours</h3>
              <p class="form-help">No notifications during these hours</p>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="quiet_hours_start">Start time</label>
                  <input type="time" id="quiet_hours_start" class="form-control" value="${preferences.quiet_hours_start || ''}">
                </div>

                <div class="form-group">
                  <label for="quiet_hours_end">End time</label>
                  <input type="time" id="quiet_hours_end" class="form-control" value="${preferences.quiet_hours_end || ''}">
                </div>
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="cancel-preferences">Cancel</button>
          <button type="button" class="btn btn-primary" id="save-preferences">Save Preferences</button>
        </div>
      </div>
    `;

    modal.style.display = 'block';

    // Attach event listeners
    document.getElementById('close-preferences-modal').addEventListener('click', () => {
      modal.style.display = 'none';
    });

    document.getElementById('cancel-preferences').addEventListener('click', () => {
      modal.style.display = 'none';
    });

    document.getElementById('save-preferences').addEventListener('click', () => {
      this.savePreferences(modal);
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }

  async savePreferences(modal) {
    const preferences = {
      enable_in_app: document.getElementById('enable_in_app').checked,
      enable_realtime: document.getElementById('enable_realtime').checked,
      enable_due_reminders: document.getElementById('enable_due_reminders').checked,
      enable_overdue_alerts: document.getElementById('enable_overdue_alerts').checked,
      reminder_days_before: parseInt(document.getElementById('reminder_days_before').value),
      quiet_hours_start: document.getElementById('quiet_hours_start').value || null,
      quiet_hours_end: document.getElementById('quiet_hours_end').value || null
    };

    try {
      const response = await fetchWithCsrf('/api/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify(preferences)
      });
      const data = await response.json();

      if (data.success) {
        modal.style.display = 'none';
        this.showSuccess('Preferences saved successfully');
        
        // Reconnect SSE if realtime preference changed
        if (preferences.enable_realtime) {
          this.connectSSE();
        } else if (this.eventSource) {
          this.eventSource.close();
        }
      } else {
        this.showError(response.message || 'Failed to save preferences');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      this.showError('Failed to save preferences');
    }
  }

  showError(message) {
    // You can implement a toast notification here
    console.error(message);
    alert(message);
  }

  showSuccess(message) {
    // You can implement a toast notification here
    notifLog(message);
  }

  destroy() {
    if (this.eventSource) {
      this.eventSource.close();
    }
  }
}

// Initialize notification manager when DOM is ready
let notificationManager;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    notificationManager = new NotificationManager();
  });
} else {
  notificationManager = new NotificationManager();
}

// Expose globally for external access (e.g., from error handlers)
window.notificationManager = notificationManager;

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (notificationManager) {
    notificationManager.destroy();
  }
});


