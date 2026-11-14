const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Execute the real gesture callbacks without a native UI runtime. Springs
// keep their current position until settled, exposing selection/animation races.
function shared(value) {
  let current = value, target = value;
  return {
    get value() { return current; },
    set value(next) {
      target = next?.animation ? next.target : next;
      if (!next?.animation) current = next;
    },
    get target() { return target; },
  };
}
function harness(file, names, extra = {}) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(__dirname, '../src/components', file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(source))) declarations.push(`const ${node.getText(source)};`);
    ts.forEachChild(node, visit);
  }
  visit(source);
  const gesture = {};
  for (const name of ['minDistance', 'activeOffsetX', 'failOffsetY']) gesture[name] = () => gesture;
  for (const name of ['onBegin', 'onStart', 'onUpdate', 'onFinalize']) gesture[name] = fn => { gesture[name + 'Event'] = fn; return gesture; };
  const selected = [];
  const context = {
    Gesture: { Pan: () => gesture }, PAD: 6, slot: 70, count: 5, maxX: 286,
    state: { index: 0 }, selectedIndex: 0, reduceMotion: false, SPRING: {},
    lensX: shared(6), lensW: shared(100), pressed: shared(0), stretch: shared(0), dragging: shared(false),
    withSpring: target => ({ animation: true, target }), withTiming: target => ({ animation: true, target }),
    runOnJS: fn => fn, setHoverIdx: () => {}, go: i => selected.push(i), select: i => selected.push(i),
    ...extra,
  };
  const js = ts.transpile(declarations.join('\n') + '\nreturn pan;', { target: ts.ScriptTarget.ES2022 });
  new Function(...Object.keys(context), js)(...Object.values(context));
  return { ...context, gesture, selected };
}

for (const reduceMotion of [false, true]) {
  test(`bottom tab quick tap uses release position (reduceMotion=${reduceMotion})`, () => {
    const h = harness('liquid-glass-tab-bar.tsx', ['clampX', 'indexAt', 'pan'], { reduceMotion });
    h.gesture.onBeginEvent({ x: 321 });
    h.gesture.onFinalizeEvent({ x: 321 }, true);
    assert.deepEqual(h.selected, [4]);
    assert.equal(h.lensX.target, 286);
  });
  test(`bottom tab cancelled drag restores selection (reduceMotion=${reduceMotion})`, () => {
    const h = harness('liquid-glass-tab-bar.tsx', ['clampX', 'indexAt', 'pan'], { reduceMotion });
    h.gesture.onBeginEvent({ x: 41 });
    h.gesture.onUpdateEvent({ x: 321, velocityX: 500 });
    h.gesture.onFinalizeEvent({ x: 321 }, false);
    assert.deepEqual(h.selected, []);
    assert.equal(h.lensX.target, 6);
  });
  for (const success of [false, true]) {
    test(`inline tabs drag success=${success} (reduceMotion=${reduceMotion})`, () => {
      const h = harness('ui/LensTrack.tsx', ['indexAt', 'pan'], {
        reduceMotion, lensX: shared(0),
        framesSV: shared([{ x: 0, width: 100 }, { x: 100, width: 80 }, { x: 180, width: 120 }]),
        disabledMask: [false, false, false],
      });
      h.gesture.onBeginEvent(); h.gesture.onStartEvent();
      h.gesture.onUpdateEvent({ x: 240, velocityX: 500 });
      h.gesture.onFinalizeEvent({ x: 240 }, success);
      assert.deepEqual(h.selected, success ? [2] : []);
      assert.equal(h.lensX.target, success ? 180 : 0);
      assert.equal(h.lensW.target, success ? 120 : 100);
    });
  }
}
