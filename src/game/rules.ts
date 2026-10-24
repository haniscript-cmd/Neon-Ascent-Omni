/**
 * Pure game rules, color manipulation utilities, multi-octave generative melodic composer,
 * dynamic Flow-based difficulty scaling, 4-gate harmonic chord progressions,
 * 8 Lo-Fi/Cyberpunk/CRT sound banks, 27 world/modal musical scales, and zero-GC object pools
 * for NEON ASCENT: OMNI.
 */

export interface FineTuneConfig {
  flowGainRate: number;           // Multiplier for Flow gained per platform/orb (default 1.0)
  flowDecayRate: number;          // Multiplier for Flow decay when stalling (default 1.0)
  difficultyRampSpeed: number;    // Speed at which platform width narrows with Flow (default 1.0)
  minPlatformWidth: number;       // Minimum platform width at max Flow (default 86px)
  maxPlatformWidth: number;       // Starting platform width at Flow 0 (default 180px)
  horizontalScatterMult: number;  // Horizontal distance multiplier between platforms (default 1.0)
  wideLeapSpawnRate: number;      // Multiplier for max-distance opposite-direction platform leaps as Flow rises (default 1.0)
  orbSpawnRate: number;           // Probability of spawning an Orb on a platform (default 0.32)
  orbScatterSpread: number;       // Vertical/horizontal spread of Orbs (default 1.0)
  spikeHazardRate: number;        // Multiplier for on-platform spike probability (default 1.0)
  aerialDroneRate: number;        // Multiplier for mid-air drone probability (default 1.0)
  hazardFlowPenalty: number;      // Multiplier for Flow lost on hazard collision (default 1.0)
  powerUpDurationSec: number;     // Base duration of temporary power-ups in seconds (default 15)
  chordGateCooldownSteps: number; // Platforms between 4-Gate Chord chains (default 16)
  baseMoveSpeed: number;          // Horizontal steering speed in px/s (default 345)
  baseJumpTempo: number;          // Base auto-bounce tempo in BPM equivalent (default 100)
}

export const DEFAULT_FINE_TUNE: FineTuneConfig = {
  flowGainRate: 1.0,
  flowDecayRate: 1.0,
  difficultyRampSpeed: 1.0,
  minPlatformWidth: 86,
  maxPlatformWidth: 180,
  horizontalScatterMult: 1.0,
  wideLeapSpawnRate: 1.0,
  orbSpawnRate: 0.32,
  orbScatterSpread: 1.0,
  spikeHazardRate: 1.0,
  aerialDroneRate: 1.0,
  hazardFlowPenalty: 1.0,
  powerUpDurationSec: 15,
  chordGateCooldownSteps: 16,
  baseMoveSpeed: 345,
  baseJumpTempo: 100,
};

export interface GameConfig {
  volMaster: number;
  volNotes: number;
  volIntervals: number;
  volChords: number;
  volBass: number;
  volDrums: number;
  volChoir: number;
  volSfx: number;
  useBiomes: boolean;
  fixedColor: string;
  playerShape: string;
  unlockedAvatars: string[];
  trailStyle: 'ribbon' | 'pixel' | 'plasma';
  crtScanlines: boolean;
  chromaticAberration: boolean;
  synthWaveform: OscillatorType;
  unlockedScales: number[];
  enabledScales: number[];
  unlockedSoundBanks: string[];
  enabledSoundBanks: string[];
  tiltControlEnabled?: boolean;
  fineTune: FineTuneConfig;
}

export interface SoundBankDef {
  id: string;
  name: string;
  category: 'LO-FI' | 'CYBERPUNK' | 'CRT RETRO';
  desc: string;
  costOrbs: number;
  baseWave: OscillatorType;
  subWave: OscillatorType;
  detuneCents: number;
  filterCutoffMult: number;
  filterQ: number;
  attackSec: number;
  decaySec: number;
  fmModRatio: number;
  fmModDepth: number;
  tapeFlutter: number;
}

export const SOUND_BANKS: SoundBankDef[] = [
  {
    id: 'crt_velvet',
    name: 'CRT Velvet Rhodes',
    category: 'CRT RETRO',
    desc: 'Warm tube-saturated electric tine pluck with soft phosphor decay',
    costOrbs: 0,
    baseWave: 'triangle',
    subWave: 'sine',
    detuneCents: 6,
    filterCutoffMult: 1.0,
    filterQ: 1.4,
    attackSec: 0.016,
    decaySec: 1.18,
    fmModRatio: 2.0,
    fmModDepth: 18,
    tapeFlutter: 0.0015,
  },
  {
    id: 'lofi_tape',
    name: 'Lo-Fi Cassette Keys',
    category: 'LO-FI',
    desc: 'Dusty vintage cassette keys with analog wow/flutter and warm lowpass',
    costOrbs: 16,
    baseWave: 'sine',
    subWave: 'triangle',
    detuneCents: 14,
    filterCutoffMult: 0.68,
    filterQ: 2.1,
    attackSec: 0.028,
    decaySec: 1.35,
    fmModRatio: 1.0,
    fmModDepth: 8,
    tapeFlutter: 0.0045,
  },
  {
    id: 'bladerunner_cs80',
    name: 'Deckard CS-80 Brass',
    category: 'CYBERPUNK',
    desc: 'Lush dual-sawtooth cyberpunk lead with expressive resonant filter sweep',
    costOrbs: 24,
    baseWave: 'sawtooth',
    subWave: 'sawtooth',
    detuneCents: 11,
    filterCutoffMult: 1.25,
    filterQ: 3.2,
    attackSec: 0.032,
    decaySec: 1.42,
    fmModRatio: 1.5,
    fmModDepth: 0,
    tapeFlutter: 0.002,
  },
  {
    id: 'akira_fm',
    name: 'Neo-Tokyo FM Bell',
    category: 'CYBERPUNK',
    desc: 'Crystalline 2-operator FM synthesis bell with metallic harmonic overtones',
    costOrbs: 30,
    baseWave: 'sine',
    subWave: 'sine',
    detuneCents: 4,
    filterCutoffMult: 1.5,
    filterQ: 1.2,
    attackSec: 0.008,
    decaySec: 1.45,
    fmModRatio: 3.5,
    fmModDepth: 110,
    tapeFlutter: 0.0008,
  },
  {
    id: 'vhs_dream',
    name: 'VHS Dreamwave Pad-Pluck',
    category: 'LO-FI',
    desc: 'Wide chorus-detuned late-night VHS synth with dreamy sustain',
    costOrbs: 36,
    baseWave: 'triangle',
    subWave: 'sawtooth',
    detuneCents: 18,
    filterCutoffMult: 0.82,
    filterQ: 2.4,
    attackSec: 0.035,
    decaySec: 1.55,
    fmModRatio: 2.0,
    fmModDepth: 12,
    tapeFlutter: 0.005,
  },
  {
    id: 'arcade_crt_pulse',
    name: '1986 Arcade CRT Pulse',
    category: 'CRT RETRO',
    desc: 'Punchy hollow square-wave chip lead with sub-triangle bass body',
    costOrbs: 40,
    baseWave: 'square',
    subWave: 'triangle',
    detuneCents: 7,
    filterCutoffMult: 0.92,
    filterQ: 2.8,
    attackSec: 0.01,
    decaySec: 0.95,
    fmModRatio: 2.0,
    fmModDepth: 0,
    tapeFlutter: 0.001,
  },
  {
    id: 'rainy_shibuya',
    name: 'Shibuya Rain Lo-Fi Harp',
    category: 'LO-FI',
    desc: 'Delicate plucked jazz-harp harmonics with warm vinyl filter contour',
    costOrbs: 48,
    baseWave: 'triangle',
    subWave: 'sine',
    detuneCents: 9,
    filterCutoffMult: 0.78,
    filterQ: 1.8,
    attackSec: 0.012,
    decaySec: 1.3,
    fmModRatio: 4.0,
    fmModDepth: 38,
    tapeFlutter: 0.0032,
  },
  {
    id: 'cyber_matrix_sub',
    name: 'Neuromancer Sub-Pluck',
    category: 'CYBERPUNK',
    desc: 'Deep resonant darksynth pluck with high-contrast harmonic bite',
    costOrbs: 56,
    baseWave: 'sawtooth',
    subWave: 'triangle',
    detuneCents: 8,
    filterCutoffMult: 1.15,
    filterQ: 4.0,
    attackSec: 0.012,
    decaySec: 1.12,
    fmModRatio: 2.0,
    fmModDepth: 45,
    tapeFlutter: 0.0018,
  },
];

export const DEFAULT_CFG: GameConfig = {
  volMaster: 0.85,
  volNotes: 1.15,
  volIntervals: 1.05,
  volChords: 1.18,
  volBass: 0.95,
  volDrums: 0.0,
  volChoir: 1.22,
  volSfx: 0.95,
  useBiomes: true,
  fixedColor: '#00ff88',
  playerShape: 'circle',
  unlockedAvatars: ['circle', 'triangle', 'square'],
  trailStyle: 'ribbon',
  crtScanlines: true,
  chromaticAberration: true,
  synthWaveform: 'triangle',
  unlockedScales: [0, 1, 2, 6],
  enabledScales: [0, 1, 2, 6],
  unlockedSoundBanks: ['crt_velvet'],
  enabledSoundBanks: ['crt_velvet'],
  tiltControlEnabled: true,
  fineTune: { ...DEFAULT_FINE_TUNE },
};

export const FLOW_PLATFORMS_PER_STEP = 15;

