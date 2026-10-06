// Dependency-free handler regressions: execute the real TSX with a small hook
// scheduler and mocked platform boundaries. This is not a browser/Firestore test.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const web = path.resolve(__dirname, '..');

function load(file, modules = {}, globals = {}) {
  const baseline = process.env.WALK_SAVE_BASELINE_REF;
  const source = baseline && file === 'src/components/walks/walk-tracking-view.tsx'
    ? execFileSync('git', ['show', `${baseline}:apps/web/${file}`], { cwd: web, encoding: 'utf8' })
    : fs.readFileSync(path.join(web, file), 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  });
  const exports = {};
  vm.runInNewContext(result.outputText, { exports, require(id) {
    if (!(id in modules)) throw new Error(`Unexpected dependency: ${id}`);
    return modules[id];
  }, console, Date, JSON, Promise, ...globals }, { filename: file });
  return exports;
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness(options = {}) {
  const hooks = [];
  const effects = [];
  const timers = new Map();
  const listeners = new Map();
  const network = { onLine: options.online ?? true };
  const local = new Map();
  const storage = { get length() { return local.size; }, key: i => [...local.keys()][i], getItem: key => local.get(key) ?? null,
    setItem: (key, value) => local.set(key, value), removeItem: key => local.delete(key) };
  const browser = { setTimeout(fn) { const id = timers.size + 1; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); } };
  const drafts = load('src/lib/walk-drafts.ts', {}, { window: browser, navigator: network, localStorage: storage });
  for (const draft of options.drafts ?? []) drafts.storeWalkDraft(draft);
  let cursor = 0, dirty = true, tree, session;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial;
      return [hooks[i], value => { const next = typeof value === 'function' ? value(hooks[i]) : value;
        if (!Object.is(next, hooks[i])) { hooks[i] = next; dirty = true; } }];
    },
    useRef(initial) { const i = cursor++; return hooks[i] ??= { current: initial }; },
    useMemo(fn, deps) { const i = cursor++; if (!same(hooks[i]?.deps, deps)) hooks[i] = { value: fn(), deps }; return hooks[i].value; },
    useEffect(fn, deps) {
      const i = cursor++;
      if (same(hooks[i]?.deps, deps)) return;
      const previous = hooks[i];
      hooks[i] = { deps };
      effects.push(() => { previous?.cleanup?.(); hooks[i].cleanup = fn(); });
    },
  };
  react.useCallback = (fn, deps) => react.useMemo(() => fn, deps);
  class WalkSession {
    constructor() { session = this; this.state = { startedAt: null, durationMin: 0, totalDistanceKm: 0,
      path: [], isTracking: false, isPaused: false, autoStopped: false }; }
    on(fn) { this.listener = fn; fn(this.state); return () => { this.listener = null; }; }
    emit(patch) { this.state = { ...this.state, ...patch }; this.listener?.(this.state); }
    start() { this.emit({ startedAt: new Date('2026-10-05T01:00:00Z'), isTracking: true, durationMin: 10, totalDistanceKm: 1 }); }
    stop() { this.emit({ isTracking: false, ...options.stopSnapshot }); return this.state; }
    pause() { this.emit({ isPaused: true }); }
    resume() { this.emit({ isPaused: false }); }
    static blendTodayProgress(stored, min, goal) { return { minutes: stored + min, percent: Math.min(100, (stored + min) / goal * 100) }; }
  }
  const calls = { saves: [], updates: [], discards: [], deletes: [], closes: 0, confirms: 0 };
  let user = { uid: 'walker-A' };
  const modules = {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-dom': { createPortal: child => child },
    'next/navigation': { useRouter: () => ({ push() {} }) },
    'next-intl': { useTranslations: () => key => key },
    'lucide-react': Object.fromEntries(['AlertTriangle', 'Camera', 'ChevronDown', 'Pause', 'Play', 'RotateCw', 'Square', 'Trophy', 'X', 'Footprints', 'Hand', 'Plus'].map(name => [name, name])),
    '@/components/auth/auth-provider': { useAuth: () => ({ user, isGuest: false }) },
    '@/components/family/family-provider': { useFamily: () => ({ family: null }) },
    '@/components/ui/confirm-provider': { useConfirm: () => async request => { calls.confirms++; return options.confirm ? options.confirm(request) : true; } },
    '@/lib/firebase/users': { getAppUser: async () => ({ walkPrefs: { autoPhotoShare: true } }) },
    '@/lib/firebase/pets': { listPersonalPets: async () => [], listPets: async () => [] },
    '@/lib/walk-tracking': { WalkSession, estimatePetCalories: () => 0, getTodayProgress: () => ({ minutes: 0, percent: 0 }), getWeeklyAvgMinutes: () => 0 },
    '@/lib/scoring': { computeWalkScore: () => 42, computeStreak: () => 0 },
    '@/lib/image-processing': { processImage: async file => file, IMAGE_PRESETS: { post: {} } },
    '@/lib/firebase/storage': { deleteImage: async () => {}, fileExt: () => 'jpg', walkPhotoPath: () => 'photo/path', uploadImage: options.uploadImage ?? (async () => ({ url: 'photo-url' })) },
    '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
    '@/lib/walk-drafts': drafts,
    '@/lib/walk-goals': { getPetWalkGoalMinutes: () => 30 },
    'next/link': { __esModule: true, default: 'Link' },
    '@/lib/firebase/walks': { createWalk: async input => { calls.saves.push({ input, walkId: input.walkId }); return options.save ? options.save(input, input.walkId) : { walkId: input.walkId }; },
      listPersonalWalks: async () => [], listWalks: async () => [], mintWalkId: () => 'minted-id', updateWalkDetails: async () => {}, deleteWalk: async id => { calls.deletes.push(id); } },
  };
  for (const [file, symbol] of [['ui/button', 'Button'], ['ui/photo-lightbox', 'PhotoLightbox'], ['ui/textarea', 'Textarea'], ['ui/save-to-album-button', 'SaveToAlbumButton'], ['walks/photo-prompt-sheet', 'PhotoPromptSheet'], ['feed/post-composer', 'PostComposer']]) {
    modules[`@/components/${file}`] = { [symbol]: symbol };
  }
  for (const [file, symbol] of [['ui/empty-state', 'EmptyState'], ['walks/walk-tracking-view', 'WalkTrackingView'], ['walks/manual-walk-dialog', 'ManualWalkDialog'], ['walks/walks-dial', 'WalksDial'], ['walks/walks-week-strip', 'WalksWeekStrip'], ['walks/walks-confetti-decor', 'WalksConfettiDecor'], ['walks/streak-chip', 'StreakChip'], ['walks/walk-row', 'WalkRow'], ['walks/pet-picker-dropdown', 'PetPickerDropdown']]) {
    modules[`@/components/${file}`] = { [symbol]: symbol };
  }
  const loaded = load(options.page ? 'src/app/app/walks/page.tsx' : 'src/components/walks/walk-tracking-view.tsx', modules, {
    document: { body: { style: {} } }, window: browser, navigator: network, localStorage: storage,
    setTimeout: browser.setTimeout, clearTimeout: browser.clearTimeout,
    crypto: { randomUUID: () => 'photo-session-id' }, URL: { createObjectURL: () => 'blob:photo', revokeObjectURL() {} },
  });
  const component = options.page ? loaded.default : loaded.WalkTrackingView;
  let props = {
    open: true, walkId: 'walk-A', pet: { petId: 'dog-A', name: 'Mango' },
    streakDays: 1, storedTodayMin: 0, goalMin: 5,
    onClose() { calls.closes++; },
    async onComplete(input, walkId) { calls.saves.push({ input, walkId }); return options.save ? options.save(input, walkId) : { walkId }; },
    async onUpdate(walkId, details) { calls.updates.push({ walkId, details }); return options.update?.(walkId, details); },
    onDiscard(walkId) { calls.discards.push(walkId); options.discard?.(walkId); },
  };
  async function flush() {
    for (let rounds = 0; rounds < 30; rounds++) {
      if (dirty) { dirty = false; cursor = 0; tree = component(props); while (effects.length) effects.shift()(); }
      await new Promise(resolve => setImmediate(resolve));
      if (!dirty && !effects.length) return;
    }
    throw new Error('Hook scheduler did not settle');
  }
  function nodes(value = tree, out = []) {
    if (Array.isArray(value)) value.forEach(v => nodes(v, out));
    else if (value && typeof value === 'object') { out.push(value); nodes(value.props?.children ?? null, out); }
    return out;
  }
  const text = value => Array.isArray(value) ? value.map(text).join(' ') : value && typeof value === 'object' ? text(value.props?.children) : String(value ?? '');
  function button(label) { const item = nodes().find(n => n.type === 'Button' && text(n).trim() === label); assert.ok(item, `Missing button: ${label}; ${text(tree)}`); return item.props; }
  return { calls, flush, button, nodes, text: () => text(tree), get session() { return session; },
    pending: uid => drafts.listWalkDrafts(uid ?? user.uid),
    switchAccount(uid) { user = uid ? { uid } : null; dirty = true; },
    setOnline(value) { network.onLine = value; for (const fn of [...listeners.get(value ? 'online' : 'offline') ?? []]) fn(); },
    patch(next) { props = { ...props, ...next }; dirty = true; },
    runTimers() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); },
  };
}

