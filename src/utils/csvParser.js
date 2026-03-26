const fs = require("fs");
const csv = require("csv-parser");
const ExcelJS = require("exceljs");
const db = require("../config/database");
const dbUtils = require("./db");
const logger = require("./logger");
const { ensureBookCopyCoverage } = require("./accession");

/**
 * Parse CSV file and return array of book objects
 * 
 * IMPORT BOOKS (CSV) - PARSING PHASE
 * This function reads and parses an uploaded CSV file containing book data.
 * It uses the csv-parser library to convert CSV rows into JavaScript objects.
 * 
 * Expected CSV Structure:
 * - Columns: title, author, isbn, category, quantity
 * - Headers must match exactly (case-sensitive)
 * - Each row represents one book to import
 * 
 * Processing Notes:
 * - The parser automatically handles comma-delimited values
 * - Whitespace in cell values is preserved (trimmed later during validation)
 * - Empty cells are returned as empty strings
 * - This function does NOT validate data - it only parses the file structure
 * 
 * Data Flow:
 * 1. Creates read stream from uploaded file path
 * 2. Pipes through csv-parser to convert rows to objects
 * 3. Collects all parsed rows into an array
 * 4. Returns the complete array for validation and import
 * 
 * Error Handling:
 * - Rejects promise if file cannot be read
 * - Rejects if CSV structure is malformed
 * - Does not catch validation errors (handled by importBooks)
 * 
 * @param {string} filePath - Absolute path to the uploaded CSV file in /uploads directory
 * @returns {Promise<Array>} Promise resolving to array of book objects with properties:
 *                           {title, author, isbn, category, quantity}
 * @throws {Error} If file read fails or CSV parsing encounters errors
 */
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        results.push(data);
      })
      .on("end", () => {
        resolve(results);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};

/**
 * Parse Excel file (.xlsx) and return array of book objects
 * 
 * IMPORT BOOKS (EXCEL) - PARSING PHASE
 * This function reads and parses an uploaded Excel file containing book data.
 * It uses exceljs to convert Excel rows into JavaScript objects.
 * 
 * Expected Excel Structure:
 * - First row: Headers (title, author, isbn, category, quantity)
 * - Subsequent rows: Book data
 * - Supported format: .xlsx (Excel 2007+)
 * 
 * Processing Notes:
 * - Reads the first worksheet only
 * - Headers must be in first row (case-sensitive)
 * - Empty cells are returned as empty strings or undefined
 * - Converts Excel date formats to readable values
 * - Skips completely empty rows
 * 
 * @param {string} filePath - Absolute path to the uploaded Excel file
 * @returns {Promise<Array>} Promise resolving to array of book objects
 * @throws {Error} If file read fails or Excel parsing encounters errors
 */
const parseExcel = (filePath) => {
  return new Promise((resolve, reject) => {
    try {
      (async () => {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          resolve([]);
          return;
        }

        const getCellValue = (cell) => {
          const raw = cell ? cell.value : "";
          if (raw === null || raw === undefined) return "";
          if (raw instanceof Date) return raw.toISOString().split("T")[0];
          if (typeof raw === "object") {
            if (Object.prototype.hasOwnProperty.call(raw, "text")) return raw.text || "";
            if (Object.prototype.hasOwnProperty.call(raw, "result")) return raw.result || "";
            if (Array.isArray(raw.richText)) return raw.richText.map((r) => r.text || "").join("");
            if (Object.prototype.hasOwnProperty.call(raw, "hyperlink")) return raw.text || raw.hyperlink || "";
          }
          return raw;
        };

        const headerRow = worksheet.getRow(1);
        const headers = [];
        headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          headers[colNumber] = String(getCellValue(cell) || "").toLowerCase().trim();
        });

        const results = [];
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber === 1) return;

          const normalized = {};
          let hasData = false;

          headers.forEach((header, colNumber) => {
            if (!header) return;
            const value = getCellValue(row.getCell(colNumber));
            if (String(value).trim() !== "") hasData = true;

            if (header === "id") {
              return;
            }
            if (header === "title") {
              normalized.title = value;
            } else if (header === "author") {
              normalized.author = value;
            } else if (header === "isbn") {
              normalized.isbn = value;
            } else if (header === "category") {
              normalized.category = value;
            } else if (header === "quantity") {
              normalized.quantity = value;
            } else if (header === "status") {
              normalized.status = value;
            } else if (header === "added date" || header === "added_date" || header === "date added") {
              normalized.added_date = value;
            } else {
              normalized[header] = value;
            }
          });

          if (hasData) results.push(normalized);
        });

        resolve(results);
      })().catch(reject);
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Query database with promise wrapper
 * 
 * HELPER FUNCTION - DATABASE INTERACTION
 * Wraps the MySQL callback-based query method into a Promise-based interface.
 * This enables async/await syntax throughout the import/export functions.
 * 
 * Purpose:
 * - Converts mysql2 callback pattern to modern Promise pattern
 * - Enables cleaner error handling with try/catch blocks
 * - Simplifies async operations during import/export
 * 
 * Used By:
 * - importBooks(): For checking duplicate ISBNs and inserting books
 * - isBookBorrowed(): For checking book_borrowings table
 * - exportBooksToCSV(): For fetching all books
 * - exportBooksToExcel(): For fetching all books
 * 
 * @param {string} sql - Parameterized SQL query string (use ? for placeholders)
 * @param {Array} params - Array of values to bind to SQL placeholders (default: [])
 * @returns {Promise<Array>} Promise resolving to query results array
 * @throws {Error} Database errors (connection issues, syntax errors, constraint violations)
 */