export const FLOW_THRESHOLDS = {
  TIER_1: 0,
  HARMONIC: 3,    // Flow x3: Deep Sub-Bass + Gentle Synth Pad Swell
  SUBDIVISION: 6, // Flow x6: Adaptive 3-Note Half-Interval Runs + 3 Player Ring Pulses + Chord Gates
  CHORD: 8,       // Flow x8: 7-8 Note Cross-Octave Melodic Leaps + Dual Sustained Synth Swell
  OVERDRIVE: 12,  // Flow x12: Full Symphonic Climax + 4-Octave Span + Long Intense Synth Pad
} as const;

export const BIOME_ALTITUDE_SPAN = 9600;

export type StyleRank = 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'OMNI';

export interface ScaleBiome {
  id: number;
  name: string;
  subtitle: string;
  tradition: string;
  costOrbs: number;
  fg: string;
  bgAccent: string;
  horizonColor: string;
  scale: number[];
  noteNames: string[];
  chordNames: [string, string, string, string];
  chords: [number[], number[], number[], number[]];
}

/**
 * Helper to derive a rich 4-chord progression automatically from any 8-note scale
 * with custom chord labels so every biome has a musical 4-gate harmonic sequence.
 */
function makeChords(
  s: number[],
  degrees: [[number, number, number, number], [number, number, number, number], [number, number, number, number], [number, number, number, number]]
): [number[], number[], number[], number[]] {
  return degrees.map((degList) =>
    degList.map((d, idx) => {
      const base = s[Math.abs(d) % s.length];
      if (idx === 0) return Number((base * 0.5).toFixed(2)); // Deep root bass
      if (idx === 3) return Number((base * 2.0).toFixed(2)); // Shimmering top extension
      return Number(base.toFixed(2));
    })
  ) as [number[], number[], number[], number[]];
}

export interface ChordProgressionDef {
  variantIndex: number;
  title: string;
  chordNames: [string, string, string, string];
  chords: [number[], number[], number[], number[]];
}

/**
 * Generates 4 distinct, musically rich 4-chord progressions for any biome so Chord Gates
 * have high progression variety and can randomly select from 4 different harmonic cadences!
 */
export function getBiomeChordProgressions(biome: ScaleBiome): [
  ChordProgressionDef,
  ChordProgressionDef,
  ChordProgressionDef,
  ChordProgressionDef
] {
  const s = biome.scale.length >= 6 ? biome.scale : [261.63, 293.66, 311.13, 349.23, 392.0, 415.3, 466.16, 523.25];
  const rootLabel = (deg: number, suffix: string) => {
    const raw = biome.noteNames?.[deg % biome.noteNames.length] || 'C4';
    const noteRoot = raw.replace(/[0-9~]/g, '');
    return `${noteRoot}${suffix}`;
  };

  // Progression 0: Signature Biome Progression (I - VI - IV - V / Custom Modal)
  const prog0: ChordProgressionDef = {
    variantIndex: 0,
    title: 'Signature Cadence',
    chordNames: biome.chordNames,
    chords: biome.chords,
  };

  // Progression 1: Royal Ascending Lift (IV - V - vi/I - VII)
  const prog1: ChordProgressionDef = {
    variantIndex: 1,
    title: 'Ascending Lift',
    chordNames: [
      biome.chordNames[2] || rootLabel(3, 'maj9'),
      biome.chordNames[3] || rootLabel(4, '7sus4'),
      biome.chordNames[0] || rootLabel(0, 'add9'),
      biome.chordNames[1] || rootLabel(5, 'maj7'),
    ],
    chords: makeChords(s, [
      [3, 5, 0, 2],
      [4, 6, 1, 3],
      [0, 2, 4, 6],
      [5, 0, 2, 4],
    ]),
  };

  // Progression 2: Deep Modal Turnaround (vi - ii - V - I)
  const prog2: ChordProgressionDef = {
    variantIndex: 2,
    title: 'Modal Turnaround',
    chordNames: [
      rootLabel(5, 'm9'),
      rootLabel(1, 'm11'),
      rootLabel(4, '9sus4'),
      biome.chordNames[0] || rootLabel(0, 'maj9'),
    ],
    chords: makeChords(s, [
      [5, 0, 2, 4],
      [1, 3, 5, 0],
      [4, 6, 1, 2],
      [0, 2, 4, 7 % s.length],
    ]),
  };

  // Progression 3: Quartal / Suspended Horizon (I(sus4) - bVII - IV(add9) - V7)
  const prog3: ChordProgressionDef = {
    variantIndex: 3,
    title: 'Quartal Horizon',
    chordNames: [
      rootLabel(0, 'sus4'),
      rootLabel(6, '6/9'),
      rootLabel(3, 'maj7#11'),
      biome.chordNames[3] || rootLabel(4, '7#9'),
    ],
    chords: makeChords(s, [
      [0, 3, 4, 6],
      [6, 1, 3, 5],
      [3, 4, 0, 2],
      [4, 6, 1, 3],
    ]),
  };

  return [prog0, prog1, prog2, prog3];
}

export function pickBiomeChordProgression(
  biome: ScaleBiome,
  variantIndex = 0
): ChordProgressionDef {
  const all = getBiomeChordProgressions(biome);
  const safeIdx = Math.abs(Math.floor(variantIndex)) % all.length;
  return all[safeIdx];
}

/**
 * 27 Musical Scales & Biomes (7 Core + 20 New World, Blues, Arabic, Japanese, Scandinavian/Norse & Exotic Scales)
 */
