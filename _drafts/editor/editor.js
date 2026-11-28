/* Local text editor, added to pages by edit.py only. Not part of the website.
   Edit: toggle editing · ⌘S / Ctrl+S: save · Esc: stop editing */
(() => {
  const script = document.currentScript;
  let hash = script.dataset.hash;
  let editing = false;
  const blocks = [...document.querySelectorAll('[data-edit]')];
  const saved = new Map(blocks.map(el => [el, el.innerHTML]));

  const css = document.createElement('style');
  css.textContent = `
    .le-bar { position: fixed; left: 1rem; bottom: 1rem; z-index: 2147483000; display: flex; gap: .375rem; align-items: center;
      font: 500 13px/1 -apple-system, system-ui, sans-serif; color: #111; background: #fff; padding: .375rem;
      border-radius: 999px; box-shadow: 0 1px 2px rgba(0,0,0,.15), 0 4px 16px rgba(0,0,0,.12); }
    .le-bar button { font: inherit; color: inherit; background: #eee; border: 0; border-radius: 999px; padding: .5rem .875rem; cursor: pointer; }
    .le-bar button[aria-pressed="true"] { background: #2563eb; color: #fff; }
    .le-bar button.le-save { background: #111; color: #fff; }
    .le-bar button:disabled { opacity: .35; cursor: default; }
    .le-msg { padding: 0 .5rem; color: #555; white-space: nowrap; }
    .le-msg.is-error { color: #c00; white-space: normal; max-width: 22rem; line-height: 1.3; }
    html.le-on [data-edit] { outline: 1px dashed rgba(37,99,235,.45); outline-offset: 3px; cursor: text; }
    html.le-on [data-edit]:hover { outline-color: rgba(37,99,235,.9); }
    html.le-on [data-edit]:focus { outline: 2px solid #2563eb; }
    html.le-on [data-edit].le-dirty { outline-color: #f59e0b; }
    @media print { .le-bar { display: none; } }`;
  document.head.append(css);

  const bar = document.createElement('div');
  bar.className = 'le-bar';
  bar.innerHTML = '<button type="button" class="le-toggle" aria-pressed="false">Edit</button>' +
                  '<button type="button" class="le-save" hidden disabled>Save</button><span class="le-msg" hidden></span>';
  document.body.append(bar);
  const [toggle, saveBtn, msg] = bar.children;

  const plain = (() => { const d = document.createElement('div'); d.contentEditable = 'plaintext-only';
                         return d.contentEditable === 'plaintext-only'; })();

  const changed = () => blocks.filter(el => clean(el) !== saved.get(el));

  // what the browser adds while typing: a trailing <br>, and non-breaking spaces for typed spaces
  function clean(el) {
    let h = el.innerHTML.replace(/(<br>)+$/, '');
    if (!saved.get(el).includes('&nbsp;')) h = h.replace(/&nbsp;/g, ' ');
    return h;
  }

  function say(text, error = false) {
    msg.textContent = text; msg.hidden = !text; msg.classList.toggle('is-error', error);
  }

  function refresh() {
    const n = changed().length;
    blocks.forEach(el => el.classList.toggle('le-dirty', clean(el) !== saved.get(el)));
    saveBtn.disabled = !n;
    if (n) say(`${n} unsaved`);
    else if (!msg.classList.contains('is-error') && msg.textContent.endsWith('unsaved')) say('');
  }

  function setEditing(on) {
    editing = on;
    document.documentElement.classList.toggle('le-on', on);
    toggle.setAttribute('aria-pressed', on);
    toggle.textContent = on ? 'Done' : 'Edit';
    saveBtn.hidden = !on && !changed().length;
    blocks.forEach(el => {
      if (on) { el.contentEditable = plain ? 'plaintext-only' : 'true'; el.spellcheck = true; }
      else el.removeAttribute('contenteditable');
    });
  }

  async function save() {
    const list = changed();
    if (!list.length) return;
    const edits = Object.fromEntries(list.map(el => [el.dataset.edit, clean(el)]));
    saveBtn.disabled = true; say('Saving…');
    try {
      const res = await fetch('/__save', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: location.pathname, hash, edits }) });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || 'Save failed.');
      hash = out.hash;
      list.forEach(el => saved.set(el, clean(el)));
      refresh(); say('Saved');
      setTimeout(() => { if (msg.textContent === 'Saved') say(''); }, 1600);
    } catch (err) {
      say(err.message, true); saveBtn.disabled = false;
    }
  }

  toggle.addEventListener('click', () => setEditing(!editing));
  saveBtn.addEventListener('click', save);
  document.addEventListener('input', e => { if (e.target.closest?.('[data-edit]')) refresh(); });

  // while editing, links don't navigate, so you can click into linked text
  document.addEventListener('click', e => {
    if (editing && e.target.closest('a') && !e.target.closest('.le-bar')) e.preventDefault();
  }, true);

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    else if (e.key === 'Escape' && editing) { setEditing(false); document.activeElement?.blur(); }
    else if (e.key === 'Enter' && e.target.closest?.('[data-edit]')) e.preventDefault();   // one block stays one block
  });

  // paste as plain text, on one line
  document.addEventListener('paste', e => {
    if (!e.target.closest?.('[data-edit]')) return;
    e.preventDefault();
    const text = (e.clipboardData.getData('text/plain') || '').replace(/\s*\n\s*/g, ' ');
    document.execCommand('insertText', false, text);
  });

  addEventListener('beforeunload', e => { if (changed().length) e.preventDefault(); });
})();