const queryDB = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

/**
 * Check if book is currently borrowed
 * 
 * HELPER FUNCTION - STATUS DETERMINATION
 * Queries the book_borrowings table to determine if a specific book has active borrowings.
 * This is critical for determining the correct status when quantity = 0.
 * 
 * Status Logic Context:
 * When a book has quantity = 0, we need to differentiate between:
 * - "borrowed" - Book is checked out by a student (active borrowing exists)
 * - "missing" - Book is lost or damaged (no active borrowing)
 * 
 * Query Details:
 * - Checks book_borrowings table for matching book_id
 * - Only counts records where status = 'borrowed'
 * - Returns true if count > 0 (at least one active borrowing)
 * 
 * Used During Import:
 * - When importing books with quantity = 0
 * - Helps set accurate initial status for low-stock books
 * - Prevents marking borrowed books as "missing"
 * 
 * Database Schema Reference:
 * - Table: book_borrowings
 * - Columns checked: book_id, status
 * - Status values: 'borrowed', 'returned', 'overdue'
 * 
 * @param {number} bookId - The unique ID of the book to check
 * @returns {Promise<boolean>} True if book has active borrowings, false otherwise
 * @throws {Error} Database query errors
 */
const isBookBorrowed = async (bookId) => {
  const query = `
    SELECT COUNT(*) as count 
    FROM book_borrowings 
    WHERE book_id = ? 
    AND status = 'borrowed' 
    AND return_date IS NULL
  `;
  const results = await queryDB(query, [bookId]);
  return results[0].count > 0;
};

/**
 * Determine book status based on quantity and borrowing status
 * @param {number} quantity - Book quantity
 * @param {number} bookId - Book ID (optional, for existing books)
 * @returns {Promise<string>} Status: "available", "borrowed", or "missing"
 */
const determineBookStatus = async (quantity, bookId = null) => {
  if (quantity >= 1) {
    return "available";
  } else if (quantity === 0) {
    if (bookId) {
      const borrowed = await isBookBorrowed(bookId);
      return borrowed ? "borrowed" : "missing";
    }
    return "missing"; // Default for new books with 0 quantity
  }
  return "available"; // Fallback
};

/**
 * Import books from CSV with validation and duplicate checking
 * @param {Array} books - Array of book objects from CSV
 * @returns {Promise<Object>} Import summary with results
 */
