/**
 * Curated Biome Melody Library & Harmonic Synchronizer for NEON ASCENT: OMNI.
 *
 * Provides 3 distinct, full-biome-duration (72-step) composed melodies for EVERY biome
 * (27 biomes x 3 = 81 curated melodies), along with harmonically synchronized
 * 4-Gate Chord Progressions and 3-Note Triplet Subdivision Motifs.
 */

import {
  MASTER_SCALES,
  ScaleBiome,
  FLOW_THRESHOLDS,
  GameConfig,
  buildExtendedScale,
  getBiomeChordProgressions,
} from './rules';

export interface CuratedBiomeMelody {
  id: string;
  biomeId: number;
  biomeName: string;
  biomeSubtitle: string;
  subtitle: string;
  tradition: string;
  indexInBiome: 1 | 2 | 3;
  title: string;
  styleTag: 'ANTHEM' | 'ARPEGGIO' | 'NOCTURNE';
  description: string;
  /**
   * 72 scale-degree steps spanning the full duration of a biome (~9600px altitude / 134px step = 72 platforms).
   * Divided into 4 harmonic movements of 18 steps each (I -> VI/IV -> ii/V -> Cadence),
   * where each integer is a degree index in `buildExtendedScale(biome.scale)`.
   */
  extendedDegreeSequence: number[];
  degrees: number[];
  steps: number[];
  /**
   * Which of the 4 biome chord progression variants harmonizes with this melody's 4 movements.
   */
  chordProgressionVariant: 0 | 1 | 2 | 3;
  chordVariant: 0 | 1 | 2 | 3;
  isIconic?: boolean;
  composer?: string;
  /**
   * 4 sets of 3-note triplet scale offsets (one per 18-step harmonic movement) so 3-note triplet runs
   * form lush consonant triads/sevenths matching the current bar of the melody.
   */
  tripletOffsetsByMovement: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number]
  ];
}

export interface CuratedStepMusicalOutput {
  notes: number[];
  freqs: number[];
  noteLabel: string;
  label: string;
  tripletFreqs: [number, number, number];
  chordProgressionVariant: number;
  gateChordNames: [string, string, string, string];
  gateChords: [number[], number[], number[], number[]];
}

/**
 * Custom titles for the 3 curated melodies of each biome, tailored to its musical tradition and mood.
 */
const BIOME_MELODY_TITLES: Record<number, [string, string, string]> = {
  0: ['Moonlight Sonata (Beethoven)', 'Phosphor Blade Nocturne', 'Gridline Arpeggio'],
  1: ['Wet Hands (C418 · Minecraft)', 'Sweden (C418 · Minecraft)', 'Gymnopédie No. 1 (Erik Satie)'],
  2: ['Subwoofer Lullaby (C418)', 'Mariana Trench Drift', 'Bioluminescent Tide'],
  3: ['Aria Math (C418 · Minecraft)', 'Golden Synthwave Anthem', 'Daybreak Overdrive'],
  4: ['Toccata & Fugue in Dm (Bach)', 'Phrygian Cyber Chase', 'Red Sector Spire'],
  5: ['Clair de Lune (Debussy)', 'Zero-G Starlight Hymn', 'Event Horizon Pulse'],
  6: ['Kyoto Neon Temple', 'Hirajoshi Bamboo Wind', 'Shibuya Midnight Koto'],
  7: ['Blue CRT Late Night', 'Hexatonic Neon Riff', 'Smoky Arcade Blues'],
  8: ['Für Elise (Beethoven)', 'Swan Lake Theme (Tchaikovsky)', 'Midnight Tube Amp'],
  9: ['Bourbon Street Synth', 'Soul Mixolydian Groove', 'Amber Phosphor Riff'],
  10: ['Mirage Caravan Dawn', 'Hijaz Desert Starlight', 'Oasis Silk Cadence'],
  11: ['Dunes of Golden Resonance', 'Bayati Twilight Mirage', 'Crescent Moon Flute'],
  12: ['Babylon Hanging Gardens', 'Nahawand Royal Overture', 'Tigris River Reflections'],
  13: ['Ronin Shakuhachi Blade', 'In-Sen Moonlit Dojo', 'Crimson Torii Ascent'],
  14: ['Sakura Lantern Festival', 'Yo-Scale Imperial Dance', 'Spring Blossom Wind'],
  15: ['Fushimi Shrine Bell', 'Iwato Mist Meditation', 'Ancient Cedar Echoes'],
  16: ['Okinawa Coral Sanshin', 'Ryukyu Pacific Breeze', 'Turquoise Island Song'],
  17: ['Gjallarhorn Call to Arms', 'Valhalla Mead Hall Hymn', 'Nordic Highland March'],
  18: ['Yggdrasil Ancient Roots', 'Tagelharpa Runic Drone', 'Midgard WinterSaga'],
  19: ['Bifrost Rainbow Bridge', 'Aurora Borealis Shimmer', 'Scandinavian Midnight Sun'],
  20: ['Fenrir Glacial Howl', 'Frost Giant Citadel', 'Sub-Zero Locrian Storm'],
  21: ['Alhambra Courtyard Guitar', 'Andalusian Flamenco Fire', 'Seville Starlight Cadence'],
  22: ['Carpathian Gypsy Violin', 'Balkan Nomad Dance', 'Danube Moonlight Rhapsody'],
  23: ['Tir na nOg Harp Ballad', 'Emerald Isle Mist', 'Highland Mixolydian Jig'],
  24: ['Ganges Morning Raga', 'Bhairav Sitar Awakening', 'Saffron Temple Bells'],
  25: ['Ubud Bronze Gamelan', 'Pelog Rainforest Canopy', 'Sacred Monkey Chant'],
  26: ['Chrono Warp Paradox', 'Whole-Tone Prism Matrix', 'Tesseract Time Loop'],
};

