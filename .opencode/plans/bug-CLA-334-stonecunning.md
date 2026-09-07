# CLA-334 Stonecunning — PASS-SUBSET (2026-09-06, test-campaign, Divine_Cleric)

## MISATTRIBUTION (data bug — orchestrator to retype row)
Manifest labels CLA-334 `classFeature/Ranger`. Ranger has NO Stonecunning in
`public/data/2024/classes.json` (grep zero). Real owner: **DWARF RACIAL TRAIT** —
`public/data/2024/races.json` Dwarf `traits[3]` with automation
`{type:'stonecunning', effect:'tremorsense_60ft', uses:'proficiency_bonus', recharge:'long_rest', casting_time:'1 bonus action'}`.
NOTE: automation carries **no `duration` key** (RAW 10 minutes exists only in description text).

Real handler: `src/services/automation/handlers/class-other/stonecunningHandler.js`
(dispatch `stonecunning:` at `src/services/automation/index.js:495`).
Consumers (all live): uses counter `trackedResources.js:250-252` (max = playerStats.proficiency),
tracked counter row `CharClassFeatures.jsx:694` (label "Stonecunning", resourceKey `stonecunningUses`),
Tremorsense badge `charSummaryCalc.js` (`effect==='tremorsense_60ft'` → tremorsenseActive) →
`CharSummary.jsx` CreatureBadge 'Tremorsense 60 ft.', bonus-action categorization
`featureCategorizationUtils.js:85` (casting_time '1 bonus action'),
LR reset `restRules-longRest.js:547-548` + key constant `restRules-constants.js:177`.
Campaign log entry IS produced (`ability_use`, handler :52-59) — no logging gap.

## VERIFIED (live, lv17 Dwarf, PB +6)
- (a) Bonus action: row renders in Bonus Actions as `b.clickable "Stonecunning:"`; popup states "(1 bonus action, 10 min)".
- (b) Uses counter = PB: max 6/6 at lv17. Refusal popup at 0: "Stonecunning has no uses remaining. Recharges on a Long Rest." (no spend). Decrement chain server-persisted: activation1 write LOST (see BUG-1), activation2 `stonecunningUses:5`, activation3 `4`, activation4 `3` (change-data `d['Divine_Cleric'].stonecunningUses` + sheet "Stonecunning: 3/6"). Long Rest → key `null` → refills 6/6, buff also cleared.
- (c) Buff: `activeBuffs` entry `{name:'Stonecunning', effect:'tremorsense_60ft', castingTime:'1 bonus action'}` + "Tremorsense 60 ft." badge on sheet. NEW `ability_use` log per activation: "Stonecunning activated. Tremorsense 60 ft. (N uses remaining)."
- Works out of combat (no cs requirement — RAW trigger is combat-agnostic).

## GAPS / BUGS
- **Accepted (§7)**: Tremorsense is display/state-only — no sense/light model, no gameplay gate.
- **Stone-surface gate unmodellable**: zero consumers anywhere (grep `stone surface|stonecunning` src+server = handler text only). Not enforced, no map stone-cell concept. FAIL-soft by environment, not click-inert.
- **BUG-1 (uses-write race)**: FIRST activation of the session loses the uses decrement server-side — `toggleBuff`'s un-awaited `setRuntimeValue(activeBuffs)` full-store snapshot races the awaited `setRuntimeValue(uses)` (§6-#18 pattern); server settled `stonecunningUses:null` while popup/log said "5 remaining". Re-arm + re-click persisted correctly (5→4→3), so the chain self-heals but first spend is free. Fix: await buff POST before uses POST (or single merged write) in stonecunningHandler.js:40-49.
- **BUG-2 (toggle-off on "already active")**: clicking while active returns "already active" popup BUT `toggleBuff` already REMOVED the buff (verified activeBuffs emptied, no use spent). Popup contradicts state.
- **BUG-3 (duration never expires)**: races.json automation has no `duration`; buff stores `duration:undefined`; `pendingExpirations:[]` on activation — 10-minute window is popup-text only, buff persists until manual toggle/Long Rest. Needs `duration:'10_minutes'` in races.json + addExpiration registration.
- **Seed 0**: fresh sheet mount seeds `stonecunningUses:0` (change-data) — first use after a re-edit is refused until Long Rest/Admin re-arm (playbook §1 placeholder behavior).

## PROOF ENV
Host: Divine_Cleric (PRIOR: Human Cleric Life Domain lv17 2024 → NEW: Dwarf/Hill Dwarf Cleric lv17 2024, PERMANENT wizard edit step-3+4+✓Save).
Cleanup: Admin Clear Change Data + Clear Campaign Log; verified `{}`/0 entries.
