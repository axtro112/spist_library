/* ═══════════════════════════════════════════════
   TrashTable — table rendering for unified trash page.
   Re-render safe. No external dependencies.
   ═══════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ── helpers ── */
  function esc(v) {
    if (v == null) return '';
    const el = document.createElement('div');
    el.textContent = String(v);
    return el.innerHTML;
  }

  function fmtDate(ds) {
    if (!ds) return '—';
    const d = new Date(ds);
    const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${M[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${h % 12 || 12}:${m} ${ampm}`;
  }

  function btns(entity, id, name) {
    return `<td class="trash-action-btns">
      <button class="trash-btn-restore" data-id="${id}" data-entity="${esc(entity)}" title="Restore">
        <i class="bi bi-arrow-counterclockwise"></i>
      </button>
      <button class="trash-btn-delete" data-id="${id}" data-entity="${esc(entity)}" data-name="${esc(name)}" title="Delete Forever">
        <i class="bi bi-trash3-fill"></i>
      </button>
    </td>`;
  }

  function cbCell(entity, id) {
    return `<td class="trash-checkbox-col"><input type="checkbox" class="trash-row-cb" data-id="${id}" data-entity="${esc(entity)}"></td>`;
  }

  /* ── schema per entity ── */
  const SCHEMA = {
    books: {
      cols: 10,
      head: '<tr><th class="trash-checkbox-col"></th><th>ID</th><th>Title</th><th>Author</th><th>Copies</th><th>Category</th><th>ISBN</th><th>Deleted At</th><th>Deleted By</th><th>Actions</th></tr>',
      row(x) {
        return `${cbCell('books', x.id)}
          <td>${x.id}</td>
          <td>${esc(x.title)}</td>
          <td>${esc(x.author)}</td>
          <td>${x.total_copies || 0}</td>
          <td>${esc(x.category || '—')}</td>
          <td>${esc(x.isbn || '—')}</td>
          <td>${fmtDate(x.deleted_at)}</td>
          <td>${esc(x.added_by_name || 'Unknown')}</td>
          ${btns('books', x.id, x.title)}`;
      },
      empty: 'No books in trash',
    },
    users: {
      cols: 10,
      head: '<tr><th class="trash-checkbox-col"></th><th>ID</th><th>Student ID</th><th>Name</th><th>Email</th><th>Dept</th><th>Year</th><th>Status</th><th>Deleted At</th><th>Actions</th></tr>',
      row(x) {
        const sc = x.status === 'active' ? 'status-active' : 'status-inactive';
        return `${cbCell('users', x.id)}
          <td>${x.id}</td>
          <td>${esc(x.student_id)}</td>
          <td>${esc(x.fullname)}</td>
          <td>${esc(x.email)}</td>
          <td>${esc(x.department || '—')}</td>
          <td>${esc(x.year_level || '—')}</td>
          <td><span class="status-badge ${sc}">${esc(x.status)}</span></td>
          <td>${fmtDate(x.deleted_at)}</td>
          ${btns('users', x.id, x.fullname)}`;
      },
      empty: 'No users in trash',
    },
    admins: {
      cols: 8,
      head: '<tr><th class="trash-checkbox-col"></th><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Deleted At</th><th>Actions</th></tr>',
      row(x) {
        const rl = x.role === 'super_admin' ? 'Super Admin' : 'System Admin';
        const rc = x.role === 'super_admin' ? 'role-super-admin' : 'role-system-admin';
        const sc = x.is_active ? 'status-active' : 'status-inactive';
        return `${cbCell('admins', x.id)}
          <td>${x.id}</td>
          <td>${esc(x.fullname)}</td>
          <td>${esc(x.email)}</td>
          <td><span class="role-badge ${rc}">${rl}</span></td>
          <td><span class="status-badge ${sc}">${x.is_active ? 'Active' : 'Inactive'}</span></td>
          <td>${fmtDate(x.deleted_at)}</td>
          ${btns('admins', x.id, x.fullname)}`;
      },
      empty: 'No admins in trash',
    },
  };

  global.TrashTable = {
    render(entity, items) {
      const wrap = document.getElementById('trashTableWrap');
      if (!wrap) return;
      const s = SCHEMA[entity];
      if (!s) return;
      let html = `<table class="user-table"><thead>${s.head}</thead><tbody>`;
      if (!items || items.length === 0) {
        html += `<tr><td colspan="${s.cols}" class="trash-empty-cell">
          <i class="bi bi-trash" style="font-size:40px;display:block;margin:0 auto 12px;opacity:0.3;"></i>
          <strong>${s.empty}</strong>
          <div style="font-size:12px;color:#9ca3af;margin-top:6px;">Deleted items appear here</div>
        </td></tr>`;
      } else {
        items.forEach(x => { html += `<tr>${s.row(x)}</tr>`; });
      }
      html += '</tbody></table>';
      wrap.innerHTML = html;
      const master = document.getElementById('trashMasterCb');
      if (master) { master.checked = false; master.indeterminate = false; }
    },

    setLoading() {
      const wrap = document.getElementById('trashTableWrap');
      if (!wrap) return;
      wrap.innerHTML = `<table class="user-table"><tbody><tr>
        <td colspan="10" style="text-align:center;padding:48px 20px;color:#6b7280;">
          <div class="trash-spinner"></div>Loading…
        </td></tr></tbody></table>`;
    },

    updateMasterCb() {
      const all = document.querySelectorAll('.trash-row-cb');
      const chk = document.querySelectorAll('.trash-row-cb:checked');
      const master = document.getElementById('trashMasterCb');
      if (!master) return;
      master.checked       = all.length > 0 && chk.length === all.length;
      master.indeterminate = chk.length > 0 && chk.length < all.length;
    },

    getSelectedIds() {
      return Array.from(document.querySelectorAll('.trash-row-cb:checked'))
        .map(cb => parseInt(cb.dataset.id, 10));
    },

    clearSelection() {
      document.querySelectorAll('.trash-row-cb').forEach(cb => { cb.checked = false; });
      const master = document.getElementById('trashMasterCb');
      if (master) { master.checked = false; master.indeterminate = false; }
    },
  };

})(window);
