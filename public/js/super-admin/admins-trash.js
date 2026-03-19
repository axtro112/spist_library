/* ═══════════════════════════════════════════════
   Super Admin — Admins Trash Page
   window.SuperAdmin.AdminsTrashPage.init()
   ═══════════════════════════════════════════════ */
(function (SA) {
  'use strict';

  let trashManager;
  let selectedIds = new Set();

  /* ── helpers ── */
  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const h = d.getHours(), m = d.getMinutes().toString().padStart(2,'0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${h % 12 || 12}:${m} ${ampm}`;
  }

  function formatRole(role) { return role === 'super_admin' ? 'Super Admin' : 'System Admin'; }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /* ── modal helpers ── */
  const TrashModals = {
    _resolve: null,

    confirmDanger(message) {
      return new Promise(resolve => {
        this._resolve = resolve;
        const modal      = document.getElementById('trashDangerModal');
        const msgEl      = document.getElementById('trashDangerMessage');
        const input      = document.getElementById('trashDeleteConfirmInput');
        const confirmBtn = document.getElementById('trashDangerConfirmBtn');
        msgEl.innerHTML  = message;
        input.value      = '';
        confirmBtn.disabled = true;
        modal.classList.add('show');
        setTimeout(() => input.focus(), 60);
      });
    },

    confirmRestore(message) {
      return new Promise(resolve => {
        this._resolve = resolve;
        const modal = document.getElementById('trashRestoreModal');
        const msgEl = document.getElementById('trashRestoreMessage');
        msgEl.innerHTML = message;
        modal.classList.add('show');
      });
    },

    _closeAll() {
      document.getElementById('trashDangerModal')?.classList.remove('show');
      document.getElementById('trashRestoreModal')?.classList.remove('show');
    },

    _settle(result) {
      this._closeAll();
      if (this._resolve) { this._resolve(result); this._resolve = null; }
    },

    initEvents() {
      const dangerInput    = document.getElementById('trashDeleteConfirmInput');
      const dangerConfirm  = document.getElementById('trashDangerConfirmBtn');
      const dangerCancel   = document.getElementById('trashDangerCancelBtn');
      const dangerClose    = document.getElementById('trashDangerClose');
      const dangerModal    = document.getElementById('trashDangerModal');
      const restoreConfirm = document.getElementById('trashRestoreConfirmBtn');
      const restoreCancel  = document.getElementById('trashRestoreCancelBtn');
      const restoreClose   = document.getElementById('trashRestoreClose');
      const restoreModal   = document.getElementById('trashRestoreModal');

      dangerInput?.addEventListener('input', () => {
        if (dangerConfirm) dangerConfirm.disabled = dangerInput.value.trim() !== 'DELETE';
      });
      dangerConfirm?.addEventListener('click', () => { if (!dangerConfirm.disabled) this._settle(true); });
      dangerCancel?.addEventListener('click',  () => this._settle(false));
      dangerClose?.addEventListener('click',   () => this._settle(false));
      dangerModal?.addEventListener('click',   e => { if (e.target === dangerModal) this._settle(false); });

      restoreConfirm?.addEventListener('click', () => this._settle(true));
      restoreCancel?.addEventListener('click',  () => this._settle(false));
      restoreClose?.addEventListener('click',   () => this._settle(false));
      restoreModal?.addEventListener('click',   e => { if (e.target === restoreModal) this._settle(false); });
    }
  };

  function showToast(message, type = 'info') {
    const COLORS = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;top:20px;right:20px;padding:16px 24px;border-radius:8px;color:white;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:10000;animation:slideInRight 0.3s ease;';
    toast.style.backgroundColor = COLORS[type] || COLORS.info;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'slideOutRight 0.3s ease'; setTimeout(() => toast.remove(), 300); }, 3000);
  }

  /* ── display ── */
  function displayTrash(items) {
    const tbody = document.querySelector('.user-table tbody');
    tbody.innerHTML = '';
    selectedIds.clear();
    updateBulkButtons();

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:#666;"><i class="bi bi-trash" style="font-size:48px;display:block;margin-bottom:16px;opacity:0.5;"></i><strong>No admins in trash</strong><br><span style="font-size:14px;">Deleted admins will appear here</span></td></tr>';
      return;
    }

    items.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML =
        `<td class="checkbox-col"><input type="checkbox" class="row-checkbox" data-id="${item.id}" onchange="SuperAdmin.AdminsTrashPage._onCheck()"></td>` +
        `<td>${item.id}</td>` +
        `<td>${escapeHtml(item.fullname)}</td>` +
        `<td>${escapeHtml(item.email)}</td>` +
        `<td><span class="role-badge role-${item.role.replace('_', '-')}">${formatRole(item.role)}</span></td>` +
        `<td>${formatDate(item.created_at)}</td>` +
        `<td>${formatDate(item.deleted_at)}</td>` +
        `<td><span class="status-badge status-${item.is_active ? 'active' : 'inactive'}">${item.is_active ? 'Active' : 'Inactive'}</span></td>` +
        `<td class="action-buttons">` +
          `<button onclick="SuperAdmin.AdminsTrashPage.restore(${item.id}, '${escapeHtml(item.fullname)}')" class="btn-restore" title="Restore"><i class="bi bi-arrow-counterclockwise"></i></button>` +
          `<button onclick="SuperAdmin.AdminsTrashPage.permanentDelete(${item.id}, '${escapeHtml(item.fullname)}')" class="btn-delete" title="Delete Permanently"><i class="bi bi-trash3-fill"></i></button>` +
        `</td>`;
      tbody.appendChild(row);
    });
  }

  /* ── data loader ── */
  async function loadTrash() {
    try {
      const filters = {};
      const search = document.getElementById('searchInput')?.value;
      const role   = document.getElementById('roleFilter')?.value;
      if (search) filters.search = search;
      if (role)   filters.role   = role;
      const items = await trashManager.loadTrash(filters);
      displayTrash(items);
    } catch (e) {
      console.error('Error loading trash:', e);
      showToast('Failed to load trash. Please try again.', 'error');
    }
  }

  /* ── bulk ops ── */
  function updateBulkButtons() {
    const count = selectedIds.size;
    const restore = document.getElementById('bulkRestoreBtn');
    const del     = document.getElementById('bulkDeleteBtn');
    const text    = document.getElementById('bulkSelectionText');
    if (restore) restore.disabled = count === 0;
    if (del)     del.disabled     = count === 0;
    if (text) { text.textContent = count > 0 ? `${count} admin${count > 1 ? 's' : ''} selected` : ''; text.style.display = count > 0 ? 'inline' : 'none'; }
  }

  function _onCheck() {
    const checkboxes = document.querySelectorAll('.row-checkbox');
    selectedIds.clear();
    checkboxes.forEach(cb => { if (cb.checked) selectedIds.add(parseInt(cb.dataset.id)); });
    const masterCb   = document.getElementById('bulkMasterCheckbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    const someChecked= Array.from(checkboxes).some(cb => cb.checked);
    if (masterCb) { masterCb.checked = allChecked; masterCb.indeterminate = someChecked && !allChecked; }
    updateBulkButtons();
  }

  function setupFilters() {
    const searchInput = document.getElementById('searchInput');
    const roleFilter  = document.getElementById('roleFilter');
    const clearButton = document.getElementById('clearFilters');
    let t;
    if (searchInput)  searchInput.addEventListener('input', () => { clearTimeout(t); t = setTimeout(loadTrash, 300); });
    if (roleFilter)   roleFilter.addEventListener('change', loadTrash);
    if (clearButton)  clearButton.addEventListener('click', () => { searchInput.value = ''; roleFilter.value = ''; loadTrash(); });
  }

  function setupBulkOps() {
    const masterCb = document.getElementById('bulkMasterCheckbox');
    if (masterCb) {
      masterCb.addEventListener('change', function () {
        document.querySelectorAll('.row-checkbox').forEach(cb => {
          cb.checked = this.checked;
          if (this.checked) selectedIds.add(parseInt(cb.dataset.id));
          else selectedIds.delete(parseInt(cb.dataset.id));
        });
        updateBulkButtons();
      });
    }
    document.getElementById('bulkRestoreBtn')?.addEventListener('click', bulkRestore);
    document.getElementById('bulkDeleteBtn')?.addEventListener('click', bulkDelete);
  }

  async function bulkRestore() {
    const count = selectedIds.size;
    if (!count) return;
    const confirmed = await TrashModals.confirmRestore(
      `Restore <strong>${count} admin${count > 1 ? 's' : ''}</strong>? They will be able to access the admin panel again.`
    );
    if (!confirmed) return;
    let ok = 0, fail = 0;
    for (const id of selectedIds) { if (await trashManager.restore(id)) ok++; else fail++; }
    if (ok)   showToast(`${ok} admin${ok > 1 ? 's' : ''} restored successfully!`, 'success');
    if (fail) showToast(`${fail} admin${fail > 1 ? 's' : ''} failed to restore`, 'error');
    await loadTrash();
  }

  async function bulkDelete() {
    const count = selectedIds.size;
    if (!count) return;
    const confirmed = await TrashModals.confirmDanger(
      `Permanently delete <strong>${count} admin${count > 1 ? 's' : ''}</strong>? All selected admin accounts will be removed forever.`
    );
    if (!confirmed) return;
    let ok = 0, fail = 0;
    for (const id of selectedIds) { if (await trashManager.permanentDelete(id)) ok++; else fail++; }
    if (ok)   showToast(`${ok} admin${ok > 1 ? 's' : ''} permanently deleted`, 'success');
    if (fail) showToast(`${fail} admin${fail > 1 ? 's' : ''} failed to delete`, 'error');
    await loadTrash();
  }

  /* ── public actions ── */
  async function restore(id, name) {
    const confirmed = await TrashModals.confirmRestore(
      `Restore <strong>${escapeHtml(name)}</strong>? They will be able to access the admin panel again.`
    );
    if (!confirmed) return;
    if (await trashManager.restore(id)) { showToast('Admin restored successfully!', 'success'); await loadTrash(); }
  }

  async function permanentDelete(id, name) {
    const confirmed = await TrashModals.confirmDanger(
      `Permanently delete <strong>${escapeHtml(name)}</strong>? The admin account will be removed forever.`
    );
    if (!confirmed) return;
    if (await trashManager.permanentDelete(id)) { showToast('Admin permanently deleted', 'success'); await loadTrash(); }
  }

  /* ── init ── */
  async function init() {
    const s = SA.utils.getSession();
    if (!s || s.adminRole !== 'super_admin') {
      alert('Access denied. Super Admin privileges required.');
      window.location.href = '/login';
      return;
    }
    
    // Extended delay to ensure backend session is fully loaded from store
    // on hard refresh (100ms gives enough time for MySQL session store)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    SA.utils.loadAdminHeader(s.adminId);

    trashManager = new TrashManager('admins', '/api/admin/admins');
    await loadTrash();
    setupFilters();
    setupBulkOps();
    TrashModals.initEvents();
  }

  /* ── namespace ── */
  SA.AdminsTrashPage = { init, restore, permanentDelete, _onCheck };

})(window.SuperAdmin = window.SuperAdmin || {});
