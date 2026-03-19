/**
 * Notification Modal Module
 * Opens notification targets inside a modal instead of navigating away.
 * Matches login/signup green theme.
 * 
 * SINGLE SOURCE OF TRUTH: activeDeepLink stores the current notification context
 * to prevent stale data and wrong student/borrowing mapping.
 */

// Global state - single source of truth for current notification context
let activeDeepLink = null;

class NotificationModal {
  constructor() {
    this.overlayId = 'notifModalOverlay';
    this.modalId = 'notifModalShell';
    this.titleId = 'notifModalTitle';
    this.bodyId = 'notifModalBody';
    this.footerId = 'notifModalFooter';
    this.previousBodyOverflow = '';

    this.injectStyles();
    this.ensureModalElement();
    this.bindGlobalClose();
  }

  injectStyles() {
    if (document.getElementById('notif-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'notif-modal-styles';
    style.textContent = `
      .notif-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 16px;
      }
      .notif-modal {
        background: #ffffff;
        border-radius: 12px;
        width: min(720px, 95vw);
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 18px 50px rgba(0,0,0,0.15);
        border: 1px solid #e0e0e0;
        overflow: hidden;
        position: relative;
      }
      .notif-modal__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        background: linear-gradient(135deg, #43a047, #2e7d32);
        color: #fff;
      }
      .notif-modal__title {
        font-size: 18px;
        font-weight: 700;
      }
      .notif-modal__close {
        background: rgba(255,255,255,0.2);
        color: #fff;
        border: none;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        font-size: 20px;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      .notif-modal__close:hover {
        background: rgba(255,255,255,0.3);
      }
      .notif-modal__body {
        padding: 20px;
        overflow-y: auto;
        background: #fafafa;
        flex: 1;
      }
      .notif-modal__footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 14px 20px;
        background: #f5f5f5;
        border-top: 1px solid #e0e0e0;
      }
      .notif-modal__btn {
        border: none;
        border-radius: 8px;
        padding: 10px 16px;
        font-size: 14px;
        cursor: pointer;
        transition: transform 0.1s ease, box-shadow 0.2s ease;
      }
      .notif-modal__btn-primary {
        background: linear-gradient(135deg, #43a047, #2e7d32);
        color: #fff;
        box-shadow: 0 6px 16px rgba(67, 160, 71, 0.3);
      }
      .notif-modal__btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 24px rgba(67, 160, 71, 0.35);
      }
      .notif-modal__btn-secondary {
        background: #ffffff;
        color: #2e7d32;
        border: 1px solid rgba(46, 125, 50, 0.25);
      }
      .notif-modal__btn-secondary:hover {
        background: #f1f8e9;
      }
      .notif-field {
        display: grid;
        grid-template-columns: 160px 1fr;
        gap: 10px;
        padding: 10px 12px;
        background: #fff;
        border: 1px solid #e0e0e0;
        border-radius: 10px;
        margin-bottom: 10px;
      }
      .notif-field__label {
        font-weight: 600;
        color: #2e7d32;
      }
      .notif-field__value {
        color: #333;
        line-height: 1.5;
      }
      .notif-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
      }
      .notif-badge.due-soon {
        background: #fff3cd;
        color: #8c6d1f;
        border: 1px solid #ffecb5;
      }
      .notif-badge.overdue {
        background: #ffebee;
        color: #c62828;
        border: 1px solid #ffcdd2;
      }
      .notif-loading {
        text-align: center;
        padding: 30px 10px;
        color: #2e7d32;
      }
      .notif-spinner {
        width: 38px;
        height: 38px;
        border: 3px solid #e0e0e0;
        border-top-color: #43a047;
        border-radius: 50%;
        margin: 0 auto 12px;
        animation: notif-spin 1s linear infinite;
      }
      @keyframes notif-spin {
        to { transform: rotate(360deg); }
      }
      @media (max-width: 640px) {
        .notif-field { grid-template-columns: 1fr; }
        .notif-modal__header, .notif-modal__footer { padding: 14px 16px; }
      }
    `;

    document.head.appendChild(style);
  }

  ensureModalElement() {
    if (document.getElementById(this.overlayId)) return;

    const overlay = document.createElement('div');
    overlay.id = this.overlayId;
    overlay.className = 'notif-modal-overlay';
    overlay.innerHTML = `
      <div class="notif-modal" id="${this.modalId}" role="dialog" aria-modal="true" aria-labelledby="${this.titleId}">
        <div class="notif-modal__header">
          <div class="notif-modal__title" id="${this.titleId}">Notification</div>
          <button class="notif-modal__close" aria-label="Close notification modal">&times;</button>
        </div>
        <div class="notif-modal__body" id="${this.bodyId}"></div>
        <div class="notif-modal__footer" id="${this.footerId}"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
      }
    });
  }

  bindGlobalClose() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });

    const closeBtn = this.getCloseButton();
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }
  }

  getOverlay() {
    return document.getElementById(this.overlayId);
  }

  getCloseButton() {
    const overlay = this.getOverlay();
    return overlay ? overlay.querySelector('.notif-modal__close') : null;
  }

  open() {
    const overlay = this.getOverlay();
    if (!overlay) return;
    
    // Close the notification dropdown when opening modal (UX improvement)
    if (typeof notificationManager !== 'undefined' && notificationManager) {
      notificationManager.closeDropdown();
      console.log('[Notif Modal] Closed notification dropdown before opening modal');
    }
    
    overlay.style.display = 'flex';
    this.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  close() {
    const overlay = this.getOverlay();
    if (!overlay) return;
    overlay.style.display = 'none';
    document.body.style.overflow = this.previousBodyOverflow || '';
  }

  showLoading(title = 'Loading...') {
    this.renderModal(title, `
      <div class="notif-loading">
        <div class="notif-spinner"></div>
        <div>Loading details...</div>
      </div>
    `, this.renderFooterButtons());
    this.open();
  }

  showError(message) {
    this.renderModal('Notification', `
      <div class="notif-loading" style="color: #c62828;">
        <span class="material-symbols-outlined" style="font-size: 32px; vertical-align: middle;">error</span>
        <div style="margin-top: 8px;">${this.escapeHtml(message || 'This notification item could not be loaded.')}</div>
      </div>
    `, this.renderFooterButtons());
    this.open();
  }

  attachClickHandlers(container, markAsReadFn) {
    if (!container) {
      console.log('[NotifModal] ⚠ No container provided to attachClickHandlers');
      return;
    }
    
    // Get the notification panel (parent of the list)
    const panel = container.closest('.student-notif-panel') || 
                  container.closest('.notif-panel') ||
                  document.getElementById('studentNotifPanel') ||
                  document.getElementById('adminNotifPanel') ||
                  document.getElementById('superAdminNotifPanel');
                  
    if (!panel) {
      console.error('[NotifModal] Could not find notification panel');
      return;
    }
    
    // Use event delegation on the panel so clicks anywhere in the dropdown are caught
    panel.addEventListener('click', async (e) => {
      // Find the closest .notif-item parent
      const item = e.target.closest('.notif-item');
      if (!item) {
        return;
      }
      
      // CRITICAL: Stop propagation FIRST before processing
      e.preventDefault();
      e.stopPropagation();
      
      // Parse notification data from dataset
      const notif = this.parseNotificationData(item.dataset.notifData);
      if (!notif) {
        console.error('[NotifModal] Failed to parse notification data');
        this.showError('This notification item could not be loaded.');
        return;
      }

      // ── USER-SIDE ROUTER ─────────────────────────────────────────────────
      // Students clicking DUE_SOON or OVERDUE go directly to /user/due-books.
      // No admin modal, no admin routes.
      const _currentRole = this.getRoleContext();
      const _rawType = (notif.type || '').toUpperCase();
      if (_currentRole === 'student' &&
          (_rawType === 'DUE_SOON' || _rawType === 'OVERDUE')) {
        if (markAsReadFn && notif.id) {
          markAsReadFn(notif.id).catch(() => {});
        }
        window.location.assign('/student-borrowed');
        return;
      }
      // ─────────────────────────────────────────────────────────────────────
      activeDeepLink = {
        notificationId: notif.id,
        type: notif.type,
        // Entity payload with stable IDs
        entity: {
          studentId: notif.target_id || notif.student_id,
          borrowingId: notif.borrowing_id,
          bookId: notif.book_id,
          bookTitle: notif.book_title
        },
        // Full notification for context
        notification: notif
      };

      console.log('[NotifModal]  Active Deep Link Set:', {
        notificationId: activeDeepLink.notificationId,
        type: activeDeepLink.type,
        studentId: activeDeepLink.entity.studentId,
        borrowingId: activeDeepLink.entity.borrowingId,
        bookId: activeDeepLink.entity.bookId
      });

      // === STEP 2: DETERMINE LINK TYPE FROM NOTIFICATION ===
      // Priority: deep_link_type > link_type > inferred from type
      let linkType = (notif.deep_link_type || notif.link_type || '').toLowerCase();
      let linkId = notif.deep_link_id || notif.link_id;

      // OVERDUE/DUE_SOON: prefer borrowing_id if available
      const notifType = (notif.type || '').toLowerCase();
      if (notifType.includes('overdue') || notifType.includes('due')) {
        if (activeDeepLink.entity.borrowingId) {
          linkType = 'borrowing';
          linkId = activeDeepLink.entity.borrowingId;
        } else if (activeDeepLink.entity.studentId) {
          linkType = 'student';
          linkId = activeDeepLink.entity.studentId;
        }
      }

      // Fallback: infer from notification type
      if (!linkType) {
        linkType = this.inferLinkType(notif.type);
      }

      // Final fallback: use target type
      if (!linkType && notif.target_type) {
        linkType = notif.target_type.toLowerCase();
      }

      // Use entity IDs as final fallback for linkId
      if (!linkId) {
        if (linkType === 'borrowing') linkId = activeDeepLink.entity.borrowingId;
        else if (linkType === 'student' || linkType === 'user') linkId = activeDeepLink.entity.studentId;
        else if (linkType === 'book') linkId = activeDeepLink.entity.bookId;
      }

      console.log('[NotifModal] 📍 Deep Link Resolved:', {
        linkType,
        linkId,
        from: {
          deep_link_type: notif.deep_link_type,
          deep_link_id: notif.deep_link_id,
          borrowing_id: notif.borrowing_id,
          target_id: notif.target_id
        }
      });

      if (!linkId) {
        console.error('[NotifModal] ✗ Missing deep link id', { notif, activeDeepLink });
        this.showError('Unable to open this notification (missing target).');
        return;
      }

      // === STEP 3: MARK AS READ ===
      if (markAsReadFn && notif.id) {
        try {
          await markAsReadFn(notif.id);
        } catch (err) {
          console.warn('[NotifModal] Mark-as-read failed (continuing):', err);
        }
      }

      // === STEP 4: ROUTE TO APPROPRIATE HANDLER ===
      try {
        await this.openNotificationDeepLink(linkType, linkId);
      } catch (err) {
        console.error('[NotifModal] ✗ Error handling click', err);
        this.showError('This notification item could not be loaded.');
      }
    }); // End of container event delegation listener
  }

  parseNotificationData(raw) {
    if (!raw) return null;
    try {
      // dataset stores &quot; encoded
      const normalized = raw.replace(/&quot;/g, '"');
      return JSON.parse(normalized);
    } catch (err) {
      console.warn('[Notif Modal] Failed to parse notif data', err);
      return null;
    }
  }

  /**
   * CENTRALIZED DEEP LINK ROUTER
   * Single entry point for all notification clicks
   * Routes based on linkType and uses activeDeepLink state
   */
  async openNotificationDeepLink(linkType, linkId) {
    console.log('[openNotificationDeepLink] 🚀 Routing:', { linkType, linkId, activeDeepLink });

    if (!activeDeepLink) {
      console.error('[openNotificationDeepLink] No active deep link state!');
      this.showError('Unable to open this notification.');
      return;
    }

    // Route based on link type
    switch (linkType) {
      case 'student':
      case 'user':
        await this.handleStudentLink(linkId);
        break;

      case 'borrowing':
      case 'loan':
        await this.handleBorrowingLink(linkId);
        break;

      case 'book':
        await this.handleBookLink(linkId);
        break;

      default:
        // Fallback: open generic modal using activeDeepLink
        await this.openFromActiveDeepLink(linkType, linkId);
    }
  }

  async openFromNotification(notification) {
    const title = notification.title || notification.type || 'Notification';
    this.showLoading(title);

    try {
      const detail = await this.fetchTargetDetails(notification);
      const linkType = (notification.link_type || this.inferLinkType(notification.type) || '').toLowerCase();

      if (!detail) {
        this.showError('This notification item could not be loaded.');
        return;
      }

      const bodyHtml = this.renderBodyContent(linkType, detail);
      const footerHtml = this.renderFooterButtons(linkType, notification);
      this.renderModal(title, bodyHtml, footerHtml);
      this.open();
    } catch (err) {
      console.error('[Notif Modal] Failed to fetch details', err);
      this.showError('This notification item could not be loaded.');
    }
  }

  async fetchTargetDetails(notification) {
    const linkType = (notification.link_type || this.inferLinkType(notification.type) || '').toLowerCase();
    const linkId = notification.link_id || notification.related_id;

    if (!linkType || !linkId) {
      throw new Error('Missing link_type or link_id');
    }

    let url = null;
    switch (linkType) {
      case 'book':
        url = `/api/books/${linkId}`;
        break;
      case 'borrowing':
      case 'loan':
        url = `/api/book-borrowings/detail/${linkId}`;
        break;
      case 'student':
      case 'user':
        url = `/api/students/${linkId}`;
        break;
      case 'admin':
        url = `/api/admin/${linkId}`;
        break;
      default:
        throw new Error(`Unknown link_type: ${linkType}`);
    }

    console.log('[fetchTargetDetails]  API Request:', {
      linkType,
      linkId,
      url,
      activeDeepLink: activeDeepLink ? {
        studentId: activeDeepLink.entity?.studentId,
        borrowingId: activeDeepLink.entity?.borrowingId,
        bookId: activeDeepLink.entity?.bookId
      } : null
    });

    const response = await fetchWithCsrf(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'API error');
    }

    const result = data.data || data.result || data.notification || null;
    
    console.log('[fetchTargetDetails] ✓ Fetched:', {
      linkType,
      linkId,
      hasResult: !!result,
      resultKeys: result ? Object.keys(result).slice(0, 5) : []
    });

    return result;
  }

  renderModal(title, bodyHtml, footerHtml) {
    const overlay = this.getOverlay();
    if (!overlay) return;

    const titleEl = overlay.querySelector(`#${this.titleId}`);
    const bodyEl = overlay.querySelector(`#${this.bodyId}`);
    const footerEl = overlay.querySelector(`#${this.footerId}`);

    if (titleEl) titleEl.textContent = title || 'Notification';
    if (bodyEl) bodyEl.innerHTML = bodyHtml || '';
    if (footerEl) footerEl.innerHTML = footerHtml || '';
  }

  renderBodyContent(linkType, detail) {
    switch (linkType) {
      case 'book':
        return this.renderFields([
          ['Title', detail.title],
          ['Author', detail.author],
          ['Category', detail.category],
          ['ISBN', detail.isbn],
          ['Quantity', `${detail.available_quantity ?? detail.quantity ?? '-'} / ${detail.quantity ?? '-'}`],
          ['Status', detail.status],
          ['Description', detail.description || '—'],
        ]);
      case 'borrowing': {
        const statusBadge = this.renderBorrowStatus(detail.due_date, detail.return_date, detail.status);
        return this.renderFields([
          ['Book', detail.title || `Book #${detail.book_id}`],
          ['Student', detail.student_id],
          ['Borrowed On', this.formatDate(detail.borrow_date)],
          ['Due Date', `${this.formatDate(detail.due_date)} ${statusBadge}`],
          ['Return Date', detail.return_date ? this.formatDate(detail.return_date) : 'Not returned'],
          ['Status', detail.status],
          ['Approved By', detail.approved_by_name || detail.approved_by || '—'],
          ['Notes', detail.notes || '—'],
        ]);
      }
      case 'student':
      case 'user':
        return this.renderFields([
          ['Name', detail.fullname],
          ['Student ID', detail.student_id || detail.id],
          ['Email', detail.email],
          ['Department', detail.department],
          ['Year Level', detail.year_level],
          ['Status', detail.status],
          ['Contact', detail.contact_number || '—'],
        ]);
      case 'admin':
        return this.renderFields([
          ['Name', detail.fullname],
          ['Email', detail.email],
          ['Role', this.formatAdminRole(detail.role)],
          ['Created', this.formatDate(detail.created_at)],
        ]);
      default:
        return '<div class="notif-loading">This notification item could not be loaded.</div>';
    }
  }

  renderFields(pairs) {
    return pairs
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([label, value]) => `
        <div class="notif-field">
          <div class="notif-field__label">${this.escapeHtml(label)}</div>
          <div class="notif-field__value">${typeof value === 'string' ? value : this.escapeHtml(String(value))}</div>
        </div>
      `)
      .join('');
  }

  renderBorrowStatus(dueDate, returnDate, status) {
    if (!dueDate) return '';
    const now = new Date();
    const due = new Date(dueDate);
    if (returnDate) return '';

    const diff = due.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0 || (status && String(status).toLowerCase() === 'overdue')) {
      return '<span class="notif-badge overdue">Overdue</span>';
    }
    if (days <= 2) {
      return '<span class="notif-badge due-soon">Due Soon</span>';
    }
    return '';
  }