export const MASTER_SCALES: ScaleBiome[] = [
  // --- STARTER UNLOCKED SCALES (0, 1, 2, 6) ---
  {
    id: 0,
    name: 'NEON GRID',
    subtitle: 'C Minor Nine',
    tradition: 'CYBER SYNTH',
    costOrbs: 0,
    fg: '#00ff88',
    bgAccent: '#00381e',
    horizonColor: '#6ee7b7',
    scale: [261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16, 523.25],
    noteNames: ['C4', 'D4', 'Eb4', 'F4', 'G4', 'Ab4', 'Bb4', 'C5'],
    chordNames: ['Cm9', 'Abmaj7', 'Fm9', 'G7sus4'],
    chords: makeChords(
      [261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16, 523.25],
      [[0, 2, 4, 1], [5, 0, 2, 4], [3, 5, 0, 2], [4, 6, 1, 3]]
    ),
  },
  {
    id: 1,
    name: 'VAPOR HORIZON',
    subtitle: 'F Lydian Dream',
    tradition: 'DREAMWAVE',
    costOrbs: 0,
    fg: '#ff2a85',
    bgAccent: '#42002c',
    horizonColor: '#f472b6',
    scale: [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25],
    noteNames: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
    chordNames: ['Fmaj9(#11)', 'G6/9', 'Em7', 'Am9'],
    chords: makeChords(
      [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25],
      [[3, 5, 0, 2], [4, 6, 1, 2], [2, 4, 6, 1], [5, 0, 2, 4]]
    ),
  },
  {
    id: 2,
    name: 'ABYSSAL OCEAN',
    subtitle: 'G Dorian Trench',
    tradition: 'DEEP AMBIENT',
    costOrbs: 0,
    fg: '#00d4ff',
    bgAccent: '#002642',
    horizonColor: '#7dd3fc',
    scale: [196.00, 220.00, 233.08, 261.63, 293.66, 329.63, 349.23, 392.00],
    noteNames: ['G3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4', 'G4'],
    chordNames: ['Gm9', 'C9', 'Fmaj7', 'Dm7'],
    chords: makeChords(
      [196.00, 220.00, 233.08, 261.63, 293.66, 329.63, 349.23, 392.00],
      [[0, 2, 4, 6], [3, 5, 0, 1], [6, 1, 3, 5], [4, 6, 1, 3]]
    ),
  },
  {
    id: 3,
    name: 'SOLAR DAWN',
    subtitle: 'A Major Add9',
    tradition: 'SYNTHWAVE',
    costOrbs: 12,
    fg: '#ffb800',
    bgAccent: '#422100',
    horizonColor: '#fde047',
    scale: [220.00, 246.94, 277.18, 293.66, 329.63, 369.99, 415.30, 440.00],
    noteNames: ['A3', 'B3', 'C#4', 'D4', 'E4', 'F#4', 'G#4', 'A4'],
    chordNames: ['Amaj9', 'F#m11', 'Dmaj9', 'E6/9'],
    chords: makeChords(
      [220.00, 246.94, 277.18, 293.66, 329.63, 369.99, 415.30, 440.00],
      [[0, 2, 4, 6], [5, 0, 2, 4], [3, 5, 0, 2], [4, 6, 1, 2]]
    ),
  },
  {
    id: 4,
    name: 'CRIMSON PROTOCOL',
    subtitle: 'C Phrygian Dominant',
    tradition: 'DARKSYNTH',
    costOrbs: 16,
    fg: '#ff3344',
    bgAccent: '#420009',
    horizonColor: '#fda4af',
    scale: [196.00, 207.65, 246.94, 261.63, 277.18, 329.63, 349.23, 392.00],
    noteNames: ['G3', 'Ab3', 'B3', 'C4', 'Db4', 'E4', 'F4', 'G4'],
    chordNames: ['C7(b9)', 'Dbmaj7', 'Bbm7b5', 'C7sus'],
    chords: makeChords(
      [196.00, 207.65, 246.94, 261.63, 277.18, 329.63, 349.23, 392.00],
      [[3, 5, 0, 4], [4, 6, 0, 3], [6, 1, 3, 5], [3, 6, 0, 5]]
    ),
  },
  {
    id: 5,
    name: 'ASTRAL VOID',
    subtitle: 'E Aeolian Ethereal',
    tradition: 'SPACE AMBIENT',
    costOrbs: 16,
    fg: '#e2e8f0',
    bgAccent: '#1e293b',
    horizonColor: '#cbd5e1',
    scale: [246.94, 293.66, 329.63, 369.99, 392.00, 440.00, 493.88, 587.33],
    noteNames: ['B3', 'D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'D5'],
    chordNames: ['Em9', 'Cmaj7', 'Am9', 'Bm7'],
    chords: makeChords(
      [246.94, 293.66, 329.63, 369.99, 392.00, 440.00, 493.88, 587.33],
      [[2, 4, 6, 3], [4, 6, 1, 3], [5, 2, 4, 6], [0, 2, 3, 6]]
    ),
  },
  {
    id: 6,
    name: 'CYBER ZEN',
    subtitle: 'Hirajoshi Extended',
    tradition: 'JAPANESE',
    costOrbs: 0,
    fg: '#a855f7',
    bgAccent: '#2e1065',
    horizonColor: '#d8b4fe',
    scale: [220.00, 246.94, 261.63, 329.63, 349.23, 440.00, 493.88, 523.25],
    noteNames: ['A3', 'B3', 'C4', 'E4', 'F4', 'A4', 'B4', 'C5'],
    chordNames: ['Am(add9)', 'Fmaj7#11', 'Dm(maj7)', 'Esus4'],
    chords: makeChords(
      [220.00, 246.94, 261.63, 329.63, 349.23, 440.00, 493.88, 523.25],
      [[0, 2, 3, 1], [4, 0, 2, 3], [2, 4, 5, 1], [3, 4, 0, 6]]
    ),
  },

  // --- 20 PURCHASABLE WORLD, BLUES, ARABIC, JAPANESE, NORSE & EXOTIC SCALES (DOUBLED PRICES) ---
  {
    id: 7,
    name: 'MIDNIGHT BLUES',
    subtitle: 'C Hexatonic Blues',
    tradition: 'BLUES LO-FI',
    costOrbs: 20,
    fg: '#38bdf8',
    bgAccent: '#082f49',
    horizonColor: '#bae6fd',
    scale: [261.63, 311.13, 349.23, 369.99, 392.00, 466.16, 523.25, 622.25],
    noteNames: ['C4', 'Eb4', 'F4', 'Gb4', 'G4', 'Bb4', 'C5', 'Eb5'],
    chordNames: ['C7#9', 'F9', 'C7', 'G7#9'],
    chords: makeChords(
      [261.63, 311.13, 349.23, 369.99, 392.00, 466.16, 523.25, 622.25],
      [[0, 1, 4, 5], [2, 4, 5, 0], [0, 4, 5, 1], [4, 5, 2, 3]]
    ),
  },
  {
    id: 8,
    name: 'VELVET DELTA',
    subtitle: 'A Minor Blues Nine',
    tradition: 'BLUES LO-FI',
    costOrbs: 24,
    fg: '#60a5fa',
    bgAccent: '#172554',
    horizonColor: '#93c5fd',
    scale: [220.00, 261.63, 293.66, 311.13, 329.63, 392.00, 440.00, 523.25],
    noteNames: ['A3', 'C4', 'D4', 'Eb4', 'E4', 'G4', 'A4', 'C5'],
    chordNames: ['Am7', 'Dm9', 'Am11', 'E7b9'],
    chords: makeChords(
      [220.00, 261.63, 293.66, 311.13, 329.63, 392.00, 440.00, 523.25],
      [[0, 1, 4, 5], [2, 4, 5, 1], [0, 2, 4, 5], [4, 3, 5, 1]]
    ),
  },
  {
    id: 9,
    name: 'BOURBON CRT',
    subtitle: 'E Mixolydian Soul Blues',
    tradition: 'BLUES LO-FI',
    costOrbs: 28,
    fg: '#f59e0b',
    bgAccent: '#451a03',
    horizonColor: '#fcd34d',
    scale: [164.81, 196.00, 207.65, 220.00, 246.94, 293.66, 329.63, 392.00],
    noteNames: ['E3', 'G3', 'G#3', 'A3', 'B3', 'D4', 'E4', 'G4'],
    chordNames: ['E9', 'A13', 'E7#9', 'B7sus4'],
    chords: makeChords(
      [164.81, 196.00, 207.65, 220.00, 246.94, 293.66, 329.63, 392.00],
      [[0, 2, 4, 5], [3, 5, 0, 2], [0, 1, 4, 5], [4, 5, 0, 3]]
    ),
  },
  {
    id: 10,
    name: 'MIRAGE HIJAZ',
    subtitle: 'D Hijaz Kar Maqam',
    tradition: 'ARABIC',
    costOrbs: 24,
    fg: '#fb923c',
    bgAccent: '#431407',
    horizonColor: '#fdba74',
    scale: [293.66, 311.13, 369.99, 392.00, 440.00, 466.16, 554.37, 587.33],
    noteNames: ['D4', 'Eb4', 'F#4', 'G4', 'A4', 'Bb4', 'C#5', 'D5'],
    chordNames: ['D7(b9)', 'Gm(maj7)', 'Ebmaj7#5', 'Dmaj(b9)'],
    chords: makeChords(
      [293.66, 311.13, 369.99, 392.00, 440.00, 466.16, 554.37, 587.33],
      [[0, 2, 4, 1], [3, 5, 0, 2], [1, 3, 5, 0], [0, 2, 4, 6]]
    ),
  },
  {
    id: 11,
    name: 'DUNES OF BAYATI',
    subtitle: 'G Bayati Resonance',
    tradition: 'ARABIC',
    costOrbs: 28,
    fg: '#facc15',
    bgAccent: '#3f2e00',
    horizonColor: '#fef08a',
    scale: [196.00, 214.00, 233.08, 261.63, 293.66, 311.13, 349.23, 392.00],
    noteNames: ['G3', 'A~3', 'Bb3', 'C4', 'D4', 'Eb4', 'F4', 'G4'],
    chordNames: ['Gm11', 'Cm7', 'F7sus4', 'Gm9'],
    chords: makeChords(
      [196.00, 214.00, 233.08, 261.63, 293.66, 311.13, 349.23, 392.00],
      [[0, 2, 4, 6], [3, 5, 0, 2], [6, 2, 3, 4], [0, 2, 4, 1]]
    ),
  },
  {
    id: 12,
    name: 'BABYLON NAHAWAND',
    subtitle: 'C Nahawand Harmonic',
    tradition: 'ARABIC',
    costOrbs: 32,
    fg: '#e879f9',
    bgAccent: '#3b0764',
    horizonColor: '#f5d0fe',
    scale: [261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 493.88, 523.25],
    noteNames: ['C4', 'D4', 'Eb4', 'F4', 'G4', 'Ab4', 'B4', 'C5'],
    chordNames: ['Cm(maj9)', 'Fm6', 'Abmaj7#5', 'G7b9'],
    chords: makeChords(
      [261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 493.88, 523.25],
      [[0, 2, 4, 6], [3, 5, 0, 1], [5, 0, 2, 6], [4, 6, 1, 5]]
    ),
  },
  {
    id: 13,
    name: 'SAMURAI IN-SEN',
    subtitle: 'D In-Sen Shakuhachi',
    tradition: 'JAPANESE',
    costOrbs: 24,
    fg: '#f43f5e',
    bgAccent: '#4c0519',
    horizonColor: '#fda4af',
    scale: [293.66, 311.13, 392.00, 440.00, 523.25, 587.33, 622.25, 783.99],
    noteNames: ['D4', 'Eb4', 'G4', 'A4', 'C5', 'D5', 'Eb5', 'G5'],
    chordNames: ['Dsus(b9)', 'Gm(add9)', 'Csus2', 'D5(b9)'],
    chords: makeChords(
      [293.66, 311.13, 392.00, 440.00, 523.25, 587.33, 622.25, 783.99],
      [[0, 2, 3, 1], [2, 3, 4, 5], [4, 0, 2, 3], [0, 3, 5, 6]]
    ),
  },
  {
    id: 14,
    name: 'SAKURA YO-SCALE',
    subtitle: 'G Yo Festival Koto',
    tradition: 'JAPANESE',
    costOrbs: 28,
    fg: '#fb7185',
    bgAccent: '#500724',
    horizonColor: '#fecdd3',
    scale: [196.00, 220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25],
    noteNames: ['G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5'],
    chordNames: ['G6/9', 'Csus2', 'Em7', 'Dsus4'],
    chords: makeChords(
      [196.00, 220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25],
      [[0, 1, 3, 4], [2, 3, 5, 6], [4, 0, 2, 3], [3, 4, 0, 2]]
    ),
  },
  {
    id: 15,
    name: 'KYOTO IWATO',
    subtitle: 'B Iwato Shrine Bell',
    tradition: 'JAPANESE',
    costOrbs: 32,
    fg: '#c084fc',
    bgAccent: '#2e1065',
    horizonColor: '#e9d5ff',
    scale: [246.94, 261.63, 329.63, 349.23, 440.00, 493.88, 523.25, 659.25],
    noteNames: ['B3', 'C4', 'E4', 'F4', 'A4', 'B4', 'C5', 'E5'],
    chordNames: ['Bm7b5', 'Cmaj7#11', 'Fmaj7b5', 'Am(add9)'],
    chords: makeChords(
      [246.94, 261.63, 329.63, 349.23, 440.00, 493.88, 523.25, 659.25],
      [[0, 2, 3, 4], [1, 2, 4, 5], [3, 4, 0, 2], [4, 1, 2, 5]]
    ),
  },
  {
    id: 16,
    name: 'OKINAWA RYUKYU',
    subtitle: 'C Ryukyu Ocean Sanshin',
    tradition: 'JAPANESE',
    costOrbs: 32,
    fg: '#2dd4bf',
    bgAccent: '#042f2e',
    horizonColor: '#99f6e4',
    scale: [261.63, 329.63, 349.23, 392.00, 493.88, 523.25, 659.25, 698.46],
    noteNames: ['C4', 'E4', 'F4', 'G4', 'B4', 'C5', 'E5', 'F5'],
    chordNames: ['Cmaj7', 'Fmaj9', 'Em7', 'G6'],
    chords: makeChords(
      [261.63, 329.63, 349.23, 392.00, 493.88, 523.25, 659.25, 698.46],
      [[0, 1, 3, 4], [2, 3, 0, 4], [1, 3, 4, 5], [3, 4, 0, 2]]
    ),
  },
  {
    id: 17,
    name: 'VALHALLA GJALLARHORN',
    subtitle: 'D Nordic Folk Dorian #4',
    tradition: 'NORSE MYTH',
    costOrbs: 30,
    fg: '#34d399',
    bgAccent: '#064e3b',
    horizonColor: '#a7f3d0',
    scale: [146.83, 164.81, 174.61, 207.65, 220.00, 246.94, 261.63, 293.66],
    noteNames: ['D3', 'E3', 'F3', 'G#3', 'A3', 'B3', 'C4', 'D4'],
    chordNames: ['Dm(add11)', 'E7', 'Fmaj7#5', 'Am(add9)'],
    chords: makeChords(
      [146.83, 164.81, 174.61, 207.65, 220.00, 246.94, 261.63, 293.66],
      [[0, 2, 4, 6], [1, 3, 5, 0], [2, 4, 5, 7], [4, 6, 0, 1]]
    ),
  },
  {
    id: 18,
    name: 'YGGDRASIL ROOTS',
    subtitle: 'A Viking Tagelharpa Drone',
    tradition: 'NORSE MYTH',
    costOrbs: 36,
    fg: '#84cc16',
    bgAccent: '#1a2e05',
    horizonColor: '#bef264',
    scale: [110.00, 123.47, 130.81, 146.83, 164.81, 174.61, 196.00, 220.00],
    noteNames: ['A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3'],
    chordNames: ['A5(add9)', 'G6', 'Fmaj7', 'Em7'],
    chords: makeChords(
      [110.00, 123.47, 130.81, 146.83, 164.81, 174.61, 196.00, 220.00],
      [[0, 4, 7, 1], [6, 1, 3, 4], [5, 0, 2, 4], [4, 6, 1, 3]]
    ),
  },
  {
    id: 19,
    name: 'AURORA BIFROST',
    subtitle: 'F# Scandinavian Lydian Dominant',
    tradition: 'SCANDINAVIAN',
    costOrbs: 36,
    fg: '#22d3ee',
    bgAccent: '#083344',
    horizonColor: '#a5f3fc',
    scale: [185.00, 207.65, 233.08, 261.63, 277.18, 311.13, 329.63, 369.99],
    noteNames: ['F#3', 'G#3', 'A#3', 'C4', 'C#4', 'D#4', 'E4', 'F#4'],
    chordNames: ['F#9(#11)', 'G#7', 'D#m9', 'E6/9'],
    chords: makeChords(
      [185.00, 207.65, 233.08, 261.63, 277.18, 311.13, 329.63, 369.99],
      [[0, 2, 4, 3], [1, 3, 5, 6], [5, 0, 2, 4], [6, 1, 3, 4]]
    ),
  },
  {
    id: 20,
    name: 'FENRIR FROST',
    subtitle: 'E Locrian Natural 2',
    tradition: 'NORSE MYTH',
    costOrbs: 40,
    fg: '#94a3b8',
    bgAccent: '#0f172a',
    horizonColor: '#e2e8f0',
    scale: [164.81, 185.00, 196.00, 220.00, 233.08, 261.63, 293.66, 329.63],
    noteNames: ['E3', 'F#3', 'G3', 'A3', 'Bb3', 'C4', 'D4', 'E4'],
    chordNames: ['Em9b5', 'Cmaj7#5', 'Gm6', 'Bb7(#11)'],
    chords: makeChords(
      [164.81, 185.00, 196.00, 220.00, 233.08, 261.63, 293.66, 329.63],
      [[0, 2, 4, 1], [5, 0, 2, 6], [2, 4, 6, 0], [4, 6, 1, 5]]
    ),
  },
  {
    id: 21,
    name: 'ANDALUSIAN NIGHT',
    subtitle: 'E Flamenco Phrygian Cadence',
    tradition: 'MEDITERRANEAN',
    costOrbs: 32,
    fg: '#f97316',
    bgAccent: '#431407',
    horizonColor: '#fdba74',
    scale: [164.81, 174.61, 207.65, 220.00, 246.94, 261.63, 293.66, 329.63],
    noteNames: ['E3', 'F3', 'G#3', 'A3', 'B3', 'C4', 'D4', 'E4'],
    chordNames: ['Am9', 'G6', 'Fmaj7#11', 'E7(b9)'],
    chords: makeChords(
      [164.81, 174.61, 207.65, 220.00, 246.94, 261.63, 293.66, 329.63],
      [[3, 5, 0, 4], [6, 3, 4, 0], [1, 3, 5, 4], [0, 2, 4, 1]]
    ),
  },
  {
    id: 22,
    name: 'BALKAN NOMAD',
    subtitle: 'G Hungarian Minor',
    tradition: 'EASTERN EUROPE',
    costOrbs: 36,
    fg: '#ec4899',
    bgAccent: '#500724',
    horizonColor: '#f9a8d4',
    scale: [196.00, 220.00, 233.08, 277.18, 293.66, 311.13, 369.99, 392.00],
    noteNames: ['G3', 'A3', 'Bb3', 'C#4', 'D4', 'Eb4', 'F#4', 'G4'],
    chordNames: ['Gm(maj7)', 'Ebmaj7#5', 'A7b5', 'D7(#9)'],
    chords: makeChords(
      [196.00, 220.00, 233.08, 277.18, 293.66, 311.13, 369.99, 392.00],
      [[0, 2, 4, 6], [5, 0, 3, 6], [1, 3, 5, 0], [4, 6, 1, 2]]
    ),
  },
  {
    id: 23,
    name: 'CELTIC TIR NA NOG',
    subtitle: 'D Mixolydian Harp',
    tradition: 'CELTIC MYTH',
    costOrbs: 32,
    fg: '#10b981',
    bgAccent: '#022c22',
    horizonColor: '#6ee7b7',
    scale: [293.66, 329.63, 369.99, 392.00, 440.00, 493.88, 523.25, 587.33],
    noteNames: ['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C5', 'D5'],
    chordNames: ['Dadd9', 'Cadd9', 'G6', 'Bm7'],
    chords: makeChords(
      [293.66, 329.63, 369.99, 392.00, 440.00, 493.88, 523.25, 587.33],
      [[0, 2, 4, 1], [6, 1, 3, 4], [3, 5, 0, 1], [5, 0, 2, 4]]
    ),
  },
  {
    id: 24,
    name: 'MUMBAI RAGA BHAIRAV',
    subtitle: 'C Double Harmonic Dawn',
    tradition: 'INDIAN RAGA',
    costOrbs: 40,
    fg: '#fbbf24',
    bgAccent: '#451a03',
    horizonColor: '#fde68a',
    scale: [261.63, 277.18, 329.63, 349.23, 392.00, 415.30, 493.88, 523.25],
    noteNames: ['C4', 'Db4', 'E4', 'F4', 'G4', 'Ab4', 'B4', 'C5'],
    chordNames: ['Cmaj7(b9)', 'Dbmaj7', 'Fm(maj7)', 'Cmaj9'],
    chords: makeChords(
      [261.63, 277.18, 329.63, 349.23, 392.00, 415.30, 493.88, 523.25],
      [[0, 2, 4, 6], [1, 3, 5, 0], [3, 5, 0, 2], [0, 2, 4, 1]]
    ),
  },
  {
    id: 25,
    name: 'BALI GAMELAN PELOG',
    subtitle: 'E Pelog Selisir Bronze',
    tradition: 'INDONESIAN',
    costOrbs: 44,
    fg: '#a3e635',
    bgAccent: '#1a2e05',
    horizonColor: '#d9f99d',
    scale: [329.63, 349.23, 392.00, 493.88, 523.25, 659.25, 698.46, 783.99],
    noteNames: ['E4', 'F4', 'G4', 'B4', 'C5', 'E5', 'F5', 'G5'],
    chordNames: ['Em(b9)', 'Cmaj7', 'Fmaj7#11', 'Bsus4'],
    chords: makeChords(
      [329.63, 349.23, 392.00, 493.88, 523.25, 659.25, 698.46, 783.99],
      [[0, 2, 3, 1], [4, 2, 3, 5], [1, 2, 4, 3], [3, 4, 0, 2]]
    ),
  },
  {
    id: 26,
    name: 'CHRONO WHOLE-TONE',
    subtitle: 'C Sci-Fi Whole-Tone Prism',
    tradition: 'CYBER AVANT',
    costOrbs: 48,
    fg: '#818cf8',
    bgAccent: '#1e1b4b',
    horizonColor: '#c7d2fe',
    scale: [261.63, 293.66, 329.63, 369.99, 415.30, 466.16, 523.25, 587.33],
    noteNames: ['C4', 'D4', 'E4', 'F#4', 'G#4', 'Bb4', 'C5', 'D5'],
    chordNames: ['C9(#5)', 'D9(#11)', 'Eaug7', 'Bb9(#11)'],
    chords: makeChords(
      [261.63, 293.66, 329.63, 369.99, 415.30, 466.16, 523.25, 587.33],
      [[0, 2, 4, 5], [1, 3, 5, 0], [2, 4, 0, 1], [5, 1, 3, 4]]
    ),
  },
];

export const NOTES_MAP: Record<string, number> = {
  'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
  'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
  'C5': 523.25,
};

export const SEQUENCER_PRESETS: Record<string, { name: string; bpm: number; wave: OscillatorType; steps: number[][] }> = {
  cyber_arp: {
    name: 'Cyberpunk Pluck',
    bpm: 104,
    wave: 'triangle',
    steps: [
      [261.63], [311.13], [392.00], [523.25],
      [392.00], [311.13], [349.23], [466.16],
      [261.63], [311.13], [392.00], [523.25],
      [466.16], [392.00], [349.23], [311.13],
    ],
  },
  synthwave_anthem: {
    name: 'Outrun Horizon',
    bpm: 100,
    wave: 'triangle',
    steps: [
      [220.00, 440.00], [261.63], [329.63], [440.00],
      [174.61, 349.23], [261.63], [349.23], [440.00],
      [130.81, 261.63], [196.00], [261.63], [329.63],
      [196.00, 392.00], [246.94], [293.66], [392.00],
    ],
  },
  daft_pulse: {
    name: 'Harmonic Velvet',
    bpm: 108,
    wave: 'sine',
    steps: [
      [146.83], [293.66], [174.61], [349.23],
      [196.00], [392.00], [220.00], [440.00],
      [261.63, 523.25], [392.00], [349.23], [293.66],
      [196.00], [261.63], [146.83], [293.66],
    ],
  },
  tokyo_rain: {
    name: 'Neon Raindrop',
    bpm: 96,
    wave: 'sine',
    steps: [
      [329.63], [392.00], [493.88], [523.25],
      [493.88], [392.00], [329.63], [246.94],
      [261.63], [329.63], [392.00], [493.88],
      [440.00], [392.00], [329.63], [220.00],
    ],
  },
};

/**
 * HEX / RGB / HSL color manipulation utilities (Bug Fix #2).
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace(/^#/, '').trim();
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  if (clean.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(clean)) {
    return { r: 0, g: 255, b: 136 };
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function lighten(hexColor: string, amount = 0.35): string {
  const { r, g, b } = hexToRgb(hexColor);
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex(
    r + (255 - r) * t,
    g + (255 - g) * t,
    b + (255 - b) * t
  );
}

export function darken(hexColor: string, amount = 0.35): string {
  const { r, g, b } = hexToRgb(hexColor);
  const t = Math.max(0, Math.min(1, 1 - amount));
  return rgbToHex(r * t, g * t, b * t);
}

export function withAlpha(hexColor: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hexColor);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function blendHex(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const clamped = Math.max(0, Math.min(1, t));
  return rgbToHex(
    a.r + (b.r - a.r) * clamped,
    a.g + (b.g - a.g) * clamped,
    a.b + (b.b - a.b) * clamped
  );
}

export type PlatformArchetype =
  | 'normal'
  | 'moving'
  | 'bounce'
  | 'crumble'
  | 'phase'
  | 'chord_gate';

/**
 * Cohesive Biome Theme Palette for Platform Archetypes:
 * All platform types within a biome share shades/tints of that biome's own color spectrum.
 */
export function getPlatformThemeColor(
  biome: ScaleBiome,
  archetype: PlatformArchetype,
  useBiomes: boolean,
  fixedColor: string
): string {
  const base = useBiomes ? biome.fg : fixedColor;
  const horizon = useBiomes ? biome.horizonColor : lighten(fixedColor, 0.45);

  switch (archetype) {
    case 'normal':
      return base;
    case 'moving':
      return lighten(base, 0.32);
    case 'bounce':
      return lighten(horizon, 0.42);
    case 'crumble':
      return darken(base, 0.28);
    case 'phase':
      return blendHex(base, horizon, 0.65);
    case 'chord_gate':
      return lighten(horizon, 0.55);
    default:
      return base;
  }
}

/**
 * Dynamic Flow-Driven Difficulty Calculator:
 * Replaces static Settings sliders for speed/jump/difficulty.
 * - Low Flow (0–2): Calm pace, wide forgiving platforms (176px), gentle step spacing (124px), low hazard chance.
 * - High Flow (3–15+): Faster pace, narrower platforms (down to 84px), wider vertical & horizontal spacing,
 *   higher chance of platform & mid-air hazards.
 * - When Flow drops, these parameters immediately relax back to match the lower Flow!
 */
export interface FlowDynamicDifficulty {
  flowFactor: number; // 0.0 -> 1.0
  targetPlatformWidth: number;
  stepY: number;
  minHorizDist: number;
  maxHorizDist: number;
  wideLeapChance: number;
  paceMultiplier: number;
  moveSpeedPxPerSec: number;
  movingPlatformChance: number;
  platformHazardChance: number;
  aerialHazardChance: number;
}

export function computeFlowDynamicDifficulty(
  flowEnergy: number,
  fineTune: FineTuneConfig = DEFAULT_FINE_TUNE
): FlowDynamicDifficulty {
  const ft = { ...DEFAULT_FINE_TUNE, ...fineTune };
  // 1/5th slower difficulty scaling modulated by difficultyRampSpeed
  const effectiveFlow = Math.max(0, flowEnergy * ft.difficultyRampSpeed);
  const clampedFlow = Math.max(0, Math.min(45, effectiveFlow));
  const f = clampedFlow / 45; // 0.0 at Flow 0 -> 1.0 at Flow 45

  const maxW = Math.max(100, ft.maxPlatformWidth);
  const minW = Math.max(48, Math.min(maxW, ft.minPlatformWidth));

  return {
    flowFactor: f,
    targetPlatformWidth: Math.round(maxW - f * (maxW - minW)),
    stepY: 134,
    minHorizDist: Math.round(92 * ft.horizontalScatterMult),
    maxHorizDist: Math.round(184 * ft.horizontalScatterMult),
    wideLeapChance: Number(
      Math.min(0.85, (0.06 + f * 0.44) * (ft.wideLeapSpawnRate ?? 1.0)).toFixed(2)
    ),
    paceMultiplier: 0.9,
    moveSpeedPxPerSec: ft.baseMoveSpeed,
    movingPlatformChance: Number((0.06 + f * 0.18).toFixed(2)),
    platformHazardChance:
      flowEnergy < 3 ? 0 : Number(Math.min(0.85, (0.04 + f * 0.14) * ft.spikeHazardRate).toFixed(2)),
    aerialHazardChance:
      flowEnergy < 4 ? 0 : Number(Math.min(0.85, (0.04 + f * 0.15) * ft.aerialDroneRate).toFixed(2)),
  };
}

/**
 * Smooth Auto-Bounce Physics & Platform Spacing Calculator
 */
export interface JumpKinematics {
  beatDurationSec: number;
  stepY: number;
  apexHeight: number;
  gravityPxPerSec2: number;
  jumpVelocityPxPerSec: number;
  bouncePadVelocityPxPerSec: number;
}

export function computeBpmLockedKinematics(tempoHint = 100, stepScale = 1.0): JumpKinematics {
  const safeTempo = Math.max(60, Math.min(180, tempoHint || 100));
  const flightDurationSec = 60 / safeTempo;

  const stepY = Math.round(134 * stepScale);
  const apexHeight = Math.round(184 * stepScale);

  const kFactor = Math.sqrt(2 * apexHeight) + Math.sqrt(2 * (apexHeight - stepY));
  const gravityPxPerSec2 = (kFactor * kFactor) / (flightDurationSec * flightDurationSec);
  const jumpVelocityPxPerSec = -Math.sqrt(2 * gravityPxPerSec2 * apexHeight);

  const doubleStepY = stepY * 2;
  const doubleApex = doubleStepY + 54 * stepScale;
  const bouncePadVelocityPxPerSec = -Math.sqrt(2 * gravityPxPerSec2 * doubleApex);

  return {
    beatDurationSec: flightDurationSec,
    stepY,
    apexHeight,
    gravityPxPerSec2,
    jumpVelocityPxPerSec,
    bouncePadVelocityPxPerSec,
  };
}

/**
 * Duration-Proportional MIDI / Stage Jump Kinematics:
 * Guarantees flight time (`flightDurationSec`) is 100% locked 1:1 to `beatDurationRatio`
 * while keeping the projectile apex clearance tight (`~26-34px` above the target platform)
 * so long notes (1.5x, 2.0x, 3.0x, 4.0x) NEVER overshoot or skip intermediate platforms!
 */
export interface NoteDurationKinematics {
  beatDurationRatio: number;
  flightDurationSec: number;
  stepY: number;
  apexHeight: number;
  gravityPxPerSec2: number;
  jumpVelocityPxPerSec: number;
}

export function computeNoteDurationKinematics(
  bpm = 100,
  beatDurationRatio = 1.0,
  baseStepY = 134,
  _baseApex = 184
): NoteDurationKinematics {
  const safeBpm = Math.max(50, Math.min(200, bpm || 100));
  const r = Math.max(0.25, Math.min(4.0, beatDurationRatio || 1.0));
  const oneBeatSec = 60 / safeBpm;
  const flightDurationSec = oneBeatSec * r;

  // Damped vertical spacing for long notes so 2B-4B jumps stay comfortably framed and never skip platforms,
  // while flightDurationSec remains strictly proportional (1:1) to beatDurationRatio!
  const stepScale = r <= 1.0 ? 0.46 + 0.54 * r : 1.0 + Math.min(0.62, (r - 1.0) * 0.25);
  const stepY = Math.round(baseStepY * stepScale);
  const tightClearance = Math.round(24 + 8 * Math.min(1.25, r));
  const apexHeight = stepY + tightClearance;

  const kFactor = Math.sqrt(2 * apexHeight) + Math.sqrt(2 * Math.max(8, apexHeight - stepY));
  const gravityPxPerSec2 = (kFactor * kFactor) / (flightDurationSec * flightDurationSec);
  const jumpVelocityPxPerSec = -Math.sqrt(2 * gravityPxPerSec2 * apexHeight);

  return {
    beatDurationRatio: r,
    flightDurationSec,
    stepY,
    apexHeight,
    gravityPxPerSec2,
    jumpVelocityPxPerSec,
  };
}

/**
 * Single-Platform-Per-Row Scattered Placement Calculator:
 * Guarantees strictly ONE platform per row (never two platforms at the same height)
 * while scattering horizontally with Flow-scaled leap distances and random wide opposite-side leaps.
 */
export function computeScatteredPlatformPlacement(
  prevCenterX: number,
  prevY: number,
  stepY: number,
  platWidth: number,
  flowLevel = 0,
  stepCounter = 1,
  fineTuneOrScatterMult: FineTuneConfig | number = DEFAULT_FINE_TUNE,
  exactVerticalStep = false
): { x: number; y: number; centerX: number } {
  const fineTune: FineTuneConfig =
    typeof fineTuneOrScatterMult === 'number'
      ? { ...DEFAULT_FINE_TUNE, horizontalScatterMult: fineTuneOrScatterMult }
      : { ...DEFAULT_FINE_TUNE, ...fineTuneOrScatterMult };

  const diff = computeFlowDynamicDifficulty(flowLevel, fineTune);
  const minMargin = 24;
  const maxRight = 576 - platWidth;
  const minCenter = minMargin + platWidth * 0.5;
  const maxCenter = 576 - platWidth * 0.5;

  const durationScale = Math.max(0.48, Math.min(1.32, stepY / 134));
  const isWideOppositeLeap = Math.random() < diff.wideLeapChance;

  let candidateCenter: number;

  if (isWideOppositeLeap) {
    // Wide Opposite-Direction Leap: jump across to the opposite half of the arena,
    // keeping a natural margin from the walls (not glued to the wall!)
    const oppositeDir = prevCenterX < 300 ? 1 : -1;
    const wallSafePad = 48 + Math.random() * 58; // 48px..106px inset from wall
    const wideSpan = (185 + Math.random() * 75) * Math.min(1.18, durationScale);
    const rawTarget = prevCenterX + oppositeDir * wideSpan;
    const safeMin = Math.max(minCenter, wallSafePad + platWidth * 0.5);
    const safeMax = Math.min(maxCenter, 600 - wallSafePad - platWidth * 0.5);
    candidateCenter = Math.max(safeMin, Math.min(safeMax, rawTarget));
  } else {
    const minHorizJump = diff.minHorizDist * durationScale;
    const maxHorizJump = diff.maxHorizDist * durationScale;

    const goldenNoise = (stepCounter * 0.61803398875 + Math.random() * 0.55) % 1;
    let dir = goldenNoise > 0.5 ? 1 : -1;

    if (prevCenterX < 180) {
      dir = Math.random() < 0.84 ? 1 : -1;
    } else if (prevCenterX > 420) {
      dir = Math.random() < 0.84 ? -1 : 1;
    }

    const jumpMag = minHorizJump + Math.random() * (maxHorizJump - minHorizJump);
    candidateCenter = prevCenterX + dir * jumpMag;

    if (candidateCenter < minCenter || candidateCenter > maxCenter) {
      candidateCenter = prevCenterX - dir * jumpMag;
    }
    candidateCenter = Math.max(minCenter, Math.min(maxCenter, candidateCenter));

    const minSep = Math.round(70 * durationScale);
    if (Math.abs(candidateCenter - prevCenterX) < minSep) {
      candidateCenter =
        prevCenterX < 300
          ? Math.min(maxCenter, prevCenterX + (125 + Math.random() * 65) * durationScale)
          : Math.max(minCenter, prevCenterX - (125 + Math.random() * 65) * durationScale);
    }
  }

  const x = Math.round(Math.max(minMargin, Math.min(maxRight, candidateCenter - platWidth * 0.5)));

  // For Custom/MIDI stages (exactVerticalStep = true), use exact stepY so flight time matches note duration 100%!
  const verticalJitter = exactVerticalStep ? 1.0 : 0.92 + Math.random() * 0.14;
  const y = Math.round(prevY - stepY * verticalJitter);

  return { x, y, centerX: x + platWidth * 0.5 };
}

/**
 * Builds an extended 3.5-octave pitch ladder from a biome's base scale.
 */
export function buildExtendedScale(baseScale: number[]): number[] {
  if (!baseScale || baseScale.length === 0) return [261.63];
  const core =
    baseScale.length > 2 && Math.abs(baseScale[baseScale.length - 1] - baseScale[0] * 2) < 4
      ? baseScale.slice(0, -1)
      : baseScale;

  const lowOct = core.map((f) => Number((f * 0.5).toFixed(2)));
  const midOct = core.map((f) => Number(f.toFixed(2)));
  const highOct = core.map((f) => Number((f * 2.0).toFixed(2)));
  const superOct = core.slice(0, 4).map((f) => Number((f * 4.0).toFixed(2)));

  return [...lowOct, ...midOct, ...highOct, ...superOct];
}

/**
 * Generative Multi-Phrase Melodic Composer:
 * Evolves continuously from `prevExtendedIdx` across 6 distinct musical phrase archetypes
 * (Ascending Run, Descending Cascade, Triad Arpeggio, Call & Response, Modal Jazz Skip, Octave Flourish)
 * so the melody never gets stuck hovering around a single center note or repeating a short loop.
 */
const MELODIC_PHRASE_PATTERNS: number[][] = [
  [1, 2, 1, 2, 3, -2, 1, 2],       // 0: Ascending scale climb
  [-1, -2, -1, -3, 1, -2, -1, -2], // 1: Descending cascade
  [2, 2, 3, -2, -2, 4, -3, 2],     // 2: Arpeggiated triad weave
  [4, -3, 5, -4, 3, -5, 4, -2],    // 3: Call & response register leaps
  [3, -1, 2, -4, 3, 1, -2, 4],     // 4: Syncopated modal skip
  [5, 2, -3, 6, -4, 3, -5, 2],     // 5: Wide dramatic contour
];

export function computeMelodicNotes(
  scale: number[],
  flowCombo: number,
  stepIndex: number,
  cfg: Pick<GameConfig, 'volNotes' | 'volIntervals' | 'volChords'>,
  prevExtendedIdx?: number
): number[] {
  if (!scale || scale.length === 0) return [261.63];

  const ext = buildExtendedScale(scale);
  const coreLen = Math.max(5, scale.length - 1);
  const defaultStartIdx = coreLen + Math.floor(coreLen * 0.3);

  let minIdx = Math.max(2, Math.floor(coreLen * 0.5));
  let maxIdx = Math.min(ext.length - 2, Math.floor(coreLen * 2.3));

  if (flowCombo >= FLOW_THRESHOLDS.OVERDRIVE) {
    minIdx = 1;
    maxIdx = ext.length - 1;
  } else if (flowCombo >= FLOW_THRESHOLDS.CHORD) {
    minIdx = 2;
    maxIdx = Math.min(ext.length - 1, coreLen * 3 - 1);
  } else if (flowCombo >= FLOW_THRESHOLDS.HARMONIC) {
    minIdx = Math.max(2, Math.floor(coreLen * 0.4));
    maxIdx = Math.min(ext.length - 1, Math.floor(coreLen * 2.6));
  }

  const s = Math.abs(stepIndex) + 1;
  const phraseIdx = Math.floor(s / 7) % MELODIC_PHRASE_PATTERNS.length;
  const stepInPhrase = s % 8;
  const pattern = MELODIC_PHRASE_PATTERNS[phraseIdx];

  const anchor =
    prevExtendedIdx !== undefined
      ? prevExtendedIdx
      : defaultStartIdx + ((s * 3) % coreLen);

  let intervalDelta = pattern[stepInPhrase];

  // Expand intervals at higher Flow for dramatic multi-octave leaps
  if (flowCombo >= FLOW_THRESHOLDS.CHORD && stepInPhrase % 2 === 0) {
    intervalDelta = intervalDelta > 0 ? intervalDelta + 3 : intervalDelta - 3;
  }

  // Add organic non-repeating variation based on golden ratio + step index
  const organicJitter =
    Math.floor(((s * 0.61803398875 + Math.sin(s * 2.17) * 0.5 + 1) % 1) * 3) - 1;
  let chosenIdx = anchor + intervalDelta + (stepInPhrase % 3 === 0 ? organicJitter : 0);

  // Reflect smoothly off the current octave boundaries so the melody sweeps end-to-end
  if (chosenIdx > maxIdx) {
    chosenIdx = maxIdx - Math.max(1, (chosenIdx - maxIdx) % Math.max(3, coreLen));
  } else if (chosenIdx < minIdx) {
    chosenIdx = minIdx + Math.max(1, (minIdx - chosenIdx) % Math.max(3, coreLen));
  }

  // Never repeat the exact same index twice in a row
  if (chosenIdx === anchor) {
    chosenIdx = anchor + 2 <= maxIdx ? anchor + 2 : Math.max(minIdx, anchor - 2);
  }

  chosenIdx = Math.max(minIdx, Math.min(maxIdx, chosenIdx));
  const leadFreq = ext[chosenIdx] || scale[0];
  const notes: number[] = [leadFreq];

  if (flowCombo >= FLOW_THRESHOLDS.HARMONIC && cfg.volIntervals > 0) {
    const fifthOrBass =
      s % 2 === 0
        ? Math.max(65, leadFreq * 0.5)
        : ext[Math.min(ext.length - 1, chosenIdx + 4)] || leadFreq * 1.5;
    notes.push(Number(fifthOrBass.toFixed(2)));
  }

  if (flowCombo >= FLOW_THRESHOLDS.CHORD && cfg.volChords > 0) {
    const upperIdx = Math.min(ext.length - 1, chosenIdx + 7);
    const upperFreq = ext[upperIdx] > leadFreq * 1.3 ? ext[upperIdx] : leadFreq * 2.0;
    notes.push(Number(upperFreq.toFixed(2)));
  }

  if (flowCombo >= FLOW_THRESHOLDS.OVERDRIVE && cfg.volChords > 0) {
    const highOvertone = leadFreq >= 520 ? leadFreq * 0.5 : leadFreq * 2.5;
    notes.push(Number(highOvertone.toFixed(2)));
  }

  return notes;
}

export interface SynthHarmonicContext {
  current?: number;
  prevTwo: number[];
  nextTwo: number[];
}

/**
 * Context-Aware Harmonic Synthesizer Selector:
 * Evaluates the currently played platform note (`current`), the 2 previous platform notes (`prevTwo`),
 * and the 2 upcoming platform notes (`nextTwo`), and selects the closest, most consonant harmonic
 * synthesizer pad note(s) from the biome's scale.
 */
export function computeContextualSynthHarmony(
  scale: number[],
  context: SynthHarmonicContext,
  lastSynthFreq?: number,
  includeSecondVoice = false
): number[] {
  const baseScale = scale && scale.length > 0 ? scale : [261.63, 293.66, 311.13, 349.23, 392.0, 415.3, 466.16, 523.25];
  const core =
    baseScale.length > 2 && Math.abs(baseScale[baseScale.length - 1] - baseScale[0] * 2) < 4
      ? baseScale.slice(0, -1)
      : baseScale;

  // Build candidate synth frequencies in warm low-mid pad register (0.5x and 1.0x octave)
  const candidates: number[] = [];
  for (let i = 0; i < core.length; i++) {
    candidates.push(Number((core[i] * 0.5).toFixed(2)));
  }
  for (let i = 0; i < core.length; i++) {
    candidates.push(Number(core[i].toFixed(2)));
  }

  const weightedContext: Array<{ freq: number; weight: number }> = [];
  if (context.current && context.current > 0) {
    weightedContext.push({ freq: context.current, weight: 2.4 });
  }
  for (let i = 0; i < context.prevTwo.length && i < 2; i++) {
    if (context.prevTwo[i] > 0) {
      weightedContext.push({ freq: context.prevTwo[i], weight: i === 0 ? 1.25 : 0.9 });
    }
  }
  for (let i = 0; i < context.nextTwo.length && i < 2; i++) {
    if (context.nextTwo[i] > 0) {
      weightedContext.push({ freq: context.nextTwo[i], weight: i === 0 ? 1.35 : 0.95 });
    }
  }

  if (weightedContext.length === 0) {
    const fallback = Number((core[0] * 0.5).toFixed(2));
    return includeSecondVoice
      ? [fallback, Number((core[Math.min(4, core.length - 1)] * 0.5).toFixed(2))]
      : [fallback];
  }

  // Evaluate harmonic consonance in semitone space (mod 12) + pitch proximity to context & lastSynthFreq
  const scoreCandidate = (candFreq: number): number => {
    let score = 0;
    for (let i = 0; i < weightedContext.length; i++) {
      const ref = weightedContext[i];
      const semitones = Math.abs(12 * Math.log2(candFreq / ref.freq)) % 12;
      const folded = semitones > 6 ? 12 - semitones : semitones;

      // Consonance profile: Perfect 5th (7 -> folded 5), Perfect 4th (5), Major/Minor 3rd (4, 3), Unison/Octave (0)
      let consonance = 0;
      if (Math.abs(folded - 5) < 0.55) {
        consonance = 1.0; // Perfect 4th / 5th (highest harmonic support)
      } else if (Math.abs(folded - 4) < 0.55 || Math.abs(folded - 3) < 0.55) {
        consonance = 0.92; // Major / Minor 3rd or 6th
      } else if (folded < 0.45) {
        consonance = 0.78; // Octave / Unison reinforcement
      } else if (Math.abs(folded - 2) < 0.55) {
        consonance = 0.48; // Warm 9th / 2nd color
      } else {
        consonance = -0.65; // Penalize minor 2nd (1) or tritone (6) clash
      }

      // Proximity in pitch register (prefer candidates close to 1 octave below the active melody)
      const targetPadFreq = ref.freq * 0.5;
      const octaveDistance = Math.abs(Math.log2(candFreq / targetPadFreq));
      const proximityBonus = Math.max(0, 1 - octaveDistance * 0.85) * 0.55;

      score += (consonance + proximityBonus) * ref.weight;
    }

    // Smooth voice-leading proximity to previous synth pad note, while avoiding identical note repeat
    if (lastSynthFreq && lastSynthFreq > 0) {
      const stepOctDist = Math.abs(Math.log2(candFreq / lastSynthFreq));
      if (stepOctDist < 0.02) {
        score -= 1.25; // Avoid droning on the exact same synth frequency twice in a row
      } else {
        score += Math.max(0, 0.85 - stepOctDist * 1.1); // Reward smooth harmonic voice leading
      }
    }

    return score;
  };

  let bestPrimary = candidates[0];
  let bestScore = -Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const s = scoreCandidate(candidates[i]);
    if (s > bestScore) {
      bestScore = s;
      bestPrimary = candidates[i];
    }
  }

  if (!includeSecondVoice) {
    return [bestPrimary];
  }

  // Pick a second complementary harmonic voice (3rd, 4th, or 5th away from bestPrimary)
  let bestSecondary = candidates[Math.min(2, candidates.length - 1)];
  let bestSecScore = -Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const intervalSemis = Math.abs(12 * Math.log2(cand / bestPrimary));
    if (intervalSemis < 2.5 || Math.abs(intervalSemis - 12) < 1.5) continue;
    const dyadSweetness =
      Math.abs(intervalSemis - 7) < 1.2 ||
      Math.abs(intervalSemis - 4) < 1.2 ||
      Math.abs(intervalSemis - 3) < 1.2 ||
      Math.abs(intervalSemis - 5) < 1.2
        ? 1.1
        : 0.2;
    const s = scoreCandidate(cand) + dyadSweetness;
    if (s > bestSecScore) {
      bestSecScore = s;
      bestSecondary = cand;
    }
  }

  return [bestPrimary, bestSecondary];
}

