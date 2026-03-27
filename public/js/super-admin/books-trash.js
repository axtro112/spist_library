/* ═══════════════════════════════════════════════
   Super Admin — Books Trash Page
   window.SuperAdmin.BooksTrashPage.init()
   ═══════════════════════════════════════════════ */
(function (SA) {
  'use strict';

  let trashManager;
  let selectedIds = new Set();
  let booksTrashCategoryLastRefreshAt = 0;
  let booksTrashCategoryRefreshing = false;
  const BOOKS_TRASH_CATEGORY_REFRESH_MS = 15000;

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
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:#666;"><i class="bi bi-trash" style="font-size:48px;display:block;margin-bottom:16px;opacity:0.5;"></i><strong>No books in trash</strong><br><span style="font-size:14px;">Deleted books will appear here</span></td></tr>';
      return;
    }

    items.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML =
        `<td class="checkbox-col"><input type="checkbox" class="row-checkbox" data-id="${item.id}" onchange="SuperAdmin.BooksTrashPage._onCheck()"></td>` +
        `<td>${item.id}</td>` +
        `<td>${escapeHtml(item.title)}</td>` +
        `<td>${escapeHtml(item.author)}</td>` +
        `<td>${item.total_copies || 0}</td>` +
        `<td>${escapeHtml(item.category || 'N/A')}</td>` +
        `<td>${escapeHtml(item.isbn || 'N/A')}</td>` +
        `<td>${formatDate(item.deleted_at)}</td>` +
        `<td>${escapeHtml(item.added_by_name || 'Unknown')}</td>` +
        `<td class="action-buttons">` +
          `<button onclick="SuperAdmin.BooksTrashPage.restore(${item.id}, '${escapeHtml(item.title)}')" class="btn-restore" title="Restore"><i class="bi bi-arrow-counterclockwise"></i></button>` +
          `<button onclick="SuperAdmin.BooksTrashPage.permanentDelete(${item.id}, '${escapeHtml(item.title)}')" class="btn-delete" title="Delete Permanently"><i class="bi bi-trash3-fill"></i></button>` +
        `</td>`;
      tbody.appendChild(row);
    });
  }

  /* ── data loaders ── */
  async function loadTrash() {
    try {
      const filters = {};
      const search   = document.getElementById('searchInput')?.value;
      const category = document.getElementById('categoryFilter')?.value;
      if (search)   filters.search   = search;
      if (category) filters.category = category;
      const items = await trashManager.loadTrash(filters);
      displayTrash(items);
    } catch (e) {
      console.error('Error loading trash:', e);
      showToast('Failed to load trash. Please try again.', 'error');
    }
  }

  async function loadCategories() {
    try {
      const res = await fetch('/api/books/categories?ts=' + Date.now());
      if (!res.ok) return;
      const result = await res.json();
      const cats = result.data || result;
      const select = document.getElementById('categoryFilter');
      if (!select) return;
      const currentValue = select.value || '';
      const categoryValues = [];
      select.innerHTML = '<option value="">All Categories</option>';
      if (Array.isArray(cats)) {
        cats.forEach(c => {
          if (c.category) {
            const opt = document.createElement('option');
            opt.value = c.category; opt.textContent = c.category;
            if (currentValue && currentValue === c.category) opt.selected = true;
            select.appendChild(opt);
            categoryValues.push(c.category);
          }
        });
      }

      if (currentValue && !categoryValues.includes(currentValue)) {
        select.value = '';
      }

      booksTrashCategoryLastRefreshAt = Date.now();
    } catch (e) { console.error('Error loading categories:', e); }
  }

  async function refreshCategoriesIfNeeded(force) {
    const isStale = (Date.now() - booksTrashCategoryLastRefreshAt) > BOOKS_TRASH_CATEGORY_REFRESH_MS;
    if (!force && !isStale) return;
    if (booksTrashCategoryRefreshing) return;

    booksTrashCategoryRefreshing = true;
    try {
      await loadCategories();
    } finally {
      booksTrashCategoryRefreshing = false;
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
    if (text) {
      text.textContent    = count > 0 ? `${count} book${count > 1 ? 's' : ''} selected` : '';
      text.style.display  = count > 0 ? 'inline' : 'none';
    }
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
    const searchInput    = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const clearButton    = document.getElementById('clearFilters');
    let t;
    if (searchInput)    searchInput.addEventListener('input', () => { clearTimeout(t); t = setTimeout(loadTrash, 300); });
    if (categoryFilter) {
      categoryFilter.addEventListener('change', loadTrash);
      categoryFilter.addEventListener('focus', () => { refreshCategoriesIfNeeded(true); });
      categoryFilter.addEventListener('mousedown', () => { refreshCategoriesIfNeeded(true); });
    }
    if (clearButton)    clearButton.addEventListener('click', () => { searchInput.value = ''; categoryFilter.value = ''; loadTrash(); });
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
    const confirmRestore = await showAppConfirm(
      `Restore ${count} book${count > 1 ? 's' : ''}? They will return to the main books list.`,
      'Restore Books',
      'Restore',
      'Cancel'
    );
    if (!confirmRestore) return;
    let ok = 0, fail = 0;
    for (const id of selectedIds) { if (await trashManager.restore(id)) ok++; else fail++; }
    if (ok)   showToast(`${ok} book${ok > 1 ? 's' : ''} restored successfully!`, 'success');
    if (fail) showToast(`${fail} book${fail > 1 ? 's' : ''} failed to restore`, 'error');
    await loadTrash();
  }

  async function bulkDelete() {
    const count = selectedIds.size;
    if (!count) return;
    const confirmDelete = await showAppConfirm(
      `Permanently delete ${count} book${count > 1 ? 's' : ''}? This action cannot be undone.`,
      'Permanent Delete',
      'Delete Forever',
      'Cancel'
    );
    if (!confirmDelete) return;
    const typed = await showAppPrompt('Type DELETE to confirm this permanent action.', 'Final Confirmation', '', 'DELETE', 'Continue', 'Cancel');
    if (typed !== 'DELETE') return;
    let ok = 0, fail = 0;
    for (const id of selectedIds) { if (await trashManager.permanentDelete(id)) ok++; else fail++; }
    if (ok)   showToast(`${ok} book${ok > 1 ? 's' : ''} permanently deleted`, 'success');
    if (fail) showToast(`${fail} book${fail > 1 ? 's' : ''} failed to delete`, 'error');
    await loadTrash();
  }

  /* ── public actions ── */
  async function restore(id, title) {
    const confirmRestore = await showAppConfirm(
      `Restore "${title}"? It will return to the main books list.`,
      'Restore Book',
      'Restore',
      'Cancel'
    );
    if (!confirmRestore) return;
    if (await trashManager.restore(id)) { showToast('Book restored successfully!', 'success'); await loadTrash(); }
  }

  async function permanentDelete(id, title) {
    const confirmDelete = await showAppConfirm(
      `Permanently delete "${title}"? This action cannot be undone and all copies will be removed forever.`,
      'Permanent Delete',
      'Delete Forever',
      'Cancel'
    );
    if (!confirmDelete) return;
    const typed = await showAppPrompt('Type DELETE to confirm this permanent action.', 'Final Confirmation', '', 'DELETE', 'Continue', 'Cancel');
    if (typed !== 'DELETE') return;
    if (await trashManager.permanentDelete(id)) { showToast('Book permanently deleted', 'success'); await loadTrash(); }
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

    trashManager = new TrashManager('books', '/api/admin/books');
    await loadTrash();
    await loadCategories();
    setupFilters();
    setupBulkOps();

    const refreshHandle = setInterval(() => {
      refreshCategoriesIfNeeded(false);
    }, BOOKS_TRASH_CATEGORY_REFRESH_MS);

    window.addEventListener('beforeunload', () => {
      clearInterval(refreshHandle);
    }, { once: true });
  }

  /* ── namespace ── */
  SA.BooksTrashPage = { init, restore, permanentDelete, _onCheck };

})(window.SuperAdmin = window.SuperAdmin || {});
