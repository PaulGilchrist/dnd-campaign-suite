# MA-1510 — Sphinx of Wonder · Burst of Ingenuity (reactions[0]) — FAIL(b)/DATA

**Verdict:** FAIL(b)/DATA — inert plain-text reaction row, grep-zero consumers, `uses:"2/Day"` string unparsed. (MA-1463 zero-affordance + MA-1502 N/Day-string fingerprints; §60 gated-reaction lane keys ONLY off `automation.effect`.)

## Row (verbatim)
`{"id":"MA-1510","stableKey":"sphinx-of-wonder|reactions|0","monsterIndex":"sphinx-of-wonder","monster":"Sphinx of Wonder","actionIndex":0,"actionType":"other","uses":"2/Day","trigger":"The sphinx or another creature within 30 feet makes an ability check or a saving throw.","description":"The sphinx adds 2 to the roll.","verified":"not verified"}`

## Disk field dump (public/data/monsters.json · reactions[0])
```json
{ "name": "Burst of Ingenuity",
  "trigger": "The sphinx or another creature within 30 feet makes an ability check or a saving throw.",
  "description": "The sphinx adds 2 to the roll.",
  "uses": "2/Day" }
```
- NO `automation` ({type,trigger,effect} absent → §60 gated lane NOT armed).
- NO `advisory` field → MA-1285 Option-A advisory lane (MonsterAction.jsx:339 `mc-dice-link-advisory`) NOT armed.
- NO numeric `acBonus`/`saveBonus`/te/dice fields. `uses` is a raw `"2/Day"` STRING on a non-spell row → parsed by NO usage parser (MA-1502/MA-0681, playbook §"uses N/Day string") → zero counter, zero gate.

## Grep census
- `grep -rni "ingenuity" src/ server/` (excl. monsters.json) → **exit=1, ZERO hits**.
- `burst_of` → zero consumers (only PC ElementalAttunement prose "burst of").
- +2 ride channels checked: `saveBonus` (warding_bond §76 activeBuffs producer — not authored here), attacker-side dice/`vexTarget` (§69 — not applicable to buff-the-roller), gated-reaction `automation.effect` (§60; MA-0725/MA-1203 precedents) — all require authored fields; none present.

## Live evidence (2026-09-28, test-campaign, header verified)
- Card open on live initiative (Sphinx of Wonder 1 + Bandit 1 @917 HP, registry-preserved).
- Row DOM: `<div class="mc-action"><strong>Burst of Ingenuity.</strong> <span>The sphinx adds 2 to the roll.</span></div>` — chips [], `clickableCount: 0`; trigger text not even rendered.
- Press ×2 (row `.click()`, `strong.click()`, section `.click()`): zero popups (`popup-overlay/.sp-modal/.sp-overlay/.dsp-overlay` all absent), log 22→22, zero `ingenuity`/`ability_use` entries.
- 2/Day counter: never renders (string unparseable). No `monsterReactionUses`/ingenuity key in change-data — sole scan hit is the `combat-ui-viewingMonster` card snapshot echo of the row name (read-only mirror, not a state key).
- +2 auto-apply probe: no consumer exists at the save/check seams → structurally cannot ride PC saves; no auto-application observed.

## Fix direction (data-only, precedent-matched)
Option A (MA-1285/MA-1446 honest sentinel): add `"advisory":"burst_of_ingenuity"` (+ optional advisory_message noting +2 GM-enforced, 2/Day) → record-only AdvisoryLink chip. Option B (engine): new gated buff-the-roller channel (automation {type:reaction, trigger:ability_check_or_save, effect:burst_of_ingenuity, bonus:2, range_ft:30}) + te/activeBuffs producer + saveBonus fold at the relevant seams + numeric `usage`/`uses:2`/`maxUses:2` economy — larger lift, no existing producer for third-party check buffs.

## CLEANUP
Admin clear change-data + log at session end (initiative block left placed; MA-1511 is next in queue.txt — re-join for next row).
