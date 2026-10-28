/**
 * tests/helpers/fake-dom.mjs — a minimal DOM for the integration test.
 *
 * The UX domain builds its HUD eagerly inside `createUI()`, so the Node
 * integration test needs a `document` to exist before the factory is called.
 * There is no jsdom in this project (and adding a dependency is not the
 * integrator's call), so this is a small hand-rolled stand-in.
 *
 * It is deliberately NOT a DOM implementation: it supports exactly the
 * surface the HUD touches (element creation, attributes, classes, datasets,
 * children, listeners) and nothing else. The real DOM behaviour is proven by
 * the browser harness in `tools/scenario.mjs`.
 */

/** A fake element. */
class FakeElement {
  constructor(tag, ownerDocument) {
    this.tagName = String(tag).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.childNodes = [];
    this.parentNode = null;
    this.attributes = {};
    this.style = {};
    this.dataset = {};
    this.listeners = new Map();
    this._classes = new Set();
    this._text = '';
    this._html = '';
    this.hidden = false;
    this.id = '';
    this.className = '';

    const el = this;
    this.classList = {
      add(...names) { for (const n of names) el._classes.add(n); el.className = [...el._classes].join(' '); },
      remove(...names) { for (const n of names) el._classes.delete(n); el.className = [...el._classes].join(' '); },
      contains(name) { return el._classes.has(name); },
      toggle(name, force) {
        const want = force === undefined ? !el._classes.has(name) : !!force;
        if (want) el._classes.add(name); else el._classes.delete(name);
        el.className = [...el._classes].join(' ');
        return want;
      },
    };
  }

  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
  removeAttribute(name) { delete this.attributes[name]; }
  hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name); }

  append(...nodes) { for (const n of nodes) this.appendChild(n); }
  appendChild(node) {
    this.children.push(node);
    this.childNodes.push(node);
    if (node && typeof node === 'object') node.parentNode = this;
    return node;
  }
  prepend(...nodes) { this.children.unshift(...nodes); this.childNodes.unshift(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; this.childNodes = [...nodes]; }
  remove() { this.parentNode?.children?.splice(this.parentNode.children.indexOf(this), 1); }
  contains(node) { return this.children.includes(node); }
  closest() { return null; }
  matches() { return false; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }; }
  focus() {}
  blur() {}
  click() {}
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  removeEventListener(type, fn) {
    const list = this.listeners.get(type);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }
  dispatch(type, event = {}) {
    for (const fn of this.listeners.get(type) ?? []) fn({ type, target: this, ...event });
  }

  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); this.children = []; this.childNodes = []; }
  get innerText() { return this._text; }
}

/**
 * Install a fake `document` on `globalThis` and return a teardown function.
 * @returns {() => void} restores the previous global
 */
export function installFakeDom() {
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    fetch: globalThis.fetch,
  };

  const doc = {
    createElement: (tag) => new FakeElement(tag, doc),
    createElementNS: (_ns, tag) => new FakeElement(tag, doc),
    createTextNode: (text) => ({ nodeType: 3, textContent: String(text), parentNode: null }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementsByTagName: () => [],
    addEventListener() {},
    removeEventListener() {},
  };
  doc.head = new FakeElement('head', doc);
  doc.body = new FakeElement('body', doc);
  doc.documentElement = new FakeElement('html', doc);

  globalThis.document = doc;
  globalThis.window = globalThis.window ?? { document: doc, addEventListener() {}, removeEventListener() {} };
  globalThis.window.document = doc;

  return function restore() {
    globalThis.document = previous.document;
    globalThis.window = previous.window;
    globalThis.fetch = previous.fetch;
  };
}

export { FakeElement };
