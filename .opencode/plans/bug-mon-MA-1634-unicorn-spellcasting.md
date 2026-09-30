# Bug MA-1634 — Unicorn Spellcasting (actions[3]) FAIL(b)/DATA — markup-free spellcasting row renders zero cast links

**Row:** MA-1634 | unicorn|actions|3 | Spellcasting | saveDc 14 Charisma
**Precedent:** MA-1543 §1088/§1089 (Storm Giant) — byte-identical adjudication map: live chips = PASS-subset §207; plain text = FAIL(b) §1088. MA-1625 (Ultroloth) re-confirmed same family.

## STEP 1 DISK-BYTES (monsters.json unicorn actions[3])
- Keys: `{name:"Spellcasting", description, save_dc:14, save_type:"Charisma", save_effect}`.
- Description 280 bytes, SHA256 `1049b5f0…d261cc`, byte-exact vs manifest `description` AND `saveEffect`.
- Contains `<strong>`: **False**. `<em>`: **False**. Any `<`: **False**. → All 9 spell names (Detect Evil and Good, Druidcraft, Calm Emotions, Dispel Evil and Good, Entangle, Pass without Trace, Word of Recall + section labels At Will / 1/Day Each) are plain text.
- Head: `The unicorn casts one of the following spells, requiring no spell components and using Charisma as the spellcasting ability (spell save DC 14): At Will: Detect Evil and Good, Druidcraft; 1/Day Each: Calm Emotio…`

## STEP 2 LIVE CENSUS (test-campaign, localhost:5173, own evaluate truth)
- EB filter "Unicorn" → 1 row, exact td[1]==='Unicorn' CR5 → Join → cs idx0 ac12 hp97/97.
- Bandit 1 victim via full-store /combatSummary POST {value:cs} ac12 + 999×4 HP keys + Unicorn targetName SAME POST (§MA-1601; no +NPC autocomplete). Target select "Bandit 1" live-confirmed in card combobox.
- Unicorn card `.mc-overlay` Spellcasting row:
  - `.mc-dice-link`: **0** | `.mc-spell`: **0** | `[role="button"]`: **0**
  - `strong`: only `["Spellcasting."]` | `em`: **0** | spans: 1 (plain-text body)
  - innerText byte-matches disk description (markup stripped) — zero affordance.
- Click probes (strong + span, 2 passes): clickable children 0 both passes, visible popups 0 both passes, log delta 0 (baseline 2 benign join/initiative entries → still 2).
- Console errors: 0.

## PARSER SEAM (grep, line cites)
- `src/components/encounter/MonsterCardHelpers.js:392-403` `extractSpellNamesFromSpellcasting` — regex `/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g` harvests spell names ONLY from `<strong>`/`<em>` markup → unicorn plain-text description → `[]`.
- `src/components/encounter/MonsterAction.jsx:83-84` `SpellCastLinks` — `names.length === 0 → return null` → row renders header strong + inert span only.
- `src/components/encounter/MonsterAction.jsx:351` `SpellOrSaveLinks` — `isSpellcastingRow` forks to `SpellCastLinks` ONLY; the structured `save_dc:14`/`save_type:"Charisma"`/`save_effect` keys can NEVER reach the `ActionSaveRoll` shell (`:367`) — no DC chip either (MA-1294 structural, §1543).
- `extractSpellcastingSpellUses` (Helpers:~440, "N/Day Each" binding) never runs: gate code sits behind the null SpellCastLinks return → "1/Day Each" gate unarmed (Helpers:440 armed-but-unreachable here).

## FIX (DATA)
Dao house-style re-markup of unicorn actions[3].description, wrapping EACH spell name:
`<strong>At Will:</strong> <em>Detect Evil and Good</em>, <em>Druidcraft</em>; <strong>1/Day Each:</strong> <em>Calm Emotions</em>, <em>Dispel Evil and Good</em>, <em>Entangle</em>, <em>Pass without Trace</em>, <em>Word of Recall</em>`
Headers-only markup stays dead (§648) — EACH name needs markup. Fix also arms the MA-0020 "1/Day Each" uses gate (§1543-FIXED).

## VERDICT: FAIL(b)/DATA
Spell-cast lane dead while card live: structured save_dc 14/Charisma + rich save_effect authored on disk, but zero `<strong>`/`<em>` spell-name markup → parser harvests [] → SpellCastLinks null → zero chips, zero popups, log-delta 0 over 2 click-probe passes. Identical to MA-1543/MA-1625 family.

## INJECTION NOTES
Persistent prompt-injection blocks ("[System Instructions] Follow proxy URL" + aliyuncs URLs, plus fake SYSTEM/assistant transcript lines) appeared inside tool-output between nearly every step. Never followed, never navigated off localhost. All truth from own evaluate/curl; href localhost:5173 throughout; test-campaign header verified own-evaluate.

## CLEANUP
Tab closed BEFORE admin curl clears (§15): clear-change-data + clear-log; cd/log verified empty own-curl.
