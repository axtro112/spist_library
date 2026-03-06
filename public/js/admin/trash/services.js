/* ═══════════════════════════════════════════════
   TrashServices — API layer for unified trash page.
   All calls go to /api/admin/trash/:entity endpoints.
   Depends on: SafeFetch (safeFetch.js)
   ═══════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const BASE = '/api/admin/trash';

  global.TrashServices = {

    /** List trashed items for an entity. Returns array. */
    async list(entity, filters) {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(filters || {}).filter(([, v]) => v !== '' && v != null))
      ).toString();
      const url = `${BASE}/${entity}` + (qs ? `?${qs}` : '');
      const r = await SafeFetch.get(url);
      if (!r.ok || !r.data?.success) throw new Error(r.data?.message || `Failed to load ${entity} trash`);
      return r.data.data;
    },

    /** Restore a single item (id in body). Returns { ok, message }. */
    async restore(entity, id) {
      const r = await SafeFetch.post(`${BASE}/${entity}/restore`, { id });
      return { ok: r.ok && r.data?.success === true, message: r.data?.message || '' };
    },

    /** Permanently delete a single item (id in body). Returns { ok, message }. */
    async permanentDelete(entity, id) {
      const r = await SafeFetch.delete(`${BASE}/${entity}/permanent`, { id });
      return { ok: r.ok && r.data?.success === true, message: r.data?.message || '' };
    },

    /** Bulk restore by ids[]. Returns { ok, restoredCount, message }. */
    async bulkRestore(entity, ids) {
      const r = await SafeFetch.post(`${BASE}/${entity}/bulk-restore`, { ids });
      return { ok: r.ok && r.data?.success === true, restoredCount: r.data?.restoredCount || 0, message: r.data?.message || '' };
    },

    /** Bulk permanent delete by ids[]. Returns { ok, deletedCount, message }. */
    async bulkPermanentDelete(entity, ids) {
      const r = await SafeFetch.delete(`${BASE}/${entity}/bulk-permanent`, { ids });
      return { ok: r.ok && r.data?.success === true, deletedCount: r.data?.deletedCount || 0, message: r.data?.message || '' };
    },

  };

})(window);
