/**
 * Authentication Helper Module
 * Centralized auth data management to prevent role/user data conflicts
 */

const AuthHelper = {
  /**
   * Get current authenticated user data from sessionStorage
   * @returns {Object} User session data
   */
  getSession() {
    return {
      isLoggedIn: sessionStorage.getItem("isLoggedIn") === "true",
      userRole: sessionStorage.getItem("userRole"),
      adminRole: sessionStorage.getItem("adminRole"),
      adminId: sessionStorage.getItem("adminId"),
      studentId: sessionStorage.getItem("studentId"),
    };
  },

  /**
   * Fetch current admin data from API and validate against session
   * @returns {Promise<Object>} Admin data from API
   */
  async fetchCurrentAdmin() {
    const session = this.getSession();
    
    if (!session.isLoggedIn || session.userRole !== "admin" || !session.adminId) {
      throw new Error("Not authenticated as admin");
    }

    console.log('[AuthHelper] Fetching admin data for ID:', session.adminId);
    
    try {
      const response = await fetch(`/api/admin/${session.adminId}`);
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // Session expired or invalid
          this.clearSession();
          window.location.href = "/login";
          throw new Error("Session expired. Please log in again.");
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
    sessionStorage.clear();
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
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {
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
