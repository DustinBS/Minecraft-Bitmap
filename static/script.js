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
      // Capture the current form state *before* it changes (or after?)
      // Actually we want to save the state that *produced* this result.
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
    b.addEventListener('click', () => {
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
  const MAX_HISTORY = 5;
  const historyGallery = document.querySelector('.history-gallery');
  const historyEmpty = document.querySelector('.history-empty');

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

  const renderHistory = () => {
      if (!historyGallery) return;
      
      historyGallery.innerHTML = '';
      if (historyStack.length === 0) {
          if (historyEmpty) historyEmpty.style.display = 'block';
          return;
      }
      
      if (historyEmpty) historyEmpty.style.display = 'none';

      historyStack.forEach((state, index) => {
          const item = document.createElement('div');
          item.className = 'history-item';
          item.title = `Restored from ${state.timestamp}`;
          
          const img = document.createElement('img');
          img.src = `data:image/png;base64,${state.imgB64}`;
          
          item.appendChild(img);
          item.addEventListener('click', () => {
              restoreState(state);
              // Highlight active
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
      renderHistory();
      
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
      // state.choices is likely [[name, weight], ...]  representing filled slots
      // Since our input format for generation was slightly filtered, we need to map carefully.
      // But actually, we just need to fill slots sequentially for now.
      
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

  /* ── Randomize helper (shared by hotbar & subset) ───────── */
  const randomizeHotbar = (colorsArr) => {
    const slots = getSlots();
    const total = slots.length;
    if (!colorsArr || colorsArr.length === 0) return;

    const maxAttempts = 30;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const n     = Math.floor(Math.random() * (total - 1)) + 2; // 2..total
      const picks = Array.from({ length: n }, () =>
        colorsArr[Math.floor(Math.random() * colorsArr.length)]
      );
      const allSame = picks.every(c => c === picks[0]);

      if (!allSame || colorsArr.length === 1) {
        slots.forEach((row, idx) => {
          const sel = row.querySelector('.slot-select');
          const w   = row.querySelector('.weight');
          sel.value = idx < n ? picks[idx] : '';
          w.value   = 0;
        });
        recalc();
        generatePreview();
        return;
      }
    }
    alert('Could not generate a varied hotbar from the provided colors. Try a larger subset.');
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
      if (chosen.length < 2) {
        alert('Please select at least 2 colors for subset randomization.');
        return;
      }
      randomizeHotbar(chosen);
    });
  }

  /* ── Subset swatch toggle ───────────────────────────────── */
  document.querySelectorAll('.subset-color').forEach(b => {
    b.addEventListener('click', () => {
      b.classList.toggle('selected');
      const selected = Array.from(document.querySelectorAll('.subset-color.selected'))
                            .map(x => x.dataset.color);
      const subsetInput = document.getElementById('subsetInput');
      if (subsetInput) subsetInput.value = selected.join(',');
    });
  });

  /* ── Restore subset selection on page load ──────────────── */
  const subsetInput = document.getElementById('subsetInput');
  if (subsetInput && subsetInput.value) {
    const list = subsetInput.value.split(',');
    document.querySelectorAll('.subset-color').forEach(b => {
      if (list.includes(b.dataset.color)) b.classList.add('selected');
    });
  }

  /* ── Select-change & auto-weight checkbox listeners ─────── */
  document.querySelectorAll('.slot-select').forEach(s =>
    s.addEventListener('change', recalc)
  );
  if (autoCheckbox) autoCheckbox.addEventListener('change', recalc);

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
  });

  /* ── Initial recalc ─────────────────────────────────────── */
  recalc();
});
