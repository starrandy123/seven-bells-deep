/* mosa-port.js — the NotesMosaic port kit, v1 (public domain / MIT-0: copy it, change it, ship it inside your build).
 *
 * Bring a web game that already exists to NotesMosaic with its own code left as it is. One call wires what a game written for a desktop
 * page lacks here, each part optional and each working with the game's OWN handlers:
 *
 *   MosaPort.init({
 *     id: "radius-raid",                         // a name for this game's rows in the sandbox database
 *     stage: "#wrap", size: [820, 620],          // FIT: this element, at this natural size, scaled to any screen upright and turned
 *                                                //      (pointer coordinates are mapped back, so the game's own mouse/touch maths holds)
 *     touch: { left: {...}, look: {...}, buttons: [...] },    // TOUCH: a stick and buttons that press the game's own KEYS; LOOK: a drag on the open screen
 *     loading: { el: "#my-loading" },            // LOADING: the game's OWN loading screen (its markup in the page), fed the real progress;
 *                                                //          `ready: function () { return game.started; }` says when it comes down
 *     saves: true,                               // SAVES: what the game keeps in localStorage follows the player (a key of their own in the game's database)
 *     score: function () { return game.score; }, // ROOM: friends in the same room see each other's live score and the room's best
 *     credits: { title, author, source, license, changes }   // CREDITS: an (i) button with who made it and under which licence
 *   });
 *
 * Outside NotesMosaic (your own dev server) the bridge is absent: fit, touch and credits work the same, saves stay in the browser, the room
 * is a room of one. Nothing here is required by the platform — it checks only the output (PUBLISHING.md). */