const importBooks = async (books) => {
  const summary = {
    total_rows: books.length,
    successfully_imported: 0,
    updated_existing: 0,
    restored_from_trash: 0,
    skipped_missing_fields: [],
    skipped_duplicate_isbns: [], // kept for backward-compat
    zero_quantity_entries: [],
  };

  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    const rowNum = i + 1;

    try {
      // Validate required fields
      if (!book.title || !book.author || !book.isbn || !book.category) {
        summary.skipped_missing_fields.push({
          row: rowNum,
          data: book,
          reason: "Missing required fields (title, author, isbn, or category)",
        });
        continue;
      }

      // Set default quantity to 1 if empty/null
      let quantity = parseInt(book.quantity, 10);
      if (isNaN(quantity) || book.quantity === "" || book.quantity === null) {
        quantity = 1;
      }

      // Track zero quantity entries (still inserted/updated)
      if (quantity === 0) {
        summary.zero_quantity_entries.push({
          row: rowNum,
          title: book.title,
          isbn: book.isbn,
        });
      }

      // Check whether this ISBN already exists among active books
      await dbUtils.withTransaction(async (conn) => {
        const existingBook = await conn.queryAsync(
          "SELECT id FROM books WHERE isbn = ? AND deleted_at IS NULL FOR UPDATE",
          [book.isbn.trim()]
        );

        if (existingBook.length > 0) {
          // Fetch current quantities so we can add to them
          const currentRows = await conn.queryAsync(
            "SELECT quantity, available_quantity FROM books WHERE id = ?",
            [existingBook[0].id]
          );
          const currentQty = Number(currentRows[0]?.quantity || 0);
          const currentAvail = Number(currentRows[0]?.available_quantity || 0);
          const newTotalQty = currentQty + quantity;
          const newAvailQty = currentAvail + quantity;

          const status = await determineBookStatus(newTotalQty, existingBook[0].id);
          await conn.queryAsync(
            `UPDATE books
               SET title = ?, author = ?, category = ?, quantity = ?,
                   available_quantity = ?,
                   status = ?, updated_at = NOW()
             WHERE id = ? AND deleted_at IS NULL`,
            [
              book.title.trim(),
              book.author.trim(),
              book.category.trim(),
              newTotalQty,
              newAvailQty,
              status,
              existingBook[0].id,
            ]
          );

          await ensureBookCopyCoverage(conn, {
            bookId: existingBook[0].id,
            quantity: newTotalQty,
            bookStatus: status,
            source: 'csv_import_update',
          });

          summary.updated_existing++;
          return;
        }

        const trashedBook = await conn.queryAsync(
          "SELECT id, quantity, available_quantity FROM books WHERE isbn = ? AND deleted_at IS NOT NULL ORDER BY COALESCE(updated_at, added_date) DESC, id DESC LIMIT 1 FOR UPDATE",
          [book.isbn.trim()]
        );

        if (trashedBook.length > 0) {
          logger.info('Import skipped row because ISBN exists in trash', {
            row: rowNum,
            isbn: book.isbn,
            title: book.title,
            trashedBookId: trashedBook[0].id,
          });

          summary.skipped_duplicate_isbns.push({
            row: rowNum,
            isbn: book.isbn,
            title: book.title,
            reason: 'Book with the same ISBN is in trash. Restore it from Trash Bin instead of importing.',
          });
          return;
        }

        const status = await determineBookStatus(quantity, null);
        const insertResult = await conn.queryAsync(
          `INSERT INTO books (title, author, isbn, category, quantity, status, added_date)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [
            book.title.trim(),
            book.author.trim(),
            book.isbn.trim(),
            book.category.trim(),
            quantity,
            status,
          ]
        );

        await ensureBookCopyCoverage(conn, {
          bookId: insertResult.insertId,
          quantity,
          bookStatus: status,
          source: 'csv_import_insert',
        });

        summary.successfully_imported++;
      });
    } catch (error) {
      console.error(`Error importing row ${rowNum}:`, error);
      summary.skipped_missing_fields.push({
        row: rowNum,
        data: book,
        reason: `Database error: ${error.message}`,
      });
    }
  }

  return summary;
};

/**
 * Export all books to CSV format
 * 
 * EXPORT BOOKS (CSV)
 * Fetches all books from the database and converts them to a downloadable CSV file.
 * This function generates a complete snapshot of the books inventory in CSV format.
 * 
 * CSV OUTPUT STRUCTURE:
 * - Headers: id,title,author,isbn,category,quantity,status,added_date
 * - Each row represents one book from the database
 * - All fields are included (not just import fields)
 * 
 * COLUMN DETAILS:
 * 1. id: Database primary key (numeric)
 * 2. title: Book title (quoted if contains commas)
 * 3. author: Author name (quoted if contains commas)
 * 4. isbn: ISBN number (unquoted numeric string)
 * 5. category: Book category (quoted if contains commas)
 * 6. quantity: Current stock quantity (numeric, 0 if null)
 * 7. status: Current status ("available", "borrowed", "missing")
 * 8. added_date: Date added in YYYY-MM-DD format
 * 
 * DATA FORMATTING:
 * - Text fields: Wrapped in double quotes, internal quotes escaped as ""
 * - Dates: Converted from MySQL datetime to YYYY-MM-DD format
 * - Quantity: Defaults to 0 if null
 * - Comma escaping: Handled via quote wrapping
 * 
 * QUERY DETAILS:
 * - SQL: SELECT id, title, author, isbn, category, quantity, status, added_date FROM books
 * - Ordering: Most recent first (ORDER BY id DESC)
 * - No filtering: Exports ALL books regardless of status
 * 
 * FILE NAMING (handled by route):
 * - Format: books_export_YYYY-MM-DDTHH-MM-SS.csv
 * - Timestamp prevents filename conflicts
 * - Compatible with Excel, Google Sheets, LibreOffice
 * 
 * USE CASES:
 * - Backup entire book inventory
 * - Generate reports for administration
 * - Migrate data to other systems
 * - Audit inventory counts
 * - Offline analysis in spreadsheet software
 * 
 * PERFORMANCE:
 * - Fetches all books in single query (no pagination)
 * - String concatenation for large datasets (1000+ books)
 * - Returns raw CSV string (streaming handled by route)
 * 
 * @returns {Promise<string>} Complete CSV file content as string with headers and all rows
 * @throws {Error} Database query errors or connection failures
 */
const exportBooksToCSV = async () => {
  const query = `
    SELECT id, title, author, isbn, category, quantity, status, added_date
    FROM books
    ORDER BY id DESC
  `;

  const books = await queryDB(query);

  // Create CSV header
  let csv = "id,title,author,isbn,category,quantity,status,added_date\n";

  // Add book rows
  books.forEach((book) => {
    const row = [
      book.id,
      `"${book.title.replace(/"/g, '""')}"`, // Escape quotes
      `"${book.author.replace(/"/g, '""')}"`,
      book.isbn,
      `"${book.category.replace(/"/g, '""')}"`,
      book.quantity || 0,
      book.status,
      new Date(book.added_date).toISOString().split("T")[0], // YYYY-MM-DD format
    ];
    csv += row.join(",") + "\n";
  });

  return csv;
};

