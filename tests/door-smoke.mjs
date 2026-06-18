import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function assertContains(haystack, needle, message) {
  assert.ok(haystack.includes(needle), message || `Expected to find ${needle}`);
}

function assertMenuContractShape(menu, artifactName) {
  const weeks = menu.menu;

  assert.ok(weeks && typeof weeks === 'object', `${artifactName} should expose menu{}`);
  assert.equal(Object.keys(weeks).length, 4, `${artifactName} should contain the four-week rotation`);

  for (const [weekName, week] of Object.entries(weeks)) {
    assert.ok(week && typeof week === 'object', `${artifactName}.${weekName} should contain days`);
    for (const [dayName, day] of Object.entries(week)) {
      assert.equal(typeof day.breakfast, 'string', `${artifactName}.${weekName}.${dayName} should contain breakfast`);
      assert.equal(typeof day.lunch, 'string', `${artifactName}.${weekName}.${dayName} should contain lunch`);
      assert.equal(typeof day.dinner, 'string', `${artifactName}.${weekName}.${dayName} should contain dinner`);
    }
  }
}

function extractConstString(html, constName) {
  const escapedName = constName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`const\\s+${escapedName}\\s*=\\s*'([^']+)'`));
  assert.ok(match, `missing ${constName} string constant`);
  return match[1];
}

function extractSchemaVersionMap(html) {
  const block = html.match(/const\s+DOOR_SCHEMA_VERSIONS\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\);/);
  assert.ok(block, 'missing DOOR_SCHEMA_VERSIONS Object.freeze block');

  const versions = {};
  const entryPattern = /^\s*([a-z0-9_]+):\s*([0-9]+),?\s*$/gm;
  let entry;
  while ((entry = entryPattern.exec(block[1])) !== null) {
    versions[entry[1]] = Number(entry[2]);
  }

  assert.ok(Object.keys(versions).length > 0, 'DOOR_SCHEMA_VERSIONS should contain entries');
  return versions;
}

function extractStringSetLiteral(html, constName) {
  const escapedName = constName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = html.match(new RegExp(`const\\s+${escapedName}\\s*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\);`));
  assert.ok(block, `missing ${constName} Set literal`);

  const values = [];
  const stringPattern = /'([^']+)'/g;
  let entry;
  while ((entry = stringPattern.exec(block[1])) !== null) {
    values.push(entry[1]);
  }

  assert.ok(values.length > 0, `${constName} should contain string values`);
  return new Set(values);
}

function extractTestableCoreBlock(html, blockName) {
  const escapedName = blockName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `/\\* DOOR_TESTABLE_CORE_START ${escapedName} \\*/([\\s\\S]*?)/\\* DOOR_TESTABLE_CORE_END ${escapedName} \\*/`
  );
  const match = html.match(pattern);
  assert.ok(match, `missing testable core block: ${blockName}`);
  return match[1];
}

function extractFunctionBlock(html, functionName) {
  const escapedName = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?:async\\s+)?function\\s+${escapedName}\\s*\\(`);
  const match = pattern.exec(html);
  assert.ok(match, `missing function: ${functionName}`);

  const start = match.index;
  const bodyStart = html.indexOf('{', match.index + match[0].length);
  assert.ok(bodyStart !== -1, `missing body for function: ${functionName}`);

  let depth = 0;
  let quote = '';
  let escapeNext = false;
  let templateDepth = 0;

  for (let i = bodyStart; i < html.length; i++) {
    const ch = html[i];
    const prev = html[i - 1];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (quote) {
      if (ch === '\\') {
        escapeNext = true;
      } else if (quote === '`' && ch === '$' && html[i + 1] === '{') {
        templateDepth++;
        i++;
      } else if (quote === '`' && templateDepth && ch === '}') {
        templateDepth--;
      } else if (ch === quote && !templateDepth) {
        quote = '';
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '/' && html[i + 1] === '/') {
      const nextLine = html.indexOf('\n', i + 2);
      i = nextLine === -1 ? html.length : nextLine;
      continue;
    }
    if (ch === '/' && html[i + 1] === '*') {
      const endComment = html.indexOf('*/', i + 2);
      i = endComment === -1 ? html.length : endComment + 1;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
    assert.ok(!(depth < 0), `brace mismatch while extracting ${functionName}`);
  }

  assert.fail(`unterminated function: ${functionName}`);
}

function loadComplianceConflictCore() {
  const html = readText('index.html');
  const code = extractTestableCoreBlock(html, 'compliance-conflicts');
  const context = {
    Array,
    Object,
    Set,
    ROUTING_TAGS: extractStringSetLiteral(html, 'ROUTING_TAGS')
  };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: 'index.html#compliance-conflicts', timeout: 1000 });
  assert.equal(typeof context.checkResidentMealConflicts, 'function', 'compliance core should expose checkResidentMealConflicts');
  assert.equal(typeof context.computeDoorComplianceDiagnostics, 'function', 'compliance core should expose computeDoorComplianceDiagnostics');
  return context;
}

function loadPublishValidationCore() {
  const html = readText('index.html');
  const code = extractTestableCoreBlock(html, 'publish-validation');
  const context = {
    Array,
    JSON,
    Object,
    isFinite
  };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: 'index.html#publish-validation', timeout: 1000 });
  assert.equal(typeof context.validateDoorPublishArtifacts, 'function', 'publish core should expose validateDoorPublishArtifacts');
  assert.equal(typeof context.doorMergeMenuOverlayWithCloud, 'function', 'publish core should expose doorMergeMenuOverlayWithCloud');
  assert.equal(typeof context.buildDoorOverlayMergeAdvisory, 'function', 'publish core should expose buildDoorOverlayMergeAdvisory');
  return context;
}

function loadMenuDataCore(options = {}) {
  const html = readText('index.html');
  const localOverlay = options.localOverlay || {};
  const uploadedMenu = options.uploadedMenu || null;
  const altMenu = options.altMenu || null;
  const menuData = options.menuData || {
    '1': {
      MONDAY: { lunch: 'Base Monday lunch' },
      TUESDAY: { dinner: 'Base Tuesday dinner' }
    }
  };
  const context = {
    JSON,
    Object,
    Set,
    MENU_DATA: menuData,
    localStorage: {
      getItem(key) {
        return key === 'concMenuBase' ? JSON.stringify(localOverlay) : null;
      }
    },
    isAltMenuActive() {
      return !!options.altActive;
    },
    loadAltMenuCached() {
      return altMenu;
    },
    loadMenuBaseOverlay() {
      return localOverlay;
    },
    loadUploadedMenu() {
      return uploadedMenu;
    }
  };

  vm.createContext(context);
  const code = [
    'var _doorPublishMenuOverlayOverride = null;',
    extractFunctionBlock(html, 'setDoorPublishMenuOverlayOverride'),
    extractFunctionBlock(html, 'getDoorPublishMenuOverlayOverride'),
    extractFunctionBlock(html, 'mergeDoorMenuDataWithOverlay'),
    extractFunctionBlock(html, 'getMenuData')
  ].join('\n\n');
  vm.runInContext(code, context, { filename: 'index.html#menu-data-core', timeout: 1000 });
  assert.equal(typeof context.getMenuData, 'function', 'menu data core should expose getMenuData');
  assert.equal(typeof context.setDoorPublishMenuOverlayOverride, 'function', 'menu data core should expose publish overlay override setter');
  return context;
}

function makePublishArtifact(name) {
  if (name === 'menu_current.json') return readJson('menu_current.json');
  if (name === 'registry_summary.json') return readJson('registry_summary.json');
  if (name === 'routing_by_meal.json') return readJson('routing_by_meal.json');
  if (name === 'door_state.json') return readJson('door_state.json');
  throw new Error(`Unknown publish artifact fixture: ${name}`);
}