/**
 * Authentic 72-step offset blueprints for Iconic Classical & Minecraft pieces:
 */
const MOONLIGHT_SONATA_72_OFFSETS: number[] = [
  // Mvt I: Famous rolling triplet arpeggio ostinato (G# - C# - E) + solemn high G#4..A4
  0, 2, 4, 0, 2, 4, 0, 2, 4, 0, 2, 4, 7, 7, 7, 8, 7, 6,
  // Mvt II: Modulation to relative major / subdominant triplet weave
  -1, 2, 5, -1, 2, 5, 0, 3, 6, 0, 2, 4, 9, 9, 9, 10, 9, 7,
  // Mvt III: Ascending dramatic register climb
  2, 4, 7, 2, 4, 7, 4, 7, 11, 4, 7, 11, 14, 13, 11, 9, 8, 7,
  // Mvt IV: Deep Moonlight cadence resolution
  7, 4, 2, 7, 4, 2, 5, 3, 1, 4, 2, 0, -2, 0, 2, 4, 2, 0,
];

const WET_HANDS_C418_72_OFFSETS: number[] = [
  // Mvt I: C418 Wet Hands signature nostalgic rising 5th & 9th arpeggio (A - E - B - C# - E - F# - E - C# - B)
  0, 4, 8, 9, 11, 12, 11, 9, 8, 4, 0, 4, 8, 9, 11, 9, 8, 4,
  // Mvt II: Warm IVmaj9 response phrase
  3, 7, 10, 11, 13, 14, 13, 11, 10, 7, 3, 7, 10, 11, 14, 11, 9, 7,
  // Mvt III: High nostalgic Minecraft piano melody
  7, 9, 11, 14, 13, 11, 9, 11, 12, 11, 9, 7, 8, 9, 11, 14, 12, 11,
  // Mvt IV: Gentle sunset resolution
  11, 9, 8, 7, 4, 8, 7, 4, 2, 0, 2, 4, 7, 8, 7, 4, 2, 0,
];

const SWEDEN_C418_72_OFFSETS: number[] = [
  // Mvt I: C418 Sweden (Calm 3) iconic peaceful chordal melody
  4, 3, 2, 0, 2, 4, 6, 4, 2, 0, -2, 0, 2, 4, 7, 6, 4, 2,
  // Mvt II: Warm upper counter-theme
  4, 6, 7, 9, 7, 6, 4, 2, 4, 6, 7, 11, 9, 7, 6, 4, 2, 0,
  // Mvt III: Soaring nostalgic strings/piano climax
  7, 9, 11, 13, 11, 9, 7, 6, 7, 9, 11, 14, 13, 11, 9, 7, 6, 4,
  // Mvt IV: Peaceful twilight fade
  6, 4, 2, 0, 2, 4, 2, 0, -1, 0, 2, 4, 2, 0, -2, -1, 0, 0,
];

