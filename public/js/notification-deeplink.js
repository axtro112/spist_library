/**
 * Notification Deep Linking Module
 * Handles click-to-navigate behavior for all notification types
 * Works for Student, System Admin, and Super Admin
 */

class NotificationDeepLink {
  constructor() {
    this.routingMap = this.buildRoutingMap();
  }

  /**
   * Build routing map: notification type/link_type -> destination URL
   */
  buildRoutingMap() {
    const userRole = sessionStorage.getItem('userRole');
    const adminRole = sessionStorage.getItem('adminRole');
    
    // Determine base paths
    const isStudent = userRole === 'student';
    const isSuperAdmin = userRole === 'admin' && adminRole === 'super_admin';
    const isSystemAdmin = userRole === 'admin' && adminRole === 'system_admin';

    const map = {
      // Borrowing-related notifications
      'borrowing': {
        types: ['DUE_SOON', 'OVERDUE', 'BORROW_APPROVED', 'RETURNED', 'BORROW_REJECTED'],
        getUrl: (notif) => {
          if (isStudent) {
            return `/student-borrowed?borrowingId=${notif.link_id || notif.related_id}`;
          } else {
            // Admin: go to borrowings management (if you have one) or books page
            return `/dashboard/admin/admin-books.html?borrowingId=${notif.link_id || notif.related_id}`;
          }
        }
      },
      
      // Book-related notifications
      'book': {
        types: ['NEW_BOOK', 'BOOK_AVAILABLE', 'BOOK_LOW_STOCK', 'BOOK_UPDATED'],
        getUrl: (notif) => {
          if (isStudent) {
            return `/student-available?bookId=${notif.link_id || notif.related_id}`;
          } else if (isSuperAdmin) {
            return `/super-admin-books?bookId=${notif.link_id || notif.related_id}`;
          } else {
            return `/dashboard/admin/admin-books.html?bookId=${notif.link_id || notif.related_id}`;
          }
        }
      },
      
      // User-related notifications (admin only)
      'user': {
        types: ['NEW_USER', 'USER_UPDATED', 'USER_SUSPENDED'],
        getUrl: (notif) => {
          if (isSuperAdmin) {
            return `/super-admin-users?userId=${notif.link_id}`;
          } else {
            return `/dashboard/admin/admin-users.html?userId=${notif.link_id}`;
          }
        }
      },
      
      // Admin management (super admin only)
      'admin': {
        types: ['NEW_ADMIN', 'ADMIN_UPDATED'],
        getUrl: (notif) => {
          if (isSuperAdmin) {
            return `/super-admin-admins?adminId=${notif.link_id}`;
          } else {
            return `/dashboard/admin/admin-admins.html?adminId=${notif.link_id}`;
          }
        }
      },
      
      // Audit logs (super admin only)
      'audit': {
        types: ['AUDIT_EVENT', 'SECURITY_ALERT'],
        getUrl: (notif) => {
          return `/super-admin-audit-logs?logId=${notif.link_id}`;
        }
      },
      
      // System/settings
      'system': {
        types: ['SYSTEM_UPDATE', 'MAINTENANCE', 'BACKUP_COMPLETE'],
        getUrl: (notif) => {
          if (isSuperAdmin) {
            return `/super-admin-settings`;
          } else {
            return `/dashboard/admin/admin-dashboard.html`;
          }
        }
      }
    };

    return map;
  }

  /**
   * Get destination URL for a notification
   * @param {Object} notification - Notification object
   * @returns {string|null} - Destination URL or null
   */
  getDestinationUrl(notification) {
    if (!notification) return null;

    // Try link_type first (explicit), then type (notification type)
    const linkType = notification.link_type || this.inferLinkTypeFromNotifType(notification.type);
    
    if (!linkType) {
      console.warn('[DeepLink] No link_type found for notification:', notification.id);
      return null;
    }

    const route = this.routingMap[linkType];
    if (!route) {
      console.warn('[DeepLink] No route found for link_type:', linkType);
      return null;
    }

    try {
      return route.getUrl(notification);
    } catch (error) {
      console.error('[DeepLink] Error generating URL:', error);
      return null;
    }
  }

  /**
   * Infer link type from notification type
   */
  inferLinkTypeFromNotifType(notifType) {
    const typeMap = {
      'DUE_SOON': 'borrowing',
      'OVERDUE': 'borrowing',
      'BORROW_APPROVED': 'borrowing',
      'RETURNED': 'borrowing',
      'BORROW_REJECTED': 'borrowing',
      'NEW_BOOK': 'book',
      'BOOK_AVAILABLE': 'book',
      'BOOK_LOW_STOCK': 'book',
      'NEW_USER': 'user',
      'NEW_ADMIN': 'admin',
      'AUDIT_EVENT': 'audit',
      'SYSTEM_UPDATE': 'system'
    };
    
    return typeMap[notifType] || null;
  }

  /**
   * Handle notification click
   * @param {Object} notification - Notification object
   * @param {Function} markAsReadCallback - Async function to mark as read
   */
  async handleNotificationClick(notification, markAsReadCallback) {
    console.log('[DeepLink]  Notification clicked in handleNotificationClick:', notification.id);

    // Get destination URL
    const url = this.getDestinationUrl(notification);
    console.log('[DeepLink] - Computed destination URL:', url);
    
    if (!url) {
      console.warn('[DeepLink] ⚠ No destination URL for notification - will not navigate');
      return;
    }

    try {
      // Mark as read (fire and forget, don't wait)
      if (markAsReadCallback && !notification.is_read) {
        markAsReadCallback(notification.id).catch(err => {
          console.error('[DeepLink] Failed to mark as read:', err);
        });
      }

      // Navigate to destination
      console.log('[DeepLink]  Navigating to:', url);
      window.location.href = url;
    } catch (error) {
      console.error('[DeepLink] Navigation error:', error);
    }
  }

  /**
   * Attach click handlers to notification items in dropdown
   * @param {HTMLElement} container - Container element with notification items
   * @param {Function} markAsReadCallback - Callback to mark notification as read
   */
  attachClickHandlers(container, markAsReadCallback) {
    if (!container) return;

    // Find all notification items
    const items = container.querySelectorAll('.notif-item');
    console.log('[DeepLink] 🔌 Attaching click handlers to', items.length, 'notification items (from notification-deeplink.js)');

    items.forEach(item => {
      const notifId = item.dataset.id;
      const notifData = item.dataset.notifData;
      
      if (!notifData) return;

      try {
        const notification = JSON.parse(notifData);
        
        // Make cursor pointer
        item.style.cursor = 'pointer';
        
        // Add click handler
        item.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('[DeepLink]  Click handler FIRED for notification:', notification.id);
          this.handleNotificationClick(notification, markAsReadCallback);
        });
      } catch (error) {
        console.error('[DeepLink] Error parsing notification data:', error);
      }
    });
  }
}

// Export singleton instance
window.notificationDeepLink = new NotificationDeepLink();