function loadPublishFlowHarness(options = {}) {
  const html = readText('index.html');
  const statusEl = { textContent: '', style: { color: '' } };
  const pushed = [];
  const syncBars = [];
  const toasts = [];
  const rememberedFailures = [];
  const consoleMessages = [];
  const overlayOverrides = [];
  const storage = {
    concMenuBase: JSON.stringify(options.localOverlay || {}),
    concCustomTagRules: '[]',
    concLearnedNR: '{}'
  };

  const context = {
    Array,
    JSON,
    Object,
    Promise,
    console: {
      warn(...args) {
        consoleMessages.push({ level: 'warn', args });
      },
      error(...args) {
        consoleMessages.push({ level: 'error', args });
      },
      log(...args) {
        consoleMessages.push({ level: 'log', args });
      }
    },
    isFinite,
    document: {
      getElementById(id) {
        return id === 'gh-status' ? statusEl : null;
      },
      querySelector() {
        return null;
      }
    },
    PublishAuth: {
      getCredentialsForManualPublish() {
        if (options.credentialsError) throw new Error(options.credentialsError);
        return { repo: 'kennedyjasondavid-eng/conc-kitchen-door', token: 'test-token' };
      },
      rememberFailure(message) {
        rememberedFailures.push(message);
      }
    },
    localStorage: {
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
      },
      setItem(key, value) {
        storage[key] = String(value);
      }
    },
    buildMenuJSON: options.buildMenuJSON || (() => makePublishArtifact('menu_current.json')),
    buildRegistrySummaryJSON: options.buildRegistrySummaryJSON || (() => makePublishArtifact('registry_summary.json')),
    buildRoutingByMealJSON: options.buildRoutingByMealJSON || (() => makePublishArtifact('routing_by_meal.json')),
    buildStateJSON: options.buildStateJSON || (() => makePublishArtifact('door_state.json')),
    ghPushFile: options.ghPushFile || (async (creds, artifactPath, content) => {
      pushed.push({ path: artifactPath, content: JSON.parse(content) });
      return options.skippedPath === artifactPath ? { skipped: true, reason: options.skippedReason || 'test_skip' } : {};
    }),
    preMergeOverlayWithCloud: options.preMergeOverlayWithCloud || (async (creds, localOverlay) => localOverlay),
    loadMealSwaps: () => [],
    loadSpecialMeals: () => [],
    RECENT_LOG: [],
    REGISTRY_LIST: [{ room: '101' }, { room: '102' }],
    updateSyncBar(message, color) {
      syncBars.push({ message, color });
    },
    showToast(message) {
      toasts.push(message);
    }
  };
  context.setDoorPublishMenuOverlayOverride = (overlay) => {
    overlayOverrides.push(overlay);
    context._doorPublishMenuOverlayOverride = overlay;
  };
  context.confirm = options.confirm || (() => true);
  if ('tabStale' in options) context._doorTabStale = options.tabStale;
  if ('staleOverride' in options) context._doorStaleOverride = options.staleOverride;
  if (typeof options.configureContext === 'function') {
    options.configureContext(context, storage);
  }

  vm.createContext(context);
  const code = [
    extractTestableCoreBlock(html, 'publish-validation'),
    extractFunctionBlock(html, 'reportDoorPublishValidation'),
    extractFunctionBlock(html, 'reportDoorOverlayMergeAdvisory'),
    extractFunctionBlock(html, '_doPublishToGitHub')
  ].join('\n\n');
  vm.runInContext(code, context, { filename: 'index.html#publish-flow', timeout: 1000 });

  return {
    context,
    statusEl,
    pushed,
    syncBars,
    toasts,
    rememberedFailures,
    consoleMessages,
    overlayOverrides,
    storage
  };
}

function loadPublishAndSyncHarness(options = {}) {
  const html = readText('index.html');
  const syncBars = [];
  const toasts = [];
  const context = {
    Date,
    updateSyncBar(message, color) { syncBars.push({ message, color }); },
    showToast(message) { toasts.push(message); },
    getOperatorName: () => options.operator || '',
    publishToGitHub: () => Promise.resolve(options.result),
  };
  vm.createContext(context);
  vm.runInContext(extractFunctionBlock(html, 'publishAndSync'), context, { filename: 'index.html#publish-and-sync', timeout: 1000 });
  assert.equal(typeof context.publishAndSync, 'function', 'publish-and-sync core should expose publishAndSync');
  return { context, syncBars, toasts };
}

function extractOutputEncodingBlock(html) {
  const joinedScripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .join('\n');
  const start = joinedScripts.indexOf('function doorText(value)');
  const end = joinedScripts.indexOf('// ============================================================\n// RESIDENT HISTORY', start);
  assert.ok(start >= 0 && end > start, 'output encoding helper block should be extractable');
  return joinedScripts.slice(start, end);
}

function loadOutputEncodingHelpers() {
  const helperBlock = extractOutputEncodingBlock(readText('index.html'));
  const factory = new Function('window', helperBlock + `
    return {
      doorText,
      escapeHtml,
      _escAttr,
      _jsStringLiteral,
      _jsArgLiteral,
      _escJsAttrCall,
      safeUrl,
      _escUrlAttr,
      doorTrustedColor,
      highlightHtml
    };
  `);
  return factory({ location: { href: 'https://kennedyjasondavid-eng.github.io/conc-kitchen-door/' } });
}

function assertNoRawExecutablePayload(html, message) {
  assert.doesNotMatch(html, /<img\b/i, `${message}: raw img tag should not render`);
  assert.doesNotMatch(html, /<svg\b/i, `${message}: raw svg tag should not render`);
  assert.doesNotMatch(html, /<(?:img|svg)\b[^>]*\son(?:error|load)\s*=/i, `${message}: event attributes should not render`);
  assert.doesNotMatch(html, /javascript:/i, `${message}: javascript URLs should not render`);
}

test('index.html keeps the single-file DOOR safety surfaces', () => {
  const html = readText('index.html');

  assertContains(html, '<!DOCTYPE html>', 'index.html should remain a browser-loadable HTML document');
  assert.match(html, /<title>[^<]*DOOR[^<]*<\/title>/i, 'the staff-facing app title should include DOOR');
  assertContains(html, 'localStorage', 'DOOR live state depends on browser localStorage');
  assertContains(html, 'https://api.github.com/repos/', 'publish path should still target the GitHub REST API');
  assertContains(html, '/contents/', 'GitHub publish path should still use repository contents API routes');
  assertContains(html, 'DOOR_APP_VERSION', 'DOOR should expose one app version constant');
  assertContains(html, 'DOOR_BUILD_DATE', 'DOOR should expose one build date constant');
  assertContains(html, 'DOOR_SCHEMA_VERSIONS', 'DOOR should expose schema version expectations');
  assertContains(html, 'door-build-stamp', 'DOOR should render a staff-visible build stamp');
  assertContains(html, 'DOOR_TESTABLE_CORE_START compliance-conflicts', 'DOOR should expose the first testable compliance core block');
  assertContains(html, 'DOOR_TESTABLE_CORE_START publish-validation', 'DOOR should expose the publish validation core block');

  const contractMarkers = [
    'menu_current.json',
    'routing_by_meal.json',
    'door_state.json',
    'registry_summary.json',
    'DOOR_RECIPE_DATA.json'
  ];

  for (const marker of contractMarkers) {
    assertContains(html, marker, `missing published/consumed contract marker: ${marker}`);
  }

  const safetyMarkers = [
    'anaphylactic',
    'Anaphylactic',
    'exclude',
    'DOOR_RECIPE_DATA_FALLBACK',
    'https://kennedyjasondavid-eng.github.io/conc-recipe-hub/DOOR_RECIPE_DATA.json',
    'ALLERGEN_TAGS',
    'hubAllergenToFlags',
    'flagsToAllergenStr',
    'flagsToMenuAllergens',
    'checkResidentMealConflicts',
    'getAnaphConflictRooms',
    'computePlatingData',
    'buildRoutingByMealJSON'
  ];

  for (const marker of safetyMarkers) {
    assertContains(html, marker, `missing safety/plating marker: ${marker}`);
  }

  const publishMarkers = [
    'publishToGitHub',
    'ghPushFile',
    'validateDoorPublishArtifacts',
    'reportDoorPublishValidation',
    'buildMenuJSON',
    'buildRoutingByMealJSON',
    'buildStateJSON'
  ];

  for (const marker of publishMarkers) {
    assertContains(html, marker, `missing publish marker: ${marker}`);
  }
});

