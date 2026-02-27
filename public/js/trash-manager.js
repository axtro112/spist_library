// Trash Management JavaScript Module
// Handles soft delete, restore, and permanent delete operations
// Used by Books, Users, and Admins trash pages

class TrashManager {
  constructor(entityType, apiEndpoint) {
    this.entityType = entityType; // 'books', 'users', or 'admins'
    this.apiEndpoint = apiEndpoint;
    this.allItems = [];
    this.filteredItems = [];
  }

  // Load trashed items
  async loadTrash(filters = {}) {
    try {
      const params = new URLSearchParams(filters);
      const queryString = params.toString();
      const url = `${this.apiEndpoint}/trash${queryString ? '?' + queryString : ''}`;
      
      const response = await fetch(url, {
        credentials: 'include'
      });
      const result = await response.json();
      
      if (result.success) {
        this.allItems = result.data || [];
        this.filteredItems = this.allItems;
        console.log(`[Trash] Loaded ${this.allItems.length} ${this.entityType}`);
        return this.allItems;
      } else {
        throw new Error(result.message || 'Failed to load trash');
      }
    } catch (error) {
      console.error(`[Trash] Error loading ${this.entityType}:`, error);
      this.showToast(error.message || 'Error loading trash', 'error');
      return [];
    }
  }

  // Soft delete (move to trash)
  async softDelete(id) {
    try {
      const response = await fetch(`${this.apiEndpoint}/${id}/soft-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.showToast(`${this.capitalize(this.entityType)} moved to trash`, 'success');
        return true;
      } else {
        throw new Error(result.message || 'Failed to move to trash');
      }
    } catch (error) {
      console.error(`[Trash] Error soft deleting:`, error);
      this.showToast(error.message || 'Error moving to trash', 'error');
      return false;
    }
  }

  // Restore from trash
  async restore(id) {
    try {
      const response = await fetch(`${this.apiEndpoint}/${id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.showToast(`${this.capitalize(this.entityType)} restored successfully`, 'success');
        return true;
      } else {
        throw new Error(result.message || 'Failed to restore');
      }
    } catch (error) {
      console.error(`[Trash] Error restoring:`, error);
      this.showToast(error.message || 'Error restoring item', 'error');
      return false;
    }
  }

  // Permanent delete
  async permanentDelete(id) {
    try {
      const response = await fetch(`${this.apiEndpoint}/${id}/permanent-delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.showToast(`${this.capitalize(this.entityType)} permanently deleted`, 'success');
        return true;
      } else {
        throw new Error(result.message || 'Failed to permanently delete');
      }
    } catch (error) {
      console.error(`[Trash] Error permanently deleting:`, error);
      this.showToast(error.message || 'Error permanently deleting', 'error');
      return false;
    }
  }

  // Format date
  formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Escape HTML to prevent XSS
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Capitalize first letter
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Show toast notification
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer') || document.body;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      animation: slideInRight 0.3s ease-out;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    switch(type) {
      case 'success':
        toast.style.background = '#10b981';
        break;
      case 'error':
        toast.style.background = '#ef4444';
        break;
      case 'warning':
        toast.style.background = '#f59e0b';
        break;
      default:
        toast.style.background = '#3b82f6';
    }
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Confirm dialog
  showConfirm(message, onConfirm) {
    if (confirm(message)) {
      onConfirm();
    }
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TrashManager;
}