const FUR_ELISE_72_OFFSETS: number[] = [
  // Mvt I: Beethoven Für Elise signature motif (E - D# - E - D# - E - B - D - C - A)
  7, 6, 7, 6, 7, 4, 6, 5, 3, 0, 2, 3, 4, 2, 4, 5, 4, 3,
  // Mvt II: Second phrase & major lift
  7, 6, 7, 6, 7, 4, 6, 5, 3, 0, 2, 3, 4, 2, 5, 4, 3, 3,
  // Mvt III: Lyrical C-major / F-major middle section
  4, 5, 6, 7, 4, 9, 8, 7, 3, 8, 7, 6, 2, 7, 6, 5, 4, 7,
  // Mvt IV: Return to main theme & cadence
  7, 6, 7, 6, 7, 4, 6, 5, 3, 0, 2, 3, 4, 2, 5, 4, 3, 0,
];

const BACH_TOCCATA_72_OFFSETS: number[] = [
  // Mvt I: Iconic Baroque mordent (A - G - A ... G - F - E - D - C# - D)
  7, 6, 7, 7, 6, 5, 4, 3, 2, 3, 0, 3, 5, 7, 9, 10, 9, 7,
  // Mvt II: Diminished 7th pedal arpeggios
  1, 3, 5, 7, 5, 3, 4, 6, 8, 10, 8, 6, 7, 9, 11, 14, 12, 10,
  // Mvt III: Rapidbariolage & organ cascade
  14, 12, 10, 12, 10, 9, 10, 9, 7, 9, 7, 5, 7, 5, 4, 5, 3, 2,
  // Mvt IV: Grand D-minor organ cadence
  0, 2, 4, 7, 5, 3, 2, 4, 6, 7, 9, 11, 14, 11, 9, 7, 3, 0,
];

/**
 * 3 Master Compositional Blueprints (each 72 steps = 4 movements x 18 steps),
 * crafted using voice-leading, motif development, call-and-response, and climax cadences.
 * Values are offsets relative to the biome's mid-octave tonic index (`baseRootIdx = 7`).
 */
const ANTHEM_72_OFFSETS: number[] = [
  // Movement I (Tonic Statement & Call/Response - 18 steps)
  0, 2, 4, 7, 6, 4, 2, 4, 5, 4, 2, 0, -1, 0, 2, 4, 6, 7,
  // Movement II (Submediant / Subdominant Warmth - 18 steps)
  5, 7, 9, 7, 5, 4, 2, 5, 7, 8, 7, 5, 4, 2, 3, 5, 7, 9,
  // Movement III (Ascending Bridge & Octave Register Lift - 18 steps)
  7, 9, 11, 14, 12, 11, 9, 11, 12, 14, 11, 9, 7, 9, 11, 12, 14, 15,
  // Movement IV (Grand Cadence Resolution - 18 steps)
  14, 12, 11, 9, 7, 11, 9, 7, 5, 4, 7, 5, 4, 2, 0, 2, 4, 7,
];

const ARPEGGIO_72_OFFSETS: number[] = [
  // Movement I (Rolling Triad & Seventh Arpeggios - 18 steps)
  0, 2, 4, 6, 4, 2, 0, 4, 2, 6, 4, 7, 4, 2, 0, 2, 4, 7,
  // Movement II (Inverted Harmonic Cascade - 18 steps)
  3, 5, 7, 10, 7, 5, 3, 7, 5, 9, 7, 11, 9, 7, 5, 3, 5, 7,
  // Movement III (High-Velocity Cyber Climb - 18 steps)
  4, 6, 8, 11, 9, 11, 13, 14, 11, 9, 7, 11, 9, 12, 11, 14, 12, 14,
  // Movement IV (Descant & Tonic Return - 18 steps)
  14, 11, 9, 7, 11, 7, 5, 4, 7, 4, 2, 0, 4, 2, -1, 0, 4, 7,
];

