// ========== CSV IMPORT/EXPORT FUNCTIONS ==========

/**
 * Toggle export dropdown menu
 * 
 * DROPDOWN MENU HANDLER
 * Shows/hides the export options dropdown menu.
 * Closes dropdown when clicking outside.
 * 
 * @param {Event} event - Click event
 */
function toggleExportDropdown(event) {
  event.stopPropagation();
  const dropdown = document.getElementById('exportDropdown');
  const button = event.currentTarget;
  
  dropdown.classList.toggle('show');
  button.classList.toggle('active');
  
  // Close dropdown when clicking outside
  if (dropdown.classList.contains('show')) {
    const closeDropdown = (e) => {
      if (!dropdown.contains(e.target) && !button.contains(e.target)) {
        dropdown.classList.remove('show');
        button.classList.remove('active');
        document.removeEventListener('click', closeDropdown);
      }
    };
    setTimeout(() => document.addEventListener('click', closeDropdown), 0);
  }
}

/**
 * Export all books to CSV format
 * 
 * EXPORT BOOKS (CSV) - FRONTEND HANDLER
 * Triggers download of all books in CSV (.csv) format.
 * Called when user clicks the "Export CSV" button.
 * 
 * Process Flow:
 * 1. Create temporary anchor element
 * 2. Set href to CSV export API endpoint
 * 3. Append to DOM
 * 4. Programmatically click to trigger download
 * 5. Remove anchor from DOM
 * 
 * API Called:
 * - GET /api/admin/books/export
 * - Response: CSV file with timestamp in filename
 * - File format: books_export_YYYY-MM-DD_HH-mm-ss.csv
 * 
 * User Experience:
 * - Instant download trigger (browser handles the file)
 * - No page reload or navigation
 * - File automatically saved to Downloads folder
 * - Can be opened in any spreadsheet application
 * 
 * Error Handling:
 * - Catches JavaScript errors (DOM manipulation failures)
 * - Shows alert if export fails
 * - Logs errors to console for debugging
 * 
 * @returns {void}
 */
function exportBooksCSV() {
  try {
    const url = "/api/admin/books/export";
    const link = document.createElement("a");
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Close dropdown after download
    const dropdown = document.getElementById('exportDropdown');
    if (dropdown) {
      dropdown.classList.remove('show');
      document.querySelector('.dropdown-toggle')?.classList.remove('active');
    }
  } catch (error) {
    console.error("CSV export error:", error);
    alert("Failed to export books to CSV");
  }
}

/**
 * Export all books to Excel format
 * 
 * EXPORT BOOKS (EXCEL) - FRONTEND HANDLER
 * Triggers download of all books in Excel (.xlsx) format.
 * Called when user clicks the "Export Excel" button.
 * 
 * Process Flow:
 * 1. Create temporary anchor element
 * 2. Set href to Excel export API endpoint
 * 3. Append to DOM
 * 4. Programmatically click to trigger download
 * 5. Remove anchor from DOM
 * 
 * API Called:
 * - GET /api/admin/books/export-excel
 * - Response: Binary .xlsx file with timestamp in filename
 * - File format: books_export_YYYY-MM-DDTHH-MM-SS.xlsx
 * 
 * User Experience:
 * - Instant download trigger (browser handles the file)
 * - No page reload or navigation
 * - File automatically saved to Downloads folder
 * - Opens immediately in Excel/Google Sheets/LibreOffice
 * 
 * Error Handling:
 * - Catches JavaScript errors (DOM manipulation failures)
 * - Shows alert if export fails
 * - Logs errors to console for debugging
 * - Does not catch server errors (handled by browser)
 * 
 * @returns {void}
 */
function exportBooks() {
  try {
    const url = "/api/admin/books/export-excel";
    const link = document.createElement("a");
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Close dropdown after download
    const dropdown = document.getElementById('exportDropdown');
    if (dropdown) {
      dropdown.classList.remove('show');
      document.querySelector('.dropdown-toggle')?.classList.remove('active');
    }
  } catch (error) {
    console.error("Export error:", error);
    alert("Failed to export books");
  }
}

