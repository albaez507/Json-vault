// ================================================================
// JSON Vault – UI Layer
// Dependencies: data.js
// ================================================================

let currentTab  = 'response';   // 'response' | 'request' | 'notes'
let _searchQuery = '';
let _splitView   = true;        // side-by-side Request | Response (default)
let _splitRightTab = 'response'; // 'response' | 'headers' | 'notes'
let _jsonViewMode = 'response'; // 'hidden' | 'request' | 'response'
let _projectMode = false;       // collection project details panel

// ── Master render ─────────────────────────────────────────────────

function render() {
  renderSidebar();
  renderMainPanel();
}

// ── Sidebar ───────────────────────────────────────────────────────

function renderSidebar() {
  const body = document.getElementById('sidebar-body');
  if (!body) return;
  body.innerHTML = '';

  if (_searchQuery) {
    renderSearchResults(body);
    return;
  }

  if (DATA.colOrder.length === 0) {
    body.innerHTML = `
      <div class="sidebar-empty">
        <p>No collections yet.</p>
        <p>Create one to start storing<br>your golden JSON references.</p>
        <button class="btn-primary" style="margin-top:8px;font-size:12px" onclick="openCollectionModal()">+ New Collection</button>
      </div>`;
    return;
  }

  for (const colId of DATA.colOrder) {
    const col = DATA.collections[colId];
    if (col) body.appendChild(buildColItem(colId, col));
  }
}

function buildColItem(colId, col) {
  const isExpanded = DATA.expandedCols[colId];
  const order = col.entryOrder || Object.keys(col.entries);
  const count = order.length;

  const wrap = document.createElement('div');
  wrap.className = 'col-item';

  // Header
  const hdr = document.createElement('div');
  hdr.className = 'col-header' + (DATA.currentCollection === colId && !DATA.currentEntry ? ' active' : '');
  hdr.dataset.colId = colId;

  hdr.innerHTML = `
    <span class="col-toggle">${isExpanded ? '▾' : '▸'}</span>
    <span class="col-icon">${col.icon}</span>
    <span class="col-name">${esc(col.name)}</span>
    <span class="col-count">${count}</span>
    <span class="col-actions">
      <button class="btn-icon-sm" data-action="add-entry" data-col="${colId}" title="Add entry">+</button>
      <button class="btn-icon-sm" data-action="col-menu" data-col="${colId}" title="More actions">⋯</button>
    </span>`;

  hdr.addEventListener('click', e => {
    if (e.target.closest('[data-action]')) return;
    col_toggle(colId);
    render();
  });

  wrap.appendChild(hdr);

  if (isExpanded && count > 0) {
    const entries = document.createElement('div');
    entries.className = 'col-entries';
    for (const entryId of order) {
      const entry = col.entries[entryId];
      if (entry) entries.appendChild(buildEntryItem(colId, entryId, entry));
    }
    wrap.appendChild(entries);
  }

  return wrap;
}

function buildEntryItem(colId, entryId, entry) {
  const isActive = DATA.currentCollection === colId && DATA.currentEntry === entryId;
  const color = methodColor(entry.method);

  const item = document.createElement('div');
  item.className = 'entry-item' + (isActive ? ' active' : '');
  item.dataset.colId = colId;
  item.dataset.entryId = entryId;

  item.innerHTML = `
    <span class="entry-method-badge" style="color:${color}">${entry.method}</span>
    <span class="entry-item-name">${esc(entry.name)}</span>`;

  // ··· menu button — shown on hover only
  const menuBtn = document.createElement('button');
  menuBtn.className = 'entry-menu-btn';
  menuBtn.title = 'More options';
  menuBtn.textContent = '···';
  menuBtn.addEventListener('click', e => {
    e.stopPropagation();
    openEntryMenu(colId, entryId, e);
  });
  item.appendChild(menuBtn);

  item.addEventListener('click', () => {
    DATA.currentCollection = colId;
    DATA.currentEntry = entryId;
    _projectMode = false;
    DATA.expandedCols[colId] = true;
    jv_save();
    render();
  });

  return item;
}

function renderSearchResults(body) {
  const results = entries_search(_searchQuery);

  if (results.length === 0) {
    body.innerHTML = `<div class="sidebar-empty"><p>No results for<br><strong>${esc(_searchQuery)}</strong></p></div>`;
    return;
  }

  const label = document.createElement('div');
  label.className = 'search-label';
  label.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;
  body.appendChild(label);

  for (const r of results) {
    const color = methodColor(r.entry.method);
    const item = document.createElement('div');
    item.className = 'entry-item' + (DATA.currentCollection === r.colId && DATA.currentEntry === r.entryId ? ' active' : '');
    item.innerHTML = `
      <span class="entry-method-badge" style="color:${color}">${r.entry.method}</span>
      <span class="entry-item-name">
        ${esc(r.entry.name)}
        <span class="search-entry-col">${r.col.icon} ${esc(r.col.name)}</span>
      </span>`;
    const sMenuBtn = document.createElement('button');
    sMenuBtn.className = 'entry-menu-btn';
    sMenuBtn.title = 'More options';
    sMenuBtn.textContent = '···';
    sMenuBtn.addEventListener('click', e => {
      e.stopPropagation();
      openEntryMenu(r.colId, r.entryId, e);
    });
    item.appendChild(sMenuBtn);
    item.addEventListener('click', () => {
      DATA.currentCollection = r.colId;
      DATA.currentEntry = r.entryId;
      _projectMode = false;
      DATA.expandedCols[r.colId] = true;
      jv_save();
      render();
    });
    body.appendChild(item);
  }
}

// ── Main Panel ────────────────────────────────────────────────────

