# BUG MA-0813 — Giant Octopus / Ink Cloud: zero-affordance, zero-consumer reaction row (FAIL(b)/DATA)

## Fingerprint
MA-0780 twin (§251, itself §200/MA-0674 byte-twin) + MA-0757/MA-0759 uses-string twin (§240/§241). Zero-affordance `other`-type family: MA-0757/MA-0759/MA-0780 FAIL(b)/DATA.

## Row (reactions[0], disk monsters.json, byte-quoted)
```json
{
  "name": "Ink Cloud",
  "trigger": "The octopus takes damage while underwater.",
  "description": "The octopus releases ink that fills a 10-foot <strong>Cube</strong> centered on itself, and the octopus moves up to its Swim Speed. The Cube is <strong>Heavily Obscured</strong> for 1 minute or until a strong current or similar effect disperses the ink.",
  "uses": "1/Day"
}
```
No `automation`, no `zone`, no `te`/effect_key, no area fields, no dice, no save. `uses` is a STRING (disk-cosmetic, §240).

## Live evidence (test-campaign, 2026-09-22)
- Header verified `test-campaign`; baseline log count 0, cd {}.
- EB Join Encounter (NOT Save, §225): cs idx0 "Giant Octopus 1" (giant-octopus, hp45/45, AC11, init 17), idx1 "Bandit 1" (Medium, AC12, hp11). Baseline log after join = 3 (encounter joined + 2 initiative rolls).
- Chip probe (modal open via avatar): Ink Cloud row DOM = `<strong>Ink Cloud.</strong> <span>…description…</span>` ONLY. buttons:[], diceLinks/role=button:[], usageEm:[] (the "1/Day" string NEVER renders — `formatActionUsage(action.usage)` at MonsterAction.jsx:248 reads `usage`, disk has `uses` → null; §240/MA-0757 live twin), rechargeNote:[], gatedSlot:false (`GATED_MONSTER_REACTIONS` allow-list keyed solely by `automation.effect`, MonsterCardHelpers.js:800/:1370-1372 → null).
- Row + name click ×2: log delta **0** (still 3), zero popup, console errors 0. §194/§251 zero-delta fingerprint confirmed.
- No damage rolled, none fabricated — trigger "takes damage while underwater" has no lastAttack/damage-event gate without `automation.effect`; absence of trigger-UI is advisory per same-family precedent (§200/§251 codified).

## Grep layer (all zero-consumer)
- Heavily-obscured: NO illumination/vision model (§70, monsterSelfAura.js:19 "darkness does not obscure … GM-enforced"); obscurement appears only in PC-cast-side spell handlers (stinkingCloudHandler, sleetStormHandler, webAreaSaveHandler) and zone-te descriptions (`stinking_cloud` :967, `lair_darkness` :1025). No generic heavily-obscured te; NO ink te anywhere.
- Ink: grep-zero consumer src/+server/ (non-test) — only Illusory Script material component + Kraken Toxic Ink test fixture (damage dice, unrelated).
- Uses counter: gates read numeric `uses`/`maxUses` via monsterSpellUses/monsterAbilitySaveUsesGate (:1376/:1395) — reached ONLY by spell/save/aura/summon/self-buff chip paths, none of which arm for this row; `formatActionUsage` reads `usage` only. Disk `uses:"1/Day"` = ungated cosmetic nothing (§169 NaN twin, §187, §240).
- "Ink Cloud" grep-zero in spells.json.
- MA-0808 discriminator (§259): row has NO rollable damage_dice_primary → ActionDamageLinks inert (unlike Giant Frog Swallow PASS-subset — that row had dice; this one renders nothing).

## Fix template (MA-0648 family, §219 + MA-0554 zone seam)
Closest sanctioned producer for a self-centered zone = MA-0554 self-aura byte-shape (`isSelfAuraRow` → `zone:{effect_key,radius_ft}` chip via ZoneAuraLink, MonsterAction.jsx:180-194, lair_darkness precedent):
1. Register a zone te (e.g. `ink_cloud`, "Heavily Obscured", Defensive/Zone group, alphabetical insert — healingBlock.test.js localeCompare pin).
2. Author `zone:{effect_key:"ink_cloud", radius_ft:5}` (Cube NOT parsed §62/§159 → largest supported radius + honest shape advisory) + numeric `uses:1` + `maxUses:1` so the chip rides the MA-0020 counter with rest-rearm (§70 residual).
3. §70 advisory residuals (codified, GM-enforced): "moves up to its Swim Speed" = movement/"moves up to" advisory (no movement-cost consumer); "1 minute or until dispersed" duration clock; underwater trigger precondition; underwater-only.

## Verdict
**FAIL(b)/DATA** — zero affordance rendered (no chip/button/counter), zero consumer anywhere; row authors nothing executable. Twins: MA-0780 (§251), MA-0757/MA-0759 (§240/§241). Fix rides MA-0648/MA-0554 template + te registration.
