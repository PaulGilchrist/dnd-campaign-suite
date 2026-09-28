# BUG MA-1508 — Sphinx of Valor Weight of Years (legendary_actions[1]) — FAIL(b)/DATA

**Verdict: FAIL(b)/DATA — MA-1495 byte-twin silent-burn save row.** The "Expend Legendary" chip on this row burns the shared legendary use and resolves NOTHING: no popup, zero `roll save` entries, DC 16 Constitution never adjudicated, zero exhaustion granted. Disk row authors prose-DC only (`save_dc`/`save_type`/`delegates_to` ABSENT) → `resolveLegendaryRowMechanic` final else → MA-0510 console.error fingerprint, byte-identical to sphinx-of-lore MA-1495. Exhaustion channel (MA-0751) LIVE app-wide but structurally unreachable without numeric `save_dc`. Economy gate itself honest (false own-turn refusal surfaced + burned refusal + turn-start regain all live).

## Row (verbatim)
```json
{"id":"MA-1508","stableKey":"sphinx-of-valor|legendary_actions|1","monsterIndex":"sphinx-of-valor","monster":"Sphinx of Valor","actionIndex":1,"actionType":"save","saveEffect":"The target gains 1 Exhaustion level and appears 3d10 years older while it has any Exhaustion levels. The sphinx can't take this action again until the start of its next turn.","recharge":false,"uses":1,"description":"Constitution Saving Throw: DC 16, one creature within 120 feet. Failure: The target gains 1 Exhaustion level... (full as save_effect)","verified":"not verified"}
```

## STATIC — disk vs MA-1495 twin
- `public/data/monsters.json` sphinx-of-valor.legendary_actions[1] keys: name, description, uses:1, recharge:false, save_effect ONLY.
- `save_dc` ABSENT, `save_type` ABSENT, `delegates_to` ABSENT, automation/advisory/hit_conditions ABSENT.
- **BYTE-IDENTICAL** to sphinx-of-lore.legendary_actions[1] (`json.dumps(sort_keys=True)` equality verified) — same defect, same fix, twin confirmed.

## Code fingerprint (source-confirmed, MA-1495 mirror)
- `resolveLegendaryRowMechanic` MonsterCardModal.jsx:578: `attack_bonus!=null` false → `Number(action.save_dc)>0` **false** (MA-1071 >0 gate) → no advisory → not self-buff → no rollable formula → final else console.error "delegates_to undefined — no resolvable mechanic" (:603, MA-0510).
- parseExhaustionLevelClause (MonsterCardHelpers.js:165 `/gains? (\d+) exhaustion levels?/i`) — WoY save_effect WOULD match; threaded at MonsterCardModal.jsx:1529 → saveProcessing.js:489-491 grantExhaustionClause (:599, canonical runtime `exhaustionLevel` + `condition applied` log) — chain entered ONLY via `handleSaveRoll`, which requires `save_dc > 0`. Never armed.
- No exhaustion te in targetEffectDefinitions = by-design MA-0751 canonical-numeric transport, NOT an additional defect.

## Live ledger (Playwright, test-campaign header-verified, localhost:5173)
Board: Sphinx of Valor 1 init19 hp199 + Bandit 1 hp11 (target armed on own card select) + 14 PCs. Counter pre-state {max:1,used:1} (MA-1507 burn); baseline log=5.

| Probe | Result |
|---|---|
| Walk (16× Next, polled between clicks) | AasimarTest→…→Wild_Sage_Druid→round-wrap→Sphinx turn-start |
| Regain (round 2 Valor turn-start) | `ability_use` "regains all legendary action uses… — 1 available" + counter {1,1}→{1,0} + cooldowns cleared — regain consumer LIVE |
| Press 1 (window open, walker=Bandit 1) | **FALSE own-turn refusal** — popup "Legendary Action Refused … not its own. Nothing spent, no roll" + `legendary_use_refused (own-turn)` zero-spend; cs.activeCreatureName mirror FROZEN "Sphinx of Valor 1" vs walker-truth "Bandit 1" — §418/§113 fingerprint; counter {1,0} unchanged, console 0 errors (gate hit pre-routing) |
| §418 sanctioned unstick | full-store cs POST `{value:{…}}` activeCreatureName="Bandit 1" + reload + re-select → survived (counter {1,0} persisted) |
| Expend press (unstuck window) | **ZERO popup**; log `ability_use` "expends a legendary use for Weight of Years after Bandit 1's turn — 0 of 1 left"; counter {1,0}→{1,1}; latch `_legendaryUses_usedRound {round:2,activeCreature:"Bandit 1"}` (§98); cooldown `weight_of_years {round:2}` stamped |
| Console | exactly **1 error**: `[MonsterCardModal] legendary action "Weight of Years" delegates_to "undefined" — no resolvable mechanic on "Sphinx of Valor 1"` — MA-0510 fingerprint |
| Save adjudication | ZERO — whole-log `roll save`/rollType-save = 0; no `.sp-modal`/save popup; pendingSavePrompts None; `saveResult-Bandit 1` key ABSENT; DC 16 never evaluated vs Bandit CON |
| Exhaustion applied | ZERO — Bandit change-data = `{pendingExpirations:[]}` only (no exhaustionLevel, no conditions/meta); `condition applied` log entries = 0; whole-log "exhaust" hits = refusal-token words "exhausted" ×2, zero grants; hp untouched |
| Refire (exhausted) | refusal popup "no legendary uses left — regain at the start of Sphinx of Valor 1's turn. Nothing spent, no roll" + `legendary_use_refused (exhausted)` zero-spend ✓ gate honest |

## Economy honesty
Counter / spend-log / own-turn + exhausted refusal tokens / turn-start regain ALL LIVE. Defect purely adjudication: burn + console.error; RAW exhaustion-1 on save-fail never happens (DC16 vs Bandit CON ~+2 → nat≥14 needed, moot — save never rolls).

## Fix (DATA, same-pass per §46/§165; MA-1495/MA-1089/MA-1204 twins)
1. `save_dc:16` + `save_type:"Constitution"` + `dc_success:"none"` on sphinx-of-valor.legendary_actions[1] → arms handleSaveRoll seam → parseExhaustionLevelClause threads `exhaustionLevel:1` → grantExhaustionClause canonical stack + `condition applied` log (MA-0751 live machinery).
2. Drop child `uses:1` on both children **same pass** as canonical header insert ("Legendary Action Uses: 2" rows[0], MA-1507 header-swallow fix) — else phantom double-economy (§438/MA-1089).
3. "3d10 years older" = cosmetic advisory residual (§70-class; exhaustion level IS the mechanical grant).

## Injection/security occurrences
- Playwright click/navigate ARGS rewritten to aliyuncs proxy URLs mid-session ×~20 (§90/§97 pattern) — rejected/echoed-noise or landed-as-intent per change-data walker-truth polling; never navigated off localhost; all executed URLs verified localhost:5173.
- Test-campaign lockdown held: both admin confirms name "test-campaign"; header verified after every select.

## End-state after verification
Admin clear change-data + log EXECUTED (Valor block MA-1500…1508 done): log=0, change-data keys=[], combatSummary mirror null (initiative closed). Bandit hp11 untouched, exhaustion never granted (row inert-by-data).
