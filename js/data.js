// ================================================================
// JSON Vault – Data Layer
// All state lives in DATA. Persisted in localStorage.
// ================================================================

const DATA = {
  collections: {},   // colId → collection object
  colOrder: [],      // display order
  expandedCols: {},  // colId → bool
  currentCollection: null,
  currentEntry: null
};

// ── Persistence ──────────────────────────────────────────────────

function jv_save() {
  try {
    localStorage.setItem('json-vault', JSON.stringify(DATA));
  } catch (e) {
    console.warn('[JSON Vault] Save failed:', e);
  }
}

function jv_load() {
  try {
    const raw = localStorage.getItem('json-vault');
    if (raw) Object.assign(DATA, JSON.parse(raw));
  } catch (e) {
    console.warn('[JSON Vault] Load failed:', e);
  }
  // Ensure required fields
  if (!DATA.collections)   DATA.collections   = {};
  if (!DATA.colOrder)      DATA.colOrder      = [];
  if (!DATA.expandedCols)  DATA.expandedCols  = {};
  // Ensure entryOrder on existing collections
  for (const col of Object.values(DATA.collections)) {
    if (!col.entryOrder) col.entryOrder = Object.keys(col.entries || {});
    if (!col.entries)    col.entries    = {};
    for (const entry of Object.values(col.entries)) {
      if (!('headers' in entry)) entry.headers = null;
    }
  }
}

// ── Collection CRUD ──────────────────────────────────────────────

function col_create({ name, icon = '📁', color = '#7c5af5', description = '', baseUrl = '' }) {
  const id = 'col_' + Date.now();
  DATA.collections[id] = {
    id, name, icon, color, description, baseUrl,
    entries: {},
    entryOrder: [],
    createdAt: Date.now()
  };
  DATA.colOrder.push(id);
  DATA.expandedCols[id] = true;
  DATA.currentCollection = id;
  DATA.currentEntry = null;
  jv_save();
  return id;
}

function col_update(colId, updates) {
  Object.assign(DATA.collections[colId], updates);
  jv_save();
}

function col_delete(colId) {
  delete DATA.collections[colId];
  DATA.colOrder = DATA.colOrder.filter(id => id !== colId);
  delete DATA.expandedCols[colId];
  if (DATA.currentCollection === colId) {
    DATA.currentCollection = DATA.colOrder[0] || null;
    DATA.currentEntry = null;
    if (DATA.currentCollection) {
      const firstCol = DATA.collections[DATA.currentCollection];
      DATA.currentEntry = firstCol?.entryOrder?.[0] || null;
    }
  }
  jv_save();
}

function col_toggle(colId) {
  DATA.expandedCols[colId] = !DATA.expandedCols[colId];
  jv_save();
}

// ── Entry CRUD ───────────────────────────────────────────────────

