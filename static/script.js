document.addEventListener('DOMContentLoaded', function(){
  const autoCheckbox = document.getElementById('autoWeights');
  const syncBtn = document.getElementById('syncWeights');
  const addButtons = document.querySelectorAll('.add-color');
  const removeButtons = document.querySelectorAll('.remove');
  const clearBtn = document.getElementById('clearAll');

  function getSlots(){
    return Array.from(document.querySelectorAll('.slot-row'));
  }

  // build color -> rgb map from palette buttons
  const colorMap = {};
  document.querySelectorAll('.add-color').forEach(b=>{
    const c = b.dataset.color;
    const sw = b.querySelector('.swatch');
    const bg = sw && (sw.style.background || getComputedStyle(sw).backgroundColor);
    colorMap[c] = bg;
  });

  function parseRgb(rgbStr){
    // accepts 'rgb(r, g, b)' or 'rgba(...)' or hex fallback
    if(!rgbStr) return null;
    const m = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if(m) return [parseInt(m[1],10),parseInt(m[2],10),parseInt(m[3],10)];
    return null;
  }

  function contrastColor([r,g,b]){
    // simple luminance
    const lum = (r*299 + g*587 + b*114)/1000;
    return lum < 140 ? '#ffffff' : '#000000';
  }

  function recalc(){
    const auto = autoCheckbox.checked;
    const slots = getSlots();
    const counts = {};
    slots.forEach(row=>{
      const sel = row.querySelector('.slot-select');
      const v = sel.value;
      if(v) counts[v] = (counts[v]||0) + 1;
    });
    slots.forEach(row=>{
      const sel = row.querySelector('.slot-select');
      const input = row.querySelector('.weight');
      // color the select and weight based on selected color
      const v = sel.value;
      const rgbStr = colorMap[v];
      const rgb = parseRgb(rgbStr);
      if(rgb){
        const textColor = contrastColor(rgb);
        sel.style.background = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        sel.style.color = textColor;
        input.style.background = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        input.style.color = textColor;
      } else {
        sel.style.background = '';
        sel.style.color = '';
        input.style.background = '';
        input.style.color = '';
      }

      if(auto){
        input.value = v ? counts[v] : 0;
        input.readOnly = true;
      } else {
        input.readOnly = false;
      }
    });
  }

  // add handlers
  addButtons.forEach(b=>{
    b.addEventListener('click', ()=>{
      const color = b.dataset.color;
      const slots = getSlots();
      const empty = slots.find(s=>s.querySelector('.slot-select').value === '');
      if(empty){
        empty.querySelector('.slot-select').value = color;
        recalc();
      } else {
        alert('All slots are full (max 9). Remove one first.');
      }
    });
  });

  removeButtons.forEach(b=>{
    b.addEventListener('click', ()=>{
      const row = b.closest('.slot-row');
      row.querySelector('.slot-select').value = '';
      row.querySelector('.weight').value = 0;
      recalc();
    });
  });

  if(clearBtn){
    clearBtn.addEventListener('click', ()=>{
      const slots = getSlots();
      slots.forEach(row=>{
        row.querySelector('.slot-select').value = '';
        row.querySelector('.weight').value = 0;
        row.querySelector('.slot-select').style.background = '';
        row.querySelector('.slot-select').style.color = '';
        row.querySelector('.weight').style.background = '';
        row.querySelector('.weight').style.color = '';
      });
      recalc();
    });
  }

  // dynamic: when a select changes, recalc and recolor
  document.querySelectorAll('.slot-select').forEach(s=>s.addEventListener('change', recalc));
  if(autoCheckbox) autoCheckbox.addEventListener('change', recalc);
  if(syncBtn) syncBtn.addEventListener('click', recalc);

  // initial calc
  recalc();

  // global key handlers: Enter -> generate; R -> randomize; S -> randomize subset
  const genBtn = document.querySelector('.generate-primary');
  const randBtn = document.getElementById('randHotbar');
  const randSubsetBtn = document.getElementById('randSubset');
  const subsetSelect = document.getElementById('subsetSelect');

  function randomizeHotbar(colorsArr){
    const slots = getSlots();
    const total = slots.length;
    if(!colorsArr || colorsArr.length === 0) return;
    const maxAttempts = 30;
    for(let attempt=0; attempt<maxAttempts; attempt++){
      const n = Math.floor(Math.random() * (total - 2 + 1)) + 2; // 2..total
      const picks = [];
      for(let i=0;i<n;i++) picks.push(colorsArr[Math.floor(Math.random()*colorsArr.length)]);
      const allSame = picks.every(c=>c === picks[0]);
      if(!allSame || colorsArr.length === 1){
        // apply picks to first n slots, clear rest
        slots.forEach((row, idx)=>{
          const sel = row.querySelector('.slot-select');
          const w = row.querySelector('.weight');
          if(idx < n){ sel.value = picks[idx]; }
          else { sel.value = ''; }
          w.value = 0;
        });
        recalc();
        // trigger generate preview so users can quickly see results
        if(genBtn) genBtn.click();
        return;
      }
    }
    alert('Could not generate a varied hotbar from the provided colors. Try a larger subset.');
  }

  if(randBtn) randBtn.addEventListener('click', ()=> randomizeHotbar(Object.keys(colorMap)));
  if(randSubsetBtn) randSubsetBtn.addEventListener('click', ()=>{
    // collect subset from swatch grid
    const chosen = Array.from(document.querySelectorAll('.subset-color.selected')).map(b=>b.dataset.color);
    if(chosen.length < 2){ alert('Please select at least 2 colors for subset randomization.'); return; }
    randomizeHotbar(chosen);
  });

  document.addEventListener('keydown', (e) => {
    // ignore when typing in inputs or textareas
    const active = document.activeElement;
    if(active && (active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && active.type !== 'checkbox')) ) return;
    if (e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      if (genBtn) genBtn.click();
    }
    if (e.key === 'r' || e.key === 'R'){
      e.preventDefault();
      if(randBtn) randBtn.click();
    }
    if (e.key === 's' || e.key === 'S'){
      e.preventDefault();
      if(randSubsetBtn) randSubsetBtn.click();
    }
  });

  // subset swatch toggles
  document.querySelectorAll('.subset-color').forEach(b=>{
    b.addEventListener('click', ()=>{
      b.classList.toggle('selected');
      // update hidden subset input so selection persists across submits
      const selected = Array.from(document.querySelectorAll('.subset-color.selected')).map(x=>x.dataset.color);
      const subsetInput = document.getElementById('subsetInput');
      if(subsetInput) subsetInput.value = selected.join(',');
    });
  });

  // ensure hidden subset input matches initial selected swatches on load
  const initialSubsetInput = document.getElementById('subsetInput');
  if(initialSubsetInput){
    const val = initialSubsetInput.value || '';
    if(val){
      const list = val.split(',');
      document.querySelectorAll('.subset-color').forEach(b=>{
        if(list.includes(b.dataset.color)) b.classList.add('selected');
      });
    }
  }
});
