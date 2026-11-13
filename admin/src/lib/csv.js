/** Lightweight CSV helpers for admin import / export. */

export function escapeCsvCell(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(headers, rows) {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvCell(row[h])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function downloadCsv(filename, headers, rows) {
  const csv = rowsToCsv(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Parse simple CSV (supports quoted fields). Returns { headers, rows }. */
export function parseCsv(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '');
  const lines = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    const next = raw[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === '\n') {
      lines.push(cur);
      cur = '';
      continue;
    }
    if (ch === '\r') continue;
    cur += ch;
  }
  if (cur.length || lines.length) lines.push(cur);

  const splitLine = (line) => {
    const cells = [];
    let cell = '';
    let q = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      const next = line[i + 1];
      if (q) {
        if (ch === '"' && next === '"') {
          cell += '"';
          i += 1;
        } else if (ch === '"') {
          q = false;
        } else {
          cell += ch;
        }
        continue;
      }
      if (ch === '"') {
        q = true;
        continue;
      }
      if (ch === ',') {
        cells.push(cell);
        cell = '';
        continue;
      }
      cell += ch;
    }
    cells.push(cell);
    return cells;
  };

  const nonEmpty = lines.filter((l) => String(l).trim().length > 0);
  if (!nonEmpty.length) return { headers: [], rows: [] };

  const headers = splitLine(nonEmpty[0]).map((h) => String(h || '').trim());
  const rows = nonEmpty.slice(1).map((line) => {
    const cells = splitLine(line);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] != null ? String(cells[idx]).trim() : '';
    });
    return obj;
  });

  return { headers, rows };
}

export function pickFileAsText(accept = '.csv,text/csv') {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No file selected.'));
        return;
      }
      try {
        resolve({ file, text: await file.text() });
      } catch (err) {
        reject(err);
      }
    };
    input.click();
  });
}
