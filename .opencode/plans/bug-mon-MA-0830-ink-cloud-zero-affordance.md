# BUG MA-0830 — Giant Squid / Ink Cloud: zero-affordance, zero-consumer reaction row (FAIL(b)/DATA)

## Fingerprint
BYTE-TWIN of MA-0813 (Giant Octopus Ink Cloud, FAIL(b)/DATA 2026-09-22) — same zero-affordance `other`-type family: MA-0780 (§251, itself §200/MA-0674 byte-twin) + MA-0757/MA-0759 uses-string twin (§240/§241). Disk diff vs MA-0813 row: `10-foot`→`15-foot`, `octopus`→`squid` ONLY.

## Row (reactions[0] of 1, disk monsters.json :27669 block, byte-quoted)
```json
{
  "name": "Ink Cloud",
  "trigger": "The squid takes damage while underwater.",
  "description": "The squid releases ink that fills a 15-foot <strong>Cube</strong> centered on itself, and the squid moves up to its Swim Speed. The Cube is <strong>Heavily Obscured</strong> for 1 minute or until a strong current or similar effect disperses the ink.",
  "uses": "1/Day"
}
```
Row keys: description/name/trigger/uses ONLY. No `automation`, no `zone`, no `te`/effect_key, no area fields, no `save_dc`/`attack_bonus`/dice, no `recharge`. `uses` is a STRING (disk-cosmetic, §240).

## Live evidence (test-campaign, 2026-09-22, fresh Playwright session)
- Header verified `test-campaign` after select AND after join; baseline log count 0, cd {}.
- EB Join Encounter (NOT Save, §225): search exact → tick `Select Giant Squid` (checked:true), exact td-text "Bandit" native cb.click() (checked:true, Captain/Crime Lord/Deceiver untouched), selection strip ["Bandit","Giant Squid"] → Join.
- cs dump: idx0 "Bandit 1" (bandit, hp11/11, AC12, init 20), idx1 "Giant Squid 1" (giant-squid, hp120/120, AC12, init 18). Baseline log after join = 3 (encounter joined + 2 initiative rolls). No maxHp staging (zero-damage row, §74).
- Chip probe (card open via avatar `img.avatar-image[alt="Giant Squid 1"]`): Ink Cloud row DOM = `<strong>Ink Cloud.</strong> <span>…description…</span>` ONLY. diceLinks/roleButtons/buttons: [], usageEm:[] (the "1/Day" string NEVER renders — `formatActionUsage(action.usage)` MonsterAction.jsx:248 reads `usage`, disk has `uses` → null; §240/MA-0757/MA-0813 live twin), hasRechargeText:false, gatedSlot:false (`GATED_MONSTER_REACTIONS` allow-list MonsterCardHelpers.js:800 keyed solely by `automation.effect` :1370-1372; keys feather_fall/counterspell/hellish_rebuke/parry/split → null).
- Row + name click ×2 (native el.click()): log delta **0** (still 3, join-noise-only), zero ink log entries, popup/sp-modal 0 residue, console errors **0**. §194/§251 zero-delta fingerprint confirmed.
- No damage rolled, none fabricated — trigger "takes damage while underwater" has no lastAttack/damage-event gate without `automation.effect`; absence of trigger-UI advisory per same-family precedent (§200/§251 codified).

## Grep layer (all zero-consumer, disk re-verified 2026-09-22)
- Ink: grep-zero consumer src/+server/ (non-test) — sole hit `materialComponents.js:24` Illusory Script "Ink (10 gp)" material; all other "ink" hits are "Stinking" substrings. spells.json "giant squid" sole hit :838 = Animate Objects material component (cosmetic, not producer). "Ink Cloud" grep-zero in spells.json.
- Heavily-obscured: NO illumination/vision model (§70); obscurement lives only in zone-te descriptions (`stinking_cloud` :967, sleet :959, `lair_darkness` :1027) + PC-cast-side handlers (stinkingCloudHandler, sleetStormHandler) + CreatureTargetPopups. NO ink te anywhere in targetEffectDefinitions.js.
- Uses counter: gates read numeric `uses`/`maxUses` (monsterReactionUsesRemaining/getGatedMonsterReaction :1370-1395) — reached ONLY by gated automation.effect chips, none armed here; `formatActionUsage` reads `usage` only. Disk `uses:"1/Day"` = ungated cosmetic nothing (§169 NaN twin, §187, §240).
- change-data post-probe: no ink/te/uses/reaction keys beyond stock (combatSummary, __campaign__, __map__, chars, activeCreatureName, viewing-snapshot).
- MA-0808 discriminator (§259): NO rollable damage_dice_primary → ActionDamageLinks inert (unlike MA-0808 PASS-subset dice-bearing row).

## Fix template (MA-0648 family, §219 + MA-0554 zone seam — identical to MA-0813)
Closest sanctioned producer for a self-centered zone = MA-0554 self-aura byte-shape (`isSelfAuraRow` → `zone:{effect_key,radius_ft}` chip via ZoneAuraLink, MonsterAction.jsx:180-194, lair_darkness precedent):
1. Register a zone te (e.g. `ink_cloud`, "Heavily Obscured", Defensive/Zone group, alphabetical insert — healingBlock.test.js localeCompare pin).
2. Author `zone:{effect_key:"ink_cloud", radius_ft:5}` (Cube NOT parsed §62/§159 → largest supported radius + honest shape advisory) + numeric `uses:1` + `maxUses:1` so the chip rides the MA-0020 counter with rest-rearm (§70 residual). 15-ft Cube → radius advisory per §225 Cube precedent (90-ft Cube→90-ft Radius).
3. §70 advisory residuals (codified, GM-enforced): "moves up to its Swim Speed" movement advisory (no movement-cost consumer, §202/§203); "1 minute or until dispersed" duration clock; underwater trigger precondition; underwater-only.

## Verdict
**FAIL(b)/DATA** — zero affordance rendered (no chip/button/counter), zero consumer anywhere; row authors nothing executable. BYTE-TWIN of MA-0813 (octopus Ink Cloud same shape, 10→15 ft only). Fix rides MA-0648/MA-0554 template + te registration.