test('index.html exposes the accessibility affordances from the elegance pass', () => {
  const html = readText('index.html');
  assert.match(html, /:focus-visible\s*\{/, 'a visible keyboard-focus ring (:focus-visible) should exist');
  assert.match(html, /enhanceNavA11y/, 'the div-based nav should be made keyboard-operable');
  assert.match(html, /setAttribute\(\s*'role'\s*,\s*'alert'\s*\)/, 'the stale-version banner should announce as an alert');
  assert.match(html, /id="sync-status"[^>]*aria-live/, 'the live status bar should announce updates to screen readers');
  assert.match(html, /class="dm-toggle"[^>]*aria-label="Toggle dark mode"/, 'the icon-only dark-mode toggle should have an accessible name');
});

test('output encoding helpers escape HTML, attributes, handlers, URLs, colors, and highlights', () => {
  const h = loadOutputEncodingHelpers();

  assert.equal(
    h.escapeHtml('<img src=x onerror=alert(1)>'),
    '&lt;img src=x onerror=alert(1)&gt;'
  );
  assert.equal(
    h._escAttr('" onmouseover="alert(1)'),
    '&quot; onmouseover&#x3D;&quot;alert(1)'
  );
  assert.equal(
    h._escJsAttrCall('slotSelect', ['main', "Soup');alert(1);//<img>"]),
    'slotSelect(&quot;main&quot;,&quot;Soup\\x27);alert(1);//\\x3Cimg\\x3E&quot;)'
  );
  assert.equal(h.safeUrl('javascript:alert(1)'), '#');
  assert.equal(h.doorTrustedColor('background:url(javascript:alert(1))', '#888'), '#888');
  assert.equal(
    h.highlightHtml('<img src=x onerror=alert(1)> Soup', 'soup'),
    '&lt;img src=x onerror=alert(1)&gt; <strong>Soup</strong>'
  );
});

test('inline handler interpolation scan has no unescaped dynamic handlers', () => {
  const html = readText('index.html');
  const lines = html.split(/\r?\n/);
  const handlerPattern = /on(?:click|change|input|keydown|focus|blur|mouseover|mouseout|error)="[^"]*\$\{[^}]+\}/g;
  const suspicious = [];

  lines.forEach((line, index) => {
    for (const match of line.match(handlerPattern) || []) {
      if (!/_esc(?:JsAttrCall|Attr)|_jsArgLiteral/.test(match)) {
        suspicious.push(`${index + 1}: ${line.trim()}`);
      }
    }
  });

  assert.deepEqual(suspicious, []);
});

test('reviewed stored-text report sinks are escaped in source', () => {
  const html = readText('index.html');
  const forbidden = [
    /\$\{g\.rooms\.sort\(\)\.join\(', '\)\}/,
    /Rm \$\{room\}/,
    /Breakfast\$\{md\.breakfast \? ': ' \+ md\.breakfast/,
    /\$\{e\.date\}<\/span>\$\{e\.desc\}/,
    /<strong>Room \$\{room\}<\/strong>/,
    /\$\{res\.section\} .* \$\{res\.rawRestriction\}/,
    /Rooms: \$\{x\.rooms\}/,
    /\$\{e\.meal\}<\/td>/,
    /<span class="log-room">\$\{e\.room\}/,
    /<span class="log-desc">\$\{e\.desc\}/,
    /<div class="log-date">\$\{e\.date\}/
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(html, pattern, `raw reviewed sink should not remain: ${pattern}`);
  }

  const requiredSafeMarkers = [
    "escapeHtml(g.rooms.sort().join(', '))",
    'Rm ${escapeHtml(room)}',
    'escapeHtml(md.breakfast.slice(0,35))',
    "escapeHtml((md.lunch.name || '').slice(0,40))",
    "escapeHtml((md.dinner.name || '').slice(0,38))",
    '${escapeHtml(e.date)}</span>${escapeHtml(e.desc)}',
    '${escapeHtml(c.date)}',
    '${escapeHtml(c.meal)}',
    'Rooms: ${escapeHtml(x.rooms)}',
    'Room ${escapeHtml(room)}',
    '${escapeHtml(res.section)}',
    '${escapeHtml(res.rawRestriction)}',
    '${escapeHtml(m.name)}</td>',
    '${escapeHtml(e.meal)}</td>'
  ];

  for (const marker of requiredSafeMarkers) {
    assertContains(html, marker, `missing safe marker: ${marker}`);
  }
});

test('report table helper renders stored meal-log payloads safely', () => {
  const html = readText('index.html');
  const context = {
    Array,
    Object,
    URL,
    window: { location: { href: 'https://kennedyjasondavid-eng.github.io/conc-kitchen-door/' } }
  };
  vm.createContext(context);
  vm.runInContext([
    extractOutputEncodingBlock(html),
    extractFunctionBlock(html, 'buildUptakeTable')
  ].join('\n\n'), context, { filename: 'index.html#xss-report-table', timeout: 1000 });

  const payload = '<img src=x onerror=alert(1)>';
  const htmlOut = context.buildUptakeTable([{
    date: payload,
    period: '<svg onload=alert(2)>',
    meal: payload + ' Meal',
    totalServed: 10,
    totalReturned: 1
  }], ['Regular']);

  assertContains(htmlOut, '&lt;img src=x onerror=alert(1)&gt;');
  assertContains(htmlOut, '&lt;svg onload=alert(2)&gt;');
  assertNoRawExecutablePayload(htmlOut, 'meal-log report table');
});

test('custom uptake-by-meal report renders synced meal names safely', () => {
  const html = readText('index.html');
  const payload = '<img src=x onerror=alert(1)>';
  const els = {};
  function el(id) {
    if (!els[id]) els[id] = { id, style: {}, innerHTML: '', textContent: '', value: '' };
    return els[id];
  }
  const context = {
    Array,
    Date,
    Object,
    URL,
    Math,
    window: { location: { href: 'https://kennedyjasondavid-eng.github.io/conc-kitchen-door/' } },
    document: { getElementById: el },
    Chart: function Chart() { return { destroy() {} }; },
    crChart: null,
    checkedBoxes: {
      cr_type: 'uptake_by_meal',
      crp_breakfast: true,
      crp_lunch: true,
      crp_dinner: true,
      crs_Regular: true
    },
    BASE_SECTIONS: [{ name: 'Regular', color: '#52B788' }],
    generateSampleLog() {
      return [{
        dateObj: new Date(),
        period: 'lunch',
        meal: payload + ' Meal',
        totalServed: 10,
        totalReturned: 1,
        returns: { Regular: { served: 10, returned: 1 } }
      }];
    }
  };
  vm.createContext(context);
  const runCustomReportStart = html.indexOf('function runCustomReport()');
  const runCustomReportEnd = html.indexOf('\nfunction buildUptakeTable', runCustomReportStart);
  assert.ok(runCustomReportStart >= 0 && runCustomReportEnd > runCustomReportStart, 'runCustomReport should be bounded by buildUptakeTable');
  vm.runInContext([
    extractOutputEncodingBlock(html),
    html.slice(runCustomReportStart, runCustomReportEnd)
  ].join('\n\n'), context, { filename: 'index.html#xss-custom-uptake-by-meal', timeout: 1000 });

  context.runCustomReport();
  assertContains(els['cr-output'].innerHTML, '&lt;img src=x onerror=alert(1)&gt; Meal');
  assertNoRawExecutablePayload(els['cr-output'].innerHTML, 'custom uptake-by-meal report');
});

test('review-and-generate and change-editor preview sinks are escaped in source', () => {
  const html = readText('index.html');
  function sliceBetween(startNeedle, endNeedle) {
    const start = html.indexOf(startNeedle);
    const end = html.indexOf(endNeedle, start);
    assert.ok(start >= 0 && end > start, `missing slice ${startNeedle}`);
    return html.slice(start, end);
  }

  const targets = [
    {
      name: 'resident history metadata',
      source: sliceBetween('function populateCEHistory', 'function updateCERoutePreview'),
      forbidden: [/\$\{entry\.date \|\| ''\} . \$\{entry\.by \|\| ''\}/],
      required: ["escapeHtml(entry.date || '')", "escapeHtml(entry.by || '')"]
    },
    {
      name: 'change editor route preview',
      source: sliceBetween('function updateCERoutePreview', 'function saveChangeEdit'),
      forbidden: [/\$\{lunchName\}<\/span>/, /\$\{dinnerName\}<\/span>/],
      required: ['${escapeHtml(lunchName)}</span>', '${escapeHtml(dinnerName)}</span>']
    },
    {
      name: 'review preview sections',
      source: sliceBetween("document.getElementById('preview-sections')", "document.getElementById('preview-total-badge')"),
      forbidden: [
        /background:\$\{s\.color\}/,
        /<div class="section-name">\$\{s\.name\}<\/div>/,
        /<div class="section-meal">\$\{s\.meal\}<\/div>/
      ],
      required: ["doorTrustedColor(s.color, '#888')", '${escapeHtml(s.name)}</div>', '${escapeHtml(s.meal)}</div>']
    },
    {
      name: 'regular slot summary',
      source: sliceBetween('function updateSlotSummary', "document.addEventListener('click'"),
      forbidden: [
        />\$\{name\}<\/div>/,
        /Veg alt: \$\{veg\}/,
        /No Pork alt: \$\{noPorkAlt\}/,
        /: \$\{a\.text\}<\/div>/
      ],
      required: ['${escapeHtml(name)}</div>', 'Veg alt: ${escapeHtml(veg)}', 'No Pork alt: ${escapeHtml(noPorkAlt)}', ': ${escapeHtml(a.text)}</div>']
    }
  ];

  for (const target of targets) {
    for (const pattern of target.forbidden) {
      assert.doesNotMatch(target.source, pattern, `${target.name}: raw reviewed preview sink should not remain: ${pattern}`);
    }
    for (const marker of target.required) {
      assertContains(target.source, marker, `${target.name}: missing safe marker ${marker}`);
    }
  }
});

test('change editor route preview renders synced meal names safely', () => {
  const html = readText('index.html');
  const payload = '<img src=x onerror=alert(1)>';
  const routeEl = { style: {}, innerHTML: '' };
  const context = {
    Array,
    Object,
    URL,
    window: { location: { href: 'https://kennedyjasondavid-eng.github.io/conc-kitchen-door/' } },
    document: {
      getElementById(id) {
        if (id === 'ce-anaph') return { checked: false };
        if (id === 'ce-route-preview') return routeEl;
        return null;
      }
    },
    ceMode: 'registry',
    ceRoom: '101',
    changesQueue: [],
    MEAL_DATA: {
      lunch: { name: payload + ' Lunch' },
      dinner: { name: '<svg onload=alert(2)> Dinner' }
    },
    MEAL: {},
    getCETags() { return []; },
    routeResident() { return payload + ' Route'; }
  };
  vm.createContext(context);
  vm.runInContext([
    extractOutputEncodingBlock(html),
    extractFunctionBlock(html, 'updateCERoutePreview')
  ].join('\n\n'), context, { filename: 'index.html#xss-change-editor-route', timeout: 1000 });

  context.updateCERoutePreview();
  assertContains(routeEl.innerHTML, '&lt;img src=x onerror=alert(1)&gt; Lunch');
  assertContains(routeEl.innerHTML, '&lt;svg onload=alert(2)&gt; Dinner');
  assertContains(routeEl.innerHTML, '&lt;img src=x onerror=alert(1)&gt; Route');
  assertNoRawExecutablePayload(routeEl.innerHTML, 'change editor route preview');
});

test('regular menu slot summary renders staff-entered slot text safely', () => {
  const html = readText('index.html');
  const payload = '<img src=x onerror=alert(1)>';
  const summaryEl = { style: {}, innerHTML: '' };
  const context = {
    Array,
    Object,
    URL,
    window: { location: { href: 'https://kennedyjasondavid-eng.github.io/conc-kitchen-door/' } },
    document: {
      getElementById(id) {
        if (id === 'mc-slot-name-preview') return summaryEl;
        return null;
      }
    },
    FLAG_DEFS: [],
    _LAST_SLOT_FLAGS: {},
    testMealActive: false,
    buildUnionFlags() { return {}; },
    buildVegAltFlags() { return {}; },
    buildAltMeals() { return [{ type: 'plain', text: '<svg onload=alert(2)> Plain alt' }]; },
    buildMealName() { return payload + ' Main'; },
    buildVegAlt() { return payload + ' Veg'; },
    buildSoftAlt() { return ''; },
    buildNoPorkAlt() { return payload + ' No Pork'; },
    detectIsCarb() { return false; }
  };
  vm.createContext(context);
  vm.runInContext([
    extractOutputEncodingBlock(html),
    extractFunctionBlock(html, 'updateSlotSummary')
  ].join('\n\n'), context, { filename: 'index.html#xss-slot-summary', timeout: 1000 });

  context.updateSlotSummary();
  assertContains(summaryEl.innerHTML, '&lt;img src=x onerror=alert(1)&gt; Main');
  assertContains(summaryEl.innerHTML, '&lt;img src=x onerror=alert(1)&gt; Veg');
  assertContains(summaryEl.innerHTML, '&lt;img src=x onerror=alert(1)&gt; No Pork');
  assertContains(summaryEl.innerHTML, '&lt;svg onload=alert(2)&gt; Plain alt');
  assertNoRawExecutablePayload(summaryEl.innerHTML, 'regular menu slot summary');
});

test('daily import prompt renders synced import filename safely', () => {
  const html = readText('index.html');
  const payload = '<img src=x onerror=alert(1)>.xlsx';
  const promptEl = { style: {}, innerHTML: '' };
  const storage = {
    concLastImportDate: new Date().toDateString(),
    concLastImportFile: payload,
    concUnresolvedNR: null,
    concLastGenerated: null
  };
  const context = {
    Array,
    Date,
    JSON,
    Object,
    URL,
    window: { location: { href: 'https://kennedyjasondavid-eng.github.io/conc-kitchen-door/' } },
    document: {
      documentElement: { getAttribute() { return 'light'; } },
      getElementById(id) {
        if (id === 'daily-import-prompt') return promptEl;
        return null;
      }
    },
    localStorage: {
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
      }
    },
    changesQueue: []
  };
  vm.createContext(context);
  vm.runInContext([
    extractOutputEncodingBlock(html),
    extractFunctionBlock(html, 'updateDailyImportPrompt')
  ].join('\n\n'), context, { filename: 'index.html#xss-daily-import-prompt', timeout: 1000 });

  context.updateDailyImportPrompt();
  assertContains(promptEl.innerHTML, '&lt;img src=x onerror=alert(1)&gt;.xlsx');
  assertNoRawExecutablePayload(promptEl.innerHTML, 'daily import prompt filename');
});