/**
 * Meaningful Flow Milestone & Reward Progression Calculator
 */
export interface FlowMilestoneInfo {
  currentTier: number;
  nextThreshold: number;
  progressPct: number;
  rewardLabel: string;
  activeBonusLabel: string;
}

export function getFlowMilestoneInfo(flowCombo: number, subStep = 0): FlowMilestoneInfo {
  const effectiveFlow = flowCombo + Math.max(0, Math.min(0.99, subStep / FLOW_PLATFORMS_PER_STEP));

  if (flowCombo < FLOW_THRESHOLDS.HARMONIC) {
    return {
      currentTier: 1,
      nextThreshold: FLOW_THRESHOLDS.HARMONIC,
      progressPct: Math.min(100, (effectiveFlow / FLOW_THRESHOLDS.HARMONIC) * 100),
      rewardLabel: `x${FLOW_THRESHOLDS.HARMONIC} · WARM PAD + BASS`,
      activeBonusLabel: 'CALM INTRO · WIDE PLATFORMS',
    };
  }
  if (flowCombo < FLOW_THRESHOLDS.SUBDIVISION) {
    const span = FLOW_THRESHOLDS.SUBDIVISION - FLOW_THRESHOLDS.HARMONIC;
    return {
      currentTier: 2,
      nextThreshold: FLOW_THRESHOLDS.SUBDIVISION,
      progressPct: Math.min(100, ((effectiveFlow - FLOW_THRESHOLDS.HARMONIC) / span) * 100),
      rewardLabel: `x${FLOW_THRESHOLDS.SUBDIVISION} · 3-RING RUNS + CHORD GATES`,
      activeBonusLabel: 'WARM PAD · DEEP BASS',
    };
  }
  if (flowCombo < FLOW_THRESHOLDS.CHORD) {
    const span = FLOW_THRESHOLDS.CHORD - FLOW_THRESHOLDS.SUBDIVISION;
    return {
      currentTier: 3,
      nextThreshold: FLOW_THRESHOLDS.CHORD,
      progressPct: Math.min(100, ((effectiveFlow - FLOW_THRESHOLDS.SUBDIVISION) / span) * 100),
      rewardLabel: `x${FLOW_THRESHOLDS.CHORD} · MULTI-OCTAVE LEAPS + SHIELD`,
      activeBonusLabel: 'CHORD GATES · 3-NOTE RINGS',
    };
  }
  if (flowCombo < FLOW_THRESHOLDS.OVERDRIVE) {
    const span = FLOW_THRESHOLDS.OVERDRIVE - FLOW_THRESHOLDS.CHORD;
    return {
      currentTier: 4,
      nextThreshold: FLOW_THRESHOLDS.OVERDRIVE,
      progressPct: Math.min(100, ((effectiveFlow - FLOW_THRESHOLDS.CHORD) / span) * 100),
      rewardLabel: `x${FLOW_THRESHOLDS.OVERDRIVE} · SYMPHONIC CLIMAX`,
      activeBonusLabel: 'WIDE OCTAVE LEAPS · DUAL PAD',
    };
  }
  const nextStep = Math.ceil((flowCombo + 1) / 5) * 5;
  const prevStep = nextStep - 5;
  return {
    currentTier: 5,
    nextThreshold: nextStep,
    progressPct: Math.min(100, ((effectiveFlow - prevStep) / 5) * 100),
    rewardLabel: `x${nextStep} · OMNI CRESCENDO`,
    activeBonusLabel: 'SYMPHONIC APEX · FULL SPECTRUM',
  };
}

