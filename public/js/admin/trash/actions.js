/* ═══════════════════════════════════════════════
   TrashActions — single + bulk restore/delete.
   Depends on: TrashServices, TrashTable.
   ═══════════════════════════════════════════════ */
(function (global) {
  'use strict';

  let _reload = null;
  let _toast  = null;
  let _restoreModalBound = false;
  let _deleteConfirmModalBound = false;
  let _deleteTypeModalBound = false;

  function toast(msg, type) {
    if (typeof _toast === 'function') return _toast(msg, type || 'info');
  }

  function bindRestoreModalEvents(modal, confirmBtn, cancelBtn, closeBtn) {
    if (_restoreModalBound) return;
    _restoreModalBound = true;

    function closeWith(result) {
      modal.classList.remove('show');
      document.body.classList.remove('modal-open');
      if (typeof modal._resolve === 'function') {
        const resolve = modal._resolve;
        modal._resolve = null;
        resolve(result);
      }
    }

    confirmBtn?.addEventListener('click', function () { closeWith(true); });
    cancelBtn?.addEventListener('click', function () { closeWith(false); });
    closeBtn?.addEventListener('click', function () { closeWith(false); });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeWith(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('show')) closeWith(false);
    });
  }

  function confirmRestoreWithModal(message) {
    const modal = document.getElementById('trashRestoreModal');
    const messageEl = document.getElementById('trashRestoreMessage');
    const confirmBtn = document.getElementById('trashRestoreConfirmBtn');
    const cancelBtn = document.getElementById('trashRestoreCancelBtn');
    const closeBtn = document.getElementById('trashRestoreClose');

    if (!modal || !messageEl || !confirmBtn || !cancelBtn) {
      return Promise.resolve(confirm(message));
    }

    bindRestoreModalEvents(modal, confirmBtn, cancelBtn, closeBtn);
    messageEl.textContent = message;
    modal.classList.add('show');
    document.body.classList.add('modal-open');
    confirmBtn.focus();

    return new Promise(function (resolve) {
      modal._resolve = resolve;
    });
  }

  function bindDeleteConfirmModalEvents(modal, confirmBtn, cancelBtn, closeBtn) {
    if (_deleteConfirmModalBound) return;
    _deleteConfirmModalBound = true;

    function closeWith(result) {
      modal.classList.remove('show');
      document.body.classList.remove('modal-open');
      if (typeof modal._resolve === 'function') {
        const resolve = modal._resolve;
        modal._resolve = null;
        resolve(result);
      }
    }

    confirmBtn?.addEventListener('click', function () { closeWith(true); });
    cancelBtn?.addEventListener('click', function () { closeWith(false); });
    closeBtn?.addEventListener('click', function () { closeWith(false); });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeWith(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('show')) closeWith(false);
    });
  }

  function confirmDeleteWithModal(message) {
    const modal = document.getElementById('trashDeleteConfirmModal');
    const messageEl = document.getElementById('trashDeleteConfirmMessage');
    const confirmBtn = document.getElementById('trashDeleteConfirmBtn');
    const cancelBtn = document.getElementById('trashDeleteCancelBtn');
    const closeBtn = document.getElementById('trashDeleteClose');

    if (!modal || !messageEl || !confirmBtn || !cancelBtn) {
      return Promise.resolve(confirm(message));
    }

    bindDeleteConfirmModalEvents(modal, confirmBtn, cancelBtn, closeBtn);
    messageEl.textContent = message;
    modal.classList.add('show');
    document.body.classList.add('modal-open');
    confirmBtn.focus();

    return new Promise(function (resolve) {
      modal._resolve = resolve;
    });
  }

  function bindDeleteTypeModalEvents(modal, confirmBtn, cancelBtn, closeBtn, input) {
    if (_deleteTypeModalBound) return;
    _deleteTypeModalBound = true;

    function closeWith(result) {
      modal.classList.remove('show');
      document.body.classList.remove('modal-open');
      if (typeof modal._resolve === 'function') {
        const resolve = modal._resolve;
        modal._resolve = null;
        resolve(result);
      }
    }

    function syncConfirmState() {
      const value = (input?.value || '').trim();
      if (confirmBtn) confirmBtn.disabled = value !== 'DELETE';
    }

    input?.addEventListener('input', syncConfirmState);
    confirmBtn?.addEventListener('click', function () { closeWith((input?.value || '').trim()); });
    cancelBtn?.addEventListener('click', function () { closeWith(null); });
    closeBtn?.addEventListener('click', function () { closeWith(null); });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeWith(null);
    });
    document.addEventListener('keydown', function (e) {
      if (!modal.classList.contains('show')) return;
      if (e.key === 'Escape') closeWith(null);
      if (e.key === 'Enter' && !confirmBtn?.disabled) {
        closeWith((input?.value || '').trim());
      }
    });
  }

  function promptDeleteWordWithModal() {
    const modal = document.getElementById('trashDeleteTypeModal');
    const input = document.getElementById('trashDeleteTypeInput');
    const confirmBtn = document.getElementById('trashDeleteTypeConfirmBtn');
    const cancelBtn = document.getElementById('trashDeleteTypeCancelBtn');
    const closeBtn = document.getElementById('trashDeleteTypeClose');

    if (!modal || !input || !confirmBtn || !cancelBtn) {
      return Promise.resolve(prompt('Type DELETE to confirm:'));
    }

    bindDeleteTypeModalEvents(modal, confirmBtn, cancelBtn, closeBtn, input);
    input.value = '';
    confirmBtn.disabled = true;
    modal.classList.add('show');
    document.body.classList.add('modal-open');
    input.focus();

    return new Promise(function (resolve) {
      modal._resolve = resolve;
    });
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
    const confirmed = await confirmDeleteWithModal(`Permanently delete "${name}"?\n\nThis CANNOT be undone.`);
    if (!confirmed) return;
    const typed = await promptDeleteWordWithModal();
    if (typed !== 'DELETE') { toast('Cancelled.', 'info'); return; }
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
    const confirmed = await confirmRestoreWithModal(`Restore ${n} selected item${n > 1 ? 's' : ''}?`);
    if (!confirmed) return;
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
    const confirmed = await confirmDeleteWithModal(`PERMANENTLY DELETE ${n} selected item${n > 1 ? 's' : ''}?\n\nThis CANNOT be undone.`);
    if (!confirmed) return;
    const typed = await promptDeleteWordWithModal();
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
