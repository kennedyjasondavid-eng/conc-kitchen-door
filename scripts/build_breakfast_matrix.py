"""Build review data from the frozen selected manual tabs and actual current DOOR output.

This does not write resident/menu data. Inputs are the comparison JSON and binding
producer receipt; the latter contains a fresh 28-slot capture and controlled B0 cases.
"""
import argparse, hashlib, json, re, subprocess
from datetime import datetime, timezone
from pathlib import Path

p=argparse.ArgumentParser()
p.add_argument('--comparison',type=Path,required=True)
p.add_argument('--capture',type=Path,required=True)
p.add_argument('--output',type=Path,required=True)
a=p.parse_args()
source=json.loads(a.comparison.read_text(encoding='utf-8'))
capture=json.loads(a.capture.read_text(encoding='utf-8'))
manual=[m for m in source['selected'] if m['period']=='breakfast']
actual={(m['week'],m['day']):m for m in capture['breakfast']['slots']}
registry={r['room']:r for r in capture['breakfast']['registry']}
masters={r['room']:r for r in source['registryComparison']}
assert len(manual)==28 and len(actual)==28

families={'SUNDAY':'B01','MONDAY':'B02','TUESDAY':'B03','WEDNESDAY':'B04','THURSDAY':'B05','FRIDAY':'B06','SATURDAY':'B07'}
slots=[];variants=[];coverage=[];issues=[]

def concerns(room,meal,explicit):
    r=registry[room]; tags=r.get('tags',[]); out=[]
    if not explicit:out.append('Standard inferred from absence; suitability not proved')
    if 'GF' in tags and re.search(r'\b(bread|roll|muffin|bagel|pancake|cereal|oatmeal|granola)\b',meal,re.I) and not re.search(r'\bGF\b|gluten free',meal,re.I):
        out.append('GF component/substitution not established by this description')
    if any(t in tags for t in ['Halal','No Pork']) and re.search(r'\b(pork|ham)\b',meal,re.I):out.append('Pork/ham description conflicts with current Halal/No Pork requirement')
    if 'No Soy' in tags and re.search(r'\bsoy\s+milk\b|\btofu\b',meal,re.I):out.append('Soy ingredient description conflicts with No Soy')
    if 'Vegetarian' in tags and re.search(r'\b(ham|pork|turkey|chicken|fish|deli)\b',meal,re.I):
        out.append('Animal-protein description needs a vegetarian replacement')
    if 'No Eggs' in tags and re.search(r'\beggs?\b|frittata',meal,re.I):out.append('Egg-containing description conflicts with No Eggs')
    if 'No Dairy' in tags and re.search(r'yog|cheese|frittata|pancake|milk',meal,re.I):out.append('Exact milk-free formula/product required; LF is not proof')
    if 'Lactose Intolerant' in tags and re.search(r'yog|cheese|milk',meal,re.I) and not re.search(r'\b(LF|DF)\b|lactose free|dairy free|oat milk|soy milk',meal,re.I):
        out.append('Lactose-compatible components not specified')
    if 'Soft Meals' in tags:out.append('Current soft preparation/texture instruction must travel with plate')
    if 'No Processed Food' in tags and re.search(r'patty|deli|bacon|sausage|ham',meal,re.I):out.append('Product/formulation suitability for No Processed Food unresolved')
    if room=='709' and re.search('pepper',meal,re.I):out.append('No Pepper note versus tofu-pepper recipe needs ingredient/scope check')
    if room=='1207':out.append('Preserve nut avoidance and Soy Milk only; verify GF/lactose-compatible products')
    if room=='1007':out.append('Smaller starch + extra protein; no rice/pasta; quantities unspecified; no inferred GF tag')
    return '; '.join(out)