/**
 * Download CSV import template file
 * 
 * DOWNLOAD TEMPLATE - FRONTEND HANDLER
 * Triggers download of header-only CSV template with proper column names.
 * Called when user clicks the "Download Template" button.
 * 
 * Purpose:
 * - Provides users with correctly formatted CSV template
 * - Shows exact column names required (title,author,isbn,category,quantity)
 * - Header-only file (no example data rows)
 * - Prevents formatting errors during import
 * 
 * Process Flow:
 * 1. Create temporary anchor element
 * 2. Set href to export endpoint with ?mode=template query parameter
 * 3. Append to DOM
 * 4. Programmatically click to trigger download
 * 5. Remove anchor from DOM
 * 
 * API Called:
 * - GET /api/admin/books/export?mode=template
 * - Response: CSV file with fixed name "books_template.csv"
 * - Contains only header row (no data)
 * 
 * User Workflow:
 * 1. User clicks "Download Template"
 * 2. CSV file downloads to their computer
 * 3. User opens in Excel/Google Sheets
 * 4. User adds their own book data
 * 5. User saves and uploads via "Import CSV"
 * 
 * Benefits:
 * - Reduces import errors from incorrect formatting
 * - Shows users exactly what columns to provide
 * - Clean template without example data to delete
 * 
 * @returns {void}
 */
function downloadTemplate() {
  try {
    const url = "/api/admin/books/export?mode=template";
    const link = document.createElement("a");
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Close dropdown after download
    const dropdown = document.getElementById('exportDropdown');
    if (dropdown) {
      dropdown.classList.remove('show');
      document.querySelector('.dropdown-toggle')?.classList.remove('active');
    }
  } catch (error) {
    console.error("Template error:", error);
    alert("Failed to download template");
  }
}

/**
 * Reset import form to initial state
 * 
 * HELPER FUNCTION - UI STATE MANAGEMENT
 * Clears all import-related UI elements and resets form to pristine state.
 * Called after successful import or when modal is closed.
 * 
 * Elements Reset:
 * 1. Import form: Clears file input
 * 2. Progress bar: Hides progress indicator
 * 3. Results div: Hides import summary
 * 4. Submit button: Re-enables and restores original text/icon
 * 
 * Purpose:
 * - Prepare form for next import
 * - Clear previous import results
 * - Reset button state after processing
 * - Provide clean slate for user
 * 
 * Called When:
 * - After successful import completes (3-second delay)
 * - When import modal is closed
 * - When user cancels import
 * - Before starting new import
 * 
 * UI State Changes:
 * - Progress bar width: 100% → 0% (hidden)
 * - Results display: visible → hidden
 * - Submit button: disabled → enabled
 * - Button text: "Importing..." → "Import Books"
 * - File input: selected file → empty
 * 
 * @returns {void}
 */
function resetImportForm() {
  const form = document.getElementById("importForm");
  const progressDiv = document.getElementById("importProgress");
  const resultsDiv = document.getElementById("importResults");
  const submitBtn = document.getElementById("importSubmitBtn");
  
  if (form) form.reset();
  if (progressDiv) progressDiv.style.display = "none";
  if (resultsDiv) resultsDiv.style.display = "none";
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px; vertical-align: middle;">upload_file</span> Import Books';
  }
}

/**
 * Handle CSV import form submission
 * 
 * IMPORT BOOKS (CSV) - MAIN FRONTEND HANDLER
 * Processes CSV file upload, displays progress, and shows detailed import results.
 * This is the core function that orchestrates the entire import workflow.
 * 
 * Process Flow:
 * 1. Prevent default form submission
 * 2. Validate file selection (CSV only)
 * 3. Show progress bar (30%)
 * 4. Create FormData with selected file
 * 5. POST to import API endpoint
 * 6. Update progress bar (70%)
 * 7. Parse and validate API response
 * 8. Complete progress bar (100%)
 * 9. Display detailed import summary
 * 10. Show success alert with statistics
 * 11. Reload books table
 * 12. Auto-close modal after 3 seconds
 * 
 * File Validation:
 * - Must be .csv file extension
 * - Alert shown if validation fails
 * - No upload attempted if invalid
 * 
 * API Integration:
 * - Endpoint: POST /api/admin/books/import
 * - Content-Type: multipart/form-data
 * - Field name: "file"
 * - Expected response: {success, message, summary}
 * 
 * Progress Bar Stages:
 * - 30%: File selected, upload starting
 * - 70%: Upload complete, processing on server
 * - 100%: Import complete, results ready
 * 
 * Import Summary Display:
 * - Successfully imported: Green box with count
 * - Skipped (missing fields): Red box with row numbers and reasons
 * - Skipped (duplicate ISBNs): Orange box with ISBNs and titles
 * - Zero quantity entries: Blue box for review
 * 
 * Alert Message Format:
 * "Import Completed!
 *  ✓ Successfully imported: X
 *  ✗ Skipped (missing fields): Y
 *  ✗ Skipped (duplicate ISBN): Z
 *   Zero quantity entries: W"
 * 
 * Post-Import Actions:
 * - Calls loadBooks() to refresh table
 * - Waits 3 seconds for user to read results
 * - Auto-resets form via resetImportForm()
 * - Auto-closes modal via closeModal()
 * 
 * Error Handling:
 * - File validation errors: Alert user, no API call
 * - Network errors: Catch and display error message
 * - Server errors: Parse error from response
 * - All errors: Reset progress bar to 0%
 * - Finally block: Always re-enable submit button
 * 
 * UI State Management:
 * - Disables submit button during processing
 * - Changes button text to "Importing..."
 * - Shows/hides progress indicators
 * - Manages modal visibility
 * 
 * @param {Event} e - Form submit event object
 * @returns {Promise<void>}
 */
