/* ═══════════════════════════════════════════════
   TrashActions — single + bulk restore/delete.
   Depends on: TrashServices, TrashTable.
   ═══════════════════════════════════════════════ */
(function (global) {
  'use strict';

  let _reload = null;
  let _toast  = null;

  function toast(msg, type) {
    if (typeof _toast === 'function') return _toast(msg, type || 'info');
  }

  /* ── single restore ── */
  async function restoreSingle(entity, id) {
    const result = await TrashServices.restore(entity, id);
    if (result.ok) {
      toast('Item restored successfully!', 'success');
      if (_reload) _reload();
    } else {
      toast(result.message || 'Failed to restore item.', 'error');
    }
  }

  /* ── single permanent delete ── */
  async function deleteSingle(entity, id, name) {
    if (!confirm(`Permanently delete "${name}"?\n\nThis CANNOT be undone.`)) return;
    const typed = prompt('Type DELETE to confirm:');
    if (typed !== 'DELETE') { toast('Cancalled.', 'info'); return; }
    const result = await TrashServices.permanentDelete(entity, id);
    if (result.ok) {
      toast('Item permanently deleted.', 'success');
      if (_reload) _reload();
    } else {
      toast(result.message || 'Failed to permanently delete.', 'error');
    }
  }

  /* ── bulk restore ── */
  async function bulkRestore(entity, ids) {
    const n = ids.length;
    if (!n) return;
    if (!confirm(`Restore ${n} selected item${n > 1 ? 's' : ''}?`)) return;
    const btn = document.getElementById('trashBulkRestoreBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Restoring…'; }
    const result = await TrashServices.bulkRestore(entity, ids);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-arrow-counterclockwise me-1"></i>Restore'; }
    if (result.ok) {
      const cnt = result.restoredCount || n;
      toast(`${cnt} item${cnt > 1 ? 's' : ''} restored!`, 'success');
      TrashTable.clearSelection();
      if (_reload) _reload();
    } else {
      toast(result.message || 'Bulk restore failed.', 'error');
    }
  }

  /* ── bulk permanent delete ── */
  async function bulkDelete(entity, ids) {
    const n = ids.length;
    if (!n) return;
    if (!confirm(`PERMANENTLY DELETE ${n} selected item${n > 1 ? 's' : ''}?\n\nThis CANNOT be undone.`)) return;
    const typed = prompt('Type DELETE to confirm:');
    if (typed !== 'DELETE') { toast('Cancelled.', 'info'); return; }
    const btn = document.getElementById('trashBulkDeleteBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Deleting…'; }
    const result = await TrashServices.bulkPermanentDelete(entity, ids);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-trash3-fill me-1"></i>Delete Forever'; }
    if (result.ok) {
      const cnt = result.deletedCount || n;
      toast(`${cnt} item${cnt > 1 ? 's' : ''} permanently deleted.`, 'success');
      TrashTable.clearSelection();
      if (_reload) _reload();
    } else {
      toast(result.message || 'Bulk deletion failed.', 'error');
    }
  }

  global.TrashActions = {
    init(reloadFn, toastFn) { _reload = reloadFn; _toast = toastFn; },
    restoreSingle,
    deleteSingle,
    bulkRestore,
    bulkDelete,
  };

})(window);
