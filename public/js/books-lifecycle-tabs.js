(function () {
  'use strict';

  function initBooksLifecycleTabs() {
    const tabsContainer = document.querySelector('.books-lifecycle-tabs[data-component="books-tabs"]');
    if (!tabsContainer) return;

    const tbody = document.querySelector('.section-card .sa-table-wrapper .user-table tbody');
    if (!tbody) return;

    const tabButtons = Array.from(tabsContainer.querySelectorAll('.books-tab[data-tab]'));
    const countAll = document.getElementById('count-all');
    const countActive = document.getElementById('count-active');
    const countPendingPickup = document.getElementById('count-pending-pickup');
    const countOverdue = document.getElementById('count-overdue');

    let activeTab = 'all';

    const norm = (v) => String(v || '').trim().toLowerCase();

    function getTableRows() {
      return Array.from(tbody.querySelectorAll('tr')).filter((row) => row.querySelector('.book-row-checkbox'));
    }

    function parseDate(value) {
      if (!value) return null;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    function getRowStatus(row) {
      const ds = norm(row.dataset.displayStatus || row.dataset.borrowStatus || row.dataset.currentStatus);
      if (ds) return ds;

      const statusCell = row.cells && row.cells[8] ? norm(row.cells[8].textContent) : '';
      if (statusCell.includes('overdue')) return 'overdue';
      if (statusCell.includes('returned')) return 'returned';
      if (statusCell.includes('pending pickup')) return 'pending_pickup';
      if (statusCell.includes('pending return')) return 'pending_return';
      if (statusCell.includes('picked up')) return 'picked_up';
      if (statusCell.includes('borrowed') || statusCell.includes('all borrowed')) return 'borrowed';
      if (statusCell.includes('active')) return 'active';
      return '';
    }

    function getRowDueDate(row) {
      return parseDate(row.dataset.dueDate);
    }

    function isOverdueRow(row) {
      const status = getRowStatus(row);
      if (status === 'overdue') return true;

      const due = getRowDueDate(row);
      if (!due) return false;

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return isActiveRow(row) && due < today;
    }

    function isPendingPickupRow(row) {
      const status = getRowStatus(row);
      return status === 'pending_pickup' || status === 'claim_expired' || status === 'pending';
    }

    function isActiveRow(row) {
      const status = getRowStatus(row);
      if (!status) {
        const borrowedCell = row.cells && row.cells[9] ? row.cells[9] : null;
        return !!(borrowedCell && borrowedCell.classList.contains('active'));
      }

      if (status === 'returned' || isPendingPickupRow(row)) {
        return false;
      }

      if (status === 'overdue') return true;
      return status === 'picked_up' || status === 'pending_return' || status === 'borrowed' || status === 'active';
    }

    function isVisibleRow(row) {
      return !row.classList.contains('books-tab-hidden');
    }

    function syncBulkSelectionToVisibleRows() {
      const hiddenChecked = Array.from(document.querySelectorAll('.book-row-checkbox:checked')).filter((cb) => {
        const row = cb.closest('tr');
        return row && !isVisibleRow(row);
      });

      hiddenChecked.forEach((cb) => {
        cb.checked = false;
        if (typeof window.handleRowCheckboxChange === 'function') {
          window.handleRowCheckboxChange(cb);
        }
      });

      if (typeof window.updateMasterCheckboxState === 'function') {
        window.updateMasterCheckboxState();
      }
      if (typeof window.updateBulkToolbar === 'function') {
        window.updateBulkToolbar();
      }
    }

    function updateTabCounters() {
      const rows = getTableRows();
      let active = 0;
      let pendingPickup = 0;
      let overdue = 0;

      rows.forEach((row) => {
        if (isActiveRow(row)) active += 1;
        if (isPendingPickupRow(row)) pendingPickup += 1;
        if (isOverdueRow(row)) overdue += 1;
      });

      if (countAll) countAll.textContent = String(rows.length);
      if (countActive) countActive.textContent = String(active);
      if (countPendingPickup) countPendingPickup.textContent = String(pendingPickup);
      if (countOverdue) countOverdue.textContent = String(overdue);
    }

    function applyTabFilter(tabKey) {
      activeTab = tabKey;

      tabButtons.forEach((btn) => {
        const isActive = btn.dataset.tab === tabKey;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      const rows = getTableRows();
      rows.forEach((row) => {
        row.classList.add('books-tab-anim');

        let show = true;
        if (tabKey === 'active') show = isActiveRow(row);
        if (tabKey === 'pending_pickup') show = isPendingPickupRow(row);
        if (tabKey === 'overdue') show = isOverdueRow(row);

        row.classList.toggle('books-overdue-accent', tabKey === 'overdue' && isOverdueRow(row));

        if (show) {
          row.classList.remove('books-tab-hidden', 'books-tab-leave');
          row.classList.add('books-tab-enter');
          window.requestAnimationFrame(function () {
            row.classList.remove('books-tab-enter');
          });
        } else {
          row.classList.add('books-tab-leave');
          row.classList.remove('books-tab-enter', 'books-overdue-accent');
          window.setTimeout(function () {
            row.classList.add('books-tab-hidden');
            row.classList.remove('books-tab-leave');
          }, 140);
        }
      });

      window.setTimeout(syncBulkSelectionToVisibleRows, 160);
    }

    function refresh() {
      updateTabCounters();
      applyTabFilter(activeTab);
    }

    tabButtons.forEach((btn) => {
      btn.addEventListener('click', function () {
        applyTabFilter(btn.dataset.tab);
      });
    });

    ['searchInput', 'categoryFilter', 'statusFilter', 'clearFilters'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const eventName = el.tagName === 'SELECT' || id === 'clearFilters' ? 'change' : 'input';
      el.addEventListener(eventName, function () {
        window.setTimeout(refresh, 0);
      });
      if (id === 'clearFilters') {
        el.addEventListener('click', function () {
          window.setTimeout(refresh, 0);
        });
      }
    });

    const observer = new MutationObserver(function () {
      refresh();
    });

    observer.observe(tbody, { childList: true, subtree: false });

    refresh();
  }

  document.addEventListener('DOMContentLoaded', initBooksLifecycleTabs);
})();