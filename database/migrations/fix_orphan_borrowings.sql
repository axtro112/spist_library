-- =============================================================================
-- [ORPHAN FIX] Orphaned Borrowing Records — Diagnostic & Cleanup Script
-- Run this manually in a safe environment (staging/backup first).
-- DO NOT run this automatically — each section is opt-in.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: IDENTIFY orphan borrowings (book no longer exists in books table)
-- ---------------------------------------------------------------------------
SELECT
  bb.id          AS borrowing_id,
  bb.book_id,
  bb.student_id,
  bb.accession_number,
  bb.status,
  bb.borrow_date,
  bb.return_date
FROM book_borrowings bb
LEFT JOIN books b ON bb.book_id = b.id
WHERE b.id IS NULL
ORDER BY bb.borrow_date DESC;

-- ---------------------------------------------------------------------------
-- STEP 2: IDENTIFY borrowings for soft-deleted (trashed) books
-- ---------------------------------------------------------------------------
SELECT
  bb.id          AS borrowing_id,
  bb.book_id,
  b.title        AS book_title,
  b.deleted_at   AS book_trashed_at,
  bb.student_id,
  bb.accession_number,
  bb.status,
  bb.borrow_date,
  bb.return_date
FROM book_borrowings bb
INNER JOIN books b ON bb.book_id = b.id
WHERE b.deleted_at IS NOT NULL
ORDER BY bb.borrow_date DESC;

-- ---------------------------------------------------------------------------
-- STEP 3: IDENTIFY orphan copy references
-- (book_borrowings.accession_number references a copy whose book is gone)
-- ---------------------------------------------------------------------------
SELECT
  bb.id          AS borrowing_id,
  bb.book_id,
  bb.accession_number,
  bc.id          AS copy_id,
  bb.status
FROM book_borrowings bb
LEFT JOIN book_copies bc ON bc.accession_number = bb.accession_number
LEFT JOIN books b ON bc.book_id = b.id
WHERE bb.accession_number IS NOT NULL
  AND (bc.id IS NULL OR b.id IS NULL)
ORDER BY bb.borrow_date DESC;

-- =============================================================================
-- CLEANUP OPTION 1 (PREFERRED — SAFE): Mark orphan borrows as returned
-- Only affects records where the referenced book no longer exists at all.
-- Uncomment to run:
-- =============================================================================
/*
UPDATE book_borrowings bb
LEFT JOIN books b ON bb.book_id = b.id
SET
  bb.status      = 'returned',
  bb.return_date = COALESCE(bb.return_date, NOW()),
  bb.notes       = CONCAT(COALESCE(bb.notes, ''), ' [Auto-closed: book no longer exists]')
WHERE b.id IS NULL
  AND bb.status NOT IN ('returned', 'cancelled');
*/

-- =============================================================================
-- CLEANUP OPTION 2 (DESTRUCTIVE — USE WITH CAUTION): Delete orphan records
-- Only removes records where the referenced book row is completely gone.
-- Uncomment to run, and ONLY after a full database backup:
-- =============================================================================
/*
DELETE bb
FROM book_borrowings bb
LEFT JOIN books b ON bb.book_id = b.id
WHERE b.id IS NULL;
*/
