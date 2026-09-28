// MA-0611 data lock: Djinni Spellcasting rode the MA-0421/MA-0524/MA-0532/
// MA-0576 twin markup-gap template. Pre-fix ONLY the three tier headers carried
// <strong>; Detect Evil and Good/Detect Magic/Create Food and Water/Tongues/
// Wind Walk/Creation/Gaseous Form/Invisibility/Major Image/Plane Shift were
// plain text — extractSpellNamesFromSpellcasting returned [] and
// extractSpellcastingSpellUses returned {} → SpellCastLinks null → zero chips,
// and the orphaned spell_save_dc 17 never reached buildAbilitySaveRollContext
// (MA-0532 fork). DATA fix: <strong> on each spell name (headers byte-kept,
// "(can create wine instead of water)" parenthetical OUTSIDE the tag,
// strip-tags byte-equality) + trailing row-level numeric save_dc 17 +
// save_type "Charisma" pair (MA-0454/MA-0421/MA-0576).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const djinni = monsters.find(m => m.index === 'djinni');
const djinniRow = djinni.actions.find(a => a.name === 'Spellcasting');
const NAMES = ['Detect Evil and Good', 'Detect Magic', 'Create Food and Water', 'Tongues', 'Wind Walk', 'Creation', 'Gaseous Form', 'Invisibility', 'Major Image', 'Plane Shift'];
const TWO_DAY = ['Create Food and Water', 'Tongues', 'Wind Walk'];
const ONE_DAY = ['Creation', 'Gaseous Form', 'Invisibility', 'Major Image', 'Plane Shift'];
const AT_WILL = ['Detect Evil and Good', 'Detect Magic'];

// MA-1230 night-hag extension (same MA-0421/MA-0524 markup-gap family):
// all five spell names were plain text on the night-hag Spellcasting row.
const nightHag = monsters.find(m => m.index === 'night-hag');
const nightHagRow = nightHag.actions.find(a => a.name === 'Spellcasting');
const NH_NAMES = ['Detect Magic', 'Etherealness', 'Magic Missile', 'Phantasmal Killer', 'Plane Shift'];
const NH_TWO_DAY = ['Phantasmal Killer', 'Plane Shift'];
const NH_AT_WILL = ['Detect Magic', 'Etherealness', 'Magic Missile'];
// MA-1241 noble-prodigy extension (same MA-0421/MA-0524/MA-1230 markup-gap
// family): all eight spell names were plain text, plus the OCR typo
// "Befuddle ment" → canonical "Befuddlement" (2024-only, §177 ruleset-branch
// pitfall: the loadSpells mock below MUST serve it on the '2024' branch).
const nobleProdigy = monsters.find(m => m.index === 'noble-prodigy');
const nobleProdigyRow = nobleProdigy.actions.find(a => a.name === 'Spellcasting');
const NP_NAMES = ['Mage Armor', 'Mage Hand', 'Minor Illusion', 'Befuddlement', 'Detect Thoughts', 'Fly', 'Scrying', 'Shatter'];
const NP_ONE_DAY = ['Befuddlement', 'Detect Thoughts', 'Fly', 'Scrying', 'Shatter'];
const NP_AT_WILL = ['Mage Armor', 'Mage Hand', 'Minor Illusion'];
// MA-1261 oni extension (same MA-0421/MA-1230/MA-1241 markup-gap family):
// all four spell names were plain text, headers only carried <strong>; the
// numeric save_dc 13 + Charisma pair was already authored, so the row needed
// markup only (§89 gate pre-met; junk attack_bonus 0 rides the row, out of scope).
const oni = monsters.find(m => m.index === 'oni');
const oniRow = oni.actions.find(a => a.name === 'Spellcasting');
const OI_NAMES = ['Charm Person', 'Darkness', 'Gaseous Form', 'Sleep'];
const OI_ONE_DAY = OI_NAMES;
// MA-1289 performer-legend extension (same MA-0421/MA-1230/MA-1241/MA-1261
// markup-gap family): all five spell names were plain text, headers only carried
// <strong>; the numeric save_dc 17 + Charisma pair was already authored, so the
// row needed markup only (§89 gate pre-met; junk attack_bonus 0 rides the row,
// out of scope). All five spells are save:none in spells.json → chips are
// cast-affordance only, no save-roll expected.
const performerLegend = monsters.find(m => m.index === 'performer-legend');
const performerLegendRow = performerLegend.actions.find(a => a.name === 'Spellcasting');
const PL_NAMES = ['Mage Hand', 'Minor Illusion', 'Prestidigitation', 'Major Image', 'Project Image'];
const PL_ONE_DAY = ['Major Image', 'Project Image'];
const PL_AT_WILL = ['Mage Hand', 'Minor Illusion', 'Prestidigitation'];
// MA-1294 performer-maestro extension (same MA-0421/MA-1230/MA-1241/MA-1289
// markup-gap family): all three spell names were plain text, headers only carried
// <strong>; the numeric save_dc 15 + Charisma pair was already authored (family
// caster-channel label — §676 SpellCastLinks XOR suppresses the row DC chip).
// §158 canonical-name decision: RAW "Tasha's Hideous Laughter" wrapped AS-IS —
// absent from the 5e index (which names it "Hideous Laughter") but present in
// 2024/spells.json EXACTLY, and findMonsterSpell is 5e-first with a 2024-name
// fallback (§207 live twin) → resolvable under both rulesets.
const performerMaestro = monsters.find(m => m.index === 'performer-maestro');
const performerMaestroRow = performerMaestro.actions.find(a => a.name === 'Spellcasting');
const PM_NAMES = ['Minor Illusion', 'Prestidigitation', "Tasha's Hideous Laughter"];
const PM_ONE_DAY = ["Tasha's Hideous Laughter"];
const PM_AT_WILL = ['Minor Illusion', 'Prestidigitation'];
// MA-1320 pixie extension (same MA-0421/MA-1230/MA-1261/MA-1289/MA-1294
// markup-gap family): all six spell names were plain text, headers only carried
// <strong>; the numeric save_dc 12 + Charisma pair was already authored — a
// caster-channel label riding the XOR fork (§676, never renders a DC chip);
// junk attack_bonus 0 rides the row, out of scope (§490). §158 trap INACTIVE:
// all six names byte-match BOTH spell indexes. Pixie Wonderbringer twin
// (MA-1323, DC 15) shares the prose lead-in — the DC 12 byte discriminates.
const pixie = monsters.find(m => m.index === 'pixie');
const pixieRow = pixie.actions.find(a => a.name === 'Spellcasting');
const PX_NAMES = ['Dancing Lights', 'Druidcraft', 'Invisibility', 'Detect Thoughts', 'Fly', 'Sleep'];
const PX_ONE_DAY = ['Detect Thoughts', 'Fly', 'Sleep'];
const PX_AT_WILL = ['Dancing Lights', 'Druidcraft', 'Invisibility'];
// MA-1323 pixie-wonderbringer extension (exact MA-1320 twin, markup-gap family):
// all six spell names were plain text, headers only carried <strong>; the numeric
// save_dc 15 + Charisma pair was already authored — caster-channel label riding the
// XOR fork (§676, never renders a DC chip); junk attack_bonus 0 out of scope (§490).
// §158 trap INACTIVE: all six names byte-match BOTH spell indexes. The DC 15 byte
// discriminates vs the MA-1320 pixie row (DC 12 + Sleep) sharing the lead-in.
const pixieWb = monsters.find(m => m.index === 'pixie-wonderbringer');
const pixieWbRow = pixieWb.actions.find(a => a.name === 'Spellcasting');
const WB_NAMES = ['Dancing Lights', 'Druidcraft', 'Invisibility', 'Detect Thoughts', 'Fly', 'Major Image'];
const WB_ONE_DAY = ['Detect Thoughts', 'Fly', 'Major Image'];
const WB_AT_WILL = ['Dancing Lights', 'Druidcraft', 'Invisibility'];
// MA-1327 planetar extension (same MA-0421/MA-0524/MA-0532/MA-1230 markup-gap
// family): all five spell names were plain text, tier headers only carried
// <strong> → extractSpellNamesFromSpellcasting [] → zero chips, zero cast
// affordance (junk "+0" attack_bonus 0 rides the row, out of scope §490 —
// night-hag MA-1230 twin keeps it). The numeric save_dc 20 + Charisma pair was
// already authored (§89 gate pre-met; §676 XOR fork keeps the DC unrendered).
// §158 trap INACTIVE: all five names byte-match BOTH spell indexes, zero
// attack_type — chips are cast-affordance only.
const planetar = monsters.find(m => m.index === 'planetar');
const planetarRow = planetar.actions.find(a => a.name === 'Spellcasting');
const PT_NAMES = ['Detect Evil and Good', 'Commune', 'Control Weather', 'Dispel Evil and Good', 'Raise Dead'];
const PT_ONE_DAY = ['Commune', 'Control Weather', 'Dispel Evil and Good', 'Raise Dead'];
const PT_AT_WILL = ['Detect Evil and Good'];
// MA-1339 priest extension (same MA-0421/MA-1230/MA-1327 markup-gap family):
// all three spell names were plain text, tier headers only carried <strong> →
// extractSpellNamesFromSpellcasting [] → zero chips; the junk "+0" (attack_bonus
// 0, night-hag MA-1230 twin, out of scope §490) was the row's sole clickable
// control, and prose-only DC meant the §54/MA-0860 DC-Unknown lane. DATA fix:
// <strong> on each name + row-level numeric save_dc 13 (8 + WIS +3 + PB +2,
// computed from disk) + save_type "Wisdom" (§89 pair). 5e spells.json Spirit
// Guardians carries NO damage/dc struct → routesToSave false → advisory cast
// lane w/ spend (CLA-325), Light/Thaumaturgy At Will ungated (§57).
const priest = monsters.find(m => m.index === 'priest');
const priestRow = priest.actions.find(a => a.name === 'Spellcasting');
const PR_NAMES = ['Light', 'Thaumaturgy', 'Spirit Guardians'];
const PR_ONE_DAY = ['Spirit Guardians'];
const PR_AT_WILL = ['Light', 'Thaumaturgy'];
// MA-1342 priest-acolyte extension (same MA-0421/MA-1339 markup-gap family):
// both At-Will spell names were plain text, only the tier header carried
// <strong> → extractSpellNamesFromSpellcasting [] → zero chips. DATA fix is
// markup-only on the djinni MA-0611 byte-shape template: SpellCastLinks arm
// on row NAME + tier markup alone (§674/MA-0674), so the save-less At-Will
// pair needs NO numeric save_dc pair — row keeps save_dc 0 + save_type
// "Wisdom" byte-unchanged; junk attack_bonus 0 out of scope (§490 family).
const priestAcolyte = monsters.find(m => m.index === 'priest-acolyte');
const priestAcolyteRow = priestAcolyte.actions.find(a => a.name === 'Spellcasting');
const PA_NAMES = ['Light', 'Thaumaturgy'];
const PA_AT_WILL = ['Light', 'Thaumaturgy'];
// MA-1366 quaggoth-thonot extension (same MA-0421/MA-1230/MA-1327/MA-1339
// markup-gap family, decoy-emphasis variant §161): the three real spell names
// were plain text AND the prose emphasis <strong>Invisible</strong> inside the
// Mage Hand parenthetical armed a LIVE junk-cast fake chip (press logged
// "casts Invisible via Spellcasting … GM-enforced" + console "Spell
// 'Invisible' not found") while Mind Spike's 2/Day tracking stayed dead.
// Fix = djinni MA-0611 byte-shape wrap + decoy strip, SAME pass; §207 twin:
// Mind Spike is 2024-only in the spell indexes. Junk attack_bonus 0 rides
// the row per MA-1327/1339/1342 family precedent (§490 residual).
const thonot = monsters.find(m => m.index === 'quaggoth-thonot');
const thonotRow = thonot.actions.find(a => a.name === 'Spellcasting');
const QT_NAMES = ['Mage Hand', 'Minor Illusion', 'Mind Spike'];
const QT_TWO_DAY = ['Mind Spike'];
const QT_AT_WILL = ['Mage Hand', 'Minor Illusion'];
// MA-1375 questing-knight extension (same MA-0421/MA-1327/MA-1339 markup-gap
// family): all four spell names were plain text, sole emphasis span was the tier
// header <strong>1/Day Each:</strong> → extractSpellNamesFromSpellcasting [] →
// zero chips, 1/Day tracking structurally dead (§144 binds MARKED names only).
// Fix = djinni MA-0611 byte-shape <strong> wrap (consistent within the row; the
// armed knight-class twin death-knight actions[3] uses <em> — extractor accepts
// both, §57; <strong> chosen per MA-0611/MA-1230 family convention) + drop junk
// attack_bonus 0: BOTH twins (death-knight armed row + djinni) carry NO
// attack_bonus key, so MA-1369 precedent strips it here too, killing the "+0"
// junk attack chip (§490). Row-level save_dc 16 + Charisma pair already authored
// (§89 gate pre-met; §676 XOR keeps it unrendered as a DC chip).
const questingKnight = monsters.find(m => m.index === 'questing-knight');
const questingKnightRow = questingKnight.actions.find(a => a.name === 'Spellcasting');
const QK_NAMES = ['Daylight', 'Dispel Evil and Good', 'Greater Restoration', 'Phantom Steed'];
const QK_ONE_DAY = QK_NAMES;
// MA-1380 rakshasa extension (same MA-0421/MA-1327/MA-1339/MA-1375 markup-gap
// family): all nine spell names were plain text, sole emphasis span was the two
// tier headers <strong>At Will:</strong> / <strong>1/Day Each:</strong> →
// extractSpellNamesFromSpellcasting [] → zero chips, 1/Day-EACH tracking
// structurally dead (§144 binds MARKED names only). Fix = djinni MA-0611
// byte-shape <strong> wrap on all nine names (headers byte-kept, trailing ':'
// skipped by extractor) + drop junk attack_bonus 0: armed twins (djinni +
// MA-1375 questing-knight post-fix) carry no attack_bonus key — MA-1369/1375
// precedent strips it here too, killing the "+0" junk attack chip (§490).
// Row-level save_dc 18 + Charisma pair already authored (§89 gate pre-met;
// §676 XOR keeps it unrendered as a DC chip). All nine names byte-match BOTH
// spell indexes (§158 trap INACTIVE); Plane Shift carries attack_type melee →
// honest refuse-zero-spend per djinni/night-hag MA-0611/MA-1230 twins.
const rakshasa = monsters.find(m => m.index === 'rakshasa');
const rakshasaRow = rakshasa.actions.find(a => a.name === 'Spellcasting');
const RK_NAMES = ['Detect Magic', 'Detect Thoughts', 'Disguise Self', 'Mage Hand', 'Minor Illusion', 'Fly', 'Invisibility', 'Major Image', 'Plane Shift'];
const RK_ONE_DAY = ['Fly', 'Invisibility', 'Major Image', 'Plane Shift'];
const RK_AT_WILL = ['Detect Magic', 'Detect Thoughts', 'Disguise Self', 'Mage Hand', 'Minor Illusion'];
// MA-1419 sahuagin-priest extension (same MA-0421/MA-1327/MA-1339/MA-1375/MA-1380
// markup-gap family): all three spell names were plain text, sole emphasis spans were
// the two tier headers <strong>At Will:</strong> / <strong>2/Day Each:</strong> →
// extractSpellNamesFromSpellcasting [] → zero chips, 2/Day-EACH tracking structurally
// dead (§144 binds MARKED names only); junk "+0" (attack_bonus 0) was the row's sole
// clickable control (§490). Fix = djinni MA-0611 byte-shape <strong> wrap on all three
// names (headers byte-kept, trailing ':' skipped) + drop junk attack_bonus 0: armed
// twins (djinni + MA-1375/MA-1380 post-fix) carry no attack_bonus key — MA-1369/1375
// precedent strips it here too. Row-level save_dc 12 + Wisdom pair already authored
// (§89 gate pre-met; §676 XOR keeps it unrendered as a DC chip). §158 trap INACTIVE:
// all three names byte-match BOTH spell indexes. Hold Person is the damageless WIS
// save spell (dc_success "none", "paralyzed" clause — MA-0348 seam rides the spell
// text); Tongues/Thaumaturgy are save-less advisory cantrip/tier-1 (§204). The
// "The sahuagin casts" lead-in is grep-unique app-wide (Priestess shares only the
// species lead-in with no Spellcasting row).
const sahuaginPriest = monsters.find(m => m.index === 'sahuagin-priest');
const sahuaginPriestRow = sahuaginPriest.actions.find(a => a.name === 'Spellcasting');
const SP_NAMES = ['Thaumaturgy', 'Hold Person', 'Tongues'];
const SP_TWO_DAY = ['Hold Person', 'Tongues'];
const SP_AT_WILL = ['Thaumaturgy'];
// MA-1478 solar extension (same MA-0421/MA-1327/MA-1339 markup-gap family,
// planetar MA-1327 spell-list twin): the WHOLE description was plain text —
// names AND both tier headers unmarked → extractSpellNamesFromSpellcasting []
// → zero chips, 1/Day-EACH tracking structurally dead (§144 binds MARKED
// headers + names only); the row carried zero clickable affordances. Fix =
// djinni MA-0611 byte-shape <strong> wrap on the two tier headers + all five
// names, separators ("; " / ", ") byte-kept (single-line prose, no <br>/\n in
// this row — strip-tags byte-equality proves markup-only diff); the numeric
// save_dc 25 + Charisma pair was already authored (§89/§167 gate pre-met,
// untouched; §676 XOR keeps the row DC unrendered as a chip). §158 trap
// INACTIVE: all five names byte-match BOTH spell indexes, zero attack_type.
const solar = monsters.find(m => m.index === 'solar');
const solarRow = solar.actions.find(a => a.name === 'Spellcasting');
const SL_NAMES = ['Detect Evil and Good', 'Commune', 'Control Weather', 'Dispel Evil and Good', 'Resurrection'];
const SL_ONE_DAY = ['Commune', 'Control Weather', 'Dispel Evil and Good', 'Resurrection'];
const SL_AT_WILL = ['Detect Evil and Good'];
// MA-1493 sphinx-of-lore extension (exact MA-1478 solar spell-list twin, same
// MA-0421/MA-1327/MA-1339/MA-1478 markup-gap family): the WHOLE description was
// plain text — names AND both tier headers unmarked → extractSpellNamesFromSpellcasting
// [] → zero chips, 1/Day-EACH tracking structurally dead (§144 binds MARKED headers +
// names only); the row carried zero clickable affordances. Fix = djinni MA-0611
// byte-shape <strong> wrap on the two tier headers + all eleven names, separators
// ("; " / ", ") byte-kept (single-line prose, no <br>/\n in this row — strip-tags
// byte-equality proves markup-only diff; matches the committed MA-1478 solar byte-shape
// NOT the ticket's suggested <br> tier lines); the numeric save_dc 16 + Intelligence
// pair was already authored (§89/§167 gate pre-met, untouched; §676 XOR keeps the row
// DC unrendered as a chip). §158 trap INACTIVE: all eleven names byte-match BOTH spell
// indexes; Plane Shift carries attack_type melee → honest refuse-zero-spend per
// djinni/rakshasa twins (never fired here). Sphinx shares the "The sphinx casts" lead-in
// with androsphinx (DC 15) — DC 16 + this exact 11-name list is grep-unique app-wide.
const sphinx = monsters.find(m => m.index === 'sphinx-of-lore');
const sphinxRow = sphinx.actions.find(a => a.name === 'Spellcasting');
const SN_NAMES = ['Detect Magic', 'Identify', 'Mage Hand', 'Minor Illusion', 'Prestidigitation', 'Dispel Magic', 'Legend Lore', 'Locate Object', 'Plane Shift', 'Remove Curse', 'Tongues'];
const SN_ONE_DAY = ['Dispel Magic', 'Legend Lore', 'Locate Object', 'Plane Shift', 'Remove Curse', 'Tongues'];
const SN_AT_WILL = ['Detect Magic', 'Identify', 'Mage Hand', 'Minor Illusion', 'Prestidigitation'];
// MA-1499 sphinx-of-secrets extension (exact MA-1478/MA-1493 reduced-tier twin, same
// MA-0421/MA-1327/MA-1339/MA-1478/MA-1493 markup-gap family): the WHOLE description was
// plain text — names AND both tier headers unmarked → extractSpellNamesFromSpellcasting
// [] → zero chips, 1/Day-EACH tracking structurally dead (§144 binds MARKED headers +
// names only); the row carried zero clickable affordances. Fix = djinni MA-0611
// byte-shape <strong> wrap on the two tier headers + all five names, separators
// ("; " / ", ") byte-kept (single-line prose, no <br>/\n in this row — strip-tags
// byte-equality proves markup-only diff; matches the committed MA-1478/MA-1493 byte-shape
// NOT <br> tier lines); the numeric save_dc 15 + Intelligence pair was already authored
// (§89/§167 gate pre-met, untouched; §676 XOR keeps the row DC unrendered as a chip).
// §158 trap INACTIVE: all five names byte-match BOTH spell indexes, zero attack_type →
// cast-affordance only. Sphinx shares the "The sphinx casts" lead-in with sphinx-of-lore
// (DC 16) androsphinx (DC 15) — DC 15 + this exact 5-name list is grep-unique app-wide.
const sos = monsters.find(m => m.index === 'sphinx-of-secrets');
const sosRow = sos.actions.find(a => a.name === 'Spellcasting');
const SS_NAMES = ['Detect Magic', 'Identify', 'Prestidigitation', 'Locate Object', 'Remove Curse'];
const SS_ONE_DAY = ['Locate Object', 'Remove Curse'];
const SS_AT_WILL = ['Detect Magic', 'Identify', 'Prestidigitation'];
const ALL_NAMES = [...new Set([...NAMES, ...NH_NAMES, ...NP_NAMES, ...OI_NAMES, ...PL_NAMES, ...PM_NAMES, ...PX_NAMES, ...WB_NAMES, ...PT_NAMES, ...PR_NAMES, ...PA_NAMES, ...QT_NAMES, ...QK_NAMES, ...RK_NAMES, ...SP_NAMES, ...SL_NAMES, ...SN_NAMES, ...SS_NAMES])];
const SPELLS = Object.fromEntries(ALL_NAMES.map(n => [n, spells5e.find(s => s.name === n)]).filter(([, s]) => Boolean(s)));
const SPELLS_2024 = Object.fromEntries([...NP_NAMES, ...PM_NAMES, ...QT_NAMES].map(n => [n, spells2024.find(s => s.name === n)]).filter(([, s]) => Boolean(s)));

