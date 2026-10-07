# Bug FT-046 — Inspiring Leader (2024 feat) grants wrong temp HP amount + no once-per-rest latch

**Verdict: FAIL** (implemented but behaves wrong)

## Host / config
- HeroesFeastBard, lv20 Bard, 2024, test-campaign.
- Disk: `feats[]` includes Inspiring Leader; `featAbilityChoices: {"Inspiring Leader-0": {"assignment": "Wisdom"}}`.
- Wisdom total 10 (baseScore 10, featIncrease 0) → mod **+0**. Charisma total 21 → mod +5.
- **Expected tempHp = level 20 + chosen-ability (WIS) mod +0 = 20.**

## Observed (live E2E, localhost:5173)
1. Short Rest completed via sheet `button:has-text("Short Rest")` → Complete Short Rest (`short_rest` log entry confirmed). No Inspiring Leader prompt in rest modal (affordance = clickable "Bolstering Performance:" Special Actions row — acceptable manual-press model).
2. Row click → modal "Bolstering Performance": **"Each target gains 25 temporary hit points."** (should be 20).
3. Chose 5 incl. self; "Inspire (5)" gated ≤6 correctly. Popup: "Granted 25 temporary hit points to 5 creatures (HeroesFeastBard, AasimarTest, AberrantSorcerer, Disciplined_Monk, DivinationWizard)."
4. change-data persisted: `AasimarTest.tempHp=25, AberrantSorcerer.tempHp=25, Disciplined_Monk.tempHp=25, DivinationWizard.tempHp=25, HeroesFeastBard.tempHp=25`; Bandit 1 + all unchosen PCs have NO tempHp key (unchanged). Self-inclusion OK. `ability_use` log OK.
5. **Latch missing**: second row press same rest re-opened the chooser with no refusal/gate (RAW = once per Short/Long Rest).

## Root cause (grep + live module probe)
- `tempHpBuffHandler.js:98` calls `resolveFeatChosenAbility(action.name || 'Inspiring Leader', playerStats.featAbilityChoices)`.
- Runtime `action.name` is the benefit name **"Bolstering Performance"** (row label, log `abilityName`) — never "Inspiring Leader".
- `abilityLookup.js:34-42 resolveFeatChosenAbility` matches `key.startsWith(featName)`; choices key is **"Inspiring Leader-0"** → no prefix match → null → fallback `level + max(CHA,WIS) = 20+5 = 25`.
- Live probe (browser `import('/src/services/shared/abilityLookup.js')`):
  `resolveFeatChosenAbility('Bolstering Performance', {"Inspiring Leader-0":{assignment:"Wisdom"}})` → **null**; with `'Inspiring Leader'` → **"Wisdom"**.
- Secondary data gap (does not change expected = 20 here): feat ASI `featIncrease` never applied to Wisdom score (0) despite assignment — FT-001 twin (playbook §1322).

## Suggested fix
Resolve feat name for the benefit (e.g. pass featName through automation metadata, prefix-match reverse, or store `featName` on the collector action) so `resolveFeatChosenAbility` matches "Inspiring Leader-0"; add once-per-rest latch key (e.g. `<name>_inspiringLeaderRest`) cleared on rest completion.

## Lane confirmation
feats.json automation `{type:"temp_hp_buff", multiTargetAlly:true, targets:6, includesSelf:true}` → automationService INTERACTIVE (:46) → automation/index.js:334 → tempHpBuffHandler handleMultiTargetAllyTempHp (:41) → modal `bolsteringPerformanceTarget` → confirmBolsteringPerformance (:152) → tempHpService.setTempHp (replace-if-larger, runtime key `tempHp`).