export function evaluateBeatTiming(
  timeSec: number,
  bpm: number
): { beatPhase: number; isOnBeat: boolean; accuracy: number; label: 'PERFECT SYNC' | 'GOOD BEAT' | null } {
  const safeBpm = Math.max(60, Math.min(240, bpm || 104));
  const beatDuration = 60 / safeBpm;
  const phase = (timeSec % beatDuration) / beatDuration;
  const distToBeat = Math.min(phase, 1 - phase);

  if (distToBeat <= 0.18) {
    return { beatPhase: phase, isOnBeat: true, accuracy: 1.0, label: 'PERFECT SYNC' };
  }
  if (distToBeat <= 0.28) {
    return { beatPhase: phase, isOnBeat: true, accuracy: 0.75, label: 'GOOD BEAT' };
  }
  return { beatPhase: phase, isOnBeat: false, accuracy: 0.0, label: null };
}

export function calculateStyleRank(flowCombo: number, styleMeter: number): {
  rank: StyleRank;
  color: string;
  title: string;
  multiplier: number;
} {
  const composite = flowCombo * 8 + styleMeter * 0.6;
  if (composite >= 135 || flowCombo >= FLOW_THRESHOLDS.OVERDRIVE) {
    return { rank: 'OMNI', color: '#00ffcc', title: 'TRANSCENDENT OMNI', multiplier: 2.0 };
  }
  if (composite >= 100 || flowCombo >= 10) {
    return { rank: 'SS', color: '#ff2a85', title: 'SYMPHONIC SOVEREIGN', multiplier: 1.75 };
  }
  if (composite >= 72 || flowCombo >= FLOW_THRESHOLDS.CHORD) {
    return { rank: 'S', color: '#ffb800', title: 'HARMONIC VIRTUOSO', multiplier: 1.5 };
  }
  if (composite >= 48 || flowCombo >= FLOW_THRESHOLDS.SUBDIVISION) {
    return { rank: 'A', color: '#00d4ff', title: 'HARMONIC ARCHITECT', multiplier: 1.35 };
  }
  if (composite >= 26 || flowCombo >= FLOW_THRESHOLDS.HARMONIC) {
    return { rank: 'B', color: '#a855f7', title: 'RESONANCE RUNNER', multiplier: 1.2 };
  }
  if (composite >= 10 || flowCombo >= 1) {
    return { rank: 'C', color: '#38bdf8', title: 'SIGNAL SEEKER', multiplier: 1.1 };
  }
  return { rank: 'D', color: '#64748b', title: 'DORMANT CARRIER', multiplier: 1.0 };
}

