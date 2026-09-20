# Bug: MA-0621 Dracolich Sickening Ray — Expend chip silent-burns the legendary use, spell never adjudicates

**Row:** MA-0621, stableKey `dracolich|legendary_actions|1`, monster Dracolich, category legendary_actions, actionType "other", uses 1.
**Verdict: FAIL(b)/DATA — silent-burn (MA-0510/MA-0620 class).** One click burns the shared legendary counter with ZERO cast, ZERO roll, ZERO save, ZERO damage; console.error "no resolvable mechanic". Economy gate itself is live and enforced (refusal honest).

## Disk structure (verbatim, public/data/monsters.json dracolich.legendary_actions[1])
- `{ "name":"Sickening Ray", "description":"The dracolich uses Spellcasting to cast Ray of Sickness (level 2 version). The dracolich can't take this action again until the start of its next turn.", "uses":1 }`
- **Zero numeric spell fields**: no `spell_dc`, no `attack_bonus`, no `save_dc`, no `damage_dice_primary`, no spell-name key, **no `delegates_to`**. §46 "prose spellcast child needs NUMERIC spell fields copied" — grep-zero transport confirmed (src/ + server/ hold only PC-side Ray of Sickness files: fiendishLegacyHandler, char-sheet spell rendering; no monster consumer).
- Context: rows[0] Pounce `{name,description,uses:1}` = the header-swallowed row (MA-0620) — Sickening Ray rides Pounce's hijacked `monsterLegendaryUses` counter (§99/§98 all-children-one-counter). rows[2] Terrifying Presence fully numeric (live twin).
- Dracolich has NO `spellcasting` structured key; Spellcasting is an actions-row prose block with plain-text spell names (no `<em>/<strong>` per spell) → §57/§89/§115 zero chips; MA-0421 markup gap applies.

## Static resolution trace (code seams read)
- Renderer: `LegendarySpendLink` (MonsterAction.jsx:161-172) — `numericAffordance` false (no attack_bonus/save_dc/dice) → generic **"Expend Legendary"** chip, NOT a spell chip. `findMonsterSpell` (MonsterCardModal.jsx:962, 5e-first + 2024 fallback, MA-0619 note) is NEVER reached — no spell chip routes to it.
- Click: `expendLegendaryUse` (MonsterCardModal.jsx:488) spends FIRST, then `resolveLegendaryRowMechanic` (:423-438): attack_bonus/save_dc null, advisory undefined, `extractDamageDiceFromDescription("...cast Ray of Sickness (level 2 version)...")` → null (regex needs "Hit|Failure|Success: N(dice)") → **console.error :436 (Vite-mapped :588)** — silent burn fingerprint §46/§99/MA-0510.
- §46 warning: even authored `delegates_to:"Spellcasting"` misfires through the save leg; MA-0227 arch-hag precedent = copy numeric fields onto the row.

## Spell-data compound ceiling (even post delegates_to fix)
- Ray of Sickness: 5e spells.json **absent** (grep confirmed live, §143) / 2024 spells.json present: level 1, ranged **spell attack** (no save), Poison `damage_at_slot_level` {1:"2d8",2:"3d8"} — RAW expects level-2 = 3d8 vs +11 (DC 19 Cha row header).
- The "level 2 version" upcast token is unresolvable from this row: no numeric level/upcast field, prose-only; 2024 damage_at_slot_level scaling has no monster legendary-row consumer. Fix must author explicit level-2 numerics (`attack_bonus:11`, `damage_dice_primary:"3d8"`, `damage_type_primary:"Poison"`, `is_spell`/hit-clause per MA-0452 bullywug attack-seam twin), not rely on `delegates_to:"Spellcasting"`.

