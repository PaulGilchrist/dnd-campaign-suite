# MA-1232 — Nightmare "Ethereal Stride" — FAIL(b) / DATA (advisory-field one-fix, MA-1223 byte-shape)

**Date:** 2026-09-25 · **Campaign:** test-campaign (header-verified) · **Rig:** EB join Nightmare 1 (cs idx0, monsterIndex "nightmare", HP68 AC13) + Bandit 1 (AC12, clean victim). Card via `img.avatar-image[alt="Nightmare 1"]`. Manifest actionType label "attack+save" ≠ affordance (§117) — disk row is a pure plane-shift utility.

## Verdict: FAIL(b) — inert plane-shift row, NO `advisory` field authored; sole rendered affordance is the §490 junk "+0" chip that adjudicates a bogus to-hit (pollution, not affordance)

## Disk row (public/data/monsters.json, Nightmare actions[1], line ~44234 block)
```json
{
  "name": "Ethereal Stride",
  "description": "The nightmare and up to three willing creatures within 5 feet of it teleport to the <strong>Ethereal Plane</strong> from the <strong>Material Plane</strong> or vice versa.",
  "attack_bonus": 0, "save_dc": 0, "save_type": "", "save_effect": "",
  "range": "", "reach": "", "recharge": ""
}
```
- NO `advisory`/`advisory_message`, NO `automation` dict, NO dice, NO zone. `attack_bonus:0` + `save_dc:0` = household empty-noise authoring.
- RAW: pure self+passengers plane-shift — app-unmodellable state (§70 advisory-unbuilt family: plane-shift/teleport position/state has zero consumers), so the adjudication axis is AFFORDANCE only: an advisory press should at least record the action (§643 monsterActionAdvisory seam, built for exactly this row-shape).

## Code evidence (grep)
- `src/components/encounter/MonsterAction.jsx` chip arm inventory (all-zero + no-automation + no-advisory row):
  - Attack chip :383/:408–411 — `action.attack_bonus != null` admits **0** → junk clickable `+0` (§490 root fingerprint; MA-0551/MA-1071 `>0` convention never mirrored to the attack leg).
  - ActionDamageLinks :51 — bails on `attack_bonus != null` → no damage chips.
  - ActionSaveRoll :116 + SpellOrSaveLinks :367 — `Number(save_dc) > 0` gate → DC0 decoy renders nothing (MA-1071).
  - SpellCastLinks :83 — row name not `/^spellcasting$/i` (:390) and description emphasis `Ethereal Plane`/`Material Plane` never reaches this fork → §161 emphasis-only arms nothing here (confirmed: zero `<a>`, zero mc-dice-link on strong text).
  - SummonLink :232 / SelfBuffLink :256 / GrantReactionLink :278 / ShapeShiftLink :297 / ZoneAuraLink :208 / ZonePickerLink :316 / GatedReactionSlot :166 — all require `automation.type`/`zone` dict/registered gated effect → null.
  - LegendarySpendLink :188–193 — no legendaryGate on Nightmare; would ALSO self-suppress via `numericAffordance` (`attack_bonus != null` :192).
  - **AdvisoryLink :335–343 (rendered :406)** — arms iff `isMonsterActionAdvisoryRow(action)` = `!!row?.advisory` (`src/services/encounters/monsterActionAdvisory.js:17-19`) AND no legendaryGate. This row carries no `advisory` field → **zero chips**.