test('report dashboard renders synced welfare and section payloads safely', () => {
  const html = readText('index.html');
  const payload = '<img src=x onerror=alert(1)>';
  const els = {};
  function el(id) {
    if (!els[id]) els[id] = { id, style: {}, innerHTML: '', value: 'month' };
    return els[id];
  }
  const context = {
    Array,
    Date,
    Object,
    URL,
    Math,
    window: { location: { href: 'https://kennedyjasondavid-eng.github.io/conc-kitchen-door/' } },
    document: { getElementById: el },
    Chart: function Chart() { return { destroy() {} }; },
    uptakeChart: null,
    BASE_SECTIONS: [{ name: payload, color: 'background:url(javascript:alert(1))' }],
    RECENT_LOG: [{ type: 'welfare', date: payload, desc: payload }],
    generateSampleLog() {
      const returns = {};
      returns[payload] = { served: 10, returned: 1 };
      return [{
        dateObj: new Date(),
        date: payload,
        period: '<svg onload=alert(2)>',
        meal: payload + ' Meal',
        totalServed: 10,
        totalNotServed: 1,
        returns
      }];
    }
  };
  vm.createContext(context);
  vm.runInContext([
    extractOutputEncodingBlock(html),
    extractFunctionBlock(html, 'renderReport')
  ].join('\n\n'), context, { filename: 'index.html#xss-report-dashboard', timeout: 1000 });

  context.renderReport();
  const combined = [
    els['report-by-section'].innerHTML,
    els['report-welfare'].innerHTML,
    els['report-log-table'].innerHTML
  ].join('\n');

  assertContains(combined, '&lt;img src=x onerror=alert(1)&gt;');
  assertContains(combined, '&lt;svg onload=alert(2)&gt;');
  assertNoRawExecutablePayload(combined, 'report dashboard');
  assert.doesNotMatch(combined, /javascript:/i, 'trusted color guard should reject CSS javascript payload');
});

test('recipe slot dropdowns render synced recipe names and manual no-match text as text', () => {
  const html = readText('index.html');
  const dd = { style: {}, innerHTML: '' };
  const context = {
    Array,
    Object,
    RegExp,
    Set,
    String,
    URL,
    window: { location: { href: 'https://kennedyjasondavid-eng.github.io/conc-kitchen-door/' } },
    document: {
      getElementById(id) {
        return id === 'slot-dd-main' || id === 'sm-slot-dd-main' ? dd : null;
      }
    },
    MEAL_SLOT_DEFS: [{ id: 'main', cats: ['protein'], streams: ['regular'] }],
    DOOR_RECIPE_DATA: [{
      recipeName: '<img src=x onerror=alert(1)> Soup',
      category: 'protein',
      stream: 'regular',
      allergens: ['None']
    }],
    HUB_ALLERGEN_MAP: {}
  };
  vm.createContext(context);
  vm.runInContext([
    extractOutputEncodingBlock(html),
    'function isHubLoaded() { return typeof DOOR_RECIPE_DATA !== "undefined" && Array.isArray(DOOR_RECIPE_DATA); }',
    extractFunctionBlock(html, '_allergenPreview'),
    extractFunctionBlock(html, 'slotSearch'),
    extractFunctionBlock(html, 'smSlotSearch')
  ].join('\n\n'), context, { filename: 'index.html#xss-slot-search', timeout: 1000 });

  context.slotSearch('main', 'soup');
  assertContains(dd.innerHTML, '&lt;img src=x onerror=alert(1)&gt; <strong>Soup</strong>');
  assertContains(dd.innerHTML, 'slotSelect(&quot;main&quot;');
  assertNoRawExecutablePayload(dd.innerHTML, 'recipe search result');

  context.DOOR_RECIPE_DATA = [];
  context.slotSearch('main', '<svg onload=alert(1)>');
  assertContains(dd.innerHTML, '&lt;svg onload=alert(1)&gt;');
  assertContains(dd.innerHTML, 'slotSaveManual(&quot;main&quot;)');
  assertNoRawExecutablePayload(dd.innerHTML, 'recipe no-match result');
});

