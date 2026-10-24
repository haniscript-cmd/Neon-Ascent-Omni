import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hexToRgb,
  lighten,
  darken,
  withAlpha,
  buildExtendedScale,
  computeMelodicNotes,
  computeContextualSynthHarmony,
  getBiomeChordProgressions,
  pickBiomeChordProgression,
  computeFlowDynamicDifficulty,
  computeScatteredPlatformPlacement,
  getFlowMilestoneInfo,
  evaluateBeatTiming,
  calculateStyleRank,
  stepSquashStretch,
  shuffleArray,
  ParticlePool,
  computeBpmLockedKinematics,
  computeNoteDurationKinematics,
  getPlatformThemeColor,
  tickActivePowerUps,
  FLOW_THRESHOLDS,
  DEFAULT_CFG,
  MASTER_SCALES,
  SOUND_BANKS,
} from './rules';
import {
  CHARACTER_AVATARS,
  STARTER_UNLOCKED_AVATARS,
  getCharacterById,
} from './characters';
import {
  DEFAULT_BUILT_IN_STAGES,
  buildBiomePianoRollRows,
  compileStageForGameplay,
} from './stages';

test('Color manipulation utilities properly lighten and darken hex colors (Bug Fix #2)', () => {
  const rgbShort = hexToRgb('#0f0');
  assert.deepEqual(rgbShort, { r: 0, g: 255, b: 0 });

  const original = '#0080ff';
  const lighter = lighten(original, 0.5);
  assert.notEqual(lighter, original, 'lighten() must not return color unchanged');
  const lighterRgb = hexToRgb(lighter);
  assert.ok(lighterRgb.r > 0 && lighterRgb.g > 128, 'Lightened color channels should increase toward 255');

  const darker = darken(original, 0.5);
  const darkerRgb = hexToRgb(darker);
  assert.ok(darkerRgb.g < 128 && darkerRgb.b < 255, 'Darkened color channels should decrease toward 0');

  assert.equal(withAlpha('#ff0080', 0.5), 'rgba(255, 0, 128, 0.5)');
});

test('27 World/Modal Scales have 4 distinct 4-Gate Chord Progression variants per biome and doubled store prices', () => {
  assert.equal(MASTER_SCALES.length, 27, 'Should include 7 core + 20 new world/modal scales');
  assert.equal(SOUND_BANKS.length, 8, 'Should include 8 Lo-Fi, Cyberpunk, and CRT synth banks');
  assert.ok(DEFAULT_CFG.volMaster >= 0.8, 'Master volume default is boosted for strong audio output');
  assert.equal(DEFAULT_CFG.tiltControlEnabled, true, 'Android gravity/tilt steering is enabled by default');

  // Verify non-starter sound banks and scales have doubled Orb prices (>= 16 Orbs)
  const lockedBanks = SOUND_BANKS.filter((b) => b.costOrbs > 0);
  assert.ok(lockedBanks.every((b) => b.costOrbs >= 16), 'Sound bank prices are doubled');

  const lockedScales = MASTER_SCALES.filter((s) => s.costOrbs > 0);
  assert.ok(lockedScales.every((s) => s.costOrbs >= 12), 'World scale prices are doubled');

  for (const scaleBiome of MASTER_SCALES) {
    const progressions = getBiomeChordProgressions(scaleBiome);
    assert.equal(progressions.length, 4, `${scaleBiome.name} has 4 distinct chord progression variants`);

    const firstChordRoots = new Set(progressions.map((p) => p.chords[0][1]));
    assert.ok(firstChordRoots.size >= 3, `${scaleBiome.name} progressions start on diverse harmonic degrees`);

    for (let v = 0; v < 4; v++) {
      const picked = pickBiomeChordProgression(scaleBiome, v);
      assert.equal(picked.chordNames.length, 4);
      assert.equal(picked.chords.length, 4);
      for (const chord of picked.chords) {
        assert.equal(chord.length, 4, `${scaleBiome.name} variant ${v} chord has 4 voiced frequencies`);
      }
    }
  }
});