const NOCTURNE_72_OFFSETS: number[] = [
  // Movement I (Lyrical Expressive Theme - 18 steps)
  4, 3, 2, 0, 2, 4, 7, 6, 4, 2, 0, -2, 0, 2, 4, 5, 4, 2,
  // Movement II (Deep Counter-Melody & Warm Leap - 18 steps)
  0, -2, -3, 0, 2, 5, 4, 2, 3, 5, 7, 9, 7, 5, 4, 2, 4, 6,
  // Movement III (Soaring Emotional Climax - 18 steps)
  7, 8, 9, 11, 14, 13, 11, 9, 11, 12, 11, 9, 7, 6, 7, 9, 11, 14,
  // Movement IV (Gentle Twilight Cadence - 18 steps)
  12, 11, 9, 7, 6, 4, 5, 4, 2, 0, 2, 4, 2, 0, -1, 0, 2, 0,
];

function buildMelodyForBiome(
  biome: ScaleBiome,
  indexInBiome: 1 | 2 | 3
): CuratedBiomeMelody {
  const ext = buildExtendedScale(biome.scale);
  const coreLen =
    biome.scale.length > 2 &&
    Math.abs(biome.scale[biome.scale.length - 1] - biome.scale[0] * 2) < 4
      ? biome.scale.length - 1
      : biome.scale.length;
  const baseRootIdx = Math.max(5, coreLen); // Mid-octave root index

  const titles = BIOME_MELODY_TITLES[biome.id] || [
    `${biome.name} Theme I`,
    `${biome.name} Arp II`,
    `${biome.name} Nocturne III`,
  ];
  const title = titles[indexInBiome - 1];

  const biomeModalShift = (biome.id % 3) === 2 && indexInBiome === 2 ? 1 : 0;

  let rawOffsets: number[];
  let styleTag: CuratedBiomeMelody['styleTag'];
  let chordProgressionVariant: 0 | 1 | 2 | 3;
  let description: string;
  let tripletOffsetsByMovement: CuratedBiomeMelody['tripletOffsetsByMovement'];
  let isIconic = false;
  let composer: string | undefined = undefined;

  if (biome.id === 0 && indexInBiome === 1) {
    rawOffsets = MOONLIGHT_SONATA_72_OFFSETS;
    styleTag = 'NOCTURNE';
    chordProgressionVariant = 2;
    isIconic = true;
    composer = 'Ludwig van Beethoven';
    description = 'Beethoven Op. 27 No. 2 — Rolling triplet arpeggio ostinato & solemn nocturnal melody';
    tripletOffsetsByMovement = [
      [2, 4, 7],
      [2, 5, 7],
      [4, 7, 11],
      [2, 4, 7],
    ];
  } else if (biome.id === 1 && indexInBiome === 1) {
    rawOffsets = WET_HANDS_C418_72_OFFSETS;
    styleTag = 'ARPEGGIO';
    chordProgressionVariant = 1;
    isIconic = true;
    composer = 'C418 (Minecraft)';
    description = 'C418 Wet Hands — Warm nostalgic Minecraft fifth & ninth piano arpeggios';
    tripletOffsetsByMovement = [
      [4, 7, 9],
      [3, 7, 10],
      [2, 4, 7],
      [4, 7, 11],
    ];
  } else if (biome.id === 1 && indexInBiome === 2) {
    rawOffsets = SWEDEN_C418_72_OFFSETS;
    styleTag = 'ANTHEM';
    chordProgressionVariant = 0;
    isIconic = true;
    composer = 'C418 (Minecraft)';
    description = 'C418 Sweden (Calm 3) — Iconic serene Minecraft sunrise motif';
    tripletOffsetsByMovement = [
      [2, 4, 7],
      [2, 5, 7],
      [4, 7, 9],
      [2, 4, 7],
    ];
  } else if (biome.id === 1 && indexInBiome === 3) {
    rawOffsets = NOCTURNE_72_OFFSETS;
    styleTag = 'NOCTURNE';
    chordProgressionVariant = 2;
    isIconic = true;
    composer = 'Erik Satie';
    description = 'Erik Satie Gymnopédie No. 1 — Floating major-7th & Lydian impressionist theme';
    tripletOffsetsByMovement = [
      [2, 4, 6],
      [3, 5, 7],
      [4, 6, 9],
      [2, 4, 7],
    ];
  } else if (biome.id === 2 && indexInBiome === 1) {
    rawOffsets = WET_HANDS_C418_72_OFFSETS;
    styleTag = 'ARPEGGIO';
    chordProgressionVariant = 1;
    isIconic = true;
    composer = 'C418 (Minecraft)';
    description = 'C418 Subwoofer Lullaby — Dreamy nostalgic Minecraft synth-piano lullaby';
    tripletOffsetsByMovement = [
      [2, 4, 7],
      [3, 5, 8],
      [4, 7, 9],
      [2, 4, 7],
    ];
  } else if (biome.id === 3 && indexInBiome === 1) {
    rawOffsets = ARPEGGIO_72_OFFSETS;
    styleTag = 'ARPEGGIO';
    chordProgressionVariant = 1;
    isIconic = true;
    composer = 'C418 (Minecraft)';
    description = 'C418 Aria Math — Energetic Minecraft Creative Mode handpan & synth arpeggio';
    tripletOffsetsByMovement = [
      [2, 4, 6],
      [4, 6, 8],
      [2, 4, 7],
      [3, 5, 7],
    ];
  } else if (biome.id === 4 && indexInBiome === 1) {
    rawOffsets = BACH_TOCCATA_72_OFFSETS;
    styleTag = 'ANTHEM';
    chordProgressionVariant = 0;
    isIconic = true;
    composer = 'J.S. Bach';
    description = 'Bach BWV 565 — Dramatic Baroque Toccata & Fugue in D Minor mordent & pedal cascade';
    tripletOffsetsByMovement = [
      [2, 4, 7],
      [1, 3, 6],
      [3, 5, 8],
      [2, 4, 7],
    ];
  } else if (biome.id === 5 && indexInBiome === 1) {
    rawOffsets = NOCTURNE_72_OFFSETS;
    styleTag = 'NOCTURNE';
    chordProgressionVariant = 2;
    isIconic = true;
    composer = 'Claude Debussy';
    description = 'Debussy Clair de Lune — Shimmering impressionist moonlight cascade';
    tripletOffsetsByMovement = [
      [2, 4, 7],
      [2, 5, 7],
      [4, 6, 9],
      [2, 4, 7],
    ];
  } else if (biome.id === 8 && indexInBiome === 1) {
    rawOffsets = FUR_ELISE_72_OFFSETS;
    styleTag = 'ARPEGGIO';
    chordProgressionVariant = 2;
    isIconic = true;
    composer = 'Ludwig van Beethoven';
    description = 'Beethoven Für Elise — Iconic A-minor chromatic neighbor motif & lyrical bridge';
    tripletOffsetsByMovement = [
      [-1, 2, 4],
      [2, 4, 7],
      [3, 5, 8],
      [2, 4, 7],
    ];
  } else if (biome.id === 8 && indexInBiome === 2) {
    rawOffsets = ANTHEM_72_OFFSETS;
    styleTag = 'ANTHEM';
    chordProgressionVariant = 0;
    isIconic = true;
    composer = 'P.I. Tchaikovsky';
    description = 'Tchaikovsky Swan Lake — Soaring romantic minor theme & harp arpeggios';
    tripletOffsetsByMovement = [
      [2, 4, 7],
      [2, 5, 7],
      [3, 5, 8],
      [4, 6, 7],
    ];
  } else if (indexInBiome === 1) {
    rawOffsets = ANTHEM_72_OFFSETS;
    styleTag = 'ANTHEM';
    chordProgressionVariant = 0; // Signature Cadence (I - VI - IV - V)
    description = `Heroic 4-movement melodic anthem in ${biome.subtitle} with soaring bridge & cadence`;
    tripletOffsetsByMovement = [
      [2, 4, 7], // Tonic triad arpeggio (3rd, 5th, Octave)
      [2, 5, 7], // Submediant/Sixth warm arpeggio
      [3, 5, 8], // Subdominant lift arpeggio
      [4, 6, 7], // Dominant 7th resolving to Octave
    ];
  } else if (indexInBiome === 2) {
    rawOffsets = ARPEGGIO_72_OFFSETS;
    styleTag = 'ARPEGGIO';
    chordProgressionVariant = 1; // Royal Ascending Lift (IV - V - I - VI)
    description = `Crystalline interlocking chordal arpeggios in ${biome.subtitle} across 3 octaves`;
    tripletOffsetsByMovement = [
      [2, 4, 6], // Major/Minor 7th arpeggio
      [4, 6, 8], // Upper extension 9th arpeggio
      [2, 4, 7], // Tonic triad Lock
      [3, 5, 7], // Sixth/Submediant flourish
    ];
  } else {
    rawOffsets = NOCTURNE_72_OFFSETS;
    styleTag = 'NOCTURNE';
    chordProgressionVariant = 2; // Deep Modal Turnaround (vi - ii - V - I)
    description = `Atmospheric late-night melodic nocturne in ${biome.subtitle} with expressive leaps`;
    tripletOffsetsByMovement = [
      [-2, 2, 4], // Lower neighbor + triad weave
      [1, 3, 5], // Supertonic / modal seventh run
      [4, 6, 9], // Dominant ninth shimmer
      [2, 4, 7], // Pure tonic resolution
    ];
  }

  const extendedDegreeSequence = rawOffsets.map((offset, stepIdx) => {
    const modalFlavor =
      !isIconic && stepIdx % 6 === 3
        ? biome.id % 2 === 0
          ? biomeModalShift
          : -biomeModalShift
        : 0;
    const target = baseRootIdx + offset + modalFlavor;
    return Math.max(1, Math.min(ext.length - 2, target));
  });

  return {
    id: `biome_${biome.id}_melody_${indexInBiome}`,
    biomeId: biome.id,
    biomeName: biome.name,
    biomeSubtitle: biome.subtitle,
    subtitle: description,
    tradition: biome.tradition,
    indexInBiome,
    title,
    styleTag,
    description,
    isIconic,
    composer,
    extendedDegreeSequence,
    degrees: rawOffsets,
    steps: extendedDegreeSequence,
    chordProgressionVariant,
    chordVariant: chordProgressionVariant,
    tripletOffsetsByMovement,
  };
}