async function handleImportSubmit(e) {
  e.preventDefault();

  const fileInput = document.getElementById("csvFile");
  const file = fileInput.files[0];

  // Validate file type: CSV or Excel
  const fileName = file ? file.name.toLowerCase() : '';
  const validExtensions = ['.csv', '.xlsx', '.xls'];
  const isValidFile = validExtensions.some(ext => fileName.endsWith(ext));

  if (!file || !isValidFile) {
    alert("Please select a valid CSV or Excel file (.csv, .xlsx, .xls)");
    return;
  }

  const progressDiv = document.getElementById("importProgress");
  const progressBar = document.getElementById("importProgressBar");
  const resultsDiv = document.getElementById("importResults");
  const submitBtn = document.getElementById("importSubmitBtn");

  try {
    progressDiv.style.display = "block";
    resultsDiv.style.display = "none";
    submitBtn.disabled = true;
    submitBtn.textContent = "Importing...";

    progressBar.style.width = "30%";
    progressBar.textContent = "30%";

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetchWithCsrf("/api/admin/books/import", {
      method: "POST",
      body: formData,
    });

    progressBar.style.width = "70%";
    progressBar.textContent = "70%";

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to import books");
    }

    const result = await response.json();

    progressBar.style.width = "100%";
    progressBar.textContent = "100%";

    // Debug: Log import state before display
    const DEBUG_IMPORT = true; // Set to false to disable debug logs
    if (DEBUG_IMPORT) {
      console.log('[IMPORT DEBUG] Summary received:', result.summary);
      console.log('[IMPORT DEBUG] Current filters:', {
        search: document.getElementById('searchInput')?.value || '',
        category: document.getElementById('categoryFilter')?.value || '',
        status: document.getElementById('statusFilter')?.value || ''
      });
    }

    displayImportResults(result.summary);
    resultsDiv.style.display = "block";

    alert(
      `Import Completed!\n\n` +
      `✓ New books added: ${result.summary.successfully_imported}\n` +
      `↻ Existing books updated: ${result.summary.updated_existing || 0}\n` +
      `✗ Skipped (missing fields): ${result.summary.skipped_missing_fields.length}\n` +
      ` Zero quantity entries: ${result.summary.zero_quantity_entries.length}`
    );

    // Store import state for post-refresh analysis
    window.__lastImportSummary = result.summary;
    window.__importFiltersBefore = {
      search: document.getElementById('searchInput')?.value || '',
      category: document.getElementById('categoryFilter')?.value || '',
      status: document.getElementById('statusFilter')?.value || ''
    };

    // Reload books and stats to reflect imported data
    if (DEBUG_IMPORT) console.log('[IMPORT DEBUG] Calling reloadBooksAndStats()...');
    if (typeof reloadBooksAndStats === 'function') {
      await reloadBooksAndStats();
    } else if (typeof loadBooks === 'function') {
      await loadBooks();
    }

    // After refresh, check if filters might be hiding books
    if (DEBUG_IMPORT) console.log('[IMPORT DEBUG] Refresh complete, checking filter state...');
    checkIfFiltersHidingImportedBooks();

    setTimeout(() => {
      resetImportForm();
      if (typeof closeModal === 'function') {
        closeModal();
      }
    }, 3000);

  } catch (error) {
    console.error("Import error:", error);
    alert("Import failed: " + error.message);
    progressBar.style.width = "0%";
    progressBar.textContent = "0%";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Import Books";
  }
}

