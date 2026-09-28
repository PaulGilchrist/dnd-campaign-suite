# BUG MA-1495 — Sphinx of Lore Weight of Years (legendary_actions[1]) — FAIL(b)/DATA

**Verdict: FAIL(b)/DATA — silent-burn save row.** The "Expend Legendary" chip on this row burns the shared legendary use and resolves NOTHING: no popup, zero `roll save` entries, DC 16 Constitution never adjudicated, zero exhaustion applied. The row authors prose-DC only (`save_dc`/`save_type` ABSENT on disk) so `resolveLegendaryRowMechanic` falls to its final else → MA-0510 console.error fingerprint. The exhaustion channel (MA-0751) is LIVE app-wide but structurally unreachable from this row. Economy gate itself is honest (own-turn refusal, exhausted refusal, round-wrap regain all live).

## Row (verbatim)
```json
{"id":"MA-1495","stableKey":"sphinx-of-secrets|actions|0","monsterIndex":"sphinx-of-lore","monster":"Sphinx of Lore","actionIndex":1,"actionName":"Weight of Years","category":"legendary_actions","actionType":"save","saveEffect":"The target gains 1 Exhaustion level and appears 3d10 years older while it has any Exhaustion levels. The sphinx can't take this action again until the start of its next turn.","recharge":false,"uses":1,"description":"Constitution Saving Throw: DC 16, one creature the sphinx can see within 120 feet. Failure: The target gains 1 Exhaustion level. While the target has any Exhaustion levels, it appears 3d10 years older. Failure or Success: The sphinx can't take this action again until the start of its next turn.","verified":"not verified"}
```
Manifest `monsterIndex` typo "sphinx-of-secrets" — correct: `sphinx-of-lore` (stableKey too).

## Disk structure (public/data/monsters.json sphinx-of-lore.legendary_actions[1])
- `save_dc`: **ABSENT** — "DC 16" lives only in description prose (§54: prose fallback exists ONLY for attack bonus via monsterSpellAttackBonus; save DC never parses).
- `save_type`: **ABSENT**. `delegates_to`: **ABSENT**. automation/advisory/hit_conditions: ABSENT.
- `save_effect` present ("The target gains 1 Exhaustion level…"); `uses:1`, `recharge:false`.
- No rollable damage formula ("Failure: …" carries no `N(NdN)` → extractDamageDiceFromDescription null).

## Code fingerprint (source-confirmed)
- `resolveLegendaryRowMechanic` MonsterCardModal.jsx:578-604: `attack_bonus != null` false → `Number(action.save_dc) > 0` **false** (§437/MA-1071 DC>0 gate) → no `advisory` → not self-buff → no rollable formula → **final else console.error** "delegates_to undefined — no resolvable mechanic" (MA-0510).
- Exhaustion channel LIVE but unroutable: parseExhaustionLevelClause (MonsterCardHelpers.js:165-169, `/gains? (\d+) exhaustion levels?/i`) — this row's save_effect **WOULD match** (salamander burning-twin guard not tripped); sole consumer chain buildAbilitySaveRollContext `exhaustionLevel:` (MonsterCardModal.jsx:1529) → saveProcessing.js:485-490 `grantExhaustionClause` (canonical runtime numeric `exhaustionLevel`, cap 6, `condition applied` log, no clock) — but the chain is ONLY entered via `handleSaveRoll`, which requires `save_dc > 0`. save_dc absent → chain never armed.
- targetEffectDefinitions.js: NO exhaustion te (registry comment-only) — by-design MA-0751 canonical-numeric transport, NOT an additional defect.

## Live ledger (Playwright, test-campaign header-verified, localhost:5173)
Board: Sphinx of Lore 1 init29 hp170 + Bandit 1 init17 hp926 (Incapacitated MA-1492, CON +1) + EB party; regained post-MA-1494 burn.

| Probe | Result |
|---|---|
| Regain (round 5 Sphinx turn-start) | `ability_use` "regains all legendary uses" + counter {1,1}→{1,0} + `monsterLegendaryActionCooldowns` cleared — regain consumer LIVE |
| Own-turn press pre-unstick | refusal popup + `legendary_use_refused (own-turn)` zero-spend — §418 frozen cs mirror (walker truth `5:DivinationWizard`, mirror stuck "Sphinx of Lore 1"; loaded-tab §97 — POST alone did NOT propagate) |
| §418 sanctioned unstick | full-store cs POST `{value:{…}}` activeCreatureName="DivinationWizard" + reload + re-select → gate window opens (targetName Bandit 1 preserved) |
| Expend press (window open) | **ZERO popup**; log `ability_use` "expends a legendary use for Weight of Years after DivinationWizard's turn"; counter {1,0}→{1,1}; `_legendaryUses_usedRound {round:5,activeCreature:"DivinationWizard"}` (§98 latch=active at click); cooldown `weight_of_years {round:5}` stamped |
| Console | exactly **1 error**: `[MonsterCardModal] legendary action "Weight of Years" delegates_to "undefined" — no resolvable mechanic on "Sphinx of Lore 1"` — MA-0510 fingerprint |
| Save adjudication | ZERO — `roll save`/rollType-save entries whole-log = 0 (only MA-1492 save-damage twins pred); no `.sp-modal`; pendingSavePrompts None; `saveResult-Bandit 1` key ABSENT; DC 16 never evaluated vs Bandit CON +1 |
| Exhaustion applied | ZERO — Bandit change-data: no `exhaustionLevel`, no exhaustion keys (only MA-1492 `incapacitated` te+meta); hp 926→926; whole-log "exhaust" hits = 2 refusal-token words "exhausted", zero grants |
| Refire (exhausted) | refusal popup "no legendary uses left — regain at the start of Sphinx of Lore 1's turn" + `legendary_use_refused (exhausted)` zero-spend ✓ gate honest |

## Economy honesty
Counter / spend-log / own-turn + exhausted refusal tokens / round-wrap regain ALL LIVE. Defect is purely adjudication: burn + console.error, RAW exhaustion-1 on fail never happens (structural always-fail victim: DC16 vs CON+1 needs nat≥15).

## Fix (DATA, same-pass with MA-1494 header insert per §46; MA-1089/MA-1204 twins)
1. `save_dc:16` + `save_type:"Constitution"` + `dc_success:"none"` (no half on this row) on legendary_actions[1] → arms `handleSaveRoll` seam → parseExhaustionLevelClause threads `exhaustionLevel:1` → grantExhaustionClause canonical stack + `condition applied` log (MA-0751 live machinery).
2. Drop child `uses:1` per §165 **same pass** as MA-1494 canonical header insert ("Legendary Action Uses: 2", §231 no lair bump — prose lair) — else phantom double-economy (MA-1089/§438).
3. "3d10 years older" = cosmetic advisory residual (§70-class, no consumer needed; exhaustion level IS the mechanical grant).

## End-state after verification
Round 5, walker=DivinationWizard; cs.activeCreatureName=DivinationWizard (unstick preserved); Sphinx hp170, `monsterLegendaryUses {max:1,used:1}` (MA-1495 burn) + `_legendaryUses_usedRound`/`monsterLegendaryActionCooldowns.weight_of_years {round:5}` residual stamps; Bandit hp926, exhaustion untouched; log 45. Cleanup: admin clear cd+log executed (Sphinx block MA-1490…1495 done).
