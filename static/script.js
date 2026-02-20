document.addEventListener('DOMContentLoaded', () => {

  /* ── Element references ─────────────────────────────────── */
  const autoCheckbox  = document.getElementById('autoWeights');
  const clearBtn      = document.getElementById('clearAll');
  const genBtn        = document.getElementById('generateBtn');
  const randBtn       = document.getElementById('randHotbar');
  const randSubsetBtn = document.getElementById('randSubset');
  const previewImg    = document.getElementById('previewImg');
  const previewBox    = document.getElementById('previewContainer');
  const legendList    = document.getElementById('legendList');

  const getSlots = () => Array.from(document.querySelectorAll('.slot-row'));

  /* ── Color map: data-color → rgb string ─────────────────── */
  const colorMap = {};
  document.querySelectorAll('.add-color').forEach(b => {
    const sw = b.querySelector('.swatch');
    const bg = sw && (sw.style.background || getComputedStyle(sw).backgroundColor);
    colorMap[b.dataset.color] = bg;
  });

  /* ── Utility: parse "rgb(r, g, b)" → [r, g, b] ─────────── */
  const parseRgb = (rgbStr) => {
    if (!rgbStr) return null;
    const m = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    return m ? [+m[1], +m[2], +m[3]] : null;
  };

  /* ── Utility: black or white contrast text ──────────────── */
  const contrastColor = ([r, g, b]) => {
    const lum = (r * 299 + g * 587 + b * 114) / 1000;
    return lum < 140 ? '#ffffff' : '#000000';
  };

  /* ── recalc(): auto-weight + slot colouring ─────────────── */
  const recalc = () => {
    const auto  = autoCheckbox.checked;
    const slots = getSlots();

    // count duplicate selections for auto-weight
    const counts = {};
    slots.forEach(row => {
      const v = row.querySelector('.slot-select').value;
      if (v) counts[v] = (counts[v] || 0) + 1;
    });

    slots.forEach(row => {
      const sel   = row.querySelector('.slot-select');
      const input = row.querySelector('.weight');
      const v     = sel.value;
      const rgb   = parseRgb(colorMap[v]);

      if (rgb) {
        const bg  = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        const txt = contrastColor(rgb);
        sel.style.background   = bg;
        sel.style.color        = txt;
        input.style.background = bg;
        input.style.color      = txt;
      } else {
        sel.style.background = input.style.background = '';
        sel.style.color      = input.style.color      = '';
      }

      if (auto) {
        // When auto-weighting we want each selected slot to contribute
        // one unit of weight so that the aggregated legend total equals
        // the number of slots using that color (e.g. 2 slots -> total 2).
        input.value    = v ? 1 : 0;
        input.readOnly = true;
      } else {
        input.readOnly = false;
      }
    });
  };

  /* ── AJAX generation ────────────────────────────────────── */
  const generatePreview = async () => {
    // Gather filled slots
    const choices = [];
    getSlots().forEach(row => {
      const name   = row.querySelector('.slot-select').value;
      const weight = parseInt(row.querySelector('.weight').value, 10) || 0;
      if (name && weight > 0) choices.push([name, weight]);
    });

    // Read dimension inputs
    const width    = parseInt(document.querySelector('[name="width"]').value, 10)    || 16;
    const height   = parseInt(document.querySelector('[name="height"]').value, 10)   || 16;
    const block_px = parseInt(document.querySelector('[name="block_px"]').value, 10) || 16;

    // Show loading state
    genBtn.classList.add('loading');
    previewBox.classList.add('loading');

    try {
      const res = await fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choices, width, height, block_px })
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();

      // Update preview image
      previewImg.src = `data:image/png;base64,${data.img_b64}`;

      // Rebuild legend
      renderLegend(data.legend);

      // Add to History
      // Save the state that produced this result.
      addToHistory(data.img_b64, data.legend || [], choices);
    } catch (err) {
      console.error('Generate failed:', err);
    } finally {
      genBtn.classList.remove('loading');
      previewBox.classList.remove('loading');
    }
  };

  /* ── Add color click ────────────────────────────────────── */
  document.querySelectorAll('.add-color').forEach(b => {
    // Toggle lock on Shift+Click only (avoid hijacking right-click)
    const toggleLock = (e) => {
      if (e.type === 'click' && e.shiftKey) {
        e.preventDefault();
        b.classList.toggle('locked');
        saveState();
        return true;
      }
      return false;
    };

    b.addEventListener('click', (e) => {
      if (toggleLock(e)) return;
      if (b.classList.contains('locked')) return;

      const empty = getSlots().find(s => s.querySelector('.slot-select').value === '');
      if (empty) {
        empty.querySelector('.slot-select').value = b.dataset.color;
        recalc();
      } else {
        alert('All slots are full (max 9). Remove one first.');
      }
    });
  });

  /* ── Remove click ───────────────────────────────────────── */
  document.querySelectorAll('.remove').forEach(b => {
    b.addEventListener('click', () => {
      const row = b.closest('.slot-row');
      row.querySelector('.slot-select').value = '';
      row.querySelector('.weight').value = 0;
      recalc();
    });
  });

  /* ── Clear all ──────────────────────────────────────────── */
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      getSlots().forEach(row => {
        const sel = row.querySelector('.slot-select');
        const w   = row.querySelector('.weight');
        sel.value = '';
        w.value   = 0;
        sel.style.background = sel.style.color = '';
        w.style.background   = w.style.color   = '';
      });
      recalc();
    });
  }


  const historyStack = [];
  const pinnedStack = [];
  const MAX_HISTORY = 20;
  const MAX_PINNED = 20;
  const historyGallery = document.querySelector('.history-gallery');
  const historyEmpty = document.getElementById('historyEmpty');
  const pinnedEmpty = document.getElementById('pinnedEmpty');
  const tabHistoryBtn = document.getElementById('tabHistory');
  const tabPinnedBtn = document.getElementById('tabPinned');
  let activeTab = 'history';
  let currentActiveId = null;

  // --- Persistence -------------------------------------------
  const STORAGE_KEYS = {
    HISTORY: 'mc_bitmap_history',
    PINNED: 'mc_bitmap_pinned',
    FORM: 'mc_bitmap_form',
    CURRENT: 'mc_bitmap_current'
  };

  const saveState = () => {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(historyStack));
      localStorage.setItem(STORAGE_KEYS.PINNED, JSON.stringify(pinnedStack));
      localStorage.setItem(STORAGE_KEYS.CURRENT, currentActiveId ? String(currentActiveId) : '');

      const formState = {
        slots: getSlots().map(row => ({
          color: row.querySelector('.slot-select').value,
          weight: row.querySelector('.weight').value
        })),
        autoWeights: autoCheckbox.checked,
        width: document.querySelector('[name="width"]').value,
        height: document.querySelector('[name="height"]').value,
        block_px: document.querySelector('[name="block_px"]').value,
        subset: Array.from(document.querySelectorAll('.subset-color.selected')).map(b => b.dataset.color),
        lockedSubset: Array.from(document.querySelectorAll('.subset-color.locked')).map(b => b.dataset.color),
        lockedAdd: Array.from(document.querySelectorAll('.add-color.locked')).map(b => b.dataset.color)
      };
      localStorage.setItem(STORAGE_KEYS.FORM, JSON.stringify(formState));
    } catch (e) {
      console.warn('Failed to save state to localStorage:', e);
    }
  };

  const loadState = () => {
    try {
      // Load History
      const savedHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY));
      if (Array.isArray(savedHistory)) {
        historyStack.length = 0; // Clear
        savedHistory.slice(0, MAX_HISTORY).forEach(item => historyStack.push(item));
      }

      // Load Pinned
      const savedPinned = JSON.parse(localStorage.getItem(STORAGE_KEYS.PINNED));
      if (Array.isArray(savedPinned)) {
        pinnedStack.length = 0; // Clear
        savedPinned.forEach(item => pinnedStack.push(item));
      }

      // Load Form
      const savedForm = JSON.parse(localStorage.getItem(STORAGE_KEYS.FORM));
      if (savedForm) {
        // Slots
        const slots = getSlots();
        if (Array.isArray(savedForm.slots)) {
          savedForm.slots.forEach((s, i) => {
            if (i < slots.length) {
              slots[i].querySelector('.slot-select').value = s.color || '';
              slots[i].querySelector('.weight').value = s.weight || 0;
            }
          });
        }

        // Settings
        if (savedForm.autoWeights !== undefined) autoCheckbox.checked = savedForm.autoWeights;
        if (savedForm.width) document.querySelector('[name="width"]').value = savedForm.width;
        if (savedForm.height) document.querySelector('[name="height"]').value = savedForm.height;
        if (savedForm.block_px) document.querySelector('[name="block_px"]').value = savedForm.block_px;

        // Subset
        if (Array.isArray(savedForm.subset)) {
          document.querySelectorAll('.subset-color').forEach(b => {
             if (savedForm.subset.includes(b.dataset.color)) b.classList.add('selected');
             else b.classList.remove('selected');
             
             if (Array.isArray(savedForm.lockedSubset) && savedForm.lockedSubset.includes(b.dataset.color)) {
                b.classList.add('locked');
             } else {
                b.classList.remove('locked');
             }
          });
        }

        if (Array.isArray(savedForm.lockedAdd)) {
           document.querySelectorAll('.add-color').forEach(b => {
              if (savedForm.lockedAdd.includes(b.dataset.color)) {
                 b.classList.add('locked');
              } else {
                 b.classList.remove('locked');
              }
           });
        }
      }
      
      renderGallery(activeTab === 'history' ? historyStack : pinnedStack);
      // If we have a saved "current" id, restore that pattern; otherwise
      // prefer the most recent history item if present. This ensures the
      // preview, legend, and hotbar match the selected pattern after reload.
      const savedCurrent = localStorage.getItem(STORAGE_KEYS.CURRENT);
      if (savedCurrent) {
        const id = String(savedCurrent);
        let found = historyStack.find(h => String(h.id) === id) || pinnedStack.find(p => String(p.id) === id);
        if (found) {
          currentActiveId = found.id;
          // mark active in gallery (renderGallery already created items)
          const el = historyGallery?.querySelector(`.history-item[data-id="${found.id}"]`);
          if (el) el.classList.add('active');
          restoreState(found);
          recalc();
          return;
        }
      }

      // No saved current: if we have a recent history entry, restore that
      if (historyStack.length > 0) {
        currentActiveId = historyStack[0].id;
        const first = historyGallery.firstElementChild;
        if (first) first.classList.add('active');
        restoreState(historyStack[0]);
      }
      recalc();
    } catch (e) {
      console.warn('Failed to load state from localStorage:', e);
    }
  };

  // Helper to render HTML legend
  const renderLegend = (legendData) => {
      legendList.innerHTML = '';
      (legendData || []).forEach(({ name, weight, rgb }) => {
        const li = document.createElement('li');
        li.title = `Total Weight: ${weight}`;
        if (rgb) {
          const swatch = document.createElement('span');
          swatch.className = 'swatch';
          swatch.style.background = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
          li.appendChild(swatch);
        }
        li.appendChild(document.createTextNode(` ${name} `));
        const span = document.createElement('span');
        span.className = 'legend-weight';
        span.textContent = `(${weight})`;
        li.appendChild(span);
        legendList.appendChild(li);
      });
  };

    const renderGallery = (list) => {
      if (!historyGallery) return;
      historyGallery.innerHTML = '';

      const isHistory = (activeTab === 'history');
      if (isHistory) {
      if (historyStack.length === 0) { if (historyEmpty) historyEmpty.style.display = 'block'; }
      else if (historyEmpty) historyEmpty.style.display = 'none';
      if (pinnedEmpty) pinnedEmpty.style.display = 'none';
      } else {
      if (pinnedStack.length === 0) { if (pinnedEmpty) pinnedEmpty.style.display = 'block'; }
      else if (pinnedEmpty) pinnedEmpty.style.display = 'none';
      if (historyEmpty) historyEmpty.style.display = 'none';
      }

      list.forEach((state, index) => {
        const item = document.createElement('div');
        item.className = 'history-item';
        
        // Check if pinned
        const isPinned = pinnedStack.some(p => p.id === state.id);
        if (isPinned) item.classList.add('pinned');

        item.dataset.id = state.id;
        // mark active if it matches persisted active id
        if (currentActiveId && String(state.id) === String(currentActiveId)) item.classList.add('active');
        item.title = `Restored from ${state.timestamp}`;

        const img = document.createElement('img');
        img.src = `data:image/png;base64,${state.imgB64}`;
        item.appendChild(img);

        // Pin button
        const pinBtn = document.createElement('button');
        pinBtn.className = 'pin-btn';
        pinBtn.title = isPinned ? 'Unpin' : 'Pin';
        pinBtn.innerHTML = '📌'; // using innerHTML to ensure char renders
        pinBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          togglePin(state);
        });
        item.appendChild(pinBtn);

        item.addEventListener('click', () => {
          // set current active id and persist
          currentActiveId = state.id;
          saveState();
          restoreState(state);
          document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
          item.classList.add('active');
        });

        historyGallery.appendChild(item);
      });
    };

  const addToHistory = (imgB64, legend, choices) => {
      // 1. Unshift new state to front of array
      const state = {
          id: Date.now(),
          imgB64,
          legend,
          choices,       // Current slot choices: [[name, weight], ...]
          timestamp: new Date().toLocaleTimeString()
      };
      
      historyStack.unshift(state);
      if (historyStack.length > MAX_HISTORY) historyStack.pop();
      // mark this as the currently active pattern and persist
      currentActiveId = state.id;
      saveState(); // SAVE
      if (activeTab === 'history') renderGallery(historyStack);
      
      // Auto-highlight first item
        const first = historyGallery.firstElementChild;
        if (first) first.classList.add('active');
  };

  const restoreState = (state) => {
      // 1. Restore Image
      previewImg.src = `data:image/png;base64,${state.imgB64}`;
      
      // 2. Restore Legend
      renderLegend(state.legend);

      // 3. Restore Slots/Form
      const slots = getSlots();
      
      // Clear all first
      slots.forEach(row => {
          row.querySelector('.slot-select').value = '';
          row.querySelector('.weight').value = 0;
      });

      // Fill from state choices
      // state.choices: [[name, weight], ...] representing filled slots.
      // Fill slots sequentially.
      
      (state.choices || []).forEach((choice, idx) => {
          if (idx < slots.length) {
             const [name, w] = choice;
             const row = slots[idx];
             const sel = row.querySelector('.slot-select');
             const wei = row.querySelector('.weight');
             
             sel.value = name;
             wei.value = w;
          }
      });
      
      // Update UI styles
      recalc();
  };

  const togglePin = (state) => {
      const existingIdx = pinnedStack.findIndex(p => p.id === state.id);
      if (existingIdx >= 0) {
        // unpin
        pinnedStack.splice(existingIdx, 1);
      } else {
        pinnedStack.unshift(state);
        if (pinnedStack.length > MAX_PINNED) pinnedStack.pop();
      }
      saveState(); // SAVE
      renderGallery(activeTab === 'history' ? historyStack : pinnedStack);
  };

  // Tab handling
  const setActiveTab = (tab) => {
    activeTab = tab;
    if (tab === 'history') {
      tabHistoryBtn.classList.add('active'); tabPinnedBtn.classList.remove('active');
      renderGallery(historyStack);
    } else {
      tabPinnedBtn.classList.add('active'); tabHistoryBtn.classList.remove('active');
      renderGallery(pinnedStack);
    }
  };

  if (tabHistoryBtn) tabHistoryBtn.addEventListener('click', () => setActiveTab('history'));
  if (tabPinnedBtn) tabPinnedBtn.addEventListener('click', () => setActiveTab('pinned'));

  /* ── Randomize helper (shared by hotbar & subset) ───────── */
  const randomizeHotbar = (colorsArr, lockedArr = []) => {
    const slots = getSlots();
    const total = slots.length;

    // Validate:
    // If lockedArr is provided, we MUST use them.
    // Remaining slots = [2..total] - lockedArr.length. 
    // If lockedArr.length >= total, we just fill up to total.
    
    if (lockedArr.length > total) {
       alert(`You have locked ${lockedArr.length} colors but only ${total} slots available. Please unlock some.`);
       return;
    }
    
    // If we have no colors to pick from (and no locks), abort
    if ((!colorsArr || colorsArr.length === 0) && lockedArr.length === 0) return;

    // Keep 'colorsArr' as the random pool (allowing duplicates even if locked).
    const maxAttempts = 30;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Determine total N slots to fill
      // Min is at least locked.length
      // If locked.length < 2, we try to go up to at least 2 if possible.
      // Max is total.
      
      let minSlots = Math.max(2, lockedArr.length);
      if (minSlots > total) minSlots = total;
      
      const n = Math.floor(Math.random() * (total - minSlots + 1)) + minSlots; 
      
      // Start with locked items
      const picks = [...lockedArr];
      
      // Fill remainder
      while (picks.length < n) {
         if (colorsArr.length > 0) {
            picks.push(colorsArr[Math.floor(Math.random() * colorsArr.length)]);
         } else {
            // No pool colors, just stop if we have enough locked
            break;
         }
      }

      // Check variety (unless only 1 color available total)
      const allSame = picks.length > 1 && picks.every(c => c === picks[0]);
      const poolSize = new Set([...colorsArr, ...lockedArr]).size;

      if (!allSame || poolSize === 1) {
        // Apply
        slots.forEach((row, idx) => {
          const sel = row.querySelector('.slot-select');
          const w   = row.querySelector('.weight');
          sel.value = idx < picks.length ? picks[idx] : '';
          w.value   = 0;
        });
        recalc();
        generatePreview();
        return;
      }
    }
    alert('Could not generate a varied hotbar. Adjust your subset or locks.');
  };

  /* ── Randomize hotbar (all colours) ─────────────────────── */
  if (randBtn) {
    randBtn.addEventListener('click', () => randomizeHotbar(Object.keys(colorMap)));
  }

  /* ── Randomize subset (selected colours only) ───────────── */
  if (randSubsetBtn) {
    randSubsetBtn.addEventListener('click', () => {
      const chosen = Array.from(document.querySelectorAll('.subset-color.selected'))
                          .map(b => b.dataset.color);
      const locked = Array.from(document.querySelectorAll('.subset-color.locked'))
                          .map(b => b.dataset.color);

      // Verify that at least one item is available (either selected or locked).
      
      if (chosen.length === 0 && locked.length < 2) {
        alert('Please select or lock at least 2 colors/slots for randomization.');
        return;
      }
      randomizeHotbar(chosen, locked);
    });
  }

  /* ── Subset swatch toggle ───────────────────────────────── */
  const updateSubsetInput = () => {
      const selected = Array.from(document.querySelectorAll('.subset-color.selected'))
                            .map(x => x.dataset.color);
      const locked = Array.from(document.querySelectorAll('.subset-color.locked'))
                            .map(x => x.dataset.color);

      const subsetInput = document.getElementById('subsetInput');
      const lockedInput = document.getElementById('lockedInput');
      
      if (subsetInput) subsetInput.value = selected.join(',');
      if (lockedInput) lockedInput.value = locked.join(',');
      
      saveState();
      // update any warning about too many locks
      updateLockWarning();
  };

  const subsetWarning = document.getElementById('subsetWarning');
  const updateLockWarning = () => {
    try {
      const lockedCount = document.querySelectorAll('.subset-color.locked').length;
      if (!subsetWarning) return;
      if (lockedCount > 9) {
        subsetWarning.style.display = 'block';
        subsetWarning.textContent = `Too many locks — remove ${lockedCount - 9} lock(s) (max 9)`;
      } else {
        subsetWarning.style.display = 'none';
      }
    } catch (e) {
      console.warn('Failed to update lock warning', e);
    }
  };

  document.querySelectorAll('.subset-color').forEach(b => {
    // Toggle lock on Shift+Click only (avoid hijacking right-click/context menu)
    const toggleLock = (e) => {
      if (e.type === 'click' && e.shiftKey) {
        e.preventDefault();
        b.classList.toggle('locked');
        updateSubsetInput();
        return true;
      }
      return false;
    };

    b.addEventListener('click', (e) => {
      if (toggleLock(e)) return;
      // Normal Click -> toggle Selection (for pool)
      b.classList.toggle('selected');
      updateSubsetInput();
    });
  });

  /* ── Clear Subset Button ────────────────────────────────── */
  const clearSubsetBtn = document.getElementById('clearSubset');
  if (clearSubsetBtn) {
    clearSubsetBtn.addEventListener('click', () => {
      document.querySelectorAll('.subset-color').forEach(b => {
         b.classList.remove('selected');
         b.classList.remove('locked');
      });
      updateSubsetInput();
    });
  }

  /* ── Clear Locks Button (remove only lock state, keep selections) ---- */
  const clearLocksBtn = document.getElementById('clearLocks');
  if (clearLocksBtn) {
    clearLocksBtn.addEventListener('click', () => {
      document.querySelectorAll('.subset-color.locked, .add-color.locked').forEach(el => el.classList.remove('locked'));
      updateSubsetInput();
    });
  }

  /* ── Use Current Pattern as Subset ──────────────────────── */
  const useCurrentSubsetBtn = document.getElementById('useCurrentSubset');
  if (useCurrentSubsetBtn) {
    useCurrentSubsetBtn.addEventListener('click', () => {
      const slots = getSlots();
      const currentColors = new Set();
      slots.forEach(row => {
        const val = row.querySelector('.slot-select').value;
        if (val) currentColors.add(val);
      });

      if (currentColors.size === 0) {
        alert("No colors in hotbar to select.");
        return;
      }

      document.querySelectorAll('.subset-color').forEach(b => {
        if (b.classList.contains('locked')) return;
        if (currentColors.has(b.dataset.color)) {
          b.classList.add('selected');
        } else {
          b.classList.remove('selected');
        }
      });
      updateSubsetInput();
    });
  }

  /* ── Restore subset selection on page load ──────────────── */
  const subsetInput = document.getElementById('subsetInput');
  if (subsetInput && subsetInput.value) {
    const list = subsetInput.value.split(',');
    document.querySelectorAll('.subset-color').forEach(b => {
      if (list.includes(b.dataset.color)) b.classList.add('selected');
    });
    // ensure warning reflects any persisted locked state
    updateLockWarning();
  }

  /* ── Select-change & auto-weight checkbox listeners ─────── */
  document.querySelectorAll('.slot-select').forEach(s =>
    s.addEventListener('change', () => { recalc(); saveState(); })
  );
  document.querySelectorAll('.weight').forEach(w => 
    w.addEventListener('input', () => { saveState(); })
  );
  if (autoCheckbox) autoCheckbox.addEventListener('change', () => { recalc(); saveState(); });

  /* ── Generate button click ──────────────────────────────── */
  if (genBtn) genBtn.addEventListener('click', generatePreview);

  /* ── Hotkeys ────────────────────────────────────────────── */
  document.addEventListener('keydown', (e) => {
    const tag  = document.activeElement?.tagName;
    const type = document.activeElement?.type;
    // Ignore when typing in non-checkbox inputs or textareas
    if (tag === 'TEXTAREA' || (tag === 'INPUT' && type !== 'checkbox')) return;

    const key = e.key.toUpperCase();
    if (key === 'G') { e.preventDefault(); generatePreview(); }
    if (key === 'R') { e.preventDefault(); randBtn?.click(); }
    if (key === 'S') { e.preventDefault(); randSubsetBtn?.click(); }
    if (key === 'P') {
      e.preventDefault();
      // Pin/unpin currently active history item (if any) or latest history
      const active = document.querySelector('.history-item.active');
      if (active) {
        const id = active.dataset.id;
        const state = activeTab === 'history' 
          ? historyStack.find(h => String(h.id) === String(id))
          : pinnedStack.find(p => String(p.id) === String(id));
        if (state) { togglePin(state); }
      } else if (historyStack.length > 0 && activeTab === 'history') {
        togglePin(historyStack[0]);
      }
    }
  });

  /* ── Initial Load & Recalc ──────────────────────────────── */
  loadState();
  recalc();
});
