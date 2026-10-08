# bug-SP-091 — Prayer of Healing: short-rest benefits missing, once-per-long-rest latch is round-scoped, no remain-in-range/casting-time handling

Verdict: FAIL — core per-target 2d8 heal lane live-exact, but three canonical clauses wrong/unimplemented (playbook §1: unenforced gate / zero-consumer clause = FAIL).

## Expected Behavior (canonical, public/data/2024/spells.json lv2, 30 ft, 10 min, Abjuration)
"Up to five creatures of your choice who remain within range for the spell's entire casting gain the benefits of a Short Rest and also regain 2d8 Hit Points. A creature can't be affected by this spell again until that creature finishes a Long Rest."
Manifest row matches canonical (five creatures / 2d8; 5e twin = six / 2d8+mod).

## Actual Behavior (live 2026-10-07, War_Cleric lv20 2024 Cleric Trickery, test-campaign)
Works:
- Picker cap 5 enforced (6th checkbox refused); maxTargets 5 via massHealUtils.createMassHealHandler lane (prayerOfHealingTarget modal).
- Per-target independent 2d8: AasimarTest +11 [5,6], AberrantSorcerer +11 [7,4], Disciplined_Monk +13 [5,8], clamped-at-max zeros for Wizard/Paladin; lv2 slot 3→0 across 3 casts.
- Logs: spell (castingTime '10 min') + per-target hp_change formula '2d8'.

Defects:
1. **Short-rest benefits UNIMPLEMENTED** — no spell-slot/hit-dice/feature-use restore on affected targets (grep-zero consumers + live probe). Canonical clause "gain the benefits of a Short Rest" has zero delta.
2. **Latch wrong scope** — `prayerOfHealing_lastUsedRound_<Target>` is ROUND-scoped: round-3 recast HEALED same targets (+7/+12/+6). Key SURVIVES target Long Rest (grep-zero clear consumers) → never resets "until a Long Rest" in either direction.
3. **No remain-in-range / casting-time handling** — cast is instant in combat; live picker offers all 13 combatants (incl. Cloud Giant), zero range check; "remain within range for the spell's entire casting" unenforceable/unmodeled.
4. Minor: zero-refusal log on refused recast (no `prayer_of_healing_refused`).

## Steps to Reproduce
1. War_Cleric learns Prayer of Healing (step-14 checkbox→Save, 15s debounce).
2. Wound PCs via EB Cloud Giant Thunderous Mace chip; cast at 3 PCs → per-target 2d8 heals (works).
3. Recast same targets 2 rounds later → heals again (latch round-scoped).
4. Long Rest a healed target → recast → still refused/stale latch survives (never cleared on LR).
5. Inspect slots/hit dice post-cast → untouched (short-rest benefits absent).

## Likely Location
- `src/services/automation/handlers/**/massHealUtils.js` createMassHealHandler picker lane (real chain: executeSpellCast → createMassHealHandler; a second prayerOfHealingService auto-target lane at spellCastService/execution/index.js:328 did not fire live — dead/duplicate?).
- Latch key `prayerOfHealing_lastUsedRound_<T>` writer/reader (round stamp; needs longRest-cleared permanent latch + LONG_REST clear consumer).
- Short-rest benefit: none exists — needs shortRestService touch per target (hit dice pool restore per app short-rest model).

## Notes
- Zero-heal casts still consume slot (arguable; targets at max could refuse).
- Recipe: Cloud Giant mace chip = strong-damage wounding lane; mc-overlay absorbs initiative Next-clicks until self-closed; heal popup Done = `.dice-roll-reroll-btn`; picker checkboxes by aria-label.
