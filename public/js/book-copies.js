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
    // Create modal HTML
    this.createModal();
    
    // Bind event listeners
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

          <div class="book-info-section" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 id="copyBookTitle">Loading...</h3>
            <p><strong>Author:</strong> <span id="copyBookAuthor">-</span></p>
            <p><strong>ISBN:</strong> <span id="copyBookISBN">-</span></p>
            <p><strong>Total Copies:</strong> <span id="copyBookTotal">-</span></p>
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
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeModal();
      }
    });
  }

  async showCopies(bookId) {
    this.currentBookId = bookId;
    this.modal.style.display = 'block';
    
    try {
      // Fetch copies data
      const response = await fetchWithCsrf(`/api/book-copies/${bookId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch copies');
      }
      
      const result = await response.json();
      this.currentCopies = result.data || [];
      
      // Update book info
      if (this.currentCopies.length > 0) {
        const first = this.currentCopies[0];
        document.getElementById('copyBookTitle').textContent = first.title;
        document.getElementById('copyBookAuthor').textContent = first.author;
        document.getElementById('copyBookISBN').textContent = first.isbn;
      }
      document.getElementById('copyBookTotal').textContent = this.currentCopies.length;
      
      // Render copies table
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