  /**
   * Handle student/user deep links
   * Uses activeDeepLink.entity.studentId to ensure correct student
   */
  async handleStudentLink(linkId) {
    if (!activeDeepLink) {
      console.error('[handleStudentLink] No active deep link!');
      return;
    }

    const role = this.getRoleContext();
    const notifType = (activeDeepLink.type || '').toLowerCase();
    const studentId = activeDeepLink.entity.studentId || linkId;

    console.log('[handleStudentLink]  Opening student:', {
      studentId,
      role,
      notificationType: activeDeepLink.type,
      hasViolation: notifType.includes('overdue') || notifType.includes('due')
    });

    // Admin/Super-admin: navigate to users page with deep link
    if (role === 'super_admin' || role === 'admin') {
      const basePath = role === 'super_admin' ? '/super-admin-users' : '/admin-users';
      
      // For overdue/due notifications: open violations modal
      if (notifType.includes('overdue') || notifType.includes('due')) {
        console.log('[handleStudentLink] → Navigating to violations for:', studentId);
        window.location.href = `${basePath}?openViolations=${studentId}`;
        return;
      }
      
      // For other student notifications: open user modal
      console.log('[handleStudentLink] → Navigating to user modal for:', studentId);
      window.location.href = `${basePath}?openUser=${studentId}`;
      return;
    }

    // Student or fallback: use available modals
    if (window.notificationUserModal) {
      window.notificationUserModal.open(studentId, activeDeepLink.notification);
      return;
    }
    if (window.openUserModal) {
      window.openUserModal(studentId);
      return;
    }

    // Final fallback: generic modal with activeDeepLink context
    await this.openFromActiveDeepLink('student', studentId);
  }