export function stepSquashStretch(
  scaleX: number,
  scaleY: number,
  dt: number,
  stiffness = 14
): { scaleX: number; scaleY: number } {
  const factor = Math.min(1, dt * stiffness);
  return {
    scaleX: scaleX + (1 - scaleX) * factor,
    scaleY: scaleY + (1 - scaleY) * factor,
  };
}

/**
 * Shuffles an array using Fisher-Yates for randomized biome sequence each run.
 */
export function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Fixed-Capacity Object Pool for Particles (Bug Fix #3)
 */
export interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  kind: 'spark' | 'dust' | 'ring' | 'note';
}

export class ParticlePool {
  readonly items: PooledParticle[];
  private cursor = 0;

  constructor(capacity = 320) {
    this.items = Array.from({ length: capacity }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 4,
      life: 0,
      maxLife: 1,
      color: '#ffffff',
      kind: 'spark',
    }));
  }

  spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    color: string,
    size = 4,
    maxLife = 1.0,
    kind: PooledParticle['kind'] = 'spark'
  ): void {
    const p = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.color = color;
    p.size = size;
    p.life = maxLife;
    p.maxLife = maxLife;
    p.kind = kind;
  }

  burst(
    x: number,
    y: number,
    color: string,
    count: number,
    speed = 5,
    kind: PooledParticle['kind'] = 'spark'
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const spd = (0.35 + Math.random() * 0.65) * speed;
      this.spawn(
        x,
        y,
        Math.cos(angle) * spd,
        Math.sin(angle) * spd - (kind === 'dust' ? 1.0 : 0),
        color,
        kind === 'ring' ? 10 : 2.5 + Math.random() * 2.5,
        0.4 + Math.random() * 0.4,
        kind
      );
    }
  }

  update(dt: number): void {
    const step = dt * 60;
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i];
      if (!p.active) continue;
      p.x += p.vx * step;
      p.y += p.vy * step;
      if (p.kind === 'spark') {
        p.vy += 0.12 * step;
      } else if (p.kind === 'ring') {
        p.size += 2.2 * step;
      }
      p.life -= 0.032 * step;
      if (p.life <= 0) {
        p.active = false;
      }
    }
  }

  clear(): void {
    for (let i = 0; i < this.items.length; i++) {
      this.items[i].active = false;
    }
  }

  activeCount(): number {
    let c = 0;
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].active) c++;
    }
    return c;
  }
}

