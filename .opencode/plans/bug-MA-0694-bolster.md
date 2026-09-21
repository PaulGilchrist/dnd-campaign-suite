# Bug MA-0694 — Empyrean `Bolster` legendary action: zero affordance (header-swallow) + unmodeled effect transport

**Verdict: FAIL(b)/DATA** — confirmed live 2026-09-20.

## Monster / row
`empyrean` · `legendary_actions[0]` · "Bolster" · type `other`

Canonical disk (public/data/monsters.json, re-read fresh this session):
- rows[0] `{name:"Bolster", uses:1, description:"The empyrean gains 10 Temporary Hit Points, and the empyrean and each ally within 30 feet of it gain Advantage on D20 Tests until the end of the empyrean's next turn. The empyrean can't take this action again until the start of its next turn."}`
- rows[1] Shockwave of Glory (`save_dc:23`, `save_type:"Constitution"`, `range:"30-foot Emanation"`, `damage_dice_primary:"6d8"` Force) — rides own chip (§110 twin live).
- rows[2] Smite (`uses:1`, prose "makes one Divine Ray attack") — renders "Expend Legendary" `.mc-dice-link-legendary` child chip.

## Fingerprints (both axes)

### Axis 1 — §99/§199 legendary header-swallow (affordance)
`monsterLegendaryUses.js:156` `legendaryHeaderAction` takes rows[0] whenever `uses!=null`. Bolster (uses:1) is consumed as the header:
- `MonsterCardBody.jsx:38` consumes it; `:55` `actions.slice(1)` drops Bolster from clickable children.
- `MonsterLegendaryHeaderRow` (`MonsterCardBody.jsx:241-250`) renders `<div class="mc-action mc-legendary-header-row">` — name + "(1 left)" counter + description, **no onClick**, zero links.
- LIVE: `.mc-legendary-header-row` text = "Bolster (1 left) The empyrean gains 10 Temporary Hit Points…" hasClick:false. Click-probe ×2 (fresh rects): **ZERO popup, ZERO log delta** (log stayed join-noise 2 entries), counter frozen "(1 left)".
- 0 console errors — silent-burn unreachable (Bolster removed before LegendarySpendLink), matching MA-0675 exactly.
- rows[1] Shockwave rides the shared gate live (twin ledger evidence): picker-open honest spend `ability_use` "expends a legendary use for Shockwave of Glory after AasimarTest's turn — 0 of 1 left", counter 1→0; refire → "Legendary Action Refused — no legendary uses left" popup, zero roll. (Picker backdrop does NOT close — use Skip.)

### Axis 2 — §70-class design gap (effect transport), even if reachable
- **10 THP self-grant**: monster THP producers exist only on the save-row picker seam (MA-0275/§80 `animalSpiritFortifyHp` → tempHpService replace-if-larger) and PC-side services (darkOnesBlessing, heroism, powerWordFortify). No route on a prose legendary "other" row.
- **Area Advantage on D20 Tests for allies within 30 ft**: `d20_test_advantage` / `d20TestAdvantage` grep-ZERO app-wide. Allies-advantage machinery is PC-cast-side aura-only (Holy Aura, Circle of Power, Improved Duplicity, Combat Stance). No monster-side area-buff transport, no gridless ally-membership consumer.

## Expected (RAW)
Bolster clickable legendary child → spends 1 use, grants self 10 THP, stamps advantage-on-D20-Tests on self + allies within 30 ft until end of empyrean's next turn, logs spend + grants; refuses exhausted / once-per-turn.

## Fix
1. **DATA (§165/§199 byte-template, Colossus/Death Knight/Dracolich MA-0620):** insert canonical header row `{"name":"Legendary Action Uses: 1","uses":1,...}` at rows[0]; Bolster and Smite become children with `delegates_to` (Smite→"Divine Ray" resolves across actions, monsterLegendaryUses.js:3-9); drop per-child `uses`. Shockwave keeps numeric fields riding shared gate.
2. **Bolster transport (NEW design, name both axes):** self THP rides tempHpService (MA-0275 seam extends); ally area advantage needs a new te (`d20_test_advantage`-class) + registered consumer in attack/save/ability-check context builders + §42 gridless advisory distance — §70-class rebuild, NOT a one-field fix. Axis-1 fix alone leaves Bolster inert-but-honest (FAIL(b)→advisory at best).

## Evidence trail
- cs: `Empyrean 1` 346/346 joined, round 1; post-session admin clears verified: log `[]`, change-data zero legendary/empyrean keys.
- Console errors: 0.
- Checkpoint: `.opencode/plans/checkpoint-MA-0694-bolster.md`.
- No manifest/git edits.
