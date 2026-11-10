// The door-rules block of index.html at b7f0b89 (D2a, before plate rules), byte for byte, for tests/door_rules_plates_d2b_gate.mjs.
/* DOOR_TESTABLE_CORE_START door-rules */
var DOOR_RULES_FILE = 'door_rules.json';
var DOOR_RULES_VERSION = 1;          // the door_rules.json version this build reads; a newer file is refused
var DOOR_RULES_OWNER = 'Jason';   // the only name that changes the leads list
var DOOR_RULES_LISTS = {
  menuName:         { label: 'Dish names on the menu', kind: 'flag', reads: 'a menu dish name', says: 'Menus naming “{w}” will be marked {t}.' },
  workbookAllergen: { label: 'Allergen rows in the menu workbook', kind: 'flag', reads: 'a menu workbook allergen row', says: 'A menu workbook allergen row naming “{w}” will read as {t}.' },
  restriction:      { label: 'Restrictions on the resident list', kind: 'tag', reads: 'a resident list restriction', says: 'A restriction naming “{w}” on the resident list will read as {t}.' },
  rexSpelling:      { label: 'Spellings on Rex’s week sheet', kind: 'spelling', reads: 'a word on Rex’s week sheet', says: 'On Rex’s week sheet, “{w}” will read as “{t}”.' }
};
var DOOR_RULES_LOG_MAX = 200;
var DOOR_RULES_FUTURE_MS = 86400000;   // a record more than a day ahead of this computer's clock is ordered as a day ahead
function doorRulesHasList(list) { return typeof list === 'string' && Object.prototype.hasOwnProperty.call(DOOR_RULES_LISTS, list); }
function doorRulesNormName(n) { return String(n == null ? '' : n).trim().replace(/\s+/g, ' ').toLowerCase(); }
function doorRulesNormWord(w) { return String(w == null ? '' : w).replace(/[’‘`]/g, "'").trim().replace(/\s+/g, ' ').toLowerCase(); }
// '' when the word is plain enough to add, else why not. Letters, spaces, a hyphen or an apostrophe between letters;
// 3 to 40 characters. Rex's spellings are one word of letters (the sheet is read word by word).
function doorRulesWordProblem(list, word) {
  if (!doorRulesHasList(list)) return 'list';
  const w = doorRulesNormWord(word);
  if (!w) return 'empty';
  if (w.length < 3 || w.length > 40) return 'length';
  if (list === 'rexSpelling') return /^[a-z]+$/.test(w) ? '' : 'characters';
  return /^[a-z]+(?:[ '-][a-z]+)*$/.test(w) ? '' : 'characters';
}
// The word as DOOR matches it: whole words, any case, a space or hyphen alike, with or without a plural (s, es, or
// y → ies). Built from the word, never from a pattern a person typed (only letters reach it).
function doorRulesWordRegex(word) {
  const w = doorRulesNormWord(word);
  const esc = s => s.split('').map(ch => ch === ' ' || ch === '-' ? '[\\s-]+' : ch === "'" ? "['’]?" : ch).join('');
  const src = /[^aeiou]y$/.test(w) ? esc(w.slice(0, -1)) + '(?:y|ies)' : esc(w) + '(?:e?s)?';
  return new RegExp('(?:^|[^a-z0-9])' + src + '(?![a-z0-9])', 'i');
}
function doorRulesKey(rec) { return rec.list + '|' + doorRulesNormWord(rec.word); }
// A canonical ISO time, as toISOString writes it. A time is never a reason to drop a record (second review N2): it
// only orders a merge, by its raw value, and a skewed one is shown on the page.
function doorRulesIsTime(t) {
  if (typeof t !== 'string') return false;
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return false;
  try { return new Date(ms).toISOString() === t; } catch (e) { return false; }
}
function doorRulesNowMs(nowMs) { return Number.isFinite(nowMs) ? nowMs : Date.now(); }
// Stamped more than a day ahead of this clock: a computer has the wrong date (shown on the page, never dropped).
function doorRulesSkewed(t, nowMs) { return Date.parse(t) > doorRulesNowMs(nowMs) + DOOR_RULES_FUTURE_MS; }
// Does record r beat cur? The later raw time wins, then the tie rule (tiePrefersR). Third review NEW-1: a clamp that
// moves with the clock let a skewed record overtake the change that replaced it an hour later; a raw order never does.
function doorRulesBeats(r, cur, nowMs, tiePrefersR) {
  const a = Date.parse(r.at), b = Date.parse(cur.at);
  if (a !== b) return a > b;
  return !!tiePrefersR;
}
// The time for a change to a record last stamped prevAt: now, or 1 ms after prevAt (unclamped) if this clock is behind
// it, so the change orders after the record it replaces wherever and whenever the merge runs.
// Never throws (fourth review P3-3): at the largest date a JavaScript time can hold it stays there, so the change ties
// with the record it replaces, and the action's own check says "It did not take" when the tie rule keeps the record.
var DOOR_RULES_MAX_MS = 8.64e15;
function doorRulesNextAt(prevAt, nowMs) {
  const now = doorRulesNowMs(nowMs);
  const prev = Date.parse(prevAt || '');
  const ms = Number.isFinite(prev) && prev >= now ? Math.min(prev + 1, DOOR_RULES_MAX_MS) : Math.min(now, DOOR_RULES_MAX_MS);
  return new Date(ms).toISOString();
}
// Compare two canonical times by their value, not their text ("+010000-…" sorts before "2026-…" as text).
function doorRulesTimeCmp(a, b) { const x = Date.parse(a || ''), y = Date.parse(b || ''); return (Number.isFinite(x) ? x : -Infinity) - (Number.isFinite(y) ? y : -Infinity); }
// Fields this build doesn't know, inside a record or at the top level, are carried as they are (second review N1).
var DOOR_RULES_NOT_COPIED = ['__proto__', 'constructor', 'prototype'];
function doorRulesUnknown(src, known) {
  const out = {};
  Object.keys(src || {}).forEach(k => {
    if (known.indexOf(k) >= 0 || DOOR_RULES_NOT_COPIED.indexOf(k) >= 0 || src[k] === undefined) return;
    out[k] = JSON.parse(JSON.stringify(src[k]));
  });
  return out;
}
var DOOR_RULES_TOP_KEYS = ['_meta', 'leads', 'additions', 'log', '_foreign', '_foreignLeads', '_foreignLog', '_metaExtra'];
var DOOR_RULES_META_KEYS = ['version', 'exported', 'site'];
// A file's version (1 when it says none). Anything but the number DOOR_RULES_VERSION (a newer DOOR, or a version
// that isn't a number: true, "1") is refused (third review P3-d).
function doorRulesFileVersion(raw) {
  const v = raw && raw._meta && raw._meta.version;
  return v === undefined || v === null ? 1 : v;
}
function doorRulesNewerFile(raw) { return doorRulesFileVersion(raw) !== DOOR_RULES_VERSION; }
// Only well-formed records are read. A leads record counts only when Jason made it. Everything else rides along
// verbatim and is never read: a record this build can't read (an addition on a list it doesn't know, a word with a
// digit, a non-canonical time: _foreign; a lead or log record likewise: _foreignLeads, _foreignLog; third review
// P3-a), unknown fields inside a record (kept on it), in _meta (_metaExtra) and at the top level.
function doorRulesClean(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const copy = v => JSON.parse(JSON.stringify(v));
  const carried = k => (Array.isArray(src[k]) ? copy(src[k]) : []);
  const additions = [], foreign = carried('_foreign'), foreignLeads = carried('_foreignLeads'), foreignLog = carried('_foreignLog');
  (Array.isArray(src.additions) ? src.additions : []).forEach(r => {
    if (!r || typeof r !== 'object') { if (r !== undefined) foreign.push(copy(r)); return; }
    if (doorRulesWordProblem(r.list, r.word) || typeof r.target !== 'string' || !r.target || r.target.length > 40
      || typeof r.by !== 'string' || !doorRulesIsTime(r.at)) { foreign.push(copy(r)); return; }
    const o = Object.assign(doorRulesUnknown(r, ['list', 'word', 'target', 'by', 'at', 'takenBack']),
      { list: r.list, word: doorRulesNormWord(r.word), target: r.target, by: String(r.by).slice(0, 60), at: r.at });
    if (r.takenBack === true) o.takenBack = true;
    additions.push(o);
  });
  const leadOk = r => r && typeof r === 'object'
    && typeof r.name === 'string' && doorRulesNormName(r.name) && doorRulesNormName(r.name).length <= 60
    && typeof r.on === 'boolean' && doorRulesNormName(r.by) === doorRulesNormName(DOOR_RULES_OWNER) && doorRulesIsTime(r.at);
  const srcLeads = Array.isArray(src.leads) ? src.leads : [];
  srcLeads.forEach(r => { if (!leadOk(r) && r !== undefined) foreignLeads.push(copy(r)); });
  const leads = srcLeads.filter(leadOk)
    .map(r => Object.assign(doorRulesUnknown(r, ['name', 'on', 'by', 'at']), { name: r.name.trim().replace(/\s+/g, ' '), on: r.on, by: r.by, at: r.at }));
  const logOk = r => r && typeof r === 'object' && doorRulesIsTime(r.at) && typeof r.by === 'string' && typeof r.what === 'string';
  const srcLog = Array.isArray(src.log) ? src.log : [];
  srcLog.forEach(r => { if (!logOk(r) && r !== undefined) foreignLog.push(copy(r)); });
  const log = srcLog.filter(logOk)
    .map(r => {
      const o = Object.assign(doorRulesUnknown(r, ['at', 'by', 'what', 'word', 'target', 'name', 'list']),
        { at: r.at, by: String(r.by).slice(0, 60), what: String(r.what).slice(0, 40) });
      ['word', 'target', 'name', 'list'].forEach(k => { if (typeof r[k] === 'string') o[k] = r[k].slice(0, 60); });
      return o;
    });
  const out = Object.assign(doorRulesUnknown(src, DOOR_RULES_TOP_KEYS), { leads, additions, log });
  if (foreign.length) out._foreign = foreign;
  if (foreignLeads.length) out._foreignLeads = foreignLeads;
  if (foreignLog.length) out._foreignLog = foreignLog;
  const metaExtra = Object.assign({}, src._metaExtra && typeof src._metaExtra === 'object' ? doorRulesUnknown(src._metaExtra, []) : {},
    src._meta && typeof src._meta === 'object' ? doorRulesUnknown(src._meta, DOOR_RULES_META_KEYS) : {});
  if (Object.keys(metaExtra).length) out._metaExtra = metaExtra;
  return out;
}
function doorRulesExtraKeys(src) {
  return Object.keys(src || {}).filter(k => DOOR_RULES_TOP_KEYS.indexOf(k) < 0 && DOOR_RULES_NOT_COPIED.indexOf(k) < 0 && src[k] !== undefined);
}
// Two copies → one. Per word (list + word) the newer record wins, and on a tie an added word beats a take-back (it only
// adds a warning). Per lead name the newer record wins, and on a tie the lead is off. The log is the union, newest
// first. Everything this build doesn't know (unknown top-level fields, _meta fields, additions on unknown lists) comes
// verbatim from the kitchen copy when b is one (opts.kitchen): this computer can never have edited them, so a
// timestamp never decides them, and a field the kitchen dropped stays dropped. Otherwise a's are kept, then b's.
function doorRulesMerge(a, b, nowMs, opts) {
  const A = doorRulesClean(a), B = doorRulesClean(b);
  const kitchen = !!(opts && opts.kitchen);
  const adds = {};
  A.additions.concat(B.additions).forEach(r => {
    const k = doorRulesKey(r), cur = adds[k];
    if (!cur || doorRulesBeats(r, cur, nowMs, cur.takenBack && !r.takenBack)) adds[k] = r;
  });
  const leads = {};
  A.leads.concat(B.leads).forEach(r => {
    const k = doorRulesNormName(r.name), cur = leads[k];
    if (!cur || doorRulesBeats(r, cur, nowMs, cur.on && !r.on)) leads[k] = r;
  });
  const seen = new Set();
  const logKey = e => [e.at, e.by, e.what, e.list || '', e.word || '', e.name || '', e.target || ''].join('|');
  const log = A.log.concat(B.log).filter(e => {
    const k = logKey(e);
    if (seen.has(k)) return false; seen.add(k); return true;
  }).sort((x, y) => { const t = doorRulesTimeCmp(y.at, x.at); if (t) return t; const a = logKey(x), b = logKey(y); return a < b ? 1 : a > b ? -1 : 0; }).slice(0, DOOR_RULES_LOG_MAX);
  const byKey = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const unknownOf = s => { const o = {}; doorRulesExtraKeys(s).forEach(k => { o[k] = s[k]; }); ['_foreign', '_foreignLeads', '_foreignLog', '_metaExtra'].forEach(k => { if (s[k]) o[k] = s[k]; }); return o; };
  const carried = kitchen ? unknownOf(B) : Object.assign({}, unknownOf(B), unknownOf(A));
  return Object.assign(carried, {
    leads: Object.keys(leads).sort(byKey).map(k => leads[k]),
    additions: Object.keys(adds).sort(byKey).map(k => adds[k]),
    log
  });
}
// The words in force on one list. allowed (optional): the targets DOOR knows for it; anything else is ignored, so a
// hand-written file can never point a word at a flag that takes protection away.
function doorRulesActive(rules, list, allowed) {
  return doorRulesClean(rules).additions.filter(r => r.list === list && !r.takenBack && (!allowed || allowed.indexOf(r.target) >= 0));
}
function doorRulesIsLead(rules, name) {
  const n = doorRulesNormName(name);
  if (!n) return false;
  if (n === doorRulesNormName(DOOR_RULES_OWNER)) return true;
  const rec = doorRulesMerge(rules, {}).leads.find(r => doorRulesNormName(r.name) === n);
  return !!(rec && rec.on);
}
function doorRulesLeadNames(rules) {
  return [DOOR_RULES_OWNER].concat(doorRulesMerge(rules, {}).leads.filter(r => r.on && doorRulesNormName(r.name) !== doorRulesNormName(DOOR_RULES_OWNER)).map(r => r.name));
}
// The active records (words in force and leads on), as keys: 'list|word' and 'lead|name'.
function doorRulesActiveKeys(rules) {
  const r = doorRulesMerge(rules, {});
  return r.additions.filter(x => !x.takenBack).map(x => doorRulesKey(x)).concat(r.leads.filter(x => x.on).map(x => 'lead|' + doorRulesNormName(x.name)));
}
// The kitchen copy's active records a send would drop (second review N2). A drop is allowed only when the record that
// replaces it is one of this computer's own unsent changes (unsent: [{ key, at }]). → the dropped keys.
function doorRulesDrops(kitchen, staged, unsent) {
  const K = doorRulesActiveKeys(kitchen), S = new Set(doorRulesActiveKeys(staged));
  const st = doorRulesMerge(staged, {});
  const own = new Set((unsent || []).map(u => u.key + '@' + u.at));
  return K.filter(k => {
    if (S.has(k)) return false;
    const rec = k.indexOf('lead|') === 0 ? st.leads.find(x => 'lead|' + doorRulesNormName(x.name) === k) : st.additions.find(x => doorRulesKey(x) === k);
    return !(rec && own.has(k + '@' + rec.at));
  });
}
// Records stamped more than a day ahead of this clock (a computer has the wrong date).
function doorRulesSkewedCount(rules, nowMs) {
  const r = doorRulesClean(rules);
  return r.additions.concat(r.leads).filter(x => doorRulesSkewed(x.at, nowMs)).length;
}
// Who may edit: a sending connection key AND a name on the leads list; only Jason changes the leads list. This guards
// against mistakes; the connection key is the real lock. inp: { hasSendingKey, operator, rules } →
// { canEdit, canEditLeads, why }.
function doorRulesWho(inp) {
  const o = inp || {};
  const name = String(o.operator || '').trim();
  const no = (why) => ({ canEdit: false, canEditLeads: false, why });
  if (!o.hasSendingKey) return no('Read-only on this computer: it has no sending connection key.');
  if (!name) return no('Read-only on this computer: type your name in Settings (Your name). Only the leads below can add words.');
  if (!doorRulesIsLead(o.rules, name)) return no('Read-only for ' + name + ': that name is not on the leads list. Jason can add it.');
  return { canEdit: true, canEditLeads: doorRulesNormName(name) === doorRulesNormName(DOOR_RULES_OWNER), why: '' };
}
// Edit distance (insert, delete, change one letter).
function doorRulesEditDistance(a, b) {
  a = String(a || ''); b = String(b || '');
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// A spelling of the target, not another word: the same first letter, one letter apart for a word of 6 letters or
// fewer, else up to a third of the word (second review N5: korma → kofta and satay → salad are two letters apart).
function doorRulesNearSpelling(word, target) {
  const w = doorRulesNormWord(word), t = doorRulesNormWord(target);
  if (!w || !t || w === t || w[0] !== t[0]) return false;
  const len = Math.max(w.length, t.length);
  return doorRulesEditDistance(w, t) <= (len <= 6 ? 1 : Math.max(2, Math.floor(len / 3)));
}
// The Rex spelling rules beyond the word list's own: a near-spelling, and neither word means an allergen or a meat
// (ctx.flagsOf(word) → the flags DOOR's built-in readers find in it). A spelling that read "shrimp" as "chicken" would
// make Rex's sheet keep a chicken dish and its ticks for a shrimp one (review P1-1). '' or why not.
function doorRulesRexProblem(word, target, ctx) {
  const c = ctx || {};
  if (!doorRulesNearSpelling(word, target)) return 'A spelling must be a slip of the word it reads as (the same first letter, one letter apart in a short word).';
  const fw = typeof c.flagsOf === 'function' ? c.flagsOf(word) : [];
  const ft = typeof c.flagsOf === 'function' ? c.flagsOf(target) : [];
  if (fw.length) return '“' + doorRulesNormWord(word) + '” names an allergen or a meat (' + fw.join(', ') + '). Only a plain spelling can be added.';
  if (ft.length) return '“' + doorRulesNormWord(target) + '” names an allergen or a meat (' + ft.join(', ') + '). Only a plain spelling can be added.';
  return '';
}
// May this word be added? ctx: { targets: [...known targets for the list], builtIn(list, word) → '' or what DOOR already
// reads it as, flagsOf(word) → [flags] (Rex) }. → { ok:true, word, target } | { ok:false, code, why }.
function doorRulesCheck(rules, list, word, target, ctx) {
  const c = ctx || {};
  const bad = (code, why) => ({ ok: false, code, why });
  const problem = doorRulesWordProblem(list, word);
  if (problem === 'list') return bad('list', 'DOOR has no such word list.');
  if (problem === 'empty') return bad('empty', 'Type a word first.');
  if (problem === 'length') return bad('length', 'A word is 3 to 40 letters long.');
  if (problem === 'characters') return bad('characters', list === 'rexSpelling'
    ? 'A spelling is one word of letters only.'
    : 'Use letters, spaces, a hyphen or an apostrophe only.');
  const w = doorRulesNormWord(word);
  const t = typeof target === 'string' ? target : '';
  const already = typeof c.builtIn === 'function' ? c.builtIn(list, w) : '';
  if (already) return bad('built-in', 'DOOR already reads “' + w + '” (' + already + '). A built-in word changes only in code.');
  if (!t || !(c.targets || []).some(x => x === t)) return bad('target', list === 'rexSpelling'
    ? 'Pick a word DOOR already uses on its menu or recipes.'
    : 'Pick what the word means from the list.');
  if (list === 'rexSpelling' && w === t) return bad('same', 'The spelling and the word it reads as are the same.');
  if (list === 'rexSpelling') { const rp = doorRulesRexProblem(w, t, c); if (rp) return bad('spelling', rp); }
  const active = doorRulesActive(rules, list);
  if (active.some(r => r.word === w)) return bad('added', '“' + w + '” is already added to this list.');
  if (list === 'rexSpelling' && active.some(r => r.word === t)) return bad('chain', '“' + t + '” is itself an added spelling. Pick the word it reads as.');
  if (list === 'rexSpelling' && active.some(r => r.target === w)) return bad('chain', 'Another added spelling reads as “' + w + '”.');
  return { ok: true, word: w, target: t };
}
function doorRulesAdd(rules, rec, nowMs) {
  const r = doorRulesClean(rules);
  const w = doorRulesNormWord(rec.word);
  const cur = r.additions.find(x => x.list === rec.list && x.word === w);
  const add = Object.assign(cur ? doorRulesUnknown(cur, ['list', 'word', 'target', 'by', 'at', 'takenBack']) : {},
    { list: rec.list, word: w, target: rec.target, by: rec.by, at: rec.at });
  return doorRulesMerge(r, { additions: [add], log: [{ at: rec.at, by: rec.by, what: 'added', list: add.list, word: add.word, target: add.target }] }, nowMs);
}
function doorRulesTakeBack(rules, list, word, by, at, nowMs) {
  const r = doorRulesClean(rules);
  const w = doorRulesNormWord(word);
  const cur = r.additions.find(x => x.list === list && x.word === w);
  if (!cur || cur.takenBack) return r;
  const rec = Object.assign(doorRulesUnknown(cur, ['list', 'word', 'target', 'by', 'at', 'takenBack']), { list, word: w, target: cur.target, by, at, takenBack: true });
  return doorRulesMerge(r, { additions: [rec], log: [{ at, by, what: 'took back', list, word: w, target: cur.target }] }, nowMs);
}
function doorRulesSetLead(rules, name, on, by, at, nowMs) {
  const r = doorRulesClean(rules);
  const cur = r.leads.find(x => doorRulesNormName(x.name) === doorRulesNormName(name));
  const rec = Object.assign(cur ? doorRulesUnknown(cur, ['name', 'on', 'by', 'at']) : {}, { name, on: !!on, by, at });
  return doorRulesMerge(r, { leads: [rec], log: [{ at, by, what: on ? 'lead added' : 'lead removed', name: String(name).trim() }] }, nowMs);
}
function doorRulesLastChangeAt(rules) {
  const r = doorRulesClean(rules);
  return r.additions.concat(r.leads).reduce((m, x) => (doorRulesTimeCmp(x.at, m) > 0 ? x.at : m), '');
}
// Records this build can't read and carries as they are (fourth review P3-1).
function doorRulesCarriedCount(rules) {
  const r = doorRulesClean(rules);
  return (r._foreign || []).length + (r._foreignLeads || []).length + (r._foreignLog || []).length;
}
function doorRulesHasContent(rules) {
  const r = doorRulesClean(rules);
  return !!(r.additions.length || r.leads.length || doorRulesExtraKeys(r).length || r._foreign || r._foreignLeads || r._foreignLog || r._metaExtra);
}
// The published file, with everything this build doesn't know put back where it was. exported is the newest change,
// not the send time, so an unchanged file reads unchanged.
function doorRulesFile(rules, site) {
  const r = doorRulesClean(rules);
  const file = {};
  doorRulesExtraKeys(r).forEach(k => { file[k] = r[k]; });
  file._meta = Object.assign({}, r._metaExtra || {}, { version: DOOR_RULES_VERSION, exported: doorRulesLastChangeAt(r) || null, site: site || 'rexdale' });
  file.leads = r.leads.concat(r._foreignLeads || []);
  file.additions = r.additions.concat(r._foreign || []);
  file.log = r.log.concat(r._foreignLog || []);
  return file;
}
// The dialog line for an addition.
function doorRulesSays(list, word, targetLabel) {
  const L = doorRulesHasList(list) ? DOOR_RULES_LISTS[list] : null;
  return L ? L.says.replace('{w}', doorRulesNormWord(word)).replace('{t}', targetLabel) : '';
}
// The meals a menu word has marked: the regular line or its sides names the word and the meal carries the flag (a
// workbook word is read from the workbook's allergen row, which the menu doesn't keep, so only its dish text is seen).
// Taking the word back leaves these marked (the published menu is every computer's base), so take-back names them.
function doorRulesMarkedMeals(menu, list, word, target) {
  const out = [];
  if (!menu || typeof menu !== 'object' || !(list === 'menuName' || list === 'workbookAllergen')) return out;
  const re = doorRulesWordRegex(word);
  Object.keys(menu).forEach(wk => {
    const days = menu[wk];
    if (wk === '_meta' || !days || typeof days !== 'object') return;
    Object.keys(days).forEach(day => {
      const d = days[day];
      if (!d || typeof d !== 'object') return;
      ['breakfast', 'lunch', 'dinner'].forEach(p => {
        const text = [d[p], d[p + '_sides']].filter(x => typeof x === 'string').join(' , ');
        if (text && re.test(text) && d[p + '_flags'] && d[p + '_flags'][target]) out.push({ week: wk, day, period: p });
      });
    });
  });
  return out;
}
// Where each resident sits before and after a change, compared per meal: before/after = { mealKey: { who: seat } },
// a seat being a plate's label, 'Regular' or 'Anaphylactic Alternative'. → { moves, blocked }: counts only, per meal and
// from → to. A move is blocked when it lands on Regular, leaves the resident with no plate, or leaves any plate other
// than Regular for one that is not the Anaphylactic Alternative: an added word may only seat a resident on more
// protection, never take them off a plate that protects one of their tags (review P2-2).
function doorRulesSeatMoves(before, after) {
  const count = {};
  Object.keys(before || {}).forEach(meal => {
    const b = before[meal] || {}, a = (after || {})[meal] || {};
    Object.keys(b).forEach(who => {
      const from = b[who], to = a[who] || 'no plate';
      if (from === to) return;
      const k = meal + '|' + from + '|' + to;
      count[k] = (count[k] || 0) + 1;
    });
  });
  const moves = Object.keys(count).sort().map(k => { const [meal, from, to] = k.split('|'); return { meal, from, to, n: count[k] }; });
  const blocked = moves.filter(m => m.to === 'Regular' || m.to === 'no plate' || (m.from !== 'Regular' && m.to !== 'Anaphylactic Alternative'));
  return { moves, blocked };
}
/* DOOR_TESTABLE_CORE_END door-rules */

// The shell: this computer's copy, the four readers' hooks, the kitchen file, and the Settings page.
var DOOR_RULES_KEY = 'concDoorRules';
var DOOR_RULES_UNSENT_KEY = 'concDoorRulesUnsent';   // this computer's own changes not yet in a landed commit
var DOOR_RULES_STATE_KEY = 'concDoorRulesKitchenState';   // why the kitchen copy could not be merged, if it couldn't
var DOOR_RULES_UNDO_KEY = 'concDoorRulesUndo';
var _doorRulesCompileError = '';
var _doorRulesCache = null;
var _doorRulesCompiled = null;
var _doorRulesSuspend = 0;   // > 0 while DOOR asks what its built-in words read
var _doorRulesTrial = null;  // { list, word, target } while Add dry-runs the plates
// Tags a restriction word may add: allergens, sensitivities and preferences. Not the plate-choosing words (halal,
// vegan, vegetarian, diabetic, low carb, soft) and not "other": those choose a plate rather than add a warning.
var DOOR_RULES_NOT_TAG_TARGETS = ['halal', 'vegan', 'vegetarian', 'diabetic', 'lowCarb', 'softMeals', 'other'];
// Flags a menu word may not set: the meats open the halal plate and the pork-day merges, which can move a resident off
// a plate that protects them (review P2-2), as Halal-Certified Meat and Carb-swap never were targets.
var DOOR_RULES_NOT_FLAG_TARGETS = ['hasPork', 'hasBeef', 'hasChicken', 'hasTurkey'];
function loadDoorRules() {
  if (_doorRulesCache) return _doorRulesCache;
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(DOOR_RULES_KEY) || 'null'); } catch (e) { raw = null; }
  _doorRulesCache = doorRulesClean(raw);
  return _doorRulesCache;
}
function saveDoorRules(rules) {
  _doorRulesCache = doorRulesClean(rules);
  _doorRulesCompiled = null;
  const json = JSON.stringify(_doorRulesCache);
  return typeof doorSetItemSafe === 'function' ? doorSetItemSafe(DOOR_RULES_KEY, json) : (localStorage.setItem(DOOR_RULES_KEY, json), true);
}
function doorRulesTargetsFor(list) {
  const L = doorRulesHasList(list) ? DOOR_RULES_LISTS[list] : null;
  if (!L) return [];
  if (L.kind === 'flag') return Object.keys(emptyMealFlags()).filter(k => (/^has/.test(k) || k === 'isSpicy') && DOOR_RULES_NOT_FLAG_TARGETS.indexOf(k) < 0);
  if (L.kind === 'tag') return Object.keys(TAG_LABELS_MAP).filter(k => DOOR_RULES_NOT_TAG_TARGETS.indexOf(k) < 0);
  return Array.from(doorRulesRexWords()).sort();
}
function doorRulesTargetLabel(list, t) {
  const L = doorRulesHasList(list) ? DOOR_RULES_LISTS[list] : {};
  if (L.kind === 'flag') { const f = (typeof FLAG_DEFS !== 'undefined' ? FLAG_DEFS : []).find(x => x.key === t); return f ? f.label : t; }
  if (L.kind === 'tag') return (typeof TAG_LABELS_MAP !== 'undefined' && Object.prototype.hasOwnProperty.call(TAG_LABELS_MAP, t) && TAG_LABELS_MAP[t]) || t;
  return t;
}
// The allergen and meat flags DOOR's built-in readers find in a word (dish name and allergen row).
function doorRulesFlagsOf(word) {
  const out = [];
  _doorRulesSuspend++;
  try {
    const add = f => Object.keys(f).forEach(k => { if (f[k] && (/^has/.test(k) || k === 'isSpicy') && out.indexOf(k) < 0) out.push(k); });
    add(nameDetectFlags(String(word || ''), emptyMealFlags()));
    add(allergenStrToFlags(String(word || ''), emptyMealFlags()));
  } catch (e) { out.push('unknown'); } finally { _doorRulesSuspend--; }
  return out.map(k => doorRulesTargetLabel('menuName', k));
}
function doorRulesCheckCtx(list, rexWords) {
  return { targets: doorRulesTargetsFor(list), builtIn: (l, w) => doorRulesBuiltIn(l, w, rexWords), flagsOf: doorRulesFlagsOf };
}
// The words in force, compiled once per change. Empty while DOOR asks what its built-in words read. Rex spellings are
// checked again here, so a spelling from a hand-written or older file that fails today's rules is never read.
function doorRulesCompiledFor(list) {
  if (_doorRulesSuspend > 0) return [];
  try {
    if (!_doorRulesCompiled) {
      const compiled = {};
      _doorRulesCompiled = compiled;
      const rules = loadDoorRules();
      let rexWords = null;
      Object.keys(DOOR_RULES_LISTS).forEach(l => {
        let recs;
        if (DOOR_RULES_LISTS[l].kind === 'spelling') {
          recs = doorRulesActive(rules, l);
          if (recs.length) {
            rexWords = rexWords || doorRulesRexWords();
            recs = recs.filter(r => !doorRulesBuiltIn(l, r.word, rexWords) && rexWords.has(r.target) && !doorRulesRexProblem(r.word, r.target, { flagsOf: doorRulesFlagsOf }));
          }
        } else recs = doorRulesActive(rules, l, doorRulesTargetsFor(l));
        compiled[l] = recs.map(r => ({ word: r.word, target: r.target, by: r.by, at: r.at, re: doorRulesWordRegex(r.word) }));
      });
    }
    _doorRulesCompileError = '';
    const base = _doorRulesCompiled[list] || [];
    // A dry run's trial word rides on top of the compiled words, so a trial never recompiles (third review P3-e).
    const t = _doorRulesTrial;
    if (t && t.list === list) {
      if (!t.compiled) t.compiled = { word: t.word, target: t.target, by: '', at: '', re: doorRulesWordRegex(t.word) };
      return base.concat([t.compiled]);
    }
    return base;
  } catch (e) {
    // Never swallowed (second review N8): the page says the added words are off, and the console has why.
    _doorRulesCompiled = null;
    _doorRulesCompileError = (e && e.message) || String(e);
    try { console.warn('[DOOR] added words are off:', e); } catch (e2) {}
    return [];
  }
}
// Menu dish names and workbook allergen rows: the flags the added words name in this text.
function doorRulesTextTargets(list, text) {
  const act = doorRulesCompiledFor(list);
  if (!act.length || !text) return [];
  const s = String(text), out = [];
  act.forEach(a => { if (a.re.test(s) && out.indexOf(a.target) < 0) out.push(a.target); });
  return out;
}
// Resident restrictions: an added word adds its tag. Never removes a tag, and the word stays a question for a person
// to confirm (review P2-3). → [{ word, tag, by, at }] for the import to show beside the row.
function doorRulesRestrictionRead(text, tags) {
  const act = doorRulesCompiledFor('restriction');
  const reads = [];
  act.forEach(a => { if (a.re.test(String(text || ''))) { tags[a.target] = true; reads.push({ word: a.word, tag: a.target, by: a.by, at: a.at }); } });
  return reads;
}
// The import's line beside a row a restriction word read.
function doorRulesAddedReadsHTML(reads) {
  if (!Array.isArray(reads) || !reads.length) return '';
  const when = t => { try { return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' }); } catch (e) { return ''; } };
  return reads.map(r => '<div class="door-rules-read" style="font-size:11px;color:#92400e;margin-top:3px;">“' + escapeHtml(r.word) + '” read as '
    + escapeHtml(doorRulesTargetLabel('restriction', r.tag)) + ' by an added word (' + escapeHtml(r.by || '') + (r.at ? ', ' + escapeHtml(when(r.at)) : '')
    + ') — check it before you add this change.</div>').join('');
}
// Rex's spellings: the word an added spelling reads as, or ''. Built-in spellings are read first (doorRexToken).
function doorRulesRexSpelling(w) {
  if (!w) return '';
  const hit = doorRulesCompiledFor('rexSpelling').find(a => a.word === w);
  return hit ? hit.target : '';
}
// The words DOOR's menu and recipe names use, as Rex's sheet is read (a spelling reads as one of these).
function doorRulesRexWords() {
  const set = new Set(Object.keys(REX_SYN).map(k => REX_SYN[k]));
  _doorRulesSuspend++;
  try {
    const add = s => { if (typeof s === 'string' && s) doorRexTokens(s).forEach(t => { if (/^[a-z]{3,}$/.test(t)) set.add(t); }); };
    const menu = (typeof getMenuData === 'function' ? getMenuData() : null) || {};
    Object.keys(menu).forEach(wk => {
      const days = menu[wk];
      if (wk === '_meta' || !days || typeof days !== 'object') return;
      Object.keys(days).forEach(day => {
        const d = days[day] || {};
        ['breakfast', 'lunch', 'dinner'].forEach(p => [d[p], d[p + '_veg'], d[p + '_sides']].forEach(add));
      });
    });
    (typeof DOOR_RECIPE_DATA !== 'undefined' && Array.isArray(DOOR_RECIPE_DATA) ? DOOR_RECIPE_DATA : []).forEach(r => add(r && r.recipeName));
  } catch (e) {} finally { _doorRulesSuspend--; }
  return set;
}
// What DOOR's built-in words already read this word as, or ''. Asked with the added words switched off.
function doorRulesBuiltIn(list, word, rexWords) {
  const w = doorRulesNormWord(word);
  const flagNames = f => Object.keys(f).filter(k => f[k] && (/^has/.test(k) || k === 'isSpicy')).map(k => doorRulesTargetLabel('menuName', k));
  _doorRulesSuspend++;
  try {
    if (list === 'menuName') { const on = flagNames(nameDetectFlags(w, emptyMealFlags())); return on.length ? 'as ' + on.join(', ') : ''; }
    if (list === 'workbookAllergen') { const on = flagNames(allergenStrToFlags(w, emptyMealFlags())); return on.length ? 'as ' + on.join(', ') : ''; }
    if (list === 'restriction') {
      for (const s of [w, 'No ' + w]) {
        const r = normalizeRestriction(s);
        const on = Object.keys(r.tags || {}).filter(k => r.tags[k]).map(k => doorRulesTargetLabel('restriction', k));
        if (on.length) return 'as ' + on.join(', ');
      }
      return '';
    }
    if (list === 'rexSpelling') {
      if (Object.prototype.hasOwnProperty.call(REX_SYN, w)) return 'as “' + REX_SYN[w] + '”';
      if (Object.keys(REX_SYN).some(k => REX_SYN[k] === w)) return 'as a word of its own';
      if (REX_STOP.has(w)) return 'as a joining word';
      if (REX_DISH_TYPES.has(w) || REX_MODIFIERS.has(w)) return 'as a word of its own';
      const tok = doorRexToken(w);
      if (tok !== w) return 'as “' + tok + '”';
      if ((rexWords || doorRulesRexWords()).has(w)) return 'as a word on its menu or recipes';
      return '';
    }
    return '';
  } catch (e) { return 'DOOR could not check it'; } finally { _doorRulesSuspend--; }
}
function doorRulesHasSendingKey() {
  try { return !!PublishAuth.getSavedToken() && !PublishAuth.isViewingKey() && !PublishAuth.isExpired(); } catch (e) { return false; }
}
function doorRulesWhoHere() {
  return doorRulesWho({ hasSendingKey: doorRulesHasSendingKey(), operator: (typeof getOperatorName === 'function' ? getOperatorName() : ''), rules: loadDoorRules() });
}
// The kitchen copy merged into this computer's: at boot, at each sync, and in each publish attempt (below).
// A file from a newer DOOR (its _meta.version above DOOR_RULES_VERSION) is refused out loud and never merged or sent
// over (second review N1). Everything this build doesn't know comes verbatim from the kitchen copy.
function doorApplyRemoteRules(remote) {
  if (!remote || typeof remote !== 'object' || Array.isArray(remote)) return loadDoorRules();
  if (doorRulesNewerFile(remote)) { doorRulesSetKitchenState({ reason: 'newer', version: doorRulesFileVersion(remote) }); doorRulesRepaint(); return loadDoorRules(); }
  const merged = doorRulesMerge(loadDoorRules(), remote, undefined, { kitchen: true });
  saveDoorRules(merged);
  if (doorRulesKitchenState().reason === 'newer') doorRulesSetKitchenState(null);
  if (typeof document !== 'undefined' && document.getElementById && document.getElementById('door-rules-body')) { try { renderDoorRulesPage(); } catch (e) {} }
  return merged;
}
async function doorPullRules() {
  try {
    const repo = (typeof PublishAuth !== 'undefined' && PublishAuth.getRepo && PublishAuth.getRepo()) || 'kennedyjasondavid-eng/conc-kitchen-door';
    const r = await doorReadKitchenFile(DOOR_RULES_FILE, { repo, timeoutMs: 6000 });
    if (r.ok) return doorApplyRemoteRules(r.data);
  } catch (e) {}
  return loadDoorRules();
}
// In each publish attempt (review P2-4): the kitchen's door_rules.json at the revision this attempt commits on, merged
// in before anything is built. A retry after a conflict reads it again, so another computer's words are never
// overwritten by an older copy. → true when this computer's copy may be sent (merged, or none in the kitchen).
// It refuses (false, with the reason kept for the page: second review N7) when the kitchen copy can't be read, is from
// a newer DOOR, or holds words or leads this computer's copy would drop that this computer did not take back itself
// (N2). A refusal sends nothing of this computer's rules; the rest of the publish goes ahead.
async function doorPublishMergeRules(creds, revision) {
  if (!revision || !revision.paths || !revision.paths[DOOR_RULES_FILE]) { doorRulesSetKitchenState(null); return true; }
  let value;
  try {
    const body = await doorPublishReadJSON(creds, '/contents/' + DOOR_RULES_FILE + '?ref=' + encodeURIComponent(revision.head));
    if (!body || typeof body.content !== 'string') throw new Error('no content');
    value = JSON.parse(decodeURIComponent(escape(atob(body.content.replace(/\n/g, '')))));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not a rules file');
  } catch (e) { doorRulesSetKitchenState({ reason: 'unreadable', detail: (e && e.message) || String(e) }); doorRulesRepaint(); return false; }
  if (doorRulesNewerFile(value)) { doorRulesSetKitchenState({ reason: 'newer', version: doorRulesFileVersion(value) }); doorRulesRepaint(); return false; }
  doorApplyRemoteRules(value);
  const drops = doorRulesDrops(value, loadDoorRules(), doorRulesUnsent());
  if (drops.length) { doorRulesSetKitchenState({ reason: 'drops', keys: drops.slice(0, 12) }); doorRulesRepaint(); return false; }
  doorRulesSetKitchenState(null);
  return true;
}
// One line for wherever a publish result shows (third review P3-c), or '' when the kitchen copy merged.
// Fourth review P3-2: it says only what is true. With changes of its own waiting it says they weren't sent;
// otherwise that the kitchen's file can't be updated from here.
function doorRulesBlockedLine() {
  const ks = doorRulesKitchenState();
  const why = ks.reason === 'newer' ? 'the kitchen’s rules file is from a newer DOOR. Reload DOOR.'
    : ks.reason === 'unreadable' ? 'the kitchen’s rules file can’t be read. Ask Jason.'
    : ks.reason === 'drops' ? 'this computer’s copy would drop words the kitchen has. Ask Jason.' : '';
  if (!why) return '';
  const n = doorRulesUnsent().length;
  return n ? 'This computer’s ' + n + ' allergen-word change' + (n === 1 ? '' : 's') + ' weren’t sent: ' + why
    : 'The kitchen’s allergen-word file can’t be updated from this computer: ' + why;
}
function doorRulesKitchenState() { try { const s = JSON.parse(localStorage.getItem(DOOR_RULES_STATE_KEY) || 'null'); return s && typeof s === 'object' ? s : {}; } catch (e) { return {}; } }
function doorRulesSetKitchenState(s) { try { if (s) localStorage.setItem(DOOR_RULES_STATE_KEY, JSON.stringify(Object.assign({ at: new Date().toISOString() }, s))); else localStorage.removeItem(DOOR_RULES_STATE_KEY); } catch (e) {} }
function doorRulesRepaint() { if (typeof document !== 'undefined' && document.getElementById && document.getElementById('door-rules-body')) { try { renderDoorRulesPage(); } catch (e) {} } }
// This computer's own changes not yet in a landed commit (second review N6): a change pulled from the kitchen is
// never "not sent". [{ key, at }], key 'list|word' or 'lead|name'.
function doorRulesUnsent() { try { const u = JSON.parse(localStorage.getItem(DOOR_RULES_UNSENT_KEY) || '[]'); return Array.isArray(u) ? u.filter(x => x && typeof x.key === 'string' && typeof x.at === 'string') : []; } catch (e) { return []; } }
function doorRulesNoteOwn(key, at) {
  const u = doorRulesUnsent().filter(x => x.key !== key).concat([{ key, at }]).slice(-200);
  try { localStorage.setItem(DOOR_RULES_UNSENT_KEY, JSON.stringify(u)); } catch (e) {}
}
function doorRulesNotSent() { return doorRulesUnsent().length > 0; }
// After the commit that carried `file` lands: each own change in it is sent; a newer own change stays unsent.
function doorRulesNoteSent(file) {
  if (!file || typeof file !== 'object') return;
  const f = doorRulesMerge(file, {});
  const has = new Set(f.additions.map(x => doorRulesKey(x) + '@' + x.at).concat(f.leads.map(x => 'lead|' + doorRulesNormName(x.name) + '@' + x.at)));
  const left = doorRulesUnsent().filter(x => !has.has(x.key + '@' + x.at));
  try { localStorage.setItem(DOOR_RULES_UNSENT_KEY, JSON.stringify(left)); } catch (e) {}
}
function doorRulesSetUndo(u) { try { if (u) localStorage.setItem(DOOR_RULES_UNDO_KEY, JSON.stringify(u)); else localStorage.removeItem(DOOR_RULES_UNDO_KEY); } catch (e) {} }
function doorRulesGetUndo() { try { const u = JSON.parse(localStorage.getItem(DOOR_RULES_UNDO_KEY) || 'null'); return u && typeof u === 'object' ? u : null; } catch (e) { return null; } }
function doorRulesChanged(msg) {
  if (typeof showToast === 'function' && msg) showToast(msg);
  try { renderDoorRulesPage(); } catch (e) {}
  if (typeof renderMenuConfig === 'function') { try { renderMenuConfig(); } catch (e) {} }
}
function doorRulesMsg(list, text, html) {
  const el = typeof document !== 'undefined' && document.getElementById ? document.getElementById('door-rules-msg-' + list) : null;
  if (!el) return;
  if (html) el.innerHTML = html; else el.textContent = text || '';
}
// The time for a change to the record a list + word (or a lead name) holds now.
function doorRulesStampFor(list, word, leadName) {
  const r = loadDoorRules();
  const cur = leadName
    ? r.leads.filter(x => doorRulesNormName(x.name) === doorRulesNormName(leadName)).map(x => x.at).sort().pop()
    : (r.additions.find(x => x.list === list && x.word === doorRulesNormWord(word)) || {}).at;
  return doorRulesNextAt(cur || '');
}
function doorRulesMealLabel(m) { return 'Wk' + m.week + ' ' + String(m.day).slice(0, 3) + ' ' + m.period; }
var DOOR_RULES_PERIODS = ['breakfast', 'lunch', 'dinner'];   // every meal the plating sheet routes (second review N3)
// Every resident's seat at every meal, as the plating sheet seats them.
function doorRulesSeatsByMeal() {
  const out = {};
  const menu = getMenuData() || {};
  Object.keys(menu).forEach(wk => {
    if (wk === '_meta' || !menu[wk] || typeof menu[wk] !== 'object') return;
    Object.keys(menu[wk]).forEach(day => DOOR_RULES_PERIODS.forEach(p => {
      const pd = computePlatingData(p, wk, day);
      if (!pd) return;
      const seats = {};
      (pd.sections || []).forEach(s => (s.residents || []).forEach(r => { seats[r.room] = s.rule.key === 'regular' ? 'Regular' : s.rule.label; }));
      (pd.anaphSect || []).forEach(r => { seats[r.room] = 'Anaphylactic Alternative'; });
      out[doorRulesMealLabel({ week: wk, day, period: p })] = seats;
    }));
  });
  return out;
}
// A resident's restriction as the import last read it: rawRestriction when it holds the list's own words, else the
// words a Needs Review answer kept (learned_nr _resolved_text). '' when this computer only holds DOOR's labels for them
// (Enter Changes and the intake portal write the labels back), so a dry run can't see their original words.
function doorRulesImportText(r) {
  const raw = String((r && r.rawRestriction) || '').trim();
  const labels = new Set(Object.keys(typeof TAG_LABELS_MAP !== 'undefined' ? TAG_LABELS_MAP : {}).map(k => String(TAG_LABELS_MAP[k]).toLowerCase()).concat(['regular']));
  const onlyLabels = !raw || raw.split(/\s*[,;]\s*/).filter(Boolean).every(p => labels.has(p.toLowerCase()));
  if (!onlyLabels) return raw;
  try {
    const L = JSON.parse(localStorage.getItem('concLearnedNR') || '{}')[String((r && r.room) || '').toLowerCase()];
    if (L && typeof L._resolved_text === 'string' && L._resolved_text.trim()) return L._resolved_text;
  } catch (e) {}
  return '';
}
// What a new word would do to the plates on today's menu and resident list (review P2-2, second review N3). A dish word
// dry-runs the plating engine on every meal (breakfast, lunch, dinner) with the word in force. A restriction word reads
// each resident's restriction as the import would, with and without the word, and re-seats those who gain a tag.
// → { moves, blocked, checked, unseen } (counts only), or { error } when the check cannot run.
function doorRulesDryRun(list, word, target) {
  if (list !== 'menuName' && list !== 'restriction') return { moves: [], blocked: [], checked: 0, unseen: 0 };
  const trialWord = { list, word: doorRulesNormWord(word), target };
  const trial = (fn) => { _doorRulesTrial = trialWord; try { return fn(); } finally { _doorRulesTrial = null; } };
  try {
    if (list === 'menuName') {
      const before = doorRulesSeatsByMeal();
      const after = trial(doorRulesSeatsByMeal);
      return Object.assign(doorRulesSeatMoves(before, after), { checked: Object.keys(before).length, unseen: 0 });
    }
    const label = doorRulesTargetLabel('restriction', target);
    const reg = typeof REGISTRY_LIST !== 'undefined' ? REGISTRY_LIST : [];
    let unseen = 0, checked = 0;
    const who = [];
    reg.forEach(r => {
      const text = doorRulesImportText(r);
      if (!text) { unseen++; return; }
      checked++;
      const without = normalizeRestriction(text).tags || {};
      const withW = trial(() => normalizeRestriction(text).tags || {});
      const gained = Object.keys(withW).filter(k => withW[k] && !without[k]).map(k => doorRulesTargetLabel('restriction', k)).filter(l => !(r.tags || []).includes(l));
      if (gained.length) who.push({ r, gained });
    });
    const before = {}, after = {};
    if (who.length) {
      const menu = getMenuData() || {};
      Object.keys(menu).forEach(wk => {
        if (wk === '_meta' || !menu[wk] || typeof menu[wk] !== 'object') return;
        Object.keys(menu[wk]).forEach(day => DOOR_RULES_PERIODS.forEach(p => {
          const pd = computePlatingData(p, wk, day);
          if (!pd || !pd.mealFlags) return;
          const key = doorRulesMealLabel({ week: wk, day, period: p });
          before[key] = {}; after[key] = {};
          who.forEach((w, i) => {
            const seat = (res) => { const s = computeSections({ ...pd.mealFlags }, [res]).find(x => x.residents.length); return !s ? '' : s.rule.key === 'regular' ? 'Regular' : s.rule.label; };
            before[key][i] = seat({ ...w.r, tags: (w.r.tags || []).slice() }) || 'Regular';
            after[key][i] = seat({ ...w.r, tags: (w.r.tags || []).concat(w.gained) });
          });
        }));
      });
    }
    return Object.assign(doorRulesSeatMoves(before, after), { checked, unseen, label });
  } catch (e) { return { error: (e && e.message) || String(e) }; }
}
// The DOOR dishes (menu pieces and recipe names) that name a Rex spelling's target, for the question (second review N5).
// A spelling can't make two DOOR dishes the same: its word is on no DOOR dish (doorRulesBuiltIn refuses a menu or
// recipe word), so the tighter distance rule is the protection (third review P3-b). → { names }.
function doorRulesRexDishes(word, target) {
  const dishes = new Set();
  const menu = (typeof getMenuData === 'function' ? getMenuData() : null) || {};
  Object.keys(menu).forEach(wk => {
    if (wk === '_meta' || !menu[wk] || typeof menu[wk] !== 'object') return;
    Object.keys(menu[wk]).forEach(day => { const d = menu[wk][day] || {}; DOOR_RULES_PERIODS.forEach(p => [d[p], d[p + '_veg'], d[p + '_sides']].forEach(s => {
      if (typeof s === 'string') s.split(/\s*,\s*/).filter(Boolean).forEach(x => dishes.add(x.trim()));
    })); });
  });
  (typeof DOOR_RECIPE_DATA !== 'undefined' && Array.isArray(DOOR_RECIPE_DATA) ? DOOR_RECIPE_DATA : []).forEach(r => { if (r && r.recipeName) dishes.add(r.recipeName); });
  const w = doorRulesNormWord(word), t = doorRulesNormWord(target);
  _doorRulesSuspend++;
  let cands;
  try { cands = Array.from(dishes).filter(d => doorRexTokens(d).indexOf(t) >= 0); } finally { _doorRulesSuspend--; }
  return { names: cands.sort().slice(0, 12) };
}
function doorRulesMovesLines(moves) {
  return moves.slice(0, 12).map(m => m.meal + ': ' + m.n + ' resident' + (m.n === 1 ? '' : 's') + ' from ' + m.from + ' to ' + m.to)
    .concat(moves.length > 12 ? ['and ' + (moves.length - 12) + ' more'] : []);
}
async function doorRulesAddWord(list) {
  if (!doorRulesHasList(list)) return;
  let who = doorRulesWhoHere();
  if (!who.canEdit) { doorRulesMsg(list, who.why); return; }
  const wordEl = document.getElementById('door-rules-word-' + list), targetEl = document.getElementById('door-rules-target-' + list);
  const word = wordEl ? wordEl.value : '';
  let target = targetEl ? targetEl.value : '';
  if (list === 'rexSpelling') target = doorRulesNormWord(target);
  const ctx = doorRulesCheckCtx(list);
  let chk = doorRulesCheck(loadDoorRules(), list, word, target, ctx);
  if (!chk.ok) { doorRulesMsg(list, chk.why); return; }
  const dry = doorRulesDryRun(list, chk.word, chk.target);
  if (dry.error) { doorRulesMsg(list, 'DOOR could not check what this word does to the plates, so nothing was added. Try again, or ask Jason.'); return; }
  if (dry.blocked.length) {
    doorRulesMsg(list, 'Not added: it would move residents off a plate that protects them (' + doorRulesMovesLines(dry.blocked).join('; ') + '). A change like this is Jason’s, in code.');
    return;
  }
  const label = doorRulesTargetLabel(list, chk.target);
  const lines = [DOOR_RULES_LISTS[list].label + '.', doorRulesSays(list, chk.word, label)];
  let items = doorRulesMovesLines(dry.moves);
  // Say only what was checked (second review N3).
  if (list === 'menuName') {
    lines.push(dry.moves.length ? 'Plates that change on today’s menu (each onto more protection):' : 'Checked today’s menu, every breakfast, lunch and dinner: no resident’s plate changes.');
    lines.push('Not checked: dishes added to the menu later, and the halal line, swaps and special meals (an added word doesn’t read them).');
  }
  if (list === 'restriction') {
    lines.push(dry.moves.length ? 'Plates that change for residents whose restriction words this computer holds (each onto more protection):'
      : 'Checked ' + dry.checked + ' resident' + (dry.checked === 1 ? '' : 's') + '’ restriction words: no plate changes.');
    if (dry.unseen) lines.push('Not checked: ' + dry.unseen + ' resident' + (dry.unseen === 1 ? '' : 's') + ' whose record holds only DOOR’s labels, so this computer can’t see their original words. Their next import shows each row the word reads for a person to check.');
    lines.push('It is read at the next resident list import, where each row it reads is shown for a person to check.');
  }
  if (list === 'workbookAllergen') lines.push('Not checked: it is read at the next menu workbook import, and the workbook’s allergen rows aren’t kept, so nothing can be checked now.');
  if (list === 'rexSpelling') {
    const rd = doorRulesRexDishes(chk.word, chk.target);
    lines.push(rd.names.length ? 'Rex’s dishes naming “' + chk.word + '” will match these DOOR dishes:' : 'No DOOR dish names “' + chk.target + '” today.');
    items = rd.names;
  }
  lines.push('It only adds: nothing DOOR reads today is taken away. It goes to the other DOOR computers with the next send to the kitchen.');
  const ok = await doorAsk({ title: 'Add “' + chk.word + '”?', lines, items, cancelLabel: 'Go back', goLabel: 'Add the word' });
  if (!ok) return;
  // Read again after the question: the kitchen copy may have arrived while it was open.
  who = doorRulesWhoHere();
  if (!who.canEdit) { doorRulesMsg(list, who.why); return; }
  chk = doorRulesCheck(loadDoorRules(), list, word, target, doorRulesCheckCtx(list));
  if (!chk.ok) { doorRulesMsg(list, chk.why); return; }
  const by = getOperatorName(), at = doorRulesStampFor(list, chk.word);
  if (!saveDoorRules(doorRulesAdd(loadDoorRules(), { list, word: chk.word, target: chk.target, by, at }))) { doorRulesMsg(list, 'This computer could not save it (storage is full).'); return; }
  if (!doorRulesActive(loadDoorRules(), list).some(r => r.word === chk.word && r.at === at)) { doorRulesMsg(list, 'It did not take: a newer record for “' + chk.word + '” is on this computer. Nothing changed.'); return; }
  doorRulesNoteOwn(list + '|' + chk.word, at);
  doorRulesSetUndo({ kind: 'add', list, word: chk.word, target: chk.target, at });
  if (wordEl) wordEl.value = '';
  doorRulesChanged('Added “' + chk.word + '”. It goes to the kitchen with the next send.');
}
// What a take-back leaves behind (review P2-1): the meals the word already marked (the published menu is every
// computer's base, so they stay marked) and how many residents already carry the tag from an import. Counts only.
function doorRulesTakeBackImpact(list, word, target) {
  const meals = (list === 'menuName' || list === 'workbookAllergen') ? doorRulesMarkedMeals(getMenuData() || {}, list, word, target) : [];
  let residents = 0;
  if (list === 'restriction' && typeof REGISTRY_LIST !== 'undefined') {
    const re = doorRulesWordRegex(word), label = doorRulesTargetLabel('restriction', target);
    residents = REGISTRY_LIST.filter(r => re.test(String(r.rawRestriction || '')) && (r.tags || []).includes(label)).length;
  }
  return { meals, residents };
}
async function doorRulesTakeBackWord(list, word) {
  if (!doorRulesHasList(list)) return;
  const who = doorRulesWhoHere();
  if (!who.canEdit) { doorRulesMsg(list, who.why); return; }
  const w = doorRulesNormWord(word);
  const cur = doorRulesActive(loadDoorRules(), list).find(r => r.word === w);
  if (!cur) return;
  const label = doorRulesTargetLabel(list, cur.target);
  const imp = doorRulesTakeBackImpact(list, w, cur.target);
  const lines = ['From now on, ' + DOOR_RULES_LISTS[list].reads + ' naming “' + w + '” is no longer read as ' + label + ' because of this word.'];
  if (imp.meals.length) lines.push('These meals already carry ' + label + ' and keep it until someone unticks it in Edit Menu (links on this page after you take it back):');
  if (imp.residents) lines.push(imp.residents + ' resident' + (imp.residents === 1 ? '' : 's') + ' already carry ' + label + ' from an import; that stays until it is changed in Enter Changes.');
  if (list === 'rexSpelling') lines.push('Meals already saved from Rex’s sheet keep what was saved.');
  if (list === 'workbookAllergen') lines.push('Meals already imported from a workbook row naming it keep their ' + label + ' tick until someone unticks it in Edit Menu.');
  const ok = await doorAsk({ title: 'Take back “' + w + '”?', lines, items: imp.meals.map(doorRulesMealLabel), cancelLabel: 'Go back', goLabel: 'Take it back' });
  if (!ok || !doorRulesWhoHere().canEdit) return;
  const at = doorRulesStampFor(list, w);
  saveDoorRules(doorRulesTakeBack(loadDoorRules(), list, w, getOperatorName(), at));
  if (doorRulesActive(loadDoorRules(), list).some(r => r.word === w)) { doorRulesMsg(list, 'It did not take: a newer record for “' + w + '” is on this computer. Nothing changed.'); return; }
  doorRulesNoteOwn(list + '|' + w, at);
  doorRulesSetUndo({ kind: 'takeBack', list, word: w, target: cur.target, at });
  doorRulesChanged('Took back “' + w + '”. It goes to the kitchen with the next send.');
  doorRulesShowStillMarked(list, label, imp.meals);
}
// The meals that stay marked after a take-back, each linked to Edit Menu.
function doorRulesShowStillMarked(list, label, meals) {
  if (!meals || !meals.length) return;
  doorRulesMsg(list, '', 'Still marked ' + escapeHtml(label) + ' until someone unticks it: ' + meals.map(m =>
    '<a href="#menu-config/edit/' + encodeURIComponent(m.week) + '/' + encodeURIComponent(m.day) + '/' + encodeURIComponent(m.period) + '">' + escapeHtml(doorRulesMealLabel(m)) + '</a>').join(' · '));
}
async function doorRulesAddLead() {
  const who = doorRulesWhoHere();
  const msg = (t) => doorRulesMsg('leads', t);
  if (!who.canEditLeads) { msg('Only Jason changes the leads list.'); return; }
  const el = document.getElementById('door-rules-lead-name');
  const name = el ? String(el.value || '').trim().replace(/\s+/g, ' ') : '';
  if (!/^[A-Za-z][A-Za-z .'-]{0,39}$/.test(name)) { msg('Type the name as that person types it in Settings (letters only).'); return; }
  if (doorRulesIsLead(loadDoorRules(), name)) { msg(name + ' is already a lead.'); return; }
  const ok = await doorAsk({ title: 'Add ' + name + ' as a lead?', lines: [name + ' will be able to add words on a computer with a sending connection key and the name ' + name + ' in Settings.', 'This guards against mistakes; the connection key is the real lock.'], cancelLabel: 'Go back', goLabel: 'Add the lead' });
  if (!ok || !doorRulesWhoHere().canEditLeads) return;
  const at = doorRulesStampFor('', '', name);
  saveDoorRules(doorRulesSetLead(loadDoorRules(), name, true, getOperatorName(), at));
  if (!doorRulesIsLead(loadDoorRules(), name)) { msg('It did not take: a newer record for ' + name + ' is on this computer. Nothing changed.'); return; }
  doorRulesNoteOwn('lead|' + doorRulesNormName(name), at);
  doorRulesSetUndo({ kind: 'lead', name, on: true, at });
  if (el) el.value = '';
  doorRulesChanged(name + ' is a lead. It goes to the kitchen with the next send.');
}
async function doorRulesRemoveLead(name) {
  if (!doorRulesWhoHere().canEditLeads || doorRulesNormName(name) === doorRulesNormName(DOOR_RULES_OWNER)) return;
  const ok = await doorAsk({ title: 'Take ' + name + ' off the leads list?', lines: ['Words ' + name + ' added stay. ' + name + ' can no longer add or take back words.'], cancelLabel: 'Go back', goLabel: 'Take off' });
  if (!ok || !doorRulesWhoHere().canEditLeads) return;
  const at = doorRulesStampFor('', '', name);
  saveDoorRules(doorRulesSetLead(loadDoorRules(), name, false, getOperatorName(), at));
  if (doorRulesIsLead(loadDoorRules(), name)) { doorRulesMsg('leads', 'It did not take: a newer record for ' + name + ' is on this computer. Nothing changed.'); return; }
  doorRulesNoteOwn('lead|' + doorRulesNormName(name), at);
  doorRulesSetUndo({ kind: 'lead', name, on: false, at });
  doorRulesChanged(name + ' is off the leads list. It goes to the kitchen with the next send.');
}
// One Undo: the last add, take-back or lead change made on this computer, while nothing newer replaced it.
function doorRulesUndoText(u) {
  if (!u) return '';
  if (u.kind === 'add') return 'Undo: take back “' + u.word + '”';
  if (u.kind === 'takeBack') return 'Undo: add “' + u.word + '” back';
  if (u.kind === 'lead') return 'Undo: ' + (u.on ? 'take ' + u.name + ' off the leads list' : 'put ' + u.name + ' back on the leads list');
  return '';
}
function doorRulesUndoStillLatest(u, rules) {
  const r = doorRulesClean(rules);
  if (u.kind === 'lead') { const cur = doorRulesMerge(r, {}).leads.find(x => doorRulesNormName(x.name) === doorRulesNormName(u.name)); return !!cur && cur.at === u.at; }
  const cur = r.additions.find(x => x.list === u.list && x.word === u.word); return !!cur && cur.at === u.at;
}
async function doorRulesUndo() {
  const u = doorRulesGetUndo();
  if (!u) return;
  const who = doorRulesWhoHere();
  if (u.kind === 'lead' ? !who.canEditLeads : !who.canEdit) { if (typeof showToast === 'function') showToast(who.why || 'Only Jason changes the leads list.'); return; }
  const rules = loadDoorRules();
  if (!doorRulesUndoStillLatest(u, rules)) { doorRulesSetUndo(null); doorRulesChanged('Nothing to undo: it has changed since.'); return; }
  const by = getOperatorName();
  let at, took, still = [];
  if (u.kind === 'add') {
    // Undoing an add is a take-back: what the word already marked stays marked (second review N8).
    still = doorRulesTakeBackImpact(u.list, u.word, u.target).meals;
    at = doorRulesStampFor(u.list, u.word);
    saveDoorRules(doorRulesTakeBack(rules, u.list, u.word, by, at));
    took = !doorRulesActive(loadDoorRules(), u.list).some(r => r.word === u.word);
  } else if (u.kind === 'takeBack') {
    const chk = doorRulesCheck(rules, u.list, u.word, u.target, doorRulesCheckCtx(u.list));
    if (!chk.ok) { doorRulesSetUndo(null); doorRulesChanged(chk.why); return; }
    const dry = doorRulesDryRun(u.list, u.word, u.target);
    if (dry.error || dry.blocked.length) { doorRulesSetUndo(null); doorRulesChanged('Not added back: it would move residents off a plate that protects them, or DOOR could not check.'); return; }
    at = doorRulesStampFor(u.list, u.word);
    saveDoorRules(doorRulesAdd(rules, { list: u.list, word: u.word, target: u.target, by, at }));
    took = doorRulesActive(loadDoorRules(), u.list).some(r => r.word === u.word && r.at === at);
  } else if (u.kind === 'lead') {
    at = doorRulesStampFor('', '', u.name);
    saveDoorRules(doorRulesSetLead(rules, u.name, !u.on, by, at));
    took = doorRulesIsLead(loadDoorRules(), u.name) === !u.on;
  } else return;
  if (!took) { doorRulesChanged('It did not take: a newer record is on this computer. Nothing changed.'); return; }
  doorRulesNoteOwn(u.kind === 'lead' ? 'lead|' + doorRulesNormName(u.name) : u.list + '|' + u.word, at);
  doorRulesSetUndo(null);
  doorRulesChanged('Undone. It goes to the kitchen with the next send.');
  if (u.kind === 'add') doorRulesShowStillMarked(u.list, doorRulesTargetLabel(u.list, u.target), still);
}
// Try a word or a line against a list: what DOOR reads, built-in and added.
function doorRulesTry(list) {
  const el = document.getElementById('door-rules-try-' + list), out = document.getElementById('door-rules-tryout-' + list);
  if (!el || !out) return;
  const text = String(el.value || '');
  let read = [];
  try {
    if (list === 'menuName') { const f = nameDetectFlags(text, emptyMealFlags()); doorRulesTextTargets(list, text).forEach(k => { f[k] = true; }); read = Object.keys(f).filter(k => f[k]).map(k => doorRulesTargetLabel(list, k)); }
    else if (list === 'workbookAllergen') { const f = allergenStrToFlags(text, emptyMealFlags()); read = Object.keys(f).filter(k => f[k]).map(k => doorRulesTargetLabel(list, k)); }
    else if (list === 'restriction') { const r = normalizeRestriction(text); read = Object.keys(r.tags || {}).filter(k => r.tags[k]).map(k => doorRulesTargetLabel(list, k)); if ((r.unmatched || []).length) read.push('asks about: ' + r.unmatched.join(', ')); }
    else if (list === 'rexSpelling') read = doorRexTokens(text);
  } catch (e) { read = []; }
  out.textContent = text.trim() ? (read.length ? 'DOOR reads: ' + read.join(' · ') : 'DOOR reads nothing here.') : '';
}
// Built-in words, read-only, in plain words from the tables themselves.
function doorRulesBuiltInHTML(list) {
  const group = (pairs) => {
    const by = {};
    pairs.forEach(([w, t]) => { (by[t] = by[t] || []).push(w); });
    return Object.keys(by).sort().map(t => '<div><b>' + escapeHtml(t) + ':</b> ' + escapeHtml(by[t].join(', ')) + '</div>').join('');
  };
  if (list === 'workbookAllergen') return group(Object.keys(ALLERGEN_FLAG_MAP).map(w => [w, doorRulesTargetLabel(list, ALLERGEN_FLAG_MAP[w])])
    .concat(Object.keys(ALLERGEN_PHRASE_MAP).map(w => [w, doorRulesTargetLabel(list, ALLERGEN_PHRASE_MAP[w])])));
  if (list === 'restriction') return group(IMPORT_FUZZY_VOCAB.map(([w, t]) => [w, doorRulesTargetLabel(list, t)]))
    + '<div class="form-hint">DOOR also reads these with small spelling slips, GF and DF, and a tree nut named by its kind.</div>';
  if (list === 'rexSpelling') return '<div>' + escapeHtml(Object.keys(REX_SYN).map(k => k + ' → ' + REX_SYN[k]).join(' · ')) + '</div>'
    + '<div class="form-hint">Plurals and one-letter slips in long words are read too. An added spelling is a slip of a word DOOR uses, and never names an allergen or a meat.</div>';
  return '<div class="form-hint">The dish-name checks are patterns in DOOR’s code (for example shrimp, tofu, cheese, broccoli, bread). Try a dish name below to see what DOOR reads. An added word reads the regular line and its sides, not the vegan line, the halal line, swaps or special meals, and never names a meat.</div>';
}
// The plate rules, read-only, from ROUTING_RULES and CONFLICT_MAP themselves (D2b edits them later).
function doorRulesPlateRulesHTML() {
  const fl = k => doorRulesTargetLabel('menuName', k);
  const rows = (typeof ROUTING_RULES !== 'undefined' ? ROUTING_RULES : []).filter(r => r.key !== 'regular').map(r => {
    const who = (r.tags || []).join(' or ');
    let when = r.always ? 'at every meal' : 'when the meal has ' + (r.triggers || []).map(fl).join(' or ');
    const only = r.tagTriggers ? Object.keys(r.tagTriggers).map(t => t + ' only when the meal has ' + r.tagTriggers[t].map(fl).join(' or ')).join('; ') : '';
    const into = r.mergeInto ? ' (served from the ' + ((ROUTING_RULES.find(x => x.key === r.mergeInto) || {}).label || r.mergeInto) + ' plate)' : '';
    return '<li><b>' + escapeHtml(r.label) + '</b>' + escapeHtml(into) + ': residents with ' + escapeHtml(who) + ', ' + escapeHtml(when) + (only ? ' (' + escapeHtml(only) + ')' : '') + '.</li>';
  }).join('');
  const notes = (typeof CONFLICT_MAP !== 'undefined' ? CONFLICT_MAP : []).map(c =>
    '<li>' + escapeHtml(c.residentTag) + ' on a meal with ' + escapeHtml(fl(c.mealFlag)) + ': the line says “' + escapeHtml(c.note) + '”' + (c.severity === 'red' ? ' (in red)' : '') + '.</li>').join('');
  return '<div style="font-size:12px;line-height:1.6;"><div style="font-weight:600;margin:4px 0;">Which plate a resident gets</div><ul style="margin:0 0 8px;padding-left:18px;">' + rows
    + '<li><b>Regular</b>: everyone else.</li></ul><div style="font-weight:600;margin:4px 0;">What the plating line says</div><ul style="margin:0;padding-left:18px;">' + notes + '</ul>'
    + '<div class="form-hint">Read-only here. A change to the plate rules is a code change for now.</div></div>';
}
function renderDoorRulesPage() {
  const body = typeof document !== 'undefined' && document.getElementById ? document.getElementById('door-rules-body') : null;
  if (!body) return;
  const rules = loadDoorRules(), who = doorRulesWhoHere();
  const when = t => { try { return new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return t; } };
  let h = '';
  h += '<div style="font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:10px;">Words DOOR reads as an allergen, a restriction or a spelling. A lead can add a word; an added word only adds a warning or reads a spelling. Add checks today’s menu and resident list where it can, refuses a word that would move a resident off a plate that protects them, and says what it couldn’t check (dishes added later, workbook rows, residents whose original words this computer doesn’t hold). Taking a word back stops DOOR reading it from then on; what it already marked stays until someone changes it. Built-in words change only in code. Who may edit guards against mistakes; the connection key is the real lock.</div>';
  h += '<div id="door-rules-who" style="font-size:12px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:10px;' + (who.canEdit ? 'color:var(--forest);' : 'color:#92400e;') + '">'
    + escapeHtml(who.canEdit ? 'You can add words here as ' + getOperatorName() + (who.canEditLeads ? ', and change the leads list.' : ', a lead.') : who.why) + '</div>';
  const ks = doorRulesKitchenState();
  const line = (id, text) => { h += '<div id="' + id + '" style="font-size:12px;color:#92400e;margin-bottom:10px;">' + escapeHtml(text) + '</div>'; };
  if (ks.reason === 'newer') line('door-rules-newer', 'The kitchen’s rules file is from a newer DOOR (version ' + ks.version + '). This computer keeps reading its own copy and sends nothing over it. Reload DOOR to update.');
  else if (ks.reason === 'unreadable') line('door-rules-blocked', 'The kitchen’s rules file can’t be read, so nothing from this computer is sent. Ask Jason.');
  else if (ks.reason === 'drops') line('door-rules-blocked', 'The kitchen’s rules file has words or leads this computer’s copy would drop (' + (ks.keys || []).join(', ') + '), so nothing from this computer is sent. Ask Jason.');
  else if (doorRulesNotSent()) line('door-rules-pending', 'Not sent yet: ' + doorRulesUnsent().length + ' change' + (doorRulesUnsent().length === 1 ? '' : 's') + ' made on this computer. They go to the kitchen and the other DOOR computers with the next send.');
  const carried = doorRulesCarriedCount(rules);
  if (carried) line('door-rules-carried', carried + ' record' + (carried === 1 ? '' : 's') + ' this DOOR can’t read ' + (carried === 1 ? 'is' : 'are') + ' kept as ' + (carried === 1 ? 'it is' : 'they are') + ' (from a newer DOOR or a hand edit). They are not read here.');
  const skew = doorRulesSkewedCount(rules);
  if (skew) line('door-rules-skew', skew + ' record' + (skew === 1 ? ' is' : 's are') + ' stamped more than a day ahead of this computer’s clock: a computer has the wrong date. They are kept; check the clocks.');
  doorRulesCompiledFor('menuName');
  if (_doorRulesCompileError) line('door-rules-off', 'Added words are off on this computer: ' + _doorRulesCompileError + '. Ask Jason.');
  const u = doorRulesGetUndo();
  if (u && doorRulesUndoStillLatest(u, rules) && (u.kind === 'lead' ? who.canEditLeads : who.canEdit)) {
    h += '<div style="margin-bottom:10px;"><button class="btn btn-ghost btn-sm" id="door-rules-undo" onclick="doorRulesUndo()">' + escapeHtml(doorRulesUndoText(u)) + '</button></div>';
  }
  Object.keys(DOOR_RULES_LISTS).forEach(list => {
    const L = DOOR_RULES_LISTS[list];
    const added = doorRulesActive(rules, list);
    h += '<details class="door-rules-list" data-list="' + _escAttr(list) + '" style="border-top:1px solid var(--border);padding:8px 0;"><summary style="cursor:pointer;font-weight:600;font-size:13px;">'
      + escapeHtml(L.label) + ' <span style="font-weight:400;color:var(--muted);">· ' + added.length + ' added</span></summary>';
    h += '<div style="font-size:12px;margin:8px 0;"><div style="font-weight:600;margin-bottom:4px;">Built in (read-only)</div>' + doorRulesBuiltInHTML(list) + '</div>';
    h += '<div style="font-size:12px;margin:8px 0;"><div style="font-weight:600;margin-bottom:4px;">Added</div>';
    h += added.length ? '<table style="width:100%;font-size:12px;border-collapse:collapse;"><tbody>' + added.map(r =>
      '<tr><td style="padding:2px 6px 2px 0;">“' + escapeHtml(r.word) + '”</td><td style="padding:2px 6px;">→ ' + escapeHtml(doorRulesTargetLabel(list, r.target)) + '</td><td style="padding:2px 6px;color:var(--muted);">'
      + escapeHtml(r.by) + ', ' + escapeHtml(when(r.at)) + '</td><td style="text-align:right;">'
      + (who.canEdit ? '<button class="btn btn-ghost btn-sm" data-list="' + _escAttr(list) + '" data-word="' + _escAttr(r.word) + '" onclick="doorRulesTakeBackWord(this.dataset.list,this.dataset.word)">Take back</button>' : '')
      + '</td></tr>').join('') + '</tbody></table>' : '<div class="form-hint">None yet.</div>';
    h += '</div>';
    if (who.canEdit) {
      const targets = doorRulesTargetsFor(list);
      const pick = L.kind === 'spelling'
        ? '<input type="text" id="door-rules-target-' + list + '" placeholder="reads as (a word DOOR uses)" style="font-size:12px;max-width:180px;">'
        : '<select id="door-rules-target-' + list + '" style="font-size:12px;"><option value="">reads as…</option>' + targets.map(t => '<option value="' + _escAttr(t) + '">' + escapeHtml(doorRulesTargetLabel(list, t)) + '</option>').join('') + '</select>';
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0;"><input type="text" id="door-rules-word-' + list + '" maxlength="40" placeholder="' + (L.kind === 'spelling' ? 'Rex’s spelling' : 'word') + '" style="font-size:12px;max-width:180px;">'
        + pick + '<button class="btn btn-ghost btn-sm" onclick="doorRulesAddWord(\'' + list + '\')">Add…</button></div>';
    }
    h += '<div id="door-rules-msg-' + list + '" role="status" style="font-size:12px;color:#b45309;"></div>';
    h += '<div style="display:flex;gap:6px;align-items:center;margin-top:6px;"><input type="text" id="door-rules-try-' + list + '" placeholder="Try ' + escapeHtml(L.reads) + '" oninput="doorRulesTry(\'' + list + '\')" style="font-size:12px;max-width:260px;"><span id="door-rules-tryout-' + list + '" style="font-size:12px;color:var(--muted);"></span></div>';
    h += '</details>';
  });
  // The leads list: Jason changes it.
  h += '<div style="border-top:1px solid var(--border);padding:8px 0;"><div style="font-weight:600;font-size:13px;margin-bottom:4px;">Leads</div><div style="font-size:12px;">'
    + doorRulesLeadNames(rules).map(n => escapeHtml(n) + (who.canEditLeads && doorRulesNormName(n) !== doorRulesNormName(DOOR_RULES_OWNER)
      ? ' <button class="btn btn-ghost btn-sm" data-name="' + _escAttr(n) + '" onclick="doorRulesRemoveLead(this.dataset.name)">Take off</button>' : '')).join(' · ')
    + '</div><div class="form-hint" style="font-size:11px;">Only Jason changes this list. A lead edits on a computer with a sending connection key and that name in Settings. This guards against mistakes; the connection key is the real lock.</div>';
  if (who.canEditLeads) h += '<div style="display:flex;gap:6px;margin-top:6px;"><input type="text" id="door-rules-lead-name" maxlength="40" placeholder="Name" style="font-size:12px;max-width:180px;"><button class="btn btn-ghost btn-sm" onclick="doorRulesAddLead()">Add lead…</button></div>';
  h += '<div id="door-rules-msg-leads" role="status" style="font-size:12px;color:#b45309;"></div></div>';
  // Who changed what, newest first.
  const log = rules.log.slice(0, 12);
  h += '<details style="border-top:1px solid var(--border);padding:8px 0;"><summary style="cursor:pointer;font-weight:600;font-size:13px;">Changes</summary><ul id="door-rules-log" style="font-size:12px;margin:6px 0;padding-left:18px;">'
    + (log.length ? log.map(e => '<li>' + escapeHtml(when(e.at)) + ' · ' + escapeHtml(e.by) + ' ' + escapeHtml(e.what) + ' '
      + escapeHtml(e.word ? '“' + e.word + '” (' + (doorRulesHasList(e.list) ? DOOR_RULES_LISTS[e.list].label : 'a word list') + ', ' + doorRulesTargetLabel(e.list, e.target) + ')' : (e.name || '')) + '</li>').join('') : '<li>None yet.</li>') + '</ul></details>';
  h += '<details style="border-top:1px solid var(--border);padding:8px 0;"><summary style="cursor:pointer;font-weight:600;font-size:13px;">Plate rules (read-only)</summary>' + doorRulesPlateRulesHTML() + '</details>';
  body.innerHTML = h;
}
