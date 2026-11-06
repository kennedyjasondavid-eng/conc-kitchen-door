// F1b extends (never changes) the frozen F1a applying transport and publisher.
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { ApplyingRemote, publishBox, html, fn, plain, initialRemote } from './door_publish_transaction_box.mjs';
export { plain, initialRemote };

export class RecoveryRemote extends ApplyingRemote {
  constructor(files) { super(files); this.readCounts = new Map(); this.onRead = null; }
  async fetch(url, opts = {}) {
    const u = new URL(url), method = opts.method || 'GET';
    const file = u.pathname.includes('/contents/') ? decodeURIComponent(u.pathname.split('/contents/')[1]) : null;
    if (method === 'GET' && file) {
      const count = (this.readCounts.get(file) || 0) + 1;
      this.readCounts.set(file, count);
      if (this.onRead) await this.onRead({ file, count, ref: u.searchParams.get('ref'), remote: this });
    }
    const response = await super.fetch(url, opts);
    if (method !== 'GET' || !file || !response.ok) return response;
    const body = await response.json();
    // The real guard uses byte size; the original F1a harness deliberately stubbed it.
    if (typeof body.content === 'string') body.size = Buffer.from(body.content, 'base64').length;
    return { ...response, json: async () => plain(body) };
  }
}

export const roster = (rooms, at, anaph = []) => ({
  _meta: { version: 30, exported: at, registryModifiedAt: at, count: rooms.length },
  residents: rooms.map(room => ({ room, tags: anaph.includes(room) ? ['anaphylactic'] : [], notes: 'synthetic staff note' })),
  anaphRooms: anaph
});

export function recoveryBox(options = {}) {
  const storage = options.storage || {};
  if (!storage.concRegistryState) {
    const local = options.localRegistry || roster(['TEST-LOCAL'], '2026-11-04T08:00:00.000Z');
    storage.concRegistryState = JSON.stringify(local);
    storage.concRegistryProvenance = local._meta.registryModifiedAt;
    storage['conc-door-anaph'] = JSON.stringify(local.anaphRooms);
  }
  const box = publishBox({ ...options, storage, remote: options.remote || new RecoveryRemote(initialRemote()) });
  const { c } = box;
  const local = JSON.parse(storage.concRegistryState);
  c.REGISTRY_LIST = plain(local.residents);
  c.anaphRooms = JSON.parse(storage['conc-door-anaph']);
  c.REGISTRY_MAP = Object.fromEntries(c.REGISTRY_LIST.map(r => [r.room.toLowerCase(), r]));
  c.TextEncoder = TextEncoder;
  c._ghHydrated = true;
  c._ghForceOverwrite = false;
  const allowShrink = /const ALLOW_SHRINK_PATHS = new Set\(\[[\s\S]*?\]\);/.exec(html);
  assert.ok(allowShrink, 'real write-guard configuration must be available');
  vm.runInContext(allowShrink[0] + '\n' + fn('_ghEvaluateWriteGuards') + '\n' + fn('getRegistryProvenanceTs'), c);
  const originalState = c.buildStateJSON, originalSummary = c.buildRegistrySummaryJSON, originalRouting = c.buildRoutingByMealJSON;
  c.buildStateJSON = () => ({ ...originalState(), _meta: {
    ...originalState()._meta, count: c.REGISTRY_LIST.length,
    registryModifiedAt: storage.concRegistryProvenance
  }, residents: plain(c.REGISTRY_LIST), anaphRooms: plain(c.anaphRooms) });
  c.buildRegistrySummaryJSON = () => ({ ...originalSummary(), headcounts: { total: c.REGISTRY_LIST.length } });
  c.buildRoutingByMealJSON = () => {
    const value = originalRouting();
    const regular = c.REGISTRY_LIST.filter(r => !c.anaphRooms.includes(r.room)).length;
    for (const days of Object.values(value.routing)) for (const meals of Object.values(days)) for (const slot of Object.values(meals)) {
      slot.Regular = regular; slot.Vegetarian = 0;
      for (const key of Object.keys(slot._components)) slot._components[key] = regular;
    }
    return value;
  };
  box.setRegistry = value => {
    c.REGISTRY_LIST.splice(0, c.REGISTRY_LIST.length, ...plain(value.residents));
    c.anaphRooms = plain(value.anaphRooms);
    storage.concRegistryState = JSON.stringify(value);
    storage.concRegistryProvenance = value._meta.registryModifiedAt;
    storage['conc-door-anaph'] = JSON.stringify(value.anaphRooms);
  };
  box.installEntryPoints = () => {
    c.mealSwaps = {};
    c.getMealForDate = () => ({ week: 2, day: 'FRIDAY' });
    c.getMenuData = () => c.buildMenuJSON().menu;
    c.dayLabel = day => day;
    c.logMenuEvent = () => {};
    c.renderMenuConfig = () => {};
    c.doorAsk = async () => true;
    c.doorRotationWeekOf = () => 2;
    c.doorMealCopy = (day, period) => ({ '': day[period] });
    c.doorCopyValue = plain;
    c.getSelectedSite = () => 'fixture';
    c.formatShortDate = date => date.toISOString().slice(0, 10);
    box.load('revertSwapFromBanner', 'removeSpecialMeal', 'executeSlotSwap', 'getSundayStart');
  };
  return box;
}