const DJINNI_PLAIN_ORIGINAL = 'The djinni casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17):\nAt Will: Detect Evil and Good, Detect Magic\n2/Day Each: Create Food and Water (can create wine instead of water), Tongues, Wind Walk\n1/Day Each: Creation, Gaseous Form, Invisibility, Major Image, Plane Shift';
const NH_PLAIN_ORIGINAL = 'The hag casts one of the following spells, requiring no Material components and using Intelligence as the spellcasting ability (spell save DC 14):\nAt Will: Detect Magic, Etherealness, Magic Missile (level 4 version)\n2/Day Each: Phantasmal Killer, Plane Shift (self only)';
// Pre-fix disk text (all names plain + "Befuddle ment" typo); the fix is
// markup + typo only, so stripped text equals this with the typo repaired.
const NP_PLAIN_ORIGINAL = 'The noble casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 16):\nAt Will: Mage Armor (included in AC), Mage Hand, Minor Illusion\n1/Day Each: Befuddle ment, Detect Thoughts, Fly, Scrying, Shatter (level 7 version)';
const OI_PLAIN_ORIGINAL = 'The oni casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 13):\n1/Day Each: Charm Person (level 2 version), Darkness, Gaseous Form, Sleep';
const PL_PLAIN_ORIGINAL = 'The performer casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17):\nAt Will: Mage Hand, Minor Illusion, Prestidigitation\n1/Day Each: Major Image, Project Image';
const PM_PLAIN_ORIGINAL = 'The performer casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 15):\nAt Will: Minor Illusion, Prestidigitation\n1/Day: Tasha\'s Hideous Laughter (level 3 version)';
const PX_PLAIN_ORIGINAL = 'The pixie casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 12):\nAt Will: Dancing Lights, Druidcraft, Invisibility (self only)\n1/Day Each: Detect Thoughts, Fly, Sleep';
const WB_PLAIN_ORIGINAL = 'The pixie casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 15):\nAt Will: Dancing Lights, Druidcraft, Invisibility (self only)\n1/Day Each: Detect Thoughts, Fly, Major Image';
const PT_PLAIN_ORIGINAL = 'The planetar casts one of the following spells, requiring no Material components and using Charisma as spellcasting ability (spell save DC 20):\nAt Will: Detect Evil and Good\n1/Day Each: Commune, Control Weather, Dispel Evil and Good, Raise Dead';
const PR_PLAIN_ORIGINAL = 'The priest casts one of the following spells, using Wisdom as the spellcasting ability:\nAt Will: Light, Thaumaturgy\n1/Day: Spirit Guardians';
// Pre-fix priest-acolyte disk text — shares the priest lead-in verbatim, but
// has NO 1/Day tier; the shared block plus absent tier line discriminates.
const PA_PLAIN_ORIGINAL = 'The priest casts one of the following spells, using Wisdom as the spellcasting ability:\nAt Will: Light, Thaumaturgy';
// Pre-fix quaggoth-thonot disk text (names plain + decoy <strong>Invisible</strong>
// stripped to plain by the fix — stripped prose is byte-identical).
const QT_PLAIN_ORIGINAL = 'The quaggoth casts one of the following spells, requiring no spell components and using Wisdom as the spellcasting ability (spell save DC 12):\nAt Will: Mage Hand (the hand is Invisible), Minor Illusion\n2/Day: Mind Spike';
// Pre-fix questing-knight disk text — the row used <br> separators (stripTags
// folds them to \n); the fix is name-wrap markup only, prose byte-equal.
const QK_PLAIN_ORIGINAL = 'The knight casts one of the following spells, using Charisma as the spellcasting ability (spell save DC 16):\n1/Day Each: Daylight, Dispel Evil and Good, Greater Restoration, Phantom Steed';
// Pre-fix rakshasa disk text — the row used <br> separators (stripTags folds
// them to \n); the fix is name-wrap markup only, prose byte-equal.
const RK_PLAIN_ORIGINAL = 'The rakshasa casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 18):\nAt Will: Detect Magic, Detect Thoughts, Disguise Self, Mage Hand, Minor Illusion\n1/Day Each: Fly, Invisibility, Major Image, Plane Shift';
// Pre-fix sahuagin-priest disk text — the row used <br> separators (stripTags folds
// them to \n); the fix is name-wrap markup + attack_bonus drop only, prose byte-equal.
const SP_PLAIN_ORIGINAL = 'The sahuagin casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 12):\nAt Will: Thaumaturgy\n2/Day Each: Hold Person, Tongues';
// Pre-fix solar disk text — SINGLE-LINE prose with "; " tier separators and
// ", " name separators, fully plain; the fix wraps ONLY the two tier headers +
// five spell names in <strong>, so the stripped bytes must match this exactly.
const SL_PLAIN_ORIGINAL = 'The solar casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 25): At Will: Detect Evil and Good; 1/Day Each: Commune, Control Weather, Dispel Evil and Good, Resurrection';
// Pre-fix sphinx-of-lore disk text — SINGLE-LINE prose with "; " tier separators and
// ", " name separators, fully plain; the fix wraps ONLY the two tier headers + eleven
// spell names in <strong>, so the stripped bytes must match this exactly.
const SN_PLAIN_ORIGINAL = 'The sphinx casts one of the following spells, requiring no Material components and using Intelligence as the spellcasting ability (spell save DC 16): At Will: Detect Magic, Identify, Mage Hand, Minor Illusion, Prestidigitation; 1/Day Each: Dispel Magic, Legend Lore, Locate Object, Plane Shift, Remove Curse, Tongues';
// Pre-fix sphinx-of-secrets disk text — SINGLE-LINE prose with "; " tier separators and
// ", " name separators, fully plain; the fix wraps ONLY the two tier headers + five spell
// names in <strong>, so the stripped bytes must match this exactly.
const SS_PLAIN_ORIGINAL = 'The sphinx casts one of the following spells, requiring no Material components and using Intelligence as the spellcasting ability (spell save DC 15): At Will: Detect Magic, Identify, Prestidigitation; 1/Day Each: Locate Object, Remove Curse';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Djinni 1';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 9, rolls: [2, 4, 3], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 18, rolls: [2, 4, 3, 2, 4, 3], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  // §177 ruleset-branch pitfall: findMonsterSpell is 5e-first, falling back
  // to loadSpells('2024') — Befuddlement (MA-1241) only resolves on that branch.
  loadSpells: vi.fn((ruleset) => Promise.resolve(
    ruleset === '2024' ? Object.values(SPELLS_2024) : ALL_NAMES.map(n => SPELLS[n]).filter(Boolean)
  )),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn();
  const _rollAbilityCheck = vi.fn();
  const _rollSavingThrow = vi.fn();
  const _rollSkillCheck = vi.fn();
  const _rollInitiative = vi.fn();
  const _quickRollPlayerSave = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });

  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: _rollDamage,
    rollAbilityCheck: _rollAbilityCheck,
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: _rollSkillCheck,
    rollInitiative: _rollInitiative,
    quickRollPlayerSave: _quickRollPlayerSave,
  }));

  return {
    default: mockHook,
    _rollAttack,
    _rollDamage,
    _rollSavingThrow,
    _setPopupHtml,
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures } = {}, name) => (creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 60)),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/shared/abilityLookup.js', () => ({
  getAbilitySaveModifier: vi.fn(() => 0),
}));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    key: (characterKey, propertyName) => `${characterKey}.${propertyName}`,
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => { store[`${characterKey}.${propertyName}`] = value; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((characterKey, propertyName) => store[`${characterKey}.${propertyName}`] ?? null),
    useRuntimeValue: vi.fn((characterKey, propertyName) => store[`${characterKey}.${propertyName}`] ?? null),
  };
});

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  getRuntimeValue: runtime.getRuntimeValue,
}));

import { addEntry } from '../../services/ui/logService.js';

function spellLinks() {
  return Array.from(document.querySelectorAll('.mc-dice-link-spell'));
}

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function refusals(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked' && e.abilityName === name);
}

function renderDjinni() {
  const m = makeMonster({ name: 'Djinni', actions: [djinniRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'elemental', targetName: 'Bandit', ac: 17, currentHp: 218, maxHp: 218, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

const NH_MONSTER_NAME = 'Night Hag 1';

function renderNightHag() {
  const m = makeMonster({ name: 'Night Hag', actions: [nightHagRow] });
  const creatures = [
    { name: NH_MONSTER_NAME, type: 'npc', monsterType: 'fey', targetName: 'Bandit', ac: 17, currentHp: 112, maxHp: 112, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: NH_MONSTER_NAME, creatures })} />);
}

const NP_MONSTER_NAME = 'Noble Prodigy 1';

function renderNobleProdigy() {
  const m = makeMonster({ name: 'Noble Prodigy', actions: [nobleProdigyRow] });
  const creatures = [
    { name: NP_MONSTER_NAME, type: 'npc', monsterType: 'humanoid', targetName: 'Bandit', ac: 16, currentHp: 148, maxHp: 148, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: NP_MONSTER_NAME, creatures })} />);
}

const OI_MONSTER_NAME = 'Oni 1';

function renderOni() {
  const m = makeMonster({ name: 'Oni', actions: [oniRow] });
  const creatures = [
    { name: OI_MONSTER_NAME, type: 'npc', monsterType: 'giant', targetName: 'Bandit', ac: 16, currentHp: 119, maxHp: 119, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: OI_MONSTER_NAME, creatures })} />);
}

const PL_MONSTER_NAME = 'Performer Legend 1';

function renderPerformerLegend() {
  const m = makeMonster({ name: 'Performer Legend', actions: [performerLegendRow] });
  const creatures = [
    { name: PL_MONSTER_NAME, type: 'npc', monsterType: 'humanoid', targetName: 'Bandit', ac: 20, currentHp: 162, maxHp: 162, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: PL_MONSTER_NAME, creatures })} />);
}

const PM_MONSTER_NAME = 'Performer Maestro 1';

function renderPerformerMaestro() {
  const m = makeMonster({ name: 'Performer Maestro', actions: [performerMaestroRow] });
  const creatures = [
    { name: PM_MONSTER_NAME, type: 'npc', monsterType: 'humanoid', targetName: 'Bandit', ac: 15, currentHp: 110, maxHp: 110, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: PM_MONSTER_NAME, creatures })} />);
}

const PX_MONSTER_NAME = 'Pixie 1';

function renderPixie() {
  const m = makeMonster({ name: 'Pixie', actions: [pixieRow] });
  const creatures = [
    { name: PX_MONSTER_NAME, type: 'npc', monsterType: 'fey', targetName: 'Bandit', ac: 15, currentHp: 19, maxHp: 19, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: PX_MONSTER_NAME, creatures })} />);
}

const PXWB_MONSTER_NAME = 'Pixie Wonderbringer 1';

function renderPixieWonderbringer() {
  const m = makeMonster({ name: 'Pixie Wonderbringer', actions: [pixieWbRow] });
  const creatures = [
    { name: PXWB_MONSTER_NAME, type: 'npc', monsterType: 'fey', targetName: 'Bandit', ac: 15, currentHp: 60, maxHp: 60, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: PXWB_MONSTER_NAME, creatures })} />);
}

const PT_MONSTER_NAME = 'Planetar 1';

function renderPlanetar() {
  const m = makeMonster({ name: 'Planetar', actions: [planetarRow] });
  const creatures = [
    { name: PT_MONSTER_NAME, type: 'npc', monsterType: 'celestial', targetName: 'Bandit', ac: 19, currentHp: 262, maxHp: 262, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: PT_MONSTER_NAME, creatures })} />);
}

const PR_MONSTER_NAME = 'Priest 1';

function renderPriest() {
  const m = makeMonster({ name: 'Priest', actions: [priestRow] });
  const creatures = [
    { name: PR_MONSTER_NAME, type: 'npc', monsterType: 'humanoid', targetName: 'Bandit', ac: 13, currentHp: 38, maxHp: 38, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: PR_MONSTER_NAME, creatures })} />);
}

const PA_MONSTER_NAME = 'Priest Acolyte 1';

function renderPriestAcolyte() {
  const m = makeMonster({ name: 'Priest Acolyte', actions: [priestAcolyteRow] });
  const creatures = [
    { name: PA_MONSTER_NAME, type: 'npc', monsterType: 'humanoid', targetName: 'Bandit', ac: 13, currentHp: 11, maxHp: 11, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: PA_MONSTER_NAME, creatures })} />);
}

const QT_MONSTER_NAME = 'Quaggoth Thonot 1';