function renderMainPanel() {
  const panel = document.getElementById('main-panel');
  if (!panel) return;
  panel.innerHTML = '';

  const entry = entry_getCurrent();

  if (!entry) {
    panel.innerHTML = DATA.colOrder.length === 0 ? buildEmptyFirst() : buildEmptySelect();
    return;
  }

  panel.appendChild(buildEntryView(DATA.currentCollection, DATA.currentEntry, entry));
}

function buildEmptyFirst() {
  return `
    <div class="empty-state">
      <div class="empty-icon">⬡</div>
      <h2 class="empty-title">JSON Vault</h2>
      <p class="empty-desc">Store and organize golden JSON references<br>to validate your API responses.</p>
      <button class="btn-primary" onclick="openCollectionModal()">Create your first collection</button>
    </div>`;
}

function buildEmptySelect() {
  const total = DATA.colOrder.reduce((n, cid) => n + Object.keys(DATA.collections[cid]?.entries || {}).length, 0);
  return `
    <div class="empty-state">
      <div class="empty-icon" style="font-size:32px">←</div>
      <p class="empty-desc">Select an entry from the sidebar<br>or add a new one to a collection.</p>
      <p class="empty-meta">${DATA.colOrder.length} collection${DATA.colOrder.length !== 1 ? 's' : ''} · ${total} entries</p>
    </div>`;
}

// ── Entry View ────────────────────────────────────────────────────