/**
 * Export all books to Excel format (.xlsx)
 * 
 * EXPORT BOOKS (EXCEL)
 * Fetches all books from the database and converts them to a downloadable Excel (.xlsx) file.
 * This is a more user-friendly alternative to CSV export with better formatting and readability.
 * 
 * EXCEL OUTPUT STRUCTURE:
 * - Sheet Name: "Books"
 * - Headers: ID, Title, Author, ISBN, Category, Quantity, Status, Added Date
 * - Each row represents one book from the database
 * - Automatic column width sizing for optimal display
 * 
 * COLUMN DETAILS & WIDTHS:
 * 1. ID: 8 characters wide - Database primary key
 * 2. Title: 40 characters wide - Book title (auto-wraps if longer)
 * 3. Author: 30 characters wide - Author name
 * 4. ISBN: 15 characters wide - ISBN number
 * 5. Category: 20 characters wide - Book category
 * 6. Quantity: 10 characters wide - Current stock (0 if null)
 * 7. Status: 12 characters wide - "available", "borrowed", or "missing"
 * 8. Added Date: 15 characters wide - Date in YYYY-MM-DD format
 * 
 * ADVANTAGES OVER CSV:
 * - No comma/quote escaping issues
 * - Automatic column width optimization
 * - Professional appearance when opened
 * - Headers are clearly distinguished
 * - Better compatibility with Excel/LibreOffice
 * - Preserves data types (dates, numbers)
 * 
 * DATA FORMATTING:
 * - Dates: Converted from MySQL datetime to YYYY-MM-DD format
 * - Quantity: Defaults to 0 if null
 * - Text: Rendered exactly as stored (no quote escaping needed)
 * - Numbers: Properly typed as numeric values
 * 
 * QUERY DETAILS:
 * - SQL: SELECT id, title, author, isbn, category, quantity, status, added_date FROM books
 * - Ordering: Most recent first (ORDER BY id DESC)
 * - No filtering: Exports ALL books regardless of status
 * 
 * FILE GENERATION PROCESS:
 * 1. Query all books from database
 * 2. Transform to array of objects with capitalized headers
 * 3. Create new workbook using exceljs
 * 4. Convert JSON array to worksheet
 * 5. Apply column width settings
 * 6. Append worksheet to workbook
 * 7. Generate binary buffer for download
 * 
 * FILE NAMING (handled by route):
 * - Format: books_export_YYYY-MM-DDTHH-MM-SS.xlsx
 * - Timestamp prevents filename conflicts
 * - Instantly opens in Excel/Google Sheets/LibreOffice
 * 
 * USE CASES:
 * - User-friendly inventory reports
 * - Distribution to non-technical staff
 * - Professional presentation of data
 * - Easy editing and analysis in spreadsheet apps
 * - Printing with proper column alignment
 * 
 * PERFORMANCE:
 * - Fetches all books in single query
 * - exceljs handles large datasets efficiently
 * - Returns buffer (not file) for memory efficiency
 * 
 * TECHNICAL DEPENDENCIES:
 * - exceljs library (npm package)
 * - Requires all column headers to match expected format
 * 
 * @returns {Promise<Buffer>} Binary buffer containing complete .xlsx file ready for download
 * @throws {Error} Database query errors or excel generation failures
 */
