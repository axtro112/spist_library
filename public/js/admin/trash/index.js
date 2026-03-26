/* ═══════════════════════════════════════════════
   Trash.init({ adminRole }) — page boot.
   Depends on: SafeFetch, TrashServices, TrashTable, TrashActions, TrashFilters.
   ═══════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ── toast ── */
  function showToast(message, type) {
    const COLORS = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed;top:20px;right:20px;padding:14px 22px;border-radius:10px',
      'color:#fff;font-size:14px;font-weight:500;z-index:9999',
      'box-shadow:0 4px 16px rgba(0,0,0,0.18);max-width:340px;white-space:pre-wrap',
      'animation:trashToastIn 0.25s ease',
    ].join(';');
    el.style.background = COLORS[type || 'info'] || COLORS.info;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'trashToastOut 0.25s ease forwards';
      setTimeout(() => el.remove(), 260);
    }, 3500);
  }

  /* ── bulk-bar state sync ── */
  function updateBulkBar() {
    const ids  = TrashTable.getSelectedIds();
    const n    = ids.length;
    const text = document.getElementById('trashSelectionText');
    const btnR = document.getElementById('trashBulkRestoreBtn');
    const btnD = document.getElementById('trashBulkDeleteBtn');
    if (text) text.textContent = n > 0 ? `${n} selected` : '';
    if (btnR) btnR.disabled = n === 0;
    if (btnD) btnD.disabled = n === 0;
  }

  /* ── load + render ── */
  async function loadAndRender(entity, filters) {
    TrashTable.setLoading();
    updateBulkBar();
    try {
      const items = await TrashServices.list(entity, filters);
      TrashTable.render(entity, items);
    } catch (err) {
      showToast(err.message || 'Failed to load trash.', 'error');
      TrashTable.render(entity, []);
    }
    updateBulkBar();
  }

  async function init(cfg) {
    const adminRole = (cfg && cfg.adminRole) || '';

    /* hide Users + Admins tabs for non-super-admin */
    if (adminRole !== 'super_admin') {
      const usersTab = document.querySelector('.trash-tab[data-entity="users"]');
      const adminTab = document.querySelector('.trash-tab[data-entity="admins"]');
      if (usersTab) usersTab.style.display = 'none';
      if (adminTab) adminTab.style.display = 'none';
    }

    let currentEntity = 'books';
    await loadAndRender(currentEntity, {});

    function reload() {
      loadAndRender(currentEntity, TrashFilters.getFilters());
    }

    TrashActions.init(reload, showToast);

    TrashFilters.setup(
      /* onTabChange */
      function (entity) {
        currentEntity = entity;
        loadAndRender(entity, TrashFilters.getFilters());
      },
      /* onFilterChange */
      function () {
        loadAndRender(currentEntity, TrashFilters.getFilters());
      }
    );

    /* event delegation — table row actions */
    const wrap = document.getElementById('trashTableWrap');
    if (wrap) {
      wrap.addEventListener('change', function (e) {
        if (e.target.classList.contains('trash-row-cb')) {
          TrashTable.updateMasterCb();
          updateBulkBar();
        }
      });
      wrap.addEventListener('click', function (e) {
        const restoreBtn = e.target.closest('.trash-btn-restore');
        if (restoreBtn) {
          TrashActions.restoreSingle(restoreBtn.dataset.entity, restoreBtn.dataset.id);
          return;
        }
        const deleteBtn = e.target.closest('.trash-btn-delete');
        if (deleteBtn) {
          TrashActions.deleteSingle(deleteBtn.dataset.entity, deleteBtn.dataset.id, deleteBtn.dataset.name);
        }
      });
    }

    /* master checkbox */
    const masterCb = document.getElementById('trashMasterCb');
    if (masterCb) {
      masterCb.addEventListener('change', function () {
        document.querySelectorAll('.trash-row-cb').forEach(cb => { cb.checked = this.checked; });
        updateBulkBar();
      });
    }

    /* bulk action buttons */
    document.getElementById('trashBulkRestoreBtn')?.addEventListener('click', function () {
      TrashActions.bulkRestore(currentEntity, TrashTable.getSelectedIds());
    });
    document.getElementById('trashBulkDeleteBtn')?.addEventListener('click', function () {
      TrashActions.bulkDelete(currentEntity, TrashTable.getSelectedIds());
    });
  }

  global.Trash = { init };

})(window);