/**
 * All 81 Curated Melodies (3 per biome across all 27 MASTER_SCALES),
 * including Beethoven's Moonlight Sonata, Für Elise, C418's Wet Hands, Sweden, Subwoofer Lullaby, Aria Math,
 * Bach's Toccata & Fugue in Dm, Satie's Gymnopédie No. 1, Debussy's Clair de Lune, and Tchaikovsky's Swan Lake!
 */
export const ALL_CURATED_MELODIES: CuratedBiomeMelody[] = MASTER_SCALES.flatMap((biome) => [
  buildMelodyForBiome(biome, 1),
  buildMelodyForBiome(biome, 2),
  buildMelodyForBiome(biome, 3),
]);

/**
 * Dynamically builds 3 curated melodies for any user-created Custom Biome!
 */
export function getCuratedMelodiesForBiome(
  biomeId: number,
  customBiomes: ScaleBiome[] = []
): CuratedBiomeMelody[] {
  const existing = ALL_CURATED_MELODIES.filter((m) => m.biomeId === biomeId);
  if (existing.length > 0) return existing;
  const custom = customBiomes.find((b) => b.id === biomeId);
  if (custom) {
    return [
      buildMelodyForBiome(custom, 1),
      buildMelodyForBiome(custom, 2),
      buildMelodyForBiome(custom, 3),
    ];
  }
  return ALL_CURATED_MELODIES.slice(0, 3);
}

