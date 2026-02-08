DROP TABLE IF EXISTS units;

CREATE TABLE units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT UNIQUE NOT NULL,
    model TEXT,
    issue TEXT,
    status TEXT DEFAULT 'Received',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
