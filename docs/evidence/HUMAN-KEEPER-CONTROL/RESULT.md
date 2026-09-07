# HUMAN-KEEPER-CONTROL — evidence record

- objective_id: HUMAN-KEEPER-CONTROL
- evidence_class: DYNAMIC_VISUAL
- record_sha256: 511d53df386ee634bf545abe19addfad10c419964055c2d579709ce3b2baabe0

## Hypothesis

In a human-vs-CPU small-sided match the human can take control of the team's designated keeper (the switch cycle already includes the keeper; the keeper role is live) and direct it: the CPU arc-hold positioning YIELDS to the human's directional input, while the keeper's save/claim reaction still answers a shot on target. When the human does not direct the keeper, the CPU keeper logic runs unchanged.

## Discriminating guards

- human_controllers_keeper: true (directed keeper player-10)
- human_directs_keeper: true
- human_directed_save_within_reach: true (save at 364, 1.0787 m off the keeper, within gk-small-sided-v1 reach)
- cpu_keeper_save_within_reach: true (save at 364, 1.1079 m)
- keeper_designation_unchanged: true
- save_contact_happened_in_both: true

## Fixture-driven disclosure

The run is driven (fixture initial state) so an on-target shot reliably reaches the keeper. It is disclosed: the shot is the shooting body's own canonical CPU SHOT press, never a scripted ball; the keeper's save/claim is the same FIRST_TOUCH action a human reaches through the keyboard, resolved by the contact system on the independent ball. The human's directional input enters ONLY through the tick-indexed InputFrame (CpuObservation.humanDirectedKeeperMove).

## Realization (explicit)

- is: human-directed keeper control (movement-direction channel over the designated keeper, with the keeper's save/claim reaction retained)
- how: the human's control slot on the designated keeper yields the CPU arc-hold positioning to the human's directional input (CpuObservation.humanDirectedKeeperMove) while the same production save/claim reaction still arms and answers an on-target shot; switching away lets the CPU keeper logic resume (the keeper slot's observation carries no human movement).
- not_a: a new world body or a change to team cardinality: the keeper is one of the bodies the scenario already ships, designated before kickoff (spec §4).
- designation: the adapter's designateKeeperFromLayout stays the source of truth; the human never becomes the designation — they direct the already-designated body.

## Standard-browser-wiring limitation (disclosed)

In the STANDARD 5v5 human-vs-CPU browser wiring the human's team keeper is the human's default controlled body (slot-1) and the CPU keeper adapter does not run for it, so the human directs the keeper through the movement controls and a save is the human positioning the body into the shot's path. The reliable human-directed save is demonstrated on the driven keeper-shot fixture, where the keeper slot runs the shared keeper logic with the human's movement injected.

## claims_not_made

- No PES 2017 fidelity / measured PES envelope claim.
- No FOUNDATION_LAB_PASS claim.
- No invented reference envelope or tolerance; the save/claim reach is the versioned gk-small-sided-v1 value read from eval/contracts/goalkeeper-config.ts.
- No claim that the human becomes the keeper designation — the adapter's designation (designateKeeperFromLayout) stays the source of truth and is unchanged.
- No claim that the human's team keeper auto-saves in the STANDARD 5v5 human-vs-CPU browser wiring: there the keeper body is the human's slot and the CPU keeper adapter does not run for it, so the human directs the keeper through the movement controls and any save is the human positioning it; the reliable human-directed save is demonstrated on the driven keeper-shot fixture where the keeper slot runs the shared keeper logic with the human's movement injected.
