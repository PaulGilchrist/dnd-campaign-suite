# FT-101 Sentinel – Halt — FAIL (flavor b: feature is decorative)

**Date:** 2026-10-08 · **Campaign:** test-campaign · **Verifier:** UI + grep probe

## Expected
When you hit a creature with an Opportunity Attack, that creature's Speed becomes 0 until the end of the current turn.

## Root cause (grep — consumer chain 100% dead)
1. **Data declares a key nobody reads.** `public/data/feats.json` Sentinel automation = `{type:"passive_rule", effect:"opportunity_attack_speed_zero"}`. `opportunity_attack_speed_zero` appears **only** at feats.json:584 — zero consumers in `src/`.
2. **`resolveHandler` dead-ends passive_rules without a registry entry.** `src/services/automation/index.js:674` — `passive_rule` resolves only via `PASSIVE_RULE_EFFECTS` (:289-296: savants/persistent_rage/superior_defense). `opportunity_attack_speed_zero` absent → handler never selected.
3. **The dedicated handler is unreachable.** `sentinelHaltHandler.js` (functional, unit-tested) is mapped at `index.js:623` under `HANDLER_MAP.sentinel`, but **no feature in any data file has `automation.type:"sentinel"`** (grep `"type": "sentinel"` across `public/data` = 0 hits). Same dead-key pattern as FT-100's `sentinel_guardian`.
4. **OA-hit seam stamps nothing.** `reactionDamageHandler.js` (real path `handlers/reactions/`) — zero `speed`/`halt` mentions. Nothing in the OA resolution path applies speed_zero. The info-builder (`core-handlers.js:754-759`) only bakes the display default string `speed_0_on_oa_hit` into the passive row.

## Live proof (UI, localhost:5173, header test-campaign)
- Host EvasiveFighter with Sentinel disk-confirmed (`public/campaigns/test-campaign/EvasiveFighter.json` feats ⊃ "Sentinel").
- EB-joined Bandit 1 (AC 12), armed vs HexWarlock via tracker Target combobox (change-data `targetName:"HexWarlock"` GET-verified).
- Bandit Scimitar attack → natural 20, **HIT 23 vs AC 9** (lastAttack `{attackerName:"Bandit 1", hit:true, isCrit:true}` GET-verified) → qualifying Guardian trigger.
- Pressed EvasiveFighter sheet `Guardian:` row → OA rolled, popup **✓ HIT (25 vs AC 12)**, log `roll EvasiveFighter Glaive total 16 +9` + `hp_change Bandit 1 −12`.
- **After OA HIT (11 s debounce, machine truth GET /change-data):** recursive walk for `speed|halt` over entire change-data → **NONE**; Bandit `targetEffects:null`, `activeConditions:null`, no Speed:0 stamp; log grep `-io speed|halt` → **0 hits**. No expiry (nothing to expire).
- Non-OA control: Bandit's scimitar crit on HexWarlock (logged hp_change −3) → also no speed stamp (symmetric zero-delta).
- "Halt:" row renders on the sheet as display-only passive text (FT-100 observation reproduced).
- Plain `Opportunity Attack:` sheet row exists as affordance but same dead chain; monster was at 0 HP so no second press (code-guaranteed zero delta).

## Verdict
**FAIL (flavor b)** — FT-101 has zero observable game effect. OA hits land, deal damage, and never touch Speed.

## Fix sketch
Register a real OA-hit seam: in the reaction/OA resolution (reactionDamageHandler hit branch) stamp `targetEffects {effect:"speed_zero", option:"Halt", source:attacker, duration:"end_of_turn"}` (registry key exists: targetEffectDefinitions.js:1368; clear lanes exist: turnStartEffects.js:382-385, clearExpirationEffects.js:455) gated on attacker possessing Sentinel. Alternatively remap feats.json automation to a live type and wire the existing sentinelHaltHandler into the OA-hit trigger.

## Cleanup
Bandit removed from tracker; admin clear-change-data GET-verified; page deselected/quiet. Sentinel feat **kept** on EvasiveFighter (registry permanent per FT-100).
