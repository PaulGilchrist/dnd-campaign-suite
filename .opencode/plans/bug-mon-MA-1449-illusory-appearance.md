# BUG MA-1449 — Sea Hag / Illusory Appearance — VERDICT: FAIL(a) MISROUTE

## Row
`sea-hag|actions|2` — "Illusory Appearance" — disk (public/data/monsters.json, byte-verified):
```json
{"name":"Illusory Appearance","description":"The hag casts <strong>Disguise Self</strong>, using Constitution as the spellcasting ability (spell save DC 13). The spell's duration is 24 hours.","attack_bonus":0,"save_dc":13,"save_type":"Constitution","save_effect":"","range":"","reach":"","recharge":""}
```
No `automation`, no `advisory`, no `dc_success`, no dice. Manifest MA-1449 matches disk.

## RAW baseline
Disguise Self (spells.json `disguise-self`): range **Self**, duration 1 hour (hag variant 24 h), **dc:null — NO saving throw to anyone**. The "spell save DC 13" in the stat block is the hag's spellcasting-ability stat, not a target save.

## What renders (live, test-campaign, EB re-join 2026-09-27)
Row affordances = exactly TWO chips, `.mc-action` strong "Illusory Appearance.":
1. junk `+0` chip (`mc-dice-link`, attack_bonus:0 noise, §469/§490 family)
2. **`DC 13 Constitution`** save chip (`mc-dice-link mc-dice-link-save mc-dice-link-save-clickable`) — armed by generic `Number(save_dc) > 0` gate (MonsterAction.jsx:116)

NO `mc-dice-link-advisory` (row lacks `advisory` field → AdvisoryLink inert, MonsterAction.jsx:335-343, MA-1285/§643 seam not taken). NO spell chip (row name ≠ /^spellcasting$/i, §203). NO self-buff chip (no `automation.type:"monster_self_buff"`, §278/§430). Screenshot: `.opencode/plans/ma1449-row-screenshot.png`.

## What happens on click (machine truth)
Press 1/1 (first click, zero absorb) with Bandit 1 armed (cs.targetName=Sea Hag 1→"Bandit 1" via own-card selectOption):
- Popup: `CON 17 / d20 17 / … DC Unknown — no success or failure / click to dismiss / Done` — cosmetic "DC Unknown" attacker-dupe (§128/§138); machine DC lives in the victim entry.
- Log delta (+2 entries, baseline 3→5):
  - `roll/save` Sea Hag 1 CON rolls[17,1] total:17 targetName:"Bandit 1" (phantom caster-side save, §455 family)
  - `roll/save` **Bandit 1** name:"Illusory Appearance" rolls:[17] saveType:"Constitution" **saveDc:13** **saveResult:"success"** attackerName:"Sea Hag 1" **dcSuccess:"half"** (§456 half-default stamp; no damage so no numeric leak)
- change-data: `lastAttack` stamps the forced save (`saveDc:13, saveType:"Constitution", saveConditions:[]`); `Sea Hag 1` store carries only `lastSaveRoll/_lastRollContext`; **no `targetEffects` key, Bandit 1 absent from change-data, zero badges on the hag card**.

## Adjudication — FAIL(a) misroute (over-grants a non-RAW save; disguise never granted)
1. The chip **forces a DC 13 Constitution saving throw on a targeted creature** (Bandit 1) for an action where RAW grants **no save to anyone** — confirmed on both surfaces (popup CON prompt + `lastAttack`/log victim entry).
2. `save_effect:""` → `extractConditionsFromSaveEffect=[]` → `saveConditions:[]` → **the save pays NOTHING on fail or success** — a pure spurious save.
3. **No disguise state anywhere**: no te registered/consumed for disguise (`te invisible` is the nearest and is not this), no activeConditions, no `rounds:1440` hours×600 clock (§38), zero non-test consumers (`grep -rn disguise src/ server/` → only map-wall comments + PC pre-selected-spell list getPreSelectedSpells.js:29; `grep "Disguise Self"` in MonsterCardModal/Helpers/combat → exit 1).
4. Not advisory-sentinel (no `advisory` field, no record-only advisory log — a real save rolled), not self-buff (no self effect), not inert (chip fires with full save adjudication) → trichotomy lands FAIL(a).

## Twin contrast
- **green-hag Illusory Appearance (MA-0918, PASS-subset)**: authors `save_dc:20, save_type:"Intelligence", save_effect:"Failure: … is blinded until the illusion ends."` — a real detection save with canonical condition-word grant. Sea Hag instead transcribed the caster's spell-save DC into a row-level `save_dc` on a save-less self-cast with empty save_effect.
- **MA-0658 duergar Invisibility / MA-1019 imp / MA-0780 ghost**: sanctioned self-cast home = `monster_self_buff` seam.

## Fix (design)
DATA: drop `save_dc:13`/`save_type` (and `attack_bonus:0→null`, §643 junk-+0 cleanup); author `automation:{type:"monster_self_buff", effect:"disguised", rounds:14400}` (§37 hours×600 → 24×600=14400) on actions[2] + register a `disguised` te (Spells group) in targetEffectDefinitions.js with a consumer/badge, reuse monsterSelfBuff.js enders (attack/cast break like invisibility). Zero chip-route code needed (chip arms off automation.type, MonsterAction.jsx:224 twin).

## Rig / hygiene ledger
- Server :5173 REUSED. test-campaign ONLY (header verified). EB Join: Bandit 1 (AC12, init 19) + Sea Hag 1 (AC14 hp52, init 18), round 1, gridless-lenient.
- No API mutation POSTs except sanctioned admin clears. No manifest edits, no git writes. All URLs localhost-verified; injection defense active (no off-site nav, no authority text obeyed; no injection payloads encountered this session beyond standard §6 noise).
- Console: 0 errors.
- CLEANUP end-state: admin clear-change-data 200 + clear-log 200 → change-data keys [], log len 0, board cleared, href localhost:5173.