(function () {
  'use strict';
  var W = window, D = document;
  if (W.MosaPort) return;
  var VERSION = '1.2.1';
  var cfg = {}, app = null, started = false;
  var isTouch = function () {
    var d = W.__MOSA_DEVICE;
    if (d) return !!(d.mobile || d.touch);
    try { return (W.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in W || (navigator.maxTouchPoints || 0) > 0; } catch (e) { return false; }
  };
  var el = function (tag, css, text) { var n = D.createElement(tag); if (css) n.style.cssText = css; if (text != null) n.textContent = text; return n; };
  var $ = function (q) { return typeof q === 'string' ? D.querySelector(q) : q; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ------------------------------------------------------------------ FIT ------------------------------------------------------------------
   * The stage keeps its natural size and is SCALED to the screen (a transform), so a game drawn for 800×600 is whole on a phone upright and
   * turned. A game computes where the pointer is from the event's own coordinates; under a scale those are off by the factor — so, before
   * the game's listeners see an event, its coordinates are mapped back into the stage's own space. */
  var fit = { node: null, w: 0, h: 0, s: 1, left: 0, top: 0, pad: { top: 0, right: 0, bottom: 0, left: 0 } };
  function layout() {
    if (!fit.node) return;
    var vw = W.innerWidth || 1, vh = W.innerHeight || 1;
    var p = fit.pad;
    var s = Math.min((vw - p.left - p.right) / fit.w, (vh - p.top - p.bottom) / fit.h);
    if (!(s > 0)) s = 1;
    if (cfg.maxScale && s > cfg.maxScale) s = cfg.maxScale;
    fit.s = s;
    fit.left = Math.round(p.left + (vw - p.left - p.right - fit.w * s) / 2);
    fit.top = Math.round(p.top + (vh - p.top - p.bottom - fit.h * s) / 2);
    var st = fit.node.style;
    st.position = 'fixed'; st.margin = '0'; st.left = fit.left + 'px'; st.top = fit.top + 'px'; st.right = 'auto'; st.bottom = 'auto';
    st.width = fit.w + 'px'; st.height = fit.h + 'px'; st.boxSizing = 'border-box';
    st.transformOrigin = '0 0'; st.transform = 'scale(' + s + ')';
    D.documentElement.style.overflow = 'hidden'; if (D.body) { D.body.style.overflow = 'hidden'; D.body.style.margin = '0'; }
  }
  var toStage = function (x, y) { return [fit.left + (x - fit.left) / fit.s, fit.top + (y - fit.top) / fit.s]; };
  var MAPPED = ['mousedown', 'mouseup', 'mousemove', 'click', 'dblclick', 'contextmenu', 'wheel', 'pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'touchcancel'];
  function remapPoint(o) {
    if (!o || o.__mosaRaw) return;
    var x = o.clientX, y = o.clientY; if (typeof x !== 'number') return;
    var m = toStage(x, y), sx = W.scrollX || 0, sy = W.scrollY || 0;
    try {
      Object.defineProperty(o, '__mosaRaw', { value: { x: x, y: y } });
      Object.defineProperty(o, 'clientX', { value: m[0] }); Object.defineProperty(o, 'clientY', { value: m[1] });
      Object.defineProperty(o, 'pageX', { value: m[0] + sx }); Object.defineProperty(o, 'pageY', { value: m[1] + sy });
      Object.defineProperty(o, 'x', { value: m[0] }); Object.defineProperty(o, 'y', { value: m[1] });
    } catch (e) { /* an event the browser will not let a page annotate keeps its own coordinates */ }
  }
  function remap(e) {
    if (!fit.node || fit.s === 1 && fit.left === 0 && fit.top === 0) return;
    if (e.target && e.target.closest && e.target.closest('[data-mosa-port]')) return;   // the kit's own controls read the real point
    if (e.touches || e.changedTouches) { var L = [e.touches, e.changedTouches, e.targetTouches]; for (var i = 0; i < L.length; i++) for (var j = 0; L[i] && j < L[i].length; j++) remapPoint(L[i][j]); }
    else remapPoint(e);
  }
  /* A TAP IS HELD LONG ENOUGH TO BE SEEN (measured on "Radius Raid": its menu reads `hovering && mouse.down` once a frame). After a tap a
     phone sends mousedown and mouseup back to back, inside one frame — a game that POLLS the button never sees it down, and its menu is dead
     on every phone. On a touch device a release that comes too soon after its press is held back until a few frames have passed. */
  var pressedAt = 0;
  function holdTap(e) {
    if (e.__mosaRaw || e.__mosaHeld) return;
    if (e.type === 'mousedown') { pressedAt = performance.now(); return; }
    var ms = cfg.tapHoldMs == null ? 90 : cfg.tapHoldMs, since = performance.now() - pressedAt;
    if (!(ms > 0) || since >= ms || !isTouch()) return;
    e.stopImmediatePropagation();
    var target = e.target, init = { bubbles: true, cancelable: true, composed: true, view: W, clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY, button: e.button, buttons: 0 };
    setTimeout(function () { var up = new MouseEvent('mouseup', init); try { Object.defineProperty(up, '__mosaHeld', { value: true }); } catch (x) { /* unmarked */ } (target && target.isConnected ? target : D.body).dispatchEvent(up); }, ms - since);
  }
  function startFit() {
    fit.node = $(cfg.stage);
    if (!fit.node) return;
    fit.w = cfg.size ? cfg.size[0] : fit.node.offsetWidth; fit.h = cfg.size ? cfg.size[1] : fit.node.offsetHeight;
    for (var i = 0; i < MAPPED.length; i++) W.addEventListener(MAPPED[i], remap, true);
    W.addEventListener('resize', relayout); W.addEventListener('orientationchange', function () { setTimeout(relayout, 150); }); W.addEventListener('mosa:device', relayout);
    relayout();
  }
  function relayout() {
    var t = isTouch() && cfg.touch;
    fit.pad = t && cfg.touch.reserve ? cfg.touch.reserve(W.innerWidth, W.innerHeight) : { top: 0, right: 0, bottom: 0, left: 0 };
    layout(); paintTouch();
    /* the game's own resize handler reads the stage's place again (the kit's layout ran first) */
    if (typeof cfg.onLayout === 'function') { try { cfg.onLayout({ scale: fit.s, left: fit.left, top: fit.top }); } catch (e) { /* the game's own */ } }
  }

  /* ----------------------------------------------------------------- INPUT -----------------------------------------------------------------
   * The game's own handlers are driven: a key is a real KeyboardEvent (key · code · keyCode · which — old games read the last two), the
   * mouse is a real MouseEvent at a point of the STAGE. */
  var KEY = { Space: [' ', 32], Enter: ['Enter', 13], Escape: ['Escape', 27], ShiftLeft: ['Shift', 16], ShiftRight: ['Shift', 16], ControlLeft: ['Control', 17], AltLeft: ['Alt', 18], Tab: ['Tab', 9],
    Backspace: ['Backspace', 8], ArrowLeft: ['ArrowLeft', 37], ArrowUp: ['ArrowUp', 38], ArrowRight: ['ArrowRight', 39], ArrowDown: ['ArrowDown', 40] };
  function keyInfo(code) {
    if (KEY[code]) return { code: code, key: KEY[code][0], keyCode: KEY[code][1] };
    var m = /^Key([A-Z])$/.exec(code); if (m) return { code: code, key: m[1].toLowerCase(), keyCode: m[1].charCodeAt(0) };
    m = /^Digit([0-9])$/.exec(code); if (m) return { code: code, key: m[1], keyCode: 48 + Number(m[1]) };
    return { code: code, key: code, keyCode: 0 };
  }
  /* a key stays down long enough to be seen: a game that POLLS its keys once a frame misses a press released inside the same frame */
  var held = {}, downAt = {}, upTimer = {};
  function fireKey(code, down) {
    var k = keyInfo(code), target = $(cfg.keyTarget) || D.activeElement || D.body || D;
    var ev = new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k.key, code: k.code, bubbles: true, cancelable: true, composed: true, view: W });
    try { Object.defineProperty(ev, 'keyCode', { get: function () { return k.keyCode; } }); Object.defineProperty(ev, 'which', { get: function () { return k.keyCode; } }); } catch (e) { /* a browser that fixes them */ }
    try { Object.defineProperty(ev, '__mosaRaw', { value: true }); } catch (e) { /* unmarked */ }
    target.dispatchEvent(ev);
  }
  function key(code, down) {
    if (!code) return;
    if (down) {
      if (upTimer[code]) { clearTimeout(upTimer[code]); upTimer[code] = null; }
      if (held[code]) return;
      held[code] = true; downAt[code] = performance.now(); fireKey(code, true); return;
    }
    if (!held[code] || upTimer[code]) return;
    var wait = (cfg.keyHoldMs == null ? 90 : cfg.keyHoldMs) - (performance.now() - downAt[code]);
    if (wait > 0) { upTimer[code] = setTimeout(function () { upTimer[code] = null; held[code] = false; fireKey(code, false); }, wait); return; }
    held[code] = false; fireKey(code, false);
  }
  function tapKey(code, ms) { key(code, true); setTimeout(function () { key(code, false); }, ms || 60); }
  /* the mouse, at a point of the stage's own space (0,0 = the stage's top-left corner, in the game's own pixels) */
  function mouse(type, sx, sy, buttons) {
    var target = $(cfg.mouseTarget) || fit.node || D.body;
    var x = fit.left + sx, y = fit.top + sy;
    var ev = new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view: W, clientX: x, clientY: y, screenX: x, screenY: y, button: 0, buttons: buttons == null ? (type === 'mouseup' ? 0 : 1) : buttons });
    try { Object.defineProperty(ev, '__mosaRaw', { value: { x: x, y: y } }); Object.defineProperty(ev, 'pageX', { value: x + (W.scrollX || 0) }); Object.defineProperty(ev, 'pageY', { value: y + (W.scrollY || 0) }); } catch (e) { /* as the browser made it */ }
    target.dispatchEvent(ev);
  }

  /* ----------------------------------------------------------------- TOUCH -----------------------------------------------------------------
   * Sticks and buttons the kit paints on a touch device; each presses what the game already listens for. Declared in __MOSA_CONTROLS so the
   * platform's phone passes find them. */
  var touchRoot = null, parts = [], touchAt = 0;
  var CSS = '[data-mosa-port]{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:none;-webkit-tap-highlight-color:transparent;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}'
    /* nothing of the kit shows over a loading screen — the game's own or the platform's (the script keeps the touch root down too, for a browser with no :has) */
    + ':root:has([data-mosa-loading],[data-mosa-boot-surface],#mosa-boot) [data-mosa-port]:not(style){visibility:hidden!important}'
    + '.mp-stick{position:fixed;width:124px;height:124px;border-radius:50%;background:rgba(255,255,255,.07);border:2px solid rgba(255,255,255,.28);z-index:2147480000}'
    + '.mp-stick i{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(255,255,255,.34);border:2px solid rgba(255,255,255,.6);pointer-events:none}'
    + '.mp-stick b{position:absolute;left:0;right:0;top:-21px;text-align:center;font-size:12px;letter-spacing:.06em;font-weight:600;color:rgba(255,255,255,.55);text-transform:uppercase;pointer-events:none}'
    + '.mp-btn{position:fixed;min-width:52px;height:52px;padding:0 10px;box-sizing:border-box;border-radius:26px;background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.34);color:#fff;font-size:13px;font-weight:700;letter-spacing:.06em;z-index:2147480000;display:flex;align-items:center;justify-content:center}'
    + '.mp-btn.on,.mp-stick.on{background:rgba(255,255,255,.2);border-color:rgba(255,255,255,.75)}'
    + '.mp-chip{position:fixed;z-index:2147480001;font-size:12px;color:#fff;background:rgba(10,12,18,.72);border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:6px 9px;line-height:1.35;max-width:46vw}'
    + '.mp-chip b{font-weight:700}.mp-chip small{opacity:.7;display:block;font-size:12px}.mp-chip{max-height:40vh;overflow:hidden;pointer-events:none}'
    /* the (i): a 44 px target (a finger's), a 30 px face inside it — the face is the ::before, the target is the element */
    + '.mp-i{position:fixed;z-index:2147480002;width:44px;height:44px;margin:-7px;color:#fff;font:italic 700 15px Georgia,serif;display:flex;align-items:center;justify-content:center;cursor:pointer;background:none;border:0}'
    + '.mp-i::before{content:"";position:absolute;left:7px;top:7px;width:30px;height:30px;border-radius:15px;background:rgba(10,12,18,.6);border:1px solid rgba(255,255,255,.3);box-sizing:border-box;z-index:-1}'
    + '.mp-credits{position:fixed;inset:0;z-index:2147480003;background:rgba(6,8,12,.9);color:#e8ecf4;display:none;align-items:center;justify-content:center;padding:22px;font-size:14px;line-height:1.5}'
    + '.mp-credits div{max-width:520px}.mp-credits h2{margin:0 0 8px;font-size:20px}.mp-credits p{margin:8px 0}.mp-credits button{margin-top:14px;padding:10px 20px;border-radius:10px;border:0;background:#fff;color:#111;font-weight:700;font-size:14px}';
  function place(n, at, vw, vh) {
    /* at: [x, y] in px from the left/top; a negative number counts from the right/bottom */
    var x = at[0] < 0 ? vw + at[0] : at[0], y = at[1] < 0 ? vh + at[1] : at[1];
    n.style.left = Math.round(x) + 'px'; n.style.top = Math.round(y) + 'px';
  }
  function stick(spec, side) {
    var n = el('div'); n.className = 'mp-stick'; n.id = 'mosa-port-stick-' + side; n.setAttribute('data-mosa-port', 'stick');
    var nub = el('i'); n.appendChild(nub); if (spec.label) n.appendChild(el('b', '', spec.label));
    var id = null, R = 46, last = null;
    var set = function (dx, dy, on) {
      nub.style.transform = 'translate(' + dx * R + 'px,' + dy * R + 'px)'; n.classList.toggle('on', !!on);
      var ks = val(spec.keys);
      if (last && last !== ks && typeof spec.keys === 'function') { key(last.left, false); key(last.right, false); key(last.up, false); key(last.down, false); }   // what it steered changed: the old keys are let go
      last = ks;
      if (ks) { var t = spec.threshold || 0.34; key(ks.left, on && dx < -t); key(ks.right, on && dx > t); key(ks.up, on && dy < -t); key(ks.down, on && dy > t); }
      if (typeof spec.onMove === 'function') { try { spec.onMove(dx, dy, !!on); } catch (e) { /* the game's own */ } }
    };
    var read = function (e) {
      var r = n.getBoundingClientRect(), p = e.__mosaRaw || { x: e.clientX, y: e.clientY };
      var dx = (p.x - (r.left + r.width / 2)) / R, dy = (p.y - (r.top + r.height / 2)) / R, m = Math.sqrt(dx * dx + dy * dy);
      if (m > 1) { dx /= m; dy /= m; }
      set(dx, dy, true);
    };
    n.addEventListener('pointerdown', function (e) { e.preventDefault(); id = e.pointerId; try { n.setPointerCapture(id); } catch (x) { /* a synthetic pointer has nothing to capture */ } read(e); });
    n.addEventListener('pointermove', function (e) { if (e.pointerId === id) read(e); });
    var up = function (e) { if (id == null || (e.pointerId != null && e.pointerId !== id)) return; id = null; set(0, 0, false); };
    n.addEventListener('pointerup', up); n.addEventListener('pointercancel', up); n.addEventListener('lostpointercapture', up);
    return { node: n, spec: spec, side: side, kind: 'stick', let: function () { id = null; set(0, 0, false); } };
  }
  function button(spec) {
    var n = el('div', '', String(val(spec.label) || spec.id)); n.className = 'mp-btn'; n.id = 'mosa-port-btn-' + spec.id; n.setAttribute('data-mosa-port', 'button'); n.setAttribute('role', 'button');
    var down = function (e) { if (e) e.preventDefault(); n.classList.add('on'); if (spec.key) key(spec.key, true); if (typeof spec.onDown === 'function') spec.onDown(); };
    var up = function () { n.classList.remove('on'); if (spec.key) key(spec.key, false); if (typeof spec.onUp === 'function') spec.onUp(); };
    n.addEventListener('pointerdown', down); n.addEventListener('pointerup', up); n.addEventListener('pointercancel', up); n.addEventListener('pointerleave', up);
    return { node: n, spec: spec, kind: 'button' };
  }
  function buildTouch() {
    if (!cfg.touch || touchRoot) return;
    touchRoot = el('div'); touchRoot.id = 'mosa-port-touch'; touchRoot.setAttribute('data-mosa-port', 'touch');
    if (cfg.touch.left) parts.push(stick(cfg.touch.left, 'left'));
    /* a second stick is for what is NOT looking (a twin-stick shooter's aim is the game's own mechanic). One that says it looks is not
       painted: on a phone, looking is dragging the open screen (`touch.look`). */
    if (cfg.touch.right) {
      var rs = cfg.touch.right, says = String(rs.id || '') + ' ' + String(typeof rs.label === 'string' ? rs.label : '');
      if (rs.look === true || /\b(look|camera|view)\b/i.test(says)) { try { console.warn('[mosa-port] touch.right is a LOOK stick (' + says.trim() + ') and was not painted: on a phone, looking is dragging the open screen — use touch.look { onLook(dx, dy) }'); } catch (e) { /* no console */ } }
      else parts.push(stick(rs, 'right'));
    }
    startLook();
    (cfg.touch.buttons || []).forEach(function (b) { parts.push(button(b)); });
    parts.forEach(function (p) { touchRoot.appendChild(p.node); });
    D.body.appendChild(touchRoot);
    declare();
  }
  /* what the page declares it draws (PUBLISHING.md §3), so the phone passes find every control. A control with keys is declared on every
     device (its keys are its door on a desktop); one with none — a stick that stands in for the mouse — only where it is painted. */
  /* A CONTROL THAT ONLY APPLIES SOMETIMES (`when`): a game whose controls change with what the player holds — on foot, in a car, in a
     plane — gives each stick or button a `when()` and the kit shows, places and declares only the ones that apply right now. The key of a
     button that goes away is let go. `label` and a stick's `keys` may be functions too: one stick can steer whatever is being driven. */
  function shown(p) { if (typeof p.spec.when !== 'function') return true; try { return !!p.spec.when(); } catch (e) { return false; } }
  function val(v) { if (typeof v !== 'function') return v; try { return v(); } catch (e) { return null; } }
  var declared0 = null;
  function declare() {
    if (declared0 == null) declared0 = (W.__MOSA_CONTROLS && W.__MOSA_CONTROLS.actions) ? W.__MOSA_CONTROLS.actions.slice() : [];
    var actions = declared0.slice(), touchy = isTouch();
    parts.forEach(function (p) {
      var a;
      if (!shown(p)) return;                         // a control that does not apply now is not on the screen: it is not declared either
      if (p.kind === 'stick') { var k = val(p.spec.keys); a = { id: p.spec.id || (p.side === 'left' ? 'move' : 'aim'), label: p.spec.label || (p.side === 'left' ? 'Move' : 'Aim'), kind: p.side === 'left' ? 'move' : 'aim', keys: k ? [k.up, k.left, k.down, k.right] : [], touch: '#' + p.node.id }; }
      else a = { id: p.spec.id, label: String(val(p.spec.label) || p.spec.id), kind: 'button', keys: p.spec.key ? [p.spec.key] : [], touch: '#' + p.node.id };
      if (a.keys.length || touchy) actions.push(a);
    });
    /* the look surface is the open screen itself: declared as the canvas (`touch: true`), where it is a surface — a touch device */
    var l = lookSpec();
    if (l && touchy) actions.push({ id: l.id || 'look', label: l.label || 'Look', kind: 'look', keys: [], touch: true, target: 'canvas' });
    (cfg.controls || []).forEach(function (a) { actions.push(a); });
    W.__MOSA_CONTROLS = { schema: 'mosa.controls.v1', actions: actions };
  }
  /* NOTHING OF THE KIT IS PAINTED OVER A LOADING SCREEN (looked at, 2026-10-05: the stick and a button sat on top of the game's own
     loading screen). While a loading screen is up — the game's own, or the platform's — the controls, the room chip and the (i) wait. */
  function loadingUp() { try { return !!D.querySelector('[data-mosa-loading],[data-mosa-boot-surface],#mosa-boot'); } catch (e) { return false; } }
  function paintTouch() {
    if (!touchRoot) { if (cfg.controls && cfg.controls.length) declare(); return; }
    var on = isTouch() && !loadingUp(); touchRoot.style.display = on ? 'block' : 'none';
    declare();
    if (!on) return;
    var vw = W.innerWidth, vh = W.innerHeight, wide = vw > vh;
    var sig = '';
    parts.forEach(function (p) {
      var on = shown(p);
      if (p.was !== on) { p.was = on; p.node.style.display = on ? '' : 'none'; if (!on) { if (p.kind === 'button' && p.spec.key) key(p.spec.key, false); if (p.kind === 'stick' && p.let) p.let(); } }
      sig += on ? '1' : '0';
      if (!on) return;
      if (p.kind === 'button' && typeof p.spec.label === 'function') { var text = String(val(p.spec.label) || p.spec.id); if (p.text !== text) { p.text = text; p.node.textContent = text; } }
      var at = typeof p.spec.at === 'function' ? p.spec.at(vw, vh, wide) : p.spec.at;
      if (!at) at = p.kind === 'stick' ? (p.side === 'left' ? [22, -150] : [-146, -150]) : [-76, 14];
      place(p.node, at, vw, vh);
    });
    if (sig !== paintTouch.sig) { paintTouch.sig = sig; declare(); }
  }

  /* ------------------------------------------------------------------ LOOK -----------------------------------------------------------------
   * ON A PHONE, LOOKING AROUND IS DRAGGING THE OPEN SCREEN — never a second stick (the owner, 2026-10-04: "for mobile, what is this right
   * joystick for looking around when that must be just tapping the open … space"). `touch.look` makes every part of the screen that is not
   * a control the look surface:
   *     look: { onLook: function (dx, dy) { camera.yaw -= dx * 0.004; camera.pitch -= dy * 0.004; },   // how far the finger moved, CSS px
   *             mouse: true,              // also move the game's OWN mouse-look: a `mousemove` carrying movementX / movementY
   *             onTap: function (x, y) {} // (optional) instead of the game's own click at that point
   *             when: function () { return !paused; } }
   * A finger that DRAGS there turns the view; a finger that TAPS there is the game's own click at that point (mousedown · mouseup · click,
   * held long enough for a game that polls its mouse to see). While a finger looks, nothing else of it reaches the game — a drag is never
   * also a shot. The game's own buttons, links and fields, and anything marked `data-mosa-ui`, are never part of the surface. */
  var look = { id: null, x: 0, y: 0, sx: 0, sy: 0, at: 0, moved: 0, on: false, started: false, target: null };
  var UI = 'button,a[href],input,select,textarea,label,summary,[role="button"],[contenteditable="true"],[data-mosa-ui]';
  function lookSpec() {
    var l = cfg.touch && cfg.touch.look;
    if (!l) return null;
    if (typeof l.when === 'function') { try { if (!l.when()) return null; } catch (e) { return null; } }
    return l;
  }
  function openScreen(t) { return !(t && t.closest && (t.closest('[data-mosa-port]') || t.closest(UI))); }
  function lookDown(e) {
    var l = lookSpec();
    if (!l || look.id != null || e.pointerType !== 'touch' || !isTouch() || !openScreen(e.target)) return;
    look.id = e.pointerId; look.x = look.sx = e.clientX; look.y = look.sy = e.clientY; look.at = performance.now(); look.moved = 0; look.on = false;
    look.target = e.target;                             // what the finger landed on — the game's canvas: its mouse-look hears the drag THERE
    e.stopImmediatePropagation(); e.preventDefault();   // the browser's own mouse events for this finger are not made: a tap is delivered below
  }
  function lookMove(e) {
    if (look.id == null || e.pointerId !== look.id) return;
    var l = lookSpec(), dx = e.clientX - look.x, dy = e.clientY - look.y;
    look.x = e.clientX; look.y = e.clientY; look.moved += Math.abs(dx) + Math.abs(dy);
    e.stopImmediatePropagation(); e.preventDefault();
    if (!l) return;
    if (!look.on && look.moved < (l.slop == null ? 8 : l.slop)) return;      // a finger that has barely moved may still be a tap
    look.on = true;
    if (typeof l.onLook === 'function') { try { l.onLook(dx, dy, e); } catch (x) { /* the game's own */ } }
    if (l.mouse) {
      /* the game's own mouse-look listens on its canvas or on the document: an event sent where the finger landed bubbles to both
         (sent on <body>, a canvas listener never heard it — driven 2026-10-05) */
      var target = $(cfg.mouseTarget) || (look.target && look.target.isConnected ? look.target : null) || fit.node || D.body;
      var ev = new MouseEvent('mousemove', { bubbles: true, cancelable: true, composed: true, view: W, clientX: e.clientX, clientY: e.clientY, movementX: dx, movementY: dy, buttons: 0 });
      try { if (ev.movementX !== dx) { Object.defineProperty(ev, 'movementX', { value: dx }); Object.defineProperty(ev, 'movementY', { value: dy }); } Object.defineProperty(ev, '__mosaRaw', { value: { x: e.clientX, y: e.clientY } }); } catch (x) { /* as the browser made it */ }
      target.dispatchEvent(ev);
    }
  }
  function lookUp(e) {
    if (look.id == null || (e.pointerId != null && e.pointerId !== look.id)) return;
    var l = lookSpec(), tapped = !look.on && e.type === 'pointerup' && performance.now() - look.at < 450, x = look.sx, y = look.sy;
    look.id = null; look.on = false;
    e.stopImmediatePropagation();
    if (!tapped || !l) return;
    if (typeof l.onTap === 'function') { try { l.onTap(x, y); } catch (x2) { /* the game's own */ } return; }
    /* the game's own click, at the point the finger touched: on whatever is there (its canvas, a thing it drew in the DOM) */
    var m = fit.node ? toStage(x, y) : [x, y], target = D.elementFromPoint(x, y) || $(cfg.mouseTarget) || fit.node || D.body;
    var fire = function (type, buttons) {
      var ev = new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view: W, clientX: m[0], clientY: m[1], screenX: x, screenY: y, button: 0, buttons: buttons });
      try { Object.defineProperty(ev, '__mosaRaw', { value: { x: x, y: y } }); } catch (x3) { /* unmarked */ }
      (target.isConnected ? target : D.body).dispatchEvent(ev);
    };
    fire('mousemove', 0); fire('mousedown', 1);
    setTimeout(function () { fire('mouseup', 0); fire('click', 0); }, cfg.tapHoldMs == null ? 90 : cfg.tapHoldMs);
  }
  /* the touch events of a finger that is looking never reach the game either, and the page does not scroll or zoom under it */
  function lookTouch(e) {
    if (look.id == null) return;
    var t = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].target : e.target;
    if (!openScreen(t)) return;
    e.stopImmediatePropagation(); if (e.cancelable) e.preventDefault();
  }
  function startLook() {
    if (look.started || !(cfg.touch && cfg.touch.look)) return;
    look.started = true;
    var cap = { capture: true, passive: false };
    W.addEventListener('pointerdown', lookDown, cap); W.addEventListener('pointermove', lookMove, cap);
    W.addEventListener('pointerup', lookUp, cap); W.addEventListener('pointercancel', lookUp, cap);
    ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(function (t) { W.addEventListener(t, lookTouch, cap); });
  }

  /* ---------------------------------------------------------------- LOADING ----------------------------------------------------------------
   * EVERY GAME HAS A LOADING SCREEN OF ITS OWN (the owner, 2026-10-04: "the same … loading screen for all the ported … games when I asked
   * for custom loading screens for all"). The platform paints one default screen — the poster and the title — for a page that brings none.
   * A game brings its own by putting it IN ITS PAGE, first thing in <body>, marked `data-mosa-loading`:
   *     <div id="loading" data-mosa-loading> …the game's own mark, type, colours and motion… <i data-mosa-progress></i> <span data-mosa-phase></span> </div>
   * NotesMosaic then paints nothing of its own and takes the game's screen down when the game is ready. The kit FEEDS that screen the
   * truth, so the markup needs no script: `--mosa-progress` (0 → 1, on the screen's root), the width of `[data-mosa-progress]`, the words
   * of `[data-mosa-phase]`. Progress is real work only — `__mosaBoot.registerWork("loading the track")` → the function it returns, or
   * `__mosaBoot.progress(0.4, "building the city")`; a timer is never progress. Outside NotesMosaic the kit takes the screen down itself
   * once the page has loaded and painted. `loading: { theme: { background, accent, text, title, art, font } }` restyles the platform's
   * default screen instead — a lesser thing: the same layout in the game's colours.
   *
   * WHO SAYS READY. A page that brings its own loading screen has said it will speak: NotesMosaic waits for its word and takes the screen
   * down then — it never guesses from a timer. A game written for a desktop page says no such word, so the kit says it for the game:
   *     loading: { ready: function () { return game.state === "menu"; } }   the game's OWN reading — the screen comes down when it is true
   *     loading: {}                                                         once the page has loaded, nothing registered is still in
   *                                                                         flight, and two more frames have painted
   *     loading: { ready: "manual" }  +  MosaPort.ready()                   the game calls it on its first painted frame
   * A game that loads its world AFTER the page (assets it fetches, a level it builds) uses the first or the third, or registers that work
   * (`__mosaBoot.registerWork`) so the second waits for it: a screen that comes down over a half-built game is the thing this is for. */
  function ready() { try { if (W.__MOSA_BOOT) W.__MOSA_BOOT.ok = true; } catch (e) { /* outside NotesMosaic: nobody to tell */ } }
  function startLoading() {
    var l = cfg.loading || {}, B = W.__mosaBoot;
    if (l.theme && B && typeof B.theme === 'function') { try { B.theme(l.theme); } catch (e) { /* the platform's default stays */ } }
    var node = l.el ? $(l.el) : D.querySelector('[data-mosa-loading],[data-mosa-boot-surface]');
    if (!node) return;
    if (B && typeof B.custom === 'function' && !node.hasAttribute('data-mosa-loading') && !node.hasAttribute('data-mosa-boot-surface')) { try { B.custom(node); } catch (e) { /* marked below */ } }
    if (!node.hasAttribute('data-mosa-loading') && !node.hasAttribute('data-mosa-boot-surface')) node.setAttribute('data-mosa-loading', '');
    var bar = node.querySelector('[data-mosa-progress]'), words = node.querySelector('[data-mosa-phase]'), shown = -1;
    var away = function () { try { node.style.transition = 'opacity .3s ease'; node.style.opacity = '0'; node.style.pointerEvents = 'none'; setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 340); } catch (e) { /* gone */ } };
    if (!B) {   // your own dev server: nobody else will take it down
      var done = function () { requestAnimationFrame(function () { requestAnimationFrame(away); }); };
      if (D.readyState === 'complete') done(); else W.addEventListener('load', done);
      return;
    }
    var when = l.ready, loaded = D.readyState === 'complete', frames = 0;
    if (!loaded) W.addEventListener('load', function () { loaded = true; });
    (function feed() {
      if (!node.isConnected) return;
      var s = null; try { s = typeof B.state === 'function' ? B.state() : null; } catch (e) { s = null; }
      if (s) {
        var p = typeof s.progress === 'number' ? s.progress : 0;
        if (p !== shown) { shown = p; node.style.setProperty('--mosa-progress', String(p)); if (bar) bar.style.width = Math.round(p * 100) + '%'; }
        if (words && s.phase && s.phase !== 'booting' && words.textContent !== s.phase) words.textContent = s.phase;
        if (s.ok === true) return;                  // ready: the platform takes the screen down
        if (s.ok === false) return;                 // failed: the platform says so; nothing here calls that ready
      }
      if (when !== 'manual') {
        var go = false;
        if (typeof when === 'function') { try { go = when() === true; } catch (e) { go = false; } }
        else if (loaded && !(s && s.registered > s.done)) go = ++frames > 2;
        if (go) { ready(); }
      }
      requestAnimationFrame(feed);
    })();
  }

  /* ----------------------------------------------------------------- BRIDGE ----------------------------------------------------------------
   * The room rides the Mosaic bridge's multiplayer session; a player's save is ONE KEY OF THEIR OWN in the game's database
   * ("port:<id>:player:<their id>"), written by nobody else — a game's store is shared by everyone in it, so a save kept as a row of the
   * shared state can be overwritten by another player's older copy; a key per player cannot. Absent outside NotesMosaic. */
  var me = null, rivals = {}, roomBest = { score: 0, name: '' }, myBest = 0, sentAt = 0, haveWorld = false, chip = null, born = performance.now();
  var cloud = { seen: false, tries: 0, at: 0, written: null, restored: false };
  var room = function () { return app ? app.mp.mpRoom() : { enabled: false, players: [], me: null }; };
  var hostDb = function () { var b = W.MosaicBridge; return b && b.db && typeof b.db.get === 'function' && typeof b.db.set === 'function' ? b.db : null; };
  var saveKey = function () { return 'port:' + String(cfg.id || 'game') + ':player:' + me.userId; };
  function storageBlob() {
    if (!cfg.saves) return null;
    var out = {}, keys = cfg.saves === true ? null : cfg.saves;
    try {
      if (keys) keys.forEach(function (k) { var v = localStorage.getItem(k); if (v != null) out[k] = v; });
      else for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('__mosa') !== 0) out[k] = localStorage.getItem(k); }
    } catch (e) { return null; }
    var s = JSON.stringify(out);
    return s.length <= 200000 ? s : null;
  }
  /* the player's key is READ before it is ever written: a transport that is down is not a new player (BACKEND.md §5) */
  function readCloud(now) {
    var db = hostDb();
    if (!db || !me || cloud.seen || cloud.reading || cloud.tries >= 6 || now - cloud.at < 3000) return;
    cloud.reading = true; cloud.at = now; cloud.tries++;
    Promise.resolve().then(function () { return db.get(saveKey()); }).then(function (v) {
      cloud.reading = false; cloud.seen = true;
      var row = v && typeof v === 'object' ? v : null;
      if (row) myBest = Math.max(myBest, Number(row.best) || 0);
      var kept = row && typeof row.saves === 'string' ? row.saves : null, local = storageBlob();
      cloud.written = JSON.stringify({ best: row ? Number(row.best) || 0 : 0, saves: kept });
      if (!cfg.saves || !kept || kept === local) return;
      /* this player's save from another device (or another day) is put back ONCE per session; what is played after is the newer truth */
      var marker = '__mosa_port_restored', stamp = kept.length + ':' + kept.slice(0, 64), done = null;
      try { done = sessionStorage.getItem(marker); } catch (e) { done = null; }
      if (done === stamp) return;
      var data = null; try { data = JSON.parse(kept); } catch (e) { data = null; }
      if (!data) return;
      try { Object.keys(data).forEach(function (k) { localStorage.setItem(k, data[k]); }); sessionStorage.setItem(marker, stamp); } catch (e) { return; }
      cloud.restored = true;
      if (typeof cfg.onSaves === 'function') { try { cfg.onSaves(data); } catch (e) { /* the game's own */ } }
      else { try { location.reload(); } catch (e) { /* stays as it is */ } }
    }, function () { cloud.reading = false; /* down: asked again in three seconds, never written over */ });
  }
  function writeCloud(now) {
    var db = hostDb();
    if (!db || !me || !cloud.seen || cloud.writing || (cloud.wroteAt && now - cloud.wroteAt < 2000)) return;
    var blob = cfg.saves ? storageBlob() : null;
    var want = JSON.stringify({ best: myBest, saves: blob });
    if (want === cloud.written) return;
    cloud.writing = true; cloud.wroteAt = now;
    var row = { v: 1, name: me.displayName || 'player', best: myBest, at: Date.now() };
    if (blob != null) row.saves = blob;
    Promise.resolve().then(function () { return db.set(saveKey(), row); }).then(function (ok) { cloud.writing = false; if (ok === true) cloud.written = want; }, function () { cloud.writing = false; });
  }
  function send(payload) { if (!app) return null; return app.mp.mpSend({ type: 'sim_player_action', payload: payload }); }
  /* what a late joiner is handed: the room's best, and whatever the game says its shared state is (cfg.snapshot) */
  function snapshot() { var s = { roomBest: roomBest }; if (typeof cfg.snapshot === 'function') { try { var x = cfg.snapshot(); if (x && typeof x === 'object') for (var k in x) s[k] = x[k]; } catch (e) { /* the game's own */ } } return s; }
  function sync() { if (app) app.mp.mpSync(); }
  function tick() {
    var now = performance.now();
    if (app) {
      var r = room();
      if (!me && r.me && r.me.userId) me = r.me;                        // identity arrives a moment after boot
      if (r.enabled && !haveWorld && (!tick.askedAt || now - tick.askedAt > 1500)) { tick.askedAt = now; app.mp.mpSync(); }   // ask for the room's state until someone answers
      var msgs = app.mp.mpDrain();
      for (var i = 0; i < msgs.length; i++) {
        var m = msgs[i];
        if (m.type === 'sim_bootstrap' || m.type === 'sim_players' || m.type === 'sim_state_request') { app.mp.mpSync({ state: snapshot() }); continue; }
        if (m.type === 'sim_state_snapshot') {
          var s = m.payload || {}; if (s.roomBest && s.roomBest.score > roomBest.score) roomBest = s.roomBest; haveWorld = true;
          if (typeof cfg.onSnapshot === 'function') { try { cfg.onSnapshot(s, m.from); } catch (e) { /* the game's own */ } }
          continue;
        }
        if (m.type !== 'sim_player_action') continue;
        var p = m.payload || {};
        if (p.kind === 'mp.status' && m.from) rivals[m.from] = { score: Number(p.score) || 0, best: Number(p.best) || 0, at: now };
        else if (p.kind === 'mp.best' && (Number(p.score) || 0) > roomBest.score) roomBest = { score: Number(p.score) || 0, name: String(p.name || '') };
        else if (typeof cfg.onMessage === 'function') { try { cfg.onMessage(p, m.from, m); } catch (e) { /* the game's own */ } }
      }
      var score = 0; if (typeof cfg.score === 'function') { try { score = Number(cfg.score()) || 0; } catch (e) { score = 0; } }
      if (score > myBest) myBest = score;
      if (score > roomBest.score && me) { roomBest = { score: score, name: me.displayName || 'player' }; send({ kind: 'mp.best', score: score, name: roomBest.name }); }
      if (now - sentAt >= 500) { var st = send({ kind: 'mp.status', score: score, best: myBest }); if (st && st.ok) sentAt = now; }
      if (me) { readCloud(now); writeCloud(now); }
    }
    paintChip(now); paintHint(now);
    /* controls that come and go with what the player holds are looked at again five times a second */
    if (touchRoot && now - touchAt > 200) {
      touchAt = now;
      var up = loadingUp(), again = up !== tick.loadingUp;        // a loading screen that came down (or went up): the controls follow
      tick.loadingUp = up;
      for (var q = 0; !again && q < parts.length; q++) if (typeof parts[q].spec.when === 'function' || typeof parts[q].spec.label === 'function') again = true;
      if (again) paintTouch();
    }
    /* the credits button is placed against what the game itself draws (a toolbar that appears late, or grows): looked at again twice a second */
    if (creditsPut && now - creditsAt > 120) { creditsAt = now; creditsPut(); }   // eight times a second: the (i) is off a game within a frame or two of play starting (it lingered half a second)
  }
  function paintChip(now) {
    if (cfg.roomChip === false || (typeof cfg.score !== 'function' && typeof cfg.chip !== 'function')) return;
    if (!chip) { chip = el('div'); chip.className = 'mp-chip'; chip.id = 'mosa-port-room'; chip.setAttribute('data-mosa-port', 'room'); D.body.appendChild(chip); }
    var r = room(), rows = [], html = '';
    if (typeof cfg.chip === 'function') { try { html = String(cfg.chip(r, me) || ''); } catch (e) { html = ''; } }
    else {
      for (var i = 0; i < r.players.length; i++) { var pl = r.players[i]; if (me && pl.userId === me.userId) continue; var rv = rivals[pl.userId]; rows.push('<b>' + esc(pl.displayName || 'player') + '</b> ' + (rv ? rv.score : 0)); }
      html = rows.length ? rows.slice(0, 4).join(' · ') + (roomBest.score ? '<small>room best ' + roomBest.score + (roomBest.name ? ' · ' + esc(roomBest.name) : '') + '</small>' : '')
        : (r.enabled && now - born < 9000 ? 'Share this game — friends who open it play beside you' : '');
    }
    if (chip.__h !== html) { chip.innerHTML = html; chip.__h = html; chip.style.display = html ? 'block' : 'none';
      /* which face: friends' scores, or the invitation to bring one (a game styles or places them apart by this) */
      chip.setAttribute('data-face', !html ? 'none' : (typeof cfg.chip === 'function' ? 'own' : (rows.length ? 'scores' : 'invite'))); }
    var at = typeof cfg.roomAt === 'function' ? cfg.roomAt(W.innerWidth, W.innerHeight) : [10, 10];
    chip.style.maxWidth = at[2] ? at[2] + 'px' : '';
    place(chip, at, W.innerWidth, W.innerHeight);
  }
  /* a game made for one way of holding the phone plays the other way too (letterboxed) and SAYS which way is better — a hint for a few
     seconds, never a wall over the game */
  var hint = null, hintAt = 0;
  function paintHint(now) {
    var want = cfg.rotateHint;
    if (!want || !isTouch()) { if (hint) hint.style.display = 'none'; return; }
    var wide = W.innerWidth > W.innerHeight, other = want === 'landscape' ? !wide : wide;
    if (!hint) { hint = el('div', '', want === 'landscape' ? '\u21bb Turn your phone for the full view' : '\u21bb Hold your phone upright for the full view'); hint.className = 'mp-chip'; hint.id = 'mosa-port-hint'; hint.setAttribute('data-mosa-port', 'hint'); D.body.appendChild(hint); }
    if (other && !hint.__on) { hint.__on = true; hintAt = now; }
    if (!other) hint.__on = false;
    var show = other && now - hintAt < 7000;
    hint.style.display = show ? 'block' : 'none';
    if (show) { hint.style.left = Math.max(8, Math.round((W.innerWidth - hint.offsetWidth) / 2)) + 'px'; hint.style.top = '52px'; }
  }
  function startBridge() {
    if (!(W.MosaAppBridge && W.MosaAppBridge.createAppBridge)) return;
    try { app = W.MosaAppBridge.createAppBridge({ namespace: String(cfg.id || 'port'), seed: {}, settings: {}, derives: {}, autosave: false }); } catch (e) { app = null; }
  }

  /* ---------------------------------------------------------------- CREDITS ---------------------------------------------------------------- */
  var creditsPut = null, creditsAt = 0;
  function buildCredits() {
    var c = cfg.credits; if (!c) return;
    var b = el('div', '', 'i'); b.className = 'mp-i'; b.id = 'mosa-port-credits-open'; b.setAttribute('data-mosa-port', 'credits'); b.setAttribute('role', 'button'); b.setAttribute('aria-label', 'About this game');
    var panel = el('div'); panel.className = 'mp-credits'; panel.setAttribute('data-mosa-port', 'credits');
    /* a PORT names the work it brings (`original`, or a title that is not the author's own); an ORIGINAL — `credits.kind: "original"`, or
       no `original` and no `changes` — is said as one: it was worded as "a port of itself" for every house original */
    var isOriginal = c.kind === 'original' || (!c.original && !c.changes && c.kind !== 'port');
    panel.innerHTML = '<div><h2>' + esc(c.title || '') + '</h2><p>' + (isOriginal
        ? esc(c.title || 'This game') + ' is an original game by <b>' + esc(c.author || '') + '</b>'
        : esc(c.title || 'This game') + ' is a port of <b>' + esc(c.original || c.title || '') + '</b> by <b>' + esc(c.author || '') + '</b>')
      + (c.source ? ' — ' + esc(c.source) : '') + ', under the ' + esc(c.license || '') + ' licence.</p>' + (c.assets ? '<p>' + esc(c.assets) + '</p>' : '')
      + (c.changes ? '<p>' + (isOriginal ? '' : 'Changed for NotesMosaic: ') + esc(c.changes) + '</p>' : '') + '<p>The licence and the full credits ship with the game (LICENSE, CREDITS.md). Remix it: every file is yours to change.</p><button type="button">Back to the game</button></div>';
    var at = cfg.creditsAt || [-40, 10];
    /* `creditsVisible` (a function) keeps the button off the game while it is played — on a title, a pause, a game over it is there */
    var put = function () {
      try { place(b, typeof at === 'function' ? at(W.innerWidth, W.innerHeight) : at, W.innerWidth, W.innerHeight); } catch (e) { /* placed where it was */ }
      if (typeof cfg.creditsVisible === 'function' && panel.style.display !== 'flex') { var on = true; try { on = !!cfg.creditsVisible(); } catch (e) { on = true; } b.style.display = on ? 'flex' : 'none'; }
    };
    creditsPut = put;
    b.addEventListener('click', function () { panel.style.display = 'flex'; });
    panel.querySelector('button').addEventListener('click', function () { panel.style.display = 'none'; });
    D.body.appendChild(b); D.body.appendChild(panel); put(); W.addEventListener('resize', put);
  }

  function init(c) {
    if (started) return W.MosaPort;
    started = true; cfg = c || {};
    var go = function () {
      var st = el('style'); st.setAttribute('data-mosa-port', 'style'); st.textContent = CSS; (D.head || D.documentElement).appendChild(st);
      W.addEventListener('mousedown', holdTap, true); W.addEventListener('mouseup', holdTap, true);   // before the fit's mapping: a held release is mapped like any other
      startLoading(); startBridge(); buildTouch(); if (!cfg.touch) startLook(); buildCredits();
      if (cfg.stage) startFit(); else { paintTouch(); W.addEventListener('resize', paintTouch); W.addEventListener('mosa:device', paintTouch); }
      /* ONE step of the kit's world; the page's own loop is the game's. The platform's harness calls the name. */
      var step = function () { tick(); };
      if (typeof W.__MOSA_TICK !== 'function') W.__MOSA_TICK = step;
      (function loop() { requestAnimationFrame(function () { step(); loop(); }); })();
    };
    if (D.body) go(); else D.addEventListener('DOMContentLoaded', go);
    return W.MosaPort;
  }

  W.MosaPort = { version: VERSION, init: init, ready: ready, key: key, tapKey: tapKey, mouse: mouse, isTouch: isTouch, toStage: toStage,
    scale: function () { return fit.s; }, room: room, send: send, sync: sync, esc: esc, me: function () { return me; }, best: function () { return { mine: myBest, room: roomBest }; }, relayout: relayout };
})();