function buildEntryView(colId, entryId, entry) {
  const col = DATA.collections[colId];
  const color = methodColor(entry.method);
  const hasReq   = entry.requestJson  !== null && entry.requestJson  !== undefined;

  const view = document.createElement('div');
  view.className = 'entry-view';

  // ── Header ──
  const hdr = document.createElement('div');
  hdr.className = 'ev-header';

  const tagsHtml = (entry.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');

  // Build the displayed URL: baseUrl (from collection) + endpoint (from entry)
  const baseUrl  = col.baseUrl || '';
  const endpoint = entry.endpoint || '';
  const isFullUrl = endpoint.startsWith('http://') || endpoint.startsWith('https://');
  let hostLabel = '';
  let pathLabel = '';
  if (isFullUrl) {
    try {
      const u = new URL(endpoint);
      hostLabel = u.origin;
      pathLabel = (u.pathname || '/') + (u.search || '');
    } catch (e) {
      hostLabel = '';
      pathLabel = endpoint;
    }
  } else {
    hostLabel = baseUrl;
    pathLabel = endpoint || (baseUrl ? '/' : '');
  }
  const hostBadge = hostLabel ? hostLabel.replace(/^https?:\/\//, '') : '';
  const hasHost = Boolean(hostBadge);
  const hasPath = Boolean(pathLabel);

  hdr.innerHTML = `
    <div class="ev-breadcrumb">
      <span class="ev-crumb-col">${col.icon} ${esc(col.name)}</span>
      <span class="ev-crumb-sep">›</span>
      <span class="ev-crumb-entry">${esc(entry.name)}</span>
    </div>

    <div class="ev-url-row${hasHost ? '' : ' no-url'}">
      ${hasHost ? `<div class="url-stack">
        <div class="url-host-row">
          <span class="url-host-label">HOST</span>
          <span class="url-host-chip">${esc(hostBadge)}</span>
        </div>
        <div class="url-bar">
          <div class="url-method-wrap" style="--mc:${color}">
            <span class="url-method">${entry.method}</span>
          </div>
          <div class="url-text">
            ${hasPath
              ? `<span class="url-path">${esc(pathLabel)}</span>`
              : `<span class="url-empty">no endpoint - click Edit to add one</span>`}
          </div>
        </div>
      </div>` : ''}
    </div>

    <div class="ev-meta-row">
      <span class="ev-entry-name">${esc(entry.name)}</span>
      ${entry.description ? `<span class="ev-desc">— ${esc(entry.description)}</span>` : ''}
      <button class="btn-action ev-compare-action" id="ev-btn-compare">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        Compare
      </button>      <span class="ev-updated">Updated ${timeAgo(entry.updatedAt)}</span>
    </div>

    <div class="ev-tags-row">${tagsHtml || '<span class="no-tags">no tags</span>'}</div>`;

  // Top-left view mode icons: hide / request / response / split
  const breadcrumb = hdr.querySelector('.ev-breadcrumb');
  if (breadcrumb) {
    const viewGroup = document.createElement('div');
    viewGroup.className = 'json-depth-group json-view-group';
    const modes = [
      { id: 'hidden',   title: 'Hide request and response JSON' },
      { id: 'request',  title: 'Show request JSON only' },
      { id: 'response', title: 'Show response JSON only' },
      { id: 'split',    title: _splitView ? 'Exit split view' : 'Split view: request + response' }
    ];
    for (const mode of modes) {
      const btn = document.createElement('button');
      const isActive = mode.id === 'split'
        ? (!_projectMode && _splitView)
        : (!_projectMode && !_splitView && _jsonViewMode === mode.id);
      btn.className = 'btn-depth' + (isActive ? ' active' : '');
      btn.title = mode.title;
      btn.innerHTML = viewModeIconSvg(mode.id);
      btn.addEventListener('click', () => {
        if (mode.id === 'split') {
          _projectMode = false;
          _splitView = !_splitView;
          renderMainPanel();
          return;
        }
        _projectMode = false;
        _jsonViewMode = mode.id;
        if (_splitView) _splitView = false;
        renderMainPanel();
      });
      viewGroup.appendChild(btn);
    }
    breadcrumb.appendChild(viewGroup);
  }

  const crumbCol = hdr.querySelector('.ev-crumb-col');
  if (crumbCol) {
    crumbCol.classList.add('is-clickable');
    crumbCol.title = 'Show project details';
    crumbCol.addEventListener('click', () => {
      _projectMode = true;
      _splitView = false;
      renderMainPanel();
    });
  }
  const crumbEntry = hdr.querySelector('.ev-crumb-entry');
  if (crumbEntry) {
    crumbEntry.classList.add('is-clickable');
    crumbEntry.title = 'Back to entry JSON view';
    crumbEntry.addEventListener('click', () => {
      if (_projectMode) {
        _projectMode = false;
        renderMainPanel();
      }
    });
  }

  view.appendChild(hdr);

  // ── Tabs ──
  const tabBar = document.createElement('div');
  tabBar.className = 'ev-tabs';
  tabBar.style.display = 'none';

  const tabActions = document.createElement('div');
  tabActions.className = 'ev-tab-actions';
  // ── Split view toggle ──
  const splitBtn = document.createElement('button');
  splitBtn.className = 'btn-split' + (_splitView ? ' active' : '');
  splitBtn.title = _splitView ? 'Exit split view' : 'Split view — Request | Response';
  splitBtn.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="7" height="18" rx="1"/>
      <rect x="14" y="3" width="7" height="18" rx="1"/>
    </svg>
    Split`;
  splitBtn.addEventListener('click', () => {
    _splitView = !_splitView;
    renderMainPanel();
  });
  tabActions.appendChild(splitBtn);

  tabBar.appendChild(tabActions);
  view.appendChild(tabBar);

  // ── Content ──
  const content = document.createElement('div');
  content.className = 'ev-content';

  if (_projectMode) {
    content.appendChild(buildProjectPanel(col, entry));
  } else if (_splitView) {
    content.appendChild(buildSplitView(entry, hasReq, colId, entryId));
  } else if (_jsonViewMode === 'hidden') {
    content.innerHTML = '<div class="content-empty">JSON hidden. Select Request or Response to view data.</div>';
  } else if (_jsonViewMode === 'request') {
    if (hasReq) {
      content.appendChild(buildJsonViewer(entry.requestJson, 'request.json'));
    } else {
      content.innerHTML = '<div class="content-empty">No request JSON stored for this entry.</div>';
    }
  } else {
    content.appendChild(buildJsonViewer(entry.responseJson, 'response.json'));
  }

  view.appendChild(content);

  // ── Button handlers ──
  // Compare button moved to metadata row
  view.querySelector('#ev-btn-compare')?.addEventListener('click', () => {
    openCompareModal(colId, entryId);
  });


  return view;
}

function buildJsonViewer(jsonData, filename, badge = null) {
  const viewer = document.createElement('div');
  viewer.className = 'json-viewer';

  const toolbar = document.createElement('div');
  toolbar.className = 'json-toolbar';
  toolbar.innerHTML = `<span class="json-toolbar-label">${filename}</span>`;

  // Badge: REQUEST or RESPONSE label shown in split mode
  if (badge) {
    toolbar.appendChild(mkSpan('ev-split-label ' + badge.toLowerCase(), badge));
  }

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-ghost-sm';
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', () => {
    copyToClipboard(JSON.stringify(jsonData, null, 2));
    showToast('Copied!', 'success');
  });
  toolbar.appendChild(copyBtn);

  const tree = document.createElement('div');
  tree.className = 'json-tree';

  if (jsonData === null || jsonData === undefined) {
    tree.innerHTML = '<span class="j-null">null</span>';
  } else {
    tree.appendChild(buildJsonNode(jsonData, 0));
  }

  viewer.appendChild(toolbar);
  viewer.appendChild(tree);
  return viewer;
}

// ── Split View Builder ────────────────────────────────────────────

function formatProjectCredentials(credentials) {
  if (credentials === null || credentials === undefined) return 'Not configured';
  if (typeof credentials === 'string') return credentials.trim() || 'Not configured';
  try {
    return JSON.stringify(credentials, null, 2);
  } catch (e) {
    return String(credentials);
  }
}

function buildProjectPanel(col, entry) {
  const panel = document.createElement('div');
  panel.className = 'project-panel';

  const host = (col.baseUrl || '').trim() || 'Not configured';
  const shortDesc = (col.shortDescription || col.description || '').trim() || 'No short description configured.';
  const credentials = formatProjectCredentials(col.credentials);

  panel.innerHTML = `
    <div class="project-head">
      <span class="project-title">Project Details</span>
      <div class="project-head-actions">
        ${entry ? `<button class="btn-ghost-sm" id="btn-entry-edit">Edit Entry</button>` : ''}
        <button class="btn-ghost-sm" id="btn-project-edit">Edit Project</button>
      </div>
    </div>
    <div class="project-grid">
      <div class="project-item">
        <span class="project-label">Host</span>
        <pre class="project-value">${esc(host)}</pre>
      </div>
      <div class="project-item">
        <span class="project-label">Short Description</span>
        <pre class="project-value">${esc(shortDesc)}</pre>
      </div>
      <div class="project-item">
        <span class="project-label">Credentials</span>
        <pre class="project-value">${esc(credentials)}</pre>
      </div>
    </div>`;

  panel.querySelector('#btn-project-edit')?.addEventListener('click', () => {
    openCollectionModal(col.id);
  });
  panel.querySelector('#btn-entry-edit')?.addEventListener('click', () => {
    openEntryModal(col.id, entry.id);
  });

  return panel;
}

function buildSplitView(entry, hasReq, colId, entryId) {
  const layout = document.createElement('div');
  layout.className = 'ev-split-layout';

  // Left panel: Request JSON
  const left = document.createElement('div');
  left.className = 'ev-split-panel';

  if (hasReq) {
    left.appendChild(buildJsonViewer(entry.requestJson, 'request.json', 'REQUEST'));
  } else {
    // Empty state for missing request body
    const toolbar = document.createElement('div');
    toolbar.className = 'json-toolbar';
    toolbar.innerHTML = `<span class="json-toolbar-label">request.json</span>`;
    toolbar.appendChild(mkSpan('ev-split-label request', 'REQUEST'));

    const empty = document.createElement('div');
    empty.className = 'split-empty-panel';
    empty.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.3">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <span>No request body stored</span>
      <button class="btn-ghost" onclick="openEntryModal('${colId}','${entryId}')">Add request JSON</button>`;

    left.appendChild(toolbar);
    left.appendChild(empty);
  }

  // Right panel: RESPONSE | HEADERS | NOTES
  const right = buildSplitRightPanel(entry);

  // Divider (draggable)
  const divider = document.createElement('div');
  divider.className = 'ev-split-divider';
  divider.title = 'Drag to resize';

  // Simple drag-resize
  let dragging = false;
  divider.addEventListener('mousedown', e => {
    dragging = true;
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const layoutRect = layout.getBoundingClientRect();
    const pct = ((e.clientX - layoutRect.left) / layoutRect.width) * 100;
    const clamped = Math.min(Math.max(pct, 20), 80);
    left.style.flex = `0 0 ${clamped}%`;
    right.style.flex = `0 0 ${100 - clamped}%`;
  });
  document.addEventListener('mouseup', () => {
    if (dragging) { dragging = false; document.body.style.cursor = ''; }
  });

  layout.appendChild(left);
  layout.appendChild(divider);
  layout.appendChild(right);
  return layout;
}

function buildSplitRightPanel(entry) {
  if (!['response', 'headers', 'notes'].includes(_splitRightTab)) {
    _splitRightTab = 'response';
  }

  const hasHeaders = entry.headers && typeof entry.headers === 'object' && !Array.isArray(entry.headers) && Object.keys(entry.headers).length > 0;
  const hasNotes = entry.notes && entry.notes.trim();

  const right = document.createElement('div');
  right.className = 'ev-split-panel';

  const viewer = document.createElement('div');
  viewer.className = 'json-viewer';

  const toolbar = document.createElement('div');
  toolbar.className = 'json-toolbar';

  const modeSwitch = document.createElement('div');
  modeSwitch.className = 'split-right-modes';
  const modes = [
    { id: 'response', label: 'RESPONSE' },
    { id: 'headers',  label: 'HEADERS' },
    { id: 'notes',    label: 'NOTES' }
  ];

  for (const mode of modes) {
    const btn = document.createElement('button');
    btn.className = 'split-right-mode' + (_splitRightTab === mode.id ? ' active' : '');
    btn.textContent = mode.label;
    btn.addEventListener('click', () => {
      _splitRightTab = mode.id;
      renderMainPanel();
    });
    modeSwitch.appendChild(btn);
  }

  toolbar.appendChild(modeSwitch);

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-ghost-sm';
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', () => {
    if (_splitRightTab === 'notes') {
      copyToClipboard(entry.notes || '');
      showToast('Notes copied!', 'success');
      return;
    }
    const json = _splitRightTab === 'headers' ? (entry.headers || {}) : entry.responseJson;
    copyToClipboard(JSON.stringify(json, null, 2));
    showToast('Copied!', 'success');
  });
  toolbar.appendChild(copyBtn);

  viewer.appendChild(toolbar);

  if (_splitRightTab === 'notes') {
    const notes = document.createElement('div');
    notes.className = 'notes-viewer';
    notes.textContent = hasNotes ? entry.notes : 'No notes saved yet.';
    viewer.appendChild(notes);
  } else if (_splitRightTab === 'headers' && !hasHeaders) {
    const empty = document.createElement('div');
    empty.className = 'split-empty-panel';
    empty.innerHTML = '<span>No headers saved yet. Click Edit to add request headers.</span>';
    viewer.appendChild(empty);
  } else {
    const tree = document.createElement('div');
    tree.className = 'json-tree';
    const jsonData = _splitRightTab === 'headers' ? entry.headers : entry.responseJson;

    if (jsonData === null || jsonData === undefined) {
      tree.innerHTML = '<span class="j-null">null</span>';
    } else {
      tree.appendChild(buildJsonNode(jsonData, 0));
    }
    viewer.appendChild(tree);
  }

  right.appendChild(viewer);
  return right;
}