  /**
   * Handle borrowing/loan deep links
   * Uses activeDeepLink.entity.borrowingId to fetch correct borrowing
   */
  async handleBorrowingLink(linkId) {
    if (!activeDeepLink) {
      console.error('[handleBorrowingLink] No active deep link!');
      return;
    }

    const borrowingId = activeDeepLink.entity.borrowingId || linkId;
    const studentId = activeDeepLink.entity.studentId;

    console.log('[handleBorrowingLink]  Opening borrowing:', {
      borrowingId,
      studentId,
      bookTitle: activeDeepLink.entity.bookTitle
    });

    // If a dedicated borrowing modal exists, use it (student side likely)
    if (window.userBorrowingModal && window.userBorrowingModal.open) {
      console.log('[handleBorrowingLink] → Using userBorrowingModal');
      window.userBorrowingModal.open(borrowingId, activeDeepLink.notification);
      return;
    }

    // For admins: navigate to student violations (borrowings are shown there)
    const role = this.getRoleContext();
    if (role === 'super_admin' || role === 'admin') {
      const basePath = role === 'super_admin' ? '/super-admin-users' : '/admin-users';
      
      // Use studentId to open violations modal which will show the borrowing
      if (studentId) {
        console.log('[handleBorrowingLink] → Navigating to violations for student:', studentId);
        window.location.href = `${basePath}?openViolations=${studentId}`;
        return;
      }
      
      // Fallback: open users page without query param
      console.warn('[handleBorrowingLink] No studentId, opening users page');
      window.location.href = basePath;
      return;
    }

    // Fallback: open generic modal with borrowing details
    await this.openFromActiveDeepLink('borrowing', borrowingId);
  }

