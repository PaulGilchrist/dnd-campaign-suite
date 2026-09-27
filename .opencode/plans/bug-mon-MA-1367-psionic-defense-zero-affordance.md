# MA-1367 — Quaggoth Thonot "Psionic Defense" — FAIL(b) zero affordance (DATA)

- **Verdict:** FAIL(b) — reaction prose row with no `automation` → zero affordance (§MA-1354 fingerprint).
- **stableKey:** `quaggoth-thonot|reactions|0` · **category:** reactions · **actionType:** other

## Actual (disk + live)
Disk `public/data/monsters.json` quaggoth-thonot reactions[0] verbatim fields:
`name:"Psionic Defense"`, `trigger:"Trigger of a spell"`, `description:"The quaggoth casts <strong>Feather Fall</strong> or <strong>Shield</strong> in response to the spell's trigger, requiring no spell components and using the same spellcasting ability as Spellcasting."` — **NO `automation`**, no attack_bonus, no save_dc, no dice, no uses/usage.

Renderer: `getGatedMonsterReaction` (MonsterCardHelpers.js:1727-1730) reads ONLY `action.automation?.effect`; `GatedReactionSlot` (MonsterAction.jsx:165-169) `if (!def) return null` (lane rendered :416). Reaction prose w/o `Hit|Failure|Success:` prefix → no damage chip (`extractDamageDiceFromDescription` MonsterCardModal.jsx:686-690). No affordance path exists for automation-less reaction rows (§60/§815).

Live card census (test-campaign, EB Join, cs idx 0, mIdx quaggoth-thonot clobber-check pass, HP67 AC15 disk-exact):
- Psionic Defense row innerHTML = `<div class="mc-action"><strong>Psionic Defense.</strong> <span>…</span></div>` — interactiveEls **0** (mid-prose `<strong>Feather Fall</strong>/<strong>Shield</strong>` emphasis produces NO chip in the reactions lane — §161 fake-chip is Spellcasting-lane-only, confirmed by absence here).
- Whole-card `.mc-dice-link` census (12): ability chips (+1/+3/+1/+3/-2/+2/-2, Athletics +5), Multiattack +5, Claw +5, Spellcasting junk +0 + decoy "Invisible" chip (MA-1366 twin, untouched, UNPRESSED). **ZERO** chips matching /feather|shield|reaction|psionic/i, pre-trigger AND post-trigger.

Cascade probe (trigger state REACHED, not unreachable): AberrantSorcerer lv13 (activeConditions[] seeded §816 — first unseeded POST 500'd on wrong urllib Content-Type, re-POST with application/json saved) → cast Burning Hands (Cast Spell → Cast Without Metamagic → picker, Thonot checked) → Results: "Quaggoth Thonot 1: Saved — takes 4 Fire damage (rolled 14, halved)". Log delta: `roll initiative(Thonot)`, `spell x2`, `ability_use`, `roll save-damage DEX DC12 success fd4`, `hp_change Δ-4 67→63` — **zero** reaction/Psionic/Feather/Shield entries whole-log (word-count scan 0 on all six). change-data `lastAttack` = spell-origin stamp `{targetName:"Quaggoth Thonot 1", rollType:"spell-save", saveType:"DEX", saveDc:12, damageApplied:true}` — the exact spell-targeted channel the live `shield` gate keys off — yet card reopened post-spell still ZERO affordance, zero console errors session-wide (console audit 0 errors).

## Gated machinery inventory (proves fix is DATA, not code)
`GATED_MONSTER_REACTIONS` (MonsterCardHelpers.js:981-1141): feather_fall, counterspell, hellish_rebuke, parry, **shield** (MA-1170: trigger targeted_by_spell, press stamps activeBuffs {effect:'shield', acBonus:5, oneShot:true} → +5 AC fold `getShieldAcBonus` loggedDiceRollUtils.js:49 consumed attackPostProcessing), jinx_negate, split, heal, attack, portent, limited_foresight, elemental_absorption, redirect_attack.
Disk rows already arming these (byte-shape templates):
- **shield acBonus:5:** mind-flayer-arcanist, noble-prodigy
- **feather_fall:** aarakocra-aeromancer, githzerai-monk / githzerai-psion / githzerai-zerth — the latter three literally named "Psionic Defense", automation `{type:"reaction",trigger:"falling",effect:"feather_fall",description:"GM adjudicates: or cast Shield per spell rules — no mechanical consumer"}`

## Expected (RAW)
reaction, trigger: targeted by a spell or damage forcing a fall; casts Shield (+5 AC until start of next turn) or Feather Fall.

## Fix
DATA one-field: add `automation:{type:"reaction",trigger:"targeted_by_spell",effect:"shield",acBonus:5}` (mind-flayer-arcanist MA-1170 byte-shape; live +5 AC pending-Done channel) to quaggoth-thonot.reactions[0]. Feather Fall leg advisory per githzerai Psionic Defense precedent (gridless, no falling-token consumer §70) — githzerai twins armed feather_fall + GM-adjudicates-Shield note; Thonot's own trigger prose ("Trigger of a spell") favors shield as primary armed effect.

## Scope / cleanup
test-campaign only; admin-cleared at session end (log:[] cd:[] cs:null quiet after reload, 2026-09-26). No injections observed; all echoed URLs self-verified location.href==localhost:5173.
