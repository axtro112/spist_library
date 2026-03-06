/* ═══════════════════════════════════════════════
   TrashFilters — tab switching + search + filter dropdown.
   ═══════════════════════════════════════════════ */
(function (global) {
  'use strict';

  let _onTabChange    = null;
  let _onFilterChange = null;

  const TAB_FILTER = {
    books: {
      label: 'All Categories',
      param: 'category',
      async options() {
        try {
          const r = await fetch('/api/books/categories', { credentials: 'include' });
          if (!r.ok) return [];
          const data = await r.json();
          const cats = data.data || data;
          return Array.isArray(cats)
            ? cats.filter(c => c.category).map(c => ({ value: c.category, label: c.category }))
            : [];
        } catch (_) { return []; }
      },
    },
    users: {
      label: 'All Year Levels',
      param: 'year_level',
      async options() {
        return [1,2,3,4,5].map(y => ({ value: String(y), label: `Year ${y}` }));
      },
    },
    admins: {
      label: 'All Roles',
      param: 'role',
      async options() {
        return [
          { value: 'super_admin',  label: 'Super Admin'  },
          { value: 'system_admin', label: 'System Admin' },
        ];
      },
    },
  };

  async function populateTabFilter(entity) {
    const sel = document.getElementById('trashTabFilter');
    if (!sel) return;
    const cfg = TAB_FILTER[entity];
    if (!cfg) { sel.style.visibility = 'hidden'; return; }
    sel.style.visibility = 'visible';
    const opts = await cfg.options();
    sel.innerHTML = `<option value="">${cfg.label}</option>` +
      opts.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  }

  global.TrashFilters = {

    setup(onTabChange, onFilterChange) {
      _onTabChange    = onTabChange;
      _onFilterChange = onFilterChange;

      /* tab buttons */
      document.querySelectorAll('.trash-tab').forEach(tab => {
        tab.addEventListener('click', function () {
          const entity = this.dataset.entity;
          document.querySelectorAll('.trash-tab').forEach(t => t.classList.remove('active'));
          this.classList.add('active');
          const s = document.getElementById('trashSearch');
          const f = document.getElementById('trashTabFilter');
          if (s) s.value = '';
          if (f) f.value = '';
          populateTabFilter(entity);
          if (_onTabChange) _onTabChange(entity);
        });
      });

      /* search with debounce */
      const searchEl = document.getElementById('trashSearch');
      if (searchEl) {
        let t;
        searchEl.addEventListener('input', function () {
          clearTimeout(t);
          t = setTimeout(() => { if (_onFilterChange) _onFilterChange(); }, 320);
        });
      }

      /* tab-specific filter dropdown */
      const filterSel = document.getElementById('trashTabFilter');
      if (filterSel) {
        filterSel.addEventListener('change', () => { if (_onFilterChange) _onFilterChange(); });
      }

      /* clear button */
      const clearBtn = document.getElementById('trashClearBtn');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          const s = document.getElementById('trashSearch');
          const f = document.getElementById('trashTabFilter');
          if (s) s.value = '';
          if (f) f.value = '';
          if (_onFilterChange) _onFilterChange();
        });
      }

      /* populate initial (books) filter options */
      populateTabFilter('books');
    },

    getActiveEntity() {
      const tab = document.querySelector('.trash-tab.active');
      return tab ? tab.dataset.entity : 'books';
    },

    getFilters() {
      const entity = this.getActiveEntity();
      const cfg    = TAB_FILTER[entity];
      const search = (document.getElementById('trashSearch')?.value || '').trim();
      const fval   = document.getElementById('trashTabFilter')?.value || '';
      const filters = {};
      if (search) filters.search = search;
      if (fval && cfg?.param) filters[cfg.param] = fval;
      return filters;
    },

  };

})(window);