- Advisory seam wiring proven live-ready: AdvisoryLink onClick → `onAdvisoryRow` → `MonsterCardBody.jsx:225` → `MonsterCardModal.jsx:2385 handleAdvisoryRow={(action) => resolveMonsterActionAdvisoryRow(...)}` → record-only popup + `ability_use` advisory log, ZERO rolls/lastAttack/te writes (`monsterActionAdvisory.js:39-44`). **If** `advisory:"monster_teleport"` were authored, this row WOULD arm the canonical advisory chip.
- No prose auto-arm: grep `teleport` in `MonsterAction.jsx`/`MonsterCardModal.jsx`/`MonsterCardHelpers.js` = comments only (:326/:2382/:1318); no parser arms any affordance from teleport prose (grep-proved; expectation confirmed).
- No ethereal-stride machinery: grep `ethereal_stride|Ethereal Stride` consumers app-wide = **zero**. Ethereal-adjacent code is unrelated: te `ethereal` registered `targetEffectDefinitions.js:748` with producer ONLY `monster_self_buff` automation (`monsterSelfBuff.js:66/102`, ghost Ethereality MA-0780); `lair_dream_plane`/`dreamPlaneBanishment` (`saveProcessing.js:452/1005`, `MonsterCardHelpers.js:1468 parseDreamPlaneBanishClause`, `ConditionEffectBadges.jsx:439`) is the dragon-lair dream-plane save banishment seam — structured `save_effect`-keyed, never reachable from this save-less row.

## Live evidence (Playwright, localhost:5173, header test-campaign)
1. **Chip census (row-scoped):** Ethereal Stride `.mc-action` inner `[class*=mc-dice-link]` = **exactly one**: `{"cls":"mc-dice-link","text":"+0","role":"button","hasClick":true}`. Zero advisory/save/zone/summon/spell chips; zero `<a>`; zero `input/select/button`; whole-overlay `[role=switch]/[role=radiogroup]/[role=tablist]` audit = **0** (§190 proof-of-no-toggle). Emphasis renders plain — no fake chips (§161).
2. **Junk "+0" press ×1 (per ticket instruction):** FIRED bogus adjudication — log `roll/attack name:"Ethereal Stride" total:9` (d20 9 "+0"), popup "Ethereal Stride / 9 / d20 9 / Done". ZERO damage, `lastAttack` stayed **null**, no `ability_use`, no condition/te writes. Confirms §490: junk chip adjudicates a fabricated to-hit for a plane-shift action — pollution evidence, NOT an affordance that log-resolves.
3. **Control probe:** center-click row description text → log delta 0, popups 0, card stays open.
4. **Console:** 0 errors.

## Fix (DATA, one-field-fix family — nalfeshnee MA-1223 byte-shape, disk monsters.json:43911)
Add advisory fields + null the junk attack_bonus (MA-1223 comment: "formerly junk attack_bonus:0 → '+0' chip rolling bogus to-hit"; §643 root fix "attack_bonus:0 → null across narrative rows"):
```json
"attack_bonus": null,
"advisory": "monster_teleport",
"advisory_message": "shifts itself and up to three willing creatures within 5 feet to/from the Ethereal Plane \u2014 advisory record: planar travel is GM-enforced, no Ethereal-plane state consumer app-wide (\u00a770). Up-to-three passenger selection GM-adjudicated. No attack roll, no saving throw, no dice."
```
- Byte-precedent: nalfeshnee Teleport actions[2] (`advisory:"monster_teleport"` + advisory_message, `attack_bonus:null`, save_dc:0/save_type:"" kept — monsters.json:43911; second twin :43928). save_dc:0 decoy stays (MA-1071 decision: code-gate is the lane, strip = mass rewrite).
- Result: chip `mc-dice-link-advisory` "Ethereal Stride" (§643 §5 AdvisoryLink), press = popup + record-only `ability_use`, junk "+0" gone, zero rolls/zero lastAttack pollution. Plane-shift STATE stays §70 advisory residual (advisory record is the sanctioned ceiling — §70 advisory-unbuilt family, MA-1223 adjudication applies verbatim).
- No code change required — seam is live (MA-1223/24 nalfeshnee pair + MA-1212/17/20 zone trio, §643).

## Cleanup evidence trail
Board: Nightmare 1 + Bandit 1 (+PC placeholder party §439); joined-noise ledger (encounter + 2× Initiative) + ONE junk `roll/attack "Ethereal Stride"` from +0 probe; then Admin clears (log + change-data) executed last from quiet state.
