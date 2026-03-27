/* ═══════════════════════════════════════════════
   Super Admin — Users Trash Page
   window.SuperAdmin.UsersTrashPage.init()
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

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

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
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:40px;color:#666;"><i class="bi bi-trash" style="font-size:48px;display:block;margin-bottom:16px;opacity:0.5;"></i><strong>No users in trash</strong><br><span style="font-size:14px;">Deleted users will appear here</span></td></tr>';
      return;
    }

    items.forEach(item => {
      const hasBorrowingHistory = item.has_borrowing_history === 1;
      const canPermanentDelete  = !hasBorrowingHistory;
      const historyIcon = hasBorrowingHistory
        ? '<span class="material-symbols-outlined" style="color:#f59e0b;" title="Has borrowing history">history</span>'
        : '<span class="material-symbols-outlined" style="color:#10b981;" title="No borrowing history">check_circle</span>';
      const restoreBtn = `<button onclick="SuperAdmin.UsersTrashPage.restore(${item.id}, '${escapeHtml(item.fullname)}')" class="btn-restore" title="Restore"><span class="material-symbols-outlined">restore_from_trash</span></button>`;
      const deleteBtn  = `<button onclick="SuperAdmin.UsersTrashPage.permanentDelete(${item.id}, '${escapeHtml(item.fullname)}', ${hasBorrowingHistory})" class="btn-delete" title="${canPermanentDelete ? 'Delete Permanently' : 'Cannot delete: has borrowing history'}" ${!canPermanentDelete ? 'disabled' : ''}><span class="material-symbols-outlined">delete_forever</span></button>`;

      const row = document.createElement('tr');
      row.innerHTML =
        `<td class="checkbox-col"><input type="checkbox" class="row-checkbox" data-id="${item.id}" ${!canPermanentDelete ? 'disabled title="Cannot delete: has borrowing history"' : ''} onchange="SuperAdmin.UsersTrashPage._onCheck()"></td>` +
        `<td>${item.id}</td>` +
        `<td>${escapeHtml(item.student_id || 'N/A')}</td>` +
        `<td>${escapeHtml(item.fullname)}</td>` +
        `<td>${escapeHtml(item.email)}</td>` +
        `<td>${escapeHtml(item.department || 'N/A')}</td>` +
        `<td>${escapeHtml(item.year_level || 'N/A')}</td>` +
        `<td><span class="status-badge status-${item.status.toLowerCase()}">${item.status}</span></td>` +
        `<td>${formatDate(item.deleted_at)}</td>` +
        `<td>${historyIcon}</td>` +
        `<td class="action-buttons">${restoreBtn}${deleteBtn}</td>`;
      tbody.appendChild(row);
    });
  }

  /* ── data loader ── */
  async function loadTrash() {
    try {
      const filters = {};
      const search     = document.getElementById('searchInput')?.value;
      const department = document.getElementById('departmentFilter')?.value;
      const yearLevel  = document.getElementById('yearLevelFilter')?.value;
      const status     = document.getElementById('statusFilter')?.value;
      if (search)     filters.search     = search;
      if (department) filters.department = department;
      if (yearLevel)  filters.year_level = yearLevel;
      if (status)     filters.status     = status;
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
    if (text) { text.textContent = count > 0 ? `${count} user${count > 1 ? 's' : ''} selected` : ''; text.style.display = count > 0 ? 'inline' : 'none'; }
  }

  function _onCheck() {
    const checkboxes = document.querySelectorAll('.row-checkbox:not(:disabled)');
    selectedIds.clear();
    checkboxes.forEach(cb => { if (cb.checked) selectedIds.add(parseInt(cb.dataset.id)); });
    const masterCb   = document.getElementById('bulkMasterCheckbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    const someChecked= Array.from(checkboxes).some(cb => cb.checked);
    if (masterCb) { masterCb.checked = allChecked; masterCb.indeterminate = someChecked && !allChecked; }
    updateBulkButtons();
  }

  function setupFilters() {
    const ids   = ['searchInput','departmentFilter','yearLevelFilter','statusFilter'];
    const clear = document.getElementById('clearFilters');
    let t;
    const searchEl = document.getElementById('searchInput');
    if (searchEl) searchEl.addEventListener('input', () => { clearTimeout(t); t = setTimeout(loadTrash, 300); });
    ['departmentFilter','yearLevelFilter','statusFilter'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', loadTrash);
    });
    if (clear) clear.addEventListener('click', () => {
      ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      loadTrash();
    });
  }

  function setupBulkOps() {
    const masterCb = document.getElementById('bulkMasterCheckbox');
    if (masterCb) {
      masterCb.addEventListener('change', function () {
        document.querySelectorAll('.row-checkbox:not(:disabled)').forEach(cb => {
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
    const confirmRestore = await showAppConfirm(
      `Restore ${count} user${count > 1 ? 's' : ''}? They will be able to access the system again.`,
      'Restore Users',
      'Restore',
      'Cancel'
    );
    if (!confirmRestore) return;
    let ok = 0, fail = 0;
    for (const id of selectedIds) { if (await trashManager.restore(id)) ok++; else fail++; }
    if (ok)   showToast(`${ok} user${ok > 1 ? 's' : ''} restored successfully!`, 'success');
    if (fail) showToast(`${fail} user${fail > 1 ? 's' : ''} failed to restore`, 'error');
    await loadTrash();
  }

  async function bulkDelete() {
    const count = selectedIds.size;
    if (!count) return;
    const confirmDelete = await showAppConfirm(
      `Permanently delete ${count} user${count > 1 ? 's' : ''}? Only users without borrowing history can be deleted. This action cannot be undone.`,
      'Permanent Delete',
      'Delete Forever',
      'Cancel'
    );
    if (!confirmDelete) return;
    const typed = await showAppPrompt('Type DELETE to confirm this permanent action.', 'Final Confirmation', '', 'DELETE', 'Continue', 'Cancel');
    if (typed !== 'DELETE') return;
    let ok = 0, fail = 0;
    for (const id of selectedIds) { if (await trashManager.permanentDelete(id)) ok++; else fail++; }
    if (ok)   showToast(`${ok} user${ok > 1 ? 's' : ''} permanently deleted`, 'success');
    if (fail) showToast(`${fail} user${fail > 1 ? 's' : ''} failed to delete (may have borrowing history)`, 'warning');
    await loadTrash();
  }

  /* ── public actions ── */
  async function restore(id, name) {
    const confirmRestore = await showAppConfirm(
      `Restore user "${name}"? They will be able to access the system again.`,
      'Restore User',
      'Restore',
      'Cancel'
    );
    if (!confirmRestore) return;
    if (await trashManager.restore(id)) { showToast('User restored successfully!', 'success'); await loadTrash(); }
  }

  async function permanentDelete(id, name, hasBorrowingHistory) {
    if (hasBorrowingHistory) {
      alert('⚠️ Cannot permanently delete this user.\n\nThis user has borrowing history in the system. For data integrity and audit purposes, users with borrowing records cannot be permanently deleted.');
      return;
    }
    const confirmDelete = await showAppConfirm(
      `Permanently delete user "${name}"? This action cannot be undone.`,
      'Permanent Delete',
      'Delete Forever',
      'Cancel'
    );
    if (!confirmDelete) return;
    const typed = await showAppPrompt('Type DELETE to confirm this permanent action.', 'Final Confirmation', '', 'DELETE', 'Continue', 'Cancel');
    if (typed !== 'DELETE') return;
    if (await trashManager.permanentDelete(id)) { showToast('User permanently deleted', 'success'); await loadTrash(); }
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

    trashManager = new TrashManager('users', '/api/admin/users');
    await loadTrash();
    setupFilters();
    setupBulkOps();
  }

  /* ── namespace ── */
  SA.UsersTrashPage = { init, restore, permanentDelete, _onCheck };

})(window.SuperAdmin = window.SuperAdmin || {});