// JSON Tree Builder
function buildJsonNode(value, depth) {
  // Primitives
  if (value === null)                            return mkSpan('j-null',  'null');
  if (value === true || value === false)         return mkSpan('j-bool',  String(value));
  if (typeof value === 'number')                 return mkSpan('j-num',   String(value));
  if (typeof value === 'string') {
    const s = document.createElement('span');
    s.className = 'j-str';
    // textContent is XSS-safe
    s.textContent = '"' + value + '"';
    return s;
  }

  const isArr = Array.isArray(value);
  const entries = isArr ? value.map((v, i) => [i, v]) : Object.entries(value);
  const count = entries.length;
  const ob = isArr ? '[' : '{';
  const cb = isArr ? ']' : '}';

  // Empty container
  if (count === 0) return mkSpan('j-punct', isArr ? '[]' : '{}');

  // Collapsible container
  const wrap = document.createElement('span');
  wrap.className = 'j-collapsible';

  const toggle = mkSpan('j-toggle', '▾');
  const open   = mkSpan('j-punct', ob);
  const preview = mkSpan('j-preview j-hidden',
    ` …${count} ${isArr ? (count === 1 ? 'item' : 'items') : (count === 1 ? 'key' : 'keys')}… `
  );
  const cbCollapsed = mkSpan('j-punct j-hidden', cb);

  const hdr = document.createElement('div');
  hdr.className = 'j-hdr';
  hdr.appendChild(toggle);
  hdr.appendChild(open);
  hdr.appendChild(preview);
  hdr.appendChild(cbCollapsed);

  const body = document.createElement('div');
  body.className = 'j-body';

  for (let i = 0; i < entries.length; i++) {
    const [k, v] = entries[i];
    const row = document.createElement('div');
    row.className = 'j-row';

    if (!isArr) {
      const key = document.createElement('span');
      key.className = 'j-key';
      key.textContent = '"' + k + '"';
      row.appendChild(key);
      row.appendChild(mkSpan('j-punct', ': '));
    }

    row.appendChild(buildJsonNode(v, depth + 1));

    if (i < entries.length - 1) row.appendChild(mkSpan('j-punct', ','));
    body.appendChild(row);
  }

  const closeRow = document.createElement('div');
  closeRow.className = 'j-row j-close-row';
  closeRow.appendChild(mkSpan('j-punct', cb));

  // Auto-collapse deep or large nodes
  const autoCollapse = depth > 1 || count > 12;
  if (autoCollapse) {
    body.style.display = 'none';
    closeRow.style.display = 'none';
    toggle.textContent = '▸';
    preview.classList.remove('j-hidden');
    cbCollapsed.classList.remove('j-hidden');
  }

  hdr.addEventListener('click', e => {
    e.stopPropagation();
    const collapsed = body.style.display === 'none';
    if (collapsed) {
      body.style.display = '';
      closeRow.style.display = '';
      toggle.textContent = '▾';
      preview.classList.add('j-hidden');
      cbCollapsed.classList.add('j-hidden');
    } else {
      body.style.display = 'none';
      closeRow.style.display = 'none';
      toggle.textContent = '▸';
      preview.classList.remove('j-hidden');
      cbCollapsed.classList.remove('j-hidden');
    }
  });

  wrap.appendChild(hdr);
  wrap.appendChild(body);
  wrap.appendChild(closeRow);
  return wrap;
}