test('canceling stop leaves the tracker active and writes nothing', async () => {
  const h = harness({ confirm: () => false }); await h.flush();
  await h.button('stop').onClick(); await h.flush();
  assert.equal(h.session.state.isTracking, true); assert.equal(h.calls.saves.length, 0);
});

test('confirmed stop saves immediately using the final sample; skip/share is not required', async () => {
  const ack = deferred(); const h = harness({ save: () => ack.promise, stopSnapshot: { durationMin: 12.5 } });
  await h.flush(); await h.button('stop').onClick(); await h.flush();
  assert.equal(h.calls.saves.length, 1); assert.equal(h.calls.saves[0].input.durationMin, 12.5);
  assert.equal(h.button('backToWalking').disabled, true); assert.ok(!h.text().includes('goalHitTitle'));
  ack.resolve({ walkId: 'walk-A' }); await h.flush(); h.runTimers(); await h.flush();
  assert.ok(h.text().includes('goalHitTitle'));
  h.nodes().find(n => n.type === 'PhotoPromptSheet').props.onSkip(); await h.flush();
  await h.button('backToWalking').onClick(); await h.flush();
  assert.equal(h.calls.saves.length, 1); assert.equal(h.calls.closes, 1);
});

test('null acknowledgement remains failed and retries the same snapshot and id', async () => {
  let attempts = 0;
  const h = harness({ save: (_input, walkId) => ++attempts === 1 ? null : { walkId } });
  await h.flush(); await h.button('stop').onClick(); await h.flush();
  assert.ok(h.text().includes('walkNotSaved')); assert.equal(h.calls.closes, 0);
  assert.equal(h.nodes().find(n => n.type === 'PhotoPromptSheet').props.open, false);
  await h.button('retry').onClick(); await h.flush();
  assert.equal(h.calls.saves.length, 2);
  assert.equal(h.calls.saves[0].walkId, h.calls.saves[1].walkId);
  assert.equal(h.calls.saves[0].input, h.calls.saves[1].input);
  assert.ok(h.text().includes('walkSaved'));
});