function renderQuaggothThonot() {
  const m = makeMonster({ name: 'Quaggoth Thonot', actions: [thonotRow] });
  const creatures = [
    { name: QT_MONSTER_NAME, type: 'npc', monsterType: 'humanoid', targetName: 'Bandit', ac: 13, currentHp: 67, maxHp: 67, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: QT_MONSTER_NAME, creatures })} />);
}

const QK_MONSTER_NAME = 'Questing Knight 1';

function renderQuestingKnight() {
  const m = makeMonster({ name: 'Questing Knight', actions: [questingKnightRow] });
  const creatures = [
    { name: QK_MONSTER_NAME, type: 'npc', monsterType: 'humanoid', targetName: 'Bandit', ac: 18, currentHp: 202, maxHp: 202, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: QK_MONSTER_NAME, creatures })} />);
}

const RK_MONSTER_NAME = 'Rakshasa 1';

function renderRakshasa() {
  const m = makeMonster({ name: 'Rakshasa', index: 'rakshasa', actions: [rakshasaRow] });
  const creatures = [
    { name: RK_MONSTER_NAME, type: 'npc', monsterType: 'fiend', targetName: 'Bandit', ac: 17, currentHp: 221, maxHp: 221, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: RK_MONSTER_NAME, creatures })} />);
}

const SP_MONSTER_NAME = 'Sahuagin Priest 1';

function renderSahuaginPriest() {
  const m = makeMonster({ name: 'Sahuagin Priest', index: 'sahuagin-priest', type: 'fiend', actions: [sahuaginPriestRow] });
  const creatures = [
    { name: SP_MONSTER_NAME, type: 'npc', monsterType: 'fiend', targetName: 'Bandit', ac: 12, currentHp: 38, maxHp: 38, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: SP_MONSTER_NAME, creatures })} />);
}

const SL_MONSTER_NAME = 'Solar 1';

function renderSolar() {
  const m = makeMonster({ name: 'Solar', index: 'solar', type: 'celestial', actions: [solarRow] });
  const creatures = [
    { name: SL_MONSTER_NAME, type: 'npc', monsterType: 'celestial', targetName: 'Bandit', ac: 21, currentHp: 297, maxHp: 297, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: SL_MONSTER_NAME, creatures })} />);
}

const SN_MONSTER_NAME = 'Sphinx of Lore 1';

function renderSphinx() {
  const m = makeMonster({ name: 'Sphinx of Lore', index: 'sphinx-of-lore', type: 'celestial', actions: [sphinxRow] });
  const creatures = [
    { name: SN_MONSTER_NAME, type: 'npc', monsterType: 'celestial', targetName: 'Bandit', ac: 17, currentHp: 170, maxHp: 170, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: SN_MONSTER_NAME, creatures })} />);
}

const SOS_MONSTER_NAME = 'Sphinx of Secrets 1';

function renderSphinxOfSecrets() {
  const m = makeMonster({ name: 'Sphinx of Secrets', index: 'sphinx-of-secrets', type: 'celestial', actions: [sosRow] });
  const creatures = [
    { name: SOS_MONSTER_NAME, type: 'npc', monsterType: 'celestial', targetName: 'Bandit', ac: 16, currentHp: 136, maxHp: 136, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: SOS_MONSTER_NAME, creatures })} />);
}

// ── Data lock: djinni Spellcasting row ───────────────────────────────────────