function viewModeIconSvg(mode) {
  if (mode === 'hidden') {
    return '<svg viewBox="0 0 16 12" width="14" height="11" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1.5 6c1.8-2.8 4-4.2 6.5-4.2S12.7 3.2 14.5 6c-1.8 2.8-4 4.2-6.5 4.2S3.3 8.8 1.5 6z"/><line x1="2" y1="10.5" x2="14" y2="1.5"/></svg>';
  }
  if (mode === 'request') {
    return '<svg viewBox="0 0 16 12" width="14" height="11" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="1.5" y="1.5" width="5.5" height="9" rx="1"/><line x1="8.8" y1="6" x2="14.5" y2="6"/></svg>';
  }
  if (mode === 'split') {
    return '<svg viewBox="0 0 16 12" width="14" height="11" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="1.5" y="1.5" width="5.5" height="9" rx="1"/><rect x="9" y="1.5" width="5.5" height="9" rx="1"/></svg>';
  }
  return '<svg viewBox="0 0 16 12" width="14" height="11" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><line x1="1.5" y1="6" x2="7.2" y2="6"/><rect x="9" y="1.5" width="5.5" height="9" rx="1"/></svg>';
}

function setJsonNodeExpanded(wrap, expanded) {
  const hdr = wrap.querySelector(':scope > .j-hdr');
  const body = wrap.querySelector(':scope > .j-body');
  const closeRow = wrap.querySelector(':scope > .j-close-row');
  if (!hdr || !body || !closeRow) return;

  const toggle = hdr.querySelector('.j-toggle');
  const preview = hdr.querySelector('.j-preview');
  const cbCollapsed = hdr.lastElementChild;

  body.style.display = expanded ? '' : 'none';
  closeRow.style.display = expanded ? '' : 'none';
  if (toggle) toggle.textContent = expanded ? '\u25BE' : '\u25B8';
  if (preview) preview.classList.toggle('j-hidden', expanded);
  if (cbCollapsed) cbCollapsed.classList.toggle('j-hidden', expanded);
}

function nodeDepth(wrap) {
  let d = 0;
  let p = wrap.parentElement;
  while (p) {
    if (p.classList && p.classList.contains('j-body')) d++;
    p = p.parentElement;
  }
  return d;
}

function applyExpandLevel(root, level) {
  if (!root) return;
  const maxDepth = level === 99 ? Infinity : level - 1;
  root.querySelectorAll('.j-collapsible').forEach(wrap => {
    const expanded = nodeDepth(wrap) <= maxDepth;
    setJsonNodeExpanded(wrap, expanded);
  });
}

// Kept for compatibility with old calls.
function expandAllNodes(root) { applyExpandLevel(root, 99); }
function collapseAllNodes(root) { applyExpandLevel(root, 0); }

// ── Modals ────────────────────────────────────────────────────────

function openModal(content, wide = false) {
  const overlay = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  box.className = 'modal-box' + (wide ? ' modal-wide' : '');
  box.innerHTML = content;
  overlay.classList.remove('hidden');
  // Focus first input
  setTimeout(() => box.querySelector('input, textarea, select')?.focus(), 50);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-box').innerHTML = '';
}

// ── Collection Modal ──────────────────────────────────────────────


function openCollectionModal(colId = null) {
  const col = colId ? DATA.collections[colId] : null;
  const title = col ? 'Edit Collection' : 'New Collection';

  openModal(`
    <div class="modal-head">
      <span class="modal-title">${title}</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <label>Name</label>
        <input class="field" id="col-name" type="text" value="${esc(col?.name || '')}" placeholder="Products API">
      </div>
      <div class="form-row">
        <label>Base URL <span style="color:var(--text-3)">(shared by all entries in this collection)</span></label>
        <input class="field" id="col-baseurl" type="text"
          value="${esc(col?.baseUrl || '')}"
          placeholder="https://werkbon.voskampgroep.nl:12350"
          spellcheck="false" autocomplete="off">
      </div>
      ${col ? `
      <div class="form-row">
        <label>Short Description <span style="color:var(--text-3)">(project summary)</span></label>
        <input class="field" id="col-short-desc" type="text"
          value="${esc(col?.shortDescription || '')}"
          placeholder="Short summary for this project">
      </div>
      <div class="form-row">
        <label>Credentials <span style="color:var(--text-3)">(project-level notes or JSON)</span></label>
        <textarea class="field" id="col-credentials" rows="4" placeholder='{"Authorization":"Bearer ..."}'>${esc(typeof col?.credentials === 'string' ? col.credentials : JSON.stringify(col?.credentials || '', null, 2))}</textarea>
      </div>
      ` : ''}
    </div>
    <div class="modal-foot">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="saveCollectionModal('${colId || ''}')">
        ${col ? 'Save Changes' : 'Create Collection'}
      </button>
    </div>`);
}