test('double stop clicks share one confirmation and one save', async () => {
  const confirmation = deferred(); const h = harness({ confirm: () => confirmation.promise }); await h.flush();
  const click = h.button('stop').onClick;
  const first = click(); await click(); assert.equal(h.calls.confirms, 1);
  confirmation.resolve(true); await first; await h.flush(); assert.equal(h.calls.saves.length, 1);
});

test('notes patch the existing walk; patch failure blocks closing and can retry', async () => {
  let fail = true; const h = harness({ update: async () => { if (fail) throw new Error('offline'); } });
  await h.flush(); await h.button('stop').onClick(); await h.flush();
  h.nodes().find(n => n.type === 'Textarea').props.onChange({ target: { value: '  nice walk  ' } }); await h.flush();
  await h.button('backToWalking').onClick(); await h.flush();
  assert.equal(h.calls.closes, 0); assert.equal(h.calls.updates[0].details.notes, 'nice walk');
  fail = false; await h.button('retry').onClick(); await h.flush();
  await h.button('backToWalking').onClick(); await h.flush();
  assert.equal(h.calls.saves.length, 1); assert.equal(h.calls.closes, 1);
});

test('late photo upload patches the saved walk and keeps exit disabled while uploading', async () => {
  const photo = deferred(); const h = harness({ uploadImage: () => photo.promise }); await h.flush();
  const input = h.nodes().find(n => n.type === 'input' && n.props.type === 'file');
  const upload = input.props.onChange({ target: { files: [{ name: 'photo.jpg' }], value: 'photo.jpg' } }); await h.flush();
  await h.button('stop').onClick(); await h.flush(); assert.equal(h.button('backToWalking').disabled, true);
  photo.resolve({ url: 'https://example.invalid/walk.jpg' }); await upload; await h.flush();
  assert.equal(h.calls.saves.length, 1); assert.equal(h.calls.updates.length, 1);
  assert.equal(h.calls.updates[0].details.photoURLs[0], 'https://example.invalid/walk.jpg');
  assert.equal(h.button('backToWalking').disabled, false);
});