test('Context-Aware Harmonic Synthesizer evaluates current + 2 previous + 2 next platform notes for closest harmony', () => {
  const scale = MASTER_SCALES[0].scale;
  const singleVoice = computeContextualSynthHarmony(
    scale,
    {
      current: 261.63,
      prevTwo: [311.13, 392.0],
      nextTwo: [392.0, 523.25],
    },
    undefined,
    false
  );
  assert.equal(singleVoice.length, 1, 'Returns 1 synth voice at moderate Flow');
  assert.ok(singleVoice[0] > 100 && singleVoice[0] < 600, 'Synth note is in warm pad register');

  const nextStepVoice = computeContextualSynthHarmony(
    scale,
    {
      current: 261.63,
      prevTwo: [311.13, 392.0],
      nextTwo: [392.0, 523.25],
    },
    singleVoice[0],
    true
  );
  assert.equal(nextStepVoice.length, 2, 'Returns 2 complementary harmonic voices at high Flow');
  assert.notEqual(nextStepVoice[0], singleVoice[0], 'Shifts smoothly instead of droning on the identical pitch');
  assert.notEqual(nextStepVoice[0], nextStepVoice[1], 'Two synth voices form a true harmonic dyad');
});

test('Dynamic Flow-Driven Difficulty scales platform width at 1/5th rate while keeping speed and jump height constant', () => {
  const lowFlow = computeFlowDynamicDifficulty(0);
  const midFlow = computeFlowDynamicDifficulty(15);
  const highFlow = computeFlowDynamicDifficulty(45);

  assert.ok(
    lowFlow.targetPlatformWidth > midFlow.targetPlatformWidth &&
      midFlow.targetPlatformWidth > highFlow.targetPlatformWidth,
    'Platforms narrow progressively at 1/5th rate as Flow increases up to 45'
  );
  assert.equal(
    lowFlow.stepY,
    highFlow.stepY,
    'Vertical platform spacing (jump height requirement) stays constant throughout the game'
  );
  assert.equal(
    lowFlow.paceMultiplier,
    highFlow.paceMultiplier,
    'Simulation speed stays constant throughout the game'
  );
  assert.equal(
    lowFlow.moveSpeedPxPerSec,
    highFlow.moveSpeedPxPerSec,
    'Horizontal move speed stays constant throughout the game'
  );
  assert.equal(lowFlow.platformHazardChance, 0, 'Low Flow has 0 hazard chance');
  assert.ok(highFlow.platformHazardChance > 0.15, 'High Flow spawns platform hazards');
  assert.ok(highFlow.aerialHazardChance > 0.15, 'High Flow spawns aerial obstacles');
});

test('Duration-Proportional Jump Kinematics locks flightDurationSec 1:1 to beat duration while keeping long-note apex clearance tight so platforms are never skipped', () => {
  const bpm = 120; // 1 beat = 0.5s
  const oneBeat = computeNoteDurationKinematics(bpm, 1.0);
  const twoBeats = computeNoteDurationKinematics(bpm, 2.0);
  const fourBeats = computeNoteDurationKinematics(bpm, 4.0);
  const halfBeat = computeNoteDurationKinematics(bpm, 0.5);
  const dottedHalfBeat = computeNoteDurationKinematics(bpm, 0.75);

  assert.equal(oneBeat.flightDurationSec, 0.5);
  assert.equal(twoBeats.flightDurationSec, 1.0);
  assert.equal(fourBeats.flightDurationSec, 2.0);
  assert.equal(halfBeat.flightDurationSec, 0.25);
  assert.ok(Math.abs(dottedHalfBeat.flightDurationSec - 0.375) < 0.001);

  assert.ok(
    twoBeats.stepY > oneBeat.stepY && twoBeats.stepY <= 220,
    `Long notes have damped vertical stepY (${twoBeats.stepY}px) so they never overshoot or skip platforms`
  );
  assert.ok(
    fourBeats.apexHeight - fourBeats.stepY <= 36,
    `4-beat long notes have tight apex clearance (${fourBeats.apexHeight - fourBeats.stepY}px) above the target platform`
  );
  assert.ok(halfBeat.stepY < dottedHalfBeat.stepY && dottedHalfBeat.stepY < oneBeat.stepY, 'Short notes scale stepY down smoothly below 1-beat');

  // Verify physics trajectory lands at exact -stepY at t = flightDurationSec for all note durations
  for (const k of [oneBeat, twoBeats, fourBeats, halfBeat, dottedHalfBeat]) {
    const t = k.flightDurationSec;
    const yAtLanding = k.jumpVelocityPxPerSec * t + 0.5 * k.gravityPxPerSec2 * t * t;
    assert.ok(
      Math.abs(yAtLanding - -k.stepY) < 0.5,
      `Duration ${k.beatDurationRatio}B lands at exact -stepY (${yAtLanding} vs ${-k.stepY})`
    );
  }
});