function saveCollectionModal(colId) {
  const name = document.getElementById('col-name').value.trim();
  if (!name) { document.getElementById('col-name').focus(); return; }
  const baseUrl = document.getElementById('col-baseurl').value.trim();
  const shortEl = document.getElementById('col-short-desc');
  const credEl = document.getElementById('col-credentials');
  const updates = { name, baseUrl };

  if (shortEl) updates.shortDescription = shortEl.value.trim();
  if (credEl) {
    const raw = credEl.value.trim();
    if (!raw) {
      updates.credentials = '';
    } else {
      try {
        updates.credentials = JSON.parse(raw);
      } catch (e) {
        updates.credentials = raw;
      }
    }
  }

  if (colId) {
    col_update(colId, updates);
  } else {
    col_create(updates);
  }
  closeModal();
  render();
}

// ── Entry Modal ───────────────────────────────────────────────────

function openEntryModal(colId, entryId = null) {
  const entry = entryId ? DATA.collections[colId]?.entries[entryId] : null;
  const title = entry ? 'Edit Entry' : 'New Entry';
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  const methodOpts = methods.map(m =>
    `<option value="${m}"${(entry?.method || 'GET') === m ? ' selected' : ''}>${m}</option>`
  ).join('');

  openModal(`
    <div class="modal-head">
      <span class="modal-title">${title}</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <label>Name <span style="color:var(--red)">*</span></label>
        <input class="field" id="entry-name" type="text" value="${esc(entry?.name || '')}" placeholder="Get Products List">
        <span class="field-error hidden" id="entry-name-err">Name is required</span>
      </div>
      <div class="form-row-2">
        <div class="form-row">
          <label>HTTP Method</label>
          <select class="field" id="entry-method">${methodOpts}</select>
        </div>
        <div class="form-row">
          <label>Endpoint</label>
          <input class="field" id="entry-endpoint" type="text" value="${esc(entry?.endpoint || '')}" placeholder="https://api.example.com/v1/products or /api/v1/products">
        </div>
      </div>
      <div class="form-row">
        <label>Description <span style="color:var(--text-3)">(optional)</span></label>
        <input class="field" id="entry-desc" type="text" value="${esc(entry?.description || '')}" placeholder="Brief description of this endpoint">
      </div>
      <div class="form-row">
        <label>Tags <span style="color:var(--text-3)">(comma separated)</span></label>
        <input class="field" id="entry-tags" type="text" value="${(entry?.tags || []).join(', ')}" placeholder="products, pagination, golden">
      </div>
      <div class="form-row">
        <label>Response JSON <span style="color:var(--red)">*</span></label>
        <textarea class="field json-field" id="entry-res-json" placeholder='{"data": [], "total": 0}'>${entry ? JSON.stringify(entry.responseJson, null, 2) : ''}</textarea>
        <span class="field-error hidden" id="entry-res-err"></span>
      </div>
      <div class="form-row">
        <label>Request JSON <span style="color:var(--text-3)">(optional - what was sent)</span></label>
        <textarea class="field json-field" id="entry-req-json" placeholder='{"filter": "active"}'>${entry?.requestJson ? JSON.stringify(entry.requestJson, null, 2) : ''}</textarea>
        <span class="field-error hidden" id="entry-req-err"></span>
      </div>
      <div class="form-row">
        <label>Headers JSON <span style="color:var(--text-3)">(optional - request headers / auth)</span></label>
        <textarea class="field json-field" id="entry-headers-json" placeholder='{"Authorization": "Bearer <token>", "x-api-key": "..."}'>${entry?.headers ? JSON.stringify(entry.headers, null, 2) : ''}</textarea>
        <span class="field-error hidden" id="entry-head-err"></span>
      </div>
      <div class="form-row">
        <label>Notes <span style="color:var(--text-3)">(optional)</span></label>
        <textarea class="field" id="entry-notes" rows="3" placeholder="Any relevant notes about this endpoint...">${esc(entry?.notes || '')}</textarea>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="saveEntryModal('${colId}', '${entryId || ''}')">
        ${entry ? 'Save Changes' : 'Save Entry'}
      </button>
    </div>`);
}