/**
 * Display detailed import results with color-coded sections
 * 
 * IMPORT RESULTS - UI RENDERING FUNCTION
 * Converts import summary object into formatted HTML with visual indicators.
 * Called after import completes to show user what was imported and what was skipped.
 * 
 * Summary Object Structure:
 * {
 *   total_rows: <number>,
 *   successfully_imported: <number>,
 *   skipped_missing_fields: [{row, data, reason}, ...],
 *   skipped_duplicate_isbns: [{row, isbn, title}, ...],
 *   zero_quantity_entries: [{row, isbn, title}, ...]
 * }
 * 
 * HTML Output Structure:
 * 
 * 1. SUMMARY BOX (Green - #e8f5e9):
 *    - Total successfully imported
 *    - Count of each skip category
 *    - Color: Success green (#4CAF50 border)
 * 
 * 2. SKIPPED ROWS - MISSING FIELDS (Red - #ffebee):
 *    - Only shown if skipped_missing_fields.length > 0
 *    - Each row: "Row X: [reason]"
 *    - Color: Error red (#f44336 border)
 *    - Example: "Row 5: Missing required fields (title, author)"
 * 
 * 3. SKIPPED ROWS - DUPLICATE ISBN (Orange - #fff3e0):
 *    - Only shown if skipped_duplicate_isbns.length > 0
 *    - Each row: "Row X: [title] ([isbn])"
 *    - Color: Warning orange (#ff9800 border)
 *    - Example: "Row 12: The Great Gatsby (9780743273565)"
 * 
 * 4. ZERO QUANTITY ENTRIES (Blue - #e3f2fd):
 *    - Only shown if zero_quantity_entries.length > 0
 *    - Each row: "Row X: [title] ([isbn])"
 *    - Color: Info blue (#2196F3 border)
 *    - Purpose: Alert admin to review low-stock books
 * 
 * Styling:
 * - Each section: 10px padding, 4px left border, color-coded background
 * - Spacing: 15px between summary, 10px between other sections
 * - Typography: Bold section headers, regular row text
 * - Visual hierarchy: Summary first, errors/warnings below
 * 
 * Conditional Rendering:
 * - Only renders sections with data (empty arrays hidden)
 * - Summary always shown (contains counts)
 * - Error sections only if errors exist
 * 
 * User Experience:
 * - Immediate visual feedback on import success
 * - Clear indication of what needs attention
 * - Row numbers help locate issues in original CSV
 * - Color coding enables quick scanning
 * 
 * DOM Target:
 * - Renders into #importResultsContent element
 * - Uses innerHTML for HTML injection
 * - Parent #importResults div must be visible
 * 
 * @param {Object} summary - Import summary object from API response
 * @returns {void}
 */
function displayImportResults(summary) {
  const resultsContent = document.getElementById("importResultsContent");
  
  const updated = summary.updated_existing || 0;
  const inserted = summary.successfully_imported || 0;
  
  // Generate explanatory note based on import outcome
  let explanationNote = '';
  if (inserted === 0 && updated > 0) {
    explanationNote = `
      <div style="margin-bottom: 10px; padding: 8px; background-color: #fff8e1; border-left: 3px solid #fbc02d; font-size: 0.9em; color: #333;">
        <strong>ℹ️ Why no new books?</strong><br>
        All ${updated} imported ISBN(s) already exist in the system, so rows were <strong>updated</strong> with new data instead of inserted as new records.
        Check the "Updated books" section below for details.
      </div>
    `;
  } else if (inserted === 0 && updated === 0) {
    explanationNote = `
      <div style="margin-bottom: 10px; padding: 8px; background-color: #ffebee; border-left: 3px solid #f44336; font-size: 0.9em; color: #333;">
        <strong>⚠️ No rows imported or updated</strong><br>
        Common causes: Missing required fields (title, author, isbn, category), Invalid ISBN format, or all rows already skipped.
        Review the errors below and try again.
      </div>
    `;
  }
  
  let html = `
    ${explanationNote}
    <div style="margin-bottom: 15px; padding: 10px; background-color: #e8f5e9; border-left: 4px solid #4CAF50;">
      <strong>Summary:</strong><br>
      ✓ New Books Added: ${inserted}<br>
      ↻ Existing Books Updated: ${updated}<br>
      ✗ Skipped (Missing Fields): ${summary.skipped_missing_fields.length}<br>
       Zero Quantity Entries: ${summary.zero_quantity_entries.length}
    </div>
  `;

  if (summary.skipped_missing_fields.length > 0) {
    html += `<div style="margin-bottom: 10px; padding: 10px; background-color: #ffebee; border-left: 4px solid #f44336;">
      <strong>Skipped Rows (Missing Fields):</strong><br>`;
    summary.skipped_missing_fields.forEach((item) => {
      html += `<div style="margin: 5px 0;">Row ${item.row}: ${item.reason}</div>`;
    });
    html += `</div>`;
  }

  // skipped_duplicate_isbns is now always empty (upsert behavior)
  if (updated > 0) {
    html += `<div style="margin-bottom: 10px; padding: 10px; background-color: #e3f2fd; border-left: 4px solid #2196F3;">
      <strong>↻ Updated ${updated} existing book${updated !== 1 ? 's' : ''} with new data from file.</strong>
    </div>`;
  }

  if (summary.zero_quantity_entries.length > 0) {
    html += `<div style="margin-bottom: 10px; padding: 10px; background-color: #e3f2fd; border-left: 4px solid #2196F3;">
      <strong>Zero Quantity Entries:</strong><br>`;
    summary.zero_quantity_entries.forEach((item) => {
      html += `<div style="margin: 5px 0;">Row ${item.row}: "${item.title}" (${item.isbn})</div>`;
    });
    html += `</div>`;
  }

  resultsContent.innerHTML = html;
}