const exportBooksToExcel = async () => {
  const query = `
    SELECT id, title, author, isbn, category, quantity, status, added_date
    FROM books
    ORDER BY id DESC
  `;

  const books = await queryDB(query);

  // Format data for Excel
  const excelData = books.map((book) => ({
    ID: book.id,
    Title: book.title,
    Author: book.author,
    ISBN: book.isbn,
    Category: book.category,
    Quantity: book.quantity || 0,
    Status: book.status,
    "Added Date": new Date(book.added_date).toISOString().split("T")[0],
  }));

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Books");

  worksheet.columns = [
    { header: "ID", key: "ID", width: 8 },
    { header: "Title", key: "Title", width: 40 },
    { header: "Author", key: "Author", width: 30 },
    { header: "ISBN", key: "ISBN", width: 15 },
    { header: "Category", key: "Category", width: 20 },
    { header: "Quantity", key: "Quantity", width: 10 },
    { header: "Status", key: "Status", width: 12 },
    { header: "Added Date", key: "Added Date", width: 15 },
  ];

  excelData.forEach((row) => worksheet.addRow(row));

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
};

/**
 * Clean up uploaded file after processing
 * 
 * HELPER FUNCTION - FILE SYSTEM MANAGEMENT
 * Safely deletes temporary CSV files from the /uploads directory after import processing.
 * This prevents disk space bloat from accumulated uploaded files.
 * 
 * Purpose:
 * - Remove temporary CSV files after successful import
 * - Prevent /uploads directory from growing indefinitely
 * - Clean up files even if import fails (called in finally block)
 * 
 * Safety Features:
 * - Checks file existence before attempting deletion
 * - No error thrown if file doesn't exist
 * - Synchronous operation ensures cleanup before response sent
 * 
 * When Called:
 * - After importBooks() completes (success or failure)
 * - In route handler's finally block
 * - Before sending response to client
 * 
 * File Lifecycle:
 * 1. User uploads CSV → multer saves to /uploads/books-{timestamp}.csv
 * 2. parseCSV() reads file → returns parsed data
 * 3. importBooks() processes data → returns summary
 * 4. cleanupFile() deletes original CSV → frees disk space
 * 
 * @param {string} filePath - Absolute path to the uploaded file to delete
 * @returns {void} No return value
 */
const cleanupFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

module.exports = {
  parseCSV,
  parseExcel,
  importBooks,
  exportBooksToCSV,
  exportBooksToExcel,
  cleanupFile,
  queryDB,
};
