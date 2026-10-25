# Approximate PES timing reference

Run `npm run timing:compare` to compare seeded Astra tests with public PES video.
Settings are unknown. Do not use these data as direct capture. The game, baseline,
and `npm run evaluate` contract do not change. Raw annotator notes, video, and
images are kept outside git. No hold-out video was measured.

The file keeps 12 pass-A events and adds 20 pass-B events. One lofted pass was
rejected because the pass metric requires ground passes. The total is 12 pass
flights, 11 control intervals, 6 turns, and 3 speed starts. The targets of 24
chains, 15 turns, and 15 speed starts are not met.

B measured 12 A windows again. Ten durations agree within the larger margin.
The c03 and c05 release selections differ. Keep A values in the summary and mark
these events low confidence. Both A turns also stay low confidence: B selected
different events or phases. Duration agreement does not confirm event identity.
B window values do not add summary samples.

Times use decoded PTS. Match frames use 256 units at time base 1/15360; training
frames use 1001 units at 1/30000. Frame indices start at zero. The validator checks
endpoints against each source frame map. Source bounds cover partial scans.
Use each event URL and PTS to repeat a check. Each margin adds two frame periods
and an ambiguity bound. It is not a statistical error. The range uses linear
sample quantiles: [max(0, p25 - median margin), p75 + median margin].

Astra uses seed 2017 and separate checkpoints. Turns end within 15 degrees of
the target. Speed ends at 95% of the final 30-tick mean, held for 15 ticks.
PES speed uses a visual plateau. The game pass test uses 10 m and requests a
return each tick after control. PES control includes decision and carry time.
Lengths, player skills, and conditions differ. Do not tune from these results.

The gap file records four differences: reversal and speed start are above range;
pass flight and control are below range. All five metrics have a reference.
Tests fail if the gap list or reference coverage no longer matches the results.
