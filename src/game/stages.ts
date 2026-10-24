/**
 * Custom & Built-In Stage System, Multi-Octave DAW Piano Roll Helpers,
 * Per-Bar Flow Range Filtering, Synth Channel Events, and MIDI-to-Stage Parser
 * with Exact Note Beat Durations for NEON ASCENT: OMNI.
 */

import { MASTER_SCALES, ScaleBiome } from './rules';

export interface StageNoteEvent {
  id: string;
  step: number;          // Grid step index (1 step = 0.25 beats / 16th note, or 0.5 beats; we use 1 step = 0.5 beats so 8 steps = 1 bar of 4 beats, or 0.25 beat resolution)
  freq: number;          // Frequency in Hz
  noteName: string;      // e.g. 'C4', 'Eb5'
  durationBeats: number; // e.g. 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0
}

export interface StageSynthEvent {
  id: string;
  step: number;
  freq: number;
  noteName: string;
  durationBeats: number;
}

export interface StageBarFlowRule {
  barIndex: number; // 0-indexed bar (each bar = 4 beats = 8 half-beat grid columns)
  minFlow: number;  // Minimum Flow combo for this bar/block to be active (default 0)
  maxFlow: number;  // Maximum Flow combo for this bar/block to be active (default 45)
  biomeId?: number; // Independent Biome Key per bar (defaults to stage.biomeId)
}

export interface CustomStage {
  id: string;
  name: string;
  author: string;
  isBuiltIn?: boolean;
  biomeId: number;
  soundBankId: string;
  bpm: number;
  totalSteps: number; // In half-beat grid columns (e.g., 32 steps = 4 bars = 16 beats)
  notes: StageNoteEvent[];
  synthNotes: StageSynthEvent[];
  barFlowRules: StageBarFlowRule[];
  createdAt: number;
}

export interface PianoRollPitchRow {
  freq: number;
  noteName: string;
  octave: number;
  isRoot: boolean;
}

export interface CompiledStageStep {
  stepIndex: number;
  barIndex: number;
  biomeId: number;
  minFlow: number;
  maxFlow: number;
  label: string;
  freqs: number[];
  noteNames: string[];
  durationBeats: number; // Exact beat duration governing platform distance & jump power!
  synthFreqs: number[];
  synthDurationBeats: number;
}

export const STEPS_PER_BEAT = 2; // Each grid column = 0.5 beats (eighth note), 8 columns = 1 bar (4 beats)
export const STEPS_PER_BAR = 8;

export const AVAILABLE_NOTE_DURATIONS: Array<{ label: string; beats: number }> = [
  { label: '1/4B (0.25x)', beats: 0.25 },
  { label: '1/2B (0.5x)', beats: 0.5 },
  { label: '3/4B (0.75x)', beats: 0.75 },
  { label: '1B (1.0x)', beats: 1.0 },
  { label: '1.5B (1.5x)', beats: 1.5 },
  { label: '2B (2.0x)', beats: 2.0 },
  { label: '3B (3.0x)', beats: 3.0 },
  { label: '4B (4.0x)', beats: 4.0 },
];

export function getBiomeForBar(stage: CustomStage, barIndex: number): ScaleBiome {
  const rule = (stage.barFlowRules || []).find((r) => r.barIndex === barIndex);
  const targetId = rule?.biomeId !== undefined ? rule.biomeId : stage.biomeId;
  return MASTER_SCALES.find((b) => b.id === targetId) || MASTER_SCALES[0];
}

/**
 * Builds a wide 4-octave pitch ladder (from low Octave 2 up to high Octave 6)
 * specifically tailored to the selected Biome's musical scale!
 * Ordered from highest pitch (top of Piano Roll) to lowest pitch (bottom of Piano Roll).
 */
