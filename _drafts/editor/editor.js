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
    /* the site's glass (see .glass in components.css), colours swapped:
       dark glass in light mode, white glass in dark mode */
    .le-bar { position: fixed; left: var(--edge-ui, 1.625rem); bottom: var(--edge-ui, 1.625rem); z-index: 2147483000;
      display: flex; gap: .25rem; align-items: center; min-block-size: 3rem; padding: .375rem; border-radius: 1.5rem;
      font: var(--step--1, .875rem)/1 var(--font-sans, Arial, sans-serif); color: var(--color-bg);
      border: 1px solid color-mix(in srgb, var(--color-bg) var(--glass-edge, 8%), transparent);
      background: color-mix(in srgb, var(--color-text) 92%, transparent); box-shadow: var(--glass-shadow); }
    @supports ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
      .le-bar { background: color-mix(in srgb, var(--color-text) var(--glass-opacity, 54%), transparent);
        -webkit-backdrop-filter: blur(var(--glass-blur, 8px)) saturate(var(--glass-saturate, 1.6));
                backdrop-filter: blur(var(--glass-blur, 8px)) saturate(var(--glass-saturate, 1.6)); } }
    .le-bar button { font: inherit; color: inherit; background: transparent; border: 0; border-radius: 1.125rem;
      block-size: 2.25rem; padding: 0 1rem; cursor: pointer; transition: background-color 160ms, color 160ms, opacity 160ms; }
    .le-bar button:hover:not(:disabled) { background: color-mix(in srgb, var(--color-bg) 14%, transparent); }
    .le-bar button[aria-pressed="true"] { background: color-mix(in srgb, var(--color-bg) 18%, transparent); }
    .le-bar button.le-save:not(:disabled) { background: var(--color-bg); color: var(--color-text); }
    .le-bar button:disabled { opacity: .4; cursor: default; }
    .le-msg { padding: 0 .625rem 0 .25rem; opacity: .75; white-space: nowrap; }
    .le-msg.is-error { opacity: 1; color: #ff6b6b; white-space: normal; max-width: 22rem; line-height: 1.3; }
    :root[data-theme="dark"] .le-msg.is-error { color: #c00; }
    @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .le-msg.is-error { color: #c00; } }
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