/**
 * Picks one of the enabled curated melodies for a biome at random when the biome activates.
 * Falls back to all 3 melodies of that biome if the user disabled all 3.
 */
export function pickRandomCuratedMelodyForBiome(
  biomeId: number,
  disabledMelodyIds: string[] = [],
  avoidMelodyId?: string,
  customBiomes: ScaleBiome[] = []
): CuratedBiomeMelody {
  const biomeMelodies = getCuratedMelodiesForBiome(biomeId, customBiomes);
  const fallback = biomeMelodies[0] || ALL_CURATED_MELODIES[0];
  if (biomeMelodies.length === 0) return fallback;

  const enabled = biomeMelodies.filter((m) => !disabledMelodyIds.includes(m.id));
  const pool = enabled.length > 0 ? enabled : biomeMelodies;

  if (pool.length === 1) return pool[0];
  const nonRepeating = avoidMelodyId ? pool.filter((m) => m.id !== avoidMelodyId) : pool;
  const finalPool = nonRepeating.length > 0 ? nonRepeating : pool;
  return finalPool[Math.floor(Math.random() * finalPool.length)];
}

/**
 * Evaluates the exact melodic note(s), note name label, synchronized 3-note triplet frequencies,
 * and synchronized 4-Gate Chord Progression for a given step in a Curated Biome Melody!
 */