test('special meal summary renders staff-entered meal text safely', () => {
  const html = readText('index.html');
  const summaryEl = { style: {}, innerHTML: '' };
  const context = {
    Array,
    Object,
    Set,
    URL,
    window: { location: { href: 'https://kennedyjasondavid-eng.github.io/conc-kitchen-door/' } },
    document: {
      getElementById(id) {
        if (id === 'sm-slot-summary') return summaryEl;
        if (id.startsWith('sm-al-')) return { checked: false };
        return null;
      }
    },
    MEAL_SLOT_DEFS: [
      { id: 'extras' },
      { id: 'main' },
      { id: 'mainalt' },
      { id: 'starch' },
      { id: 'vegside' },
      { id: 'xtra' },
      { id: 'veganalt' }
    ],
    SM_SLOT_STATE: {
      extras: { manual: '<img src=x onerror=alert(1)> Holiday' },
      main: null,
      mainalt: null,
      starch: null,
      vegside: null,
      xtra: null,
      veganalt: { manual: '<svg onload=alert(2)> Vegan Alt' }
    },
    SM_ALLERGENS: []
  };
  vm.createContext(context);
  vm.runInContext([
    extractOutputEncodingBlock(html),
    extractFunctionBlock(html, 'buildSmMealName'),
    extractFunctionBlock(html, 'buildSmVegAlt'),
    extractFunctionBlock(html, 'buildSmUnionFlags'),
    extractFunctionBlock(html, 'updateSmSlotSummary')
  ].join('\n\n'), context, { filename: 'index.html#xss-special-summary', timeout: 1000 });

  context.updateSmSlotSummary();
  assertContains(summaryEl.innerHTML, '&lt;img src=x onerror=alert(1)&gt; Holiday');
  assertContains(summaryEl.innerHTML, '&lt;svg onload=alert(2)&gt; Vegan Alt');
  assertNoRawExecutablePayload(summaryEl.innerHTML, 'special meal summary');
});

test('plating HTML renders synced resident payload text safely', () => {
  const html = readText('index.html');
  const context = {
    Array,
    Object,
    Set,
    URL,
    window: { location: { href: 'https://kennedyjasondavid-eng.github.io/conc-kitchen-door/' } },
    REGISTRY_LIST: [{ room: '101' }],
    anaphRooms: []
  };
  vm.createContext(context);
  vm.runInContext([
    extractOutputEncodingBlock(html),
    extractFunctionBlock(html, 'buildPlatingHtml')
  ].join('\n\n'), context, { filename: 'index.html#xss-plating', timeout: 1000 });

  const payload = '<img src=x onerror=alert(1)>';
  const htmlOut = context.buildPlatingHtml({
    dayLabel: 'Monday',
    periodLabel: 'Lunch',
    mealName: payload + ' Meal',
    mealVeg: '',
    mealFlags: {},
    allergenStr: payload,
    vegAllergenStr: '',
    conflictRooms: new Set(),
    anaphSect: [],
    sections: [],
    regCount: 1,
    halalCount: 0,
    veganCount: 0,
    diabCount: 0,
    ctx: {},
    regularNotes: [{
      rawRestriction: payload,
      room: "101' onclick='alert(1)",
      conflictNote: payload,
      serviceNote: payload
    }]
  }, false);

  assertContains(htmlOut, '&lt;img src=x onerror=alert(1)&gt; Meal');
  assertContains(htmlOut, '101&#x27; onclick=&#x27;alert(1)');
  assertNoRawExecutablePayload(htmlOut, 'plating synced resident payload');
});

test('app build stamp constants are explicit and schema mirrors match checked-in artifacts', () => {
  const html = readText('index.html');
  const version = extractConstString(html, 'DOOR_APP_VERSION');
  const buildDate = extractConstString(html, 'DOOR_BUILD_DATE');
  const schemaVersions = extractSchemaVersionMap(html);

  assert.match(version, /^v[0-9]+/, 'DOOR_APP_VERSION should start with a v-number');
  assert.match(buildDate, /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, 'DOOR_BUILD_DATE should be ISO yyyy-mm-dd');
  assertContains(html, 'id="settings-build-stamp"', 'Settings build stamp target should be explicit');

  const artifactBySchemaKey = {
    menu_current: 'menu_current.json',
    menu_reno: 'menu_reno.json',
    routing_by_meal: 'routing_by_meal.json',
    door_state: 'door_state.json',
    registry_summary: 'registry_summary.json'
  };

  for (const [schemaKey, artifact] of Object.entries(artifactBySchemaKey)) {
    const data = readJson(artifact);
    assert.equal(
      schemaVersions[schemaKey],
      data._meta.version,
      `${schemaKey} schema mirror should match ${artifact} _meta.version`
    );
  }
});

test('testable compliance core detects resident allergen and routing conflicts', () => {
  const core = loadComplianceConflictCore();
  const mealFlags = {
    hasPeanuts: true,
    hasGluten: true,
    hasPork: true
  };
  const resident = {
    room: '101',
    tags: ['GF', 'No Pork'],
    allergenFlags: ['No Peanuts'],
    accommodations: []
  };

  const conflicts = core.checkResidentMealConflicts(mealFlags, resident);
  const labels = Array.from(conflicts, (conflict) => `${conflict.tag}:${conflict.tier}`).sort();

  assert.deepEqual(labels, [
    'GF:restriction',
    'No Peanuts:allergen',
    'No Pork:restriction'
  ]);
});

test('testable compliance core leaves clean resident and meal combinations alone', () => {
  const core = loadComplianceConflictCore();
  const mealFlags = {
    hasPeanuts: false,
    hasGluten: false,
    hasPork: false
  };
  const resident = {
    room: '102',
    tags: ['Regular'],
    allergenFlags: ['No Peanuts'],
    accommodations: []
  };

  assert.deepEqual(Array.from(core.checkResidentMealConflicts(mealFlags, resident)), []);
});

test('read-only diagnostics marks anaphylactic meal conflicts as Stop', () => {
  const core = loadComplianceConflictCore();
  const result = core.computeDoorComplianceDiagnostics({
    mealFlags: { hasPeanuts: true },
    recipeData: [{ recipeName: 'Peanut Stew', allergens: ['Peanuts'] }],
    knownAllergenTags: extractStringSetLiteral(readText('index.html'), 'ALLERGEN_TAGS'),
    knownRoutingTags: extractStringSetLiteral(readText('index.html'), 'ROUTING_TAGS'),
    residents: [{
      room: '201',
      isAnaph: true,
      tags: ['Regular'],
      allergenFlags: ['No Peanuts'],
      accommodations: []
    }]
  });

  assert.equal(result.counts.Stop, 1);
  assert.equal(result.certainty, 'blocked');
  assert.equal(result.diagnosticIncomplete, false);
  assert.equal(result.stop[0].code, 'anaphylactic-meal-conflict');
  assert.equal(result.stop[0].details.room, '201');
});

test('read-only diagnostics surfaces unknown and unmapped allergen tokens', () => {
  const core = loadComplianceConflictCore();
  const html = readText('index.html');
  const result = core.computeDoorComplianceDiagnostics({
    mealFlags: {},
    recipeData: [{ recipeName: 'Plain Rice', allergens: ['None'] }],
    knownAllergenTags: extractStringSetLiteral(html, 'ALLERGEN_TAGS'),
    knownRoutingTags: extractStringSetLiteral(html, 'ROUTING_TAGS'),
    knownAccommodationTags: extractStringSetLiteral(html, 'ACCOMMODATION_TAGS'),
    residents: [
      {
        room: '202',
        isAnaph: false,
        tags: ['Regular'],
        allergenFlags: ['No Oats'],
        accommodations: []
      },
      {
        room: '203',
        isAnaph: true,
        tags: ['No Dragonfruit'],
        allergenFlags: ['No Dragonfruit'],
        accommodations: []
      }
    ]
  });

  const issueCodes = Array.from(result.issues, (issue) => `${issue.level}:${issue.code}:${issue.details.room}`).sort();

  assert.deepEqual(issueCodes, [
    'Review:unmapped-allergen-token:202',
    'Stop:unknown-allergen-token:203'
  ]);
});

