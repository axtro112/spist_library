/* ═══════════════════════════════════════════════
   TrashManager — shared utility used by all three
   trash page JS files (books, users, admins).
   ═══════════════════════════════════════════════ */
class TrashManager {
  constructor(entityType, apiEndpoint) {
    this.entityType = entityType;
    this.apiEndpoint = apiEndpoint;
  }

  /* Returns array of trashed items or throws on error */
  async loadTrash(filters = {}) {
    const params = new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined))
    ).toString();
    const url = `${this.apiEndpoint}/trash${params ? '?' + params : ''}`;
    const res = await fetch(url, { credentials: 'include' });
    if (res.status === 401 || res.status === 403) {
      // Session expired or role mismatch — force re-login
      sessionStorage.clear();
      window.location.href = '/login';
      throw new Error('Session expired. Redirecting to login...');
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    if (!result.success) throw new Error(result.message || 'Failed to load trash');
    return result.data;
  }

  /* Returns true on success, false on failure */
  async restore(id) {
    try {
      const doFetch = typeof fetchWithCsrf === 'function' ? fetchWithCsrf : fetch;
      const res = await doFetch(`${this.apiEndpoint}/${id}/restore`, {
        method: 'POST',
        credentials: 'include'
      });
      const result = await res.json();
      return !!result.success;
    } catch (e) {
      console.error(`[TrashManager] restore error:`, e);
      return false;
    }
  }

  /* Returns true on success, false on failure */
  async permanentDelete(id) {
    try {
      const doFetch = typeof fetchWithCsrf === 'function' ? fetchWithCsrf : fetch;
      const res = await doFetch(`${this.apiEndpoint}/${id}/permanent-delete`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const result = await res.json();
      return !!result.success;
    } catch (e) {
      console.error(`[TrashManager] permanentDelete error:`, e);
      return false;
    }
  }
}