  /**
   * Handle book deep links
   */
  async handleBookLink(linkId) {
    if (!activeDeepLink) {
      console.error('[handleBookLink] No active deep link!');
      return;
    }

    const bookId = activeDeepLink.entity.bookId || linkId;
    console.log('[handleBookLink]  Opening book:', bookId);

    // Check for book modal
    if (window.openBookModal) {
      window.openBookModal(bookId);
      return;
    }

    // Fallback: navigate to books page
    const role = this.getRoleContext();
    const booksPath = role === 'student' ? '/student-books' : 
                     role === 'super_admin' ? '/super-admin-books' : 
                     '/admin-books';
    window.location.href = `${booksPath}?bookId=${bookId}`;
  }

  /**
   * Open modal using activeDeepLink context
   * Fetches data using IDs from activeDeepLink.entity
   */
  async openFromActiveDeepLink(linkType, linkId) {
    if (!activeDeepLink) {
      this.showError('Unable to open this notification.');
      return;
    }

    const title = activeDeepLink.notification.title || activeDeepLink.type || 'Notification';
    this.showLoading(title);

    try {
      console.log('[openFromActiveDeepLink] Fetching:', { linkType, linkId, entity: activeDeepLink.entity });
      
      const detail = await this.fetchTargetDetails({
        link_type: linkType,
        link_id: linkId,
        ...activeDeepLink.notification
      });

      if (!detail) {
        this.showError('This notification item could not be loaded.');
        return;
      }

      const bodyHtml = this.renderBodyContent(linkType, detail);
      const footerHtml = this.renderFooterButtons(linkType, activeDeepLink.notification);
      this.renderModal(title, bodyHtml, footerHtml);
      this.open();
    } catch (err) {
      console.error('[openFromActiveDeepLink] Failed to fetch details', err);
      this.showError('This notification item could not be loaded.');
    }
  }

