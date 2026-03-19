/**
 * SuperAdmin.UsersPage
 * All logic for the User Management page.
 * Depends on: super-admin/utils.js, csrf-helper.js
 *
 * Functions used in HTML onclick attributes are explicitly assigned
 * to window.* at the bottom to remain accessible from markup.
 */
(function (SA) {
  'use strict';

  // ── Private state ───────────────────────────────────────────────────────
  var allStudentsData      = [];
  var currentFilters       = { search: '', course: 'All', year: 'All', status: 'All' };
  var filterDebounceTimer  = null;
  var selectedStudentIds   = new Set();
  var PROGRAM_FILTER_OPTIONS = [
    'BS Computer Engineering',
    'BS Computer Science',
    'BS Information Technology',
    'BS Tourism Management',
    'BS Business Administration - Major in Marketing Management',
    'BS Business Administration - Major in Operations Management',
    'BS Accountancy',
    'BS Hospitality Management',
    'Bachelor in Elementary Education',
    'Bachelor in Secondary Education - Major in English',
    'Bachelor in Secondary Education - Major in Mathematics',
    'Bachelor in Secondary Education - Major in Filipino',
    'Bachelor in Secondary Education - Major in Social Studies',
    'Bachelor in Secondary Education - Major in Science'
  ];

  // Borrow state
  var currentBorrowStudent  = { id: '', name: '' };
  var currentSelectedBook   = null;
  var currentSelectedCopy   = null;
  var allBooksData          = [];
  var selectedBooksForBulk  = [];

  // User CRUD state
  var _editUserId        = null;
  var _deleteUserId      = null;
  var _displayedStudents = [];

  // ── Dynamic styles ────────────────────────────────────────────────────────
  function _injectStyles() {
    if (document.getElementById('sa-users-dynamic-css')) return;
    var s = document.createElement('style');
    s.id = 'sa-users-dynamic-css';
    s.textContent = [
      '.book-item{background:rgba(255,255,255,0.1);padding:12px;border-radius:8px;margin-bottom:8px;}',
      '.book-item:last-child{margin-bottom:0;}.book-title{font-weight:500;margin-bottom:4px;}',
      '.book-details{font-size:0.9em;display:flex;justify-content:space-between;color:rgba(255,255,255,0.8);}',
      '.status{padding:2px 8px;border-radius:4px;font-size:0.8em;}',
      '.status.borrowed{background:rgba(76,175,80,0.2);}.status.overdue{background:rgba(244,67,54,0.2);color:#f44336;}',
      '.bulk-actions-bar{background:linear-gradient(135deg,#4f8a42 0%,#3a6b31 100%);padding:12px 20px;border-radius:8px;margin-bottom:15px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 8px rgba(0,0,0,0.1);}',
      '.bulk-actions-content{display:flex;align-items:center;justify-content:space-between;width:100%;}',
      '.selected-count{color:white;font-weight:500;font-size:14px;}',
      '.bulk-actions-buttons{display:flex;gap:10px;}',
      '.bulk-action-btn{display:flex;align-items:center;gap:6px;padding:8px 16px;border:none;border-radius:6px;font-size:14px;font-weight:500;cursor:pointer;transition:all 0.3s ease;}',
      '.bulk-action-btn .material-symbols-outlined{font-size:18px;}',
      '.bulk-delete-btn{background:rgba(244,67,54,0.9);color:white;}.bulk-delete-btn:hover{background:rgba(244,67,54,1);}',
      '.action-btn{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:none;border-radius:8px;cursor:pointer;transition:all 0.2s ease;margin:0 4px;}',
      '.action-btn .material-symbols-outlined{font-size:20px;}',
      '.borrow-btn{background-color:#4CAF50;color:white;}.borrow-btn:hover{background-color:#45a049;}',
      '.bulk-borrow-btn{background-color:#2196F3;color:white;}.bulk-borrow-btn:hover{background-color:#0b7dda;}',
      '.edit-user-btn{background-color:#2196F3;color:white;}.edit-user-btn:hover{background-color:#1976D2;}',
      '.delete-user-btn{background-color:#f44336;color:white;}.delete-user-btn:hover{background-color:#d32f2f;}',
      '.action-cell{white-space:nowrap;}',
      '.borrow-student-info{background:#f5f5f5;padding:15px;border-radius:8px;margin-bottom:20px;}',
      '.borrow-step{margin:20px 0;}.borrow-step h3{color:#0e5e3f;margin-bottom:15px;}',
      '.books-list,.copies-list{border:1px solid #ddd;border-radius:8px;padding:10px;}',
      '.book-item-select{background:white;border:1px solid #ddd;border-radius:8px;padding:15px;margin-bottom:10px;cursor:pointer;transition:all 0.2s;}',
      '.book-item-select:hover{border-color:#4CAF50;}.book-item-select h4{margin:0 0 8px 0;color:#333;}',
      '.book-item-select p{margin:4px 0;font-size:14px;color:#666;}',
      '.copy-item{background:white;border:1px solid #ddd;border-radius:8px;padding:15px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;}',
      '.copy-info{flex:1;}.btn-select-copy{background:#4CAF50;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;}',
      '.borrow-summary{background:#e8f5e9;padding:15px;border-radius:8px;margin-bottom:20px;}',
      '.bulk-borrow-container{display:grid;grid-template-columns:350px 1fr;gap:20px;}',
      '.selected-books-cart{background:#f9f9f9;padding:20px;border-radius:8px;position:sticky;top:20px;max-height:600px;overflow-y:auto;}',
      '.cart-items{max-height:300px;overflow-y:auto;}',
      '.cart-item{background:white;padding:12px;border-radius:6px;margin-bottom:10px;border:1px solid #ddd;}',
      '.cart-item-header{display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;}',
      '.cart-item-title{font-weight:500;color:#333;flex:1;}',
      '.cart-item-remove{background:#f44336;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:12px;}',
      '.cart-item-details{font-size:13px;color:#666;}.empty-cart{text-align:center;color:#999;padding:40px 20px;}',
      '.available-books-section{background:white;padding:20px;border-radius:8px;border:1px solid #ddd;}',
      '.loading-text{text-align:center;color:#666;padding:20px;}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── Table ─────────────────────────────────────────────────────────────────
  async function fetchStudentsData(filters) {
    filters = filters || {};
    try {
      var params = new URLSearchParams();
      if (filters.search  && filters.search.trim())   params.append('search',      filters.search.trim());
      if (filters.course  && filters.course  !== 'All') params.append('department',  filters.course);
      if (filters.year    && filters.year    !== 'All') params.append('year_level',  filters.year);
      if (filters.status  && filters.status  !== 'All') params.append('status',      filters.status);
      var url = '/api/students' + (params.toString() ? '?' + params.toString() : '');
      var response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch students: ' + response.statusText);
      var result = await response.json();
      var students = result.data || result || [];
      if (!filters.search && !filters.course && !filters.year && !filters.status) allStudentsData = students;

      var studentsWithBooks = await Promise.all(students.map(async function (student) {
        try {
          var br = await fetch('/api/book-borrowings/' + student.student_id);
          if (!br.ok) return Object.assign({}, student, { rented_books: 0, books_title: '', date_to_return: 'No active rentals' });
          var brResult = await br.json();
          var bdata    = brResult.data || brResult;
          return Object.assign({}, student, {
            rented_books:  bdata.total_borrowed || 0,
            books_title:   (bdata.books && bdata.books.length > 0) ? bdata.books.map(function (b) { return b.title; }).join(', ') : '',
            date_to_return: (bdata.total_borrowed > 0 && bdata.books)
              ? new Date(Math.min.apply(null, bdata.books.map(function (b) { return new Date(b.due_date); }))).toLocaleDateString()
              : 'No active rentals',
          });
        } catch (e) {
          return Object.assign({}, student, { rented_books: 0, books_title: '', date_to_return: 'Error fetching data' });
        }
      }));
      _updateTable(studentsWithBooks);
    } catch (error) {
      console.error('[UsersPage] fetchStudentsData:', error);
      var tbody = document.querySelector('.user-table tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="table-error-message">Failed to load student data. Error: ' + error.message + '</td></tr>';
    }
  }

  function _updateTable(students) {
    _displayedStudents = students;
    var tbody    = document.querySelector('.user-table tbody');
    var countEl  = document.getElementById('usersResultCount');
    if (!tbody) return;
    tbody.innerHTML = '';
    var total = allStudentsData.length || students.length;
    if (countEl) countEl.textContent = 'Showing ' + students.length + ' of ' + total + ' users';

    if (students.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px 20px;"><div style="display:flex;flex-direction:column;align-items:center;gap:12px;color:#666;"><span class="material-symbols-outlined" style="font-size:48px;color:#ccc;">search_off</span><h3 style="margin:0;color:#333;">No users found</h3><p style="margin:0;">Try adjusting your search or filters</p></div></td></tr>';
      return;
    }

    students.forEach(function (student) {
      var row = document.createElement('tr');
      row.dataset.studentId = student.student_id;
      row.setAttribute('data-user-id', student.student_id);
      row.dataset.overviewType = 'user';
      row.dataset.overviewId   = String(student.student_id);
      row.innerHTML =
        '<td><input type="checkbox" class="row-select" data-student-id="' + student.student_id + '"></td>' +
        '<td>' + student.fullname + '</td>' +
        '<td>' + student.student_id + '</td>' +
        '<td>' + student.department + '</td>' +
        '<td>' + student.year_level + '</td>' +
        '<td>' + student.rented_books + '</td>' +
        '<td>' + (student.books_title || '') + '</td>' +
        '<td>' + student.date_to_return + '</td>' +
        '<td class="action-cell">' +
          '<button class="action-btn edit-user-btn" onclick="event.stopPropagation();openEditUserModal(' + student.id + ')" title="Edit User"><span class="material-symbols-outlined">edit</span></button>' +
          '<button class="action-btn delete-user-btn" onclick="event.stopPropagation();openDeleteUserModal(' + student.id + ')" title="Delete User"><span class="material-symbols-outlined">delete</span></button>' +
        '</td>';
      tbody.appendChild(row);
    });

    _initBulkSelection();

    // Deep-link highlight (consume once)
    var urlParams   = new URLSearchParams(window.location.search);
    var highlightId = urlParams.get('highlight');
    if (highlightId) {
      var consumeKey = 'sa-users-highlight-consumed:' + highlightId;
      var alreadyConsumed = sessionStorage.getItem(consumeKey) === 'true';

      // Clear URL immediately so hard refresh does not retrigger modal open.
      window.history.replaceState({}, document.title, window.location.pathname);

      if (alreadyConsumed) {
        return;
      }

      var targetRow = tbody.querySelector('tr[data-student-id="' + highlightId + '"]');
      if (targetRow) {
        sessionStorage.setItem(consumeKey, 'true');
        targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetRow.classList.add('selected-row');
        targetRow.style.animation = 'highlightPulse 2s ease-out';
        setTimeout(function () { targetRow.click(); }, 500);
      }
    }
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  function _initFilters() {
    var searchInput    = document.getElementById('usersSearchInput');
    var courseFilter   = document.getElementById('usersCourseFilter');
    var yearFilter     = document.getElementById('usersYearFilter');
    var statusFilter   = document.getElementById('usersStatusFilter');
    var clearBtn       = document.getElementById('usersClearFilters');
    if (!searchInput) return;
    _loadUniqueCourses();
    searchInput.addEventListener('input', function () {
      clearTimeout(filterDebounceTimer);
      var val = this.value;
      filterDebounceTimer = setTimeout(function () { currentFilters.search = val; fetchStudentsData(currentFilters); }, 300);
    });
    courseFilter.addEventListener('change', function () { currentFilters.course  = this.value; fetchStudentsData(currentFilters); });
    yearFilter.addEventListener('change',   function () { currentFilters.year    = this.value; fetchStudentsData(currentFilters); });
    statusFilter.addEventListener('change', function () { currentFilters.status  = this.value; fetchStudentsData(currentFilters); });
    clearBtn.addEventListener('click', function () {
      searchInput.value = ''; courseFilter.value = 'All'; yearFilter.value = 'All'; statusFilter.value = 'All';
      currentFilters = { search: '', course: 'All', year: 'All', status: 'All' };
      fetchStudentsData();
    });
  }

  async function _loadUniqueCourses() {
    try {
      var result = await SA.utils.safeFetch('/api/students');
      if (!result) return;
      var students = result.data || result || [];
      var liveCourses  = Array.from(new Set(students.map(function (s) { return s.department; }).filter(Boolean))).sort();
      var mergedCourses = PROGRAM_FILTER_OPTIONS.slice();
      liveCourses.forEach(function (c) {
        if (mergedCourses.indexOf(c) === -1) mergedCourses.push(c);
      });
      var select   = document.getElementById('usersCourseFilter');
      if (!select) return;
      select.innerHTML = '<option value="All">All Courses</option>';
      mergedCourses.forEach(function (c) { var o = document.createElement('option'); o.value = c; o.textContent = c; select.appendChild(o); });
    } catch (e) { console.error('[UsersPage] loadUniqueCourses:', e); }
  }

  // ── Row click → user detail ───────────────────────────────────────────────
  function _initRowClick() {
    var tbody = document.querySelector('.user-table tbody');
    if (!tbody) return;
    tbody.addEventListener('click', async function (e) {
      if (e.target.type === 'checkbox') return;
      var row = e.target.closest('tr');
      if (!row) return;
      document.querySelectorAll('.user-table tbody tr').forEach(function (r) { r.classList.remove('selected-row'); });
      row.classList.add('selected-row');
      var studentId = row.cells[2] ? row.cells[2].textContent : null;
      if (!studentId) return;

      // Prefer the side Overview panel for user details on this page.
      if (window.SuperAdmin && window.SuperAdmin.Overview && typeof window.SuperAdmin.Overview.open === 'function') {
        window.SuperAdmin.Overview.open('user', studentId);
        return;
      }

      // Fallback: update the side profile card
      try {
        var sResult = await SA.utils.safeFetch('/api/students/' + studentId);
        if (!sResult) return;
        var userData = {
          name: row.cells[1].textContent, studentId: row.cells[2].textContent,
          department: row.cells[3].textContent, yearLevel: row.cells[4].textContent,
          email: sResult.email, contactNumber: sResult.contact_number,
          rentedBooksCount: row.cells[5].textContent, bookTitles: row.cells[6].textContent, returnDate: row.cells[7].textContent,
        };
        _updateUserInfoCard(userData);
      } catch (err) { console.error('[UsersPage] row click:', err); }
    });
  }

  async function _updateUserInfoCard(userData) {
    var h2 = document.querySelector('.profile-details h2');
    var sid = document.querySelector('.student-id');
    if (h2) h2.textContent = userData.name;
    if (sid) sid.textContent = 'Student ID: ' + userData.studentId;
    var items = document.querySelectorAll('.detail-item');
    if (items[0]) items[0].querySelector('.detail-value').textContent = userData.department;
    if (items[1]) items[1].querySelector('.detail-value').textContent = userData.yearLevel;
    if (items[2]) items[2].querySelector('.detail-value').textContent = userData.email;
    if (items[3]) items[3].querySelector('.detail-value').textContent = userData.contactNumber || 'Not provided';
    var bookList = document.querySelector('.book-list');
    if (!bookList) return;
    try {
      var brResult = await SA.utils.safeFetch('/api/book-borrowings/' + userData.studentId);
      if (!brResult) return;
      var bdata = brResult.data || brResult;
      if (!bdata.total_borrowed || bdata.total_borrowed === 0 || !bdata.books || bdata.books.length === 0) {
        bookList.innerHTML = '<div class="book-placeholder">No books currently rented</div>';
      } else {
        bookList.innerHTML = bdata.books.map(function (book) {
          return '<div class="book-item"><div class="book-title">' + book.title + '</div>' +
            '<div class="book-details"><span class="due-date">Due: ' + new Date(book.due_date).toLocaleDateString() + '</span>' +
            '<span class="status ' + book.status.toLowerCase() + '">' + book.status + '</span></div></div>';
        }).join('');
      }
      var visitInfo = document.querySelector('.visit-info');
      if (visitInfo) {
        if (bdata.total_borrowed > 0 && bdata.books && bdata.books.length > 0) {
          var next = new Date(Math.min.apply(null, bdata.books.map(function (b) { return new Date(b.due_date); }))).toLocaleDateString();
          visitInfo.innerHTML = '<label>Next Return Due:</label><span class="visit-value">' + next + '</span>';
        } else {
          visitInfo.innerHTML = '<label>Status:</label><span class="visit-value">No active rentals</span>';
        }
      }
    } catch (e) {
      console.error('[UsersPage] updateUserInfoCard:', e);
      bookList.innerHTML = '<div class="book-placeholder">Error loading book information</div>';
    }
  }

  // ── Bulk selection ────────────────────────────────────────────────────────
  function _initBulkSelection() {
    selectedStudentIds.clear();
    _updateBulkBar();
    var selectAll = document.getElementById('selectAllUsers');
    if (selectAll) { selectAll.checked = false; selectAll.addEventListener('change', _handleSelectAll); }
    document.querySelectorAll('.row-select').forEach(function (cb) { cb.addEventListener('change', _handleRowSelect); });
    var bulkDelBtn  = document.getElementById('bulkDeleteBtn');
    if (bulkDelBtn)  bulkDelBtn.addEventListener('click', _handleBulkDelete);
    var bulkEditBtn = document.getElementById('bulkEditUsersBtn');
    if (bulkEditBtn) bulkEditBtn.addEventListener('click', _handleBulkEditUsers);
  }

  function _handleSelectAll(e) {
    var checked = e.target.checked;
    document.querySelectorAll('.row-select').forEach(function (cb) {
      cb.checked = checked;
      if (checked) selectedStudentIds.add(cb.dataset.studentId);
      else          selectedStudentIds.delete(cb.dataset.studentId);
    });
    _updateBulkBar();
  }

  function _handleRowSelect(e) {
    var cb = e.target;
    if (cb.checked) selectedStudentIds.add(cb.dataset.studentId);
    else             selectedStudentIds.delete(cb.dataset.studentId);
    var all     = document.querySelectorAll('.row-select');
    var checked = document.querySelectorAll('.row-select:checked');
    var master  = document.getElementById('selectAllUsers');
    if (master) master.checked = all.length > 0 && all.length === checked.length;
    _updateBulkBar();
  }

  function _updateBulkBar() {
    var bar        = document.getElementById('bulkActionsBar');
    var count      = document.getElementById('selectedCount');
    var delBtn     = document.getElementById('bulkDeleteBtn');
    var editBtn    = document.getElementById('bulkEditUsersBtn');
    var n          = selectedStudentIds.size;
    if (bar)    bar.style.display  = n > 0 ? 'flex' : 'none';
    if (count)  count.textContent  = n > 0 ? 'Selected: ' + n : '';
    if (delBtn)  delBtn.disabled   = n === 0;
    if (editBtn) editBtn.disabled  = n === 0;
  }

  function _handleBulkEditUsers() {
    if (selectedStudentIds.size === 0) { alert('No students selected'); return; }
    var modal = document.getElementById('bulkEditUsersModal');
    if (!modal) return;
    var title = modal.querySelector('h2');
    if (title) title.textContent = 'Edit ' + selectedStudentIds.size + ' Selected Student' + (selectedStudentIds.size > 1 ? 's' : '');
    var form = modal.querySelector('form');
    if (form) form.reset();
    modal.style.display = 'flex';
  }

  async function _handleBulkEditSubmit(e) {
    e.preventDefault();
    var update = {};
    var dept   = document.getElementById('bulkUserDept')  && document.getElementById('bulkUserDept').value.trim();
    var year   = document.getElementById('bulkUserYear')  && document.getElementById('bulkUserYear').value;
    var status = document.getElementById('bulkUserStatus') && document.getElementById('bulkUserStatus').value;
    if (dept)   update.department = dept;
    if (year)   update.year_level = year;
    if (status) update.status     = status;
    if (Object.keys(update).length === 0) { alert('Please fill in at least one field to update'); return; }
    try {
      var res    = await fetchWithCsrf('/api/students/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIds: Array.from(selectedStudentIds), update }),
      });
      var result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Failed to update students');
      alert('Successfully updated ' + (result.data && result.data.updatedCount || result.updatedCount || selectedStudentIds.size) + ' student(s)');
      document.getElementById('bulkEditUsersModal').style.display = 'none';
      selectedStudentIds.clear();
      var selectAll = document.getElementById('selectAllUsers');
      if (selectAll) selectAll.checked = false;
      fetchStudentsData();
      _updateBulkBar();
    } catch (err) { console.error('[UsersPage] bulkEditSubmit:', err); alert('Failed to update students: ' + err.message); }
  }

  async function _handleBulkDelete() {
    if (selectedStudentIds.size === 0) { alert('No students selected'); return; }
    if (!confirm('Move ' + selectedStudentIds.size + ' student(s) to trash?\n\nAny active borrowings will be automatically returned. You can restore them later.')) return;
    try {
      var response = await fetchWithCsrf('/api/students/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIds: Array.from(selectedStudentIds) }),
      });
      var result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to move students to trash');
      var data = result.data || result;
      var msg  = 'Successfully moved ' + data.successCount + ' student(s) to trash';
      if (data.failureCount > 0) {
        msg += '\n\nFailed: ' + data.failureCount + ' student(s):';
        data.failedDeletes.forEach(function (f) { msg += '\n- ' + f.studentId + ': ' + f.reason; });
      }
      alert(msg);
      selectedStudentIds.clear();
      var selectAll = document.getElementById('selectAllUsers');
      if (selectAll) selectAll.checked = false;
      fetchStudentsData();
      _updateBulkBar();
    } catch (error) { console.error('[UsersPage] bulkDelete:', error); alert('Failed to delete: ' + error.message); }
  }

  // ── Deep link ─────────────────────────────────────────────────────────────
  function _initDeepLink() {
    var p = new URLSearchParams(window.location.search);
    var openUser       = p.get('openUser');
    var openViolations = p.get('openViolations');
    var isValid = function (v) { return v && v !== 'undefined' && v !== 'null' && v.trim() !== ''; };
    if (isValid(openViolations)) {
      var consumeViolationKey = 'sa-users-openViolations-consumed:' + openViolations;
      var violationsConsumed = sessionStorage.getItem(consumeViolationKey) === 'true';
      window.history.replaceState({}, document.title, window.location.pathname);
      if (violationsConsumed) return;
      sessionStorage.setItem(consumeViolationKey, 'true');
      setTimeout(function () { if (window.userViolationsModal) window.userViolationsModal.open(openViolations); }, 500);
    } else if (isValid(openUser)) {
      var consumeUserKey = 'sa-users-openUser-consumed:' + openUser;
      var userConsumed = sessionStorage.getItem(consumeUserKey) === 'true';
      window.history.replaceState({}, document.title, window.location.pathname);
      if (userConsumed) return;
      sessionStorage.setItem(consumeUserKey, 'true');
      setTimeout(function () {
        if (window.SuperAdmin && window.SuperAdmin.Overview && typeof window.SuperAdmin.Overview.open === 'function') {
          window.SuperAdmin.Overview.open('user', openUser);
        }
      }, 500);
    }
  }

  // ── Borrow Modal ─────────────────────────────────────────────────────────
  function openBorrowModal(studentId, studentName) {
    currentBorrowStudent = { id: studentId, name: studentName };
    SA.utils.setText('borrowStudentName', studentName);
    SA.utils.setText('borrowStudentId',   studentId);
    _showBorrowStep(1);
    _loadBooksForBorrowing();
    var due = new Date(); due.setDate(due.getDate() + 7);
    var el = document.getElementById('borrowDueDate');
    if (el) el.value = due.toISOString().split('T')[0];
    var modal = document.getElementById('borrowModal');
    if (modal) modal.style.display = 'block';
  }

  function closeBorrowModal() {
    var modal = document.getElementById('borrowModal');
    if (modal) modal.style.display = 'none';
    currentSelectedBook = null; currentSelectedCopy = null;
  }

  function _showBorrowStep(step) {
    ['borrowStep1', 'borrowStep2', 'borrowStep3'].forEach(function (id, i) {
      var el = document.getElementById(id);
      if (el) el.style.display = (i + 1 === step) ? 'block' : 'none';
    });
  }

  async function _loadBooksForBorrowing() {
    var listEl = document.getElementById('borrowBooksList');
    if (!listEl) return;
    listEl.innerHTML = '<p class="loading-text">Loading books...</p>';
    try {
      var result = await SA.utils.safeFetch('/api/books?ts=' + Date.now());
      if (!result) { listEl.innerHTML = '<p class="loading-text">Error loading books</p>'; return; }
      allBooksData = result.data || result || [];
      var available = allBooksData.filter(function (b) { return b.available_quantity > 0; });
      if (available.length === 0) { listEl.innerHTML = '<p class="loading-text">No books available for borrowing</p>'; return; }
      _renderBooksList(available);
      var searchEl = document.getElementById('borrowBookSearch');
      if (searchEl) {
        searchEl.replaceWith(searchEl.cloneNode(true)); // remove stale listeners
        document.getElementById('borrowBookSearch').addEventListener('input', function (e) {
          var q = e.target.value.toLowerCase();
          _renderBooksList(available.filter(function (b) { return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.isbn.toLowerCase().includes(q); }));
        });
      }
    } catch (e) { console.error('[UsersPage] loadBooks:', e); if (listEl) listEl.innerHTML = '<p class="loading-text">Error loading books</p>'; }
  }

  function _renderBooksList(books) {
    var listEl = document.getElementById('borrowBooksList');
    if (!listEl) return;
    if (books.length === 0) { listEl.innerHTML = '<p class="loading-text">No books found</p>'; return; }
    listEl.innerHTML = books.map(function (book) {
      var safeTitle  = book.title.replace(/'/g, "\u0027");
      var safeAuthor = book.author.replace(/'/g, "\u0027");
      return '<div class="book-item-select" onclick="selectBookForBorrow(' + book.id + ',\u0027' + safeTitle + '\u0027,\u0027' + safeAuthor + '\u0027)">' +
        '<h4>' + book.title + '</h4><p><strong>Author:</strong> ' + book.author + '</p>' +
        '<p><strong>ISBN:</strong> ' + book.isbn + '</p><p><strong>Available:</strong> ' + book.available_quantity + ' of ' + book.quantity + '</p></div>';
    }).join('');
  }

  async function selectBookForBorrow(bookId, title, author) {
    currentSelectedBook = { id: bookId, title: title, author: author };
    SA.utils.setText('selectedBookTitle',  title);
    SA.utils.setText('selectedBookAuthor', author);
    _showBorrowStep(2);
    await _loadCopiesForBook(bookId);
  }

  async function _loadCopiesForBook(bookId) {
    var listEl = document.getElementById('borrowCopiesList');
    if (!listEl) return;
    listEl.innerHTML = '<p class="loading-text">Loading copies...</p>';
    try {
      var response = await fetchWithCsrf('/api/book-copies/' + bookId);
      var result   = await response.json();
      var available = (result.data || []).filter(function (c) { return c.status === 'available'; });
      if (available.length === 0) {
        listEl.innerHTML = '<div style="padding:30px;text-align:center;background:#fff3cd;border:1px solid #ffc107;border-radius:8px;"><h3 style="color:#856404;">No Copies Available</h3><p style="color:#856404;">All copies are currently borrowed or unavailable.</p></div>';
        return;
      }
      listEl.innerHTML = available.map(function (copy) {
        return '<div class="copy-item"><div class="copy-info">' +
          '<p><strong>Accession #:</strong> ' + copy.accession_number + '</p>' +
          '<p><strong>Copy #:</strong> ' + copy.copy_number + '</p>' +
          '<p><strong>Condition:</strong> ' + copy.condition + '</p>' +
          '<p><strong>Location:</strong> ' + (copy.location || 'N/A') + '</p></div>' +
          '<button class="btn-select-copy" onclick=\'selectCopy(' + JSON.stringify(copy).replace(/'/g, '&#39;') + ')\'>Select</button></div>';
      }).join('');
    } catch (e) { console.error('[UsersPage] loadCopies:', e); if (listEl) listEl.innerHTML = '<p class="loading-text">Error loading copies</p>'; }
  }

  function selectCopy(copy) {
    currentSelectedCopy = copy;
    SA.utils.setText('confirmStudentName',     currentBorrowStudent.name);
    SA.utils.setText('confirmBookTitle',        currentSelectedBook.title);
    SA.utils.setText('confirmAccessionNumber',  copy.accession_number);
    SA.utils.setText('confirmCondition',        copy.condition);
    _showBorrowStep(3);
  }

  function backToBookSelection() { _showBorrowStep(1); }
  function backToCopySelection()  { _showBorrowStep(2); }

  async function confirmBorrowing() {
    var dueDateEl = document.getElementById('borrowDueDate');
    if (!dueDateEl || !dueDateEl.value) { alert('Please select a due date'); return; }
    try {
      var response = await fetchWithCsrf('/api/book-borrowings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: currentBorrowStudent.id, book_id: currentSelectedBook.id, accession_number: currentSelectedCopy.accession_number, due_date: dueDateEl.value }),
      });
      var result = await response.json();
      if (response.ok) {
        alert('Book borrowed successfully!');
        closeBorrowModal();
        fetchStudentsData();
      } else {
        _showBorrowError(result.message || 'Failed to borrow book');
      }
    } catch (e) { _showBorrowError('Error borrowing book. Please try again.'); }
  }

  function _showBorrowError(msg) {
    var step3 = document.getElementById('borrowStep3');
    if (!step3) return;
    var err = step3.querySelector('.borrow-error-msg');
    if (!err) {
      err = document.createElement('div');
      err.className = 'borrow-error-msg';
      err.style.cssText = 'padding:15px;background:#ffebee;border:1px solid #f44336;border-radius:6px;margin:15px 0;color:#c62828;text-align:center;';
      step3.insertBefore(err, step3.firstChild);
    }
    err.innerHTML = '<strong>\u26a0\ufe0f ' + msg + '</strong>';
  }

  // ── Bulk Borrow Modal ─────────────────────────────────────────────────────
  async function openBulkBorrowModal(studentId, studentName) {
    currentBorrowStudent = { id: studentId, name: studentName };
    SA.utils.setText('bulkBorrowStudentName', studentName);
    SA.utils.setText('bulkBorrowStudentId',   studentId);
    selectedBooksForBulk = [];
    _updateBulkCart();
    var due = new Date(); due.setDate(due.getDate() + 7);
    var dueDateEl = document.getElementById('bulkBorrowDueDate');
    if (dueDateEl) dueDateEl.value = due.toISOString().split('T')[0];
    var instrDiv = document.getElementById('bulkBorrowInstructions');
    if (instrDiv) instrDiv.innerHTML = '<div style="padding:12px;background:#e3f2fd;border-left:4px solid #2196F3;border-radius:4px;margin-bottom:15px;"><strong>How to borrow:</strong><ol style="margin:8px 0 0 0;padding-left:20px;font-size:14px;"><li>Search or browse available books below</li><li>Click on a book to add it to your cart</li><li>Set the due date and click \u201CConfirm Borrow\u201D</li></ol></div>';
    await _loadBooksForBulkBorrow();
    var modal = document.getElementById('bulkBorrowModal');
    if (modal) modal.style.display = 'block';
  }

  function closeBulkBorrowModal() {
    var modal = document.getElementById('bulkBorrowModal');
    if (modal) modal.style.display = 'none';
    selectedBooksForBulk = [];
  }

  async function _loadBooksForBulkBorrow() {
    var listEl = document.getElementById('bulkBooksList');
    if (!listEl) return;
    listEl.innerHTML = '<p class="loading-text">Loading books...</p>';
    try {
      var result = await SA.utils.safeFetch('/api/books?ts=' + Date.now());
      if (!result) { listEl.innerHTML = '<p class="loading-text">Error loading books</p>'; return; }
      allBooksData = result.data || result || [];
      var available = allBooksData.filter(function (b) { return b.available_quantity > 0; });
      if (available.length === 0) { listEl.innerHTML = '<p class="loading-text">No books available</p>'; return; }
      _renderBulkBooksList(available);
      var searchEl = document.getElementById('bulkBookSearch');
      if (searchEl) {
        searchEl.replaceWith(searchEl.cloneNode(true));
        document.getElementById('bulkBookSearch').addEventListener('input', function (e) {
          var q = e.target.value.toLowerCase();
          _renderBulkBooksList(available.filter(function (b) { return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q); }));
        });
      }
    } catch (e) { console.error('[UsersPage] loadBulkBooks:', e); if (listEl) listEl.innerHTML = '<p class="loading-text">Error loading books</p>'; }
  }

  function _renderBulkBooksList(books) {
    var listEl = document.getElementById('bulkBooksList');
    if (!listEl) return;
    listEl.innerHTML = books.map(function (book) {
      var isSelected  = selectedBooksForBulk.some(function (b) { return b.bookId === book.id; });
      var safeTitle   = book.title.replace(/'/g,  '\u0027');
      var safeAuthor  = book.author.replace(/'/g, '\u0027');
      var onclick     = isSelected ? '' : 'addBookToBulkCart(' + book.id + ',\u0027' + safeTitle + '\u0027,\u0027' + safeAuthor + '\u0027)';
      return '<div class="book-item-select' + (isSelected ? ' disabled' : '') + '" onclick="' + onclick + '">' +
        '<h4>' + book.title + (isSelected ? ' \u2713' : '') + '</h4>' +
        '<p><strong>Author:</strong> ' + book.author + '</p>' +
        '<p><strong>Available:</strong> ' + book.available_quantity + '</p></div>';
    }).join('');
  }

  async function addBookToBulkCart(bookId, title, author) {
    try {
      var response = await fetchWithCsrf('/api/book-copies/' + bookId);
      var result   = await response.json();
      var available = (result.data || []).filter(function (c) { return c.status === 'available'; });
      if (available.length === 0) { console.warn('[UsersPage] No copies available for:', title); return; }
      var onSelect = function (copy) {
        if (!copy) return;
        selectedBooksForBulk.push({ bookId: bookId, title: title, author: author, accessionNumber: copy.accession_number, condition: copy.condition_status });
        _updateBulkCart();
        _renderBulkBooksList(allBooksData.filter(function (b) { return b.available_quantity > 0; }));
      };
      if (available.length === 1) { onSelect(available[0]); }
      else                        { await _showCopySelectionModal(title, available, onSelect); }
    } catch (e) { console.error('[UsersPage] addBookToBulkCart:', e); }
  }

  function removeFromBulkCart(index) {
    selectedBooksForBulk.splice(index, 1);
    _updateBulkCart();
    _renderBulkBooksList(allBooksData.filter(function (b) { return b.available_quantity > 0; }));
  }

  function _updateBulkCart() {
    var cartEl       = document.getElementById('selectedBooksCart');
    var countEl      = document.getElementById('selectedBooksCount');
    var confirmCount = document.getElementById('confirmBooksCount');
    var n = selectedBooksForBulk.length;
    if (countEl)      countEl.textContent      = n;
    if (confirmCount) confirmCount.textContent  = n;
    if (!cartEl) return;
    if (n === 0) { cartEl.innerHTML = '<p class="empty-cart">Click books below to add them here</p>'; return; }
    cartEl.innerHTML = selectedBooksForBulk.map(function (book, i) {
      return '<div class="cart-item"><div class="cart-item-header"><div class="cart-item-title">' + book.title + '</div>' +
        '<button class="cart-item-remove" onclick="removeFromBulkCart(' + i + ')" title="Remove">&times;</button></div>' +
        '<div class="cart-item-details"><div><small>\uD83D\uDCCB ' + book.accessionNumber + '</small></div>' +
        '<div><small>\u2B50 ' + book.condition + '</small></div></div></div>';
    }).join('');
  }

  async function confirmBulkBorrowing() {
    if (selectedBooksForBulk.length === 0) { alert('Please select at least one book'); return; }
    var dueDateEl = document.getElementById('bulkBorrowDueDate');
    if (!dueDateEl || !dueDateEl.value) { alert('Please select a due date'); return; }
    try {
      var borrowings = selectedBooksForBulk.map(function (book) {
        return { student_id: currentBorrowStudent.id, book_id: book.bookId, accession_number: book.accessionNumber, due_date: dueDateEl.value };
      });
      var response = await fetchWithCsrf('/api/book-borrowings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ borrowings: borrowings }),
      });
      var result = await response.json();
      if (response.ok) {
        alert('Successfully borrowed ' + selectedBooksForBulk.length + ' book(s)!');
        closeBulkBorrowModal();
        fetchStudentsData();
      } else {
        console.error('[UsersPage] bulkBorrow error:', result.message);
      }
    } catch (e) { console.error('[UsersPage] confirmBulkBorrowing:', e); }
  }

  // ── Copy selection modal ──────────────────────────────────────────────────
  function _showCopySelectionModal(bookTitle, copies, onSelect) {
    return new Promise(function (resolve) {
      var optionsHTML = copies.map(function (copy, i) {
        var color = copy.condition_status === 'excellent' ? '#4CAF50' : copy.condition_status === 'good' ? '#2196F3' : '#FF9800';
        return '<div class="copy-option" data-index="' + i + '" style="padding:12px 16px;border:2px solid #e0e0e0;border-radius:8px;margin-bottom:10px;cursor:pointer;transition:all 0.2s;display:flex;justify-content:space-between;align-items:center;">' +
          '<div><div style="font-weight:600;font-size:15px;">' + copy.accession_number + '</div>' +
          '<div style="font-size:13px;color:#666;">Condition: <span style="color:' + color + ';font-weight:500;">' + copy.condition_status + '</span></div></div>' +
          '<span class="material-symbols-outlined" style="color:#4f8a42;">arrow_forward</span></div>';
      }).join('');
      document.body.insertAdjacentHTML('beforeend',
        '<div id="copySelectionModal" class="modal" style="display:block;">' +
          '<div class="modal-content" style="max-width:500px;">' +
            '<h2 style="margin-bottom:8px;">&#128218; Choose Which Copy to Borrow</h2>' +
            '<p style="color:#666;margin-bottom:8px;font-size:14px;"><strong>' + bookTitle + '</strong></p>' +
            '<div id="copySelectionList" style="max-height:400px;overflow-y:auto;margin-bottom:20px;">' + optionsHTML + '</div>' +
            '<div class="form-actions"><button type="button" class="cancel-btn" onclick="closeCopySelectionModal()">Cancel</button></div>' +
          '</div></div>'
      );
      var modal = document.getElementById('copySelectionModal');
      modal.querySelectorAll('.copy-option').forEach(function (opt) {
        opt.addEventListener('mouseover', function () { opt.style.borderColor = '#4f8a42'; opt.style.backgroundColor = '#f0f7f0'; });
        opt.addEventListener('mouseout',  function () { opt.style.borderColor = '#e0e0e0'; opt.style.backgroundColor = 'white'; });
        opt.addEventListener('click', function () {
          var copy = copies[parseInt(opt.dataset.index)];
          closeCopySelectionModal();
          onSelect(copy);
          resolve(copy);
        });
      });
      modal.addEventListener('click', function (e) {
        if (e.target.id === 'copySelectionModal') { closeCopySelectionModal(); resolve(null); }
      });
    });
  }

  function closeCopySelectionModal() {
    var m = document.getElementById('copySelectionModal');
    if (m) m.remove();
  }

  // ── User CRUD ─────────────────────────────────────────────────────────────
  function openAddUserModal() {
    var modal = document.getElementById('adminModal');
    if (!modal) return;
    var form = document.getElementById('addUserForm');
    if (form) form.reset();
    var err = document.getElementById('addUserError');
    if (err) { err.textContent = ''; err.style.display = 'none'; }
    modal.classList.add('show');
  }

  function closeAddUserModal() {
    var modal = document.getElementById('adminModal');
    if (modal) modal.classList.remove('show');
  }

  async function _saveNewUser(e) {
    e.preventDefault();
    var fnEl = document.getElementById('addUserFullname');
    var siEl = document.getElementById('addUserStudentId');
    var emEl = document.getElementById('addUserEmail');
    var pwEl = document.getElementById('addUserPassword');
    var dpEl = document.getElementById('addUserDept');
    var yrEl = document.getElementById('addUserYear');
    var fullname   = fnEl ? fnEl.value.trim() : '';
    var student_id = siEl ? siEl.value.trim() : '';
    var email      = emEl ? emEl.value.trim() : '';
    var password   = pwEl ? pwEl.value : '';
    var department = dpEl ? dpEl.value : '';
    var year_level = yrEl ? yrEl.value : '1';
    var errEl = document.getElementById('addUserError');
    var showErr = function (msg) {
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; } else { alert(msg); }
    };
    if (!fullname || !student_id || !email || !password) { return showErr('Full Name, Student ID, Email and Password are required.'); }
    if (password.length < 6) { return showErr('Password must be at least 6 characters.'); }
    try {
      var res = await fetchWithCsrf('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullname: fullname, student_id: student_id, email: email, password: password, department: department, year_level: year_level }),
      });
      var result = await res.json();
      if (!res.ok) { return showErr(result.message || 'Failed to create user.'); }
      closeAddUserModal();
      fetchStudentsData(currentFilters);
    } catch (err) {
      console.error('[UsersPage] saveNewUser:', err);
      showErr('Error creating user. Please try again.');
    }
  }

  function openEditUserModal(id) {
    _editUserId = id;
    var student = _displayedStudents.find(function (s) { return String(s.id) === String(id); });
    if (!student) { console.warn('[UsersPage] openEditUserModal: student not found', id); return; }
    var modal = document.getElementById('adminEdit');
    if (!modal) return;
    var err = document.getElementById('editUserError');
    if (err) { err.textContent = ''; err.style.display = 'none'; }
    var fnEl = document.getElementById('editUserFullname'); if (fnEl) fnEl.value = student.fullname || '';
    var emEl = document.getElementById('editUserEmail');    if (emEl) emEl.value = student.email    || '';
    var dpEl = document.getElementById('editUserDept');     if (dpEl) dpEl.value = student.department || '';
    var yrEl = document.getElementById('editUserYear');     if (yrEl) yrEl.value = student.year_level  || '1';
    var stEl = document.getElementById('editUserStatus');   if (stEl) stEl.value = student.status    || 'active';
    modal.classList.add('show');
  }

  function closeEditUserModal() {
    var modal = document.getElementById('adminEdit');
    if (modal) modal.classList.remove('show');
    _editUserId = null;
  }

  async function _saveEditUser(e) {
    e.preventDefault();
    if (!_editUserId) return;
    var fnEl = document.getElementById('editUserFullname');
    var emEl = document.getElementById('editUserEmail');
    var dpEl = document.getElementById('editUserDept');
    var yrEl = document.getElementById('editUserYear');
    var stEl = document.getElementById('editUserStatus');
    var fullname   = fnEl ? fnEl.value.trim() : '';
    var email      = emEl ? emEl.value.trim() : '';
    var department = dpEl ? dpEl.value : '';
    var year_level = yrEl ? yrEl.value : '';
    var status     = stEl ? stEl.value : 'active';
    var errEl = document.getElementById('editUserError');
    var showErr = function (msg) {
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; } else { alert(msg); }
    };
    if (!fullname || !email) { return showErr('Full Name and Email are required.'); }
    try {
      var res = await fetchWithCsrf('/api/admin/users/' + _editUserId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullname: fullname, email: email, department: department, year_level: year_level, status: status }),
      });
      var result = await res.json();
      if (!res.ok) { return showErr(result.message || 'Failed to update user.'); }
      closeEditUserModal();
      fetchStudentsData(currentFilters);
    } catch (err) {
      console.error('[UsersPage] saveEditUser:', err);
      showErr('Error updating user. Please try again.');
    }
  }

  function openDeleteUserModal(id) {
    _deleteUserId = id;
    var student = _displayedStudents.find(function (s) { return String(s.id) === String(id); });
    var nameEl = document.getElementById('deleteUserName');
    if (nameEl) nameEl.textContent = student ? student.fullname : 'this user';
    var modal = document.getElementById('modalDelete');
    if (modal) modal.classList.add('show');
  }

  function closeDeleteUserModal() {
    var modal = document.getElementById('modalDelete');
    if (modal) modal.classList.remove('show');
    _deleteUserId = null;
  }

  async function _confirmDeleteUser() {
    if (!_deleteUserId) return;
    try {
      var res = await fetchWithCsrf('/api/admin/users/' + _deleteUserId + '/soft-delete', { method: 'POST' });
      var result = await res.json();
      if (!res.ok) { alert(result.message || 'Failed to delete user.'); return; }
      closeDeleteUserModal();
      fetchStudentsData(currentFilters);
    } catch (err) {
      console.error('[UsersPage] confirmDeleteUser:', err);
      alert('Error deleting user. Please try again.');
    }
  }

  // ── init ─────────────────────────────────────────────────────────────────
  async function init() {
    if (!SA.utils.guardSuperAdmin()) return;

    // Extended delay to ensure backend session is fully loaded from store
    // on hard refresh (100ms gives enough time for MySQL session store)
    await new Promise(resolve => setTimeout(resolve, 100));
    var session = SA.utils.getSession();

    // Expose globals required by onclick handlers
    window.openBorrowModal        = openBorrowModal;
    window.closeBorrowModal       = closeBorrowModal;
    window.selectBookForBorrow    = selectBookForBorrow;
    window.selectCopy             = selectCopy;
    window.backToBookSelection    = backToBookSelection;
    window.backToCopySelection    = backToCopySelection;
    window.confirmBorrowing       = confirmBorrowing;
    window.openBulkBorrowModal    = openBulkBorrowModal;
    window.closeBulkBorrowModal   = closeBulkBorrowModal;
    window.addBookToBulkCart      = addBookToBulkCart;
    window.removeFromBulkCart     = removeFromBulkCart;
    window.confirmBulkBorrowing   = confirmBulkBorrowing;
    window.closeCopySelectionModal  = closeCopySelectionModal;
    window.fetchStudentsData         = fetchStudentsData;
    window.handleBulkEditUsersSubmit = _handleBulkEditSubmit;
    window.openAddUserModal          = openAddUserModal;
    window.closeAddUserModal         = closeAddUserModal;
    window.openEditUserModal         = openEditUserModal;
    window.closeEditUserModal        = closeEditUserModal;
    window.openDeleteUserModal       = openDeleteUserModal;
    window.closeDeleteUserModal      = closeDeleteUserModal;
    window.confirmDeleteUser         = _confirmDeleteUser;

    await SA.utils.loadAdminHeader(session.adminId);

    _injectStyles();
    _initFilters();
    _initRowClick();
    _initDeepLink();

    var addUserForm  = document.getElementById('addUserForm');
    var editUserForm = document.getElementById('editUserForm');
    if (addUserForm)  addUserForm.addEventListener('submit', _saveNewUser);
    if (editUserForm) editUserForm.addEventListener('submit', _saveEditUser);

    fetchStudentsData();
  }

  SA.UsersPage = { init: init };

}(window.SuperAdmin = window.SuperAdmin || {}));
