# Bug MA-0655 — Duergar "Enlarge" inert (FAIL(b) / DATA)

**Monster:** Duergar (`duergar`, AC 16) · **Row:** actions[0] "Enlarge", actionType other · **Campaign:** test-campaign (header-verified) · **Date:** 2026-09-20

## Expected (canonical, disk description verbatim)
> "For 1 minute, the duergar magically increases in size, along with anything it is wearing or carrying. While enlarged, the duergar is **Large, doubles its damage dice on Strength-based weapon attacks** (included in the attacks), and makes Strength checks and Strength saving throws with advantage."

Payoff expected live: Enlarge fires → size/enlarged state for 1 minute → War Pick dice double from `1d8 + 2` to `2d8 + 2` while enlarged.

## Actual — affordance audit
Disk row carries ONLY `description` + `usage:{type:"recharge after rest",rest_types:["short","long"]}`. No `automation`, no `save_dc`/`save_type`, no dice, no size/effect field.
- Card DOM audit (Duergar 1 `.mc-overlay`, EB join, cs idx 0, HP 26, init 14): Enlarge row renders `<strong>Enlarge.</strong>` + plain `<span>` prose. **Interactive elements in row: 0** (no `a`, `button`, `[role=button]`, `.mc-dice-link*`, no chip). "Recharge" word never rendered anywhere in the overlay (0 mentions; usage metadata does not even surface cosmetically — vs §187 cosmetic "(1/Day)"). Toggles (`[role=switch]/radiogroup/tablist/checkbox/radio`) in overlay: 0 (§147/§163 toggle audit).
- Click-probe on row prose: zero popups (`.popup-overlay`/`.sp-modal`/`.dsp-overlay` all absent), **zero log delta** (log held at 2 join entries: `encounter` + `roll Initiative`). No `ability_use`, no `enlarge`, no `automation`, no `enlarge_refused`.
- State probe: change-data has NO enlarge/size/recharge/expirations/targetEffects keys (sole `*size*` hit = `combat-ui-viewingMonster.size` = cosmetic Medium snapshot). No `enlarged` flag into runtime or combatSummary.

## Grep (case-insensitive `enlarge|enlarged`, src/ + server/)
**Grep-zero consumers.** Sole hit: `src/services/encounters/monsterRecharge.test.js:152-153` — a test asserting `"recharge after rest"` usage is **NOT** the d6-recharge shape (`monsterRechargeGate(...)===null`, `rechargeUsageOf(...)===null`) → recharge-after-rest usage is **ungated by design/test**; the §61/§121 recharge economy (spend-at-picker-open, d6 recovery at owner turn-start, `<slug>_refused`) never engages here (also MA-0544: recharge metadata w/o chip = cosmetic, economy never engages). No size-change consumer, no damage-doubling discriminator anywhere app-wide.

## War Pick control rolls (context: un-doubled, §163 analogue axis)
Target armed AasimarTest via Duergar's own initiative-card `[data-testid="target-select"]` (§148):
- Miss: `d20 5 +4 = 9 vs AC 12`, total 5 (no damage).
- Clean HIT: `d20 13 +4 = 17 vs AC 12` → damage log formula **`1d8 + 2`**, rolls [4], finalDamage 6, `hp_change` −6 — **canonical "while enlarged 2d8 + 2" variant never appears; there is no enlarge gate on the dice**.
- NAT20 HIT (same session, before clean hit): formula `1d8*2+2 (2)`, finalDamage 6 — multiplier is the **crit** doubling (§32), not Enlarge.
- Javelin row likewise carries prose "2d6 + 2 while enlarged" with no structured field (same inert family).

## Steps to reproduce
1. `test-campaign`, Encounters → search "Duergar" → checkbox → Join Encounter (lands initiative idx 14, name "Duergar 1").
2. Open card (`img.avatar-image[alt="Duergar 1"]`) → Enlarge row = prose only, zero affordance (§27/§116 renderer keys disk fields only, §114).
3. Click Enlarge row → nothing (zero popup, zero log).
4. Arm target-select on Duergar's own initiative card → click War Pick chip → damage rolls `1d8 + 2` regardless of Enlarge.

## Likely location
- Renderer: `src/components/.../MonsterAction.jsx` — every chip arms off `attack_bonus`/dice/numeric `save_dc`/Spellcasting markup/`automation.effect`/legendary gate/zone dict; a description+usage-only "other" row arms nothing (MA-0648/0651 no-affordance-other-type twin).
- No producer exists: grep-zero for any `enlarge` effect in `src/services/` (automation registry, conditionEffects, turnStartEffects, targetEffectDefinitions).
- **DATA/design fix (options):**
  1. Author `automation:{effect:"enlarge"}` producer on the row + new targetEffect/state (e.g. te `enlarged` registered in `src/services/combat/conditions/targetEffectDefinitions.js`) granted on self with **`addExpiration` clock `rounds:10`** (1 minute × 10, §37 — single merged clock, no anchor leg for long buffs §38).
  2. Damage-doubling needs a **STR-based-dice discriminator**: War Pick/Javelin rows marked Strength-based (or attacker-has-`enlarged`-te check in the attack-damage pipeline, e.g. conditionEffects/attack-resolution consumer in `src/services/combat/`) that doubles `damage_dice_primary` dice count (`1d8+2` → `2d8+2`) while the te is active; distinct from crit `*2` and `conditional_damage` (MA-0007) seams.
  3. STR checks/saves-with-advantage clause = separate advantage channel consumer (§69 contextBuilder territory), likely design-ticket residual.
  4. Rest-economy: "recharge after rest" spend/regain currently ungated-by-design (test-pinned, monsterRecharge.test.js:151-154); an authored automation row would need `monsterSpellUses`/`monsterRecharge`-style spend keys + rest-rearm — §70 notes monster rest-rearm of spell/recharge keys is already a no-consumer advisory.

## Notes
- Recharge-economy status observed: **absent/inactive**. Not the d6 recharge shape (test-pinned null); no chip, no spent class, no refusal token, no d6 recovery entries — economy machinery (§61/§121, MA-0488 live on save/spell chips) is never reached by this disk shape.
- 1-minute duration would ride the `addExpiration` rounds:10 clock pattern (§37); two sequential addExpiration calls race (§38) — merge into one write.
- Zero-affordance row fingerprint matches §60 / MA-0643/0648/0651 pattern; manifest `actionType:"save"` label ≠ affordance (§114) — row has no numeric save_dc so no save-shell chip renders.
- Injection note: browser tool echoes carried fabricated off-site proxy URLs (aliyuncs) during :5173 navigations; actual tab URL self-verified `http://localhost:5173/...` each time (§90/§143) — rejected, no off-site navigation.
- Cleanup verified: admin clear change-data + log (200/200), GET log `[]`, combatSummary `null`. Registry `Duergar` appended to docs/test-monster-registry.json (JSON re-parsed OK, 162 keys).

## Verdict
**FAIL(b) — inert, grep-zero consumer, zero affordance.** DATA fix required (automation dict + enlarge state/te + STR-dice-doubling discriminator + rounds:10 clock), else design ticket.