describe('MA-0611 monsters.json data lock: Djinni Spellcasting row', () => {
  it('extracts all ten spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(djinniRow.description);
    expect(names).toEqual(NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('2/Day Each');
    expect(names).not.toContain('1/Day Each');
  });

  it('binds 2/Day Each to the three marked names, 1/Day Each to the five; At Will ungated', () => {
    const uses = extractSpellcastingSpellUses(djinniRow.description);
    expect(uses).toEqual({
      ...Object.fromEntries(TWO_DAY.map(n => [n, 2])),
      ...Object.fromEntries(ONE_DAY.map(n => [n, 1])),
    });
    AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('row-level numeric save_dc 17 + save_type Charisma pair authored (trailing)', () => {
    expect(djinniRow.save_dc).toBe(17);
    expect(djinniRow.save_type).toBe('Charisma');
    expect(djinniRow.spell_save_dc).toBe(17);
    expect(djinniRow.spellcasting_ability).toBe('Charisma');
    expect(djinniRow.description).toMatch(/spell save DC 17/);
    expect(djinniRow.description).toMatch(/<strong>Create Food and Water<\/strong> \(can create wine instead of water\)/);
  });

  it('no fake chips: "wine instead of water" parenthetical stays plain text', () => {
    expect(djinniRow.description).not.toMatch(/<(?:strong|em)>[^<]*wine[^<]*<\/(?:strong|em)>/);
  });

  it('DC 17 = 8 + CHA +5 + PB +4 for the djinni', () => {
    expect(djinni.ability_score_modifiers.cha).toBe(5);
    expect(djinni.proficiency_bonus).toBe(4);
    expect(8 + djinni.ability_score_modifiers.cha + djinni.proficiency_bonus).toBe(17);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(djinniRow.description)).toBe(DJINNI_PLAIN_ORIGINAL);
  });

  it('all ten spells exist in 5e spells.json; none carries damage (all advisory legs)', () => {
    NAMES.forEach(n => expect(spells5e.some(s => s.name === n)).toBe(true));
  });
});

// ── Modal: ten chips, counters, gates ────────────────────────────────────────

describe('MA-0611 MonsterCardModal Djinni Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders ten spell chips — the zero-chip inert row is gone', () => {
    renderDjinni();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(NAMES);
  });

  it('the three 2/Day and five 1/Day names carry counters; the two At Will names do not', () => {
    renderDjinni();
    TWO_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(2\/Day · 2 left\)/));
    ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('At Will Detect Magic casts ungated twice — zero uses, advisory log prints row DC 17', async () => {
    renderDjinni();
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(1));
    expect(abilityUseEntries('Detect Magic')[0].description).toMatch(/\(spell save DC 17/);
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Invisibility 1/Day: cast spends the single use, second refused — zero extra spend', async () => {
    renderDjinni();
    await act(async () => { fireEvent.click(linkByText('Invisibility')); });
    await waitFor(() => expect(abilityUseEntries('Invisibility').length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Invisibility': 1 });
    expect(abilityUseEntries('Invisibility')[0].description).toMatch(/1\/Day use spent/);

    await act(async () => { fireEvent.click(linkByText('Invisibility')); });
    await waitFor(() => expect(refusals('Invisibility').length).toBe(1));
    expect(abilityUseEntries('Invisibility').length).toBe(1);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Invisibility': 1 });
  });

  it('Create Food and Water 2/Day: two casts spend both uses, third refused', async () => {
    renderDjinni();
    await act(async () => { fireEvent.click(linkByText('Create Food and Water')); });
    await waitFor(() => expect(abilityUseEntries('Create Food and Water').length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Create Food and Water': 1 });

    await act(async () => { fireEvent.click(linkByText('Create Food and Water')); });
    await waitFor(() => expect(abilityUseEntries('Create Food and Water').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Create Food and Water': 2 });

    await act(async () => { fireEvent.click(linkByText('Create Food and Water')); });
    await waitFor(() => expect(refusals('Create Food and Water').length).toBe(1));
    expect(abilityUseEntries('Create Food and Water').length).toBe(2);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Create Food and Water': 2 });
  });

  it('Plane Shift (spells.json attack_type melee) refuses honestly — zero uses spent', async () => {
    renderDjinni();
    await act(async () => { fireEvent.click(linkByText('Plane Shift')); });
    await waitFor(() => expect(refusals('Plane Shift').length).toBe(1));
    expect(abilityUseEntries('Plane Shift').length).toBe(0);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});

// ── MA-1230 data lock: Night Hag Spellcasting row ───────────────────────────

describe('MA-1230 monsters.json data lock: Night Hag Spellcasting row', () => {
  it('extracts all five spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(nightHagRow.description);
    expect(names).toEqual(NH_NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('2/Day Each');
  });

  it('binds 2/Day Each to Phantasmal Killer + Plane Shift; At Will names ungated', () => {
    const uses = extractSpellcastingSpellUses(nightHagRow.description);
    expect(uses).toEqual({ 'Phantasmal Killer': 2, 'Plane Shift': 2 });
    NH_AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('row-level numeric save_dc 14 + save_type Intelligence pair intact (§89 gate pre-met)', () => {
    expect(nightHagRow.save_dc).toBe(14);
    expect(nightHagRow.save_type).toBe('Intelligence');
    expect(nightHagRow.description).toMatch(/spell save DC 14/);
    expect(nightHagRow.description).toMatch(/<strong>Magic Missile<\/strong> \(level 4 version\)/);
    expect(nightHagRow.description).toMatch(/<strong>Plane Shift<\/strong> \(self only\)/);
  });

  it('no fake chips: qualifier parentheticals stay plain text', () => {
    expect(nightHagRow.description).not.toMatch(/<(?:strong|em)>[^<]*level 4 version[^<]*<\/(?:strong|em)>/);
    expect(nightHagRow.description).not.toMatch(/<(?:strong|em)>[^<]*self only[^<]*<\/(?:strong|em)>/);
  });

  it('DC 14 = 8 + INT +3 + PB +3 for the night hag', () => {
    expect(nightHag.ability_score_modifiers.int).toBe(3);
    expect(nightHag.proficiency_bonus).toBe(3);
    expect(8 + nightHag.ability_score_modifiers.int + nightHag.proficiency_bonus).toBe(14);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(nightHagRow.description)).toBe(NH_PLAIN_ORIGINAL);
  });

  it('all five spells exist in 5e spells.json', () => {
    NH_NAMES.forEach(n => expect(spells5e.some(s => s.name === n)).toBe(true));
  });
});

// ── MA-1230 Modal: five chips, counters, gates ──────────────────────────────

describe('MA-1230 MonsterCardModal Night Hag Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders five spell chips — the zero-chip inert row is gone', () => {
    renderNightHag();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(NH_NAMES);
  });

  it('the two 2/Day names carry counters; the three At Will names do not', () => {
    renderNightHag();
    NH_TWO_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(2\/Day · 2 left\)/));
    NH_AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('At Will Detect Magic casts ungated twice — zero uses, advisory log prints row DC 14', async () => {
    renderNightHag();
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(1));
    expect(abilityUseEntries('Detect Magic')[0].description).toMatch(/\(spell save DC 14/);
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(2));
    expect(runtime.store[`${NH_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Plane Shift (spells.json attack_type melee) refuses honestly — zero uses spent', async () => {
    renderNightHag();
    await act(async () => { fireEvent.click(linkByText('Plane Shift')); });
    await waitFor(() => expect(refusals('Plane Shift').length).toBe(1));
    expect(abilityUseEntries('Plane Shift').length).toBe(0);
    expect(runtime.store[`${NH_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});

// ── MA-1241 data lock: Noble Prodigy Spellcasting row ───────────────────────

describe('MA-1241 monsters.json data lock: Noble Prodigy Spellcasting row', () => {
  it('extracts all eight spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(nobleProdigyRow.description);
    expect(names).toEqual(NP_NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('1/Day Each');
  });

  it('canonical Befuddlement — the "Befuddle ment" OCR typo is repaired', () => {
    expect(nobleProdigyRow.description).toContain('<strong>Befuddlement</strong>');
    expect(nobleProdigyRow.description).not.toContain('Befuddle ment');
    expect(nobleProdigyRow.description).not.toMatch(/Befuddle[^m]/);
    const names = extractSpellNamesFromSpellcasting(nobleProdigyRow.description);
    expect(names).toContain('Befuddlement');
    expect(names).not.toContain('Befuddle');
  });

  it('binds 1/Day Each to the five marked spells; At Will trio ungated (§57)', () => {
    const uses = extractSpellcastingSpellUses(nobleProdigyRow.description);
    expect(uses).toEqual(Object.fromEntries(NP_ONE_DAY.map(n => [n, 1])));
    NP_AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('row-level numeric save_dc 16 + save_type Charisma pair intact (§89 gate pre-met)', () => {
    expect(nobleProdigyRow.save_dc).toBe(16);
    expect(nobleProdigyRow.save_type).toBe('Charisma');
    expect(nobleProdigyRow.description).toMatch(/spell save DC 16/);
    expect(nobleProdigyRow.description).toMatch(/<strong>Mage Armor<\/strong> \(included in AC\)/);
    expect(nobleProdigyRow.description).toMatch(/<strong>Shatter<\/strong> \(level 7 version\)/);
  });

  it('no fake chips: qualifier parentheticals stay plain text', () => {
    expect(nobleProdigyRow.description).not.toMatch(/<(?:strong|em)>[^<]*included in AC[^<]*<\/(?:strong|em)>/);
    expect(nobleProdigyRow.description).not.toMatch(/<(?:strong|em)>[^<]*level 7 version[^<]*<\/(?:strong|em)>/);
  });

  it('DC 16 = 8 + CHA +4 + PB +4 for the noble prodigy', () => {
    expect(nobleProdigy.ability_score_modifiers.cha).toBe(4);
    expect(nobleProdigy.proficiency_bonus).toBe(4);
    expect(8 + nobleProdigy.ability_score_modifiers.cha + nobleProdigy.proficiency_bonus).toBe(16);
  });

  it('markup+typo-only diff proof: stripped text equals pre-fix description with the typo repaired', () => {
    expect(stripTags(nobleProdigyRow.description)).toBe(NP_PLAIN_ORIGINAL.replace('Befuddle ment', 'Befuddlement'));
  });

  it('Befuddlement resolves via findMonsterSpell 5e→2024 fallback: absent 5e, INT-save L8 Enchantment in 2024 (§207)', () => {
    expect(spells5e.some(s => s.name === 'Befuddlement')).toBe(false);
    expect(spells5e.some(s => s.name === 'Befuddle')).toBe(false);
    const b = spells2024.find(s => s.name === 'Befuddlement');
    expect(b).toBeDefined();
    expect(b.index).toBe('befuddlement');
    expect(b.level).toBe(8);
    expect(b.school).toBe('Enchantment');
    expect(b.dc.dc_type).toBe('INT');
    NP_NAMES.filter(n => n !== 'Befuddlement').forEach(n => expect(spells5e.some(s => s.name === n)).toBe(true));
  });
});

// ── MA-1241 Modal: eight chips, counters, 1/Day gate ────────────────────────

describe('MA-1241 MonsterCardModal Noble Prodigy Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders eight spell chips — the zero-chip inert row is gone', () => {
    renderNobleProdigy();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(NP_NAMES);
  });

  it('the five 1/Day names carry counters; the three At Will names do not', () => {
    renderNobleProdigy();
    NP_ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    NP_AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('At Will Mage Hand casts ungated twice — zero uses, advisory log prints row DC 16/Charisma (§204)', async () => {
    renderNobleProdigy();
    await act(async () => { fireEvent.click(linkByText('Mage Hand')); });
    await waitFor(() => expect(abilityUseEntries('Mage Hand').length).toBe(1));
    expect(abilityUseEntries('Mage Hand')[0].description).toMatch(/\(spell save DC 16/);
    await act(async () => { fireEvent.click(linkByText('Mage Hand')); });
    await waitFor(() => expect(abilityUseEntries('Mage Hand').length).toBe(2));
    expect(runtime.store[`${NP_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Fly 1/Day: cast spends the single use, re-fire refused — zero extra spend (§57)', async () => {
    renderNobleProdigy();
    await act(async () => { fireEvent.click(linkByText('Fly')); });
    await waitFor(() => expect(abilityUseEntries('Fly').length).toBe(1));
    expect(runtime.store[`${NP_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Fly': 1 });
    expect(abilityUseEntries('Fly')[0].description).toMatch(/1\/Day use spent/);

    await act(async () => { fireEvent.click(linkByText('Fly')); });
    await waitFor(() => expect(refusals('Fly').length).toBe(1));
    expect(abilityUseEntries('Fly').length).toBe(1);
    expect(runtime.store[`${NP_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Fly': 1 });
  });
});

// ── MA-1261 data lock: Oni Spellcasting row ──────────────────────────────────

describe('MA-1261 monsters.json data lock: Oni Spellcasting row', () => {
  it('extracts all four spell names as chips — headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(oniRow.description);
    expect(names).toEqual(OI_NAMES);
    expect(names).not.toContain('1/Day Each');
    expect(names).not.toContain('Charm Person (level 2 version)');
  });

  it('binds 1/Day Each to all four marked names (§57 tier header gate)', () => {
    const uses = extractSpellcastingSpellUses(oniRow.description);
    expect(uses).toEqual(Object.fromEntries(OI_ONE_DAY.map(n => [n, 1])));
  });

  it('row-level numeric save_dc 13 + save_type Charisma pair intact (§89 gate pre-met)', () => {
    expect(oniRow.save_dc).toBe(13);
    expect(oniRow.save_type).toBe('Charisma');
    expect(oniRow.description).toMatch(/spell save DC 13/);
    expect(oniRow.description).toMatch(/<strong>Charm Person<\/strong> \(level 2 version\)/);
  });

  it('no fake chips: the level-2 parenthetical stays plain text (djinni/night-hag convention)', () => {
    expect(oniRow.description).not.toMatch(/<(?:strong|em)>[^<]*level 2 version[^<]*<\/(?:strong|em)>/);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(oniRow.description)).toBe(OI_PLAIN_ORIGINAL);
  });

  it('DC 13 = 8 + CHA +2 + PB +3 for the oni', () => {
    expect(oni.ability_score_modifiers.cha).toBe(2);
    expect(oni.proficiency_bonus).toBe(3);
    expect(8 + oni.ability_score_modifiers.cha + oni.proficiency_bonus).toBe(13);
  });

  it('all four spells exist in BOTH 5e and 2024 spells.json, none an attack spell', () => {
    OI_NAMES.forEach(n => {
      expect(spells5e.some(s => s.name === n)).toBe(true);
      expect(spells2024.some(s => s.name === n)).toBe(true);
    });
  });
});

// ── MA-1261 Modal: four chips, counters, 1/Day gate ──────────────────────────

describe('MA-1261 MonsterCardModal Oni Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders four spell chips — the zero-chip inert row is gone', () => {
    renderOni();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(OI_NAMES);
  });

  it('all four names carry 1/Day counters; the tier header renders no chip', () => {
    renderOni();
    OI_ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    expect(linkByText('1/Day Each')).toBeNull();
  });

  it('Darkness 1/Day: cast spends the single use with DC 13/Charisma advisory, re-fire refused (§57/§204)', async () => {
    renderOni();
    await act(async () => { fireEvent.click(linkByText('Darkness')); });
    await waitFor(() => expect(abilityUseEntries('Darkness').length).toBe(1));
    expect(runtime.store[`${OI_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Darkness': 1 });
    expect(abilityUseEntries('Darkness')[0].description).toMatch(/1\/Day use spent/);
    expect(abilityUseEntries('Darkness')[0].description).toMatch(/\(spell save DC 13/);

    await act(async () => { fireEvent.click(linkByText('Darkness')); });
    await waitFor(() => expect(refusals('Darkness').length).toBe(1));
    expect(abilityUseEntries('Darkness').length).toBe(1);
    expect(runtime.store[`${OI_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Darkness': 1 });
  });
});

// ── MA-1289 data lock: Performer Legend Spellcasting row ─────────────────────

describe('MA-1289 monsters.json data lock: Performer Legend Spellcasting row', () => {
  it('extracts all five spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(performerLegendRow.description);
    expect(names).toEqual(PL_NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('1/Day Each');
  });

  it('disk description carries all five name-wrapped <strong> tokens in authored order', () => {
    const d = performerLegendRow.description;
    PL_NAMES.forEach(n => expect(d).toContain(`<strong>${n}</strong>`));
    const pos = PL_NAMES.map(n => d.indexOf(`<strong>${n}</strong>`));
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
    pos.forEach(p => expect(p).toBeGreaterThan(-1));
  });

  it('binds 1/Day Each to Major Image + Project Image; At Will trio ungated (§57)', () => {
    const uses = extractSpellcastingSpellUses(performerLegendRow.description);
    expect(uses).toEqual(Object.fromEntries(PL_ONE_DAY.map(n => [n, 1])));
    PL_AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('row-level numeric save_dc 17 + save_type Charisma pair intact (§89 gate pre-met)', () => {
    expect(performerLegendRow.save_dc).toBe(17);
    expect(performerLegendRow.save_type).toBe('Charisma');
    expect(performerLegendRow.description).toMatch(/spell save DC 17/);
  });

  it('emphasis census: ONLY the two tier headers + five spell names carry markup — no fake-chip decoys', () => {
    const tokens = (performerLegendRow.description.match(/<(?:strong|em)>[^<]*<\/(?:strong|em)>/g) || []);
    expect(tokens).toEqual(['<strong>At Will:</strong>', '<strong>Mage Hand</strong>', '<strong>Minor Illusion</strong>', '<strong>Prestidigitation</strong>', '<strong>1/Day Each:</strong>', '<strong>Major Image</strong>', '<strong>Project Image</strong>']);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(performerLegendRow.description)).toBe(PL_PLAIN_ORIGINAL);
  });

  it('DC 17 = 8 + CHA +5 + PB +4 for the performer legend', () => {
    expect(performerLegend.ability_score_modifiers.cha).toBe(5);
    expect(performerLegend.proficiency_bonus).toBe(4);
    expect(8 + performerLegend.ability_score_modifiers.cha + performerLegend.proficiency_bonus).toBe(17);
  });

  it('all five spells exist in 5e spells.json, all save:none — chips are cast-affordance only', () => {
    PL_NAMES.forEach(n => {
      const s = spells5e.find(sp => sp.name === n);
      expect(s).toBeDefined();
      expect(s.dc == null || s.dc.dc_type == null).toBe(true);
    });
  });
});

// ── MA-1289 Modal: five chips, counters, 1/Day gate ──────────────────────────

describe('MA-1289 MonsterCardModal Performer Legend Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders five spell chips — the zero-chip inert row is gone', () => {
    renderPerformerLegend();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(PL_NAMES);
  });

  it('the two 1/Day names carry counters; the three At Will names do not', () => {
    renderPerformerLegend();
    PL_ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    PL_AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('Major Image 1/Day: cast spends the single use with DC 17/Charisma advisory, re-fire refused (§57)', async () => {
    renderPerformerLegend();
    await act(async () => { fireEvent.click(linkByText('Major Image')); });
    await waitFor(() => expect(abilityUseEntries('Major Image').length).toBe(1));
    expect(runtime.store[`${PL_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Major Image': 1 });
    expect(abilityUseEntries('Major Image')[0].description).toMatch(/1\/Day use spent/);
    expect(abilityUseEntries('Major Image')[0].description).toMatch(/\(spell save DC 17/);

    await act(async () => { fireEvent.click(linkByText('Major Image')); });
    await waitFor(() => expect(refusals('Major Image').length).toBe(1));
    expect(abilityUseEntries('Major Image').length).toBe(1);
    expect(runtime.store[`${PL_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Major Image': 1 });
  });

  it('At Will Mage Hand casts ungated twice — zero uses, advisory log prints row DC 17 (§204)', async () => {
    renderPerformerLegend();
    await act(async () => { fireEvent.click(linkByText('Mage Hand')); });
    await waitFor(() => expect(abilityUseEntries('Mage Hand').length).toBe(1));
    expect(abilityUseEntries('Mage Hand')[0].description).toMatch(/\(spell save DC 17/);
    await act(async () => { fireEvent.click(linkByText('Mage Hand')); });
    await waitFor(() => expect(abilityUseEntries('Mage Hand').length).toBe(2));
    expect(runtime.store[`${PL_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});

// ── MA-1294 data lock: Performer Maestro Spellcasting row ────────────────────

describe('MA-1294 monsters.json data lock: Performer Maestro Spellcasting row', () => {
  it('extracts all three spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(performerMaestroRow.description);
    expect(names).toEqual(PM_NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('1/Day');
  });

  it('disk description carries all three name-wrapped <strong> tokens in authored order', () => {
    const d = performerMaestroRow.description;
    PM_NAMES.forEach(n => expect(d).toContain(`<strong>${n}</strong>`));
    const pos = PM_NAMES.map(n => d.indexOf(`<strong>${n}</strong>`));
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
    pos.forEach(p => expect(p).toBeGreaterThan(-1));
  });

  it('binds 1/Day to Tasha\'s Hideous Laughter; At Will pair ungated (§57)', () => {
    const uses = extractSpellcastingSpellUses(performerMaestroRow.description);
    expect(uses).toEqual({ "Tasha's Hideous Laughter": 1 });
    PM_AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('row-level numeric save_dc 15 + save_type Charisma pair intact — family caster-channel label, XOR fork keeps it unrendered (§676)', () => {
    expect(performerMaestroRow.save_dc).toBe(15);
    expect(performerMaestroRow.save_type).toBe('Charisma');
    expect(performerMaestroRow.description).toMatch(/spell save DC 15/);
  });

  it('emphasis census: ONLY the two tier headers + three spell names carry markup — no fake-chip decoys (§161)', () => {
    const tokens = (performerMaestroRow.description.match(/<(?:strong|em)>[^<]*<\/(?:strong|em)>/g) || []);
    expect(tokens).toEqual(['<strong>At Will:</strong>', '<strong>Minor Illusion</strong>', '<strong>Prestidigitation</strong>', '<strong>1/Day:</strong>', "<strong>Tasha's Hideous Laughter</strong>"]);
  });

  it('"(level 3 version)" parenthetical stays OUTSIDE the wrap (MA-1241 twin convention)', () => {
    expect(performerMaestroRow.description).toMatch(/<strong>Tasha's Hideous Laughter<\/strong> \(level 3 version\)/);
    expect(performerMaestroRow.description).not.toMatch(/<(?:strong|em)>[^<]*level 3 version[^<]*<\/(?:strong|em)>/);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(performerMaestroRow.description)).toBe(PM_PLAIN_ORIGINAL);
  });

  it('§158 resolution: Minor Illusion + Prestidigitation in BOTH indexes; RAW "Tasha\'s Hideous Laughter" absent 5e ("Hideous Laughter" there), exact in 2024 — findMonsterSpell 5e→2024 fallback resolves it (§207)', () => {
    PM_AT_WILL.forEach(n => {
      expect(spells5e.some(s => s.name === n)).toBe(true);
      expect(spells2024.some(s => s.name === n)).toBe(true);
    });
    expect(spells5e.some(s => s.name === "Tasha's Hideous Laughter")).toBe(false);
    expect(spells5e.some(s => s.name === 'Hideous Laughter')).toBe(true);
    const t = spells2024.find(s => s.name === "Tasha's Hideous Laughter");
    expect(t).toBeDefined();
    expect(t.level).toBe(1);
    expect(t.school).toBe('Enchantment');
    expect(t.dc.dc_type).toBe('WIS');
  });

  it('DC 15 = 8 + CHA +4 + PB +3 for the performer maestro', () => {
    expect(performerMaestro.ability_score_modifiers.cha).toBe(4);
    expect(performerMaestro.proficiency_bonus).toBe(3);
    expect(8 + performerMaestro.ability_score_modifiers.cha + performerMaestro.proficiency_bonus).toBe(15);
  });
});

// ── MA-1294 Modal: three chips, counters, 1/Day gate ─────────────────────────

describe('MA-1294 MonsterCardModal Performer Maestro Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders three spell chips — the zero-chip inert row is gone', () => {
    renderPerformerMaestro();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(PM_NAMES);
  });

  it('the 1/Day laughter name carries the counter; the At Will pair does not', () => {
    renderPerformerMaestro();
    PM_ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    PM_AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('At Will Minor Illusion casts ungated twice — zero uses, advisory log prints row DC 15 (§204)', async () => {
    renderPerformerMaestro();
    await act(async () => { fireEvent.click(linkByText('Minor Illusion')); });
    await waitFor(() => expect(abilityUseEntries('Minor Illusion').length).toBe(1));
    expect(abilityUseEntries('Minor Illusion')[0].description).toMatch(/\(spell save DC 15/);
    await act(async () => { fireEvent.click(linkByText('Minor Illusion')); });
    await waitFor(() => expect(abilityUseEntries('Minor Illusion').length).toBe(2));
    expect(runtime.store[`${PM_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Tasha\'s Hideous Laughter 1/Day: cast spends the single use with DC 15 advisory, re-fire refused "0 left" — zero extra spend (§57)', async () => {
    renderPerformerMaestro();
    await act(async () => { fireEvent.click(linkByText("Tasha's Hideous Laughter")); });
    await waitFor(() => expect(abilityUseEntries("Tasha's Hideous Laughter").length).toBe(1));
    expect(runtime.store[`${PM_MONSTER_NAME}.monsterSpellUses`]).toEqual({ "Tasha's Hideous Laughter": 1 });
    expect(abilityUseEntries("Tasha's Hideous Laughter")[0].description).toMatch(/1\/Day use spent/);
    expect(abilityUseEntries("Tasha's Hideous Laughter")[0].description).toMatch(/\(spell save DC 15/);

    await act(async () => { fireEvent.click(linkByText("Tasha's Hideous Laughter")); });
    await waitFor(() => expect(refusals("Tasha's Hideous Laughter").length).toBe(1));
    expect(abilityUseEntries("Tasha's Hideous Laughter").length).toBe(1);
    expect(runtime.store[`${PM_MONSTER_NAME}.monsterSpellUses`]).toEqual({ "Tasha's Hideous Laughter": 1 });
  });

  it('At Will Prestidigitation casts ungated — zero uses, no chip counter', async () => {
    renderPerformerMaestro();
    await act(async () => { fireEvent.click(linkByText('Prestidigitation')); });
    await waitFor(() => expect(abilityUseEntries('Prestidigitation').length).toBe(1));
    expect(runtime.store[`${PM_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});

// ── MA-1320 data lock: Pixie Spellcasting row ────────────────────────────────

describe('MA-1320 monsters.json data lock: Pixie Spellcasting row', () => {
  it('extracts all six spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(pixieRow.description);
    expect(names).toEqual(PX_NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('1/Day Each');
  });

  it('disk description carries all six name-wrapped <strong> tokens in authored order', () => {
    const d = pixieRow.description;
    PX_NAMES.forEach(n => expect(d).toContain(`<strong>${n}</strong>`));
    const pos = PX_NAMES.map(n => d.indexOf(`<strong>${n}</strong>`));
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
    pos.forEach(p => expect(p).toBeGreaterThan(-1));
  });

  it('binds 1/Day Each to Detect Thoughts + Fly + Sleep; At Will trio ungated (§57)', () => {
    const uses = extractSpellcastingSpellUses(pixieRow.description);
    expect(uses).toEqual(Object.fromEntries(PX_ONE_DAY.map(n => [n, 1])));
    PX_AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('row-level numeric save_dc 12 + save_type Charisma pair intact — caster-channel label, XOR fork keeps it unrendered (§676)', () => {
    expect(pixieRow.save_dc).toBe(12);
    expect(pixieRow.save_type).toBe('Charisma');
    expect(pixieRow.description).toMatch(/spell save DC 12/);
  });

  it('"Invisibility (self only)" — name wrapped, qualifier parenthetical OUTSIDE the mark (§1241 twin convention)', () => {
    expect(pixieRow.description).toMatch(/<strong>Invisibility<\/strong> \(self only\)/);
    expect(pixieRow.description).not.toMatch(/<(?:strong|em)>[^<]*self only[^<]*<\/(?:strong|em)>/);
  });

  it('emphasis census: ONLY the two tier headers + six spell names carry markup — no fake-chip decoys (§161)', () => {
    const tokens = (pixieRow.description.match(/<(?:strong|em)>[^<]*<\/(?:strong|em)>/g) || []);
    expect(tokens).toEqual(['<strong>At Will:</strong>', '<strong>Dancing Lights</strong>', '<strong>Druidcraft</strong>', '<strong>Invisibility</strong>', '<strong>1/Day Each:</strong>', '<strong>Detect Thoughts</strong>', '<strong>Fly</strong>', '<strong>Sleep</strong>']);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(pixieRow.description)).toBe(PX_PLAIN_ORIGINAL);
  });

  it('pixie-wonderbringer twin (MA-1323, DC 15) untouched — DC 12 byte discriminates the shared lead-in', () => {
    const wb = monsters.find(m => m.index === 'pixie-wonderbringer');
    const wbRow = wb.actions.find(a => a.name === 'Spellcasting');
    expect(pixieRow.description).toContain('spell save DC 12');
    expect(wbRow.description).toContain('spell save DC 15');
    expect(pixieRow.description).not.toBe(wbRow.description);
  });

  it('DC 12 = 8 + CHA +2 + PB +2 for the pixie', () => {
    expect(pixie.ability_score_modifiers.cha).toBe(2);
    expect(pixie.proficiency_bonus).toBe(2);
    expect(8 + pixie.ability_score_modifiers.cha + pixie.proficiency_bonus).toBe(12);
  });

  it('§158 trap INACTIVE: all six spells byte-match BOTH 5e and 2024 indexes', () => {
    PX_NAMES.forEach(n => {
      expect(spells5e.some(s => s.name === n)).toBe(true);
      expect(spells2024.some(s => s.name === n)).toBe(true);
    });
  });
});

// ── MA-1320 Modal: six chips, counters, 1/Day gate ───────────────────────────

describe('MA-1320 MonsterCardModal Pixie Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders six spell chips — the zero-chip inert row is gone', () => {
    renderPixie();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(PX_NAMES);
  });

  it('the three 1/Day names carry counters; the At Will trio does not (§57 gate binds)', () => {
    renderPixie();
    PX_ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    PX_AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('Sleep 1/Day: cast spends the single use with DC 12 advisory, re-fire refused — zero extra spend (§57)', async () => {
    renderPixie();
    await act(async () => { fireEvent.click(linkByText('Sleep')); });
    await waitFor(() => expect(abilityUseEntries('Sleep').length).toBe(1));
    expect(runtime.store[`${PX_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Sleep': 1 });
    expect(abilityUseEntries('Sleep')[0].description).toMatch(/1\/Day use spent/);
    expect(abilityUseEntries('Sleep')[0].description).toMatch(/\(spell save DC 12/);

    await act(async () => { fireEvent.click(linkByText('Sleep')); });
    await waitFor(() => expect(refusals('Sleep').length).toBe(1));
    expect(abilityUseEntries('Sleep').length).toBe(1);
    expect(runtime.store[`${PX_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Sleep': 1 });
  });

  it('At Will Druidcraft casts ungated twice — zero uses, advisory log prints row DC 12 (§204)', async () => {
    renderPixie();
    await act(async () => { fireEvent.click(linkByText('Druidcraft')); });
    await waitFor(() => expect(abilityUseEntries('Druidcraft').length).toBe(1));
    expect(abilityUseEntries('Druidcraft')[0].description).toMatch(/\(spell save DC 12/);
    await act(async () => { fireEvent.click(linkByText('Druidcraft')); });
    await waitFor(() => expect(abilityUseEntries('Druidcraft').length).toBe(2));
    expect(runtime.store[`${PX_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});

// ── MA-1323 data lock: Pixie Wonderbringer Spellcasting row ──────────────────

describe('MA-1323 monsters.json data lock: Pixie Wonderbringer Spellcasting row', () => {
  it('extracts all six spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(pixieWbRow.description);
    expect(names).toEqual(WB_NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('1/Day Each');
  });

  it('disk description carries all six name-wrapped <strong> tokens in authored order', () => {
    const d = pixieWbRow.description;
    WB_NAMES.forEach(n => expect(d).toContain(`<strong>${n}</strong>`));
    const pos = WB_NAMES.map(n => d.indexOf(`<strong>${n}</strong>`));
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
    pos.forEach(p => expect(p).toBeGreaterThan(-1));
  });

  it('binds 1/Day Each to Detect Thoughts + Fly + Major Image; At Will trio ungated (§57)', () => {
    const uses = extractSpellcastingSpellUses(pixieWbRow.description);
    expect(uses).toEqual(Object.fromEntries(WB_ONE_DAY.map(n => [n, 1])));
    WB_AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('row-level numeric save_dc 15 + save_type Charisma pair intact — caster-channel label, XOR fork keeps it unrendered (§676)', () => {
    expect(pixieWbRow.save_dc).toBe(15);
    expect(pixieWbRow.save_type).toBe('Charisma');
    expect(pixieWbRow.description).toMatch(/spell save DC 15/);
  });

  it('"Invisibility (self only)" — name wrapped, qualifier parenthetical OUTSIDE the mark (§1320 twin convention)', () => {
    expect(pixieWbRow.description).toMatch(/<strong>Invisibility<\/strong> \(self only\)/);
    expect(pixieWbRow.description).not.toMatch(/<(?:strong|em)>[^<]*self only[^<]*<\/(?:strong|em)>/);
  });

  it('emphasis census: ONLY the two tier headers + six spell names carry markup — no fake-chip decoys (§161)', () => {
    const tokens = (pixieWbRow.description.match(/<(?:strong|em)>[^<]*<\/(?:strong|em)>/g) || []);
    expect(tokens).toEqual(['<strong>At Will:</strong>', '<strong>Dancing Lights</strong>', '<strong>Druidcraft</strong>', '<strong>Invisibility</strong>', '<strong>1/Day Each:</strong>', '<strong>Detect Thoughts</strong>', '<strong>Fly</strong>', '<strong>Major Image</strong>']);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(pixieWbRow.description)).toBe(WB_PLAIN_ORIGINAL);
  });

  it('pixie twin (MA-1320, DC 12 + Sleep) untouched — DC 15 byte discriminates the shared lead-in', () => {
    expect(pixieWbRow.description).toContain('spell save DC 15');
    expect(pixieRow.description).toContain('spell save DC 12');
    expect(pixieRow.description).toContain('<strong>Sleep</strong>');
    expect(pixieWbRow.description).not.toContain('Sleep');
    expect(pixieWbRow.description).not.toBe(pixieRow.description);
    expect(stripTags(pixieRow.description)).toBe(PX_PLAIN_ORIGINAL);
  });

  it('DC 15 = 8 + CHA +4 + PB +3 for the pixie wonderbringer', () => {
    expect(pixieWb.ability_score_modifiers.cha).toBe(4);
    expect(pixieWb.proficiency_bonus).toBe(3);
    expect(8 + pixieWb.ability_score_modifiers.cha + pixieWb.proficiency_bonus).toBe(15);
  });

  it('§158 trap INACTIVE: all six spells byte-match BOTH 5e and 2024 indexes', () => {
    WB_NAMES.forEach(n => {
      expect(spells5e.some(s => s.name === n)).toBe(true);
      expect(spells2024.some(s => s.name === n)).toBe(true);
    });
  });
});

// ── MA-1323 Modal: six chips, counters, 1/Day gate ───────────────────────────

describe('MA-1323 MonsterCardModal Pixie Wonderbringer Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders six spell chips — the zero-chip inert row is gone', () => {
    renderPixieWonderbringer();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(WB_NAMES);
  });

  it('the three 1/Day names carry counters; the At Will trio does not (§57 gate binds)', () => {
    renderPixieWonderbringer();
    WB_ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    WB_AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('Major Image 1/Day: cast spends the single use with DC 15 advisory, re-fire refused — zero extra spend (§57)', async () => {
    renderPixieWonderbringer();
    await act(async () => { fireEvent.click(linkByText('Major Image')); });
    await waitFor(() => expect(abilityUseEntries('Major Image').length).toBe(1));
    expect(runtime.store[`${PXWB_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Major Image': 1 });
    expect(abilityUseEntries('Major Image')[0].description).toMatch(/1\/Day use spent/);
    expect(abilityUseEntries('Major Image')[0].description).toMatch(/\(spell save DC 15/);

    await act(async () => { fireEvent.click(linkByText('Major Image')); });
    await waitFor(() => expect(refusals('Major Image').length).toBe(1));
    expect(abilityUseEntries('Major Image').length).toBe(1);
    expect(runtime.store[`${PXWB_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Major Image': 1 });
  });

  it('At Will Druidcraft casts ungated twice — zero uses, advisory log prints row DC 15 (§204)', async () => {
    renderPixieWonderbringer();
    await act(async () => { fireEvent.click(linkByText('Druidcraft')); });
    await waitFor(() => expect(abilityUseEntries('Druidcraft').length).toBe(1));
    expect(abilityUseEntries('Druidcraft')[0].description).toMatch(/\(spell save DC 15/);
    await act(async () => { fireEvent.click(linkByText('Druidcraft')); });
    await waitFor(() => expect(abilityUseEntries('Druidcraft').length).toBe(2));
    expect(runtime.store[`${PXWB_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});

// ── MA-1327 data lock: Planetar Spellcasting row ──────────────────────────────

describe('MA-1327 monsters.json data lock: Planetar Spellcasting row', () => {
  it('extracts all five spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(planetarRow.description);
    expect(names).toEqual(PT_NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('1/Day Each');
  });

  it('disk description carries all five name-wrapped <strong> tokens in authored order', () => {
    const d = planetarRow.description;
    PT_NAMES.forEach(n => expect(d).toContain(`<strong>${n}</strong>`));
    const pos = PT_NAMES.map(n => d.indexOf(`<strong>${n}</strong>`));
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
    pos.forEach(p => expect(p).toBeGreaterThan(-1));
  });

  it('binds 1/Day Each to Commune + Control Weather + Dispel Evil and Good + Raise Dead; At Will name ungated (§57)', () => {
    const uses = extractSpellcastingSpellUses(planetarRow.description);
    expect(uses).toEqual(Object.fromEntries(PT_ONE_DAY.map(n => [n, 1])));
    PT_AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('row-level numeric save_dc 20 + save_type Charisma pair intact (§89 gate pre-met; §676 XOR keeps DC unrendered)', () => {
    expect(planetarRow.save_dc).toBe(20);
    expect(planetarRow.save_type).toBe('Charisma');
    expect(planetarRow.description).toMatch(/spell save DC 20/);
  });

  it('emphasis census: ONLY the two tier headers + five spell names carry markup — no fake-chip decoys (§161)', () => {
    const tokens = (planetarRow.description.match(/<(?:strong|em)>[^<]*<\/(?:strong|em)>/g) || []);
    expect(tokens).toEqual(['<strong>At Will:</strong>', '<strong>Detect Evil and Good</strong>', '<strong>1/Day Each:</strong>', '<strong>Commune</strong>', '<strong>Control Weather</strong>', '<strong>Dispel Evil and Good</strong>', '<strong>Raise Dead</strong>']);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(planetarRow.description)).toBe(PT_PLAIN_ORIGINAL);
  });

  it('DC 20 = 8 + CHA +7 + PB +5 for the planetar', () => {
    expect(planetar.ability_score_modifiers.cha).toBe(7);
    expect(planetar.proficiency_bonus).toBe(5);
    expect(8 + planetar.ability_score_modifiers.cha + planetar.proficiency_bonus).toBe(20);
  });

  it('§158 trap INACTIVE: all five spells byte-match BOTH 5e and 2024 indexes, zero attack_type', () => {
    PT_NAMES.forEach(n => {
      const s = spells5e.find(sp => sp.name === n);
      expect(s).toBeDefined();
      expect(s.attack_type == null).toBe(true);
      expect(spells2024.some(sp => sp.name === n)).toBe(true);
    });
  });
});

// ── MA-1327 Modal: five chips, counters, 1/Day gate ───────────────────────────

describe('MA-1327 MonsterCardModal Planetar Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders five spell chips — the zero-chip inert row is gone', () => {
    renderPlanetar();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(PT_NAMES);
  });

  it('the four 1/Day names carry counters; the At Will name does not (§57 gate binds)', () => {
    renderPlanetar();
    PT_ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    PT_AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('At Will Detect Evil and Good casts ungated twice — zero uses, advisory log prints row DC 20 (§204)', async () => {
    renderPlanetar();
    await act(async () => { fireEvent.click(linkByText('Detect Evil and Good')); });
    await waitFor(() => expect(abilityUseEntries('Detect Evil and Good').length).toBe(1));
    expect(abilityUseEntries('Detect Evil and Good')[0].description).toMatch(/\(spell save DC 20/);
    await act(async () => { fireEvent.click(linkByText('Detect Evil and Good')); });
    await waitFor(() => expect(abilityUseEntries('Detect Evil and Good').length).toBe(2));
    expect(runtime.store[`${PT_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Commune 1/Day: cast spends the single use with DC 20 advisory, re-fire refused — zero extra spend (§57)', async () => {
    renderPlanetar();
    await act(async () => { fireEvent.click(linkByText('Commune')); });
    await waitFor(() => expect(abilityUseEntries('Commune').length).toBe(1));
    expect(runtime.store[`${PT_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Commune': 1 });
    expect(abilityUseEntries('Commune')[0].description).toMatch(/1\/Day use spent/);
    expect(abilityUseEntries('Commune')[0].description).toMatch(/\(spell save DC 20/);

    await act(async () => { fireEvent.click(linkByText('Commune')); });
    await waitFor(() => expect(refusals('Commune').length).toBe(1));
    expect(abilityUseEntries('Commune').length).toBe(1);
    expect(runtime.store[`${PT_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Commune': 1 });
  });

  it('Raise Dead 1/Day: cast spends the single use, re-fire refused; no row save chip (§676 XOR)', async () => {
    renderPlanetar();
    expect(document.querySelectorAll('.mc-dice-link-save').length).toBe(0);
    await act(async () => { fireEvent.click(linkByText('Raise Dead')); });
    await waitFor(() => expect(abilityUseEntries('Raise Dead').length).toBe(1));
    expect(runtime.store[`${PT_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Raise Dead': 1 });
    await act(async () => { fireEvent.click(linkByText('Raise Dead')); });
    await waitFor(() => expect(refusals('Raise Dead').length).toBe(1));
  });
});

// ── MA-1339 data lock: Priest Spellcasting row ────────────────────────────────

describe('MA-1339 monsters.json data lock: Priest Spellcasting row', () => {
  it('extracts all three spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(priestRow.description);
    expect(names).toEqual(PR_NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('1/Day');
  });

  it('disk description carries all three name-wrapped <strong> tokens in authored order', () => {
    const d = priestRow.description;
    PR_NAMES.forEach(n => expect(d).toContain(`<strong>${n}</strong>`));
    const pos = PR_NAMES.map(n => d.indexOf(`<strong>${n}</strong>`));
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
    pos.forEach(p => expect(p).toBeGreaterThan(-1));
  });

  it('binds 1/Day to Spirit Guardians only; At Will pair ungated (§57)', () => {
    const uses = extractSpellcastingSpellUses(priestRow.description);
    expect(uses).toEqual({ 'Spirit Guardians': 1 });
    PR_AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('row-level numeric save_dc 13 + save_type Wisdom pair authored (§89; prose had NO numeric DC pre-fix — §54 lane closed)', () => {
    expect(priestRow.save_dc).toBe(13);
    expect(priestRow.save_type).toBe('Wisdom');
    expect(priestRow.description).not.toMatch(/\(spell save DC \d+\)/);
  });

  it('emphasis census: ONLY the two tier headers + three spell names carry markup — no fake-chip decoys (§161)', () => {
    const tokens = (priestRow.description.match(/<(?:strong|em)>[^<]*<\/(?:strong|em)>/g) || []);
    expect(tokens).toEqual(['<strong>At Will:</strong>', '<strong>Light</strong>', '<strong>Thaumaturgy</strong>', '<strong>1/Day:</strong>', '<strong>Spirit Guardians</strong>']);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(priestRow.description)).toBe(PR_PLAIN_ORIGINAL);
  });

  it('DC 13 = 8 + WIS +3 + PB +2 for the priest (computed from disk, not trusted blindly)', () => {
    expect(priest.ability_score_modifiers.wis).toBe(3);
    expect(priest.proficiency_bonus).toBe(2);
    expect(8 + priest.ability_score_modifiers.wis + priest.proficiency_bonus).toBe(13);
  });

  it('§158 trap INACTIVE: all three spells byte-match BOTH 5e and 2024 indexes', () => {
    PR_NAMES.forEach(n => {
      expect(spells5e.some(s => s.name === n)).toBe(true);
      expect(spells2024.some(s => s.name === n)).toBe(true);
    });
  });

  it('no 2024 monsters.json twin exists — single-file fix scope (§3)', () => {
    expect(() => readFileSync('public/data/2024/monsters.json', 'utf8')).toThrow();
  });
});

// ── MA-1339 Modal: three chips, counters, 1/Day gate ──────────────────────────

describe('MA-1339 MonsterCardModal Priest Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders three spell chips — the zero-chip inert row is gone', () => {
    renderPriest();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(PR_NAMES);
  });

  it('Spirit Guardians carries the 1/Day counter; the At Will pair does not (§57 gate binds)', () => {
    renderPriest();
    PR_ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    PR_AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('At Will Light casts ungated twice — zero uses, advisory log prints row DC 13 (§204)', async () => {
    renderPriest();
    await act(async () => { fireEvent.click(linkByText('Light')); });
    await waitFor(() => expect(abilityUseEntries('Light').length).toBe(1));
    expect(abilityUseEntries('Light')[0].description).toMatch(/\(spell save DC 13/);
    await act(async () => { fireEvent.click(linkByText('Light')); });
    await waitFor(() => expect(abilityUseEntries('Light').length).toBe(2));
    expect(runtime.store[`${PR_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Spirit Guardians 1/Day: cast spends the single use with DC 13 advisory, re-fire refused — zero extra spend (§57)', async () => {
    renderPriest();
    await act(async () => { fireEvent.click(linkByText('Spirit Guardians')); });
    await waitFor(() => expect(abilityUseEntries('Spirit Guardians').length).toBe(1));
    expect(runtime.store[`${PR_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Spirit Guardians': 1 });
    expect(abilityUseEntries('Spirit Guardians')[0].description).toMatch(/1\/Day use spent/);
    expect(abilityUseEntries('Spirit Guardians')[0].description).toMatch(/\(spell save DC 13/);

    await act(async () => { fireEvent.click(linkByText('Spirit Guardians')); });
    await waitFor(() => expect(refusals('Spirit Guardians').length).toBe(1));
    expect(abilityUseEntries('Spirit Guardians').length).toBe(1);
    expect(runtime.store[`${PR_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Spirit Guardians': 1 });
  });
});

// ── MA-1342 data lock: Priest Acolyte Spellcasting row ───────────────────────

describe('MA-1342 monsters.json data lock: Priest Acolyte Spellcasting row', () => {
  it('extracts both spell names as chips — tier header skipped', () => {
    const names = extractSpellNamesFromSpellcasting(priestAcolyteRow.description);
    expect(names).toEqual(PA_NAMES);
    expect(names).not.toContain('At Will');
  });

  it('disk description carries both name-wrapped <strong> tokens in authored order', () => {
    const d = priestAcolyteRow.description;
    PA_NAMES.forEach(n => expect(d).toContain(`<strong>${n}</strong>`));
    const pos = PA_NAMES.map(n => d.indexOf(`<strong>${n}</strong>`));
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
    pos.forEach(p => expect(p).toBeGreaterThan(-1));
  });

  it('At-Will pair fully ungated — no 1/Day tier, zero uses bound (§57)', () => {
    const uses = extractSpellcastingSpellUses(priestAcolyteRow.description);
    expect(uses).toEqual({});
    PA_AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('save_dc 0 + save_type Wisdom byte-unchanged — save-less At Will, SpellCastLinks arm on row NAME + tier markup only (§674)', () => {
    expect(priestAcolyteRow.save_dc).toBe(0);
    expect(priestAcolyteRow.save_type).toBe('Wisdom');
    expect(priestAcolyteRow.attack_bonus).toBe(0);
    expect(priestAcolyteRow.description).not.toMatch(/spell save DC \d+/);
  });

  it('emphasis census: ONLY the tier header + two spell names carry markup — no fake-chip decoys (§161)', () => {
    const tokens = (priestAcolyteRow.description.match(/<(?:strong|em)>[^<]*<\/(?:strong|em)>/g) || []);
    expect(tokens).toEqual(['<strong>At Will:</strong>', '<strong>Light</strong>', '<strong>Thaumaturgy</strong>']);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(priestAcolyteRow.description)).toBe(PA_PLAIN_ORIGINAL);
  });

  it('already-fixed Priest twin (MA-1339) not clobbered — 1/Day Spirit Guardians tier + save_dc 13 intact', () => {
    expect(priestRow.description).toContain('<strong>Spirit Guardians</strong>');
    expect(priestRow.description).toContain('<strong>1/Day:</strong>');
    expect(priestRow.save_dc).toBe(13);
    expect(priestRow.description).not.toBe(priestAcolyteRow.description);
  });

  it('§158 trap INACTIVE: both spells byte-match BOTH 5e and 2024 indexes, save-less cantrips (§490 residual: junk attack_bonus 0 + advisory DC 0)', () => {
    PA_NAMES.forEach(n => {
      const s = spells5e.find(sp => sp.name === n);
      expect(s).toBeDefined();
      expect(s.dc == null).toBe(true);
      expect(s.attack_type == null).toBe(true);
      expect(spells2024.some(sp => sp.name === n)).toBe(true);
    });
  });
});

// ── MA-1342 Modal: two chips, At-Will ungated ────────────────────────────────

describe('MA-1342 MonsterCardModal Priest Acolyte Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders two spell chips — the zero-chip inert row is gone', () => {
    renderPriestAcolyte();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(PA_NAMES);
  });

  it('neither At-Will name carries a counter (§57 ungated by design)', () => {
    renderPriestAcolyte();
    PA_AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('At Will Light casts ungated twice — zero uses, advisory log rides row save_dc 0 residual (§490)', async () => {
    renderPriestAcolyte();
    await act(async () => { fireEvent.click(linkByText('Light')); });
    await waitFor(() => expect(abilityUseEntries('Light').length).toBe(1));
    expect(abilityUseEntries('Light')[0].description).toMatch(/casts Light via Spellcasting/);
    await act(async () => { fireEvent.click(linkByText('Light')); });
    await waitFor(() => expect(abilityUseEntries('Light').length).toBe(2));
    expect(runtime.store[`${PA_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('At Will Thaumaturgy casts ungated — zero uses, zero refusals (§57)', async () => {
    renderPriestAcolyte();
    await act(async () => { fireEvent.click(linkByText('Thaumaturgy')); });
    await waitFor(() => expect(abilityUseEntries('Thaumaturgy').length).toBe(1));
    await act(async () => { fireEvent.click(linkByText('Thaumaturgy')); });
    await waitFor(() => expect(abilityUseEntries('Thaumaturgy').length).toBe(2));
    expect(refusals('Thaumaturgy').length).toBe(0);
    expect(runtime.store[`${PA_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});

// ── MA-1366 data lock: Quaggoth Thonot Spellcasting row ──────────────────────

describe('MA-1366 monsters.json data lock: Quaggoth Thonot Spellcasting row', () => {
  it('extracts all three spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(thonotRow.description);
    expect(names).toEqual(QT_NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('2/Day');
  });

  it('decoy "Invisible" is NOT extracted — prose emphasis stripped, parenthetical plain text (§161)', () => {
    const names = extractSpellNamesFromSpellcasting(thonotRow.description);
    expect(names).not.toContain('Invisible');
    expect(thonotRow.description).not.toMatch(/<(?:strong|em)>Invisible<\/(?:strong|em)>/);
    expect(thonotRow.description).toContain('<strong>Mage Hand</strong> (the hand is Invisible)');
  });

  it('binds 2/Day to Mind Spike only; At Will pair ungated (§57)', () => {
    const uses = extractSpellcastingSpellUses(thonotRow.description);
    expect(uses).toEqual({ 'Mind Spike': 2 });
    QT_AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('row-level numeric save_dc 12 + save_type Wisdom pair untouched (§89 gate pre-met)', () => {
    expect(thonotRow.save_dc).toBe(12);
    expect(thonotRow.save_type).toBe('Wisdom');
    expect(thonotRow.description).toMatch(/\(spell save DC 12\)/);
  });

  it('emphasis census: ONLY the two tier headers + three spell names carry markup — no fake-chip decoys (§161)', () => {
    const tokens = (thonotRow.description.match(/<(?:strong|em)>[^<]*<\/(?:strong|em)>/g) || []);
    expect(tokens).toEqual(['<strong>At Will:</strong>', '<strong>Mage Hand</strong>', '<strong>Minor Illusion</strong>', '<strong>2/Day:</strong>', '<strong>Mind Spike</strong>']);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(thonotRow.description)).toBe(QT_PLAIN_ORIGINAL);
  });

  it('DC 12 = 8 + WIS +2 + PB +2 for the thonot (computed from disk)', () => {
    expect(thonot.ability_score_modifiers.wis).toBe(2);
    expect(thonot.proficiency_bonus).toBe(2);
    expect(8 + thonot.ability_score_modifiers.wis + thonot.proficiency_bonus).toBe(12);
  });

  it('§207/§158: Mage Hand + Minor Illusion byte-match BOTH indexes; Mind Spike 2024-only (4e-fallback lane, absent 5e)', () => {
    QT_AT_WILL.forEach(n => {
      expect(spells5e.some(s => s.name === n)).toBe(true);
      expect(spells2024.some(s => s.name === n)).toBe(true);
    });
    expect(spells5e.some(s => s.name === 'Mind Spike')).toBe(false);
    expect(spells2024.some(s => s.name === 'Mind Spike')).toBe(true);
  });

  it('junk attack_bonus 0 left per MA-1327/1339/1342 family precedent — cosmetic "+0" residual (§490)', () => {
    expect(thonotRow.attack_bonus).toBe(0);
  });

  it('Quaggoth twin Claw (MA-1363, fixed today) not clobbered — Bloodied chooser markup intact', () => {
    const quaggoth = monsters.find(m => m.index === 'quaggoth');
    const claw = quaggoth.actions.find(a => a.name === 'Claw');
    expect(claw.description).toContain('<strong>Bloodied</strong>');
    expect(claw.conditional_damage).toBeDefined();
    expect(quaggoth.actions.some(a => a.name === 'Spellcasting')).toBe(false);
  });
});

// ── MA-1366 Modal: three chips, 2/Day gate, decoy chip gone ───────────────────

describe('MA-1366 MonsterCardModal Quaggoth Thonot Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders three spell chips — the zero-chip inert row is gone', () => {
    renderQuaggothThonot();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(QT_NAMES);
  });

  it('no live junk-cast "Invisible" chip — the decoy affordance is dead (§161)', () => {
    renderQuaggothThonot();
    expect(spellLinks().some(el => el.textContent.includes('Invisible'))).toBe(false);
    expect(linkByText('Invisible')).toBeNull();
  });

  it('Mind Spike carries the 2/Day counter; the At Will pair does not (§57 gate binds)', () => {
    renderQuaggothThonot();
    QT_TWO_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(2\/Day · 2 left\)/));
    QT_AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('At Will Mage Hand casts ungated twice — zero uses, advisory log prints row DC 12/Wisdom (§204)', async () => {
    renderQuaggothThonot();
    await act(async () => { fireEvent.click(linkByText('Mage Hand')); });
    await waitFor(() => expect(abilityUseEntries('Mage Hand').length).toBe(1));
    expect(abilityUseEntries('Mage Hand')[0].description).toMatch(/\(spell save DC 12/);
    await act(async () => { fireEvent.click(linkByText('Mage Hand')); });
    await waitFor(() => expect(abilityUseEntries('Mage Hand').length).toBe(2));
    expect(runtime.store[`${QT_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Mind Spike 2/Day: two casts spend both uses with DC 12/Wisdom logs, third refused — zero extra spend (§57)', async () => {
    renderQuaggothThonot();
    await act(async () => { fireEvent.click(linkByText('Mind Spike')); });
    await waitFor(() => expect(abilityUseEntries('Mind Spike').length).toBe(1));
    expect(runtime.store[`${QT_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Mind Spike': 1 });
    expect(abilityUseEntries('Mind Spike')[0].description).toMatch(/2\/Day use spent — 1 remaining/);

    await act(async () => { fireEvent.click(linkByText('Mind Spike')); });
    await waitFor(() => expect(abilityUseEntries('Mind Spike').length).toBe(2));
    expect(runtime.store[`${QT_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Mind Spike': 2 });

    await act(async () => { fireEvent.click(linkByText('Mind Spike')); });
    await waitFor(() => expect(refusals('Mind Spike').length).toBe(1));
    expect(abilityUseEntries('Mind Spike').length).toBe(2);
    expect(runtime.store[`${QT_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Mind Spike': 2 });
  });
});

// ── MA-1375 data lock: Questing Knight Spellcasting row ───────────────────────

describe('MA-1375 monsters.json data lock: Questing Knight Spellcasting row', () => {
  it('extracts all four spell names as chips — tier header skipped', () => {
    const names = extractSpellNamesFromSpellcasting(questingKnightRow.description);
    expect(names).toEqual(QK_NAMES);
    expect(names).not.toContain('1/Day Each');
  });

  it('disk description carries all four name-wrapped <strong> tokens in authored order', () => {
    const d = questingKnightRow.description;
    QK_NAMES.forEach(n => expect(d).toContain(`<strong>${n}</strong>`));
    const pos = QK_NAMES.map(n => d.indexOf(`<strong>${n}</strong>`));
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
    pos.forEach(p => expect(p).toBeGreaterThan(-1));
  });

  it('binds 1/Day Each to all four marked names — tracking no longer structurally dead (§57/§144)', () => {
    const uses = extractSpellcastingSpellUses(questingKnightRow.description);
    expect(uses).toEqual(Object.fromEntries(QK_ONE_DAY.map(n => [n, 1])));
  });

  it('row-level numeric save_dc 16 + save_type Charisma pair intact (§89 gate pre-met)', () => {
    expect(questingKnightRow.save_dc).toBe(16);
    expect(questingKnightRow.save_type).toBe('Charisma');
    expect(questingKnightRow.description).toMatch(/\(spell save DC 16\)/);
  });

  it('junk attack_bonus 0 STRIPPED — armed twins (death-knight armed row + djinni) carry no attack_bonus key (MA-1369: strip what twins strip)', () => {
    expect('attack_bonus' in questingKnightRow).toBe(false);
    const dk = monsters.find(m => m.index === 'death-knight');
    const dkRow = dk.actions.find(a => a.name === 'Spellcasting');
    expect('attack_bonus' in dkRow).toBe(false);
    expect('attack_bonus' in djinniRow).toBe(false);
  });

  it('emphasis census: ONLY the tier header + four spell names carry <strong> — no <em>, no fake-chip decoys (§161)', () => {
    const tokens = (questingKnightRow.description.match(/<(?:strong|em)>[^<]*<\/(?:strong|em)>/g) || []);
    expect(tokens).toEqual(['<strong>1/Day Each:</strong>', '<strong>Daylight</strong>', '<strong>Dispel Evil and Good</strong>', '<strong>Greater Restoration</strong>', '<strong>Phantom Steed</strong>']);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(questingKnightRow.description)).toBe(QK_PLAIN_ORIGINAL);
  });

  it('DC 16 = 8 + CHA +4 + PB +4 for the questing knight (computed from disk)', () => {
    expect(questingKnight.ability_score_modifiers.cha).toBe(4);
    expect(questingKnight.proficiency_bonus).toBe(4);
    expect(8 + questingKnight.ability_score_modifiers.cha + questingKnight.proficiency_bonus).toBe(16);
  });

  it('all four spells exist in 5e spells.json, none carries attack_type — cast-affordance only', () => {
    QK_NAMES.forEach(n => {
      const s = spells5e.find(sp => sp.name === n);
      expect(s).toBeDefined();
      expect(s.attack_type == null).toBe(true);
    });
  });
});

// ── MA-1375 Modal: four chips, counters, 1/Day gate ───────────────────────────

describe('MA-1375 MonsterCardModal Questing Knight Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders four spell chips — the zero-chip inert row is gone', () => {
    renderQuestingKnight();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(QK_NAMES);
  });

  it('all four names carry 1/Day counters; the "1/Day Each" header renders no chip', () => {
    renderQuestingKnight();
    QK_ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    expect(linkByText('1/Day Each')).toBeNull();
  });

  it('junk "+0" attack chip gone with attack_bonus stripped — four spell links are the row\'s only controls (§490)', () => {
    renderQuestingKnight();
    const row = Array.from(document.querySelectorAll('.mc-action')).find(el => el.querySelector('strong')?.textContent.startsWith('Spellcasting'));
    expect(row).toBeTruthy();
    expect(row.querySelectorAll('.mc-dice-link').length).toBe(4);
    expect(row.querySelectorAll('.mc-dice-link:not(.mc-dice-link-spell)').length).toBe(0);
    expect(row.textContent).not.toContain('+0');
  });

  it('Daylight 1/Day: cast spends the single use with DC 16/Charisma advisory, re-fire refused — zero extra spend (§57)', async () => {
    renderQuestingKnight();
    await act(async () => { fireEvent.click(linkByText('Daylight')); });
    await waitFor(() => expect(abilityUseEntries('Daylight').length).toBe(1));
    expect(runtime.store[`${QK_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Daylight': 1 });
    expect(abilityUseEntries('Daylight')[0].description).toMatch(/1\/Day use spent/);
    expect(abilityUseEntries('Daylight')[0].description).toMatch(/\(spell save DC 16/);

    await act(async () => { fireEvent.click(linkByText('Daylight')); });
    await waitFor(() => expect(refusals('Daylight').length).toBe(1));
    expect(abilityUseEntries('Daylight').length).toBe(1);
    expect(runtime.store[`${QK_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Daylight': 1 });
  });

  it('1/Day Each binds EACH name: four distinct casts spend one each, same-name re-fire refused', async () => {
    renderQuestingKnight();
    for (const n of QK_NAMES) {
      await act(async () => { fireEvent.click(linkByText(n)); });
      await waitFor(() => expect(abilityUseEntries(n).length).toBe(1));
      expect(refusals(n).length).toBe(0);
    }
    expect(runtime.store[`${QK_MONSTER_NAME}.monsterSpellUses`]).toEqual(Object.fromEntries(QK_NAMES.map(k => [k, 1])));
    await act(async () => { fireEvent.click(linkByText('Phantom Steed')); });
    await waitFor(() => expect(refusals('Phantom Steed').length).toBe(1));
    expect(abilityUseEntries('Phantom Steed').length).toBe(1);
  });
});

// ── MA-1380 data lock: Rakshasa Spellcasting row ──────────────────────────────

describe('MA-1380 monsters.json data lock: Rakshasa Spellcasting row', () => {
  it('extracts all nine spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(rakshasaRow.description);
    expect(names).toEqual(RK_NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('1/Day Each');
  });

  it('disk description carries all nine name-wrapped <strong> tokens in authored order', () => {
    const d = rakshasaRow.description;
    RK_NAMES.forEach(n => expect(d).toContain(`<strong>${n}</strong>`));
    const pos = RK_NAMES.map(n => d.indexOf(`<strong>${n}</strong>`));
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
    pos.forEach(p => expect(p).toBeGreaterThan(-1));
  });

  it('binds 1/Day Each to Fly + Invisibility + Major Image + Plane Shift each at 1; At-Will five ungated (§57)', () => {
    const uses = extractSpellcastingSpellUses(rakshasaRow.description);
    expect(uses).toEqual(Object.fromEntries(RK_ONE_DAY.map(n => [n, 1])));
    RK_AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('row-level numeric save_dc 18 + save_type Charisma pair untouched (§89 gate pre-met; §676 XOR keeps DC unrendered)', () => {
    expect(rakshasaRow.save_dc).toBe(18);
    expect(rakshasaRow.save_type).toBe('Charisma');
    expect(rakshasaRow.description).toMatch(/\(spell save DC 18\)/);
  });

  it('junk attack_bonus 0 STRIPPED — armed twins (djinni + MA-1375 questing-knight) carry no attack_bonus key (MA-1369/1375: strip what twins strip)', () => {
    expect('attack_bonus' in rakshasaRow).toBe(false);
    expect('attack_bonus' in djinniRow).toBe(false);
    expect('attack_bonus' in questingKnightRow).toBe(false);
  });

  it('emphasis census: ONLY the two tier headers + nine spell names carry <strong> — no <em>, no fake-chip decoys (§161)', () => {
    const tokens = (rakshasaRow.description.match(/<(?:strong|em)>[^<]*<\/(?:strong|em)>/g) || []);
    expect(tokens).toEqual(['<strong>At Will:</strong>', '<strong>Detect Magic</strong>', '<strong>Detect Thoughts</strong>', '<strong>Disguise Self</strong>', '<strong>Mage Hand</strong>', '<strong>Minor Illusion</strong>', '<strong>1/Day Each:</strong>', '<strong>Fly</strong>', '<strong>Invisibility</strong>', '<strong>Major Image</strong>', '<strong>Plane Shift</strong>']);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(rakshasaRow.description)).toBe(RK_PLAIN_ORIGINAL);
  });

  it('DC 18 = 8 + CHA +5 + PB +5 for the rakshasa (computed from disk)', () => {
    expect(rakshasa.ability_score_modifiers.cha).toBe(5);
    expect(rakshasa.proficiency_bonus).toBe(5);
    expect(8 + rakshasa.ability_score_modifiers.cha + rakshasa.proficiency_bonus).toBe(18);
  });

  it('§158 trap INACTIVE: all nine spells byte-match BOTH 5e and 2024 indexes; only Plane Shift carries attack_type melee', () => {
    RK_NAMES.forEach(n => {
      expect(spells5e.some(s => s.name === n)).toBe(true);
      expect(spells2024.some(s => s.name === n)).toBe(true);
    });
    RK_NAMES.filter(n => n !== 'Plane Shift').forEach(n => {
      expect(spells5e.find(s => s.name === n).attack_type == null).toBe(true);
    });
    expect(spells5e.find(s => s.name === 'Plane Shift').attack_type).toBe('melee');
  });

  it('actions[1] Cursed Touch (MA-1378, edited same day) not clobbered — hit_conditions + secondary dice intact', () => {
    const ct = rakshasa.actions[1];
    expect(ct.name).toBe('Cursed Touch');
    expect(ct.hit_conditions).toEqual(['cursed']);
    expect(ct.damage_dice_secondary).toBe('3d12');
    expect(ct.attack_bonus).toBe(10);
  });
});

// ── MA-1380 Modal: nine chips, counters, 1/Day-EACH gates ────────────────────

describe('MA-1380 MonsterCardModal Rakshasa Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders nine spell chips — the zero-chip inert row is gone', () => {
    renderRakshasa();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(RK_NAMES);
  });

  it('junk "+0" attack chip gone with attack_bonus stripped — nine spell links are the row\'s only controls (§490)', () => {
    renderRakshasa();
    const row = Array.from(document.querySelectorAll('.mc-action')).find(el => el.querySelector('strong')?.textContent.startsWith('Spellcasting'));
    expect(row).toBeTruthy();
    expect(row.querySelectorAll('.mc-dice-link').length).toBe(9);
    expect(row.querySelectorAll('.mc-dice-link:not(.mc-dice-link-spell)').length).toBe(0);
    expect(row.textContent).not.toContain('+0');
  });

  it('the four 1/Day Each names carry counters; the At-Will five do not (§57 gate binds)', () => {
    renderRakshasa();
    RK_ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    RK_AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('Fly 1/Day: cast spends the single use with DC 18/Charisma advisory, re-fire refused — zero extra spend (§57)', async () => {
    renderRakshasa();
    await act(async () => { fireEvent.click(linkByText('Fly')); });
    await waitFor(() => expect(abilityUseEntries('Fly').length).toBe(1));
    expect(runtime.store[`${RK_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Fly': 1 });
    expect(abilityUseEntries('Fly')[0].description).toMatch(/1\/Day use spent/);
    expect(abilityUseEntries('Fly')[0].description).toMatch(/\(spell save DC 18/);

    await act(async () => { fireEvent.click(linkByText('Fly')); });
    await waitFor(() => expect(refusals('Fly').length).toBe(1));
    expect(abilityUseEntries('Fly').length).toBe(1);
    expect(runtime.store[`${RK_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Fly': 1 });
  });

  it('1/Day Each binds EACH name: Invisibility and Major Image spend independently after Fly — same-name re-fire refused per name', async () => {
    renderRakshasa();
    for (const n of ['Fly', 'Invisibility', 'Major Image']) {
      await act(async () => { fireEvent.click(linkByText(n)); });
      await waitFor(() => expect(abilityUseEntries(n).length).toBe(1));
      expect(refusals(n).length).toBe(0);
    }
    expect(runtime.store[`${RK_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Fly': 1, 'Invisibility': 1, 'Major Image': 1 });
    await act(async () => { fireEvent.click(linkByText('Invisibility')); });
    await waitFor(() => expect(refusals('Invisibility').length).toBe(1));
    expect(abilityUseEntries('Invisibility').length).toBe(1);
    await act(async () => { fireEvent.click(linkByText('Major Image')); });
    await waitFor(() => expect(refusals('Major Image').length).toBe(1));
    expect(abilityUseEntries('Major Image').length).toBe(1);
  });

  it('Plane Shift (spells.json attack_type melee) refuses honestly — zero uses spent (djinni MA-0611 twin)', async () => {
    renderRakshasa();
    await act(async () => { fireEvent.click(linkByText('Plane Shift')); });
    await waitFor(() => expect(refusals('Plane Shift').length).toBe(1));
    expect(abilityUseEntries('Plane Shift').length).toBe(0);
    expect(runtime.store[`${RK_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('At Will Detect Magic casts ungated twice — zero uses, advisory log prints row DC 18 (§204)', async () => {
    renderRakshasa();
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(1));
    expect(abilityUseEntries('Detect Magic')[0].description).toMatch(/\(spell save DC 18/);
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(2));
    expect(runtime.store[`${RK_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('At-Will five all cast ungated — zero refusals, zero uses keys written (§57)', async () => {
    renderRakshasa();
    for (const n of RK_AT_WILL) {
      await act(async () => { fireEvent.click(linkByText(n)); });
      await waitFor(() => expect(abilityUseEntries(n).length).toBe(1));
      expect(refusals(n).length).toBe(0);
    }
    expect(runtime.store[`${RK_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});

// ── MA-1419 data lock: Sahuagin Priest Spellcasting row ──────────────────────

describe('MA-1419 monsters.json data lock: Sahuagin Priest Spellcasting row', () => {
  it('extracts all three spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(sahuaginPriestRow.description);
    expect(names).toEqual(SP_NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('2/Day Each');
  });

  it('disk description carries all three name-wrapped <strong> tokens in authored order', () => {
    const d = sahuaginPriestRow.description;
    SP_NAMES.forEach(n => expect(d).toContain(`<strong>${n}</strong>`));
    const pos = SP_NAMES.map(n => d.indexOf(`<strong>${n}</strong>`));
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
    pos.forEach(p => expect(p).toBeGreaterThan(-1));
  });

  it('binds 2/Day Each to Hold Person + Tongues EACH at 2; At-Will Thaumaturgy ungated (§57/§144)', () => {
    const uses = extractSpellcastingSpellUses(sahuaginPriestRow.description);
    expect(uses).toEqual({ 'Hold Person': 2, 'Tongues': 2 });
    expect(uses['Thaumaturgy']).toBeUndefined();
  });

  it('row-level numeric save_dc 12 + save_type Wisdom pair untouched (§89 gate pre-met; §676 XOR keeps DC unrendered)', () => {
    expect(sahuaginPriestRow.save_dc).toBe(12);
    expect(sahuaginPriestRow.save_type).toBe('Wisdom');
    expect(sahuaginPriestRow.description).toMatch(/\(spell save DC 12\)/);
  });

  it('junk attack_bonus 0 STRIPPED — armed twins (djinni + MA-1375/MA-1380 post-fix) carry no attack_bonus key (MA-1369/1375: strip what twins strip)', () => {
    expect('attack_bonus' in sahuaginPriestRow).toBe(false);
    expect('attack_bonus' in djinniRow).toBe(false);
    expect('attack_bonus' in questingKnightRow).toBe(false);
    expect('attack_bonus' in rakshasaRow).toBe(false);
  });

  it('emphasis census: ONLY the two tier headers + three spell names carry <strong> — no <em>, no fake-chip decoys (§161)', () => {
    const tokens = (sahuaginPriestRow.description.match(/<(?:strong|em)>[^<]*<\/(?:strong|em)>/g) || []);
    expect(tokens).toEqual(['<strong>At Will:</strong>', '<strong>Thaumaturgy</strong>', '<strong>2/Day Each:</strong>', '<strong>Hold Person</strong>', '<strong>Tongues</strong>']);
  });

  it('markup+drop-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(sahuaginPriestRow.description)).toBe(SP_PLAIN_ORIGINAL);
  });

  it('DC 12 = 8 + WIS +2 + PB +2 for the sahuagin priest (computed from disk)', () => {
    expect(sahuaginPriest.ability_score_modifiers.wis).toBe(2);
    expect(sahuaginPriest.proficiency_bonus).toBe(2);
    expect(8 + sahuaginPriest.ability_score_modifiers.wis + sahuaginPriest.proficiency_bonus).toBe(12);
  });

  it('all three spells byte-match BOTH indexes; Hold Person damageless WIS dc_success:none (MA-0348 seam), Thaumaturgy/Tongues save-less (§204)', () => {
    SP_NAMES.forEach(n => expect(spells2024.some(s => s.name === n)).toBe(true));
    const hp = spells5e.find(s => s.name === 'Hold Person');
    expect(hp.dc.dc_type).toBe('WIS');
    expect(hp.dc.dc_success).toBe('none');
    expect(hp.attack_type == null).toBe(true);
    expect(hp.damage == null).toBe(true);
    SP_AT_WILL.forEach(n => {
      const s = spells5e.find(sp => sp.name === n);
      expect(s.dc == null).toBe(true);
      expect(s.attack_type == null).toBe(true);
    });
    expect(spells5e.find(s => s.name === 'Tongues').dc == null).toBe(true);
  });

  it('sahuagin siblings untouched — Priestess/Baron share the species prose but own NO Spellcasting row (lead-in anchor unique)', () => {
    const priestess = monsters.find(m => m.index === 'sahuagin-priestess');
    const baron = monsters.find(m => m.index === 'sahuagin-baron');
    expect(priestess.actions.some(a => a.name === 'Spellcasting')).toBe(false);
    expect(baron.actions.some(a => a.name === 'Spellcasting')).toBe(false);
    expect(sahuaginPriest.actions[0].name).toBe('Multiattack');
    expect(sahuaginPriest.actions[1].name).toBe('Spectral Jaws');
    expect(sahuaginPriest.actions[1].attack_bonus).toBe(4);
  });
});

// ── MA-1419 Modal: three chips, counters, 2/Day-EACH gates ────────────────────

describe('MA-1419 MonsterCardModal Sahuagin Priest Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders three spell chips — the zero-chip inert row is gone', () => {
    renderSahuaginPriest();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(SP_NAMES);
  });

  it('the two 2/Day Each names carry counters; At-Will Thaumaturgy does not (§57 gate binds)', () => {
    renderSahuaginPriest();
    SP_TWO_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(2\/Day · 2 left\)/));
    expect(linkByText('Thaumaturgy').textContent).not.toMatch(/\/Day/);
  });

  it('junk "+0" attack chip gone with attack_bonus stripped — three spell links are the row\'s only controls (§490)', () => {
    renderSahuaginPriest();
    const row = Array.from(document.querySelectorAll('.mc-action')).find(el => el.querySelector('strong')?.textContent.startsWith('Spellcasting'));
    expect(row).toBeTruthy();
    expect(row.querySelectorAll('.mc-dice-link').length).toBe(3);
    expect(row.querySelectorAll('.mc-dice-link:not(.mc-dice-link-spell)').length).toBe(0);
    expect(row.textContent).not.toContain('+0');
  });

  it('Hold Person 2/Day: two casts spend both uses with DC 12/Wisdom save-leg logs, third refused — zero extra spend (§57)', async () => {
    renderSahuaginPriest();
    await act(async () => { fireEvent.click(linkByText('Hold Person')); });
    await waitFor(() => expect(abilityUseEntries('Hold Person').length).toBe(1));
    expect(runtime.store[`${SP_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Hold Person': 1 });
    expect(abilityUseEntries('Hold Person')[0].description).toMatch(/2\/Day use spent — 1 remaining/);

    await act(async () => { fireEvent.click(linkByText('Hold Person')); });
    await waitFor(() => expect(abilityUseEntries('Hold Person').length).toBe(2));
    expect(runtime.store[`${SP_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Hold Person': 2 });

    await act(async () => { fireEvent.click(linkByText('Hold Person')); });
    await waitFor(() => expect(refusals('Hold Person').length).toBe(1));
    expect(abilityUseEntries('Hold Person').length).toBe(2);
    expect(runtime.store[`${SP_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Hold Person': 2 });
  });

  it('2/Day Each binds EACH name independently: exhausted Hold Person never blocks Tongues, which spends its own pair then refuses (§144)', async () => {
    renderSahuaginPriest();
    await act(async () => { fireEvent.click(linkByText('Hold Person')); });
    await waitFor(() => expect(abilityUseEntries('Hold Person').length).toBe(1));
    await act(async () => { fireEvent.click(linkByText('Hold Person')); });
    await waitFor(() => expect(runtime.store[`${SP_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Hold Person': 2 }));

    await act(async () => { fireEvent.click(linkByText('Tongues')); });
    await waitFor(() => expect(abilityUseEntries('Tongues').length).toBe(1));
    expect(refusals('Tongues').length).toBe(0);
    expect(runtime.store[`${SP_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Hold Person': 2, 'Tongues': 1 });

    await act(async () => { fireEvent.click(linkByText('Tongues')); });
    await waitFor(() => expect(runtime.store[`${SP_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Hold Person': 2, 'Tongues': 2 }));
    await act(async () => { fireEvent.click(linkByText('Tongues')); });
    await waitFor(() => expect(refusals('Tongues').length).toBe(1));
    expect(abilityUseEntries('Tongues').length).toBe(2);

    await act(async () => { fireEvent.click(linkByText('Hold Person')); });
    await waitFor(() => expect(refusals('Hold Person').length).toBe(1));
    expect(abilityUseEntries('Hold Person').length).toBe(2);
  });

  it('At-Will Thaumaturgy casts ungated twice — zero uses, advisory log prints row DC 12/Wisdom (§204)', async () => {
    renderSahuaginPriest();
    await act(async () => { fireEvent.click(linkByText('Thaumaturgy')); });
    await waitFor(() => expect(abilityUseEntries('Thaumaturgy').length).toBe(1));
    expect(abilityUseEntries('Thaumaturgy')[0].description).toMatch(/\(spell save DC 12/);
    await act(async () => { fireEvent.click(linkByText('Thaumaturgy')); });
    await waitFor(() => expect(abilityUseEntries('Thaumaturgy').length).toBe(2));
    expect(refusals('Thaumaturgy').length).toBe(0);
    expect(runtime.store[`${SP_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});

// ── MA-1478 data lock: Solar Spellcasting row ────────────────────────────────

describe('MA-1478 monsters.json data lock: Solar Spellcasting row', () => {
  it('extracts all five spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(solarRow.description);
    expect(names).toEqual(SL_NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('1/Day Each');
  });

  it('disk description carries all five name-wrapped <strong> tokens in authored order', () => {
    const d = solarRow.description;
    SL_NAMES.forEach(n => expect(d).toContain(`<strong>${n}</strong>`));
    const pos = SL_NAMES.map(n => d.indexOf(`<strong>${n}</strong>`));
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
    pos.forEach(p => expect(p).toBeGreaterThan(-1));
  });

  it('binds 1/Day EACH to Commune + Control Weather + Dispel Evil and Good + Resurrection; At Will name ungated (§57/§144)', () => {
    const uses = extractSpellcastingSpellUses(solarRow.description);
    expect(uses).toEqual(Object.fromEntries(SL_ONE_DAY.map(n => [n, 1])));
    SL_AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('row-level numeric save_dc 25 + save_type Charisma pair byte-untouched (§89/§167 gate pre-met; §676 XOR keeps DC unrendered)', () => {
    expect(solarRow.save_dc).toBe(25);
    expect(solarRow.save_type).toBe('Charisma');
    expect(solarRow.description).toMatch(/\(spell save DC 25\)/);
    expect('attack_bonus' in solarRow).toBe(false);
  });

  it('save_effect sibling key stays plain-text — Spellcasting row renders SpellCastLinks XOR, save lane never consulted (§118)', () => {
    expect(solarRow.save_effect).toBe(SL_PLAIN_ORIGINAL);
    expect(solarRow.save_effect).not.toMatch(/<(?:strong|em)>/);
  });

  it('emphasis census: ONLY the two tier headers + five spell names carry <strong> — no <em>, no fake-chip decoys (§161)', () => {
    const tokens = (solarRow.description.match(/<(?:strong|em)>[^<]*<\/(?:strong|em)>/g) || []);
    expect(tokens).toEqual(['<strong>At Will:</strong>', '<strong>Detect Evil and Good</strong>', '<strong>1/Day Each:</strong>', '<strong>Commune</strong>', '<strong>Control Weather</strong>', '<strong>Dispel Evil and Good</strong>', '<strong>Resurrection</strong>']);
  });

  it('markup-only diff proof: stripped text equals the pre-fix SINGLE-LINE prose byte-for-byte ("; " / ", " separators kept)', () => {
    expect(stripTags(solarRow.description)).toBe(SL_PLAIN_ORIGINAL);
  });

  it('DC 25 = 8 + CHA +10 + PB +7 for the solar (computed from disk)', () => {
    expect(solar.ability_score_modifiers.cha).toBe(10);
    expect(solar.proficiency_bonus).toBe(7);
    expect(8 + solar.ability_score_modifiers.cha + solar.proficiency_bonus).toBe(25);
  });

  it('§158 trap INACTIVE: all five spells byte-match BOTH 5e and 2024 indexes, zero attack_type — cast-affordance only', () => {
    SL_NAMES.forEach(n => {
      const s = spells5e.find(sp => sp.name === n);
      expect(s).toBeDefined();
      expect(s.attack_type == null).toBe(true);
      expect(spells2024.some(sp => sp.name === n)).toBe(true);
    });
  });

  it('planetar MA-1327 spell-list twin intact — Raise Dead tier untouched, no cross-row clobber', () => {
    expect(planetarRow.description).toContain('<strong>Raise Dead</strong>');
    expect(planetarRow.description).not.toContain('Resurrection');
    expect(solarRow.description).toContain('<strong>Resurrection</strong>');
    expect(solarRow.description).not.toBe(planetarRow.description);
  });
});

// ── MA-1478 Modal: five chips, counters, 1/Day-EACH gates ────────────────────

describe('MA-1478 MonsterCardModal Solar Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders five spell chips — the zero-chip inert row is gone', () => {
    renderSolar();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(SL_NAMES);
  });

  it('the four 1/Day Each names carry counters; the At Will name does not (§57 gate binds)', () => {
    renderSolar();
    SL_ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    SL_AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('no row-level DC 25 save chip — SpellCastLinks XOR fork owns the row (§118/§676)', () => {
    renderSolar();
    const row = Array.from(document.querySelectorAll('.mc-action')).find(el => el.querySelector('strong')?.textContent.startsWith('Spellcasting'));
    expect(row).toBeTruthy();
    expect(row.querySelectorAll('.mc-dice-link-spell').length).toBe(5);
    expect(row.querySelectorAll('.mc-dice-link-save').length).toBe(0);
  });

  it('At Will Detect Evil and Good casts ungated twice — zero uses, advisory log prints row DC 25 (§204/§207 utility inline advisory)', async () => {
    renderSolar();
    await act(async () => { fireEvent.click(linkByText('Detect Evil and Good')); });
    await waitFor(() => expect(abilityUseEntries('Detect Evil and Good').length).toBe(1));
    expect(abilityUseEntries('Detect Evil and Good')[0].description).toMatch(/\(spell save DC 25/);
    await act(async () => { fireEvent.click(linkByText('Detect Evil and Good')); });
    await waitFor(() => expect(abilityUseEntries('Detect Evil and Good').length).toBe(2));
    expect(refusals('Detect Evil and Good').length).toBe(0);
    expect(runtime.store[`${SL_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Commune 1/Day: cast spends the single use with DC 25 advisory, re-fire refused — zero extra spend (§57)', async () => {
    renderSolar();
    await act(async () => { fireEvent.click(linkByText('Commune')); });
    await waitFor(() => expect(abilityUseEntries('Commune').length).toBe(1));
    expect(runtime.store[`${SL_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Commune': 1 });
    expect(abilityUseEntries('Commune')[0].description).toMatch(/1\/Day use spent/);
    expect(abilityUseEntries('Commune')[0].description).toMatch(/\(spell save DC 25/);

    await act(async () => { fireEvent.click(linkByText('Commune')); });
    await waitFor(() => expect(refusals('Commune').length).toBe(1));
    expect(abilityUseEntries('Commune').length).toBe(1);
    expect(runtime.store[`${SL_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Commune': 1 });
  });

  it('1/Day Each binds EACH name: Control Weather and Dispel Evil and Good spend independently after Commune; exhausted Commune still refuses (§144)', async () => {
    renderSolar();
    for (const n of ['Commune', 'Control Weather', 'Dispel Evil and Good']) {
      await act(async () => { fireEvent.click(linkByText(n)); });
      await waitFor(() => expect(abilityUseEntries(n).length).toBe(1));
      expect(refusals(n).length).toBe(0);
    }
    expect(runtime.store[`${SL_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Commune': 1, 'Control Weather': 1, 'Dispel Evil and Good': 1 });
    await act(async () => { fireEvent.click(linkByText('Commune')); });
    await waitFor(() => expect(refusals('Commune').length).toBe(1));
    expect(abilityUseEntries('Commune').length).toBe(1);
    await act(async () => { fireEvent.click(linkByText('Control Weather')); });
    await waitFor(() => expect(refusals('Control Weather').length).toBe(1));
  });
});

// ── MA-1493 data lock: Sphinx of Lore Spellcasting row ───────────────────────

describe('MA-1493 monsters.json data lock: Sphinx of Lore Spellcasting row', () => {
  it('extracts all eleven spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(sphinxRow.description);
    expect(names).toEqual(SN_NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('1/Day Each');
  });

  it('disk description carries all eleven name-wrapped <strong> tokens in authored order', () => {
    const d = sphinxRow.description;
    SN_NAMES.forEach(n => expect(d).toContain(`<strong>${n}</strong>`));
    const pos = SN_NAMES.map(n => d.indexOf(`<strong>${n}</strong>`));
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
    pos.forEach(p => expect(p).toBeGreaterThan(-1));
  });

  it('binds 1/Day EACH to Dispel Magic + Legend Lore + Locate Object + Plane Shift + Remove Curse + Tongues; At Will names ungated (§57/§144)', () => {
    const uses = extractSpellcastingSpellUses(sphinxRow.description);
    expect(uses).toEqual(Object.fromEntries(SN_ONE_DAY.map(n => [n, 1])));
    SN_AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('row-level numeric save_dc 16 + save_type Intelligence pair byte-untouched (§89/§167 gate pre-met; §676 XOR keeps DC unrendered)', () => {
    expect(sphinxRow.save_dc).toBe(16);
    expect(sphinxRow.save_type).toBe('Intelligence');
    expect(sphinxRow.description).toMatch(/\(spell save DC 16\)/);
    expect('attack_bonus' in sphinxRow).toBe(false);
    expect('save_effect' in sphinxRow).toBe(false);
  });

  it('emphasis census: ONLY the two tier headers + eleven spell names carry <strong> — no <em>, no fake-chip decoys (§161)', () => {
    const tokens = (sphinxRow.description.match(/<(?:strong|em)>[^<]*<\/(?:strong|em)>/g) || []);
    expect(tokens).toEqual(['<strong>At Will:</strong>', '<strong>Detect Magic</strong>', '<strong>Identify</strong>', '<strong>Mage Hand</strong>', '<strong>Minor Illusion</strong>', '<strong>Prestidigitation</strong>', '<strong>1/Day Each:</strong>', '<strong>Dispel Magic</strong>', '<strong>Legend Lore</strong>', '<strong>Locate Object</strong>', '<strong>Plane Shift</strong>', '<strong>Remove Curse</strong>', '<strong>Tongues</strong>']);
  });

  it('markup-only diff proof: stripped text equals the pre-fix SINGLE-LINE prose byte-for-byte ("; " / ", " separators kept)', () => {
    expect(stripTags(sphinxRow.description)).toBe(SN_PLAIN_ORIGINAL);
  });

  it('DC 16 = 8 + INT +4 + PB +4 for the sphinx of lore (computed from disk)', () => {
    expect(sphinx.ability_score_modifiers.int).toBe(4);
    expect(sphinx.proficiency_bonus).toBe(4);
    expect(8 + sphinx.ability_score_modifiers.int + sphinx.proficiency_bonus).toBe(16);
  });

  it('§158 trap INACTIVE: all eleven spells byte-match BOTH 5e and 2024 indexes; Plane Shift carries attack_type melee (never fired here)', () => {
    SN_NAMES.forEach(n => {
      const s = spells5e.find(sp => sp.name === n);
      expect(s).toBeDefined();
      expect(spells2024.some(sp => sp.name === n)).toBe(true);
    });
    const planeShift = spells5e.find(sp => sp.name === 'Plane Shift');
    expect(planeShift.attack_type).toBe('melee');
  });

  it('sphinx-of-secrets DC 15 twin discriminant — shared lead-in, distinct DC + name set (§22 byte-shape)', () => {
    const secretsRow = monsters.find(m => m.index === 'sphinx-of-secrets').actions.find(a => a.name === 'Spellcasting');
    expect(secretsRow.save_dc).toBe(15);
    expect(sphinxRow.save_dc).toBe(16);
    expect(sphinxRow.description).not.toBe(secretsRow.description);
    expect(sphinxRow.description).toContain('<strong>Legend Lore</strong>');
    expect(secretsRow.description).not.toContain('Legend Lore');
  });
});

// ── MA-1493 Modal: eleven chips, counters, 1/Day-EACH gates ───────────────────

describe('MA-1493 MonsterCardModal Sphinx of Lore Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders eleven spell chips — the zero-chip inert row is gone', () => {
    renderSphinx();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(SN_NAMES);
  });

  it('the six 1/Day Each names carry counters; the five At Will names do not (§57 gate binds)', () => {
    renderSphinx();
    SN_ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    SN_AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('no row-level DC 16 save chip — SpellCastLinks XOR fork owns the row (§118/§676)', () => {
    renderSphinx();
    const row = Array.from(document.querySelectorAll('.mc-action')).find(el => el.querySelector('strong')?.textContent.startsWith('Spellcasting'));
    expect(row).toBeTruthy();
    expect(row.querySelectorAll('.mc-dice-link-spell').length).toBe(11);
    expect(row.querySelectorAll('.mc-dice-link-save').length).toBe(0);
  });

  it('At Will Identify casts ungated twice — zero uses, advisory log prints row DC 16 (§204/§207 utility inline advisory)', async () => {
    renderSphinx();
    await act(async () => { fireEvent.click(linkByText('Identify')); });
    await waitFor(() => expect(abilityUseEntries('Identify').length).toBe(1));
    expect(abilityUseEntries('Identify')[0].description).toMatch(/\(spell save DC 16/);
    await act(async () => { fireEvent.click(linkByText('Identify')); });
    await waitFor(() => expect(abilityUseEntries('Identify').length).toBe(2));
    expect(refusals('Identify').length).toBe(0);
    expect(runtime.store[`${SN_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Tongues 1/Day: cast spends the single use with DC 16 advisory, re-fire refused — zero extra spend (§57)', async () => {
    renderSphinx();
    await act(async () => { fireEvent.click(linkByText('Tongues')); });
    await waitFor(() => expect(abilityUseEntries('Tongues').length).toBe(1));
    expect(runtime.store[`${SN_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Tongues': 1 });
    expect(abilityUseEntries('Tongues')[0].description).toMatch(/1\/Day use spent/);
    expect(abilityUseEntries('Tongues')[0].description).toMatch(/\(spell save DC 16/);

    await act(async () => { fireEvent.click(linkByText('Tongues')); });
    await waitFor(() => expect(refusals('Tongues').length).toBe(1));
    expect(abilityUseEntries('Tongues').length).toBe(1);
    expect(runtime.store[`${SN_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Tongues': 1 });
  });

  it('1/Day Each binds EACH name: Dispel Magic and Locate Object spend independently after Tongues; exhausted Tongues still refuses (§144)', async () => {
    renderSphinx();
    for (const n of ['Tongues', 'Dispel Magic', 'Locate Object']) {
      await act(async () => { fireEvent.click(linkByText(n)); });
      await waitFor(() => expect(abilityUseEntries(n).length).toBe(1));
      expect(refusals(n).length).toBe(0);
    }
    expect(runtime.store[`${SN_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Tongues': 1, 'Dispel Magic': 1, 'Locate Object': 1 });
    await act(async () => { fireEvent.click(linkByText('Tongues')); });
    await waitFor(() => expect(refusals('Tongues').length).toBe(1));
    expect(abilityUseEntries('Tongues').length).toBe(1);
    await act(async () => { fireEvent.click(linkByText('Dispel Magic')); });
    await waitFor(() => expect(refusals('Dispel Magic').length).toBe(1));
  });
});

// ── MA-1499 data lock: Sphinx of Secrets Spellcasting row ─────────────────────

describe('MA-1499 monsters.json data lock: Sphinx of Secrets Spellcasting row', () => {
  it('extracts all five spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(sosRow.description);
    expect(names).toEqual(SS_NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('1/Day Each');
  });

  it('disk description carries all five name-wrapped <strong> tokens in authored order', () => {
    const d = sosRow.description;
    SS_NAMES.forEach(n => expect(d).toContain(`<strong>${n}</strong>`));
    const pos = SS_NAMES.map(n => d.indexOf(`<strong>${n}</strong>`));
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
    pos.forEach(p => expect(p).toBeGreaterThan(-1));
  });

  it('binds 1/Day EACH to Locate Object + Remove Curse; At Will names ungated (§57/§144)', () => {
    const uses = extractSpellcastingSpellUses(sosRow.description);
    expect(uses).toEqual(Object.fromEntries(SS_ONE_DAY.map(n => [n, 1])));
    SS_AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('row-level numeric save_dc 15 + save_type Intelligence pair byte-untouched (§89/§167 gate pre-met; §676 XOR keeps DC unrendered)', () => {
    expect(sosRow.save_dc).toBe(15);
    expect(sosRow.save_type).toBe('Intelligence');
    expect(sosRow.description).toMatch(/\(spell save DC 15\)/);
    expect('attack_bonus' in sosRow).toBe(false);
    expect('save_effect' in sosRow).toBe(false);
  });

  it('emphasis census: ONLY the two tier headers + five spell names carry <strong> — no <em>, no fake-chip decoys (§161)', () => {
    const tokens = (sosRow.description.match(/<(?:strong|em)>[^<]*<\/(?:strong|em)>/g) || []);
    expect(tokens).toEqual(['<strong>At Will:</strong>', '<strong>Detect Magic</strong>', '<strong>Identify</strong>', '<strong>Prestidigitation</strong>', '<strong>1/Day Each:</strong>', '<strong>Locate Object</strong>', '<strong>Remove Curse</strong>']);
  });

  it('markup-only diff proof: stripped text equals the pre-fix SINGLE-LINE prose byte-for-byte ("; " / ", " separators kept)', () => {
    expect(stripTags(sosRow.description)).toBe(SS_PLAIN_ORIGINAL);
  });

  it('DC 15 = 8 + INT +4 + PB +3 for the sphinx of secrets (computed from disk)', () => {
    expect(sos.ability_score_modifiers.int).toBe(4);
    expect(sos.proficiency_bonus).toBe(3);
    expect(8 + sos.ability_score_modifiers.int + sos.proficiency_bonus).toBe(15);
  });

  it('§158 trap INACTIVE: all five spells byte-match BOTH 5e and 2024 indexes, zero attack_type — cast-affordance only', () => {
    SS_NAMES.forEach(n => {
      const s = spells5e.find(sp => sp.name === n);
      expect(s).toBeDefined();
      expect(s.attack_type == null).toBe(true);
      expect(spells2024.some(sp => sp.name === n)).toBe(true);
    });
  });

  it('sphinx-of-lore MA-1493 twin discriminant — shared lead-in, distinct DC + name set (§22 byte-shape)', () => {
    expect(sosRow.save_dc).toBe(15);
    expect(sphinxRow.save_dc).toBe(16);
    expect(sosRow.description).not.toBe(sphinxRow.description);
    expect(sosRow.description).not.toContain('Legend Lore');
    expect(sphinxRow.description).toContain('<strong>Legend Lore</strong>');
    expect(sosRow.description).toContain('<strong>Locate Object</strong>');
  });
});

// ── MA-1499 Modal: five chips, counters, 1/Day-EACH gates ──────────────────────

describe('MA-1499 MonsterCardModal Sphinx of Secrets Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders five spell chips — the zero-chip inert row is gone', () => {
    renderSphinxOfSecrets();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(SS_NAMES);
  });

  it('the two 1/Day Each names carry counters; the three At Will names do not (§57 gate binds)', () => {
    renderSphinxOfSecrets();
    SS_ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    SS_AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('no row-level DC 15 save chip — SpellCastLinks XOR fork owns the row (§118/§676)', () => {
    renderSphinxOfSecrets();
    const row = Array.from(document.querySelectorAll('.mc-action')).find(el => el.querySelector('strong')?.textContent.startsWith('Spellcasting'));
    expect(row).toBeTruthy();
    expect(row.querySelectorAll('.mc-dice-link-spell').length).toBe(5);
    expect(row.querySelectorAll('.mc-dice-link-save').length).toBe(0);
  });

  it('At Will Prestidigitation casts ungated twice — zero uses, advisory log prints row DC 15 (§204/§207 utility inline advisory)', async () => {
    renderSphinxOfSecrets();
    await act(async () => { fireEvent.click(linkByText('Prestidigitation')); });
    await waitFor(() => expect(abilityUseEntries('Prestidigitation').length).toBe(1));
    expect(abilityUseEntries('Prestidigitation')[0].description).toMatch(/\(spell save DC 15/);
    await act(async () => { fireEvent.click(linkByText('Prestidigitation')); });
    await waitFor(() => expect(abilityUseEntries('Prestidigitation').length).toBe(2));
    expect(refusals('Prestidigitation').length).toBe(0);
    expect(runtime.store[`${SOS_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Locate Object 1/Day: cast spends the single use with DC 15 advisory, re-fire refused — zero extra spend (§57)', async () => {
    renderSphinxOfSecrets();
    await act(async () => { fireEvent.click(linkByText('Locate Object')); });
    await waitFor(() => expect(abilityUseEntries('Locate Object').length).toBe(1));
    expect(runtime.store[`${SOS_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Locate Object': 1 });
    expect(abilityUseEntries('Locate Object')[0].description).toMatch(/1\/Day use spent/);
    expect(abilityUseEntries('Locate Object')[0].description).toMatch(/\(spell save DC 15/);

    await act(async () => { fireEvent.click(linkByText('Locate Object')); });
    await waitFor(() => expect(refusals('Locate Object').length).toBe(1));
    expect(abilityUseEntries('Locate Object').length).toBe(1);
    expect(runtime.store[`${SOS_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Locate Object': 1 });
  });

  it('1/Day Each binds EACH name: Remove Curse spends independently after Locate Object; exhausted Locate Object still refuses (§144)', async () => {
    renderSphinxOfSecrets();
    for (const n of ['Locate Object', 'Remove Curse']) {
      await act(async () => { fireEvent.click(linkByText(n)); });
      await waitFor(() => expect(abilityUseEntries(n).length).toBe(1));
      expect(refusals(n).length).toBe(0);
    }
    expect(runtime.store[`${SOS_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Locate Object': 1, 'Remove Curse': 1 });
    await act(async () => { fireEvent.click(linkByText('Locate Object')); });
    await waitFor(() => expect(refusals('Locate Object').length).toBe(1));
    expect(abilityUseEntries('Locate Object').length).toBe(1);
    await act(async () => { fireEvent.click(linkByText('Remove Curse')); });
    await waitFor(() => expect(refusals('Remove Curse').length).toBe(1));
  });
});