for m in manual:
    wk,day=m['week'],m['day']; family=families[day]; current=actual[(wk,day)]
    known={r['room']:r for r in current['residents']}
    slot_id=f'W{wk}-{day[:3]}'
    sections=m['sections']
    slots.append([slot_id,family,wk,day,m['main'],current['main'],m['file'],m['tab'],m['mainCell'],len(sections),
        ' | '.join(s['meal'] for s in sections if re.search(r'gluten|\bGF\b',s['title'],re.I)),
        ' | '.join(s['meal'] for s in sections if re.search(r'vegan|vegetarian',s['title'],re.I)),
        ' | '.join(m.get('footerNotes',[])),
        'Authoritative selected manual definition; secondary requirements/product facts still checked'])
    by_room={}
    for i,s in enumerate(sections,1):
        vid=f'{slot_id}-V{i:02}'
        variants.append([vid,family,wk,day,s['title'],s['meal'],s.get('contains',''),len(s['rooms']),
            ', '.join(r['room'] for r in s['rooms']),m['file'],m['tab'],s['titleCell'],s['mealCell'],
            'Manual heading is not ingredient proof; complete recipe/product references required'])
        for r in s['rooms']:by_room.setdefault(r['room'],[]).append((vid,s,r))
    for room,r in registry.items():
        picks=by_room.get(room,[(slot_id+'-STD',{'title':'Standard inferred','meal':m['main']},{'cell':'','note':''})])
        for vid,s,manual_r in picks:
            intended=s['meal'];override=''
            if room=='301a' and day=='TUESDAY':
                intended=re.sub(r'\bsoy\s+milk\b','Oat Milk',intended,flags=re.I)
                override='Jason: Oat milk only (2026-11-16); source soy wording retained in separate column'
            if room=='1007':override+='; Jason: smaller breakfast starch portion + extra protein; No Rice / Pasta. No quantities supplied.'
            concern=concerns(room,intended,room in by_room)
            if len(picks)>1:concern='AMBIGUOUS DUPLICATE: preserve both source rows until resolved; '+concern
            c=known[room]
            coverage.append([slot_id,room,vid,s['title'],s['meal'],intended,manual_r.get('cell',''),
                'Explicit' if room in by_room else 'Inferred standard',len(picks)>1,
                ', '.join(r.get('tags',[])),r.get('serviceNote',''),manual_r.get('note',''),
                override.strip('; '),c['group'],c['plate'],c.get('conflictNote',''),concern,masters[room]['manual'],masters[room]['manualCell'],c.get('legacyComputedPlate','')])
            if concern:issues.append((slot_id,room,concern))

decisions=[
 ['D01','Confirmed','301a / all Tuesday breakfasts','Oat milk only','Replace source soy wording in intended plate; preserve GF and all other instructions. Registry/operational breakfast migration is separate.'],
 ['D02','Confirmed, quantities unspecified','1007 / all breakfasts','Smaller starch portion plus extra protein; no rice/pasta','Keep Low Sodium/Low Carb and protein preference. No permanent GF tag inferred. Do not invent serving quantities.'],
 ['D03','Unresolved duplicate','1007 / W3 Wednesday','Ham frittata B18 versus vegetable frittata B68','Registry accommodations supplied; they do not themselves identify one source assignment. Resolve one compatible plate after recipe/product checks.'],
 ['D04','Ingredient facts needed','Breakfast products','GF/regular/vegan pancakes; breads/rolls/muffins; cereal/Chex; deli/bacon; patties; vegan cheese; yoghurt; plant milks; granola','Obtain exact products/formulas from kitchen/CODEX. These are not requests to approve the already selected manual dishes again.'],
 ['D05','Preserve current instruction','1207','Soy Milk only; nut avoidance','Older almond permission does not clear current avoidance. Check GF/lactose-compatible substitutions for every selected plate.'],
 ['D06','Confirmed unresolved','607a and other dairy/nut exclusions','No Dairy yoghurt substitute needs confirming','Jason supplied an Activia LF-style example, not a confirmed SKU. Linked assortment lists milk, modified corn starch and gelatin. This is lactose-free dairy, not milk-free; exact No Dairy substitute remains unknown.'],
 ['D07','Representation change needed','301a / 304 / 412 / 1207 and other combinations','Full plate + secondary component substitutions','One first-match section and one GF meal cannot describe every manual variant while preserving all requirements. See B0 proof.'],
 ['D08','Ingredient/scope check','709 / Saturday tofu-pepper scramble','No Pepper note versus recipe components','Keep note; do not silently interpret pepper as only black pepper or only chilli.'],
 ['D09','Preparation/product check','614b / soft or plain meals','Retain actual week-specific plain/oatmeal/tofu plates','No Processed Food/Low Sodium/Diabetic and texture instructions require compatible formulas and preparation; no clinical texture class or quantity is inferred.']]