function saveEntryModal(colId, entryId) {
  const name       = document.getElementById('entry-name').value.trim();
  const method     = document.getElementById('entry-method').value;
  const endpoint   = document.getElementById('entry-endpoint').value.trim();
  const description = document.getElementById('entry-desc').value.trim();
  const tagsRaw    = document.getElementById('entry-tags').value.trim();
  const resRaw     = document.getElementById('entry-res-json').value.trim();
  const reqRaw     = document.getElementById('entry-req-json').value.trim();
  const headRaw    = document.getElementById('entry-headers-json').value.trim();
  const notes      = document.getElementById('entry-notes').value.trim();

  let valid = true;

  if (!name) {
    document.getElementById('entry-name-err').classList.remove('hidden');
    valid = false;
  } else {
    document.getElementById('entry-name-err').classList.add('hidden');
  }

  let responseJson;
  try {
    responseJson = JSON.parse(resRaw || '{}');
    document.getElementById('entry-res-err').classList.add('hidden');
  } catch (e) {
    document.getElementById('entry-res-err').textContent = 'Invalid JSON: ' + e.message;
    document.getElementById('entry-res-err').classList.remove('hidden');
    valid = false;
  }

  let requestJson = null;
  if (reqRaw) {
    try {
      requestJson = JSON.parse(reqRaw);
      document.getElementById('entry-req-err').classList.add('hidden');
    } catch (e) {
      document.getElementById('entry-req-err').textContent = 'Invalid JSON: ' + e.message;
      document.getElementById('entry-req-err').classList.remove('hidden');
      valid = false;
    }
  }

  let headers = null;
  if (headRaw) {
    try {
      headers = JSON.parse(headRaw);
      if (headers === null || typeof headers !== 'object' || Array.isArray(headers)) {
        throw new Error('Headers JSON must be an object');
      }
      document.getElementById('entry-head-err').classList.add('hidden');
    } catch (e) {
      document.getElementById('entry-head-err').textContent = 'Invalid JSON: ' + e.message;
      document.getElementById('entry-head-err').classList.remove('hidden');
      valid = false;
    }
  } else {
    document.getElementById('entry-head-err').classList.add('hidden');
  }

  if (!valid) return;

  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  const payload = { name, method, endpoint, description, tags, responseJson, requestJson, headers, notes };

  if (entryId) {
    entry_update(colId, entryId, payload);
    currentTab = 'response';
  } else {
    entry_create(colId, payload);
    currentTab = 'response';
  }
  _projectMode = false;

  closeModal();
  render();
}

// ── Compare Modal ─────────────────────────────────────────────────

function openCompareModal(colId, entryId) {
  const entry = DATA.collections[colId]?.entries[entryId];
  if (!entry) return;
  const goldenStr = JSON.stringify(entry.responseJson, null, 2);

  openModal(`
    <div class="modal-head">
      <span class="modal-title">Compare: ${esc(entry.name)}</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="compare-layout">
        <div class="compare-panel">
          <div class="compare-panel-label">Golden (stored)</div>
          <div class="compare-json-box"><pre style="margin:0;font-size:11.5px;color:var(--text-2)">${esc(goldenStr)}</pre></div>
        </div>
        <div class="compare-panel">
          <div class="compare-panel-label">Actual (paste here)</div>
          <textarea class="field json-field" id="cmp-actual" placeholder='Paste the actual API response JSON here…' rows="10"></textarea>
          <span class="field-error hidden" id="cmp-err"></span>
          <button class="btn-primary" style="align-self:flex-start;margin-top:4px" onclick="runCompare('${colId}','${entryId}')">
            Compare ▶
          </button>
        </div>
      </div>
      <div class="compare-results" id="cmp-results" style="display:none"></div>
    </div>`, true);
}

function runCompare(colId, entryId) {
  const entry = DATA.collections[colId]?.entries[entryId];
  const raw = document.getElementById('cmp-actual')?.value.trim();

  if (!raw) { showToast('Paste actual JSON first', 'error'); return; }

  let actual;
  try {
    actual = JSON.parse(raw);
    document.getElementById('cmp-err').classList.add('hidden');
  } catch (e) {
    document.getElementById('cmp-err').textContent = 'Invalid JSON: ' + e.message;
    document.getElementById('cmp-err').classList.remove('hidden');
    return;
  }

  const diffs = json_diff(entry.responseJson, actual);
  const resultsEl = document.getElementById('cmp-results');
  resultsEl.style.display = '';

  if (diffs.length === 0) {
    resultsEl.innerHTML = `
      <div class="compare-summary">
        <span class="diff-badge ok">✓ Identical — no differences found</span>
      </div>`;
    return;
  }

  const changed = diffs.filter(d => d.type === 'changed');
  const missing = diffs.filter(d => d.type === 'missing');
  const added   = diffs.filter(d => d.type === 'added');

  const itemsHtml = diffs.map(d => {
    if (d.type === 'changed') {
      return `<div class="diff-item changed">
        <span class="diff-path">${esc(d.path)}</span>
        <span class="diff-label">changed</span>
        <div class="diff-vals">
          <span class="diff-from">${esc(JSON.stringify(d.golden))}</span>
          <span class="j-punct"> → </span>
          <span class="diff-to">${esc(JSON.stringify(d.actual))}</span>
        </div>
      </div>`;
    }
    if (d.type === 'missing') {
      return `<div class="diff-item missing">
        <span class="diff-path">${esc(d.path)}</span>
        <span class="diff-label">missing in actual</span>
        <div class="diff-vals"><span class="diff-from">was: ${esc(JSON.stringify(d.golden))}</span></div>
      </div>`;
    }
    if (d.type === 'added') {
      return `<div class="diff-item added">
        <span class="diff-path">${esc(d.path)}</span>
        <span class="diff-label">unexpected in actual</span>
        <div class="diff-vals"><span class="diff-to">got: ${esc(JSON.stringify(d.actual))}</span></div>
      </div>`;
    }
    return '';
  }).join('');

  resultsEl.innerHTML = `
    <div class="compare-summary">
      <strong style="color:var(--text)">${diffs.length} difference${diffs.length !== 1 ? 's' : ''}</strong>
      ${changed.length ? `<span class="diff-badge changed">${changed.length} changed</span>` : ''}
      ${missing.length ? `<span class="diff-badge removed">${missing.length} missing</span>` : ''}
      ${added.length   ? `<span class="diff-badge added">${added.length} unexpected</span>`   : ''}
    </div>
    <div class="diff-list">${itemsHtml}</div>`;
}

// ── Confirm Delete ────────────────────────────────────────────────