test('24 Reactive-Eye Character Avatars include 3 free starters (Circle, Triangle, Square), Gold tier, and 7-Color Rainbow tier with perks', () => {
  assert.equal(CHARACTER_AVATARS.length, 24, '8 geometric shapes across Standard, Gold, and Rainbow tiers');
  assert.deepEqual(STARTER_UNLOCKED_AVATARS, ['circle', 'triangle', 'square']);

  for (const starterId of STARTER_UNLOCKED_AVATARS) {
    const def = getCharacterById(starterId);
    assert.equal(def.costOrbs, 0, `${starterId} starter avatar is free`);
    assert.equal(def.tier, 'standard');
  }

  const goldCircle = getCharacterById('circle_gold');
  assert.equal(goldCircle.tier, 'gold');
  assert.ok(goldCircle.costOrbs >= 1000);
  assert.ok(goldCircle.perks.bonusMagnetRadiusPx > 0 && goldCircle.perks.doubleOrbChance > 0);

  const rainbowHex = getCharacterById('hexagon_rainbow');
  assert.equal(rainbowHex.tier, 'rainbow');
  assert.ok(rainbowHex.costOrbs >= 2000);
  assert.equal(rainbowHex.perks.chordGateDoublePowerUp, true);
});

test('DAW Stage Compiler filters bars by Flow activation range, supports per-bar Biome Key overrides, and preserves note beat durations', () => {
  const rows = buildBiomePianoRollRows(MASTER_SCALES[0]);
  assert.equal(rows.length, 35, '5 octaves x 7 scale degrees = 35 pitch rows in Piano Roll');

  const stage = {
    ...DEFAULT_BUILT_IN_STAGES[0],
    barFlowRules: [
      { barIndex: 0, minFlow: 0, maxFlow: 45, biomeId: 0 },
      { barIndex: 1, minFlow: 0, maxFlow: 45, biomeId: 2 },
      { barIndex: 2, minFlow: 3, maxFlow: 45, biomeId: 6 },
      { barIndex: 3, minFlow: 3, maxFlow: 45, biomeId: 6 },
    ],
  };
  const lowFlowSteps = compileStageForGameplay(stage, 0);
  const highFlowSteps = compileStageForGameplay(stage, 6);

  assert.ok(lowFlowSteps.length > 0, 'Compiles playable steps at Flow x0');
  assert.ok(
    highFlowSteps.length > lowFlowSteps.length,
    'Higher Flow activates additional bars configured with minFlow >= 3'
  );
  assert.ok(
    lowFlowSteps.some((s) => s.biomeId === 0) && lowFlowSteps.some((s) => s.biomeId === 2),
    'Compiles per-bar biomeId independently for Bar 1 and Bar 2'
  );
  assert.ok(
    lowFlowSteps.some((s) => s.durationBeats !== 1.0 || s.synthFreqs.length > 0),
    'Preserves custom note durations and Channel 2 Synth Pad notes'
  );
});