test('read-only diagnostics reports missing CODEX data without blocking by itself', () => {
  const core = loadComplianceConflictCore();
  const result = core.computeDoorComplianceDiagnostics({
    mealFlags: {},
    recipeData: [],
    residents: []
  });

  assert.equal(result.counts.Stop, 0);
  assert.equal(result.counts.Review, 1);
  assert.equal(result.certainty, 'degraded');
  assert.equal(result.diagnosticIncomplete, true);
  assert.equal(result.review[0].code, 'codex-recipe-data-missing');
});

test('read-only diagnostics checks bucketed accommodations directly', () => {
  const core = loadComplianceConflictCore();
  const html = readText('index.html');
  const result = core.computeDoorComplianceDiagnostics({
    mealFlags: {},
    recipeData: [{ recipeName: 'Plain Rice', allergens: ['None'] }],
    knownAllergenTags: extractStringSetLiteral(html, 'ALLERGEN_TAGS'),
    knownRoutingTags: extractStringSetLiteral(html, 'ROUTING_TAGS'),
    knownAccommodationTags: extractStringSetLiteral(html, 'ACCOMMODATION_TAGS'),
    residents: [{
      room: '204',
      isAnaph: false,
      tags: ['Regular'],
      allergenFlags: [],
      accommodations: ['Low Salt']
    }]
  });

  assert.equal(result.counts.Review, 1);
  assert.equal(result.review[0].code, 'unknown-accommodation-token');
  assert.equal(result.review[0].details.tag, 'Low Salt');
});

test('read-only diagnostics degrades on invalid routing diagnostic input', () => {
  const core = loadComplianceConflictCore();
  const result = core.computeDoorComplianceDiagnostics({
    mealFlags: {},
    recipeData: [{ recipeName: 'Plain Rice', allergens: ['None'] }],
    routingSections: { Regular: 1 },
    residents: [{
      room: '205',
      isAnaph: false,
      tags: ['Regular'],
      allergenFlags: [],
      accommodations: []
    }]
  });

  assert.equal(result.counts.Review, 1);
  assert.equal(result.review[0].code, 'diagnostic-routing-input-invalid');
  assert.equal(result.certainty, 'degraded');
  assert.equal(result.diagnosticIncomplete, true);
});

test('read-only diagnostics keeps incomplete flag when degraded data also has Stop issues', () => {
  const core = loadComplianceConflictCore();
  const html = readText('index.html');
  const result = core.computeDoorComplianceDiagnostics({
    mealFlags: { hasPeanuts: true },
    recipeData: [],
    knownAllergenTags: extractStringSetLiteral(html, 'ALLERGEN_TAGS'),
    knownRoutingTags: extractStringSetLiteral(html, 'ROUTING_TAGS'),
    residents: [{
      room: '206',
      isAnaph: true,
      tags: ['Regular'],
      allergenFlags: ['No Peanuts'],
      accommodations: []
    }]
  });

  assert.equal(result.counts.Stop, 1);
  assert.equal(result.counts.Review, 1);
  assert.equal(result.certainty, 'blocked');
  assert.equal(result.diagnosticIncomplete, true);
});

test('publish validation accepts the checked-in core artifacts', () => {
  const core = loadPublishValidationCore();
  const result = core.validateDoorPublishArtifacts({
    'menu_current.json': readJson('menu_current.json'),
    'registry_summary.json': readJson('registry_summary.json'),
    'routing_by_meal.json': readJson('routing_by_meal.json'),
    'door_state.json': readJson('door_state.json')
  });

  assert.equal(result.counts.Stop, 0);
  assert.equal(result.blockingEnabled, false);
});

test('publish validation catches malformed routing component portions', () => {
  const core = loadPublishValidationCore();
  const routing = readJson('routing_by_meal.json');
  const copy = JSON.parse(JSON.stringify(routing));
  const weekKey = Object.keys(copy.routing)[0];
  const dayKey = Object.keys(copy.routing[weekKey])[0];
  const mealKey = Object.keys(copy.routing[weekKey][dayKey])[0];
  copy.routing[weekKey][dayKey][mealKey]._components = { Rice: 'many' };

  const result = core.validateDoorPublishArtifacts({
    'menu_current.json': readJson('menu_current.json'),
    'registry_summary.json': readJson('registry_summary.json'),
    'routing_by_meal.json': copy,
    'door_state.json': readJson('door_state.json')
  });

  assert.equal(result.counts.Stop, 1);
  assert.equal(result.stop[0].code, 'routing-component-portions-invalid');
  assert.equal(result.stop[0].artifact, 'routing_by_meal.json');
});

test('publish validation catches missing menu contract days', () => {
  const core = loadPublishValidationCore();
  const menu = readJson('menu_current.json');
  const copy = JSON.parse(JSON.stringify(menu));
  delete copy.menu['1'].MONDAY;

  const result = core.validateDoorPublishArtifacts({
    'menu_current.json': copy,
    'registry_summary.json': readJson('registry_summary.json'),
    'routing_by_meal.json': readJson('routing_by_meal.json'),
    'door_state.json': readJson('door_state.json')
  });

  assert.ok(result.stop.some((issue) =>
    issue.code === 'menu-day-missing' &&
    issue.artifact === 'menu_current.json' &&
    issue.details.week === '1' &&
    issue.details.day === 'MONDAY'
  ));
});

test('publish validation catches non-whole routing counts', () => {
  const core = loadPublishValidationCore();
  const routing = readJson('routing_by_meal.json');
  const copy = JSON.parse(JSON.stringify(routing));
  const weekKey = Object.keys(copy.routing)[0];
  const dayKey = Object.keys(copy.routing[weekKey])[0];
  const mealKey = Object.keys(copy.routing[weekKey][dayKey])[0];
  const sectionKey = Object.keys(copy.routing[weekKey][dayKey][mealKey]).find((key) => key !== '_components');
  copy.routing[weekKey][dayKey][mealKey][sectionKey] = 0.5;

  const result = core.validateDoorPublishArtifacts({
    'menu_current.json': readJson('menu_current.json'),
    'registry_summary.json': readJson('registry_summary.json'),
    'routing_by_meal.json': copy,
    'door_state.json': readJson('door_state.json')
  });

  assert.ok(result.stop.some((issue) =>
    issue.code === 'routing-section-count-invalid' &&
    issue.artifact === 'routing_by_meal.json' &&
    issue.details.section === sectionKey
  ));
});

test('publish validation catches missing routing meal slots', () => {
  const core = loadPublishValidationCore();
  const routing = readJson('routing_by_meal.json');
  const copy = JSON.parse(JSON.stringify(routing));
  delete copy.routing['1'].MONDAY.dinner;

  const result = core.validateDoorPublishArtifacts({
    'menu_current.json': readJson('menu_current.json'),
    'registry_summary.json': readJson('registry_summary.json'),
    'routing_by_meal.json': copy,
    'door_state.json': readJson('door_state.json')
  });

  assert.ok(result.stop.some((issue) =>
    issue.code === 'routing-meal-missing' &&
    issue.artifact === 'routing_by_meal.json' &&
    issue.details.week === '1' &&
    issue.details.day === 'MONDAY' &&
    issue.details.meal === 'dinner'
  ));
});

test('publish validation reports missing required artifacts in warning-only mode', () => {
  const core = loadPublishValidationCore();
  const result = core.validateDoorPublishArtifacts({
    'menu_current.json': readJson('menu_current.json')
  });
  const missing = Array.from(result.stop, (issue) => issue.artifact).sort();

  assert.deepEqual(missing, [
    'door_state.json',
    'registry_summary.json',
    'routing_by_meal.json'
  ]);
  assert.equal(result.blockingEnabled, false);
});

test('overlay merge preserves local days and adds cloud-only days for advisory', () => {
  const core = loadPublishValidationCore();
  const local = {
    '1': {
      MONDAY: { lunch: 'Local lunch' }
    }
  };
  const cloud = {
    '1': {
      MONDAY: { lunch: 'Cloud lunch should not win' },
      TUESDAY: { dinner: 'Cloud dinner' }
    },
    '2': {
      WEDNESDAY: { breakfast: 'Cloud breakfast' }
    }
  };

  const result = core.doorMergeMenuOverlayWithCloud(local, cloud);

  assert.equal(result.addedCount, 2);
  assert.equal(JSON.stringify(result.addedDays), JSON.stringify([
    { week: '1', day: 'TUESDAY' },
    { week: '2', day: 'WEDNESDAY' }
  ]));
  assert.equal(result.merged['1'].MONDAY.lunch, 'Local lunch');
  assert.equal(result.merged['1'].TUESDAY.dinner, 'Cloud dinner');
  assert.equal(result.merged['2'].WEDNESDAY.breakfast, 'Cloud breakfast');
});