export interface PlatformEntity {
  id: number;
  x: number;
  centerX: number;
  y: number;
  w: number;
  targetW: number;
  h: number;
  type: PlatformArchetype;
  vx: number;
  vy: number;
  minX: number;
  maxX: number;
  hit: boolean;
  repeatBounces: number;
  themeIdx: number;
  noteLabel?: string;
  noteFreq?: number;
  noteCluster?: number[];
  crumbleTimer: number;
  broken: boolean;
  respawnTimer: number;
  phaseSolid: boolean;
  hasHazard?: boolean;
  hazardXOffset?: number;
  hazardWidth?: number;
  // 4-Gate Chord Progression properties
  chordGateIndex?: 0 | 1 | 2 | 3;
  chordProgressionVariant?: number;
  chordNameOverride?: string;
  nextGateId?: number;
  nextGateX?: number;
  nextGateY?: number;
  // Custom / MIDI Stage Note-Duration Kinematics, Per-Bar Biome Key & Synth Channel
  beatDurationRatio?: number;
  customStepY?: number;
  customGravityPxPerSec2?: number;
  customJumpVelocityPxPerSec?: number;
  customClusterFreqs?: number[];
  customSynthFreqs?: number[];
  customSynthDurationSec?: number;
  customBiomeId?: number;
  synthFreqs?: number[];
  synthDurationBeats?: number;
}