export function buildBiomePianoRollRows(biome: ScaleBiome): PianoRollPitchRow[] {
  const baseScale = biome.scale.length >= 5 ? biome.scale : MASTER_SCALES[0].scale;
  const baseNames = biome.noteNames.length >= 5 ? biome.noteNames : MASTER_SCALES[0].noteNames;

  // Strip duplicate top octave root if the 8-note scale ends on 2*scale[0]
  const hasOctaveDup =
    baseScale.length > 2 &&
    Math.abs(baseScale[baseScale.length - 1] - baseScale[0] * 2) < 6;
  const coreFreqs = hasOctaveDup ? baseScale.slice(0, -1) : baseScale;
  const coreNames = hasOctaveDup ? baseNames.slice(0, -1) : baseNames;

  const octaveMultipliers = [
    { mult: 0.25, octShift: -2 },
    { mult: 0.5, octShift: -1 },
    { mult: 1.0, octShift: 0 },
    { mult: 2.0, octShift: 1 },
    { mult: 4.0, octShift: 2 },
  ];

  const rows: PianoRollPitchRow[] = [];
  for (const { mult, octShift } of octaveMultipliers) {
    for (let i = 0; i < coreFreqs.length; i++) {
      const f = Number((coreFreqs[i] * mult).toFixed(2));
      if (f < 55 || f > 2100) continue;
      const rawName = coreNames[i] || 'C4';
      const match = rawName.match(/^([A-G][#b~]?)(\d+)$/);
      let noteName = rawName;
      let octave = 4 + octShift;
      if (match) {
        octave = Math.max(1, parseInt(match[2], 10) + octShift);
        noteName = `${match[1]}${octave}`;
      }
      if (rows.some((r) => Math.abs(r.freq - f) < 3.5 || r.noteName === noteName)) {
        continue;
      }
      rows.push({
        freq: f,
        noteName,
        octave,
        isRoot: i === 0,
      });
    }
  }

  // Sort high to low for standard DAW Piano Roll vertical layout
  rows.sort((a, b) => b.freq - a.freq);
  return rows;
}

/**
 * Compiles a CustomStage into an ordered sequence of playable platform steps,
 * filtering by the player's current Flow combo (using each Bar's [minFlow, maxFlow] range),
 * resolving each Bar's independent `biomeId`, and calculating the exact beat duration (`durationBeats`)
 * so platform spacing and flight time match the musical note lengths 1:1.
 */
export function compileStageForGameplay(
  stage: CustomStage,
  currentFlow = 0
): CompiledStageStep[] {
  const rulesMap = new Map<number, StageBarFlowRule>();
  (stage.barFlowRules || []).forEach((r) => rulesMap.set(r.barIndex, r));

  const sortedNotes = [...stage.notes].sort((a, b) => a.step - b.step || a.freq - b.freq);
  if (sortedNotes.length === 0) {
    const biome = getBiomeForBar(stage, 0);
    return biome.scale.slice(0, 4).map((f, idx) => ({
      stepIndex: idx * 2,
      barIndex: 0,
      biomeId: biome.id,
      minFlow: 0,
      maxFlow: 45,
      label: biome.noteNames[idx] || 'C4',
      freqs: [f],
      noteNames: [biome.noteNames[idx] || 'C4'],
      durationBeats: 1.0,
      synthFreqs: [biome.scale[0] * 0.5],
      synthDurationBeats: 2.0,
    }));
  }

  // Group notes that trigger on the exact same step into chords/clusters
  const stepGroups = new Map<number, StageNoteEvent[]>();
  for (const n of sortedNotes) {
    const list = stepGroups.get(n.step) || [];
    list.push(n);
    stepGroups.set(n.step, list);
  }

  const allStepIndices = Array.from(stepGroups.keys()).sort((a, b) => a - b);

  // Filter steps whose bar matches currentFlow (fallback to all steps if none match)
  const matchingStepIndices = allStepIndices.filter((stepIdx) => {
    const barIdx = Math.floor(stepIdx / STEPS_PER_BAR);
    const rule = rulesMap.get(barIdx);
    if (!rule) return true;
    return currentFlow >= rule.minFlow && currentFlow <= rule.maxFlow;
  });

  const activeSteps = matchingStepIndices.length > 0 ? matchingStepIndices : allStepIndices;
  const compiled: CompiledStageStep[] = [];

  for (let i = 0; i < activeSteps.length; i++) {
    const stepIdx = activeSteps[i];
    const events = stepGroups.get(stepIdx) || [];
    const barIdx = Math.floor(stepIdx / STEPS_PER_BAR);
    const rule = rulesMap.get(barIdx) || {
      barIndex: barIdx,
      minFlow: 0,
      maxFlow: 45,
      biomeId: stage.biomeId,
    };
    const barBiomeId = rule.biomeId !== undefined ? rule.biomeId : stage.biomeId;

    const primaryDurationBeats = Math.max(
      0.25,
      Math.min(4.0, Math.max(...events.map((e) => e.durationBeats || 1.0)))
    );

    const matchingSynths = (stage.synthNotes || []).filter(
      (sn) => Math.abs(sn.step - stepIdx) < 1
    );

    const noteNames = events.map((e) => e.noteName);
    compiled.push({
      stepIndex: stepIdx,
      barIndex: barIdx,
      biomeId: barBiomeId,
      minFlow: rule.minFlow,
      maxFlow: rule.maxFlow,
      label: noteNames.slice(0, 2).join('+'),
      freqs: events.map((e) => e.freq),
      noteNames,
      durationBeats: Number(primaryDurationBeats.toFixed(2)),
      synthFreqs: matchingSynths.map((s) => s.freq),
      synthDurationBeats:
        matchingSynths.length > 0
          ? Math.max(...matchingSynths.map((s) => s.durationBeats || 2.0))
          : 2.0,
    });
  }

  return compiled;
}

/**
 * Helper to convert MIDI note number (0..127) to note name (e.g. 60 -> 'C4') and frequency.
 */
const MIDI_NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export function midiNoteToNameAndFreq(midi: number): { freq: number; noteName: string } {
  const clamped = Math.max(24, Math.min(108, Math.round(midi)));
  const freq = Number((440 * Math.pow(2, (clamped - 69) / 12)).toFixed(2));
  const octave = Math.floor(clamped / 12) - 1;
  const name = MIDI_NOTE_NAMES[clamped % 12] || 'C';
  return { freq, noteName: `${name}${octave}` };
}

/**
 * Parses a Standard MIDI File (SMF) binary buffer into a full CustomStage,
 * extracting note pitches, step positions, and exact beat durations (0.25, 0.5, 0.75, 1.0, 1.5, 2.0, etc.).
 */
export function parseMidiBufferToStage(
  arrayBuffer: ArrayBuffer,
  fileName = 'Imported MIDI Stage',
  biomeId = 0,
  soundBankId = 'crt_velvet'
): CustomStage {
  const bytes = new Uint8Array(arrayBuffer);
  const notes: StageNoteEvent[] = [];

  // Read SMF header division (ticks per quarter-note beat) if valid MThd header
  let ticksPerBeat = 480;
  if (
    bytes.length > 14 &&
    bytes[0] === 0x4d &&
    bytes[1] === 0x54 &&
    bytes[2] === 0x68 &&
    bytes[3] === 0x64
  ) {
    const div = (bytes[12] << 8) | bytes[13];
    if (div > 0 && (div & 0x8000) === 0) {
      ticksPerBeat = div;
    }
  }

  // Parse MTrk chunks with delta-time ticks so we get real note-on / note-off beat durations!
  let pos = 0;
  const rawEvents: Array<{ beatStart: number; beatDuration: number; midi: number }> = [];

  while (pos < bytes.length - 8) {
    if (
      bytes[pos] === 0x4d &&
      bytes[pos + 1] === 0x54 &&
      bytes[pos + 2] === 0x72 &&
      bytes[pos + 3] === 0x6b
    ) {
      const trackLen =
        (bytes[pos + 4] << 24) |
        (bytes[pos + 5] << 16) |
        (bytes[pos + 6] << 8) |
        bytes[pos + 7];
      let tPos = pos + 8;
      const trackEnd = Math.min(bytes.length, tPos + trackLen);
      let currentTick = 0;
      let runningStatus = 0;
      const activeNoteOnTick = new Map<number, number>();

      while (tPos < trackEnd) {
        // Read variable-length delta time
        let delta = 0;
        while (tPos < trackEnd) {
          const b = bytes[tPos++];
          delta = (delta << 7) | (b & 0x7f);
          if ((b & 0x80) === 0) break;
        }
        currentTick += delta;

        if (tPos >= trackEnd) break;
        let status = bytes[tPos];
        if (status < 0x80) {
          status = runningStatus;
        } else {
          tPos++;
          if (status < 0xf0) runningStatus = status;
        }

        const cmd = status & 0xf0;
        if (cmd === 0x90 && tPos + 1 < trackEnd) {
          const note = bytes[tPos++];
          const vel = bytes[tPos++];
          if (vel > 0) {
            activeNoteOnTick.set(note, currentTick);
          } else {
            const startTick = activeNoteOnTick.get(note);
            if (startTick !== undefined) {
              const durBeats = Math.max(0.25, (currentTick - startTick) / ticksPerBeat);
              rawEvents.push({
                beatStart: startTick / ticksPerBeat,
                beatDuration: durBeats,
                midi: note,
              });
              activeNoteOnTick.delete(note);
            }
          }
        } else if (cmd === 0x80 && tPos + 1 < trackEnd) {
          const note = bytes[tPos++];
          tPos++; // velocity
          const startTick = activeNoteOnTick.get(note);
          if (startTick !== undefined) {
            const durBeats = Math.max(0.25, (currentTick - startTick) / ticksPerBeat);
            rawEvents.push({
              beatStart: startTick / ticksPerBeat,
              beatDuration: durBeats,
              midi: note,
            });
            activeNoteOnTick.delete(note);
          }
        } else if (cmd === 0xa0 || cmd === 0xb0 || cmd === 0xe0) {
          tPos += 2;
        } else if (cmd === 0xc0 || cmd === 0xd0) {
          tPos += 1;
        } else if (status === 0xff && tPos < trackEnd) {
          tPos++; // meta type
          let metaLen = 0;
          while (tPos < trackEnd) {
            const b = bytes[tPos++];
            metaLen = (metaLen << 7) | (b & 0x7f);
            if ((b & 0x80) === 0) break;
          }
          tPos += metaLen;
        } else if (status === 0xf0 || status === 0xf7) {
          let sysexLen = 0;
          while (tPos < trackEnd) {
            const b = bytes[tPos++];
            sysexLen = (sysexLen << 7) | (b & 0x7f);
            if ((b & 0x80) === 0) break;
          }
          tPos += sysexLen;
        } else {
          tPos++;
        }
      }
      pos = trackEnd;
    } else {
      pos++;
    }
  }

  rawEvents.sort((a, b) => a.beatStart - b.beatStart || b.midi - a.midi);

  // Quantize durations to musical beat ratios (0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0)
  const quantizeBeatDuration = (rawBeats: number): number => {
    const allowed = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0];
    let best = 1.0;
    let minDiff = Infinity;
    for (const cand of allowed) {
      const d = Math.abs(rawBeats - cand);
      if (d < minDiff) {
        minDiff = d;
        best = cand;
      }
    }
    return best;
  };

  if (rawEvents.length > 0) {
    const firstBeat = rawEvents[0].beatStart;
    const limited = rawEvents.slice(0, 96);
    for (let i = 0; i < limited.length; i++) {
      const ev = limited[i];
      const relBeat = Math.max(0, ev.beatStart - firstBeat);
      const step = Math.round(relBeat * STEPS_PER_BEAT);
      // Also consider inter-onset time to next distinct note if note-off was very short staccato
      let effectiveBeats = ev.beatDuration;
      if (i + 1 < limited.length) {
        const ioiBeats = limited[i + 1].beatStart - ev.beatStart;
        if (ioiBeats >= 0.25 && ioiBeats <= 4.0) {
          effectiveBeats = Math.max(ev.beatDuration, ioiBeats);
        }
      }
      const { freq, noteName } = midiNoteToNameAndFreq(ev.midi);
      notes.push({
        id: `midi_${i}_${step}`,
        step,
        freq,
        noteName,
        durationBeats: quantizeBeatDuration(effectiveBeats),
      });
    }
  } else {
    // Fallback byte scan if non-standard MIDI stream
    let stepCursor = 0;
    for (let i = 0; i < bytes.length - 2 && notes.length < 64; i++) {
      if ((bytes[i] & 0xf0) === 0x90) {
        const m = bytes[i + 1];
        const v = bytes[i + 2];
        if (m >= 24 && m <= 108 && v > 0 && v < 128) {
          const { freq, noteName } = midiNoteToNameAndFreq(m);
          notes.push({
            id: `raw_${i}`,
            step: stepCursor,
            freq,
            noteName,
            durationBeats: 1.0,
          });
          stepCursor += 2;
          i += 2;
        }
      }
    }
  }

  const maxStep = notes.reduce((acc, n) => Math.max(acc, n.step + 4), 32);
  const totalSteps = Math.max(32, Math.ceil(maxStep / STEPS_PER_BAR) * STEPS_PER_BAR);
  const totalBars = Math.ceil(totalSteps / STEPS_PER_BAR);

  return {
    id: `stage_midi_${Date.now()}`,
    name: fileName.replace(/\.(mid|midi)$/i, '').slice(0, 28) || 'MIDI Stage',
    author: 'Developer MIDI',
    biomeId,
    soundBankId,
    bpm: 104,
    totalSteps,
    notes,
    synthNotes: [],
    barFlowRules: Array.from({ length: totalBars }, (_, barIndex) => ({
      barIndex,
      minFlow: 0,
      maxFlow: 45,
    })),
    createdAt: Date.now(),
  };
}

/**
 * Default Built-In Stages shipped with NEON ASCENT: OMNI
 * Featuring variable note durations (0.5x, 0.75x, 1.0x, 1.5x, 2.0x beats),
 * multi-octave melodies, Synth Pad Channel accompaniment, and Per-Bar Flow Rules.
 */
export const DEFAULT_BUILT_IN_STAGES: CustomStage[] = [
  {
    id: 'builtin_neon_odyssey',
    name: '01 · Neon Odyssey (C Minor 9)',
    author: 'Omni Core',
    isBuiltIn: true,
    biomeId: 0, // NEON GRID
    soundBankId: 'crt_velvet',
    bpm: 102,
    totalSteps: 32, // 4 Bars
    notes: [
      // Bar 1 (Flow 0-45): Standard 1-beat & 0.5-beat syncopation
      { id: 'n1', step: 0, freq: 261.63, noteName: 'C4', durationBeats: 1.0 },
      { id: 'n2', step: 2, freq: 311.13, noteName: 'Eb4', durationBeats: 1.0 },
      { id: 'n3', step: 4, freq: 392.0, noteName: 'G4', durationBeats: 0.5 },
      { id: 'n4', step: 5, freq: 466.16, noteName: 'Bb4', durationBeats: 0.5 },
      { id: 'n5', step: 6, freq: 523.25, noteName: 'C5', durationBeats: 1.0 },
      // Bar 2 (Flow 0-45): 2-beat high leap + 0.75-beat rhythmic steps
      { id: 'n6', step: 8, freq: 587.33, noteName: 'D5', durationBeats: 2.0 },
      { id: 'n7', step: 12, freq: 523.25, noteName: 'C5', durationBeats: 0.75 },
      { id: 'n8', step: 14, freq: 392.0, noteName: 'G4', durationBeats: 1.0 },
      // Bar 3 (Flow 0-45): Deep octave drop & climb
      { id: 'n9', step: 16, freq: 207.65, noteName: 'Ab3', durationBeats: 1.5 },
      { id: 'n10', step: 19, freq: 261.63, noteName: 'C4', durationBeats: 0.5 },
      { id: 'n11', step: 20, freq: 349.23, noteName: 'F4', durationBeats: 1.0 },
      { id: 'n12', step: 22, freq: 415.3, noteName: 'Ab4', durationBeats: 1.0 },
      // Bar 4 (High Flow Climax Bar): Wide 2-beat & 1-beat cadence
      { id: 'n13', step: 24, freq: 783.99, noteName: 'G5', durationBeats: 2.0 },
      { id: 'n14', step: 28, freq: 622.25, noteName: 'Eb5', durationBeats: 1.0 },
      { id: 'n15', step: 30, freq: 523.25, noteName: 'C5', durationBeats: 1.0 },
    ],
    synthNotes: [
      { id: 's1', step: 0, freq: 130.81, noteName: 'C3', durationBeats: 4.0 },
      { id: 's2', step: 8, freq: 155.56, noteName: 'Eb3', durationBeats: 4.0 },
      { id: 's3', step: 16, freq: 174.61, noteName: 'F3', durationBeats: 4.0 },
      { id: 's4', step: 24, freq: 196.0, noteName: 'G3', durationBeats: 4.0 },
    ],
    barFlowRules: [
      { barIndex: 0, minFlow: 0, maxFlow: 45 },
      { barIndex: 1, minFlow: 0, maxFlow: 45 },
      { barIndex: 2, minFlow: 0, maxFlow: 45 },
      { barIndex: 3, minFlow: 2, maxFlow: 45 },
    ],
    createdAt: 1700000001000,
  },
  {
    id: 'builtin_kyoto_shrine',
    name: '02 · Cyber Zen Protocol (Hirajoshi)',
    author: 'Omni Core',
    isBuiltIn: true,
    biomeId: 6, // CYBER ZEN
    soundBankId: 'rainy_shibuya',
    bpm: 96,
    totalSteps: 32,
    notes: [
      { id: 'k1', step: 0, freq: 220.0, noteName: 'A3', durationBeats: 1.0 },
      { id: 'k2', step: 2, freq: 261.63, noteName: 'C4', durationBeats: 0.5 },
      { id: 'k3', step: 3, freq: 329.63, noteName: 'E4', durationBeats: 1.5 },
      { id: 'k4', step: 6, freq: 349.23, noteName: 'F4', durationBeats: 1.0 },
      { id: 'k5', step: 8, freq: 440.0, noteName: 'A4', durationBeats: 2.0 },
      { id: 'k6', step: 12, freq: 523.25, noteName: 'C5', durationBeats: 0.5 },
      { id: 'k7', step: 13, freq: 493.88, noteName: 'B4', durationBeats: 0.5 },
      { id: 'k8', step: 14, freq: 329.63, noteName: 'E4', durationBeats: 1.0 },
      { id: 'k9', step: 16, freq: 659.26, noteName: 'E5', durationBeats: 2.0 },
      { id: 'k10', step: 20, freq: 440.0, noteName: 'A4', durationBeats: 1.0 },
      { id: 'k11', step: 22, freq: 349.23, noteName: 'F4', durationBeats: 1.0 },
      { id: 'k12', step: 24, freq: 880.0, noteName: 'A5', durationBeats: 2.0 },
      { id: 'k13', step: 28, freq: 523.25, noteName: 'C5', durationBeats: 2.0 },
    ],
    synthNotes: [
      { id: 'ks1', step: 0, freq: 110.0, noteName: 'A2', durationBeats: 4.0 },
      { id: 'ks2', step: 8, freq: 174.61, noteName: 'F3', durationBeats: 4.0 },
      { id: 'ks3', step: 16, freq: 164.81, noteName: 'E3', durationBeats: 4.0 },
      { id: 'ks4', step: 24, freq: 220.0, noteName: 'A3', durationBeats: 4.0 },
    ],
    barFlowRules: [
      { barIndex: 0, minFlow: 0, maxFlow: 45 },
      { barIndex: 1, minFlow: 0, maxFlow: 45 },
      { barIndex: 2, minFlow: 0, maxFlow: 45 },
      { barIndex: 3, minFlow: 3, maxFlow: 45 },
    ],
    createdAt: 1700000002000,
  },
];
