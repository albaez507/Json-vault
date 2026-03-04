// ================================================================
// JSON Vault – Bootstrap & Event Wiring
// Dependencies: data.js, ui.js
// ================================================================

const SIDEBAR_WIDTH_KEY = 'jv-sidebar-width';
const SIDEBAR_DEFAULT_W = 268;
const SIDEBAR_MIN_W = 220;
const SIDEBAR_MAX_W = 640;

document.addEventListener('DOMContentLoaded', () => {
  jv_load();
  initSidebarResizer();
  render();
  wireEvents();
});

function wireEvents() {

  // ── New Collection button ────────────────────────────────────
  document.getElementById('btn-new-col').addEventListener('click', () => {
    openCollectionModal();
  });

  // ── Search ───────────────────────────────────────────────────
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');

  searchInput.addEventListener('input', () => {
    _searchQuery = searchInput.value.trim();
    searchClear.classList.toggle('hidden', !_searchQuery);
    renderSidebar();
  });

  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      _searchQuery = '';
      searchInput.value = '';
      searchClear.classList.add('hidden');
      renderSidebar();
      searchInput.blur();
    }
  });

  searchClear.addEventListener('click', () => {
    _searchQuery = '';
    searchInput.value = '';
    searchClear.classList.add('hidden');
    renderSidebar();
  });

  // ── Sidebar event delegation (col actions) ───────────────────
  document.getElementById('sidebar-body').addEventListener('click', e => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    e.stopPropagation();
    const action = actionEl.dataset.action;
    const colId  = actionEl.dataset.col;

    if (action === 'add-entry') openEntryModal(colId);
    if (action === 'col-menu')  openColMenu(colId, e);
  });

  // ── Close context menu on outside click ──────────────────────
  document.addEventListener('click', e => {
    const menu = document.getElementById('ctx-menu');
    if (!menu.contains(e.target)) closeCtxMenu();
  });

  // ── Modal: Escape closes, clicking backdrop does NOT (prevents losing progress) ──
  document.addEventListener('keydown', e => {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay.classList.contains('hidden')) {
      if (e.key === 'Escape') closeModal();
    }
  });

  // ── Export All ───────────────────────────────────────────────
  document.getElementById('btn-export-all').addEventListener('click', () => {
    if (DATA.colOrder.length === 0) { showToast('Nothing to export', 'error'); return; }
    downloadFile('json-vault-export.json', export_all());
    showToast('Exported all collections!', 'success');
  });

  // ── Import ───────────────────────────────────────────────────
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });

  document.getElementById('file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        import_data(ev.target.result);
        render();
        showToast('Imported successfully!', 'success');
      } catch (err) {
        showToast('Import failed: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset so same file can be re-imported
  });

  // ── Keyboard shortcuts ────────────────────────────────────────
  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;

    // Ctrl/Cmd + K → focus search
    if (mod && e.key === 'k') {
      e.preventDefault();
      document.getElementById('search-input').focus();
      document.getElementById('search-input').select();
    }

    // Ctrl/Cmd + N → new collection
    if (mod && e.key === 'n') {
      e.preventDefault();
      openCollectionModal();
    }

    // Ctrl/Cmd + E → new entry in current collection
    if (mod && e.key === 'e' && DATA.currentCollection) {
      e.preventDefault();
      openEntryModal(DATA.currentCollection);
    }
  });
}

function clampSidebarWidth(px) {
  const layout = document.querySelector('.app-layout');
  const layoutW = layout?.getBoundingClientRect().width || window.innerWidth || SIDEBAR_DEFAULT_W;
  const maxByViewport = Math.floor(layoutW * 0.72);
  const maxW = Math.max(SIDEBAR_MIN_W, Math.min(SIDEBAR_MAX_W, maxByViewport));
  return Math.min(Math.max(px, SIDEBAR_MIN_W), maxW);
}

function setSidebarWidth(px, persist = false) {
  const w = clampSidebarWidth(px);
  document.documentElement.style.setProperty('--sidebar-w', `${w}px`);
  if (persist) {
    try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w)); } catch (e) { /* ignore */ }
  }
}

function initSidebarResizer() {
  const resizer = document.getElementById('sidebar-resizer');
  if (!resizer) return;

  let dragging = false;

  try {
    const saved = parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) || '', 10);
    if (Number.isFinite(saved)) setSidebarWidth(saved, false);
    else setSidebarWidth(SIDEBAR_DEFAULT_W, false);
  } catch (e) {
    setSidebarWidth(SIDEBAR_DEFAULT_W, false);
  }

  const onMove = e => {
    if (!dragging) return;
    const layout = document.querySelector('.app-layout');
    if (!layout) return;
    const rect = layout.getBoundingClientRect();
    setSidebarWidth(e.clientX - rect.left, false);
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    const current = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w'), 10);
    if (Number.isFinite(current)) {
      setSidebarWidth(current, true);
    }
  };

  resizer.addEventListener('mousedown', e => {
    dragging = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);

  window.addEventListener('resize', () => {
    const current = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w'), 10);
    if (Number.isFinite(current)) setSidebarWidth(current, false);
  });
}
