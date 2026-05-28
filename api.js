/**
 * CodeGen — QR & Data Matrix Generator
 * app.js — all interaction and state logic
 */

(function () {
  'use strict';

  /* ── Element references ── */
  const tabs       = document.querySelectorAll('.tab');
  const panels     = document.querySelectorAll('.panel');

  const qrInput    = document.getElementById('qr-input');
  const dmInput    = document.getElementById('dm-input');

  const outputEl   = document.getElementById('output');
  const emptyEl    = document.getElementById('output-empty');
  const resultEl   = document.getElementById('output-result');

  const codeImg    = document.getElementById('code-img');
  const resultType = document.getElementById('result-type');
  const resultVal  = document.getElementById('result-value');

  const dlBtn      = document.getElementById('dl-btn');
  const copyBtn    = document.getElementById('copy-btn');

  const genBtns    = document.querySelectorAll('.gen-btn');

  /* ── State ── */
  let currentTab    = 'qr';
  let currentSrc    = '';
  let currentValue  = '';

  /* ─────────────────────────────────────────────
     Tab switching
  ───────────────────────────────────────────── */
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      if (target === currentTab) return;
      currentTab = target;

      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      panels.forEach(panel => {
        if (panel.id === `panel-${target}`) {
          panel.removeAttribute('hidden');
          panel.classList.add('active');
        } else {
          panel.setAttribute('hidden', '');
          panel.classList.remove('active');
        }
      });

      // reset output
      showEmpty();
    });
  });

  /* ─────────────────────────────────────────────
     Generate buttons
  ───────────────────────────────────────────── */
  genBtns.forEach(btn => {
    btn.addEventListener('click', () => generate(btn.dataset.type));
  });

  /* Enter key triggers generation */
  qrInput.addEventListener('keydown', e => { if (e.key === 'Enter') generate('qr'); });
  dmInput.addEventListener('keydown', e => { if (e.key === 'Enter') generate('dm'); });

  /* ─────────────────────────────────────────────
     Core generate function
  ───────────────────────────────────────────── */
  function generate(type) {
    const input = type === 'qr' ? qrInput : dmInput;
    const value = input.value.trim();

    if (!value) {
      shakeInput(input);
      input.focus();
      return;
    }

    currentValue = value;
    currentSrc   = '';          // will be set after render

    if (type === 'qr') {
      const encoded = encodeURIComponent(value);
      const src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=12&ecc=M&data=${encoded}`;
      currentSrc = src;
      loadCodeFromURL(src, value);
    } else {
      loadDataMatrix(value);
    }
  }

  /* ─────────────────────────────────────────────
     Load QR code from remote URL
  ───────────────────────────────────────────── */
  function loadCodeFromURL(src, value) {
    emptyEl.hidden  = true;
    resultEl.hidden = false;

    codeImg.classList.remove('loaded');
    codeImg.classList.add('loading');

    const img = new Image();
    img.onload = () => {
      codeImg.src = src;
      codeImg.alt = `QR code for: ${value}`;
      codeImg.classList.remove('loading');
      codeImg.classList.add('loaded');

      resultType.textContent = 'QR Code';
      resultVal.textContent  = truncate(value, 52);
    };
    img.onerror = () => {
      showEmpty();
      showError(qrInput);
    };
    img.src = src;
  }

  /* ─────────────────────────────────────────────
     Generate Data Matrix client-side via bwip-js
  ───────────────────────────────────────────── */
  function loadDataMatrix(value) {
    emptyEl.hidden  = true;
    resultEl.hidden = false;

    codeImg.classList.remove('loaded');
    codeImg.classList.add('loading');

    try {
      // Render into an off-screen canvas, then convert to data URL
      const canvas = document.createElement('canvas');
      bwipjs.toCanvas(canvas, {
        bcid:        'datamatrix',
        text:        value,
        scale:       4,
        padding:     6,
        backgroundcolor: 'ffffff',
      });

      const dataUrl = canvas.toDataURL('image/png');
      currentSrc = dataUrl;       // used for download

      codeImg.src = dataUrl;
      codeImg.alt = `Data Matrix code for: ${value}`;
      codeImg.classList.remove('loading');
      codeImg.classList.add('loaded');

      resultType.textContent = 'Data Matrix';
      resultVal.textContent  = truncate(value, 52);
    } catch (err) {
      console.error('bwip-js error:', err);
      showEmpty();
      showError(dmInput);
    }
  }

  /* ─────────────────────────────────────────────
     Download
  ───────────────────────────────────────────── */
  dlBtn.addEventListener('click', () => {
    if (!currentSrc) return;
    const filename = currentTab === 'qr' ? 'qrcode.png' : 'datamatrix.png';
    downloadImage(currentSrc, filename);
  });

  function downloadImage(src, filename) {
    // data URL (Data Matrix rendered client-side) — convert directly
    if (src.startsWith('data:')) {
      const a   = document.createElement('a');
      a.href     = src;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // remote URL (QR code) — fetch as blob for a real download
    fetch(src)
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch(() => {
        window.open(src, '_blank');
      });
  }

  /* ─────────────────────────────────────────────
     Copy API URL
  ───────────────────────────────────────────── */
  copyBtn.addEventListener('click', () => {
    if (!currentSrc) return;

    // For Data Matrix (data URL), copying the raw value is more useful than a giant base64 blob
    const textToCopy = currentSrc.startsWith('data:') ? currentValue : currentSrc;

    navigator.clipboard.writeText(textToCopy).then(() => {
      copyBtn.classList.add('copied');
      copyBtn.querySelector('svg').innerHTML = `
        <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2" fill="none"/>
      `;
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.querySelector('svg').innerHTML = `
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        `;
      }, 2000);
    });
  });

  /* ─────────────────────────────────────────────
     Helpers
  ───────────────────────────────────────────── */
  function showEmpty() {
    emptyEl.hidden  = false;
    resultEl.hidden = true;
    currentSrc      = '';
    currentValue    = '';
  }

  function shakeInput(input) {
    input.classList.add('error');
    input.addEventListener('animationend', () => {
      input.classList.remove('error');
    }, { once: true });
  }

  function showError(input) {
    shakeInput(input);
  }

  function truncate(str, maxLen) {
    return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
  }

})();
