// W3c, 2026-11-08 (Week 3 post-mortem log 2, 6, 7, 9). Each check names the kitchen failure it prevents:
//  3. the import review can't reach the right recipe ("Vegan Wrap" never offered Piri Piri Tofu Wrap);
//  4. typing in a slot adds to the old words ("Chicken a la KingGarden a la"), and pressing a result's text saves the
//     half-typed words instead of the recipe;
//  5. linking a recipe replaces Rex's words on the menu with the recipe's name;
//  7. the halal question doesn't say which dish it is about.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
function fnBlock(name) {
  const m = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(html);
  assert.ok(m, 'missing function ' + name);
  let d = 0, i = html.indexOf('{', m.index);
  for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}' && --d === 0) break; }
  return html.slice(m.index, i + 1);
}
const out = (v) => JSON.parse(JSON.stringify(v));

test('3. the import review offers every recipe that fits, after the suggestions, A–Z', () => {
  const c = {
    DOOR_RECIPE_DATA: [{ recipeName: 'Vegan Wrap Filling', ok: true }, { recipeName: 'Piri Piri Tofu Wrap', ok: true },
      { recipeName: 'Beef Stew', ok: false }, { recipeName: 'Ginger Tofu & <Portobello>', ok: true }],
    doorRexAccept: (role, r) => r.ok,
    _escAttr: (v) => String(v).replace(/"/g, '&quot;').replace(/</g, '&lt;'),
    escapeHtml: (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  };
  vm.createContext(c);
  vm.runInContext(fnBlock('doorRexAllRecipeOptions') + '\nthis.f = doorRexAllRecipeOptions;', c);
  const h = c.f({ role: 'veganalt', suggest: ['Vegan Wrap Filling'] });
  assert.match(h, /Every other recipe/);
  assert.ok(h.indexOf('Ginger Tofu') < h.indexOf('Piri Piri Tofu Wrap'), 'A–Z');
  assert.ok(!h.includes('Vegan Wrap Filling'), 'a suggestion isn\'t listed twice');
  assert.ok(!h.includes('Beef Stew'), 'only recipes that fit the dish\'s role');
  assert.ok(!h.includes('<Portobello>'), 'names are escaped');
  assert.match(fnBlock('doorRexQuestionHTML'), /doorRexAllRecipeOptions\(nd\)/, 'the review uses it');
});

test('4. the slot box selects its words on focus, and a result is chosen on press anywhere on its row', () => {
  assert.match(html, /onfocus="\$\{_escAttr\('this\.select\(\);' \+ fn \+ 'Search\(/, 'typing replaces the old words');
  for (const [fn, sel] of [['slotSearch', 'slotSelect'], ['smSlotSearch', 'smSlotSelect']]) {
    const body = fnBlock(fn);
    assert.ok(body.includes("onmousedown=\"event.preventDefault();${_escJsAttrCall('" + sel + "'"), fn + ': chosen on press');
    assert.ok(!body.includes("onclick=\"${_escJsAttrCall('" + sel + "'"), fn + ': not on click, which can lose to the box closing');
  }
});

function select(current, recipeName) {
  const state = { main: current };
  const c = {
    MEAL_SLOT_STATE: state, isHubLoaded: () => true,
    DOOR_RECIPE_DATA: [{ recipeName: 'Garden a la King', allergens: [] }, { recipeName: 'Chicken a la King', allergens: [] }],
    doorLinkFlags: () => ({}), renderSlots() {}, updateSlotSummary() {}, document: { getElementById: () => null }
  };
  vm.createContext(c);
  vm.runInContext(fnBlock('slotSelect') + '\nslotSelect("main", ' + JSON.stringify(recipeName) + ');', c);
  return out(state.main);
}
test('5. linking a hand-typed dish keeps the menu\'s words', () => {
  assert.equal(select({ manual: 'Chicken a la King (Rex)' }, 'Chicken a la King').displayText, 'Chicken a la King (Rex)');
  assert.equal(select({ manual: 'chicken a la king' }, 'Chicken a la King').displayText, undefined, 'the same words: nothing to keep');
  assert.equal(select({ recipeName: 'Garden a la King', displayText: 'Veg a la King' }, 'Chicken a la King').displayText, undefined,
    'a different recipe on a linked slot still drops the old dish\'s words');
  assert.equal(select(null, 'Chicken a la King').displayText, undefined);
});

test('7. the halal question names its dish and what DOOR read the meat from, escaped', () => {
  const save = fnBlock('saveMenuEdit');
  assert.match(save, /slotBreakdown\.about = \{[\s\S]{0,400}dish: _askSlot\.displayText \|\| _askSlot\.recipeName \|\| _askSlot\.manual/);
  const dlg = fnBlock('_showHalalCertDialog');
  assert.match(dlg, /About the \$\{escapeHtml\(slotBreakdown\.about\.slot\)\}: <strong>\$\{escapeHtml\(slotBreakdown\.about\.dish\)\}<\/strong>/);
  assert.match(dlg, /from \$\{escapeHtml\(slotBreakdown\.about\.from\)\}/);
});
