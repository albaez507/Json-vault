// ================================================================
// JSON Vault – Bootstrap & Event Wiring
// Dependencies: data.js, ui.js
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
  jv_load();
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