  renderFooterButtons(linkType = null, notification = {}) {
    const primary = this.buildPrimaryAction(linkType, notification);
    const closeBtn = `<button class="notif-modal__btn notif-modal__btn-secondary" type="button" id="notifModalCloseBtn">Close</button>`;
    const footerHtml = `${primary || ''}${closeBtn}`;

    setTimeout(() => {
      const overlay = this.getOverlay();
      const closeButton = overlay ? overlay.querySelector('#notifModalCloseBtn') : null;
      if (closeButton) {
        closeButton.addEventListener('click', () => this.close());
      }
      const primaryBtn = overlay ? overlay.querySelector('#notifModalPrimaryBtn') : null;
      if (primaryBtn && primaryBtn.dataset.href) {
        primaryBtn.addEventListener('click', () => {
          window.location.href = primaryBtn.dataset.href;
        });
      }
    }, 0);

    return footerHtml;
  }

  buildPrimaryAction(linkType, notification) {
    const role = this.getRoleContext();
    let href = null;
    let label = null;

    switch (linkType) {
      case 'book':
        label = 'View in Books Page';
        href = role === 'student' ? '/student-books' : role === 'super_admin' ? '/super-admin-books' : '/admin-books';
        break;
      case 'borrowing':
        label = 'View User Details';
        // For admins: navigate to Users page with student ID to show violations modal
        if (role === 'super_admin' || role === 'admin') {
          const studentId = notification.target_id || notification.student_id;
          const basePath = role === 'super_admin' ? '/super-admin-users' : '/admin-users';
          href = studentId ? `${basePath}?openViolations=${studentId}` : basePath;
        } else {
          // Students: go to due-books page
          href = '/student-borrowed';
          label = 'View Borrowed Books';
        }
        break;
      case 'student':
      case 'user':
        if (role === 'student') {
          label = 'View Borrowed Books';
          href = '/student-borrowed';
        } else {
          label = 'Go to User Profile';
          href = role === 'super_admin' ? '/super-admin-users' : '/admin-users';
        }
        break;
      case 'admin':
        label = 'Go to Admins';
        href = '/super-admin-admins';
        break;
      default:
        break;
    }

    if (!href || !label) return '';

    return `<button class="notif-modal__btn notif-modal__btn-primary" type="button" id="notifModalPrimaryBtn" data-href="${href}">${label}</button>`;
  }