/**
 * Check if active filters might be hiding newly imported books
 * Shows subtle hint if imports completed but table shows no changes due to filters
 * 
 * @returns {void}
 */
function checkIfFiltersHidingImportedBooks() {
  const DEBUG_IMPORT = true; // Matches flag in handleImportSubmit
  const summary = window.__lastImportSummary || {};
  const filtersBefore = window.__importFiltersBefore || {};
  
  if (DEBUG_IMPORT) {
    console.log('[IMPORT DEBUG] Checking if filters hide books...');
    console.log('[IMPORT DEBUG] Summary:', { imported: summary.successfully_imported, updated: summary.updated_existing });
    console.log('[IMPORT DEBUG] Active filters:', filtersBefore);
  }
  
  // Determine if any filters are active
  const hasActiveFilters = !!(filtersBefore.search || filtersBefore.category || filtersBefore.status);
  const hadImports = (summary.successfully_imported || 0) > 0 || (summary.updated_existing || 0) > 0;
  
  if (DEBUG_IMPORT) {
    console.log('[IMPORT DEBUG] Active filters?', hasActiveFilters, 'Had imports?', hadImports);
  }
  
  // Only show hint if: imports happened AND filters are active
  if (hadImports && hasActiveFilters) {
    // Find or create hint element
    let hintElement = document.getElementById('importFilterHint');
    if (!hintElement) {
      // Create hint near the filter bar
      const filterContainer = document.querySelector('.filter-bar') || 
                             document.querySelector('.section-header');
      if (filterContainer) {
        hintElement = document.createElement('div');
        hintElement.id = 'importFilterHint';
        hintElement.style.cssText = `
          margin-top: 10px;
          margin-bottom: 15px;
          padding: 8px 12px;
          background-color: #e8f4fd;
          border-left: 3px solid #0277bd;
          border-radius: 2px;
          font-size: 0.85em;
          color: #333;
          display: flex;
          justify-content: space-between;
          align-items: center;
        `;
        hintElement.innerHTML = `
          <span><strong>ℹ️ Import Finished:</strong> Active filters may be hiding newly imported or updated books. <a href="javascript:void(0)" onclick="document.getElementById('searchInput').value=''; document.getElementById('categoryFilter').value=''; document.getElementById('statusFilter').value=''; typeof loadBooks === 'function' && loadBooks();" style="color: #0277bd; text-decoration: underline; cursor: pointer;">Clear filters</a></span>
          <span onclick="document.getElementById('importFilterHint').remove();" style="cursor: pointer; font-size: 1.2em; color: #999;">✕</span>
        `;
        filterContainer.parentNode.insertBefore(hintElement, filterContainer.nextSibling);
        
        if (DEBUG_IMPORT) console.log('[IMPORT DEBUG] Hint shown to user');
        
        // Auto-remove hint after 8 seconds
        setTimeout(() => {
          if (document.getElementById('importFilterHint')) {
            document.getElementById('importFilterHint').remove();
            if (DEBUG_IMPORT) console.log('[IMPORT DEBUG] Hint auto-removed after timeout');
          }
        }, 8000);
      }
    }
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const importForm = document.getElementById("importForm");
  if (importForm) {
    importForm.addEventListener("submit", handleImportSubmit);
  }
});
