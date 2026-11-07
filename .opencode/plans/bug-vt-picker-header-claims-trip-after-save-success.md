# Bug: Versatile Trickster picker header says "Trip applied to X" even when X succeeded the primary Trip save

## Summary
When the Devious Strikes **Trip** option is used and the primary target **succeeds** its Dexterity
save (no Prone is granted — the eviction lane works), the Versatile Trickster secondary-target picker
still mounts with the header "**Trip applied to <primary>.** Versatile Trickster allows you to also
Trip another creature within 5 feet of the spectral hand:". The copy asserts a game state that the
engine just resolved as false. 82ded5c1c fixed exactly this self-contradiction species on the VT
*result* popup ("attempted… but X succeeded its Dexterity save — no trip"); the picker *header* copy
was left unconditional.

## Steps to reproduce
1. In test-campaign, sanctioned EF rig (2024 Rogue / Arcane Trickster lv20, playbook §7) vs
   ElderPaladin victim with a forced save-SUCCESS dial (`warding_bond saveBonus:+19`, playbook §7).
   Board needs a third creature (e.g. Disciplined_Monk) as the only VT secondary candidate.
2. Sheet-press Scimitar → HIT → DS chooser → tick **Trip** → Apply Effects.
3. Primary DEX save prompt: Roll Save → SAVE SUCCESS (e.g. "Total: 31 vs DC 15" live) → Done.
4. The VT picker overlay mounts — header reads "Trip applied to ElderPaladin." although EP just
   succeeded and gained no prone (verified: no prone in `ElderPaladin.activeConditions`, no te residue).
5. Resolve: tick Disciplined_Monk → "Trip Secondary Target" → DM saves → VT result popup uses the
   honest 82ded5c1c copy ("Trip attempted on Disciplined_Monk but … — no trip") — the header on the
   PREVIOUS overlay is the sole dishonest face.

## Expected behavior
On the primary-save-success face the picker must not claim a trip was applied. E.g. "Trip attempted
on ElderPaladin but ElderPaladin succeeded its Dexterity save (DC 15) — no trip. Versatile Trickster
still lets you Trip another creature within 5 feet of the spectral hand:" (offering VT when the
primary saves is accepted, documented behavior — DI 2026-11-07; only the copy is wrong).

## Actual behavior
Live 2026-11-07 (run DJ): EP DEX save 31 vs DC15 SUCCESS, then picker inner text:
`Versatile Trickster || Trip applied to ElderPaladin. Versatile Trickster allows you to also Trip another creature within 5 feet of the spectral hand: || Disciplined_Monk 300/300 HP (100%) | Trip Secondary Target | Skip`.

## Likely location (confident)
`src/components/char-sheet/modals/shared/AttackRiderModal.jsx` line ~89:
`description={`Trip applied to <b>${targetName}</b>. Versatile Trickster allows you to also Trip another creature within 5 feet of the spectral hand:`}`
— unconditional string; the caller (versatileTricksterHandler flow after `handleRiderSave` resolves)
already knows the primary save outcome but doesn't thread it into the modal.

## Suggested fix
Pass the primary save result (or a boolean) into the AttackRiderModal VT face and branch the
description, reusing the 82ded5c1c result-popup phrasing for the success face. Check the
versatileTricksterHandler call site that queues the picker to see where the primary `saveResult` is
still in scope (it is: the VT offer is processed after the primary save resolves in the same
hit-cycle).

## Severity
Minor UX issue. No state corruption (the save-success eviction lane is honest, the secondary leg
rolls its own save) — but the modal tells the GM a thing happened that the engine just logged as
"no effect", same self-contradiction class 82ded5c1c deemed worth fixing.