case_rows=[]
expected={('TUESDAY','301a'):'Chex cereal, Oat Milk, Whole Fruit',('TUESDAY','1207'):'Chex cereal, Soy Milk, Whole Fruit',
    ('SUNDAY','304'):'WW Bread, Veg patty, Shredded vegan cheese + DF Yogurt & Fruit',
    ('SUNDAY','412'):'WW Bread, Veg patty, Shredded vegan cheese + DF Yogurt & Fruit'}
for c in capture['breakfast']['cases']:
    case_rows.append([c['week'],c['day'],c['room'],', '.join(c['tags']),c['key'],c['plate'],expected[(c['day'],c['room'])],
        'Controlled trial populates current fields only; not operational data. Demonstrates secondary requirement/variant loss.'])

binding_rows=[]
for b in capture['bindings']:
    binding_rows.append([b['decision'],b['week'],b['day'],b['period'],b['recipeName'],b['recipeId'],
        ' | '.join(b['declaredAllergens']),', '.join(r['room'] for r in b['recipients']),b['recipeFingerprint'],b['preparation']])

sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
provenance={'asOf':datetime.now(timezone.utc).isoformat(),'doorCaptureAsOf':capture['asOf'],'manualAuthority':'User: visible tabs matching current rotation; current manual plating sheets govern intended served meals; ambiguous duplicates flagged',
    'manualZipSha256':source['provenance']['manualZipSha256'],'comparisonSha256':sha(a.comparison),'captureSha256':sha(a.capture),
    'codeBaseline':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'codex':capture['codex'],
    'summary':{'breakfastSlots':len(slots),'selectedVariants':len(variants),'activeResidents':len(registry),
        'expectedResidentServices':len(registry)*28,'coverageRows':len(coverage),'extraDuplicateRows':len(coverage)-len(registry)*28,
        'rowsWithEvidenceOrPreparationQuestions':len(issues)},
    'productEvidence':{'state':'Example only; No Dairy substitute confirmed as needing confirmation; not a runtime food-fact record','exampleUrl':'https://www.costcobusinesscentre.ca/p/-/activia-lactose-free-yogurt-24--100-g/2001134688','exampleListedIngredients':['milk','modified corn starch','gelatin'],'manufacturerUrl':'https://www.activia.com/en-ca/all-products/lactose-free/product/plain-650g/','boundary':'Other flavours/formulas differ. No actual SKU or dairy-free product selected; verify package before use.'},
    'scope':'Review matrix and B0 design proof; no breakfast menu or resident data migration; inferred standard is not service compatibility approval'}

book={
 'Breakfast matrix':{'headers':['Slot','Family','Week','Day','Authoritative manual main','Current DOOR main','Manual book','Tab','Main cell','Variants','Manual GF descriptions','Manual vegan/vegetarian descriptions','Footer instructions','State'],'rows':slots},
 'Plate variants':{'headers':['Variant','Family','Week','Day','Manual section','Intended plate','Manual CONTAINS (not validated facts)','Listed rows','Source rooms (evidence, not routing policy)','Book','Tab','Section cell','Meal cell','Evidence state'],'rows':variants},
 'Resident coverage':{'headers':['Slot','Room','Variant','Manual group','Original manual plate','Intended plate after confirmed instructions','Source cell','Authority','Duplicate','Current tags','Current registry note','Manual row note','New confirmed instruction','Current DOOR group','Current DOOR plate','Current conflict note','Evidence/preparation questions','Manual master instructions (source)','Master cell','Legacy routing fallback (pending model)'],'rows':coverage},
 'Decisions':{'headers':['ID','State','Scope','Decision/fact','Handling'],'rows':decisions},
 'B0 proof':{'headers':['Week','Day','Room','Current requirements','First-match section','Existing-field trial output','Required manual/user variant','Interpretation'],'rows':case_rows},
 'Recipe bindings':{'headers':['ID','Week','Day','Meal','Canonical plate name','CODEX recipe ID','Declared allergens','Affected source rooms','Recipe fingerprint','Preparation boundary'],'rows':binding_rows},
 'Provenance':{'headers':['Input','Value'],'rows':[[k,json.dumps(v,ensure_ascii=False) if isinstance(v,(dict,list)) else v]for k,v in provenance.items()]}}
a.output.mkdir(parents=True,exist_ok=True)
(a.output/'breakfast-workbook-data.json').write_text(json.dumps(book,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(a.output/'breakfast-matrix-receipt.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(provenance['summary']))
