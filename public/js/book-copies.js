/**
 * BOOK COPY MANAGEMENT JAVASCRIPT
 * 
 * Handles individual book copy (accession number) management
 * - View all copies of a book
 * - Add new copies
 * - Update copy condition/location
 * - Borrow/return specific copies
 */

class BookCopyManager {
  constructor() {
    this.modal = null;
    this.currentBookId = null;
    this.currentCopies = [];
    this.init();
  }

  init() {
    this._injectStyles();
    this.createModal();
    this.bindEvents();
  }

  createModal() {
    const modalHTML = `
      <!-- ═══════════════ Book Copies / Edit Book Modal ═══════════════ -->
      <div id="copiesModal" class="modal sa-modal">
        <div class="sa-modal-content" style="max-width:900px;width:95%;">

          <!-- Green header -->
          <div class="sa-modal-header">
            <h2>
              <span class="material-symbols-outlined" id="copiesModalIcon">qr_code_2</span>
              <span id="copiesModalTitle">Book Copies</span>
            </h2>
            <button class="sa-modal-close-btn" type="button" onclick="bookCopyManager.closeModal()">&#x2715;</button>
          </div>

          <!-- White body -->
          <div class="sa-modal-body" style="overflow-y:auto;max-height:calc(100vh - 200px);">

            <!-- Book meta card -->
            <div class="bcm-meta">
              <div class="bcm-meta-top">
                <span id="copyBookTitle" class="bcm-meta-title">Loading&#8230;</span>
                <span id="copyBookStatus" class="bcm-status-pill"></span>
              </div>
              <div class="bcm-meta-grid">
                <div><span class="bcm-label">Author</span><span id="copyBookAuthor">&#8212;</span></div>
                <div><span class="bcm-label">Category</span><span id="copyBookCategory">&#8212;</span></div>
                <div><span class="bcm-label">ISBN</span><span id="copyBookISBN">&#8212;</span></div>
                <div><span class="bcm-label">Total Copies</span><span id="copyBookTotal">&#8212;</span></div>
                <div><span class="bcm-label">Available</span><span id="copyBookAvailable">&#8212;</span></div>
              </div>
            </div>

            <!-- Tab bar -->
            <div class="bcm-tabs">
              <button class="bcm-tab bcm-tab--active" id="tabBtnCopies" type="button"
                      onclick="bookCopyManager.switchTab('copies')">
                <span class="material-symbols-outlined">list_alt</span> Copies
              </button>
              <button class="bcm-tab" id="tabBtnEdit" type="button"
                      onclick="bookCopyManager.switchTab('edit')">
                <span class="material-symbols-outlined">edit</span> Edit Book
              </button>
            </div>

            <!-- ── Tab: Copies ── -->
            <div id="tabPaneCopies" class="bcm-tab-pane bcm-tab-pane--active">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h3 style="margin:0;font-size:14px;font-weight:700;color:#374151;">All Copies</h3>
                <button class="sa-btn sa-btn-success" type="button" onclick="bookCopyManager.showAddCopyForm()">
                  <span class="material-symbols-outlined" style="font-size:16px;">add</span>
                  Add New Copy
                </button>
              </div>
              <div class="table-wrapper" style="max-height:300px;overflow-y:auto;">
                <table class="user-table">
                  <thead>
                    <tr>
                      <th>Accession #</th>
                      <th>Copy #</th>
                      <th>Condition</th>
                      <th>Location</th>
                      <th>Status</th>
                      <th>Borrowed By</th>
                      <th>Due Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody id="copiesTableBody">
                    <tr><td colspan="8" class="text-center">Loading copies&#8230;</td></tr>
                  </tbody>
                </table>
              </div>
              <div class="sa-modal-footer" style="margin-top:4px;">
                <button class="sa-btn sa-btn-outline" type="button" onclick="bookCopyManager.exportCopies()">
                  <span class="material-symbols-outlined" style="font-size:16px;">download</span>
                  Export List
                </button>
                <button class="sa-btn sa-btn-outline" type="button" onclick="bookCopyManager.closeModal()">Close</button>
              </div>
            </div>

            <!-- ── Tab: Edit Book ── -->
            <div id="tabPaneEdit" class="bcm-tab-pane">
              <form id="editBookForm" style="padding-top:4px;">
                <div class="sa-form-group">
                  <label for="titleEdit">Title</label>
                  <input type="text" id="titleEdit" name="title" required />
                </div>
                <div class="sa-form-group">
                  <label for="authorEdit">Author</label>
                  <input type="text" id="authorEdit" name="author" required />
                </div>
                <div class="sa-form-group">
                  <label for="No#BooksEdit">No. of Books</label>
                  <input type="number" id="No#BooksEdit" name="No#Books" value="0" min="0" max="10" required />
                </div>
                <div class="sa-form-group">
                  <label for="categoryEdit">Category</label>
                  <input type="text" id="categoryEdit" name="category" required />
                </div>
                <div class="sa-form-group">
                  <label for="isbnEdit">ISBN</label>
                  <input type="text" id="isbnEdit" name="isbn" required />
                </div>
                <div class="sa-form-group">
                  <label for="statusEdit">Status</label>
                  <select id="statusEdit" name="status" required>
                    <option value="available">Available</option>
                    <option value="borrowed">Borrowed</option>
                  </select>
                </div>
                <div class="sa-form-group" id="studentSelectGroup" style="display:none;">
                  <label for="studentEdit">Assign to Student</label>
                  <select id="studentEdit" name="student">
                    <option value="">Select a student&#8230;</option>
                  </select>
                </div>
                <div class="sa-modal-footer">
                  <button type="submit" class="sa-btn sa-btn-success">Update Book</button>
                  <button type="button" class="sa-btn sa-btn-outline"
                          onclick="bookCopyManager.switchTab('copies')">&#x2190; Back</button>
                  <button type="button" class="sa-btn sa-btn-outline"
                          onclick="bookCopyManager.closeModal()">Cancel</button>
                </div>
              </form>
            </div>

          </div><!-- /.sa-modal-body -->
        </div><!-- /.sa-modal-content -->
      </div><!-- /#copiesModal -->

      <!-- ═══════════════ Add Copy Modal ═══════════════ -->
      <div id="addCopyModal" class="modal sa-modal">
        <div class="sa-modal-content" style="max-width:480px;width:90%;">
          <div class="sa-modal-header">
            <h2>
              <span class="material-symbols-outlined">add_circle</span>
              Add New Copy
            </h2>
            <button class="sa-modal-close-btn" type="button" onclick="bookCopyManager.closeAddCopyModal()">&#x2715;</button>
          </div>
          <div class="sa-modal-body">
            <form id="addCopyForm" onsubmit="bookCopyManager.submitAddCopy(event)">
              <div class="sa-form-group">
                <label>Condition <span style="color:#e53e3e;">*</span></label>
                <select id="newCopyCondition" required>
                  <option value="excellent">Excellent &#8212; Brand new</option>
                  <option value="good" selected>Good &#8212; Normal wear</option>
                  <option value="fair">Fair &#8212; Some damage</option>
                  <option value="poor">Poor &#8212; Heavy wear</option>
                </select>
              </div>
              <div class="sa-form-group">
                <label>Location</label>
                <input type="text" id="newCopyLocation" value="Main Library" />
              </div>
              <div class="sa-form-group">
                <label>Notes</label>
                <textarea id="newCopyNotes" rows="3" placeholder="Optional notes&#8230;"
                  style="width:100%;padding:.6rem .85rem;border:1.5px solid #d1d5db;border-radius:8px;
                         font-size:.9rem;box-sizing:border-box;resize:vertical;color:#111827;
                         background:#f9fafb;font-family:inherit;"></textarea>
              </div>
            </form>
          </div>
          <div class="sa-modal-footer">
            <button type="submit" form="addCopyForm" class="sa-btn sa-btn-success">Add Copy</button>
            <button type="button" class="sa-btn sa-btn-outline" onclick="bookCopyManager.closeAddCopyModal()">Cancel</button>
          </div>
        </div>
      </div><!-- /#addCopyModal -->
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('copiesModal');
  }

  bindEvents() {
    window.addEventListener('click', (e) => {
      if (e.target === this.modal) this.closeModal();
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────── ──────────────────────────────────────────────────────────────

  /** Inject scoped CSS for the bcm meta card and tabs (idempotent). */
  _injectStyles() {
    if (document.getElementById('sa-book-meta-styles')) return;
    const style = document.createElement('style');
    style.id = 'sa-book-meta-styles';
    style.textContent = [
      /* ── Modal shell fallback (kicks in when admins-modal.css is NOT loaded, e.g. on the static admin page) ── */
      '.modal.sa-modal:not(.show){display:none!important;}',
      '.modal.sa-modal.show{display:flex!important;align-items:center;justify-content:center;}',
      '#copiesModal .sa-modal-content,#addCopyModal .sa-modal-content{background:#fff;border-radius:16px;',
      'width:90%;box-shadow:0 24px 64px rgba(0,0,0,.25);overflow:hidden;}',
      '#copiesModal .sa-modal-header,#addCopyModal .sa-modal-header{',
      'background:linear-gradient(135deg,#1b5e20,#2e7d32,#43a047);',
      'padding:1.1rem 1.5rem;display:flex;align-items:center;justify-content:space-between;gap:.75rem;}',
      '#copiesModal .sa-modal-header h2,#addCopyModal .sa-modal-header h2{color:#fff;margin:0;',
      'font-size:1.1rem;font-weight:700;display:flex;align-items:center;gap:.5rem;}',
      '.sa-modal-close-btn{background:rgba(255,255,255,.18);border:none;color:#fff;',
      'width:30px;height:30px;border-radius:50%;cursor:pointer;',
      'display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;padding:0;}',
      '.sa-modal-close-btn:hover{background:rgba(255,255,255,.35);}',
      '#copiesModal .sa-modal-body,#addCopyModal .sa-modal-body{padding:1.4rem 1.5rem .5rem;}',
      '#copiesModal .sa-modal-footer,#addCopyModal .sa-modal-footer{display:flex;gap:.75rem;',
      'padding:1rem 1.5rem 1.4rem;border-top:1px solid #f0f0f0;}',
      /* ── sa-form-group fallback ── */
      '#copiesModal .sa-form-group,#addCopyModal .sa-form-group{margin-bottom:1rem;}',
      '#copiesModal .sa-form-group label,#addCopyModal .sa-form-group label{display:block;',
      'margin-bottom:.3rem;font-size:.85rem;font-weight:600;color:#374151;}',
      '#copiesModal .sa-form-group input,#copiesModal .sa-form-group select,#copiesModal .sa-form-group textarea,',
      '#addCopyModal .sa-form-group input,#addCopyModal .sa-form-group select,#addCopyModal .sa-form-group textarea{',
      'width:100%;padding:.6rem .85rem;border:1.5px solid #d1d5db;border-radius:8px;font-size:.9rem;',
      'color:#111827;background:#f9fafb;box-sizing:border-box;}',
      '#copiesModal .sa-form-group input:focus,#copiesModal .sa-form-group select:focus,#copiesModal .sa-form-group textarea:focus,',
      '#addCopyModal .sa-form-group input:focus,#addCopyModal .sa-form-group select:focus,#addCopyModal .sa-form-group textarea:focus{',
      'border-color:#2e7d32;box-shadow:0 0 0 3px rgba(46,125,50,.12);outline:none;background:#fff;}',
      /* meta strip — on white background so dark text */
      '#copiesModal .bcm-meta{background:#f0fdf4;border:1px solid #bbf7d0;',
      'border-radius:10px;padding:12px 16px;margin-bottom:14px;}',
      '#copiesModal .bcm-meta-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;}',
      '#copiesModal .bcm-meta-title{font-size:15px;font-weight:700;color:#14532d;}',
      '#copiesModal .bcm-meta-grid{display:grid;grid-template-columns:repeat(3,minmax(140px,1fr));',
      'gap:6px 14px;font-size:13px;color:#374151;}',
      '#copiesModal .bcm-label{display:block;font-size:11px;font-weight:600;',
      'color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin-bottom:1px;}',
      /* status pill */
      '#copiesModal .bcm-status-pill{padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;',
      'background:#d1fae5;color:#065f46;border:1px solid #6ee7b7;white-space:nowrap;}',
      '#copiesModal .bcm-pill-borrowed{background:#fee2e2!important;color:#991b1b!important;border-color:#fca5a5!important;}',
      '#copiesModal .bcm-pill-maintenance{background:#f3f4f6!important;color:#374151!important;border-color:#d1d5db!important;}',
      /* tab bar */
      '#copiesModal .bcm-tabs{display:flex;gap:4px;border-bottom:2px solid #e5e7eb;margin-bottom:14px;}',
      '#copiesModal .bcm-tab{display:flex;align-items:center;gap:6px;padding:8px 16px;',
      'border:none;background:transparent;color:#6b7280;font-size:13px;font-weight:600;',
      'cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .18s;border-radius:6px 6px 0 0;}',
      '#copiesModal .bcm-tab:hover{background:#f0fdf4;color:#2e7d32;}',
      '#copiesModal .bcm-tab--active{color:#1b5e20!important;border-bottom-color:#2e7d32!important;}',
      '#copiesModal .bcm-tab .material-symbols-outlined{font-size:16px;}',
      '#copiesModal .bcm-tab-pane{display:none;}',
      '#copiesModal .bcm-tab-pane--active{display:block;}',
      /* sa-btn fallback so buttons render on both admin and SA pages */
      '#copiesModal .sa-btn,#addCopyModal .sa-btn{display:inline-flex;align-items:center;gap:6px;',
      'padding:8px 16px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;',
      'border:1.5px solid transparent;transition:all .18s;text-decoration:none;}',
      '#copiesModal .sa-btn-success,#addCopyModal .sa-btn-success{background:#2e7d32;color:#fff;border-color:#2e7d32;}',
      '#copiesModal .sa-btn-success:hover,#addCopyModal .sa-btn-success:hover{background:#1b5e20;border-color:#1b5e20;}',
      '#copiesModal .sa-btn-outline,#addCopyModal .sa-btn-outline{background:#fff;color:#374151;border-color:#d1d5db;}',
      '#copiesModal .sa-btn-outline:hover,#addCopyModal .sa-btn-outline:hover{background:#f9fafb;border-color:#9ca3af;}',
      '@media(max-width:900px){#copiesModal .bcm-meta-grid{grid-template-columns:repeat(2,1fr);}}',
      '@media(max-width:520px){#copiesModal .bcm-meta-grid{grid-template-columns:1fr;}}',
    ].join('');
    document.head.appendChild(style);
  }

  /** Safely set an element's text content with a fallback. */
  _setText(id, value, fallback = '\u2014') {
    const el = document.getElementById(id);
    if (el) el.textContent = (value !== undefined && value !== null && String(value).trim() !== '') ? value : fallback;
  }

  /** Return display label + modifier class for a book status string. */
  _statusInfo(status) {
    const s = (status || '').toLowerCase().replace(/\s+/g, '_');
    if (s === 'available')                        return { label: 'Available',    cls: ''                   };
    if (s === 'borrowed' || s === 'all_borrowed') return { label: 'All Borrowed', cls: 'bcm-pill-borrowed'  };
    if (s === 'maintenance')                      return { label: 'Maintenance',  cls: 'bcm-pill-maintenance'};
    return { label: status || '\u2014', cls: '' };
  }

  /**
   * Fetch enriched book metadata.
   * Uses loadBookForEdit() from books.js when available (returns category,
   * quantity, available_quantity, current_status). Otherwise derives what
   * it can from the already-loaded copies array.
   */
  async _fetchBookMeta(bookId) {
    if (typeof loadBookForEdit === 'function') {
      try {
        const meta = await loadBookForEdit(bookId);
        if (meta) return meta;
      } catch (_) { /* fall through */ }
    }
    // Fallback: derive from copies data
    const first   = this.currentCopies[0] || {};
    const avail   = this.currentCopies.filter(c => c.status === 'available').length;
    const total   = this.currentCopies.length;
    return {
      title:              first.title  || null,
      author:             first.author || null,
      isbn:               first.isbn   || null,
      category:           null,
      quantity:           total,
      available_quantity: avail,
      current_status:     avail > 0 ? 'available' : (total ? 'borrowed' : null),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────

  /** Switch between 'copies' and 'edit' tabs. */
  switchTab(name) {
    const panels  = { copies: 'tabPaneCopies', edit: 'tabPaneEdit' };
    const buttons = { copies: 'tabBtnCopies',  edit: 'tabBtnEdit'  };
    Object.keys(panels).forEach(k => {
      const pane = document.getElementById(panels[k]);
      const btn  = document.getElementById(buttons[k]);
      if (pane) pane.classList.toggle('bcm-tab-pane--active', k === name);
      if (btn)  btn.classList.toggle('bcm-tab--active',   k === name);
    });
  }

  /**
   * Open the merged modal pre-filled on the Edit tab.
   * Called by openBookEditor() in books.js instead of #adminEdit.
   */
  openEditTab(book) {
    this.currentBookId = book.id;

    // Populate book meta card
    this._setText('copyBookTitle',    book.title);
    this._setText('copyBookAuthor',   book.author);
    this._setText('copyBookCategory', book.category);
    this._setText('copyBookISBN',     book.isbn);
    this._setText('copyBookTotal',     book.quantity);
    this._setText('copyBookAvailable', book.available_quantity);
    const { label, cls } = this._statusInfo(book.current_status);
    const statusEl = document.getElementById('copyBookStatus');
    if (statusEl) { statusEl.textContent = label; statusEl.className = `bcm-status-pill ${cls}`.trim(); }

    // Populate edit form
    const f = {
      title:    document.getElementById('titleEdit'),
      author:   document.getElementById('authorEdit'),
      quantity: document.getElementById('No#BooksEdit'),
      category: document.getElementById('categoryEdit'),
      isbn:     document.getElementById('isbnEdit'),
      status:   document.getElementById('statusEdit'),
    };
    if (f.title)    f.title.value    = book.title    || '';
    if (f.author)   f.author.value   = book.author   || '';
    if (f.quantity) f.quantity.value = book.quantity  || '';
    if (f.category) f.category.value = book.category || '';
    if (f.isbn)     f.isbn.value     = book.isbn      || '';
    if (f.status)   f.status.value   = (book.current_status || '').toLowerCase() === 'borrowed' ? 'borrowed' : 'available';

    const studentGroup = document.getElementById('studentSelectGroup');
    const studentEl    = document.getElementById('studentEdit');
    const isBorrowed   = f.status && f.status.value === 'borrowed';
    if (studentGroup) studentGroup.style.display = isBorrowed ? 'block' : 'none';
    if (studentEl)    studentEl.required = isBorrowed;

    this.switchTab('edit');
    this.modal.classList.add('show');
    this.modal.style.display = 'flex';
    document.body.classList.add('modal-open');
  }

  async showCopies(bookId) {
    this.currentBookId = bookId;
    this.switchTab('copies');
    this.modal.classList.add('show');
    this.modal.style.display = 'flex';
    document.body.classList.add('modal-open');

    // Reset to loading placeholders
    this._setText('copyBookTitle', 'Loading…', 'Loading…');
    ['copyBookAuthor','copyBookCategory','copyBookISBN','copyBookTotal','copyBookAvailable'].forEach(id => this._setText(id, null));
    const statusEl = document.getElementById('copyBookStatus');
    if (statusEl) { statusEl.textContent = ''; statusEl.className = 'bcm-status-pill'; }
    document.getElementById('copiesTableBody').innerHTML = '<tr><td colspan="8" class="text-center">Loading copies…</td></tr>';

    try {
      const response = await fetchWithCsrf(`/api/book-copies/${bookId}`);
      if (!response.ok) throw new Error('Failed to fetch copies');

      const result = await response.json();
      this.currentCopies = result.data || [];

      // Fetch enriched metadata (category / quantity / available_quantity / status)
      const meta = await this._fetchBookMeta(bookId);

      // ── Populate book meta card ──
      this._setText('copyBookTitle',
        meta.title   || (this.currentCopies[0] && this.currentCopies[0].title));
      this._setText('copyBookAuthor',
        meta.author  || (this.currentCopies[0] && this.currentCopies[0].author));
      this._setText('copyBookCategory', meta.category);
      this._setText('copyBookISBN',
        meta.isbn    || (this.currentCopies[0] && this.currentCopies[0].isbn));

      const total     = (meta.quantity           != null) ? meta.quantity           : this.currentCopies.length;
      const available = (meta.available_quantity != null) ? meta.available_quantity : this.currentCopies.filter(c => c.status === 'available').length;
      this._setText('copyBookTotal',     total);
      this._setText('copyBookAvailable', available);

      // Status pill
      const rawStatus = meta.current_status ||
        (available > 0 ? 'available' : (this.currentCopies.length ? 'borrowed' : null));
      const { label, cls } = this._statusInfo(rawStatus);
      if (statusEl) { statusEl.textContent = label; statusEl.className = `bcm-status-pill ${cls}`.trim(); }

      this.renderCopiesTable();

    } catch (error) {
      console.error('Error loading copies:', error);
      alert('Failed to load book copies. Please try again.');
      this.closeModal();
    }
  }

  renderCopiesTable() {
    const tbody = document.getElementById('copiesTableBody');
    
    if (this.currentCopies.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">No copies found</td></tr>';
      return;
    }
    
    tbody.innerHTML = this.currentCopies.map(copy => {
      const conditionClass = {
        'excellent': 'status-excellent',
        'good': 'status-good',
        'fair': 'status-fair',
        'poor': 'status-poor',
        'damaged': 'status-damaged'
      }[copy.condition_status] || '';
      
      const statusClass = {
        'available': 'status-available',
        'borrowed': 'status-borrowed',
        'maintenance': 'status-maintenance',
        'lost': 'status-lost'
      }[copy.status] || '';
      
      const borrowedBy = copy.borrowed_by || '-';
      const dueDate = copy.due_date ? new Date(copy.due_date).toLocaleDateString() : '-';
      
      return `
        <tr data-accession="${copy.accession_number}">
          <td><strong>${copy.accession_number}</strong></td>
          <td>#${copy.copy_number}</td>
          <td><span class="status-badge ${conditionClass}">${copy.condition_status}</span></td>
          <td>${copy.location || 'Main Library'}</td>
          <td><span class="status-badge ${statusClass}">${copy.status}</span></td>
          <td>${borrowedBy}</td>
          <td>${dueDate}</td>
          <td>
            <button class="action-btn btn-view" onclick="bookCopyManager.openCopyQr('${copy.accession_number}')" title="View QR Code">
              <span class="material-symbols-outlined">qr_code_2</span>
            </button>
            <button class="action-btn btn-edit" onclick="bookCopyManager.editCopy('${copy.accession_number}')" title="Edit">
              <span class="material-symbols-outlined">edit</span>
            </button>
            <button class="action-btn btn-view" onclick="bookCopyManager.viewAudit('${copy.accession_number}')" title="History">
              <span class="material-symbols-outlined">history</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  showAddCopyForm() {
    const m = document.getElementById('addCopyModal');
    m.classList.add('show');
    m.style.display = 'flex';
    document.body.classList.add('modal-open');
  }

  closeAddCopyModal() {
    const m = document.getElementById('addCopyModal');
    m.classList.remove('show');
    m.style.display = 'none';
    document.getElementById('addCopyForm').reset();
  }

  async submitAddCopy(event) {
    event.preventDefault();
    
    const condition = document.getElementById('newCopyCondition').value;
    const location = document.getElementById('newCopyLocation').value;
    const notes = document.getElementById('newCopyNotes').value;
    
    try {
      const response = await fetchWithCsrf('/api/book-copies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: this.currentBookId,
          condition_status: condition,
          location: location || 'Main Library',
          notes: notes
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to add copy');
      }
      
      const qrDataUrl = result?.data?.qr_code_data_url;
      const qrImageUrl = result?.data?.qr_code_image_url;
      alert(`✅ New copy added: ${result.data.accession_number}`);
      this.showQrPreview(result.data.accession_number, qrDataUrl, qrImageUrl);
      
      // Close add modal and refresh copies list
      this.closeAddCopyModal();
      await this.showCopies(this.currentBookId);
      
      // Reload books table if it exists
      if (typeof loadBooks === 'function') {
        await loadBooks();
      }
      
    } catch (error) {
      console.error('Error adding copy:', error);
      alert('Failed to add copy: ' + error.message);
    }
  }

  async openCopyQr(accessionNumber) {
    const imagePath = `/api/book-copies/qr/${encodeURIComponent(accessionNumber)}`;
    const imageUrl = new URL(imagePath, window.location.origin).toString();
    const popup = window.open('', '_blank', 'width=420,height=520');
    if (!popup) {
      window.open(imageUrl, '_blank');
      return;
    }

    popup.document.write(`
      <html>
        <head>
          <title>QR - ${accessionNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 16px; text-align: center; }
            h2 { margin: 0 0 8px; color: #14532d; font-size: 18px; }
            p { margin: 0 0 12px; color: #4b5563; }
            img { width: 300px; height: 300px; border: 1px solid #e5e7eb; border-radius: 8px; }
            .hint { margin-top: 12px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <h2>${accessionNumber}</h2>
          <p>Generated QR code for this copy</p>
          <img id="copyQrImage" alt="QR code for ${accessionNumber}" />
          <div id="copyQrHint" class="hint">Loading QR image...</div>
        </body>
      </html>
    `);
    popup.document.close();

    try {
      const doFetch = (typeof fetchWithCsrf === 'function') ? fetchWithCsrf : fetch;
      const qrResponse = await doFetch(imagePath, { method: 'GET' });
      if (!qrResponse.ok) throw new Error(`QR request failed (${qrResponse.status})`);

      const qrBlob = await qrResponse.blob();
      const blobUrl = URL.createObjectURL(qrBlob);

      const qrImgEl = popup.document.getElementById('copyQrImage');
      const hintEl = popup.document.getElementById('copyQrHint');
      if (qrImgEl) qrImgEl.src = blobUrl;
      if (hintEl) hintEl.textContent = 'QR ready';
    } catch (error) {
      const qrImgEl = popup.document.getElementById('copyQrImage');
      const hintEl = popup.document.getElementById('copyQrHint');
      if (qrImgEl) qrImgEl.src = imageUrl;
      if (hintEl) hintEl.textContent = 'Loaded with fallback path';
      console.warn('QR fetch fallback used:', error.message);
    }
  }

  showQrPreview(accessionNumber, qrDataUrl, qrImageUrl) {
    const popup = window.open('', '_blank', 'width=420,height=520');
    if (!popup) {
      if (qrImageUrl) {
        window.open(new URL(qrImageUrl, window.location.origin).toString(), '_blank');
      }
      return;
    }

    const fallbackPath = `/api/book-copies/qr/${encodeURIComponent(accessionNumber)}`;
    const src = qrDataUrl
      || (qrImageUrl ? new URL(qrImageUrl, window.location.origin).toString() : '')
      || new URL(fallbackPath, window.location.origin).toString();
    popup.document.write(`
      <html>
        <head>
          <title>New Copy QR - ${accessionNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 16px; text-align: center; }
            h2 { margin: 0 0 8px; color: #14532d; font-size: 18px; }
            p { margin: 0 0 16px; color: #4b5563; }
            img { width: 300px; height: 300px; border: 1px solid #e5e7eb; border-radius: 8px; }
          </style>
        </head>
        <body>
          <h2>${accessionNumber}</h2>
          <p>QR code generated successfully</p>
          <img src="${src}" alt="QR code for ${accessionNumber}" />
        </body>
      </html>
    `);
    popup.document.close();
  }

  async editCopy(accessionNumber) {
    const copy = this.currentCopies.find(c => c.accession_number === accessionNumber);
    if (!copy) return;
    
    const newCondition = prompt(
      `Update condition for ${accessionNumber}\n\nCurrent: ${copy.condition_status}\n\nOptions: excellent, good, fair, poor, damaged`,
      copy.condition_status
    );
    
    if (newCondition && ['excellent', 'good', 'fair', 'poor', 'damaged'].includes(newCondition.toLowerCase())) {
      try {
        const response = await fetchWithCsrf(`/api/book-copies/${accessionNumber}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ condition_status: newCondition.toLowerCase() })
        });
        
        if (!response.ok) throw new Error('Update failed');
        
        alert('✅ Copy updated successfully');
        await this.showCopies(this.currentBookId);
        
      } catch (error) {
        alert('Failed to update copy: ' + error.message);
      }
    }
  }

  async viewAudit(accessionNumber) {
    try {
      const response = await fetchWithCsrf(`/api/book-copies/audit/${accessionNumber}`);
      const result = await response.json();
      const audit = result.data || [];
      
      if (audit.length === 0) {
        alert('No audit history found for this copy.');
        return;
      }
      
      const auditText = audit.map(entry => 
        `[${new Date(entry.performed_at).toLocaleString()}] ${entry.action} by ${entry.performed_by_name || 'System'}\n${entry.notes || ''}`
      ).join('\n\n');
      
      alert(`Audit History for ${accessionNumber}\n\n${auditText}`);
      
    } catch (error) {
      alert('Failed to load audit history');
    }
  }

  exportCopies() {
    const csv = [
      ['Accession Number', 'Copy Number', 'Condition', 'Location', 'Status', 'Borrowed By', 'Due Date'].join(','),
      ...this.currentCopies.map(copy => [
        copy.accession_number,
        copy.copy_number,
        copy.condition_status,
        copy.location || '',
        copy.status,
        copy.borrowed_by || '',
        copy.due_date ? new Date(copy.due_date).toLocaleDateString() : ''
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `copies_book_${this.currentBookId}_${Date.now()}.csv`;
    a.click();
  }

  closeModal() {
    this.modal.classList.remove('show');
    this.modal.style.display = 'none';
    document.body.classList.remove('modal-open');
    this.currentBookId = null;
    this.currentCopies = [];
  }
}

// Initialize globally
let bookCopyManager;
document.addEventListener('DOMContentLoaded', () => {
  bookCopyManager = new BookCopyManager();
});