test('overlay advisory flags cloud-only days merged after core artifacts', () => {
  const core = loadPublishValidationCore();
  const local = { '1': { MONDAY: { lunch: 'Local lunch' } } };
  const merged = {
    '1': {
      MONDAY: { lunch: 'Local lunch' },
      TUESDAY: { dinner: 'Cloud dinner' }
    }
  };

  const advisory = core.buildDoorOverlayMergeAdvisory(local, merged, true);

  assert.equal(advisory.level, 'Review');
  assert.equal(advisory.code, 'cloud-overlay-days-merged-after-core-artifacts');
  assert.equal(advisory.addedCount, 1);
  assert.equal(JSON.stringify(advisory.addedDays), JSON.stringify([{ week: '1', day: 'TUESDAY' }]));
  assert.match(advisory.message, /reload and republish/i);
});

test('overlay advisory is informational when cloud-only days merge before core artifacts', () => {
  const core = loadPublishValidationCore();
  const local = { '1': { MONDAY: { lunch: 'Local lunch' } } };
  const merged = {
    '1': {
      MONDAY: { lunch: 'Local lunch' },
      TUESDAY: { dinner: 'Cloud dinner' }
    }
  };

  const advisory = core.buildDoorOverlayMergeAdvisory(local, merged, false);

  assert.equal(advisory.level, 'Info');
  assert.equal(advisory.code, 'cloud-overlay-days-merged-before-core-artifacts');
  assert.equal(advisory.addedCount, 1);
  assert.match(advisory.message, /will include them in this publish/i);
});

test('getMenuData never lets the publish overlay contaminate the alt (reno) menu', () => {
  const core = loadMenuDataCore({
    altActive: true,
    altMenu: {
      menu: {
        '1': {
          TUESDAY: { dinner: 'Alt dinner' }
        }
      }
    },
    localOverlay: {
      '1': {
        TUESDAY: { dinner: 'Local overlay dinner' }
      }
    }
  });

  // No publish override: alt mode returns the alt source directly.
  assert.equal(core.getMenuData()['1'].TUESDAY.dinner, 'Alt dinner');

  // During publish the STANDARD-menu overlay (concMenuBase, pre-merged with
  // cloud) is set as the override. It must NOT be layered onto the reno menu:
  // that would clobber a reno slot and inject standard-only days into the reno
  // content published as menu_current.json (cross-source contamination).
  core.setDoorPublishMenuOverlayOverride({
    '1': {
      TUESDAY: { dinner: 'Cloud publish overlay dinner' }, // would clobber a reno slot
      WEDNESDAY: { dinner: 'Standard-only day' }           // a day absent from the reno menu
    }
  });
  const published = core.getMenuData();
  assert.equal(published['1'].TUESDAY.dinner, 'Alt dinner', 'reno slot must not be clobbered by the standard publish overlay');
  assert.equal(published['1'].WEDNESDAY, undefined, 'a standard-only day must not be injected into the reno menu');

  core.setDoorPublishMenuOverlayOverride(null);
  assert.equal(core.getMenuData()['1'].TUESDAY.dinner, 'Alt dinner');
});

test('getMenuData still applies normal overlay in standard menu mode', () => {
  const core = loadMenuDataCore({
    altActive: false,
    menuData: {
      '1': {
        MONDAY: { lunch: 'Base lunch', dinner: 'Base dinner' }
      }
    },
    localOverlay: {
      '1': {
        MONDAY: { lunch: 'Overlay lunch' }
      }
    }
  });

  const menu = core.getMenuData();

  assert.equal(menu['1'].MONDAY.lunch, 'Overlay lunch');
  assert.equal(menu['1'].MONDAY.dinner, 'Base dinner');
});

test('publish flow shim ends green on a clean publish', async () => {
  const harness = loadPublishFlowHarness({
    localOverlay: { '1': { MONDAY: { lunch: 'Local lunch' } } }
  });

  const result = await harness.context._doPublishToGitHub(true);
  const pushedPaths = harness.pushed.map((entry) => entry.path);
  const lastSync = harness.syncBars.at(-1);

  assert.deepEqual(pushedPaths, [
    'menu_current.json',
    'registry_summary.json',
    'routing_by_meal.json',
    'door_state.json',
    'menu_overlay.json',
    'custom_tag_rules.json',
    'learned_nr.json',
    'meal_swaps.json',
    'special_meals.json',
    'recent_log.json'
  ]);
  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'advisory'), false);
  assert.match(harness.statusEl.textContent, /Published/);
  assert.equal(harness.statusEl.style.color, 'var(--forest)');
  assert.match(lastSync.message, /Pushed to GitHub/);
  assert.equal(lastSync.color, 'var(--forest)');
});

test('publish flow shim builds menu and routing from pre-merged cloud overlay', async () => {
  const harness = loadPublishFlowHarness({
    localOverlay: { '1': { MONDAY: { lunch: 'Local lunch' } } },
    preMergeOverlayWithCloud: async (creds, localOverlay) => ({
      '1': {
        ...localOverlay['1'],
        TUESDAY: { dinner: 'Cloud dinner' }
      }
    }),
    configureContext(context) {
      context.buildMenuJSON = () => {
        const artifact = makePublishArtifact('menu_current.json');
        const overlay = context._doorPublishMenuOverlayOverride || {};
        if (overlay['1'] && overlay['1'].TUESDAY && overlay['1'].TUESDAY.dinner) {
          artifact.menu['1'].TUESDAY.dinner = overlay['1'].TUESDAY.dinner;
        }
        return artifact;
      };
      context.buildRoutingByMealJSON = () => {
        const artifact = makePublishArtifact('routing_by_meal.json');
        const overlay = context._doorPublishMenuOverlayOverride || {};
        if (overlay['1'] && overlay['1'].TUESDAY && overlay['1'].TUESDAY.dinner) {
          artifact.routing['1'].TUESDAY.dinner._components[overlay['1'].TUESDAY.dinner] = 1;
        }
        return artifact;
      };
    }
  });

  const result = await harness.context._doPublishToGitHub(true);
  const lastSync = harness.syncBars.at(-1);
  const overlayPush = harness.pushed.find((entry) => entry.path === 'menu_overlay.json');
  const menuPush = harness.pushed.find((entry) => entry.path === 'menu_current.json');
  const routingPush = harness.pushed.find((entry) => entry.path === 'routing_by_meal.json');

  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'advisory'), false);
  assert.match(harness.statusEl.textContent, /Published/);
  assert.equal(harness.statusEl.style.color, 'var(--forest)');
  assert.match(lastSync.message, /Pushed to GitHub/);
  assert.equal(lastSync.color, 'var(--forest)');
  assert.equal(overlayPush.content['1'].TUESDAY.dinner, 'Cloud dinner');
  assert.equal(JSON.parse(harness.storage.concMenuBase)['1'].TUESDAY.dinner, 'Cloud dinner');
  assert.equal(menuPush.content.menu['1'].TUESDAY.dinner, 'Cloud dinner');
  assert.equal(routingPush.content.routing['1'].TUESDAY.dinner._components['Cloud dinner'], 1);
  assert.equal(harness.overlayOverrides.length, 2);
  assert.equal(harness.overlayOverrides[0]['1'].TUESDAY.dinner, 'Cloud dinner');
  assert.equal(harness.overlayOverrides[1], null);
  assert.equal(harness.context._doorPublishMenuOverlayOverride, null);
});

test('publish flow shim keeps partial publish red when overlay days are merged', async () => {
  const harness = loadPublishFlowHarness({
    localOverlay: { '1': { MONDAY: { lunch: 'Local lunch' } } },
    skippedPath: 'menu_current.json',
    skippedReason: 'empty_clobber',
    preMergeOverlayWithCloud: async (creds, localOverlay) => ({
      '1': {
        ...localOverlay['1'],
        TUESDAY: { dinner: 'Cloud dinner' }
      }
    })
  });

  const result = await harness.context._doPublishToGitHub(true);
  const lastSync = harness.syncBars.at(-1);

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'blocked');
  assert.match(harness.statusEl.textContent, /Partial publish/);
  assert.equal(harness.statusEl.style.color, '#dc2626');
  assert.match(lastSync.message, /Partial publish/);
  assert.equal(lastSync.color, '#dc2626');
});

