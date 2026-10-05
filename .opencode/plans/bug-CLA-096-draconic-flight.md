# BUG CLA-096 — Draconic Flight: duration never expires, no retract, no log

**Verdict: FAIL** (core activation legs pass live; "buff never expires when code claims it" + missing retract affordance).
Host: DragonbornTest (2024 Blue Dragonborn, Fighter/Champion, leveled 1→5 via Edit wizard, milestone). Campaign: test-campaign. Env: localhost:5173.

## Passes (live-evidenced)
1. **requiredLevel gate @lv1**: click → popup "Draconic Flight requires character level 5. You are level 1." (`buffHandler.js:57-68`). Speed stayed "30 ft.".
2. **Activation @lv5**: popup "Draconic Flight activated on yourself (10_minutes)".
3. **Fly speed lands**: sheet Speed line "Speed: 30 ft., fly 30 ft." (fly==walk; `charSummaryCalc.js:208,290`).
4. **Buff stamp**: GET change-data `activeBuffs=[{name:'Draconic Flight', effect:'fly_speed_equals_walk_speed', duration:'10_minutes', castingTime:'1 bonus action', …}]`.
5. **Badge**: `<span class="creature-badge effect-buff" title="Draconic Flight Active">` fa-feather.
6. **Once-per-LR refusal**: re-click while active → "Draconic Flight has been used and cannot be used again until a Long Rest." (`buildLongRestRechargePopup` `buffHandler.js:162-176`).
7. **Long Rest re-arm**: LR cleared buff, Speed reverted to "30 ft.", re-activation succeeded, fly returned.

## Failures / gaps
### F1 — 10-minute duration never expires (FAIL-class)
- Generic temp_buff lane (`buffHandler.handle` → `toggleBuff` `buffToggle.js:13`) stores `duration:'10_minutes'` as **display text only** — no `addExpiration` call anywhere on the lane.
- `parseDurationRounds('10_minutes')` → `0` "encounter-scoped marker" (`durationParser.js:15-17`) and no caller on this lane anyway.
- `EXPIRATION_HANDLERS['fly_speed_equals_walk_speed']` (`clearExpirationEffects.js:129-148,401`) has **zero runtime producers** (grep: only test files construct that entry type).
- GET proof: `pendingExpirations: []` on DragonbornTest after activation (×2). No admin time lever; round-clock would only fire on combat round advance regardless.
- Net: fly speed stands indefinitely until a Long Rest wipes activeBuffs (`restRules-longRest.js:79`) or admin clear. RAW breach: wings should drop after 10 minutes.

### F2 — Retract (no action) has no affordance
- Re-click while active = LR **refusal**, not toggle-off (`buffHandler.js:166`).
- Badge is a plain `<span>` with no remove button (live DOM dump). No retract anywhere.

### F3 — Incapacitated clause unwired
- Dissolve handler + log live only inside `handleFlySpeedEqualsWalkSpeed` — unreachable without an expiration entry (none produced; see F1). No turn-start incapacitated lane for this buff (lanes exist only for Wrath of the Sea / Cloak of Shadows, `turnStartEffects.js:68-85`).

### F4 — No activation/refusal logging
- Campaign log after both activations + both refusals: zero "Draconic Flight" entries (GET `/api/campaigns/test-campaign/log` — only rest entries). Violates project rule "every automation must log".

### F5 — Architecture trap for any fix
- LR gate enforcement rides solely on the buff standing in activeBuffs. If expiry is fixed to remove the buff at 10 minutes, same-day reuse becomes ungated (no tracked-uses key exists: `auto.uses` absent → `gateTrackedBuffUses` returns `{}` `buffHandler.js:133`). Fix must register a `remove_active_buff`-style rounds clock (10min×10 rounds) AND a long-rest-recharged uses flag re-armed by `restRules-longRest.js`.
- Breath-energy cosmetic wing clause (manifest): grep-only, no cosmetic surface — note, not blocking.

## Suggested fix sketch
In `buffHandler` generic temp_buff activation for `fly_speed_equals_walk_speed` + `recharge:'long_rest'`: explicit rounds clock `rounds: 10*10` via `addExpiration({type:'remove_active_buff', buffName})` (playbook §38 same-round caveat) + persisted `draconicFlightUsed` flag gated at activation, nulled by long rest; retract = badge remove (CreatureBadge removable) or toggle path exempted from LR refusal when `wasActive`; add `ability_use` + expiry log entries.

## Cleanup performed
Admin UI cleared change-data (GET `{}`) + campaign log (GET `[]`). DragonbornTest LEFT at lv5 (Blue Dragonborn Fighter/Champion, 2024) — registry.
