/**
 * Authentication Helper Module
 * Centralized auth data management to prevent role/user data conflicts
 */

const AuthHelper = {
  _syncInFlight: null,

  _readCookie(name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : '';
  },

  _hydrateFromCookies() {
    const adminRoleCookie = this._readCookie('adminRole');
    if (adminRoleCookie && !sessionStorage.getItem('adminRole')) {
      sessionStorage.setItem('adminRole', adminRoleCookie);
    }

    const adminNameCookie = this._readCookie('adminName');
    if (adminNameCookie && !sessionStorage.getItem('userName')) {
      sessionStorage.setItem('userName', adminNameCookie);
    }

    const adminEmailCookie = this._readCookie('adminEmail');
    if (adminEmailCookie && !sessionStorage.getItem('adminEmail')) {
      sessionStorage.setItem('adminEmail', adminEmailCookie);
    }

    if (adminRoleCookie) {
      if (sessionStorage.getItem('isLoggedIn') !== 'true') sessionStorage.setItem('isLoggedIn', 'true');
      if (!sessionStorage.getItem('userRole')) sessionStorage.setItem('userRole', 'admin');
    }
  },

  /**
   * Get current authenticated user data from sessionStorage
   * @returns {Object} User session data
   */
  getSession() {
    this._hydrateFromCookies();

    return {
      isLoggedIn: sessionStorage.getItem("isLoggedIn") === "true",
      userRole: sessionStorage.getItem("userRole"),
      adminRole: sessionStorage.getItem("adminRole"),
      adminId: sessionStorage.getItem("adminId"),
      studentId: sessionStorage.getItem("studentId"),
    };
  },

  /**
   * Recover admin session markers from server session when storage is stale.
   * @returns {Promise<Object|null>} recovered user object or null
   */
  async ensureAdminSessionFromServer() {
    const current = this.getSession();
    if (current.isLoggedIn && current.userRole === 'admin' && current.adminId) {
      return {
        id: Number(current.adminId),
        role: current.adminRole || '',
      };
    }

    if (this._syncInFlight) {
      return this._syncInFlight;
    }

    this._syncInFlight = (async () => {
      try {
        const response = await fetch('/api/debug/session', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          keepalive: true
        });

        if (!response.ok) return null;
        const payload = await response.json().catch(() => null);
        const user = payload && payload.sessionData && payload.sessionData.user;

        if (!user || user.userRole !== 'admin' || !user.id) {
          return null;
        }

        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('userRole', 'admin');
        sessionStorage.setItem('adminId', String(user.id));
        if (user.role) sessionStorage.setItem('adminRole', user.role);
        if (user.email) sessionStorage.setItem('adminEmail', user.email);
        if (user.fullname) sessionStorage.setItem('userName', user.fullname);

        return user;
      } catch (_) {
        return null;
      } finally {
        this._syncInFlight = null;
      }
    })();

    return this._syncInFlight;
  },

  /**
   * Fetch current admin data from API and validate against session
   * @returns {Promise<Object>} Admin data from API
   */
  async fetchCurrentAdmin() {
    let session = this.getSession();
    
    if (!session.isLoggedIn || session.userRole !== "admin" || !session.adminId) {
      await this.ensureAdminSessionFromServer();
      session = this.getSession();
    }

    if (!session.isLoggedIn || session.userRole !== "admin" || !session.adminId) {
      throw new Error("Not authenticated as admin");
    }

    console.log('[AuthHelper] Fetching admin data for ID:', session.adminId);
    
    try {
      const doFetch = typeof fetchWithCsrf === 'function' ? fetchWithCsrf : fetch;
      const response = await doFetch(`/api/admin/${session.adminId}`, { credentials: 'include' });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Session expired — not authenticated at all
          this.clearSession();
          window.location.href = "/login";
          throw new Error("Session expired. Please log in again.");
        }
        if (response.status === 403) {
          // Authenticated but access denied — do NOT log the user out
          throw new Error("Access denied. You do not have permission to perform this action.");
        }
        throw new Error(`Failed to fetch admin data: ${response.status}`);
      }

      const result = await response.json();
      const adminData = result.data || result;

      // Validate that API data matches session data
      if (adminData.id !== parseInt(session.adminId)) {
        console.error('[AuthHelper] Data mismatch! Session adminId:', session.adminId, 'API returned:', adminData.id);
        this.clearSession();
        window.location.href = "/login";
        throw new Error("Session data mismatch");
      }

      // Update sessionStorage with fresh role data from API (in case it changed)
      if (adminData.role !== session.adminRole) {
        console.warn('[AuthHelper] Role changed from', session.adminRole, 'to', adminData.role, '- updating session');
        sessionStorage.setItem("adminRole", adminData.role);
      }

      console.log('[AuthHelper] Admin data validated:', {
        id: adminData.id,
        email: adminData.email,
        role: adminData.role
      });

      return adminData;
    } catch (error) {
      console.error('[AuthHelper] Error fetching admin data:', error);
      throw error;
    }
  },

  /**
   * Update header with admin information
   * @param {Object} adminData - Admin data from API
   */
  updateAdminHeader(adminData) {
    const elements = {
      name: document.getElementById("adminName"),
      email: document.getElementById("adminEmail"),
      role: document.getElementById("adminRole"),
      initial: document.getElementById("adminInitial"),
    };

    if (elements.name) {
      elements.name.textContent = adminData.fullname || "Admin User";
    }
    
    if (elements.email) {
      elements.email.textContent = adminData.email || "";
    }
    
    if (elements.role) {
      const roleDisplay = adminData.role === 'super_admin' ? 'Super Admin' : 'System Admin';
      elements.role.textContent = roleDisplay;
      console.log('[AuthHelper] Header role set to:', roleDisplay);
    }
    
    if (elements.initial && adminData.fullname) {
      elements.initial.textContent = adminData.fullname.charAt(0).toUpperCase();
    }
  },

  /**
   * Clear all session data (for logout)
   */
  clearSession() {
    console.log('[AuthHelper] Clearing all session data');
    const isTimeoutLogout = sessionStorage.getItem('timeout-logout') === 'true';
    sessionStorage.clear();
    if (isTimeoutLogout) {
      sessionStorage.setItem('timeout-logout', 'true');
    }
  },

  /**
   * Check if current user has super admin role
   * @returns {boolean}
   */
  isSuperAdmin() {
    return this.getSession().adminRole === "super_admin";
  },

  /**
   * Check if current user has system admin role
   * @returns {boolean}
   */
  isSystemAdmin() {
    return this.getSession().adminRole === "system_admin";
  },

  /**
   * Logout and redirect to login page
   */
  async logout() {
    try {
      // Call logout API if available
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' }
      }).catch(() => {
        // Ignore errors, just clear session
      });
    } finally {
      this.clearSession();
      window.location.href = "/login";
    }
  }
};

// Make available globally
window.AuthHelper = AuthHelper;
