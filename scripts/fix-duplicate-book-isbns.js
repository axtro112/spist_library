/*
  Fix duplicate book ISBN rows safely.

  Default mode is dry-run (no DB changes):
    node scripts/fix-duplicate-book-isbns.js

  Apply mode (makes changes):
    node scripts/fix-duplicate-book-isbns.js --apply

  What apply mode does:
  - Finds ISBN groups with more than one ACTIVE row (deleted_at IS NULL)
  - Keeps one active row (latest updated/added/id)
  - Re-links dependent rows from dropped active rows:
      - book_copies.book_id
      - book_borrowings.book_id
  - Merges quantity/available_quantity into kept row
  - Soft-deletes dropped active rows (sets deleted_at=NOW())
*/

const db = require('../src/utils/db');

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function computeStatus(totalQty, totalAvail) {
  if (totalQty <= 0) return 'missing';
  return totalAvail > 0 ? 'available' : 'borrowed';
}

async function getDuplicateGroups() {
  return db.query(
    `SELECT
       isbn,
       COUNT(*) AS total_rows,
       SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) AS active_rows,
       SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) AS trashed_rows
     FROM books
     WHERE isbn IS NOT NULL AND TRIM(isbn) <> ''
     GROUP BY isbn
     HAVING COUNT(*) > 1
     ORDER BY COUNT(*) DESC, isbn ASC`
  );
}

async function getRowsByIsbn(conn, isbn) {
  return conn.queryAsync(
    `SELECT id, title, isbn, quantity, available_quantity, status, deleted_at, updated_at, added_date
     FROM books
     WHERE isbn = ?
     ORDER BY (deleted_at IS NULL) DESC,
              COALESCE(updated_at, added_date) DESC,
              id DESC`,
    [isbn]
  );
}

async function applyFixForIsbn(isbn) {
  return db.withTransaction(async (conn) => {
    const rows = await getRowsByIsbn(conn, isbn);
    const active = rows.filter((r) => !r.deleted_at);

    if (active.length <= 1) {
      return {
        isbn,
        changed: false,
        reason: active.length === 0 ? 'no_active_rows' : 'single_active_row',
      };
    }

    const keep = active[0];
    const drop = active.slice(1);

    const mergedQuantity = active.reduce((sum, r) => sum + toNumber(r.quantity), 0);
    const mergedAvailable = active.reduce((sum, r) => sum + toNumber(r.available_quantity), 0);
    const mergedStatus = computeStatus(mergedQuantity, mergedAvailable);

    for (const row of drop) {
      await conn.queryAsync('UPDATE book_copies SET book_id = ? WHERE book_id = ?', [keep.id, row.id]);
      await conn.queryAsync('UPDATE book_borrowings SET book_id = ? WHERE book_id = ?', [keep.id, row.id]);
    }

    await conn.queryAsync(
      `UPDATE books
       SET quantity = ?, available_quantity = ?, status = ?, deleted_at = NULL, updated_at = NOW()
       WHERE id = ?`,
      [mergedQuantity, mergedAvailable, mergedStatus, keep.id]
    );

    const dropIds = drop.map((r) => r.id);
    if (dropIds.length > 0) {
      await conn.queryAsync(
        `UPDATE books
         SET deleted_at = NOW(), updated_at = NOW()
         WHERE id IN (${dropIds.map(() => '?').join(',')})`,
        dropIds
      );
    }

    return {
      isbn,
      changed: true,
      keepId: keep.id,
      droppedIds: dropIds,
      mergedQuantity,
      mergedAvailable,
      mergedStatus,
    };
  });
}

async function main() {
  const apply = hasFlag('--apply');

  try {
    const groups = await getDuplicateGroups();

    if (!groups.length) {
      console.log('No duplicate ISBN groups found.');
      process.exit(0);
    }

    console.log(`Found ${groups.length} duplicate ISBN group(s).`);

    let groupsWithMultiActive = 0;
    for (const g of groups) {
      const activeRows = toNumber(g.active_rows);
      if (activeRows > 1) groupsWithMultiActive += 1;
      console.log(
        `- ISBN ${g.isbn}: total=${g.total_rows}, active=${g.active_rows}, trashed=${g.trashed_rows}`
      );
    }

    if (!apply) {
      console.log('');
      console.log('Dry-run only. No changes made.');
      console.log('Run with --apply to merge duplicate ACTIVE rows safely.');
      process.exit(0);
    }

    if (groupsWithMultiActive === 0) {
      console.log('No ISBN groups with multiple ACTIVE rows. Nothing to fix in apply mode.');
      process.exit(0);
    }

    console.log('');
    console.log('Applying safe merge for duplicate ACTIVE ISBN rows...');

    let changed = 0;
    for (const g of groups) {
      const result = await applyFixForIsbn(g.isbn);
      if (!result.changed) continue;

      changed += 1;
      console.log(
        `  fixed ISBN ${result.isbn}: keep=${result.keepId}, dropped=[${result.droppedIds.join(', ')}], quantity=${result.mergedQuantity}, available=${result.mergedAvailable}, status=${result.mergedStatus}`
      );
    }

    console.log('');
    console.log(`Done. Updated ${changed} ISBN group(s).`);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  }
}

main();