test('Multi-octave melodic composer avoids short loops, rotates phrase archetypes, & respects CFG.volChords', () => {
  const scale = MASTER_SCALES[0].scale;
  const ext = buildExtendedScale(scale);
  assert.ok(ext.length >= 20, 'Extended scale spans 3+ octaves');

  const tier1 = computeMelodicNotes(scale, 1, 1, DEFAULT_CFG);
  assert.equal(tier1.length, 1);

  const tier2 = computeMelodicNotes(scale, FLOW_THRESHOLDS.HARMONIC, 2, DEFAULT_CFG);
  assert.equal(tier2.length, 2);

  const tier3 = computeMelodicNotes(scale, FLOW_THRESHOLDS.CHORD, 3, DEFAULT_CFG, 10);
  assert.equal(tier3.length, 3);

  const tier3MutedChords = computeMelodicNotes(
    scale,
    FLOW_THRESHOLDS.CHORD,
    3,
    {
      ...DEFAULT_CFG,
      volChords: 0,
    },
    10
  );
  assert.equal(tier3MutedChords.length, 2);

  const tier4 = computeMelodicNotes(scale, FLOW_THRESHOLDS.OVERDRIVE, 5, DEFAULT_CFG, 12);
  assert.equal(tier4.length, 4);

  const leadNotes: number[] = [];
  let prevIdx = 10;
  for (let s = 1; s <= 24; s++) {
    const notes = computeMelodicNotes(scale, FLOW_THRESHOLDS.OVERDRIVE, s, DEFAULT_CFG, prevIdx);
    leadNotes.push(Math.round(notes[0]));
    const idx = ext.findIndex((f) => Math.abs(f - notes[0]) < 1);
    if (idx >= 0) prevIdx = idx;
  }
  const uniqueFrequencies = new Set(leadNotes);
  assert.ok(uniqueFrequencies.size >= 8, `Expected at least 8 distinct melodic notes over 24 steps, got ${uniqueFrequencies.size}`);
  const minFreq = Math.min(...leadNotes);
  const maxFreq = Math.max(...leadNotes);
  assert.ok(maxFreq / minFreq >= 1.8, 'High Flow melodies span wide multi-octave intervals');
});

test('Single-platform-per-row scattered placement prevents vertical stacking and guarantees distinct rows', () => {
  let prevCenterX = 300;
  let prevY = 782;
  for (let i = 1; i <= 25; i++) {
    const placed = computeScatteredPlatformPlacement(prevCenterX, prevY, 134, 130, 4, i);
    const horizSeparation = Math.abs(placed.centerX - prevCenterX);
    assert.ok(
      horizSeparation >= 68,
      `Platform ${i} must be horizontally scattered (got delta=${horizSeparation})`
    );
    assert.ok(placed.y < prevY - 100, 'Each row has strictly one platform separated vertically');
    prevCenterX = placed.centerX;
    prevY = placed.y;
  }
});

test('1/5th scaled Flow milestone progression computes accurate targets and percentages', () => {
  const m1 = getFlowMilestoneInfo(1, 2);
  assert.equal(m1.currentTier, 1);
  assert.equal(m1.nextThreshold, FLOW_THRESHOLDS.HARMONIC);
  assert.ok(m1.progressPct > 30 && m1.progressPct < 60);

  const m2 = getFlowMilestoneInfo(4, 0);
  assert.equal(m2.currentTier, 2);
  assert.equal(m2.nextThreshold, FLOW_THRESHOLDS.SUBDIVISION);

  const m4 = getFlowMilestoneInfo(13, 0);
  assert.equal(m4.currentTier, 5);
  assert.equal(m4.nextThreshold, 15);
});