function openConfirmDelete(message, onConfirm) {
  openModal(`
    <div class="modal-head">
      <span class="modal-title">Confirm Delete</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p style="color:var(--text-2);font-size:13px;line-height:1.6">${esc(message)}</p>
    </div>
    <div class="modal-foot">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" style="background:var(--red);border-color:var(--red)" id="confirm-delete-btn">Delete</button>
    </div>`);
  document.getElementById('confirm-delete-btn').addEventListener('click', () => {
    closeModal();
    onConfirm();
  });
}

// ── Context Menu ──────────────────────────────────────────────────

function openColMenu(colId, event) {
  const menu = document.getElementById('ctx-menu');
  const col = DATA.collections[colId];
  menu.innerHTML = `
    <button class="ctx-item" onclick="openEntryModal('${colId}'); closeCtxMenu()">+ Add Entry</button>
    <button class="ctx-item" onclick="openCollectionModal('${colId}'); closeCtxMenu()">Edit Collection</button>
    <button class="ctx-item" onclick="exportCol('${colId}'); closeCtxMenu()">Export Collection</button>
    <div class="ctx-sep"></div>
    <button class="ctx-item danger" onclick="confirmDeleteCol('${colId}'); closeCtxMenu()">Delete Collection</button>`;
  menu.classList.remove('hidden');
  const x = Math.min(event.clientX, window.innerWidth - 170);
  const y = Math.min(event.clientY, window.innerHeight - 180);
  menu.style.left = x + 'px';
  menu.style.top  = y + 'px';
}

function closeCtxMenu() {
  document.getElementById('ctx-menu').classList.add('hidden');
}

// ── Entry context menu (··· button) ──────────────────────────────

function openEntryMenu(colId, entryId, event) {
  const menu = document.getElementById('ctx-menu');
  menu.innerHTML = `
    <button class="ctx-item" onclick="openEntryModal('${colId}','${entryId}'); closeCtxMenu()">Edit</button>
    <button class="ctx-item" onclick="renameEntry('${colId}','${entryId}'); closeCtxMenu()">Rename</button>
    <button class="ctx-item" onclick="duplicateEntry('${colId}','${entryId}'); closeCtxMenu()">Duplicate</button>
    <div class="ctx-sep"></div>
    <button class="ctx-item danger" onclick="confirmDeleteEntry('${colId}','${entryId}'); closeCtxMenu()">Delete</button>`;
  menu.classList.remove('hidden');
  const x = Math.min(event.clientX, window.innerWidth  - 190);
  const y = Math.min(event.clientY, window.innerHeight - 140);
  menu.style.left = x + 'px';
  menu.style.top  = y + 'px';
}

function renameEntry(colId, entryId) {
  const entry = DATA.collections[colId].entries[entryId];
  openModal(`
    <div class="modal-head">
      <span class="modal-title">Rename Entry</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <label>Name</label>
        <input class="field" id="rename-input" type="text" value="${esc(entry.name)}" placeholder="Entry name"
          onkeydown="if(event.key==='Enter') saveRename('${colId}','${entryId}')">
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="saveRename('${colId}','${entryId}')">Rename</button>
    </div>`);
  setTimeout(() => {
    const inp = document.getElementById('rename-input');
    if (inp) { inp.focus(); inp.select(); }
  }, 40);
}

function saveRename(colId, entryId) {
  const name = document.getElementById('rename-input').value.trim();
  if (!name) return;
  entry_update(colId, entryId, { name });
  closeModal();
  render();
  showToast('Entry renamed', 'success');
}

function duplicateEntry(colId, entryId) {
  const src = DATA.collections[colId].entries[entryId];
  entry_create(colId, {
    name:         'Copy of ' + src.name,
    description:  src.description  || '',
    endpoint:     src.endpoint     || '',
    method:       src.method       || 'GET',
    tags:         [...(src.tags    || [])],
    requestJson:  src.requestJson  ? JSON.parse(JSON.stringify(src.requestJson))  : null,
    responseJson: src.responseJson ? JSON.parse(JSON.stringify(src.responseJson)) : {},
    headers:      src.headers      ? JSON.parse(JSON.stringify(src.headers))      : null,
    notes:        src.notes        || ''
  });
  render();
  showToast('Entry duplicated', 'success');
}

function confirmDeleteEntry(colId, entryId) {
  const entry = DATA.collections[colId].entries[entryId];
  openConfirmDelete(
    `Delete "${entry.name}"? This cannot be undone.`,
    () => { entry_delete(colId, entryId); render(); showToast('Entry deleted'); }
  );
}

function confirmDeleteCol(colId) {
  const col = DATA.collections[colId];
  openConfirmDelete(
    `Delete collection "${col.name}" and all its entries? This cannot be undone.`,
    () => { col_delete(colId); render(); showToast('Collection deleted'); }
  );
}

function exportCol(colId) {
  const json = export_collection(colId);
  const col = DATA.collections[colId];
  downloadFile(`${slugify(col.name)}.json`, json);
  showToast('Collection exported!', 'success');
}

// ── Toast ─────────────────────────────────────────────────────────

let _toastTimer = null;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (type ? ' ' + type : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), 2500);
}

// ── Utilities ─────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mkSpan(cls, text) {
  const s = document.createElement('span');
  s.className = cls;
  if (text !== undefined) s.textContent = text;
  return s;
}

function methodColor(method) {
  const map = {
    GET: 'var(--m-get)', POST: 'var(--m-post)', PUT: 'var(--m-put)',
    PATCH: 'var(--m-patch)', DELETE: 'var(--m-delete)',
    HEAD: 'var(--m-head)', OPTIONS: 'var(--m-options)'
  };
  return map[method] || 'var(--text-2)';
}

function timeAgo(ts) {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  return d + 'd ago';
}

function copyToClipboard(str) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(str).catch(() => fallbackCopy(str));
  } else {
    fallbackCopy(str);
  }
}

function fallbackCopy(str) {
  const ta = document.createElement('textarea');
  ta.value = str;
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

function downloadFile(filename, content) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'collection';
}








