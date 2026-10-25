/**
 * Pure game rules, color manipulation utilities, multi-octave generative melodic composer,
 * dynamic Flow-based difficulty scaling, 4-gate harmonic chord progressions,
 * 8 Lo-Fi/Cyberpunk/CRT sound banks, 27 world/modal musical scales, and zero-GC object pools
 * for NEON ASCENT: OMNI.
 */

export interface FineTuneConfig {
  flowGainRate: number;           // Multiplier for Flow gained per platform/orb (default 1.2)
  flowDecayRate: number;          // Multiplier for Flow decay when stalling (default 0.7)
  difficultyRampSpeed: number;    // Speed at which platform width narrows with Altitude (M) (0.1..10.0, default 3.0)
  minPlatformWidth: number;       // Minimum platform width at high Altitude (default 64px)
  maxPlatformWidth: number;       // Starting platform width at 0M Altitude (default 174px)
  horizontalScatterMult: number;  // Horizontal distance multiplier between platforms (default 1.4)
  wideLeapSpawnRate: number;      // Multiplier for max-distance opposite-direction platform leaps as Flow rises (default 2.1)
  fragileSpawnRate: number;       // Multiplier for fragile (crumble) platform probability as Flow rises (default 1.5)
  fragileStreakChance: number;    // Probability multiplier of spawning consecutive fragile platform streaks (default 1.5)
  fragileStreakMaxLen: number;    // Maximum consecutive fragile platforms in a streak (default 5)
  disguisedFragileChance: number; // Probability (0..1) that a fragile platform is disguised as a normal platform (default 0.22)
  biomePlatformDuration: number;  // Number of platforms before shifting to the next Biome (default 60)
  biomeShiftSpeed: number;        // Speed multiplier for visual/musical biome transition dissolve (default 0.9)
  orbSpawnRate: number;           // Probability of spawning an Orb on/between platforms (default 0.35)
  orbScatterSpread: number;       // Vertical/horizontal spread of Orbs (default 1.0)
  spikeHazardRate: number;        // Multiplier for on-platform spike probability (default 1.6)
  aerialDroneRate: number;        // Multiplier for mid-air drone probability (default 1.7)
  enemyMoveSpeedMult: number;     // Multiplier for enemy movement speed (default 2.7)
  enemyMoveRangeMult: number;     // Multiplier for enemy horizontal patrol displacement range (default 2.1)
  hazardFlowPenalty: number;      // Multiplier for Flow lost on hazard collision (default 1.0)
  powerUpDurationSec: number;     // Base duration of temporary power-ups in seconds (default 15)
  chordGateCooldownSteps: number; // Platforms between 4-Gate Chord chains (default 20)
  baseMoveSpeed: number;          // Horizontal steering speed in px/s (default 370)
  baseJumpTempo: number;          // Base auto-bounce tempo in BPM equivalent (default 100)
  minJumpBpm: number;             // Minimum Jump Speed (BPM) at Flow 0 (96..250, default 100)
  maxJumpBpm: number;             // Maximum Jump Speed (BPM) at High Flow (96..250, default 165)
  heartSpawnRate: number;         // Spawn rate for mid-air Heart Health Pickups, capped strictly below drone rate (default 0.18)
  dashBoostPowerMult: number;     // Multiplier for Dash horizontal velocity & upward lift boost (default 1.25)
}