## Live proof (test-campaign, header verified `test-campaign`, :5173 reused)
Join exact Dracolich + Bandit (Bandit exact-row checkbox, §124 collision dodged) → cs `[Dracolich 1 225/225, Bandit 1 11/11→staged 999/999 via full-store cs POST, +14 PC placeholders]`. Arm via Dracolich 1 own initiative-card `[data-testid="target-select"]` selectOption → armed "Bandit 1". Baselines: `monsterLegendaryUses` **null**, log len 3 (join noise).
- Card overlay legendary section: row0 `Pounce (1 left)` links:[] (header-swallow, MA-0620); **row1 Sickening Ray — ONE `mc-dice-link-legendary` "Expend Legendary" chip**; row2 Terrifying Presence "2d10"+"DC 19 Wisdom" chips.
- **Click1 (fresh rect, Expend chip):** `ability_use` "Dracolich 1 expends a legendary use for Sickening Ray after AasimarTest's turn — 0 of 1 left"; change-data `monsterLegendaryUses {max:1, used:1}` diff null→burn; latch `_legendaryUses_usedRound {round:1, activeCreature:"AasimarTest"}` (§98: latch stamps active, not attacker); popups []; **no cast, no roll attack, no save prompt, no damage**; console ERROR `[MonsterCardModal] legendary action "Sickening Ray" delegates_to "undefined" — no resolvable mechanic on "Dracolich 1"` (MonsterCardModal.jsx:588). Silent burn CONFIRMED.
- **Click2 (same chip, same turn):** refusal popup "no legendary uses left — regain at the start of Dracolich 1's turn. Nothing spent"; `automation Sickening Ray refused (exhausted) — zero spend, no roll`; legend stays `{max:1,used:1}`; header "Pounce (0 left)". Gate enforced (§99 exhausted-token distinguishes gate from dead).
- Full log audit (5 entries: encounter, 2 initiative roll, spend, refusal): **rolls attack 0, roll damage 0, hp_change 0, save 0, casts 0. Bandit 1 untouched at 999/999.**

## Expected (RAW)
Sickening Ray resolves ONE Ray of Sickness (2024, level-2 upcast): ranged spell attack +11 vs armed target AC (Bandit AC12); hit = 3d8 Poison + Poisoned condition (until end of target's next turn, no save); spends 1 legendary use; second use same boundary refused exhausted.

## Fix template (data, same pass as MA-0620 header fix — §46 header+children SAME pass)
1. Canonical header rows[0] `Legendary Action Uses` uses:1 (MA-0040/MA-0022; frees Pounce to get `delegates_to:"Rend"`).
2. Sickening Ray child: add numeric spell fields copied from 2024 data at level 2 — `attack_bonus:11`, `damage_dice_primary:"3d8"`, `damage_type_primary:"Poison"`, hit-condition transport (Poisoned) per MA-0452 bullywug seam; `delegates_to:"Spellcasting"` alone MISFIRES through save leg (§46) — do not use as sole fix. Row then renders real attack chip; legendary gate rides existing numeric-affordance path (numericAffordance=true ⇒ no generic Expend chip, no silent burn).
3. 2024-safe: never let resolution fall through 5e-first without the numerics authored on-row, since spell is 5e-absent (§143).
Live verify after fix: DELETE `combat-ui-viewingMonster` + re-join + hard reload (§21/§106); EB checkbox/mouse pitfalls §152/§153; damage vs Bandit AC12 = hit structurally near-certain, Poisoned condition on Bandit 1 + save-free attack adjudication the decisive proof.

## Pitfalls hit
- EB checkbox click absorbs repeatedly (§152): mouse-click on the checkbox input failed ×4; `force:true` locator click landed checked=true. Verify `input.checked` every time.
- No header row exists at all on disk (rows[0] carries the counter itself); this run's "1 left" counter and burn latch all ride the Pounce-hijacked header (§99/§98 confirmed byte-faithful twins of MA-0620).
- Console error line :588 (Vite-transformed module) = disk :436 — same fingerprint.
- No injection/off-site URL echoes this session; location verified localhost:5173 by own evaluate. browser_tabs uneventful (§143 audit done).
- Cleanup: npc-remove ×2 (confirm-override evaluate) → cs creatures []; admin clear-change-data + clear-log POST 200; curl-verified log `[]`, change-data `{}`, cs `[]`. No src/public-data/manifest/git writes.
