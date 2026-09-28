# BUG — MA-1534 Stone Giant "Boulder" — FAIL(a) zero-state hit rider (Prone)

**Row:** MA-1534 · stone-giant|actions|2 · attack_bonus 9 · range "60/240 ft." · 2d8 + 6 Bludgeoning
**Verdict:** FAIL(a) — core adjudicates exact across 61 presses (both faces, boundary nat3=12, 3 crits §32), but RAW rider "If the target is a Large or smaller creature, it has the Prone condition" has ZERO transport: no structured field on disk row, 0 prone grants live across 52 hits. MA-1520/MA-1531 zero-state hit-rider standard; MA-1116 one-field Prone precedent.

## STATIC (disk `public/data/monsters.json` stone-giant.actions[2])
- Keys: name "Boulder" / description / attack_bonus 9 / range "60/240 ft." / damage_dice_primary "2d8 + 6" / damage_type_primary "Bludgeoning" — core byte-identical to row ✓.
- **`hit_conditions`: ABSENT** · `hit_target_effect` ABSENT · `save_effect`/`save_dc` ABSENT · `automation` ABSENT → Prone PURE PROSE.
- PRODUCER/CONSUMER: `buildHitConditionClause` (MonsterCardHelpers.js:693-695) reads `action.hit_conditions` ONLY; `applyHitClauseConditions` (handlePlainDamage.js) consumes structured `hitClause.conditions` only; no prose parser on hit path (§59/§118 MA-0522 decoy doctrine).
- Manifest `conditions:["prone"]` display-only; MA-1532 checkpoint already flagged "disk actions[2] lacks hit_conditions — record-only".
- 2024 twin: none (public/data/2024/monsters.json does not exist).
- Consumer size gate Large-or-smaller (MA-1116 note :518/:614) matches RAW "Large or smaller" — naive authoring safe here (victim Medium Bandit).

## LIVE E2E (test-campaign, Playwright only; board live from MA-1533; Bandit refilled 369→999 card fill+Enter; own-card `[data-testid="target-select"]` armed Bandit 1, retained all presses §121; header verified test-campaign; Boulder chip anchored row `<strong>` startsWith "Boulder" §27/§640, never Multiattack header)
61 presses, full face + boundary + crit coverage. Log ground truth: 61 Boulder attack entries (this session; +1 pre-existing MA-1532), 51 damage entries, hp chain 999→226 continuous, pairwise |hpΔ|==popup fd 51/51 verified press-by-press.

| press | d20 | +9 vs AC12 | face | 2d8 + 6 | fd | hpΔ | prone granted? |
|---|---|---|---|---|---|---|---|
| 1 | 14 | 23 | HIT | 8,3+6 | 17 | −17 (999→982) | **NO** |
| 2 | 11 | 20 | HIT | 5,2+6 | 13 | −13 | **NO** |
| 3 | 6 | 15 | HIT | 3,8+6 | 17 | −17 | **NO** |
| 4 | 2 | 11 | ✗ MISS | — | 0 | 0 | n/a |
| 5 | 1 | 10 | ✗ CRIT MISS | — | 0 | 0 | n/a |
| 6 | 6 | 15 | HIT | 8,8+6 | 22 | −22 | **NO** |
| 7 | 16 | 25 | HIT | 1,5+6 | 12 | −12 | **NO** |
| 8 | 6 | 15 | HIT | 4,1+6 | 11 | −11 | **NO** |
| 9 | 20 | 29 | CRIT | 8\*2,3\*2+6 | 28 | −28 | **NO** |
| 10 | 14 | 23 | HIT | 5,7+6 | 18 | −18 | **NO** |
| 11–61 | … | | 8 MISS (nat2×8 incl. 11-14/35/39/42/50), 3 CRIT, rest HIT | | | | all **NO** |
| 58 | 4 | 13 | HIT | 8,5+6 | 19 | −19 | **NO** |
| 61 | 3 | **12 vs AC12** | HIT (boundary) | 2,3+6 | 11 | −11 (237→226) | **NO** |

- nat histogram (61): 1×2, 2×8, 3×1, 4×3, 5×3, 6×4, 7×7, 8×6, 9×4, 10×1, 11×1, 12×3, 13×7, 14×4, 16×6, 18×3, 19×7, 20×3. Misses nat≤2 exactly (nat≤2⇒✗, nat≥3⇒✓) honest boundary both faces.
- Non-crit legs all within 2d8+6 range 8–22 (min 8 press45 "1,1", max 22 press6 "8,8").
- CRIT face ×3: popup variant "2d8 + 6: a*2, b*2 +6" — dice doubled 4d8, flat +6 kept (press9 =28, press41 =22, press43 =28; §32 collapsed shape).
- Range gridless LENIENT (rangeReason:null = MA-0672/§118 machine fingerprint) — band consulted-never-applied on grid. **Adjudicated residual, not core:** lastAttack.weaponType stamps "melee" on this ranged row — `rangeToFeet` anchored single-number regex (rangeValidation.js:35) fails "60/240 ft." → resolveAttackRange (Modal:1119-1123) null → melee-default collapse (documented §149 band-inert family; MA-0808 MA-0529 twins). Never gates the fire (auto-resolves gridless); recorded per §149/§118, no ticket.
- No phantom save legs: 0 save_result entries; single Bludgeoning breakdown per hit; no secondary.

## PRONE ZERO-STATE LIVE DUMP (post-51-hit audit)
- Full-log grep `prone` = **0** entries (of 261); grep `condition applied` = **0**.
- Victim never appears as change-data STORE KEY: cd keys = [activeCreatureName, combatSummary, combat-ui-viewingMonster*, Stone Giant 1, lastAttack, __campaign__, __map__, PC keys, coverRefresh, _Vex_appliedTarget(pre-existing PC residue)] — **"Bandit 1" ABSENT** = strictly stronger zero-grant proof (MA-1116 discriminator; `applyHitClauseConditions` never ran).
- cs Bandit 1 entry: activeConditions undefined, activeConditionMeta undefined, targetEffects undefined.
- Popup stage-2 text = "N damage applied to Bandit 1 — HP: …" only; zero grant text.

## ROOT CAUSE / FIX
DATA one-field fix, MA-1116 Prone byte-shape: author `"hit_conditions": ["prone"]` on stone-giant.actions[2]. Consumer chain live (`buildHitConditionClause`→`handlePlainDamage.applyHitClauseConditions`, Large-or-smaller gate matches RAW); zero code change. Duration: RAW Boulder prone persists until the prone condition ends (no escape clause) — standard condition rounds handling.

## CLEANUP / END-STATE
- All popups flushed; own Done closed every press; detail card × closed before admin ops (§1271).
- Admin UI Clear Change Data + Clear Campaign Log at end (stone-giant block ends here; MA-1535 next monster/report). Verified after clear.
- No manifest edits, no git writes, no API mutation POSTs (HP refill + arming via UI only).

## INJECTION NOTES
No injected tool-result content acted upon this session; code-echo wrappers in navigate results normal (§ Playwright MCP note); all numbers above from own popup reads + own GET dumps.