export const DEFAULT_FINE_TUNE: FineTuneConfig = {
  flowGainRate: 1.2,
  flowDecayRate: 0.7,
  difficultyRampSpeed: 3.0,
  minPlatformWidth: 64,
  maxPlatformWidth: 174,
  horizontalScatterMult: 1.4,
  wideLeapSpawnRate: 2.1,
  fragileSpawnRate: 1.5,
  fragileStreakChance: 1.5,
  fragileStreakMaxLen: 5,
  disguisedFragileChance: 0.22,
  biomePlatformDuration: 60,
  biomeShiftSpeed: 0.9,
  orbSpawnRate: 0.35,
  orbScatterSpread: 1.0,
  spikeHazardRate: 1.6,
  aerialDroneRate: 1.7,
  enemyMoveSpeedMult: 2.7,
  enemyMoveRangeMult: 2.1,
  hazardFlowPenalty: 1.0,
  powerUpDurationSec: 15,
  chordGateCooldownSteps: 20,
  baseMoveSpeed: 370,
  baseJumpTempo: 100,
  minJumpBpm: 100,
  maxJumpBpm: 165,
  heartSpawnRate: 0.18,
  dashBoostPowerMult: 1.25,
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
  melodyMode?: 'curated' | 'random';
  disabledMelodies?: string[];
  powerUpLevels?: Record<string, number>;
  equippedPowerUps?: string[];
  language?: 'en' | 'fa';
  playerXp?: number;
  playerLevel?: number;
  betaUnlockSecretSkins?: boolean;
  tutorialSeen?: boolean;
  customBiomes?: ScaleBiome[];
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
    costOrbs: 40,
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
    id: 'akira_fm',
    name: 'Neo-Tokyo FM Bell',
    category: 'CYBERPUNK',
    desc: 'Crystalline 2-operator FM synthesis bell with metallic harmonic overtones',
    costOrbs: 75,
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
    costOrbs: 90,
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
    costOrbs: 100,
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
    costOrbs: 120,
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
    costOrbs: 140,
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
  volNotes: 1.4,
  volIntervals: 0.8,
  volChords: 0.7,
  volBass: 0.8,
  volDrums: 0.0,
  volChoir: 0.5,
  volSfx: 0.95,
  useBiomes: true,
  fixedColor: '#00ff88',
  playerShape: 'triangle',
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
  language: 'en',
  playerXp: 0,
  playerLevel: 0,
  betaUnlockSecretSkins: false,
  tutorialSeen: false,
  customBiomes: [],
  powerUpLevels: {
    combo_shield: 1,
  },
  equippedPowerUps: ['combo_shield'],
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
  isCustom?: boolean;
  activeChromaticKeys?: number[];
  tripletNotes?: [string, string, string];
  tripletFreqs?: [number, number, number];
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
    costOrbs: 30,
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
    costOrbs: 40,
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
    costOrbs: 40,
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

  // --- 20 PURCHASABLE WORLD, BLUES, ARABIC, JAPANESE, NORSE & EXOTIC SCALES (+150% PRICES) ---
  {
    id: 7,
    name: 'MIDNIGHT BLUES',
    subtitle: 'C Hexatonic Blues',
    tradition: 'BLUES LO-FI',
    costOrbs: 50,
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
    costOrbs: 60,
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
    costOrbs: 70,
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
    costOrbs: 60,
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
    costOrbs: 70,
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
    costOrbs: 80,
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
    costOrbs: 60,
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
    costOrbs: 70,
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
    costOrbs: 80,
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
    costOrbs: 80,
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
    costOrbs: 75,
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
    costOrbs: 90,
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
    costOrbs: 90,
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
    costOrbs: 100,
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
    costOrbs: 80,
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
    costOrbs: 90,
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
    costOrbs: 80,
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
    costOrbs: 100,
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
    costOrbs: 110,
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
    costOrbs: 120,
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

/**
 * Smart HSL-to-HEX and Custom Biome Builder:
 * Converts HSL (h: 0..360, s: 0..100, l: 0..100) to HEX and automatically derives
 * cohesive foreground, deep atmospheric background accent, and luminous horizon gradient colors.
 */
export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const light = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hue < 60) {
    r1 = c; g1 = x; b1 = 0;
  } else if (hue < 120) {
    r1 = x; g1 = c; b1 = 0;
  } else if (hue < 180) {
    r1 = 0; g1 = c; b1 = x;
  } else if (hue < 240) {
    r1 = 0; g1 = x; b1 = c;
  } else if (hue < 300) {
    r1 = x; g1 = 0; b1 = c;
  } else {
    r1 = c; g1 = 0; b1 = x;
  }

  return rgbToHex((r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255);
}

export function computeSmartHslBiomePalette(hue: number, sat = 90, light = 56): {
  fg: string;
  bgAccent: string;
  horizonColor: string;
} {
  const fg = hslToHex(hue, sat, light);
  const bgAccent = hslToHex((hue + 8) % 360, Math.max(55, sat - 10), 13);
  const horizonColor = hslToHex((hue + 342) % 360, Math.min(100, sat + 5), Math.min(82, light + 22));
  return { fg, bgAccent, horizonColor };
}

export const CHROMATIC_12_NOTES: Array<{ index: number; noteName: string; shortName: string; freq: number }> = [
  { index: 0, noteName: 'C4', shortName: 'C', freq: 261.63 },
  { index: 1, noteName: 'C#4', shortName: 'C#', freq: 277.18 },
  { index: 2, noteName: 'D4', shortName: 'D', freq: 293.66 },
  { index: 3, noteName: 'Eb4', shortName: 'Eb', freq: 311.13 },
  { index: 4, noteName: 'E4', shortName: 'E', freq: 329.63 },
  { index: 5, noteName: 'F4', shortName: 'F', freq: 349.23 },
  { index: 6, noteName: 'F#4', shortName: 'F#', freq: 369.99 },
  { index: 7, noteName: 'G4', shortName: 'G', freq: 392.00 },
  { index: 8, noteName: 'Ab4', shortName: 'Ab', freq: 415.30 },
  { index: 9, noteName: 'A4', shortName: 'A', freq: 440.00 },
  { index: 10, noteName: 'Bb4', shortName: 'Bb', freq: 466.16 },
  { index: 11, noteName: 'B4', shortName: 'B', freq: 493.88 },
];

export interface CustomBiomeCreatorInput {
  id?: number;
  name: string;
  subtitle?: string;
  hue: number;
  saturation?: number;
  lightness?: number;
  /** Indices 0..11 of CHROMATIC_12_NOTES; defaults to all 12 notes active! */
  activeChromaticKeys?: number[];
  chordNames?: [string, string, string, string];
  /** 4 chords, each an array of 4 chromatic indices (0..11) */
  chordKeyIndices?: [[number, number, number, number], [number, number, number, number], [number, number, number, number], [number, number, number, number]];
  /** 3 chromatic indices (0..11) for the 3-note triplet run */
  tripletKeyIndices?: [number, number, number];
}

export function createCustomBiomeFromHsl(input: CustomBiomeCreatorInput): ScaleBiome {
  const palette = computeSmartHslBiomePalette(
    input.hue,
    input.saturation ?? 90,
    input.lightness ?? 56
  );

  // Default: all 12 chromatic keys active
  const rawKeys =
    input.activeChromaticKeys && input.activeChromaticKeys.length > 0
      ? input.activeChromaticKeys
      : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const sortedKeys = Array.from(new Set(rawKeys.map((k) => Math.max(0, Math.min(11, k))))).sort(
    (a, b) => a - b
  );

  const scale = sortedKeys.map((idx) => CHROMATIC_12_NOTES[idx].freq);
  const noteNames = sortedKeys.map((idx) => CHROMATIC_12_NOTES[idx].noteName);
  // Ensure at least 6 notes in scale array for downstream octave builders
  while (scale.length < 6) {
    const baseIdx = scale.length % sortedKeys.length;
    scale.push(Number((scale[baseIdx] * 2).toFixed(2)));
    noteNames.push(noteNames[baseIdx].replace('4', '5'));
  }

  const defaultChordIndices: [[number, number, number, number], [number, number, number, number], [number, number, number, number], [number, number, number, number]] = [
    [sortedKeys[0] ?? 0, sortedKeys[Math.min(2, sortedKeys.length - 1)] ?? 3, sortedKeys[Math.min(4, sortedKeys.length - 1)] ?? 7, sortedKeys[Math.min(6, sortedKeys.length - 1)] ?? 10],
    [sortedKeys[Math.min(3, sortedKeys.length - 1)] ?? 5, sortedKeys[Math.min(5, sortedKeys.length - 1)] ?? 8, sortedKeys[0] ?? 0, sortedKeys[Math.min(2, sortedKeys.length - 1)] ?? 3],
    [sortedKeys[Math.min(4, sortedKeys.length - 1)] ?? 7, sortedKeys[Math.min(6, sortedKeys.length - 1)] ?? 10, sortedKeys[Math.min(1, sortedKeys.length - 1)] ?? 2, sortedKeys[Math.min(3, sortedKeys.length - 1)] ?? 5],
    [sortedKeys[Math.min(5, sortedKeys.length - 1)] ?? 8, sortedKeys[0] ?? 0, sortedKeys[Math.min(2, sortedKeys.length - 1)] ?? 3, sortedKeys[Math.min(4, sortedKeys.length - 1)] ?? 7],
  ];

  const cIndices = input.chordKeyIndices || defaultChordIndices;
  const chords = cIndices.map((grp) =>
    grp.map((chromIdx, pos) => {
      const f = CHROMATIC_12_NOTES[Math.max(0, Math.min(11, chromIdx))].freq;
      if (pos === 0) return Number((f * 0.5).toFixed(2));
      if (pos === 3) return Number((f * 2.0).toFixed(2));
      return Number(f.toFixed(2));
    })
  ) as [number[], number[], number[], number[]];

  const chordNames: [string, string, string, string] = input.chordNames || [
    `${CHROMATIC_12_NOTES[cIndices[0][0]]?.shortName || 'C'}m9`,
    `${CHROMATIC_12_NOTES[cIndices[1][0]]?.shortName || 'F'}maj7`,
    `${CHROMATIC_12_NOTES[cIndices[2][0]]?.shortName || 'G'}7sus4`,
    `${CHROMATIC_12_NOTES[cIndices[3][0]]?.shortName || 'Ab'}add9`,
  ];

  const tIndices: [number, number, number] = input.tripletKeyIndices || [
    sortedKeys[0] ?? 0,
    sortedKeys[Math.min(2, sortedKeys.length - 1)] ?? 4,
    sortedKeys[Math.min(4, sortedKeys.length - 1)] ?? 7,
  ];
  const tripletNotes: [string, string, string] = [
    CHROMATIC_12_NOTES[tIndices[0]]?.noteName || 'C4',
    CHROMATIC_12_NOTES[tIndices[1]]?.noteName || 'E4',
    CHROMATIC_12_NOTES[tIndices[2]]?.noteName || 'G4',
  ];
  const tripletFreqs: [number, number, number] = [
    CHROMATIC_12_NOTES[tIndices[0]]?.freq || 261.63,
    CHROMATIC_12_NOTES[tIndices[1]]?.freq || 329.63,
    CHROMATIC_12_NOTES[tIndices[2]]?.freq || 392.00,
  ];

  return {
    id: input.id ?? 100 + Math.floor(Math.random() * 899),
    name: (input.name || 'CUSTOM BIOME').toUpperCase(),
    subtitle: input.subtitle || `${sortedKeys.length}-Key Custom Scale`,
    tradition: 'CUSTOM DAW',
    costOrbs: 0,
    fg: palette.fg,
    bgAccent: palette.bgAccent,
    horizonColor: palette.horizonColor,
    scale,
    noteNames,
    chordNames,
    chords,
    isCustom: true,
    activeChromaticKeys: sortedKeys,
    tripletNotes,
    tripletFreqs,
  };
}

export type ProChordQuality = 'Major' | 'Minor' | 'Dim' | 'Aug' | 'Sus2' | 'Sus4';
export type ProChordExtension = 'None' | '7th' | 'maj7' | '9th' | '11th' | '13th';

export function buildProChordFromSpec(
  rootIdx: number,
  quality: ProChordQuality,
  extension: ProChordExtension
): {
  chordName: string;
  chromaticIndices: [number, number, number, number];
  freqs: [number, number, number, number];
} {
  const r = ((Math.round(rootIdx) % 12) + 12) % 12;
  const rootName = CHROMATIC_12_NOTES[r]?.shortName || 'C';

  // Triad intervals in semitones from root
  let third = 4;
  let fifth = 7;
  let qualSuffix = '';
  switch (quality) {
    case 'Major':
      third = 4;
      fifth = 7;
      qualSuffix = '';
      break;
    case 'Minor':
      third = 3;
      fifth = 7;
      qualSuffix = 'm';
      break;
    case 'Dim':
      third = 3;
      fifth = 6;
      qualSuffix = 'dim';
      break;
    case 'Aug':
      third = 4;
      fifth = 8;
      qualSuffix = 'aug';
      break;
    case 'Sus2':
      third = 2;
      fifth = 7;
      qualSuffix = 'sus2';
      break;
    case 'Sus4':
      third = 5;
      fifth = 7;
      qualSuffix = 'sus4';
      break;
  }

  let extInterval = 12; // Default octave doubling if 'None'
  let extSuffix = '';
  switch (extension) {
    case 'None':
      extInterval = 12;
      extSuffix = '';
      break;
    case '7th':
      extInterval = quality === 'Dim' ? 9 : 10;
      extSuffix = '7';
      break;
    case 'maj7':
      extInterval = 11;
      extSuffix = quality === 'Minor' || quality === 'Dim' ? '(maj7)' : 'maj7';
      break;
    case '9th':
      extInterval = 14;
      extSuffix = quality === 'Major' ? 'add9' : '9';
      break;
    case '11th':
      extInterval = 17;
      extSuffix = '11';
      break;
    case '13th':
      extInterval = 21;
      extSuffix = '13';
      break;
  }

  const i0 = r;
  const i1 = (r + third) % 12;
  const i2 = (r + fifth) % 12;
  const i3 = (r + extInterval) % 12;

  const f0 = Number((CHROMATIC_12_NOTES[i0].freq * 0.5).toFixed(2));
  const f1 = Number(CHROMATIC_12_NOTES[i1].freq.toFixed(2));
  const f2 = Number(CHROMATIC_12_NOTES[i2].freq.toFixed(2));
  const f3 = Number((CHROMATIC_12_NOTES[i3].freq * (extInterval >= 12 ? 2.0 : 1.0)).toFixed(2));

  const chordName =
    (quality === 'Sus2' || quality === 'Sus4') && extension !== 'None'
      ? `${rootName}${extSuffix}${qualSuffix}`
      : `${rootName}${qualSuffix}${extSuffix}`;

  return {
    chordName,
    chromaticIndices: [i0, i1, i2, i3],
    freqs: [f0, f1, f2, f3],
  };
}

export const FREE_12_KEY_BIOME: ScaleBiome = createCustomBiomeFromHsl({
  id: 99,
  name: 'CHROMATIC FREE (12-KEY)',
  subtitle: 'All 12 Chromatic Notes · Unclamped MIDI & DAW',
  hue: 192,
  saturation: 92,
  lightness: 58,
  activeChromaticKeys: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  chordNames: ['Cm9', 'Abmaj7', 'Fm9', 'G7sus4'],
  chordKeyIndices: [
    [0, 3, 7, 10],
    [8, 0, 3, 7],
    [5, 8, 0, 3],
    [7, 0, 2, 5],
  ],
  tripletKeyIndices: [0, 4, 7],
});

export function getAllBiomes(customBiomes?: ScaleBiome[], includeChromaticFree = false): ScaleBiome[] {
  const base = includeChromaticFree ? [...MASTER_SCALES, FREE_12_KEY_BIOME] : MASTER_SCALES;
  if (!customBiomes || customBiomes.length === 0) return base;
  const filtered = customBiomes.filter((b) => b.id !== 99);
  return [...base, ...filtered];
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
  altitudeFactor: number; // 0.0 -> 1.0 based on Altitude (M) and difficultyRampSpeed
  targetPlatformWidth: number;
  stepY: number;
  minHorizDist: number;
  maxHorizDist: number;
  wideLeapChance: number;
  fragilePlatformChance: number;
  fragileStreakChance: number;
  fragileStreakMaxLen: number;
  disguisedFragileChance: number;
  movingFragileChance: number; // Probability that a fragile platform also moves horizontally
  paceMultiplier: number;
  dynamicJumpBpm: number;      // Jump tempo (BPM) accelerating from minJumpBpm to maxJumpBpm with Flow
  moveSpeedPxPerSec: number;
  movingPlatformChance: number;
  platformHazardChance: number;
  maxSpikeCount: number;       // Max spikes in a single cluster (2 up to 7 at high Flow)
  aerialHazardChance: number;
  heartPickupChance: number;   // Rare heart pickup probability, strictly < aerialHazardChance
  enemySpeedPxPerSec: number;
  enemyHalfRangePx: number;
}

export function computeFlowDynamicDifficulty(
  flowEnergy: number,
  fineTune: FineTuneConfig = DEFAULT_FINE_TUNE,
  altitudeMeters = 0
): FlowDynamicDifficulty {
  const ft = { ...DEFAULT_FINE_TUNE, ...fineTune };
  // Smooth Flow curve above Flow 18 so Flow 20+ remains playable and rewarding
  const rawFlow = Math.max(0, flowEnergy);
  const dampedFlow =
    rawFlow <= 18
      ? rawFlow
      : 18 + (rawFlow - 18) * 0.55;
  const clampedFlow = Math.max(0, Math.min(45, dampedFlow));
  const f = clampedFlow / 45; // 0.0 at Flow 0 -> 1.0 at damped max

  const maxW = Math.max(100, ft.maxPlatformWidth);
  const minW = Math.max(58, Math.min(maxW, ft.minPlatformWidth));

  // Platform width narrows strictly based on Altitude Meters (M) and difficultyRampSpeed (0.1..10.0)
  const rampSpeed = Math.max(0.1, Math.min(10.0, ft.difficultyRampSpeed ?? 3.0));
  const safeAltMeters = Math.max(0, altitudeMeters);
  const fullNarrowingMeters = Math.max(35, 540 / rampSpeed);
  const altitudeFactor = Math.max(0, Math.min(1, safeAltMeters / fullNarrowingMeters));
  const targetPlatformWidth = Math.round(maxW - altitudeFactor * (maxW - minW));

  // Jump Speed (BPM) accelerates with Flow between minJumpBpm and maxJumpBpm (96..250 BPM)
  const minBpm = Math.max(96, Math.min(250, ft.minJumpBpm ?? ft.baseJumpTempo ?? 100));
  const maxBpm = Math.max(minBpm, Math.min(250, ft.maxJumpBpm ?? 165));
  const dynamicJumpBpm = Math.round(minBpm + f * (maxBpm - minBpm));

  // Fragile platform probability scales smoothly and caps at a fair level (0.52 max)
  const rawFragile = (0.05 + f * 0.30) * (ft.fragileSpawnRate ?? 1.5);
  const fragilePlatformChance = Number(Math.max(0, Math.min(0.52, rawFragile)).toFixed(2));
  const fragileStreakChance = Number(
    Math.max(0, Math.min(0.65, (ft.fragileStreakChance ?? 1.5) * (0.28 + f * 0.55))).toFixed(2)
  );
  const fragileStreakMaxLen = Math.max(2, Math.min(5, Math.round(ft.fragileStreakMaxLen ?? 5)));
  const disguisedFragileChance = Number(
    Math.max(0, Math.min(0.42, (ft.disguisedFragileChance ?? 0.22) * (0.25 + f * 1.15))).toFixed(2)
  );
  // Moving + Fragile combination probability rises with Flow
  const movingFragileChance = Number(
    Math.max(0, Math.min(0.65, flowEnergy < 2 ? 0.05 : 0.1 + f * 0.48)).toFixed(2)
  );

  // Spike cluster count scales with Flow up to 7 spikes per cluster
  const maxSpikeCount =
    flowEnergy < 5
      ? 2
      : flowEnergy < 9
        ? 3
        : flowEnergy < 13
          ? 4
          : flowEnergy < 17
            ? 5
            : flowEnergy < 22
              ? 6
              : 7;

  const platformHazardChance =
    flowEnergy < 3 ? 0 : Number(Math.min(0.45, (0.04 + f * 0.13) * ft.spikeHazardRate).toFixed(2));
  const aerialHazardChance =
    flowEnergy < 4 ? 0 : Number(Math.min(0.45, (0.04 + f * 0.14) * ft.aerialDroneRate).toFixed(2));

  // Heart pickup spawn rate is configurable via heartSpawnRate and ALWAYS strictly less than aerialHazardChance
  const rawHeartChance = Math.max(0, (ft.heartSpawnRate ?? 0.18) * (0.22 + f * 0.45));
  const effectiveEnemyRate = Math.max(0.04, aerialHazardChance > 0 ? aerialHazardChance : 0.08 * ft.aerialDroneRate);
  const heartPickupChance =
    (ft.heartSpawnRate ?? 0.18) <= 0
      ? 0
      : Number(Math.min(rawHeartChance, effectiveEnemyRate * 0.55).toFixed(3));

  const enemySpeedMult = Math.max(0.2, ft.enemyMoveSpeedMult ?? 2.7);
  const enemyRangeMult = Math.max(0.3, ft.enemyMoveRangeMult ?? 2.1);

  return {
    flowFactor: f,
    altitudeFactor,
    targetPlatformWidth,
    stepY: 134,
    minHorizDist: Math.round(92 * ft.horizontalScatterMult),
    maxHorizDist: Math.round(184 * ft.horizontalScatterMult),
    wideLeapChance: Number(
      Math.min(0.58, (0.06 + f * 0.36) * (ft.wideLeapSpawnRate ?? 2.1)).toFixed(2)
    ),
    fragilePlatformChance,
    fragileStreakChance,
    fragileStreakMaxLen,
    disguisedFragileChance,
    movingFragileChance,
    paceMultiplier: 0.9,
    dynamicJumpBpm,
    moveSpeedPxPerSec: ft.baseMoveSpeed,
    movingPlatformChance: Number((0.06 + f * 0.18).toFixed(2)),
    platformHazardChance,
    maxSpikeCount,
    aerialHazardChance,
    heartPickupChance,
    enemySpeedPxPerSec: Math.round((68 + f * 82) * enemySpeedMult),
    enemyHalfRangePx: Math.round((95 + f * 55) * enemyRangeMult),
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
  const safeTempo = Math.max(60, Math.min(250, tempoHint || 100));
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
  const safeBpm = Math.max(50, Math.min(250, bpm || 100));
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
  spikeCount?: number;
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
  tripletFreqs?: [number, number, number];
  disguisedFragile?: boolean;
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

export interface HeartPickupEntity {
  id: number;
  x: number;
  y: number;
  baseY: number;
  radius: number;
  collected: boolean;
  healAmount: number;
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
  magnetLocked?: boolean;
}

export type PowerUpItemId =
  | 'orb_magnet'
  | 'combo_shield'
  | 'dash_capacitor'
  | 'rhythm_aura'
  | 'chrono_slow'
  | 'star_rain'
  | 'jetpack_white'
  | 'jetpack_gold'
  | 'jetpack_prism'
  | 'dash_turbine'
  | 'dash_shockwave'
  | 'wall_bounce'
  | 'nano_heal'
  | 'vital_core';

export type PowerUpCategory = 'ACTIVE' | 'JETPACK' | 'DASH_MOD';
export type PowerUpActivationMode = 'ACTIVE' | 'PASSIVE';
export type PowerUpTier = 'standard' | 'gold' | 'rainbow';

export interface RunUpgrade {
  id: PowerUpItemId;
  name: string;
  desc: string;
  icon: string;
  durationSec: number;
}

export interface ActivePowerUp {
  id: PowerUpItemId;
  name: string;
  icon: string;
  remainingSec: number;
  durationSec: number;
}

export interface EquippedPowerUpSlotRuntime {
  id: PowerUpItemId;
  level: number;
  name: string;
  icon: string;
  accentColor: string;
  tier?: PowerUpTier;
  activationMode: PowerUpActivationMode;
  phase: 'charging' | 'ready' | 'active' | 'cooldown' | 'depleted';
  chargeProgress: number; // 0.0 (empty at start/cooldown) -> 1.0 (ready)
  chargeTimeSec: number;
  cooldownSec: number;
  durationSec: number;
  activeRemainingSec: number;
  usesLeft: number;
  maxUses: number;
  powerValue: number;
}

export interface PowerUpStoreDef {
  id: PowerUpItemId;
  name: string;
  category: PowerUpCategory;
  activationMode: PowerUpActivationMode;
  maxLevel: number;
  tier: PowerUpTier;
  icon: string;
  accentColor: string;
  shortBenefit: string;
  desc: string;
  baseUnlockCost: number;
  baseUpgradeStepCost: number;
  baseUsesPerRun: number;
  maxUsesAtLv10: number;
  baseDurationSec: number;
  maxDurationAtLv10: number;
  baseCooldownSec: number;
  minCooldownAtLv10: number;
}

export type PowerUpStoreItemDef = PowerUpStoreDef;

export const POWERUP_STORE_ITEMS: PowerUpStoreDef[] = [
  // --- CATEGORY 1: BUTTON-ACTIVATED IN-GAME POWER-UPS (ACTIVE, 5 LEVELS MAX) ---
  {
    id: 'combo_shield',
    name: 'Phase Aegis Shield',
    category: 'ACTIVE',
    activationMode: 'ACTIVE',
    maxLevel: 5,
    tier: 'standard',
    icon: '❖',
    accentColor: '#34d399',
    shortBenefit: 'No-Timer Shield (CD Only)',
    desc: 'Default Starter Power-Up (5 Levels): Forms a permanent energy shield with NO expiration timer! Cooldown begins only after it blocks a hazard or fall.',
    baseUnlockCost: 0,
    baseUpgradeStepCost: 90,
    baseUsesPerRun: 2,
    maxUsesAtLv10: 6,
    baseDurationSec: 0,
    maxDurationAtLv10: 0,
    baseCooldownSec: 14.0,
    minCooldownAtLv10: 5.5,
  },
  {
    id: 'nano_heal',
    name: 'Vitality Pulse',
    category: 'ACTIVE',
    activationMode: 'ACTIVE',
    maxLevel: 5,
    tier: 'gold',
    icon: '♥',
    accentColor: '#f43f5e',
    shortBenefit: 'Instant +3 to +7 HP Heal',
    desc: 'Button-Activated (5 Levels): Immediately restores +3 HP (Lv.1) up to +7 HP (Lv.5) and emits a protective harmonic wave that clears nearby hazards!',
    baseUnlockCost: 190,
    baseUpgradeStepCost: 130,
    baseUsesPerRun: 2,
    maxUsesAtLv10: 5,
    baseDurationSec: 1.5,
    maxDurationAtLv10: 2.5,
    baseCooldownSec: 14.0,
    minCooldownAtLv10: 6.5,
  },
  {
    id: 'chrono_slow',
    name: 'Chrono Dilator',
    category: 'ACTIVE',
    activationMode: 'ACTIVE',
    maxLevel: 5,
    tier: 'standard',
    icon: '⏳',
    accentColor: '#60a5fa',
    shortBenefit: 'Slows Hazards + Wide Pads',
    desc: 'Button-Activated (5 Levels): Slows enemy drones & crumble timers by up to 80% while widening all platforms!',
    baseUnlockCost: 170,
    baseUpgradeStepCost: 115,
    baseUsesPerRun: 2,
    maxUsesAtLv10: 5,
    baseDurationSec: 6.0,
    maxDurationAtLv10: 14.0,
    baseCooldownSec: 12.0,
    minCooldownAtLv10: 5.8,
  },
  {
    id: 'star_rain',
    name: 'Harmonic Starfall',
    category: 'ACTIVE',
    activationMode: 'ACTIVE',
    maxLevel: 5,
    tier: 'gold',
    icon: '★',
    accentColor: '#fde047',
    shortBenefit: 'Spawns Orb Shower',
    desc: 'Button-Activated (5 Levels): Showers 6 to 14 magnetic Harmonic Orbs above you and stabilizes fragile pads!',
    baseUnlockCost: 240,
    baseUpgradeStepCost: 140,
    baseUsesPerRun: 2,
    maxUsesAtLv10: 5,
    baseDurationSec: 5.5,
    maxDurationAtLv10: 12.5,
    baseCooldownSec: 12.5,
    minCooldownAtLv10: 6.2,
  },
  {
    id: 'dash_shockwave',
    name: 'Nova EMP Shockwave',
    category: 'ACTIVE',
    activationMode: 'ACTIVE',
    maxLevel: 5,
    tier: 'rainbow',
    icon: '💥',
    accentColor: '#ec4899',
    shortBenefit: 'EMP Destroys All Hazards',
    desc: 'Button-Activated (5 Levels): Unleashes a massive EMP shockwave that vaporizes all spikes/drones, heals fragile pads & pulls all Orbs!',
    baseUnlockCost: 260,
    baseUpgradeStepCost: 155,
    baseUsesPerRun: 2,
    maxUsesAtLv10: 5,
    baseDurationSec: 6.0,
    maxDurationAtLv10: 14.0,
    baseCooldownSec: 11.0,
    minCooldownAtLv10: 5.2,
  },

  // --- THREE JETPACK TIERS (ACTIVE BUTTON LAUNCHERS: 500 / 1500 / 3000 ORBS) ---
  {
    id: 'jetpack_white',
    name: 'Ion Jetpack (White)',
    category: 'JETPACK',
    activationMode: 'ACTIVE',
    maxLevel: 5,
    tier: 'standard',
    icon: '🚀',
    accentColor: '#38bdf8',
    shortBenefit: 'Blue Glitter Sky Launch',
    desc: 'Button-Activated (5 Levels): Launches you rapidly upward through platforms with a cyan-blue glitter trail & fast biome scale notes.',
    baseUnlockCost: 500,
    baseUpgradeStepCost: 180,
    baseUsesPerRun: 2,
    maxUsesAtLv10: 5,
    baseDurationSec: 2.0,
    maxDurationAtLv10: 3.8,
    baseCooldownSec: 13.0,
    minCooldownAtLv10: 6.5,
  },
  {
    id: 'jetpack_gold',
    name: 'Solar Jetpack (Gold)',
    category: 'JETPACK',
    activationMode: 'ACTIVE',
    maxLevel: 5,
    tier: 'gold',
    icon: '☄',
    accentColor: '#facc15',
    shortBenefit: 'Gold Thruster + Magnet',
    desc: 'Button-Activated (5 Levels): High-velocity golden thruster with solar glitter trail, Orb pull & shimmering biome arpeggios.',
    baseUnlockCost: 1500,
    baseUpgradeStepCost: 340,
    baseUsesPerRun: 3,
    maxUsesAtLv10: 6,
    baseDurationSec: 2.5,
    maxDurationAtLv10: 4.6,
    baseCooldownSec: 12.5,
    minCooldownAtLv10: 6.0,
  },
  {
    id: 'jetpack_prism',
    name: 'Prism Jetpack (Omni)',
    category: 'JETPACK',
    activationMode: 'ACTIVE',
    maxLevel: 5,
    tier: 'rainbow',
    icon: '✦',
    accentColor: '#f472b6',
    shortBenefit: '7-Color Hyper Launch',
    desc: 'Button-Activated (5 Levels): Ultimate rainbow warp jetpack with 7-color glitter trail, full-screen Orb magnet & cascading notes.',
    baseUnlockCost: 3000,
    baseUpgradeStepCost: 620,
    baseUsesPerRun: 3,
    maxUsesAtLv10: 7,
    baseDurationSec: 3.0,
    maxDurationAtLv10: 5.5,
    baseCooldownSec: 11.5,
    minCooldownAtLv10: 5.2,
  },

  // --- CATEGORY 2: PASSIVE INNATE UPGRADES (EQUIP & AUTO-ACTIVE, SHOWN COMPACT IN HUD) ---
  {
    id: 'orb_magnet',
    name: 'Harmonic Magnet',
    category: 'DASH_MOD',
    activationMode: 'PASSIVE',
    maxLevel: 5,
    tier: 'standard',
    icon: '◎',
    accentColor: '#22d3ee',
    shortBenefit: 'Same-Pad to Wide Orb Pull',
    desc: 'Passive Ability (5 Levels): At Lv.1 gently pulls Orbs on the same platform (52px). Upgrading to Lv.5 gradually expands pull range up to 190px while keeping multiplier steady.',
    baseUnlockCost: 120,
    baseUpgradeStepCost: 95,
    baseUsesPerRun: 99,
    maxUsesAtLv10: 99,
    baseDurationSec: 0,
    maxDurationAtLv10: 0,
    baseCooldownSec: 0,
    minCooldownAtLv10: 0,
  },
  {
    id: 'vital_core',
    name: 'Bio-Regen Core',
    category: 'DASH_MOD',
    activationMode: 'PASSIVE',
    maxLevel: 5,
    tier: 'gold',
    icon: '💖',
    accentColor: '#fb7185',
    shortBenefit: '+1..+5 Max HP & Auto-Regen',
    desc: 'Passive Ability (5 Levels): Increases skin Max Health by +1 to +5 HP and automatically regenerates +1 HP every 16 down to 8 platforms climbed!',
    baseUnlockCost: 210,
    baseUpgradeStepCost: 145,
    baseUsesPerRun: 99,
    maxUsesAtLv10: 99,
    baseDurationSec: 0,
    maxDurationAtLv10: 0,
    baseCooldownSec: 0,
    minCooldownAtLv10: 0,
  },
  {
    id: 'rhythm_aura',
    name: 'Resonance Overdrive',
    category: 'DASH_MOD',
    activationMode: 'PASSIVE',
    maxLevel: 5,
    tier: 'gold',
    icon: '♫',
    accentColor: '#fbbf24',
    shortBenefit: 'Passive 1.8x-3.4x Score & Orbs',
    desc: 'Passive Ability (5 Levels): Permanently multiplies Score & Orb yield (1.8x up to 3.4x by level) throughout the entire run when equipped.',
    baseUnlockCost: 180,
    baseUpgradeStepCost: 135,
    baseUsesPerRun: 99,
    maxUsesAtLv10: 99,
    baseDurationSec: 0,
    maxDurationAtLv10: 0,
    baseCooldownSec: 0,
    minCooldownAtLv10: 0,
  },
  {
    id: 'wall_bounce',
    name: 'Wall-Bounce Rebound',
    category: 'DASH_MOD',
    activationMode: 'PASSIVE',
    maxLevel: 5,
    tier: 'gold',
    icon: '⤣',
    accentColor: '#38bdf8',
    shortBenefit: '30°-45° Wall Dash Rebound',
    desc: 'Passive Ability (5 Levels): Dashing into a wall bounces you diagonally upward at 30°–45%! Higher levels boost rebound height, but wall impacts slow down your next Dash recharge.',
    baseUnlockCost: 140,
    baseUpgradeStepCost: 125,
    baseUsesPerRun: 99,
    maxUsesAtLv10: 99,
    baseDurationSec: 0,
    maxDurationAtLv10: 0,
    baseCooldownSec: 0,
    minCooldownAtLv10: 0,
  },
  {
    id: 'dash_capacitor',
    name: 'Phase Dash Capacitor',
    category: 'DASH_MOD',
    activationMode: 'PASSIVE',
    maxLevel: 5,
    tier: 'standard',
    icon: '⚡',
    accentColor: '#00ff88',
    shortBenefit: '-10%/Lv Dash Cooldown',
    desc: 'Passive Ability (5 Levels): Permanently reduces Dash recharge cooldown by -10% per level (up to -50% faster Dash at Lv.5) when equipped.',
    baseUnlockCost: 110,
    baseUpgradeStepCost: 90,
    baseUsesPerRun: 99,
    maxUsesAtLv10: 99,
    baseDurationSec: 0,
    maxDurationAtLv10: 0,
    baseCooldownSec: 0,
    minCooldownAtLv10: 0,
  },
  {
    id: 'dash_turbine',
    name: 'Kinetic Dash Booster',
    category: 'DASH_MOD',
    activationMode: 'PASSIVE',
    maxLevel: 5,
    tier: 'gold',
    icon: '⫸',
    accentColor: '#f97316',
    shortBenefit: '+12%/Lv Dash & Wall Lift',
    desc: 'Passive Ability (5 Levels): Boosts Dash horizontal speed, upward lift & Wall-Bounce elasticity by +12% per level (up to +60% at Lv.5) when equipped.',
    baseUnlockCost: 150,
    baseUpgradeStepCost: 110,
    baseUsesPerRun: 99,
    maxUsesAtLv10: 99,
    baseDurationSec: 0,
    maxDurationAtLv10: 0,
    baseCooldownSec: 0,
    minCooldownAtLv10: 0,
  },
];

export const RUN_UPGRADES: RunUpgrade[] = POWERUP_STORE_ITEMS.map((item) => ({
  id: item.id,
  name: item.name.toUpperCase(),
  desc: item.shortBenefit,
  icon: item.icon,
  durationSec: item.baseDurationSec,
}));

export function getPowerUpDef(id: string): PowerUpStoreDef {
  return (
    POWERUP_STORE_ITEMS.find((p) => p.id === id) || POWERUP_STORE_ITEMS[0]
  );
}

export function getPowerUpItemById(id: string): PowerUpStoreDef | undefined {
  return POWERUP_STORE_ITEMS.find((p) => p.id === id);
}

/**
 * Computes the Orb cost to unlock (when currentLevel === 0) or upgrade to `currentLevel + 1` (up to `def.maxLevel = 5`).
 * Features a steep exponential price gap between levels 1..5!
 */
export function getPowerUpUpgradeCost(def: PowerUpStoreDef, currentLevel: number): number {
  const maxLv = def.maxLevel || 5;
  if (currentLevel <= 0) {
    return def.baseUnlockCost;
  }
  if (currentLevel >= maxLv) {
    return 0;
  }
  return Math.round(def.baseUpgradeStepCost * Math.pow(2.35, currentLevel - 1));
}

export interface PowerUpLevelStats {
  level: number;
  maxLevel: number;
  maxUsesPerRun: number;
  usesPerRun: number;
  durationSec: number;
  cooldownSec: number;
  powerMult: number;
  powerValue: number;
  flowBonusPct: number;
  dashCooldownBonusPct: number;
  dashPowerBonusPct: number;
  dashShockwaveRadiusPx: number;
  wallBouncePowerMult: number;
}

export function getPowerUpLevelStats(id: PowerUpItemId | string, level: number): PowerUpLevelStats {
  const def = getPowerUpDef(id);
  const maxLv = def.maxLevel || 5;
  const clampedLv = Math.max(1, Math.min(maxLv, Math.round(level || 1)));
  const t = maxLv > 1 ? (clampedLv - 1) / (maxLv - 1) : 1; // 0.0 at Lv.1 -> 1.0 at Lv.5

  const maxUsesPerRun = Math.round(
    def.baseUsesPerRun + t * (def.maxUsesAtLv10 - def.baseUsesPerRun)
  );
  const durationSec = Number(
    (def.baseDurationSec + t * (def.maxDurationAtLv10 - def.baseDurationSec)).toFixed(1)
  );
  const cooldownSec = Number(
    (def.baseCooldownSec - t * (def.baseCooldownSec - def.minCooldownAtLv10)).toFixed(1)
  );
  const powerMult = Number((1.0 + t * 1.15).toFixed(2));
  // Gradual small-percentage Flow acceleration per level (+2.5% per level across 5 levels)
  const flowBonusPct = Number((clampedLv * 2.5).toFixed(1));

  // Domain-specific powerValue across 5 levels
  let powerValue = powerMult;
  switch (def.id) {
    case 'jetpack_white':
      powerValue = Math.round(880 + t * 240); // 880..1120 px/s upward velocity
      break;
    case 'jetpack_gold':
      powerValue = Math.round(1020 + t * 280); // 1020..1300 px/s upward velocity
      break;
    case 'jetpack_prism':
      powerValue = Math.round(1180 + t * 340); // 1180..1520 px/s upward velocity
      break;
    case 'orb_magnet':
      // Lv.1 is 52px (same-platform gentle pull only), scaling across 5 levels: 52 -> 86 -> 121 -> 156 -> 190px
      powerValue = Math.round(52 + t * 138);
      break;
    case 'nano_heal':
      // Instant heal: +3 HP at Lv.1 up to +7 HP at Lv.5
      powerValue = Math.round(3 + t * 4);
      break;
    case 'vital_core':
      // Bonus Max HP: +1 HP at Lv.1 up to +5 HP at Lv.5
      powerValue = Math.round(1 + t * 4);
      break;
    case 'dash_shockwave':
      powerValue = Math.round(350 + t * 270); // 350..620 px EMP blast radius
      break;
    case 'star_rain':
      powerValue = Math.round(6 + t * 8);     // 6..14 harmonic orbs spawned
      break;
    case 'chrono_slow':
      powerValue = Number((0.36 - t * 0.18).toFixed(2)); // 0.36..0.18 hazard speed factor
      break;
    case 'rhythm_aura':
      powerValue = Number((1.8 + t * 1.6).toFixed(2));   // 1.8x..3.4x score & orb multiplier
      break;
    case 'combo_shield':
      powerValue = maxUsesPerRun;                        // 2..6 shields per run
      break;
    case 'wall_bounce':
      powerValue = Number((1.0 + t * 0.56).toFixed(2));  // 1.00x..1.56x wall rebound velocity across 5 levels
      break;
    default:
      powerValue = powerMult;
  }

  return {
    level: clampedLv,
    maxLevel: maxLv,
    maxUsesPerRun,
    usesPerRun: maxUsesPerRun,
    durationSec,
    cooldownSec,
    powerMult,
    powerValue,
    flowBonusPct,
    dashCooldownBonusPct: def.id === 'dash_capacitor' ? clampedLv * 10 : 0,
    dashPowerBonusPct: def.id === 'dash_turbine' ? clampedLv * 12 : 0,
    dashShockwaveRadiusPx: def.id === 'dash_shockwave' ? clampedLv * 36 : 0,
    wallBouncePowerMult: def.id === 'wall_bounce' ? powerValue : 1.0,
  };
}

/**
 * Computes passive Dash, Wall-Bounce, Passive Magnet, Passive Overdrive, Bio-Regen Core, and gradual Flow acceleration
 * from unlocked/equipped power-ups.
 */
export function computePassiveDashUpgrades(
  powerUpLevels?: Record<string, number>,
  equippedPowerUps?: string[]
): {
  cooldownMultiplier: number;
  powerMultiplier: number;
  dashPowerMultiplier: number;
  wallBounceUnlocked: boolean;
  wallBounceLevel: number;
  wallBounceLiftMultiplier: number;
  wallBounceRechargeRateFactor: number;
  passiveMagnetRadiusPx: number;
  passiveMagnetLevel: number;
  passiveOverdriveMult: number;
  bonusMaxHp: number;
  regenPlatformsInterval: number;
  flowAccelMultiplier: number;
  flowBonusPct: number;
  shockwaveRadiusBonusPx: number;
  cooldownReductionPct: number;
  powerBonusPct: number;
} {
  const levels = powerUpLevels || {};
  const equipped = equippedPowerUps; // If provided, check equipped; if omitted, check unlocked levels

  const isPassiveActive = (id: string) => {
    const lv = levels[id] || 0;
    if (lv <= 0) return false;
    if (!equipped) return true;
    return equipped.includes(id);
  };

  const capLv = isPassiveActive('dash_capacitor')
    ? Math.max(0, Math.min(5, levels.dash_capacitor || 0))
    : 0;
  const turbLv = isPassiveActive('dash_turbine')
    ? Math.max(0, Math.min(5, levels.dash_turbine || 0))
    : 0;
  const wallLv = isPassiveActive('wall_bounce')
    ? Math.max(0, Math.min(5, levels.wall_bounce || 0))
    : 0;
  const magLv = isPassiveActive('orb_magnet')
    ? Math.max(0, Math.min(5, levels.orb_magnet || 0))
    : 0;
  const auraLv = isPassiveActive('rhythm_aura')
    ? Math.max(0, Math.min(5, levels.rhythm_aura || 0))
    : 0;
  const vitalLv = isPassiveActive('vital_core')
    ? Math.max(0, Math.min(5, levels.vital_core || 0))
    : 0;
  const shockLv = Math.max(0, Math.min(5, levels.dash_shockwave || 0));

  // Gradual small-percentage Flow acceleration across equipped/upgraded power-ups (+2.0% per level)
  const activePoolIds = equipped && equipped.length > 0 ? equipped : Object.keys(levels);
  let totalUpgradeLevels = 0;
  for (const id of activePoolIds) {
    const lv = Math.max(0, Math.min(5, levels[id] || 0));
    if (lv > 0) {
      totalUpgradeLevels += lv;
    }
  }
  const flowBonusPct = Number(Math.min(36, totalUpgradeLevels * 2.0).toFixed(1));
  const flowAccelMultiplier = Number((1 + flowBonusPct / 100).toFixed(3));

  const cooldownReductionPct = capLv * 10; // up to 50% reduction at Lv.5
  const powerBonusPct = turbLv * 12;       // up to +60% power at Lv.5
  const shockwaveRadiusBonusPx = shockLv * 36;
  const powerMult = Number((1 + powerBonusPct / 100).toFixed(2));

  const wallBounceStats = wallLv > 0 ? getPowerUpLevelStats('wall_bounce', wallLv) : null;
  const wallBounceBaseMult = wallBounceStats ? wallBounceStats.powerValue : 0;

  // Tactical Wall-Bounce trade-off: hitting a wall slows the subsequent Dash recharge rate,
  // and higher Wall-Bounce levels slow the post-wall recharge further (0.76x -> 0.64x -> 0.52x -> 0.42x -> 0.34x)
  const wallBounceRechargeRateFactor =
    wallLv === 1
      ? 0.76
      : wallLv === 2
        ? 0.64
        : wallLv === 3
          ? 0.52
          : wallLv === 4
            ? 0.42
            : wallLv >= 5
              ? 0.34
              : 1.0;

  const passiveMagnetRadiusPx =
    magLv > 0 ? getPowerUpLevelStats('orb_magnet', magLv).powerValue : 0;
  const passiveOverdriveMult =
    auraLv > 0 ? getPowerUpLevelStats('rhythm_aura', auraLv).powerValue : 1.0;
  const bonusMaxHp = vitalLv > 0 ? vitalLv : 0;
  const regenPlatformsInterval = vitalLv > 0 ? Math.max(8, 18 - vitalLv * 2) : 0;

  return {
    cooldownMultiplier: Number(Math.max(0.42, 1 - cooldownReductionPct / 100).toFixed(2)),
    powerMultiplier: powerMult,
    dashPowerMultiplier: powerMult,
    wallBounceUnlocked: wallLv > 0,
    wallBounceLevel: wallLv,
    wallBounceLiftMultiplier: Number((wallBounceBaseMult * powerMult).toFixed(2)),
    wallBounceRechargeRateFactor,
    passiveMagnetRadiusPx,
    passiveMagnetLevel: magLv,
    passiveOverdriveMult,
    bonusMaxHp,
    regenPlatformsInterval,
    flowAccelMultiplier,
    flowBonusPct,
    shockwaveRadiusBonusPx,
    cooldownReductionPct,
    powerBonusPct,
  };
}

/**
 * 0-to-15 Player Level Progression Table (Starts at Level 0 with 0 XP -> 1500 XP for Level 1 -> 150,000 XP for Level 15):
 * - Starter items (Biomes 0, 1, 2, 6, CRT Velvet synth, 3 slots) are unlocked at Level 0.
 * - Levels 1 through 5 are smoothly subdivided so early progression feels rewarding.
 * - Levels 5, 10, and 15 unlock the 3 sets of Secret Skins (White, Gold, and Prism)!
 */
export interface LevelProgressionDef {
  level: number;
  minXp: number;
  newlyUnlockedScales: number[];
  newlyUnlockedSoundBanks: string[];
  newlyUnlockedSecretAvatars: string[];
  powerUpSlots: number;
  titleEn: string;
  titleFa: string;
}

export const LEVEL_PROGRESSION_TABLE: LevelProgressionDef[] = [
  {
    level: 0,
    minXp: 0,
    newlyUnlockedScales: [0, 1, 2, 6],
    newlyUnlockedSoundBanks: ['crt_velvet'],
    newlyUnlockedSecretAvatars: [],
    powerUpSlots: 3,
    titleEn: 'Dormant Seed (Lv.0)',
    titleFa: 'بذر خاموش (سطح ۰)',
  },
  {
    level: 1,
    minXp: 1500,
    newlyUnlockedScales: [3],
    newlyUnlockedSoundBanks: ['lofi_tape'],
    newlyUnlockedSecretAvatars: [],
    powerUpSlots: 3,
    titleEn: 'Neon Initiate',
    titleFa: 'آغازگر نئون',
  },
  {
    level: 2,
    minXp: 3500,
    newlyUnlockedScales: [4, 5],
    newlyUnlockedSoundBanks: [],
    newlyUnlockedSecretAvatars: [],
    powerUpSlots: 3,
    titleEn: 'Signal Runner',
    titleFa: 'دونده سیگنال',
  },
  {
    level: 3,
    minXp: 6500,
    newlyUnlockedScales: [7, 8],
    newlyUnlockedSoundBanks: [],
    newlyUnlockedSecretAvatars: [],
    powerUpSlots: 3,
    titleEn: 'Pulse Seeker',
    titleFa: 'جوینده پالس',
  },
  {
    level: 4,
    minXp: 10500,
    newlyUnlockedScales: [9],
    newlyUnlockedSoundBanks: [],
    newlyUnlockedSecretAvatars: [],
    powerUpSlots: 4,
    titleEn: 'Harmonic Strider (+Slot 4)',
    titleFa: 'گام‌بردار هارمونیک (+اسلات ۴)',
  },
  {
    level: 5,
    minXp: 15500,
    newlyUnlockedScales: [10],
    newlyUnlockedSoundBanks: [],
    newlyUnlockedSecretAvatars: ['secret_heart', 'secret_flower', 'secret_cherry'],
    powerUpSlots: 4,
    titleEn: 'White Secret Tier Unlocked!',
    titleFa: 'باز شدن ۳ اسکین مخفی سفید!',
  },
  {
    level: 6,
    minXp: 21500,
    newlyUnlockedScales: [11, 12],
    newlyUnlockedSoundBanks: ['akira_fm'],
    newlyUnlockedSecretAvatars: [],
    powerUpSlots: 4,
    titleEn: 'Maqam Weaver',
    titleFa: 'بافنده مقام',
  },
  {
    level: 7,
    minXp: 28500,
    newlyUnlockedScales: [13, 14],
    newlyUnlockedSoundBanks: [],
    newlyUnlockedSecretAvatars: [],
    powerUpSlots: 5,
    titleEn: 'Kyoto Resonator (+Slot 5)',
    titleFa: 'طنین کیوتو (+اسلات ۵)',
  },
  {
    level: 8,
    minXp: 37000,
    newlyUnlockedScales: [15, 16],
    newlyUnlockedSoundBanks: ['vhs_dream'],
    newlyUnlockedSecretAvatars: [],
    powerUpSlots: 5,
    titleEn: 'Dreamwave Navigator',
    titleFa: 'ناوبر دریم‌ویو',
  },
  {
    level: 9,
    minXp: 47500,
    newlyUnlockedScales: [17, 18],
    newlyUnlockedSoundBanks: ['arcade_crt_pulse'],
    newlyUnlockedSecretAvatars: [],
    powerUpSlots: 5,
    titleEn: 'Nordic Vanguard',
    titleFa: 'پیشگام نوردیک',
  },
  {
    level: 10,
    minXp: 60000,
    newlyUnlockedScales: [19],
    newlyUnlockedSoundBanks: [],
    newlyUnlockedSecretAvatars: ['secret_rockhand', 'secret_leaf', 'secret_skull'],
    powerUpSlots: 6,
    titleEn: 'Gold Secret Tier + Slot 6!',
    titleFa: '۳ اسکین مخفی طلایی + اسلات ۶!',
  },
  {
    level: 11,
    minXp: 74500,
    newlyUnlockedScales: [20, 21],
    newlyUnlockedSoundBanks: ['rainy_shibuya'],
    newlyUnlockedSecretAvatars: [],
    powerUpSlots: 6,
    titleEn: 'Shibuya Virtuoso',
    titleFa: 'استاد شیبویا',
  },
  {
    level: 12,
    minXp: 91000,
    newlyUnlockedScales: [22, 23],
    newlyUnlockedSoundBanks: [],
    newlyUnlockedSecretAvatars: [],
    powerUpSlots: 6,
    titleEn: 'Mythic Architect',
    titleFa: 'معمار اسطوره‌ای',
  },
  {
    level: 13,
    minXp: 109000,
    newlyUnlockedScales: [24],
    newlyUnlockedSoundBanks: ['cyber_matrix_sub'],
    newlyUnlockedSecretAvatars: [],
    powerUpSlots: 7,
    titleEn: 'Neuromancer (+Slot 7 Max)',
    titleFa: 'نورومنسر (+اسلات ۷ نهایی)',
  },
  {
    level: 14,
    minXp: 128500,
    newlyUnlockedScales: [25, 26],
    newlyUnlockedSoundBanks: [],
    newlyUnlockedSecretAvatars: [],
    powerUpSlots: 7,
    titleEn: 'Ascendant Maestro',
    titleFa: 'رهبر ارکستر صعود',
  },
  {
    level: 15,
    minXp: 150000,
    newlyUnlockedScales: [],
    newlyUnlockedSoundBanks: [],
    newlyUnlockedSecretAvatars: ['secret_eyeball', 'secret_hexagram', 'secret_cat'],
    powerUpSlots: 7,
    titleEn: 'Transcendent Omni (Prism Secrets!)',
    titleFa: 'اومنی متعالی (۳ اسکین مخفی پریزم!)',
  },
];

export const UPGRADABLE_POWERUPS = POWERUP_STORE_ITEMS;

export function getRequiredLevelForScale(scaleId: number): number {
  for (const row of LEVEL_PROGRESSION_TABLE) {
    if (row.newlyUnlockedScales.includes(scaleId)) {
      return row.level;
    }
  }
  return 0;
}

export function getRequiredLevelForSoundBank(bankId: string): number {
  for (const row of LEVEL_PROGRESSION_TABLE) {
    if (row.newlyUnlockedSoundBanks.includes(bankId)) {
      return row.level;
    }
  }
  return 0;
}

export interface PlayerLevelInfo {
  level: number;
  totalXp: number;
  currentLevelMinXp: number;
  nextLevelMinXp: number;
  xpIntoLevel: number;
  xpRequiredForNext: number;
  xpNeededForNext: number;
  progressPct: number;
  progressRatio: number;
  isMaxLevel: boolean;
  titleEn: string;
  titleFa: string;
}

export function computePlayerLevelInfo(totalXp: number): PlayerLevelInfo {
  const safeXp = Math.max(0, Math.floor(totalXp || 0));
  let currentDef = LEVEL_PROGRESSION_TABLE[0];
  for (const row of LEVEL_PROGRESSION_TABLE) {
    if (safeXp >= row.minXp) {
      currentDef = row;
    } else {
      break;
    }
  }

  const nextDef = LEVEL_PROGRESSION_TABLE.find((r) => r.level === currentDef.level + 1);
  if (!nextDef) {
    return {
      level: 15,
      totalXp: safeXp,
      currentLevelMinXp: currentDef.minXp,
      nextLevelMinXp: currentDef.minXp,
      xpIntoLevel: safeXp - currentDef.minXp,
      xpRequiredForNext: 1,
      xpNeededForNext: 1,
      progressPct: 100,
      progressRatio: 1,
      isMaxLevel: true,
      titleEn: currentDef.titleEn,
      titleFa: currentDef.titleFa,
    };
  }

  const span = Math.max(1, nextDef.minXp - currentDef.minXp);
  const into = Math.max(0, safeXp - currentDef.minXp);
  const ratio = Math.min(1, into / span);
  return {
    level: currentDef.level,
    totalXp: safeXp,
    currentLevelMinXp: currentDef.minXp,
    nextLevelMinXp: nextDef.minXp,
    xpIntoLevel: into,
    xpRequiredForNext: span,
    xpNeededForNext: span,
    progressPct: Number((ratio * 100).toFixed(1)),
    progressRatio: Number(ratio.toFixed(3)),
    isMaxLevel: false,
    titleEn: currentDef.titleEn,
    titleFa: currentDef.titleFa,
  };
}

export function getCumulativeUnlocksForLevel(
  level: number,
  betaUnlockSecretSkins = false
): {
  unlockedScales: number[];
  unlockedSoundBanks: string[];
  unlockedSecretAvatars: string[];
  powerUpSlots: number;
} {
  const clampedLv = Math.max(0, Math.min(15, Math.floor(level ?? 0)));
  const scales = new Set<number>([0, 1, 2, 6]);
  const banks = new Set<string>(['crt_velvet']);
  const secrets = new Set<string>();
  let slots = 3;

  for (const row of LEVEL_PROGRESSION_TABLE) {
    if (row.level <= clampedLv) {
      row.newlyUnlockedScales.forEach((s) => scales.add(s));
      row.newlyUnlockedSoundBanks.forEach((b) => banks.add(b));
      row.newlyUnlockedSecretAvatars.forEach((a) => secrets.add(a));
      slots = Math.max(slots, row.powerUpSlots);
    }
  }

  if (betaUnlockSecretSkins) {
    LEVEL_PROGRESSION_TABLE.forEach((row) =>
      row.newlyUnlockedSecretAvatars.forEach((a) => secrets.add(a))
    );
  }

  return {
    unlockedScales: Array.from(scales),
    unlockedSoundBanks: Array.from(banks),
    unlockedSecretAvatars: Array.from(secrets),
    powerUpSlots: slots,
  };
}

export interface LevelUpRewardItem {
  level: number;
  kind: 'biome' | 'sound_bank' | 'slot' | 'secret_skin';
  nameEn: string;
  nameFa: string;
  accentColor: string;
  avatarId?: string;
  scaleId?: number;
  soundBankId?: string;
}

export type LevelUpRewardDef = LevelUpRewardItem;

export function getLevelUpRewardsBetween(
  oldLevel: number,
  newLevel: number
): LevelUpRewardItem[] {
  if (newLevel <= oldLevel) return [];
  const rewards: LevelUpRewardItem[] = [];
  let prevSlots =
    LEVEL_PROGRESSION_TABLE.find((r) => r.level === oldLevel)?.powerUpSlots ?? 3;

  for (const row of LEVEL_PROGRESSION_TABLE) {
    if (row.level > oldLevel && row.level <= newLevel) {
      if (row.powerUpSlots > prevSlots) {
        rewards.push({
          level: row.level,
          kind: 'slot',
          nameEn: `Power-Up Loadout Slot #${row.powerUpSlots}`,
          nameFa: `اسلات پاورآپ شماره ${row.powerUpSlots}`,
          accentColor: '#34d399',
        });
        prevSlots = row.powerUpSlots;
      }
      for (const sId of row.newlyUnlockedScales) {
        const b = MASTER_SCALES.find((m) => m.id === sId);
        if (b) {
          rewards.push({
            level: row.level,
            kind: 'biome',
            nameEn: `Biome: ${b.name}`,
            nameFa: `بیوم جدید: ${b.name}`,
            accentColor: b.fg,
            scaleId: sId,
          });
        }
      }
      for (const bId of row.newlyUnlockedSoundBanks) {
        const sb = SOUND_BANKS.find((s) => s.id === bId);
        if (sb) {
          rewards.push({
            level: row.level,
            kind: 'sound_bank',
            nameEn: `Synth: ${sb.name}`,
            nameFa: `بانک صدا: ${sb.name}`,
            accentColor: '#38bdf8',
            soundBankId: bId,
          });
        }
      }
      for (const secId of row.newlyUnlockedSecretAvatars) {
        const tierColor =
          row.level >= 15 ? '#f472b6' : row.level >= 10 ? '#facc15' : '#e2e8f0';
        rewards.push({
          level: row.level,
          kind: 'secret_skin',
          nameEn: `Secret Skin: ${secId.replace('secret_', '').toUpperCase()}`,
          nameFa: `اسکین مخفی: ${secId.replace('secret_', '').toUpperCase()}`,
          accentColor: tierColor,
          avatarId: secId,
        });
      }
    }
  }
  return rewards;
}

/**
 * Unlocks Power-Up Loadout Slots based on Player Level (or Best Score fallback):
 * - Starts with 3 slots at Lv.0.
 * - Unlocks Slot 4 at Lv.4, Slot 5 at Lv.7, Slot 6 at Lv.10, Slot 7 at Lv.13.
 */
export function computeUnlockedPowerUpSlots(highScoreOrLevel: number, playerLevel?: number): number {
  if (playerLevel !== undefined && playerLevel >= 0) {
    return getCumulativeUnlocksForLevel(playerLevel).powerUpSlots;
  }
  // Fallback compatibility if called with level (0..15) or highScore
  if (highScoreOrLevel <= 15 && highScoreOrLevel >= 0) {
    return getCumulativeUnlocksForLevel(highScoreOrLevel).powerUpSlots;
  }
  const baseSlots = 3;
  if (highScoreOrLevel < 1500) return baseSlots;
  const bonusSlots = Math.floor((highScoreOrLevel - 1500) / 500) + 1;
  return Math.min(7, baseSlots + bonusSlots);
}

export function getNextPowerUpSlotMilestone(highScore: number, playerLevel?: number): number | null {
  if (playerLevel !== undefined) {
    const curSlots = getCumulativeUnlocksForLevel(playerLevel).powerUpSlots;
    const nextRow = LEVEL_PROGRESSION_TABLE.find((r) => r.powerUpSlots > curSlots);
    return nextRow ? nextRow.level : null;
  }
  const currentSlots = computeUnlockedPowerUpSlots(highScore);
  if (currentSlots >= 7) return null;
  if (highScore < 1500) return 1500;
  return 1500 + (currentSlots - 3) * 500;
}

export function tickActivePowerUps(list: ActivePowerUp[], dt: number): ActivePowerUp[] {
  const next: ActivePowerUp[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    // Shield (`combo_shield`) has NO expiration timer — it stays active indefinitely until broken by a hazard or fall!
    if (item.id === 'combo_shield') {
      next.push(item);
      continue;
    }
    const rem = item.remainingSec - dt;
    if (rem > 0) {
      next.push({ ...item, remainingSec: rem });
    }
  }
  return next;
}

export interface ShopRecommendationItem {
  kind: 'character' | 'sound_bank' | 'biome' | 'power_up';
  id: string | number;
  name: string;
  costOrbs: number;
  shortBenefit: string;
  accentColor: string;
  canAfford: boolean;
  orbsNeeded: number;
  icon?: string;
}

/**
 * Recommends the most motivating locked Store item (Character or Power-Up)
 * after each defeat based on the player's collected Orbs, with a 2-3 word benefit summary.
 * (Biomes and Sound Banks are now unlocked via the 15-Level Progression system!)
 */
export function computePostDefeatShopRecommendation(
  totalOrbs: number,
  cfg: Pick<
    GameConfig,
    'unlockedScales' | 'unlockedSoundBanks' | 'unlockedAvatars' | 'powerUpLevels'
  >,
  avatars: Array<{ id: string; name: string; costOrbs: number; perkTitle: string; isSecret?: boolean }> = []
): ShopRecommendationItem | null {
  const candidates: Array<Omit<ShopRecommendationItem, 'canAfford' | 'orbsNeeded'>> = [];

  for (const av of avatars) {
    if (av.isSecret) continue;
    if (av.costOrbs > 0 && !cfg.unlockedAvatars.includes(av.id)) {
      candidates.push({
        kind: 'character',
        id: av.id,
        name: av.name,
        costOrbs: av.costOrbs,
        shortBenefit: av.perkTitle,
        accentColor: '#fbbf24',
      });
    }
  }

  const pLevels = cfg.powerUpLevels || {
    combo_shield: 1,
  };
  for (const pu of POWERUP_STORE_ITEMS) {
    const curLv = pLevels[pu.id] || 0;
    const maxLv = pu.maxLevel || 5;
    if (curLv < maxLv) {
      const cost = getPowerUpUpgradeCost(pu, curLv);
      if (cost > 0) {
        candidates.push({
          kind: 'power_up',
          id: pu.id,
          name: curLv === 0 ? pu.name : `${pu.name} Lv.${curLv + 1}`,
          costOrbs: cost,
          shortBenefit: pu.shortBenefit,
          accentColor: pu.accentColor,
          icon: pu.icon,
        });
      }
    }
  }

  if (candidates.length === 0) return null;

  const affordable = candidates.filter((c) => c.costOrbs <= totalOrbs);
  if (affordable.length > 0) {
    const affordableChars = affordable.filter((c) => c.kind === 'character');
    if (affordableChars.length > 0) {
      affordableChars.sort((a, b) => b.costOrbs - a.costOrbs);
      return {
        ...affordableChars[0],
        canAfford: true,
        orbsNeeded: 0,
      };
    }

    affordable.sort((a, b) => b.costOrbs - a.costOrbs);
    const topTierCost = affordable[0].costOrbs;
    const topMatches = affordable.filter((c) => c.costOrbs >= topTierCost * 0.75);
    const chosen = topMatches[totalOrbs % topMatches.length] || affordable[0];
    return {
      ...chosen,
      canAfford: true,
      orbsNeeded: 0,
    };
  }

  candidates.sort((a, b) => a.costOrbs - b.costOrbs);
  const closest = candidates[0];
  return {
    ...closest,
    canAfford: false,
    orbsNeeded: Math.max(1, closest.costOrbs - totalOrbs),
  };
}