function entry_create(colId, {
  name, description = '', endpoint = '', method = 'GET',
  tags = [], requestJson = null, responseJson = {}, headers = null, notes = ''
}) {
  const id = 'entry_' + Date.now();
  const col = DATA.collections[colId];
  if (!col.entryOrder) col.entryOrder = [];
  col.entries[id] = {
    id, name, description, endpoint, method, tags,
    requestJson, responseJson, headers, notes,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  col.entryOrder.push(id);
  DATA.currentCollection = colId;
  DATA.currentEntry = id;
  jv_save();
  return id;
}

function entry_update(colId, entryId, updates) {
  const entry = DATA.collections[colId].entries[entryId];
  Object.assign(entry, updates, { updatedAt: Date.now() });
  jv_save();
}

function entry_delete(colId, entryId) {
  const col = DATA.collections[colId];
  delete col.entries[entryId];
  col.entryOrder = (col.entryOrder || []).filter(id => id !== entryId);
  if (DATA.currentEntry === entryId) {
    DATA.currentEntry = col.entryOrder[0] || null;
  }
  jv_save();
}

// ── Selectors ────────────────────────────────────────────────────

function entry_getCurrent() {
  if (!DATA.currentCollection || !DATA.currentEntry) return null;
  return DATA.collections[DATA.currentCollection]?.entries[DATA.currentEntry] || null;
}

function entries_search(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const results = [];
  for (const colId of DATA.colOrder) {
    const col = DATA.collections[colId];
    if (!col) continue;
    const order = col.entryOrder || Object.keys(col.entries);
    for (const entryId of order) {
      const entry = col.entries[entryId];
      if (!entry) continue;
      if (
        entry.name.toLowerCase().includes(q) ||
        (entry.endpoint || '').toLowerCase().includes(q) ||
        (entry.description || '').toLowerCase().includes(q) ||
        (entry.tags || []).some(t => t.toLowerCase().includes(q))
      ) {
        results.push({ colId, col, entryId, entry });
      }
    }
  }
  return results;
}

// ── Import / Export ──────────────────────────────────────────────

function export_collection(colId) {
  return JSON.stringify({
    _type: 'json-vault-collection',
    version: 1,
    collection: DATA.collections[colId]
  }, null, 2);
}

function export_all() {
  return JSON.stringify({
    _type: 'json-vault-export',
    version: 1,
    collections: DATA.collections,
    colOrder: DATA.colOrder
  }, null, 2);
}

function import_data(jsonStr) {
  const data = JSON.parse(jsonStr);
  if (data._type === 'json-vault-collection') {
    const col = { ...data.collection };
    const id = 'col_' + Date.now();
    col.id = id;
    if (!col.entryOrder) col.entryOrder = Object.keys(col.entries || {});
    for (const entry of Object.values(col.entries || {})) {
      if (!('headers' in entry)) entry.headers = null;
    }
    DATA.collections[id] = col;
    DATA.colOrder.push(id);
    DATA.expandedCols[id] = true;
    DATA.currentCollection = id;
    DATA.currentEntry = col.entryOrder[0] || null;
    jv_save();
    return id;
  }
  if (data._type === 'json-vault-export') {
    let firstNewId = null;
    const ordered = data.colOrder || Object.keys(data.collections || {});
    for (const oldId of ordered) {
      const col = data.collections[oldId];
      if (!col) continue;
      const id = 'col_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      col.id = id;
      if (!col.entryOrder) col.entryOrder = Object.keys(col.entries || {});
      for (const entry of Object.values(col.entries || {})) {
        if (!('headers' in entry)) entry.headers = null;
      }
      DATA.collections[id] = col;
      DATA.colOrder.push(id);
      DATA.expandedCols[id] = true;
      if (!firstNewId) firstNewId = id;
    }
    DATA.currentCollection = firstNewId;
    DATA.currentEntry = null;
    jv_save();
    return firstNewId;
  }
  throw new Error('Unrecognized import format');
}

// ── Diff Utility ─────────────────────────────────────────────────

function json_diff(golden, actual, path = '') {
  const diffs = [];

  if (golden === null || actual === null || typeof golden !== 'object' || typeof actual !== 'object') {
    if (JSON.stringify(golden) !== JSON.stringify(actual)) {
      diffs.push({ type: 'changed', path: path || '(root)', golden, actual });
    }
    return diffs;
  }

  const isGoldArr = Array.isArray(golden);
  const isActArr  = Array.isArray(actual);

  if (isGoldArr !== isActArr) {
    diffs.push({ type: 'changed', path: path || '(root)', golden, actual });
    return diffs;
  }

  if (isGoldArr) {
    if (golden.length !== actual.length) {
      diffs.push({ type: 'changed', path: `${path}.length`, golden: golden.length, actual: actual.length });
    }
    const len = Math.min(golden.length, actual.length);
    for (let i = 0; i < len; i++) {
      diffs.push(...json_diff(golden[i], actual[i], `${path}[${i}]`));
    }
    return diffs;
  }

  const gKeys = Object.keys(golden);
  const aKeys = Object.keys(actual);
  const all   = new Set([...gKeys, ...aKeys]);

  for (const key of all) {
    const p = path ? `${path}.${key}` : key;
    if (!(key in golden)) {
      diffs.push({ type: 'added', path: p, actual: actual[key] });
    } else if (!(key in actual)) {
      diffs.push({ type: 'missing', path: p, golden: golden[key] });
    } else {
      diffs.push(...json_diff(golden[key], actual[key], p));
    }
  }

  return diffs;
}