export interface AerialHazardEntity {
  id: number;
  x: number;
  y: number;
  vx: number;
  minX: number;
  maxX: number;
  radius: number;
  active?: boolean;
  hit?: boolean;
  phase: number;
}

export interface HarmonicOrb {
  id: number;
  x: number;
  y: number;
  baseY: number;
  radius: number;
  collected: boolean;
  freq: number;
  color: string;
  phase: number;
}

export interface RunUpgrade {
  id: 'double_jump' | 'orb_magnet' | 'combo_shield' | 'dash_capacitor' | 'rhythm_aura';
  name: string;
  desc: string;
  icon: string;
  durationSec: number;
}

export interface ActivePowerUp {
  id: RunUpgrade['id'];
  name: string;
  icon: string;
  remainingSec: number;
  durationSec: number;
}

export const RUN_UPGRADES: RunUpgrade[] = [
  {
    id: 'double_jump',
    name: 'AERO THRUSTERS',
    desc: 'Mid-Air Boost Jump [Space]',
    icon: '⇈',
    durationSec: 15,
  },
  {
    id: 'orb_magnet',
    name: 'HARMONIC MAGNET',
    desc: 'Pulls nearby Harmonic Orbs',
    icon: '◎',
    durationSec: 15,
  },
  {
    id: 'combo_shield',
    name: 'PHASE AEGIS SHIELD',
    desc: 'Absorbs hazard or fall once',
    icon: '❖',
    durationSec: 16,
  },
  {
    id: 'dash_capacitor',
    name: 'HYPER CAPACITOR',
    desc: 'Fast Dash recharge & wide wave',
    icon: '⚡',
    durationSec: 15,
  },
  {
    id: 'rhythm_aura',
    name: 'RESONANCE AMPLIFIER',
    desc: '+50% Harmonic Score Multiplier',
    icon: '♫',
    durationSec: 15,
  },
];

export function tickActivePowerUps(list: ActivePowerUp[], dt: number): ActivePowerUp[] {
  const next: ActivePowerUp[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const rem = item.remainingSec - dt;
    if (rem > 0) {
      next.push({ ...item, remainingSec: rem });
    }
  }
  return next;
}