test('pet/parent refresh cannot reassign the current walk; reopening resets saved state', async () => {
  const h = harness(); await h.flush();
  h.patch({ pet: { petId: 'dog-B', name: 'B' }, onComplete: async () => { throw new Error('wrong family closure'); } }); await h.flush();
  await h.button('stop').onClick(); await h.flush(); assert.equal(h.calls.saves[0].input.petId, 'dog-A');
  h.patch({ open: false }); await h.flush();
  const second = [];
  h.patch({ open: true, walkId: 'walk-B', onComplete: async (input, walkId) => { second.push({ input, walkId }); return { walkId }; } }); await h.flush();
  await h.button('stop').onClick(); await h.flush();
  assert.equal(second.length, 1); assert.equal(second[0].walkId, 'walk-B'); assert.equal(second[0].input.petId, 'dog-B');
});

test('three-hour automatic stop also persists without a CTA', async () => {
  const h = harness(); await h.flush();
  h.session.emit({ autoStopped: true, isTracking: false, durationMin: 180 }); await h.flush();
  assert.equal(h.calls.saves.length, 1); assert.equal(h.calls.saves[0].input.durationMin, 180);
});

test('finalized drafts survive reload with original dates, ids and account boundaries', () => {
  const data = new Map();
  const storage = { get length() { return data.size; }, key: i => [...data.keys()][i], getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const drafts = load('src/lib/walk-drafts.ts');
  const original = { walkId: 'walk-A', walkerUid: 'u1', familyId: 'family-A', petId: 'dog-A',
    startedAt: new Date('2026-10-05T01:00:00Z'), endedAt: new Date('2026-10-05T01:20:00Z') };
  drafts.storeWalkDraft(original, storage);
  drafts.storeWalkDraft({ ...original, walkId: 'walk-B', walkerUid: 'u2' }, storage);
  data.set('mango.walks.pending.v1.u1.bad', 'bad-json');
  const recovered = drafts.listWalkDrafts('u1', storage);
  assert.equal(recovered.length, 1); assert.equal(recovered[0].endedAt.toISOString(), original.endedAt.toISOString());
  assert.equal(recovered[0].familyId, 'family-A'); assert.equal(recovered[0].walkId, 'walk-A');
  drafts.removeWalkDraft('u1', 'walk-A', storage); assert.equal(drafts.listWalkDrafts('u1', storage).length, 0);
  assert.equal(drafts.listWalkDrafts('u2', storage).length, 1);
});

test('retrying a pre-minted walk creates only once and preserves later recap edits', async () => {
  const docs = new Map(); let creates = 0;
  const snapshot = ref => ({ exists: () => docs.has(ref.id), data: () => docs.get(ref.id) });
  const sdk = { collection: () => ({}), doc: (_db, _collection, id) => ({ id }), serverTimestamp: () => 'server-time',
    Timestamp: { fromDate: d => ({ toMillis: () => d.getTime() }) }, getDoc: async ref => snapshot(ref),
    runTransaction: async (_db, fn) => fn({ get: async ref => snapshot(ref), set: (ref, value) => { creates++; docs.set(ref.id, value); } }),
    updateDoc: async (ref, patch) => { docs.set(ref.id, { ...docs.get(ref.id), ...patch }); } };
  const walks = load('src/lib/firebase/walks.ts', { 'firebase/firestore': sdk, './config': { getDb: () => ({}) } });
  const input = { walkId: 'stable-id', walkerUid: 'u1', familyId: null, petId: 'dog-A', startedAt: new Date(), endedAt: new Date(), score: 1 };
  await walks.createWalk(input);
  await walks.updateWalkDetails(input.walkId, { notes: 'later note', photoURLs: ['later-photo'] });
  await walks.createWalk({ ...input, notes: 'stale draft' });
  assert.equal(creates, 1); assert.equal(docs.get(input.walkId).notes, 'later note');
});

test('offline stop retries the same snapshot once after reconnect', async () => {
  let attempts = 0;
  const h = harness({ online: false, save: (_input, walkId) => { if (++attempts === 1) throw new Error('offline'); return { walkId }; } });
  await h.flush(); await h.button('stop').onClick(); await h.flush();
  assert.equal(h.calls.saves.length, 1);
  h.setOnline(true); await h.flush();
  assert.equal(h.calls.saves.length, 2); assert.equal(h.calls.saves[0].input, h.calls.saves[1].input);
  h.setOnline(true); await h.flush(); assert.equal(h.calls.saves.length, 2);
});

test('reconnect during an in-flight failure queues one retry, without parallel saves', async () => {
  const first = deferred(); let attempts = 0;
  const h = harness({ online: false, save: (_input, walkId) => ++attempts === 1 ? first.promise : { walkId } });
  await h.flush(); await h.button('stop').onClick(); await h.flush();
  h.setOnline(true); h.setOnline(false); h.setOnline(true); await h.flush();
  assert.equal(h.calls.saves.length, 1);
  first.reject(new Error('first request failed')); await h.flush();
  assert.equal(h.calls.saves.length, 2); assert.ok(h.text().includes('walkSaved'));
});

test('permanent stop-save failure is not retried in a loop', async () => {
  const h = harness({ online: false, save: () => { throw new Error('permission denied'); } });
  await h.flush(); await h.button('stop').onClick(); await h.flush();
  h.setOnline(true); await h.flush(); h.setOnline(true); await h.flush(); h.runTimers(); await h.flush();
  assert.equal(h.calls.saves.length, 2); assert.ok(h.text().includes('saveFailed'));
});

test('discard confirmation blocks reconnect/manual retry; cancel retains the stopped walk', async () => {
  const confirmation = deferred();
  const h = harness({ online: false, save: () => { throw new Error('cannot save'); },
    confirm: request => request.title === 'discardDraftTitle' ? confirmation.promise : true });
  await h.flush(); await h.button('stop').onClick(); await h.flush();
  const retry = h.button('retry').onClick;
  const discard = h.button('discardDraft').onClick(); await h.flush();
  h.setOnline(true); retry(); await h.flush(); assert.equal(h.calls.saves.length, 1);
  confirmation.resolve(false); await discard; await h.flush();
  assert.equal(h.calls.discards.length, 0); assert.equal(h.calls.closes, 0);
  h.button('retry').onClick(); await h.flush(); assert.equal(h.calls.saves.length, 2);
});

test('confirmed discard closes only the unsaved local session and prevents resurrection', async () => {
  const h = harness({ online: false, save: () => { throw new Error('cannot save'); } });
  await h.flush(); await h.button('stop').onClick(); await h.flush();
  await h.button('discardDraft').onClick(); await h.flush();
  assert.deepEqual(h.calls.discards, ['walk-A']); assert.equal(h.calls.closes, 1);
  h.setOnline(true); await h.flush(); assert.equal(h.calls.saves.length, 1); assert.equal(h.calls.deletes.length, 0);
});

test('stale discard handler cannot interrupt a new save already in flight', async () => {
  const retry = deferred(); let attempts = 0;
  const h = harness({ save: () => { if (++attempts === 1) throw new Error('offline'); return retry.promise; } });
  await h.flush(); await h.button('stop').onClick(); await h.flush();
  const discard = h.button('discardDraft').onClick;
  h.button('retry').onClick(); await h.flush(); await discard();
  assert.equal(h.calls.confirms, 1); assert.equal(h.calls.discards.length, 0);
  retry.resolve({ walkId: 'walk-A' }); await h.flush(); assert.ok(h.text().includes('walkSaved'));
});

test('late save completion cannot mark the next account/session saved', async () => {
  const first = deferred(); let attempts = 0;
  const h = harness({ save: (_input, walkId) => ++attempts === 1 ? first.promise : { walkId } });
  await h.flush(); await h.button('stop').onClick(); await h.flush();
  h.switchAccount('walker-B'); await h.flush();
  h.patch({ open: false }); await h.flush(); h.patch({ open: true, walkId: 'walk-B' }); await h.flush();
  first.resolve({ walkId: 'walk-A' }); await h.flush();
  assert.ok(h.button('stop')); assert.ok(!h.text().includes('walkSaved'));
  await h.button('stop').onClick(); await h.flush(); assert.equal(h.calls.saves[1].walkId, 'walk-B');
});

test('account switch invalidates an outstanding discard confirmation', async () => {
  const confirmation = deferred();
  const h = harness({ save: () => { throw new Error('cannot save'); },
    confirm: request => request.title === 'discardDraftTitle' ? confirmation.promise : true });
  await h.flush(); await h.button('stop').onClick(); await h.flush();
  const discard = h.button('discardDraft').onClick(); h.switchAccount('walker-B'); await h.flush();
  confirmation.resolve(true); await discard; await h.flush(); assert.equal(h.calls.discards.length, 0);
});

function draft(id, uid = 'walker-A') {
  return { walkId: id, walkerUid: uid, familyId: null, petId: `dog-${id}`, petName: id,
    startedAt: new Date('2026-10-05T01:00:00Z'), endedAt: new Date('2026-10-05T01:20:00Z') };
}

test('returning online auto-recovers each draft; one failure does not block later walks', async () => {
  const h = harness({ page: true, drafts: [draft('bad'), draft('good')], save: input => {
    if (input.walkId === 'bad') throw new Error('permanent error'); return { walkId: input.walkId };
  } });
  await h.flush(); assert.equal(h.calls.saves.length, 2); assert.equal(h.pending().length, 1);
  assert.equal(h.pending()[0].walkId, 'bad'); assert.ok(h.text().includes('saveFailed'));
  await h.flush(); h.setOnline(true); await h.flush(); assert.equal(h.calls.saves.length, 2);
});

test('return page waits while offline, then makes one automatic recovery attempt', async () => {
  const h = harness({ page: true, online: false, drafts: [draft('offline')] });
  await h.flush(); assert.equal(h.calls.saves.length, 0);
  h.setOnline(true); await h.flush(); assert.equal(h.calls.saves.length, 1); assert.equal(h.pending().length, 0);
  h.setOnline(false); h.setOnline(true); await h.flush(); assert.equal(h.calls.saves.length, 1);
});

test('return-page discard confirmation blocks automatic retry and deletes no server data', async () => {
  const confirmation = deferred();
  const h = harness({ page: true, online: false, drafts: [draft('discard')], confirm: () => confirmation.promise });
  await h.flush(); h.button('discardDraft').onClick(); await h.flush();
  h.setOnline(true); h.button('retry').onClick(); await h.flush(); assert.equal(h.calls.saves.length, 0);
  confirmation.resolve(true); await h.flush(); assert.equal(h.pending().length, 0);
  h.setOnline(false); h.setOnline(true); await h.flush();
  assert.equal(h.calls.saves.length, 0); assert.equal(h.calls.deletes.length, 0);
});

test('return-page discard is unavailable during a running save, then cancel retains draft', async () => {
  const pending = deferred(); const h = harness({ page: true, online: false, drafts: [draft('running')], save: () => pending.promise, confirm: () => false });
  await h.flush(); const discard = h.button('discardDraft').onClick;
  h.button('retry').onClick(); await h.flush(); discard(); await h.flush(); assert.equal(h.calls.confirms, 0);
  pending.reject(new Error('failed')); await h.flush(); h.button('discardDraft').onClick(); await h.flush();
  assert.equal(h.calls.confirms, 1); assert.equal(h.pending().length, 1);
});

test('account change stops an old recovery batch and ignores its late UI updates', async () => {
  const pending = deferred();
  const h = harness({ page: true, drafts: [draft('a1'), draft('a2'), draft('b1', 'walker-B')], save: input => {
    if (input.walkId === 'a1') return pending.promise;
    throw new Error('B cannot save');
  } });
  await h.flush(); h.switchAccount('walker-B'); await h.flush();
  pending.resolve({ walkId: 'a1' }); await h.flush();
  assert.deepEqual(h.calls.saves.map(call => call.walkId), ['a1', 'b1']);
  assert.equal(h.pending('walker-A')[0].walkId, 'a2'); assert.equal(h.pending('walker-B')[0].walkId, 'b1');
  assert.ok(!h.text().includes('dog-a2')); assert.ok(h.text().includes('b1'));
});

test('discard markers prevent stale callbacks from storing a discarded draft again', () => {
  const data = new Map(); const storage = { get length() { return data.size; }, key: i => [...data.keys()][i], getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const drafts = load('src/lib/walk-drafts.ts'); const original = draft('discarded');
  drafts.storeWalkDraft(original, storage); drafts.discardWalkDraft(original.walkerUid, original.walkId, storage);
  assert.equal(drafts.listWalkDrafts(original.walkerUid, storage).length, 0);
  assert.throws(() => drafts.storeWalkDraft(original, storage), /discarded/);
  drafts.storeWalkDraft(draft('discarded', 'walker-B'), storage);
  assert.equal(drafts.listWalkDrafts('walker-B', storage).length, 1);
});