test('publish flow shim does not end green when preflight finds a Stop-level structural defect', async () => {
  const harness = loadPublishFlowHarness({
    localOverlay: { '1': { MONDAY: { lunch: 'Local lunch' } } },
    buildMenuJSON: () => {
      const artifact = makePublishArtifact('menu_current.json');
      // Drop a required contract day: the validator flags a Stop-level
      // menu-day-missing, but the artifact is still valid JSON and publishes.
      delete artifact.menu['1'].MONDAY;
      return artifact;
    }
  });

  const result = await harness.context._doPublishToGitHub(true);
  const lastSync = harness.syncBars.at(-1);

  // Gate-5 preflight stays non-blocking, so the file still publishes…
  assert.equal(result.ok, true);
  assert.ok(result.validationStop >= 1, 'a detected Stop issue must be surfaced on the result');
  assert.equal(result.degraded, true, 'a Stop-flagged publish must be marked degraded so the auto-publish wrapper renders it red');
  // …but the terminal signal must NOT read green: a flagged-corrupt snapshot at
  // the single upstream source stays red + persistent so staff verify downstream.
  assert.doesNotMatch(harness.statusEl.textContent, /Published ✓/);
  assert.match(harness.statusEl.textContent, /preflight Stop/i);
  assert.equal(harness.statusEl.style.color, '#dc2626');
  assert.notEqual(lastSync.color, 'var(--forest)');
  assert.match(lastSync.message, /Stop/i);
});

test('publishAndSync renders a degraded (Stop-flagged) auto-publish RED, not green', async () => {
  const h = loadPublishAndSyncHarness({ result: { ok: true, degraded: true, message: 'Published with 1 preflight Stop issue — verify downstream' } });
  h.context.publishAndSync('generate');
  await new Promise((r) => setTimeout(r, 10));
  const last = h.syncBars.at(-1);
  assert.notEqual(last.color, 'var(--forest)', 'a degraded auto-publish must not paint the sync bar green');
  assert.equal(last.color, '#dc2626');
  assert.match(last.message, /Stop/i);
});

test('publishAndSync paints a clean auto-publish green', async () => {
  const h = loadPublishAndSyncHarness({ result: { ok: true } });
  h.context.publishAndSync('generate');
  await new Promise((r) => setTimeout(r, 10));
  const last = h.syncBars.at(-1);
  assert.equal(last.color, 'var(--forest)');
  assert.match(last.message, /Synced/);
});

test('publish flow shim routes builder failures through visible publish failure handling', async () => {
  const harness = loadPublishFlowHarness({
    buildMenuJSON: () => {
      throw new Error('builder exploded');
    }
  });

  await assert.rejects(
    () => harness.context._doPublishToGitHub(true),
    /builder exploded/
  );

  assert.match(harness.statusEl.textContent, /Failed: builder exploded/);
  assert.equal(harness.statusEl.style.color, '#dc2626');
  assert.ok(harness.toasts.some((message) => /Publish failed/i.test(message)));
});

test('publish flow shim skips auto-publish from a stale tab (saved locally, not pushed)', async () => {
  const harness = loadPublishFlowHarness({
    tabStale: true,
    localOverlay: { '1': { MONDAY: { lunch: 'Local lunch' } } }
  });

  const result = await harness.context._doPublishToGitHub(false);

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'stale-tab');
  assert.equal(harness.pushed.length, 0, 'a stale tab must not push anything on auto-publish');
});

test('manual publish from a stale tab proceeds only when the operator confirms', async () => {
  const confirmHarness = loadPublishFlowHarness({
    tabStale: true,
    confirm: () => true,
    localOverlay: { '1': { MONDAY: { lunch: 'Local lunch' } } }
  });
  const confirmed = await confirmHarness.context._doPublishToGitHub(true);
  assert.equal(confirmed.ok, true, 'a confirmed manual publish should proceed');
  assert.ok(confirmHarness.pushed.length > 0, 'a confirmed manual publish should push');

  const cancelHarness = loadPublishFlowHarness({
    tabStale: true,
    confirm: () => false,
    localOverlay: { '1': { MONDAY: { lunch: 'Local lunch' } } }
  });
  const cancelled = await cancelHarness.context._doPublishToGitHub(true);
  assert.equal(cancelled.skipped, true);
  assert.equal(cancelled.reason, 'stale-tab-cancelled');
  assert.equal(cancelHarness.pushed.length, 0, 'a cancelled stale-tab publish must not push');
});

test('publish flow shim surfaces missing credentials before pushing', async () => {
  const harness = loadPublishFlowHarness({
    credentialsError: 'GitHub token is not configured for publish.'
  });

  await assert.rejects(
    () => harness.context._doPublishToGitHub(true),
    /GitHub token is not configured/
  );

  assert.deepEqual(harness.pushed, []);
  assert.ok(harness.rememberedFailures.some((message) => /GitHub token/i.test(message)));
  assert.ok(harness.toasts.some((message) => /GitHub token/i.test(message)));
  assert.match(harness.statusEl.textContent, /Failed: GitHub token is not configured/);
  assert.equal(harness.statusEl.style.color, '#dc2626');
});

test('published JSON snapshots are parseable and carry metadata', () => {
  const requiredArtifacts = [
    'menu_current.json',
    'menu_reno.json',
    'routing_by_meal.json',
    'door_state.json',
    'registry_summary.json'
  ];

  for (const artifact of requiredArtifacts) {
    const data = readJson(artifact);
    assert.equal(typeof data, 'object', `${artifact} should parse as an object`);
    assert.ok(data._meta, `${artifact} should carry _meta provenance`);
  }
});

test('menu_current.json keeps the four-week menu contract shape', () => {
  const menu = readJson('menu_current.json');

  assertMenuContractShape(menu, 'menu_current.json');
});

test('menu_reno.json keeps the current reno four-week menu contract shape', () => {
  const menu = readJson('menu_reno.json');

  assertMenuContractShape(menu, 'menu_reno.json');
});

test('routing_by_meal.json keeps numeric sections and component portion maps', () => {
  const routing = readJson('routing_by_meal.json');
  const routingWeeks = routing.routing;
  const weekKeys = Object.keys(routingWeeks || {});

  assert.ok(routingWeeks && typeof routingWeeks === 'object', 'routing_by_meal.json should expose routing{}');
  assert.ok(weekKeys.length > 0, 'routing_by_meal.json should contain week entries');

  let checkedMealSlots = 0;
  let slotsWithComponents = 0;

  for (const weekKey of weekKeys) {
    const week = routingWeeks[weekKey];
    assert.equal(typeof week, 'object', `${weekKey} should be an object`);

    for (const [dayName, day] of Object.entries(week)) {
      assert.equal(typeof day, 'object', `${weekKey}.${dayName} should be an object`);

      for (const [mealName, meal] of Object.entries(day)) {
        assert.equal(typeof meal, 'object', `${weekKey}.${dayName}.${mealName} should be an object`);
        checkedMealSlots += 1;

        for (const [sectionName, value] of Object.entries(meal)) {
          if (sectionName === '_components') continue;
          assert.equal(typeof value, 'number', `${weekKey}.${dayName}.${mealName}.${sectionName} should be numeric`);
          assert.ok(Number.isFinite(value), `${weekKey}.${dayName}.${mealName}.${sectionName} should be finite`);
        }

        if (meal._components) {
          slotsWithComponents += 1;
          for (const [componentName, portions] of Object.entries(meal._components)) {
            assert.equal(typeof portions, 'number', `${componentName} portions should be numeric`);
            assert.ok(Number.isFinite(portions), `${componentName} portions should be finite`);
          }
        }
      }
    }
  }

  assert.ok(checkedMealSlots > 0, 'routing_by_meal.json should contain meal slots');
  assert.ok(slotsWithComponents > 0, 'routing_by_meal.json should preserve _components portion maps');
});

test('door_state.json keeps registry data and provenance fields', () => {
  const state = readJson('door_state.json');

  assert.ok(state._meta, 'door_state.json should carry _meta provenance');
  assert.ok(Array.isArray(state.residents), 'door_state.json should carry residents[]');
  assert.ok(state.residents.length > 0, 'door_state.json residents should not be empty');
  assert.ok(Array.isArray(state.anaphRooms), 'door_state.json should carry anaphRooms[]');

  for (const [index, resident] of state.residents.entries()) {
    assert.equal(typeof resident.room, 'string', `resident ${index} should carry room`);
    assert.ok(resident.room.trim(), `resident ${index} room should not be empty`);
    assert.ok(Array.isArray(resident.tags), `resident ${index} should carry tags[]`);
  }
});
