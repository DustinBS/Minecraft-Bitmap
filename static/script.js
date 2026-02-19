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
});