  inferLinkType(type) {
    if (!type) return null;
    const t = type.toLowerCase();
    if (t.includes('borrow') || t.includes('due') || t.includes('overdue')) return 'borrowing';
    if (t.includes('book')) return 'book';
    if (t.includes('admin')) return 'admin';
    if (t.includes('user') || t.includes('student')) return 'student';
    return null;
  }

  getRoleContext() {
    // 1. data-role on body (set by user-side EJS layouts)
    const bodyRole = document.body && document.body.dataset.role;
    if (bodyRole) return bodyRole;
    // 2. window.USER_ROLE if explicitly set
    if (window.USER_ROLE) return window.USER_ROLE;
    // 3. sessionStorage (set by login.js)
    const role = sessionStorage.getItem('userRole');
    const adminRole = sessionStorage.getItem('adminRole');
    if (role === 'student') return 'student';
    if (role === 'admin' && adminRole === 'super_admin') return 'super_admin';
    if (role === 'admin') return 'admin';
    // 4. URL prefix fallback
    const path = window.location.pathname;
    if (path.startsWith('/user/') || path.startsWith('/student-')) return 'student';
    if (path.startsWith('/super-admin')) return 'super_admin';
    if (path.startsWith('/admin')) return 'admin';
    return 'guest';
  }

  formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatAdminRole(role) {
    if (!role) return '—';
    const r = String(role);
    if (r === 'super_admin') return 'Super Admin';
    if (r === 'system_admin') return 'System Admin';
    return r;
  }

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

window.notificationModal = new NotificationModal();
