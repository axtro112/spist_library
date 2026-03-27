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
    this.qrModal = null;
    this.qrModalImage = null;
    this.qrModalHint = null;
    this.qrModalTitle = null;
    this.qrModalSubtitle = null;
    this.qrModalError = null;
    this.qrPrintBtn = null;
    this.qrDownloadBtn = null;
    this._qrCleanup = null;
    this._qrActiveSource = '';
    this._qrEndpointPath = '';
    this._qrCurrentBookTitle = '';
    this.init();
  }

  init() {
    this.createModal();
    this.bindEvents();
  }

  createModal() {
    const modalHTML = `
      <!-- ═══════════════ Book Copies / Edit Book Modal ═══════════════ -->
      <div id="copiesModal" class="modal sa-modal">
        <div class="sa-modal-dialog sa-modal-xl">
        <div class="sa-modal-content">

          <!-- Green header -->
          <div class="sa-modal-header">
            <h2>
              <span class="material-symbols-outlined" id="copiesModalIcon">qr_code_2</span>
              <span id="copiesModalTitle">Book Copies</span>
            </h2>
            <button class="sa-modal-close sa-modal-close-btn" type="button" onclick="bookCopyManager.closeModal()">&#x2715;</button>
          </div>

          <div class="sa-modal-summary">
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
          </div>

          <!-- White body -->
          <div class="sa-modal-body">

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
              <div class="bcm-pane-head">
                <h3>All Copies</h3>
                <button class="sa-btn sa-btn-success" type="button" onclick="bookCopyManager.showAddCopyForm()">
                  <span class="material-symbols-outlined">add</span>
                  Add New Copy
                </button>
              </div>
              <div class="sa-modal-table-wrap bcm-copies-table">
                <table class="user-table">
                  <thead>
                    <tr>
                      <th class="bcm-select-col">
                        <input type="checkbox" id="selectAllCopies" title="Select all" class="bcm-copy-checkbox" />
                      </th>
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
                    <tr><td colspan="9" class="text-center">Loading copies&#8230;</td></tr>
                  </tbody>
                </table>
              </div>
              <div class="sa-modal-footer bcm-copies-footer sa-modal-actions-stack">
                <button class="sa-btn sa-btn-success" type="button" onclick="bookCopyManager.bulkPrintQrLabels(false)">
                  <span class="material-symbols-outlined">print</span>
                  Print All QR
                </button>
                <button class="sa-btn sa-btn-outline" type="button" id="printSelectedQrBtn" onclick="bookCopyManager.bulkPrintQrLabels(true)" disabled>
                  <span class="material-symbols-outlined">checklist</span>
                  Print Selected
                </button>
                <button class="sa-btn sa-btn-outline" type="button" onclick="bookCopyManager.exportCopies()">
                  <span class="material-symbols-outlined">download</span>
                  Export List
                </button>
                <button class="sa-btn sa-btn-outline" type="button" onclick="bookCopyManager.closeModal()">Close</button>
              </div>
            </div>

            <!-- ── Tab: Edit Book ── -->
            <div id="tabPaneEdit" class="bcm-tab-pane">
              <form id="editBookForm" class="sa-modal-form bcm-edit-form">
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
                <div class="sa-form-group bcm-hidden" id="studentSelectGroup">
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
        </div><!-- /.sa-modal-dialog -->
      </div><!-- /#copiesModal -->

      <!-- ═══════════════ Add Copy Modal ═══════════════ -->
      <div id="addCopyModal" class="modal sa-modal">
        <div class="sa-modal-dialog sa-modal-sm">
        <div class="sa-modal-content">
          <div class="sa-modal-header">
            <h2>
              <span class="material-symbols-outlined">add_circle</span>
              Add New Copy
            </h2>
            <button class="sa-modal-close sa-modal-close-btn" type="button" onclick="bookCopyManager.closeAddCopyModal()">&#x2715;</button>
          </div>
          <div class="sa-modal-body">
            <form id="addCopyForm" onsubmit="bookCopyManager.submitAddCopy(event)">
              <div class="sa-form-group">
                <label>Condition <span class="req">*</span></label>
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
                <textarea id="newCopyNotes" class="bcm-notes" rows="3" placeholder="Optional notes&#8230;"></textarea>
              </div>
            </form>
          </div>
          <div class="sa-modal-footer">
            <button type="submit" form="addCopyForm" class="sa-btn sa-btn-success">Add Copy</button>
            <button type="button" class="sa-btn sa-btn-outline" onclick="bookCopyManager.closeAddCopyModal()">Cancel</button>
          </div>
        </div>
        </div>
      </div><!-- /#addCopyModal -->

      <!-- ═══════════════ QR Preview Modal ═══════════════ -->
      <div id="qrCodeModal" class="modal sa-modal">
        <div class="sa-modal-dialog sa-modal-sm">
        <div class="sa-modal-content qr-modal-content">
          <div class="sa-modal-header">
            <h2 id="qrModalTitle">QR Code</h2>
            <button class="sa-modal-close sa-modal-close-btn" id="qrModalCloseIconBtn" type="button">&#x2715;</button>
          </div>
          <div class="sa-modal-body qr-modal-body">
            <p id="qrModalSubtitle" class="qr-modal-subtitle">Accession Number</p>
            <div class="qr-modal-image-wrap">
              <img id="qrModalImage" alt="QR Code" />
            </div>
            <div id="qrModalHint" class="qr-modal-hint">Preparing QR image...</div>
            <div id="qrModalError" class="qr-modal-error"></div>
          </div>
          <div class="sa-modal-footer qr-modal-actions sa-modal-actions-stack">
            <button type="button" id="qrPrintBtn" class="sa-btn sa-btn-outline" disabled>Print QR</button>
            <button type="button" id="qrDownloadBtn" class="sa-btn sa-btn-success" disabled>Download</button>
            <button type="button" id="qrCloseBtn" class="sa-btn sa-btn-outline">Close</button>
          </div>
        </div>
        </div>
      </div>

      <!-- ═══════════════ Audit History Modal ═══════════════ -->
      <div id="auditModal" class="modal sa-modal">
        <div class="sa-modal-dialog sa-modal-sm" style="width:min(100%,520px)">
        <div class="sa-modal-content">
          <div class="sa-modal-header">
            <h2>
              <span class="material-symbols-outlined">history</span>
              <span id="auditModalTitle">Audit History</span>
            </h2>
            <button class="sa-modal-close sa-modal-close-btn" type="button"
                    onclick="bookCopyManager.closeAuditModal()">&#x2715;</button>
          </div>
          <div class="sa-modal-body" style="padding:0;">
            <div id="auditModalAccession" style="
              padding: 10px 20px 10px;
              font-size: 13px;
              font-weight: 600;
              color: #2e7d32;
              background: #f0faf0;
              border-bottom: 1px solid #c8e6c9;
              letter-spacing: 0.3px;
            "></div>
            <div id="auditModalBody" style="
              max-height: 400px;
              overflow-y: auto;
              padding: 12px 20px;
            ">
              <div class="notif-loading">Loading&#8230;</div>
            </div>
          </div>
          <div class="sa-modal-footer">
            <button type="button" class="sa-btn sa-btn-outline" onclick="bookCopyManager.closeAuditModal()">Close</button>
          </div>
        </div>
        </div>
      </div>

      <!-- ═══════════════ Edit Condition Modal ═══════════════ -->
      <div id="editConditionModal" class="modal sa-modal">
        <div class="sa-modal-dialog sa-modal-sm">
        <div class="sa-modal-content">
          <div class="sa-modal-header">
            <h2>
              <span class="material-symbols-outlined">edit</span>
              <span>Update Condition</span>
            </h2>
            <button class="sa-modal-close sa-modal-close-btn" type="button"
                    onclick="bookCopyManager.closeEditConditionModal()">✕</button>
          </div>
          <div class="sa-modal-body">
            <div style="margin-bottom:12px;">
              <div style="font-size:12px;color:#6b7280;font-weight:500;margin-bottom:4px;">Accession Number</div>
              <div id="editCondAccession" style="font-size:14px;font-weight:600;color:#1b5e20;letter-spacing:0.5px;"></div>
            </div>
            <div style="margin-bottom:16px;">
              <div style="font-size:12px;color:#6b7280;font-weight:500;margin-bottom:4px;">Current Condition</div>
              <div id="editCondCurrent" style="font-size:13px;color:#374151;padding:8px;background:#f3f4f6;border-radius:6px;text-transform:capitalize;"></div>
            </div>
            <form id="editConditionForm" onsubmit="bookCopyManager.submitEditCondition(event)" style="margin-bottom:8px;">
              <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:600;color:#374151;">New Condition</label>
              <select id="editCondSelect" name="condition" required style="
                width:100%;
                padding:8px 12px;
                border:1.5px solid #d1d5db;
                border-radius:8px;
                font-size:13px;
                background:#fff;
                color:#111827;
                cursor:pointer;
                transition:border-color 0.2s;
              ">
                <option value="">-- Select --</option>
                <option value="excellent">Excellent — Brand new</option>
                <option value="good">Good — Normal wear</option>
                <option value="fair">Fair — Some damage</option>
                <option value="poor">Poor — Heavy wear</option>
                <option value="damaged">Damaged — Needs repair</option>
              </select>
            </form>
          </div>
          <div class="sa-modal-footer">
            <button type="submit" form="editConditionForm" class="sa-btn sa-btn-success">Update</button>
            <button type="button" class="sa-btn sa-btn-outline" onclick="bookCopyManager.closeEditConditionModal()">Cancel</button>
          </div>
        </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('copiesModal');
    this.qrModal = document.getElementById('qrCodeModal');
    this.qrModalImage = document.getElementById('qrModalImage');
    this.qrModalHint = document.getElementById('qrModalHint');
    this.qrModalTitle = document.getElementById('qrModalTitle');
    this.qrModalSubtitle = document.getElementById('qrModalSubtitle');
    this.qrModalError = document.getElementById('qrModalError');
    this.qrPrintBtn = document.getElementById('qrPrintBtn');
    this.qrDownloadBtn = document.getElementById('qrDownloadBtn');
    this.auditModal = document.getElementById('auditModal');
    this.editConditionModal = document.getElementById('editConditionModal');
  }

  bindEvents() {
    window.addEventListener('click', (e) => {
      if (e.target === this.modal) this.closeModal();
      if (e.target === this.qrModal) this.closeQrModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const closed = this._handleEscapeClose();
      if (closed) e.preventDefault();
    });

    const qrCloseBtn = document.getElementById('qrCloseBtn');
    const qrCloseIconBtn = document.getElementById('qrModalCloseIconBtn');
    if (qrCloseBtn) qrCloseBtn.addEventListener('click', () => this.closeQrModal());
    if (qrCloseIconBtn) qrCloseIconBtn.addEventListener('click', () => this.closeQrModal());
    if (this.qrPrintBtn) this.qrPrintBtn.addEventListener('click', () => this.printQrModal());
    if (this.qrDownloadBtn) this.qrDownloadBtn.addEventListener('click', () => this.downloadQrModal());
  }

  // ── Helpers ────────────────────────────────────────────────────────────── ──────────────────────────────────────────────────────────────

  /** Styles are now defined in external shared CSS; keep as no-op for compatibility. */
  _injectStyles() {
    return;
  }

  /** Safely set an element's text content with a fallback. */
  _setText(id, value, fallback = '\u2014') {
    const el = document.getElementById(id);
    if (el) el.textContent = (value !== undefined && value !== null && String(value).trim() !== '') ? value : fallback;
  }

  _escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Return display label + modifier class for a book status string. */
  _statusInfo(status) {
    const s = (status || '').toLowerCase().replace(/\s+/g, '_');
    if (s === 'available')                        return { label: 'Available',    cls: ''                   };
    if (s === 'borrowed' || s === 'all_borrowed') return { label: 'All Borrowed', cls: 'bcm-pill-borrowed'  };
    if (s === 'maintenance')                      return { label: 'Maintenance',  cls: 'bcm-pill-maintenance'};
    return { label: status || '\u2014', cls: '' };
  }

  _isModalVisible(el) {
    return !!el && el.classList.contains('show') && el.style.display !== 'none';
  }

  _syncBodyModalOpenState() {
    const addCopyModal = document.getElementById('addCopyModal');
    const hasOpenModal = this._isModalVisible(this.modal)
      || this._isModalVisible(addCopyModal)
      || this._isModalVisible(this.qrModal);
    document.body.classList.toggle('modal-open', hasOpenModal);
  }

  _handleEscapeClose() {
    const addCopyModal = document.getElementById('addCopyModal');

    // Close top-most modal first.
    if (this._isModalVisible(this.qrModal)) {
      this.closeQrModal();
      return true;
    }

    if (this._isModalVisible(addCopyModal)) {
      this.closeAddCopyModal();
      return true;
    }

    if (this._isModalVisible(this.modal)) {
      this.closeModal();
      return true;
    }

    return false;
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
        const meta = await Promise.race([
          loadBookForEdit(bookId),
          new Promise((resolve) => setTimeout(() => resolve(null), 3500))
        ]);
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
    this._syncBodyModalOpenState();
  }

  async showCopies(bookId) {
    this.currentBookId = bookId;
    this.switchTab('copies');
    this.modal.classList.add('show');
    this.modal.style.display = 'flex';
    this._syncBodyModalOpenState();

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

      // Render copies first so the table never gets stuck in a loading state
      // if metadata fetching is slow or unavailable.
      this.renderCopiesTable();

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

    } catch (error) {
      console.error('Error loading copies:', error);
      showToast('Failed to load book copies. Please try again.', 'error');
      this.closeModal();
    }
  }

  renderCopiesTable() {
    const tbody = document.getElementById('copiesTableBody');

    // Reset select-all checkbox and Print Selected button state
    const selectAll = document.getElementById('selectAllCopies');
    if (selectAll) { selectAll.checked = false; selectAll.indeterminate = false; }
    const printSelBtn = document.getElementById('printSelectedQrBtn');
    if (printSelBtn) printSelBtn.disabled = true;
    
    if (this.currentCopies.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center">No copies found</td></tr>';
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
          <td class="bcm-select-col">
            <input type="checkbox" class="copy-row-check bcm-copy-checkbox" data-accession="${copy.accession_number}" />
          </td>
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

    // Bind checkbox listeners after rows are injected
    this._bindCopyCheckboxes();
  }

  _bindCopyCheckboxes() {
    const selectAll = document.getElementById('selectAllCopies');
    const printSelBtn = document.getElementById('printSelectedQrBtn');

    const syncState = () => {
      const all = document.querySelectorAll('.copy-row-check');
      const checked = document.querySelectorAll('.copy-row-check:checked');
      if (selectAll) {
        selectAll.checked = checked.length === all.length && all.length > 0;
        selectAll.indeterminate = checked.length > 0 && checked.length < all.length;
      }
      if (printSelBtn) printSelBtn.disabled = checked.length === 0;
    };

    document.querySelectorAll('.copy-row-check').forEach(cb => {
      cb.addEventListener('change', syncState);
    });

    if (selectAll) {
      // Replace old listener by cloning the node
      const fresh = selectAll.cloneNode(true);
      selectAll.parentNode.replaceChild(fresh, selectAll);
      fresh.addEventListener('change', () => {
        document.querySelectorAll('.copy-row-check').forEach(cb => {
          cb.checked = fresh.checked;
        });
        if (printSelBtn) printSelBtn.disabled = !fresh.checked;
      });
    }
  }

  _getSelectedCopies() {
    const checked = document.querySelectorAll('.copy-row-check:checked');
    const accessions = Array.from(checked).map(cb => cb.dataset.accession);
    return this.currentCopies.filter(c => accessions.includes(c.accession_number));
  }

  showAddCopyForm() {
    const m = document.getElementById('addCopyModal');
    m.classList.add('show');
    m.style.display = 'flex';
    this._syncBodyModalOpenState();
  }

  closeAddCopyModal() {
    const m = document.getElementById('addCopyModal');
    m.classList.remove('show');
    m.style.display = 'none';
    document.getElementById('addCopyForm').reset();
    this._syncBodyModalOpenState();
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
      showToast(`✅ New copy added: ${result.data.accession_number}`, 'success');
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
      showToast('Failed to add copy: ' + error.message, 'error');
    }
  }

  _getQrEndpoint(accessionNumber) {
    return `/api/book-copies/qr/${encodeURIComponent(accessionNumber)}`;
  }

  async _resolveQrSource(accessionNumber, qrDataUrl, qrImageUrl) {
    const endpointPath = this._getQrEndpoint(accessionNumber);
    const endpointAbsolute = new URL(endpointPath, window.location.origin).toString();

    // Prefer already-generated data URL from create-copy response.
    if (qrDataUrl && typeof qrDataUrl === 'string' && qrDataUrl.startsWith('data:image/')) {
      return {
        src: qrDataUrl,
        sourceType: 'data-url',
        endpointPath,
        endpointAbsolute,
        revoke: null
      };
    }

    // Then prefer authenticated blob fetch for stable rendering in about:blank popups.
    try {
      const doFetch = (typeof fetchWithCsrf === 'function') ? fetchWithCsrf : fetch;
      const qrResponse = await doFetch(endpointPath, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store'
      });

      if (qrResponse.ok) {
        const qrBlob = await qrResponse.blob();
        const blobUrl = URL.createObjectURL(qrBlob);
        return {
          src: blobUrl,
          sourceType: 'blob-url',
          endpointPath,
          endpointAbsolute,
          revoke: () => URL.revokeObjectURL(blobUrl)
        };
      }
    } catch (error) {
      console.warn('QR blob fetch failed, trying URL fallback:', error.message);
    }

    // Last fallback to URL from API response if available.
    if (qrImageUrl) {
      return {
        src: new URL(qrImageUrl, window.location.origin).toString(),
        sourceType: 'response-url',
        endpointPath,
        endpointAbsolute,
        revoke: null
      };
    }

    // Final fallback to absolute endpoint URL.
    return {
      src: endpointAbsolute,
      sourceType: 'absolute-endpoint',
      endpointPath,
      endpointAbsolute,
      revoke: null
    };
  }

  _resetQrModalState(accessionNumber) {
    if (this.qrModalTitle) this.qrModalTitle.textContent = 'QR Code';
    if (this.qrModalSubtitle) this.qrModalSubtitle.textContent = accessionNumber || 'Accession Number';
    if (this.qrModalHint) this.qrModalHint.textContent = 'Preparing QR image...';
    if (this.qrModalError) {
      this.qrModalError.textContent = '';
      this.qrModalError.style.display = 'none';
    }
    if (this.qrPrintBtn) this.qrPrintBtn.disabled = true;
    if (this.qrDownloadBtn) this.qrDownloadBtn.disabled = true;
    if (this.qrModalImage) {
      this.qrModalImage.removeAttribute('src');
      this.qrModalImage.onload = null;
      this.qrModalImage.onerror = null;
    }
  }

  _setQrError(message) {
    if (this.qrModalHint) this.qrModalHint.textContent = 'Unable to load QR image';
    if (this.qrModalError) {
      this.qrModalError.textContent = message || 'QR image failed to load.';
      this.qrModalError.style.display = 'block';
    }
    if (this.qrPrintBtn) this.qrPrintBtn.disabled = true;
    if (this.qrDownloadBtn) this.qrDownloadBtn.disabled = true;
  }

  async _downloadQrFromSource(accessionNumber, activeSource, endpointPath) {
    const fileName = `${accessionNumber}-qr.png`;

    const triggerDownload = (href) => {
      const a = document.createElement('a');
      a.href = href;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    };

    if (activeSource && activeSource.startsWith('data:image/')) {
      triggerDownload(activeSource);
      return;
    }

    try {
      const doFetch = (typeof fetchWithCsrf === 'function') ? fetchWithCsrf : fetch;
      const resp = await doFetch(endpointPath, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (!resp.ok) throw new Error(`Download failed (${resp.status})`);

      const pngBlob = await resp.blob();
      const blobUrl = URL.createObjectURL(pngBlob);
      triggerDownload(blobUrl);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
      throw new Error(`Unable to download QR image: ${error.message}`);
    }
  }

  async _openQrModal(accessionNumber, qrDataUrl, qrImageUrl) {
    if (!this.qrModal || !this.qrModalImage) return false;

    this.closeQrModal(true);
    this._resetQrModalState(accessionNumber);

    this._qrEndpointPath = this._getQrEndpoint(accessionNumber);
    this._qrActiveSource = '';
    this.qrModal.classList.add('show');
    this.qrModal.style.display = 'flex';
    this._syncBodyModalOpenState();

    let retriedWithAbsoluteUrl = false;

    try {
      const resolved = await this._resolveQrSource(accessionNumber, qrDataUrl, qrImageUrl);
      this._qrActiveSource = resolved.src;
      this._qrEndpointPath = resolved.endpointPath;
      this._qrCleanup = resolved.revoke;

      this.qrModalImage.onload = () => {
        if (this.qrModalHint) this.qrModalHint.textContent = 'QR ready';
        if (this.qrPrintBtn) this.qrPrintBtn.disabled = false;
        if (this.qrDownloadBtn) this.qrDownloadBtn.disabled = false;
      };

      this.qrModalImage.onerror = () => {
        if (!retriedWithAbsoluteUrl) {
          retriedWithAbsoluteUrl = true;
          this.qrModalImage.src = `${resolved.endpointAbsolute}?_=${Date.now()}`;
          if (this.qrModalHint) this.qrModalHint.textContent = 'Retrying image load...';
          return;
        }

        this._setQrError('QR image failed to load. Please try again.');
      };

      this.qrModalImage.src = this._qrActiveSource;
      return true;
    } catch (error) {
      this._setQrError(`Failed to load QR image: ${error.message}`);
      return false;
    }
  }

  async openCopyQr(accessionNumber) {
    const copy = this.currentCopies.find(c => c.accession_number === accessionNumber);
    this._qrCurrentBookTitle = (copy && copy.title) || '';
    const opened = await this._openQrModal(accessionNumber);
    if (!opened) {
      showToast('Unable to open QR preview. Please try again.', 'error');
    }
  }

  async showQrPreview(accessionNumber, qrDataUrl, qrImageUrl) {
    const titleEl = document.getElementById('copyBookTitle');
    this._qrCurrentBookTitle = (titleEl && titleEl.textContent.trim() !== 'Loading…') ? titleEl.textContent.trim() : '';
    const opened = await this._openQrModal(accessionNumber, qrDataUrl, qrImageUrl);
    if (!opened) {
      showToast('Unable to show QR preview. Please try again.', 'error');
    }
  }

  closeQrModal(skipReset = false) {
    if (!this.qrModal) return;

    if (typeof this._qrCleanup === 'function') {
      this._qrCleanup();
    }

    this._qrCleanup = null;
    this._qrActiveSource = '';
    this._qrEndpointPath = '';

    this.qrModal.classList.remove('show');
    this.qrModal.style.display = 'none';
    this._syncBodyModalOpenState();

    if (!skipReset) {
      this._resetQrModalState('Accession Number');
    }
  }

  async downloadQrModal() {
    const accessionNumber = this.qrModalSubtitle ? this.qrModalSubtitle.textContent : '';
    if (!accessionNumber) return;

    if (this.qrDownloadBtn) {
      this.qrDownloadBtn.disabled = true;
    }

    try {
      await this._downloadQrFromSource(accessionNumber, this._qrActiveSource, this._qrEndpointPath || this._getQrEndpoint(accessionNumber));
      if (this.qrModalHint) this.qrModalHint.textContent = `Downloaded ${accessionNumber}-qr.png`;
    } catch (error) {
      this._setQrError(error.message);
    } finally {
      if (this.qrDownloadBtn) this.qrDownloadBtn.disabled = false;
    }
  }

  printQrModal() {
    const accessionNumber = this.qrModalSubtitle ? this.qrModalSubtitle.textContent : '';
    const src = this.qrModalImage ? this.qrModalImage.src : '';
    if (!accessionNumber || !src) return;

    const printWindow = window.open('', '_blank', 'width=380,height=560');
    if (!printWindow) {
      this._setQrError('Unable to open print window. Please allow popups for printing.');
      return;
    }

    const bookTitle = this._qrCurrentBookTitle || '';
    const titleRow = bookTitle
      ? `<p class="label-title">${bookTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
      : '';

    printWindow.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>QR Label - ${accessionNumber}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: Arial, sans-serif;
        background: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 24px;
      }
      .label {
        border: 1.5px solid #374151;
        border-radius: 6px;
        padding: 20px 24px;
        text-align: center;
        width: 280px;
        display: inline-block;
      }
      .label-title {
        font-size: 13px;
        font-weight: 600;
        color: #111827;
        margin-bottom: 12px;
        word-break: break-word;
        line-height: 1.4;
      }
      .label-qr img {
        width: 220px;
        height: 220px;
        display: block;
        margin: 0 auto;
      }
      .label-accession {
        font-size: 14px;
        font-weight: 700;
        font-family: 'Courier New', monospace;
        color: #111827;
        margin-top: 12px;
        letter-spacing: 0.5px;
      }
      @media print {
        body {
          display: block;
          padding: 0;
          margin: 0;
        }
        .label {
          border: 1.5px solid #374151;
          margin: 16px auto;
          page-break-inside: avoid;
        }
      }
    </style>
  </head>
  <body>
    <div class="label">
      ${titleRow}
      <div class="label-qr">
        <img src="${src}" alt="QR Code" />
      </div>
      <div class="label-accession">${accessionNumber}</div>
    </div>
  </body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  }

  async editCopy(accessionNumber) {
    const copy = this.currentCopies.find(c => c.accession_number === accessionNumber);
    if (!copy) return;
    this.openEditConditionModal(accessionNumber);
  }

  closeEditConditionModal() {
    if (this.editConditionModal) this.editConditionModal.style.display = 'none';
  }

  openEditConditionModal(accessionNumber) {
    const copy = this.currentCopies.find(c => c.accession_number === accessionNumber);
    if (!copy) return;
    
    const accEl = document.getElementById('editCondAccession');
    const currEl = document.getElementById('editCondCurrent');
    const selectEl = document.getElementById('editCondSelect');
    
    accEl.textContent = accessionNumber;
    currEl.textContent = copy.condition_status || 'Unknown';
    selectEl.value = copy.condition_status || '';
    
    this.editConditionModal.style.display = 'flex';
  }

  async submitEditCondition(event) {
    event.preventDefault();
    const selectEl = document.getElementById('editCondSelect');
    const accessionNumber = document.getElementById('editCondAccession').textContent;
    const newCondition = selectEl.value;
    
    if (!newCondition) {
      showToast('Please select a condition', 'warning');
      return;
    }
    
    try {
      const response = await fetchWithCsrf(`/api/book-copies/${accessionNumber}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condition_status: newCondition })
      });
      
      if (!response.ok) throw new Error('Update failed');
      
      showToast('✅ Copy updated successfully', 'success');
      this.closeEditConditionModal();
      await this.showCopies(this.currentBookId);
    } catch (error) {
      showToast('Failed to update copy: ' + error.message, 'error');
    }
  }

  closeAuditModal() {
    if (this.auditModal) this.auditModal.style.display = 'none';
  }

  async viewAudit(accessionNumber) {
    // Show modal immediately with loading state
    const modal = document.getElementById('auditModal');
    const titleEl = document.getElementById('auditModalTitle');
    const accessionEl = document.getElementById('auditModalAccession');
    const bodyEl = document.getElementById('auditModalBody');

    accessionEl.textContent = accessionNumber;
    titleEl.textContent = 'Audit History';
    bodyEl.innerHTML = '<div class="notif-loading">Loading&#8230;</div>';
    modal.style.display = 'flex';

    try {
      const response = await fetchWithCsrf(`/api/book-copies/audit/${accessionNumber}`);
      const result = await response.json();
      const audit = result.data || [];

      if (audit.length === 0) {
        bodyEl.innerHTML = `
          <div style="text-align:center;padding:32px 20px;color:#6b7280;">
            <span class="material-symbols-outlined" style="font-size:40px;color:#d1d5db;display:block;margin-bottom:8px;">history_toggle_off</span>
            No audit history found for this copy.
          </div>`;
        return;
      }

      const actionIcons = {
        created: 'add_circle', updated: 'edit', borrowed: 'menu_book',
        returned: 'assignment_return', condition_changed: 'swap_horiz',
        status_changed: 'published_with_changes', deleted: 'delete'
      };
      const actionColors = {
        created: '#2e7d32', updated: '#1565c0', borrowed: '#e65100',
        returned: '#6a1b9a', condition_changed: '#f57f17',
        status_changed: '#00838f', deleted: '#c62828'
      };

      bodyEl.innerHTML = audit.map((entry, i) => {
        const date = new Date(entry.performed_at);
        const dateStr = date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
        const action = (entry.action || 'updated').toLowerCase().replace(/ /g, '_');
        const icon = actionIcons[action] || 'info';
        const color = actionColors[action] || '#374151';
        const isLast = i === audit.length - 1;
        return `
          <div style="display:flex;gap:12px;padding:10px 0;${isLast ? '' : 'border-bottom:1px solid #f3f4f6;'}">
            <div style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:${color}1a;display:flex;align-items:center;justify-content:center;margin-top:2px;">
              <span class="material-symbols-outlined" style="font-size:17px;color:${color};">${icon}</span>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="font-size:13px;font-weight:600;color:${color};text-transform:capitalize;">${entry.action || 'Updated'}</span>
                <span style="font-size:12px;color:#9ca3af;">by ${entry.performed_by_name || 'System'}</span>
              </div>
              ${entry.notes ? `<div style="font-size:12px;color:#6b7280;margin-top:3px;word-break:break-word;">${entry.notes}</div>` : ''}
              <div style="font-size:11px;color:#d1d5db;margin-top:4px;">${dateStr} &middot; ${timeStr}</div>
            </div>
          </div>`;
      }).join('');

    } catch (error) {
      bodyEl.innerHTML = `
        <div style="text-align:center;padding:32px 20px;color:#c62828;">
          <span class="material-symbols-outlined" style="font-size:40px;display:block;margin-bottom:8px;">error</span>
          Failed to load audit history.
        </div>`;
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

  bulkPrintQrLabels(selectedOnly = false) {
    const copies = selectedOnly ? this._getSelectedCopies() : (this.currentCopies || []);
    if (!Array.isArray(copies) || copies.length === 0) {
      showToast(selectedOnly ? 'No copies selected. Use the checkboxes to select copies first.' : 'No copies available to print.', 'warning');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=980,height=760');
    if (!printWindow) {
      showToast('Unable to open print window. Please allow popups for printing.', 'error');
      return;
    }

    const fallbackTitleEl = document.getElementById('copyBookTitle');
    const fallbackTitle = fallbackTitleEl ? fallbackTitleEl.textContent.trim() : '';

    const labelsHtml = copies.map((copy) => {
      const accession = this._escapeHtml(copy.accession_number || 'N/A');
      const rawTitle = copy.title || fallbackTitle;
      const title = rawTitle ? this._escapeHtml(rawTitle) : '';
      const titleRow = title ? `<p class="qr-label-title">${title}</p>` : '';
      const qrSrc = `${window.location.origin}${this._getQrEndpoint(copy.accession_number)}`;
      const safeQrSrc = this._escapeHtml(qrSrc);

      return `
        <article class="qr-label">
          ${titleRow}
          <img src="${safeQrSrc}" alt="QR code for ${accession}" class="qr-label-image" />
          <p class="qr-label-accession">${accession}</p>
        </article>
      `;
    }).join('');

    printWindow.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Bulk QR Labels</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 20px;
        background: #ffffff;
        color: #111827;
        font-family: Arial, sans-serif;
      }
      .qr-label-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 14px;
        justify-items: center;
      }
      .qr-label {
        width: 250px;
        min-height: 320px;
        border: 1.5px solid #374151;
        border-radius: 8px;
        padding: 12px;
        text-align: center;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .qr-label-title {
        margin: 0 0 10px;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.35;
        width: 100%;
        word-break: break-word;
      }
      .qr-label-image {
        width: 190px;
        height: 190px;
        object-fit: contain;
        display: block;
      }
      .qr-label-accession {
        margin: 10px 0 0;
        font-family: "Courier New", monospace;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.4px;
      }
      @media print {
        body { padding: 10mm; }
        .qr-label-grid { gap: 10px; }
      }
    </style>
  </head>
  <body>
    <section class="qr-label-grid">
      ${labelsHtml}
    </section>
  </body>
</html>`);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }

  closeModal() {
    this.modal.classList.remove('show');
    this.modal.style.display = 'none';
    this._syncBodyModalOpenState();
    this.currentBookId = null;
    this.currentCopies = [];
  }
}

// Initialize globally
let bookCopyManager;
document.addEventListener('DOMContentLoaded', () => {
  bookCopyManager = new BookCopyManager();
});