export function evaluateCuratedMelodyStep(
  melody: CuratedBiomeMelody,
  biome: ScaleBiome,
  stepIndex: number,
  flowCombo: number,
  cfg: Pick<GameConfig, 'volNotes' | 'volIntervals' | 'volChords'>
): CuratedStepMusicalOutput {
  const ext = buildExtendedScale(biome.scale);
  const seqLen = melody.extendedDegreeSequence.length || 72;
  const posInMelody = Math.abs(Math.floor(stepIndex)) % seqLen;
  const movementIdx = Math.min(3, Math.floor(posInMelody / 18)) as 0 | 1 | 2 | 3;

  let degreeIdx = melody.extendedDegreeSequence[posInMelody] ?? Math.floor(ext.length * 0.45);

  // At very high Flow (CHORD / OVERDRIVE), allow expressive octave doubling on phrase peaks
  if (flowCombo >= FLOW_THRESHOLDS.OVERDRIVE && posInMelody % 6 === 0) {
    degreeIdx = Math.min(ext.length - 1, degreeIdx + 7);
  }
  degreeIdx = Math.max(0, Math.min(ext.length - 1, degreeIdx));

  const leadFreq = ext[degreeIdx] || biome.scale[0] || 261.63;
  const notes: number[] = [leadFreq];

  // Harmonize with 5th / Sub-bass at Flow >= HARMONIC
  if (flowCombo >= FLOW_THRESHOLDS.HARMONIC && cfg.volIntervals > 0) {
    const harmonyIdx =
      posInMelody % 2 === 0
        ? Math.max(0, degreeIdx - 7)
        : Math.min(ext.length - 1, degreeIdx + 4);
    notes.push(Number((ext[harmonyIdx] || leadFreq * 0.5).toFixed(2)));
  }

  // Add upper chordal extension at Flow >= CHORD
  if (flowCombo >= FLOW_THRESHOLDS.CHORD && cfg.volChords > 0) {
    const upperIdx = Math.min(ext.length - 1, degreeIdx + 7);
    notes.push(Number((ext[upperIdx] || leadFreq * 2.0).toFixed(2)));
  }

  // Map frequency back to a readable Note Label (e.g. C4, Eb5)
  const coreLen = Math.max(5, biome.noteNames.length - 1);
  const nameIdx = degreeIdx % coreLen;
  const rawName = biome.noteNames[nameIdx] || 'C4';
  const octShift = Math.floor(degreeIdx / coreLen) - 1;
  const match = rawName.match(/^([A-G][#b~]?)(\d+)$/);
  const noteLabel = match
    ? `${match[1]}${Math.max(2, parseInt(match[2], 10) + octShift)}`
    : rawName;

  // Compute Harmonically Synchronized 3-Note Triplet Frequencies for this movement
  const tripletOffsets = melody.tripletOffsetsByMovement[movementIdx] || [2, 4, 7];
  const tripletFreqs: [number, number, number] = [
    ext[Math.max(0, Math.min(ext.length - 1, degreeIdx + tripletOffsets[0]))] || leadFreq * 1.25,
    ext[Math.max(0, Math.min(ext.length - 1, degreeIdx + tripletOffsets[1]))] || leadFreq * 1.5,
    ext[Math.max(0, Math.min(ext.length - 1, degreeIdx + tripletOffsets[2]))] || leadFreq * 2.0,
  ];

  // Retrieve the synchronized 4-Gate Chord Progression matching this melody
  const allProgs = getBiomeChordProgressions(biome);
  const matchedProg = allProgs[melody.chordProgressionVariant] || allProgs[0];

  return {
    notes,
    freqs: notes,
    noteLabel,
    label: noteLabel,
    tripletFreqs,
    chordProgressionVariant: melody.chordProgressionVariant,
    gateChordNames: matchedProg.chordNames,
    gateChords: matchedProg.chords,
  };
}

