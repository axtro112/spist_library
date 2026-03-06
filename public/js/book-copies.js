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
      <div id="copiesModal" class="modal" style="display: none;">
        <div class="modal-content" style="max-width: 900px;">
          <div class="modal-header">
            <h2>
              <span class="material-symbols-outlined">qr_code_2</span>
              Book Copies (Accession Numbers)
            </h2>
            <span class="close" onclick="bookCopyManager.closeModal()">&times;</span>
          </div>

          <div class="sa-book-meta">
            <div class="sa-book-meta-top">
              <span id="copyBookTitle" class="sa-book-meta-title">Loading…</span>
              <span id="copyBookStatus" class="sa-pill-status"></span>
            </div>
            <div class="sa-book-meta-grid">
              <div><span class="label">Author:</span><span id="copyBookAuthor">—</span></div>
              <div><span class="label">Category:</span><span id="copyBookCategory">—</span></div>
              <div><span class="label">ISBN:</span><span id="copyBookISBN">—</span></div>
              <div><span class="label">Total Copies:</span><span id="copyBookTotal">—</span></div>
              <div><span class="label">Available:</span><span id="copyBookAvailable">—</span></div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3>All Copies</h3>
            <button class="btn-primary" onclick="bookCopyManager.showAddCopyForm()">
              <span class="material-symbols-outlined">add</span>
              Add New Copy
            </button>
          </div>

          <div class="table-wrapper" style="max-height: 400px; overflow-y: auto;">
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
                <tr>
                  <td colspan="8" class="text-center">Loading copies...</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="modal-footer" style="margin-top: 20px; display: flex; justify-content: space-between;">
            <button class="btn-secondary" onclick="bookCopyManager.exportCopies()">
              <span class="material-symbols-outlined">download</span>
              Export List
            </button>
            <button class="btn-secondary" onclick="bookCopyManager.closeModal()">Close</button>
          </div>
        </div>
      </div>

      <!-- Add Copy Modal -->
      <div id="addCopyModal" class="modal" style="display: none;">
        <div class="modal-content" style="max-width: 500px;">
          <div class="modal-header">
            <h2>Add New Copy</h2>
            <span class="close" onclick="bookCopyManager.closeAddCopyModal()">&times;</span>
          </div>
          <form id="addCopyForm" onsubmit="bookCopyManager.submitAddCopy(event)">
            <div class="form-group">
              <label>Condition <span style="color: red;">*</span></label>
              <select id="newCopyCondition" required>
                <option value="excellent">Excellent - Brand new</option>
                <option value="good" selected>Good - Normal wear</option>
                <option value="fair">Fair - Some damage</option>
                <option value="poor">Poor - Heavy wear</option>
              </select>
            </div>
            <div class="form-group">
              <label>Location</label>
              <input type="text" id="newCopyLocation" value="Main Library" />
            </div>
            <div class="form-group">
              <label>Notes</label>
              <textarea id="newCopyNotes" rows="3" placeholder="Optional notes about this copy"></textarea>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn-primary">Add Copy</button>
              <button type="button" class="btn-secondary" onclick="bookCopyManager.closeAddCopyModal()">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('copiesModal');
  }

  bindEvents() {
    window.addEventListener('click', (e) => {
      if (e.target === this.modal) this.closeModal();
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Inject scoped CSS for the sa-book-meta card (idempotent). */
  _injectStyles() {
    if (document.getElementById('sa-book-meta-styles')) return;
    const style = document.createElement('style');
    style.id = 'sa-book-meta-styles';
    style.textContent = [
      '.sa-book-meta{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);',
      'backdrop-filter:blur(6px);border-radius:12px;padding:14px 16px;margin-bottom:14px;',
      'box-shadow:0 6px 16px rgba(0,0,0,.10);}',
      '.sa-book-meta-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;}',
      '.sa-book-meta-title{font-size:16px;font-weight:700;color:#fff;}',
      '.sa-book-meta-grid{display:grid;grid-template-columns:repeat(3,minmax(160px,1fr));',
      'gap:8px 14px;color:rgba(255,255,255,.92);font-size:13px;}',
      '.sa-book-meta-grid .label{color:rgba(255,255,255,.70);font-weight:600;margin-right:6px;}',
      '.sa-pill-status{padding:5px 10px;border-radius:999px;font-size:12px;font-weight:700;',
      'background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.22);color:#fff;white-space:nowrap;}',
      '.sa-pill-available{background:rgba(34,197,94,.25)!important;border-color:rgba(34,197,94,.45)!important;}',
      '.sa-pill-borrowed{background:rgba(251,146,60,.25)!important;border-color:rgba(251,146,60,.45)!important;}',
      '.sa-pill-maintenance{background:rgba(148,163,184,.25)!important;border-color:rgba(148,163,184,.45)!important;}',
      '@media(max-width:900px){.sa-book-meta-grid{grid-template-columns:repeat(2,1fr);}}',
      '@media(max-width:520px){.sa-book-meta-grid{grid-template-columns:1fr;}}',
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
    if (s === 'available')                      return { label: 'Available',    cls: 'sa-pill-available'    };
    if (s === 'borrowed' || s === 'all_borrowed') return { label: 'All Borrowed', cls: 'sa-pill-borrowed'    };
    if (s === 'maintenance')                    return { label: 'Maintenance',  cls: 'sa-pill-maintenance'  };
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

  async showCopies(bookId) {
    this.currentBookId = bookId;
    this.modal.style.display = 'block';

    // Reset to loading placeholders
    this._setText('copyBookTitle', 'Loading…', 'Loading…');
    ['copyBookAuthor','copyBookCategory','copyBookISBN','copyBookTotal','copyBookAvailable'].forEach(id => this._setText(id, null));
    const statusEl = document.getElementById('copyBookStatus');
    if (statusEl) { statusEl.textContent = ''; statusEl.className = 'sa-pill-status'; }
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
      if (statusEl) { statusEl.textContent = label; statusEl.className = `sa-pill-status ${cls}`.trim(); }

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
    document.getElementById('addCopyModal').style.display = 'block';
  }

  closeAddCopyModal() {
    document.getElementById('addCopyModal').style.display = 'none';
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
      
      alert(`✅ New copy added: ${result.data.accession_number}`);
      
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
    this.modal.style.display = 'none';
    this.currentBookId = null;
    this.currentCopies = [];
  }
}

// Initialize globally
let bookCopyManager;
document.addEventListener('DOMContentLoaded', () => {
  bookCopyManager = new BookCopyManager();
});
