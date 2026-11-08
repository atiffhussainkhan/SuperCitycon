/**
 * V4 — Pause menu and settings overlay.
 *
 * A DOM overlay with the buttons a paused game needs: resume, restart, a
 * quality selector and a back button. Callbacks are injected, so the menu
 * does not need to know how the game restarts.
 *
 * Like the HUD, the menu is import-safe in Node: without a document it
 * becomes a no-op whose `open()` / `close()` still work.
 */

/**
 * @param {object} opts
 * @param {HTMLElement} [opts.container]
 * @param {object} [opts.bus]
 * @param {Function} [opts.onResume]
 * @param {Function} [opts.onRestart]
 * @param {Function} [opts.onQualityChange]  (qualityName) => void
 * @param {Function} [opts.onBack]
 * @param {Array<string>} [opts.qualities]
 * @param {string} [opts.quality]  the initially selected quality
 * @param {Document} [opts.doc]
 */
export function createMenus({
  container = null,
  bus = null,
  onResume = null,
  onRestart = null,
  onQualityChange = null,
  onBack = null,
  qualities = ['low', 'medium', 'high'],
  quality = 'medium',
  doc = null,
} = {}) {
  const target = doc ?? (typeof document !== 'undefined' ? document : null);
  const host = container ?? null;
  let open = false;
  let selectedQuality = quality;

  if (!target || !host || typeof target.createElement !== 'function') {
    // No DOM: the menu still tracks its open state so the game logic works.
    return {
      get mounted() { return false; },
      get isOpen() { return open; },
      get quality() { return selectedQuality; },
      open() { open = true; return open; },
      close() { open = false; return open; },
      toggle() { open = !open; return open; },
      setQuality(name) {
        selectedQuality = name;
        onQualityChange?.(name);
        return name;
      },
      destroy() { open = false; },
    };
  }

  function el(tag, style, text) {
    const node = target.createElement(tag);
    if (style) node.setAttribute('style', style);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const overlay = el('div', [
    'position:absolute;inset:0;display:none;align-items:center;justify-content:center;',
    'background:rgba(5,9,18,.72);backdrop-filter:blur(3px);z-index:20;',
  ].join(''));

  const panel = el('div', [
    'min-width:260px;padding:20px 24px;border-radius:10px;',
    'background:rgba(14,22,38,.94);border:1px solid rgba(120,160,220,.3);',
    'color:#e8eefc;font:14px/1.5 ui-monospace,Menlo,Consolas,monospace;',
  ].join(''));

  const title = el('div', 'font-size:18px;margin-bottom:14px;', 'Paused');
  panel.appendChild(title);

  function button(label, onClick) {
    const b = el('button', [
      'display:block;width:100%;margin:6px 0;padding:9px 12px;border-radius:6px;',
      'border:1px solid rgba(120,160,220,.35);background:rgba(30,44,70,.85);',
      'color:#e8eefc;font:inherit;text-align:left;cursor:pointer;',
    ].join(''), label);
    b.type = 'button';
    b.addEventListener('click', (event) => {
      event.preventDefault?.();
      onClick();
    });
    panel.appendChild(b);
    return b;
  }

  button('Resume', () => {
    closeMenu();
    onResume?.();
  });

  button('Restart', () => {
    onRestart?.();
  });

  // Quality selector.
  const qualityRow = el('label', 'display:block;margin:12px 0 4px;', 'Quality');
  const select = el('select', [
    'width:100%;margin-top:4px;padding:7px 9px;border-radius:6px;',
    'background:rgba(30,44,70,.85);color:#e8eefc;border:1px solid rgba(120,160,220,.35);font:inherit;',
  ].join(''));
  for (const name of qualities) {
    const option = el('option', null, name);
    option.value = name;
    if (name === selectedQuality) option.selected = true;
    select.appendChild(option);
  }
  select.addEventListener('change', (event) => {
    const value = event.target?.value ?? selectedQuality;
    selectedQuality = value;
    onQualityChange?.(value);
    bus?.emit?.('settings:quality', { quality: value });
  });
  qualityRow.appendChild(select);
  panel.appendChild(qualityRow);

  button('Back', () => {
    onBack?.();
    closeMenu();
  });

  overlay.appendChild(panel);
  host.appendChild(overlay);

  function openMenu() {
    if (open) return false;
    open = true;
    overlay.style.display = 'flex';
    bus?.emit?.('menu:open', { menu: 'pause' });
    return true;
  }

  function closeMenu() {
    if (!open) return false;
    open = false;
    overlay.style.display = 'none';
    bus?.emit?.('menu:close', { menu: 'pause' });
    return true;
  }

  return {
    /** True when the menu is drawing. */
    get mounted() { return true; },
    /** Is the menu showing? */
    get isOpen() { return open; },
    /** The selected quality. */
    get quality() { return selectedQuality; },
    /** The overlay element. */
    get element() { return overlay; },

    open: openMenu,
    close: closeMenu,
    toggle() { return open ? (closeMenu(), false) : (openMenu(), true); },

    /** Change the quality (also updates the select). */
    setQuality(name) {
      selectedQuality = name;
      if (select) select.value = name;
      onQualityChange?.(name);
      return name;
    },

    /** Remove the menu from the page. */
    destroy() {
      overlay.remove?.();
      open = false;
    },
  };
}