test('ParticlePool updates and recycles particles without array splicing (Bug Fix #3)', () => {
  const pool = new ParticlePool(32);
  assert.equal(pool.activeCount(), 0);

  pool.burst(100, 200, '#00ff88', 12, 5, 'spark');
  assert.equal(pool.activeCount(), 12);

  for (let i = 0; i < 60; i++) {
    pool.update(1 / 60);
  }
  assert.equal(pool.activeCount(), 0);
  assert.equal(pool.items.length, 32, 'Pool array length never mutates');
});

test('Jump kinematics computes smooth flight arc and generous platform step', () => {
  const kin = computeBpmLockedKinematics(120, 1.0);
  assert.equal(kin.beatDurationSec, 0.5);
  assert.ok(kin.stepY >= 130, 'Platform vertical spacing is generous and optimal');

  const t = kin.beatDurationSec;
  const yAtBeat = kin.jumpVelocityPxPerSec * t + 0.5 * kin.gravityPxPerSec2 * t * t;
  const vyAtBeat = kin.jumpVelocityPxPerSec + kin.gravityPxPerSec2 * t;

  assert.ok(Math.abs(yAtBeat - (-kin.stepY)) < 0.01, 'Player lands at exact platform height -stepY');
  assert.ok(vyAtBeat > 0, 'Player is descending onto the platform at landing time');
});

test('Cohesive biome platform colors stay within the biome palette family', () => {
  const neonBiome = MASTER_SCALES[0];
  const normalCol = hexToRgb(getPlatformThemeColor(neonBiome, 'normal', true, '#00ff88'));
  const bounceCol = hexToRgb(getPlatformThemeColor(neonBiome, 'bounce', true, '#00ff88'));
  const gateCol = hexToRgb(getPlatformThemeColor(neonBiome, 'chord_gate', true, '#00ff88'));

  assert.ok(normalCol.g > normalCol.r && normalCol.g > normalCol.b);
  assert.ok(bounceCol.g >= bounceCol.r && bounceCol.g >= bounceCol.b);
  assert.ok(gateCol.g >= gateCol.r);
});

test('Temporary power-ups count down and expire automatically, and shuffleArray preserves elements', () => {
  const initial = [
    { id: 'orb_magnet' as const, name: 'MAGNET', icon: '◎', remainingSec: 5.0, durationSec: 15.0 },
  ];
  const after2s = tickActivePowerUps(initial, 2.0);
  assert.equal(after2s.length, 1);
  assert.ok(Math.abs(after2s[0].remainingSec - 3.0) < 0.001);

  const after6s = tickActivePowerUps(after2s, 4.0);
  assert.equal(after6s.length, 0, 'Power-up expires once remaining time reaches 0');

  const arr = [0, 1, 2, 6, 10, 17];
  const shuffled = shuffleArray(arr);
  assert.equal(shuffled.length, arr.length);
  assert.deepEqual([...shuffled].sort((a, b) => a - b), [...arr].sort((a, b) => a - b));
});

test('Beat timing evaluator and Style Rank grading compute accurate states', () => {
  const onBeat = evaluateBeatTiming(1.01, 120);
  assert.equal(onBeat.isOnBeat, true);
  assert.equal(onBeat.label, 'PERFECT SYNC');

  const offBeat = evaluateBeatTiming(1.25, 120);
  assert.equal(offBeat.isOnBeat, false);
  assert.equal(offBeat.label, null);

  assert.equal(calculateStyleRank(0, 0).rank, 'D');
  assert.equal(calculateStyleRank(FLOW_THRESHOLDS.SUBDIVISION, 15).rank, 'A');
  assert.equal(calculateStyleRank(FLOW_THRESHOLDS.OVERDRIVE, 80).rank, 'OMNI');
});

test('Squash and stretch spring-damper converges smoothly back to 1.0', () => {
  const step1 = stepSquashStretch(1.35, 0.65, 1 / 60);
  assert.ok(step1.scaleX < 1.35 && step1.scaleX > 1.0);
  assert.ok(step1.scaleY > 0.65 && step1.scaleY < 1.0);
});
