require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
  user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE || process.env.DB_DATABASE || 'spist_library',
};

const ACTIVE_BOOK_STATUSES = new Set(['active', 'available', 'borrowed', 'maintenance', 'retired', 'missing']);

function toInt(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

async function ensureSequenceRow(conn, year) {
  await conn.execute(
    `INSERT INTO accession_sequence (year, last_sequence)
     VALUES (?, 0)
     ON DUPLICATE KEY UPDATE year = VALUES(year)`,
    [year]
  );
}

async function getNextAccession(conn, year) {
  const [rows] = await conn.execute(
    'SELECT last_sequence FROM accession_sequence WHERE year = ? FOR UPDATE',
    [year]
  );
  const nextSeq = toInt(rows[0] && rows[0].last_sequence, 0) + 1;
  await conn.execute(
    'UPDATE accession_sequence SET last_sequence = ? WHERE year = ?',
    [nextSeq, year]
  );
  return `ACC-${year}-${String(nextSeq).padStart(5, '0')}`;
}

async function createMissingCopies(conn, year) {
  const [books] = await conn.execute(`
    SELECT id, title, status, quantity, available_quantity
    FROM books
    WHERE deleted_at IS NULL
    ORDER BY id ASC
  `);

  let booksTouched = 0;
  let copiesCreated = 0;

  for (const book of books) {
    const bookStatus = String(book.status || 'active').toLowerCase();
    if (!ACTIVE_BOOK_STATUSES.has(bookStatus)) continue;

    const targetQty = Math.max(0, toInt(book.quantity, 0));

    const [copyInfoRows] = await conn.execute(
      'SELECT COALESCE(COUNT(*), 0) AS total, COALESCE(MAX(copy_number), 0) AS max_copy FROM book_copies WHERE book_id = ?',
      [book.id]
    );

    const existingTotal = toInt(copyInfoRows[0] && copyInfoRows[0].total, 0);
    const currentMaxCopy = toInt(copyInfoRows[0] && copyInfoRows[0].max_copy, 0);
    const missing = targetQty - existingTotal;

    if (missing <= 0) continue;

    booksTouched += 1;

    // Keep copy status aligned with coarse book lifecycle state.
    const newCopyStatus = bookStatus === 'maintenance'
      ? 'maintenance'
      : (bookStatus === 'retired' ? 'retired' : 'available');

    for (let i = 1; i <= missing; i++) {
      const copyNumber = currentMaxCopy + i;
      const accession = await getNextAccession(conn, year);

      await conn.execute(
        `INSERT INTO book_copies
         (accession_number, book_id, copy_number, condition_status, location, status)
         VALUES (?, ?, ?, 'excellent', 'Main Library', ?)`,
        [accession, book.id, copyNumber, newCopyStatus]
      );

      await conn.execute(
        `INSERT INTO book_copy_audit (accession_number, action, new_value, notes)
         VALUES (?, 'created', ?, ?)`,
        [
          accession,
          JSON.stringify({ source: 'backfill', book_id: book.id, copy_number: copyNumber, status: newCopyStatus }),
          'Backfill script created missing copy',
        ]
      );

      copiesCreated += 1;
    }
  }

  return { booksTouched, copiesCreated };
}

async function assignBorrowingsWithoutAccession(conn) {
  const [rows] = await conn.execute(`
    SELECT id, book_id
    FROM book_borrowings
    WHERE accession_number IS NULL
      AND return_date IS NULL
      AND status IN ('borrowed', 'overdue')
    ORDER BY id ASC
  `);

  let linked = 0;
  let unlinked = 0;

  for (const row of rows) {
    const [availableCopyRows] = await conn.execute(`
      SELECT bc.accession_number
      FROM book_copies bc
      WHERE bc.book_id = ?
        AND bc.status = 'available'
        AND NOT EXISTS (
          SELECT 1
          FROM book_borrowings bb
          WHERE bb.accession_number = bc.accession_number
            AND bb.return_date IS NULL
            AND bb.status IN ('borrowed', 'overdue')
        )
      ORDER BY bc.copy_number ASC
      LIMIT 1
    `, [row.book_id]);

    if (!availableCopyRows.length) {
      unlinked += 1;
      continue;
    }

    const accession = availableCopyRows[0].accession_number;

    await conn.execute(
      'UPDATE book_borrowings SET accession_number = ? WHERE id = ?',
      [accession, row.id]
    );

    await conn.execute(
      "UPDATE book_copies SET status = 'borrowed' WHERE accession_number = ?",
      [accession]
    );

    await conn.execute(
      `INSERT INTO book_copy_audit (accession_number, action, new_value, notes)
       VALUES (?, 'borrowed', ?, ?)`,
      [
        accession,
        JSON.stringify({ source: 'backfill_link', borrowing_id: row.id }),
        'Backfill linked active borrowing to copy',
      ]
    );

    linked += 1;
  }

  return { linked, unlinked };
}

async function recalcBookCounters(conn) {
  await conn.execute(`
    UPDATE books b
    LEFT JOIN (
      SELECT
        book_id,
        COUNT(*) AS total_copies,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available_copies
      FROM book_copies
      GROUP BY book_id
    ) c ON c.book_id = b.id
    SET
      b.quantity = COALESCE(c.total_copies, 0),
      b.available_quantity = COALESCE(c.available_copies, 0)
    WHERE b.deleted_at IS NULL
  `);
}

async function main() {
  const conn = await mysql.createConnection(dbConfig);
  const year = new Date().getFullYear();

  try {
    console.log('Starting accession backfill...');
    await conn.beginTransaction();

    await ensureSequenceRow(conn, year);

    const creation = await createMissingCopies(conn, year);
    const linking = await assignBorrowingsWithoutAccession(conn);

    await recalcBookCounters(conn);

    await conn.commit();

    console.log('Backfill complete.');
    console.log(`Books touched: ${creation.booksTouched}`);
    console.log(`Copies created: ${creation.copiesCreated}`);
    console.log(`Borrowings linked: ${linking.linked}`);
    console.log(`Borrowings still unlinked: ${linking.unlinked}`);
    console.log('QR codes are now available via /api/book-copies/qr/:accessionNumber for all accessioned copies.');
  } catch (error) {
    await conn.rollback();
    console.error('Backfill failed:', error.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
