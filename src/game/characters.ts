/**
 * Reactive-Eye Pixel-Art Character Avatar System for NEON ASCENT: OMNI
 * - Crisp 11x11 stepped pixel-art silhouettes for all 8 geometric shapes:
 *   Circle, Triangle, Square [Free Starters], Star [80], Crescent Moon [160],
 *   Diamond [300], Hexagon [520], Pentagon [800].
 * - Two solid rectangular reactive eyes (no inner dots/pupils), tracking pointer/gravity/motion.
 * - Includes Standard, Radiant Gold Edition (1000–1600 Orbs) and Prismatic 7-Color Rainbow Edition (2000–2600 Orbs).
 */

export type BaseAvatarShape =
  | 'circle'
  | 'triangle'
  | 'square'
  | 'star'
  | 'crescent'
  | 'diamond'
  | 'hexagon'
  | 'pentagon'
  | 'heart'
  | 'flower'
  | 'cherry'
  | 'rockhand'
  | 'leaf'
  | 'skull'
  | 'eyeball'
  | 'hexagram'
  | 'cat';

export type AvatarTier = 'standard' | 'gold' | 'rainbow';

export interface CharacterPerkModifiers {
  maxHealth: number; // Tier-based HP: Standard = 3 hits, Gold = 7 hits, Prism/Rainbow = 15 hits
  bonusMagnetRadiusPx: number;
  doubleOrbChance: number;
  orbBonusPct: number; // Progressive % extra Orb yield per character to accelerate progression
  wallBounceElasticity: number; // Progressive Wall-Dash bounce elasticity scaling up with character tier!
  jumpApexMultiplier: number;
  dashCooldownMultiplier: number;
  hazardPenaltyMultiplier: number;
  startWithShield: boolean;
  autoRegenShieldSec: number; // 0 = disabled
  flowGainMultiplier: number;
  platformWidthBonusPx: number;
  stallDecayMultiplier: number;
  scoreMultiplier: number;
  powerUpDurationMultiplier: number;
  chordGateBonusOrbs: number;
  chordGateDoublePowerUp: boolean;
  permanentAirJump: boolean;
}

export interface CharacterAvatarDef {
  id: string;
  name: string;
  nameFa?: string;
  shape: BaseAvatarShape;
  tier: AvatarTier;
  maxHealth?: number;
  costOrbs: number;
  isSecret?: boolean;
  unlockLevel?: number;
  hasSingleCentralIris?: boolean;
  perkTitle: string;
  perkDesc: string;
  perks: CharacterPerkModifiers;
}

const DEFAULT_PERKS: CharacterPerkModifiers = {
  maxHealth: 3,
  bonusMagnetRadiusPx: 0,
  doubleOrbChance: 0,
  orbBonusPct: 0,
  wallBounceElasticity: 1.0,
  jumpApexMultiplier: 1.0,
  dashCooldownMultiplier: 1.0,
  hazardPenaltyMultiplier: 1.0,
  startWithShield: false,
  autoRegenShieldSec: 0,
  flowGainMultiplier: 1.0,
  platformWidthBonusPx: 0,
  stallDecayMultiplier: 1.0,
  scoreMultiplier: 1.0,
  powerUpDurationMultiplier: 1.0,
  chordGateBonusOrbs: 0,
  chordGateDoublePowerUp: false,
  permanentAirJump: false,
};

const RAW_CHARACTER_AVATARS: CharacterAvatarDef[] = [
  // ============================================================================
  // TIER 1: STANDARD PIXEL AVATARS (+150% Prices: Free Starters, then 120, 240, 450, 775, 1200)
  // ============================================================================
  {
    id: 'circle',
    name: 'Pulse Orb',
    nameFa: 'گوی پالس',
    shape: 'circle',
    tier: 'standard',
    costOrbs: 0,
    perkTitle: 'Balanced Core',
    perkDesc: 'Classic pixel sphere with dual rectangular eyes.',
    perks: { ...DEFAULT_PERKS, orbBonusPct: 0, wallBounceElasticity: 1.0, flowGainMultiplier: 1.0 },
  },
  {
    id: 'triangle',
    name: 'Delta Prism',
    nameFa: 'منشور دلتا',
    shape: 'triangle',
    tier: 'standard',
    costOrbs: 0,
    perkTitle: '+5% ORBS · +1% FLOW',
    perkDesc: 'Stepped pixel delta with +5% Orb attraction & +1% Flow speed.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 5,
      wallBounceElasticity: 1.02,
      bonusMagnetRadiusPx: 8,
      doubleOrbChance: 0.05,
      flowGainMultiplier: 1.01,
    },
  },
  {
    id: 'square',
    name: 'Neon Cube',
    nameFa: 'مکعب نئون',
    shape: 'square',
    tier: 'standard',
    costOrbs: 0,
    perkTitle: '+8% ORBS · +2% FLOW',
    perkDesc: 'Precision pixel cube with +8% Orb attraction & +2% Flow speed.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 8,
      wallBounceElasticity: 1.04,
      bonusMagnetRadiusPx: 12,
      doubleOrbChance: 0.08,
      flowGainMultiplier: 1.02,
    },
  },
  {
    id: 'star',
    name: 'Nova Star',
    nameFa: 'ستاره نوا',
    shape: 'star',
    tier: 'standard',
    costOrbs: 120,
    perkTitle: '+14% ORBS · +3% FLOW',
    perkDesc: '+14% Orb yield, +3% Flow speed, +18px Magnet & +5% Score.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 14,
      wallBounceElasticity: 1.06,
      bonusMagnetRadiusPx: 18,
      doubleOrbChance: 0.14,
      scoreMultiplier: 1.05,
      flowGainMultiplier: 1.03,
    },
  },
  {
    id: 'crescent',
    name: 'Lunar Crescent',
    nameFa: 'هلال ماه',
    shape: 'crescent',
    tier: 'standard',
    costOrbs: 240,
    perkTitle: '+20% ORBS · +5% FLOW',
    perkDesc: '+20% Orb yield, +5% Flow speed, +24px Magnet & wider pads.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 20,
      wallBounceElasticity: 1.08,
      bonusMagnetRadiusPx: 24,
      doubleOrbChance: 0.2,
      platformWidthBonusPx: 6,
      flowGainMultiplier: 1.05,
    },
  },
  {
    id: 'diamond',
    name: 'Aether Rhombus',
    nameFa: 'الماس اتر',
    shape: 'diamond',
    tier: 'standard',
    costOrbs: 450,
    perkTitle: '+26% ORBS · +6% FLOW',
    perkDesc: '+26% Orb yield, +6% Flow speed & +35px Magnet radius.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 26,
      wallBounceElasticity: 1.1,
      bonusMagnetRadiusPx: 35,
      doubleOrbChance: 0.26,
      flowGainMultiplier: 1.06,
    },
  },
  {
    id: 'hexagon',
    name: 'Hexa Core',
    nameFa: 'هسته شش‌ضلعی',
    shape: 'hexagon',
    tier: 'standard',
    costOrbs: 775,
    perkTitle: '+32% ORBS · +8% FLOW',
    perkDesc: '+32% Orb yield, +42px Magnet & +8% Flow speed.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 32,
      wallBounceElasticity: 1.12,
      bonusMagnetRadiusPx: 42,
      doubleOrbChance: 0.32,
      flowGainMultiplier: 1.08,
    },
  },
  {
    id: 'pentagon',
    name: 'Omni Shield',
    nameFa: 'سپر پنج‌ضلعی',
    shape: 'pentagon',
    tier: 'standard',
    costOrbs: 1200,
    perkTitle: '+38% ORBS · +9% FLOW',
    perkDesc: '+38% Orb yield, +9% Flow speed, +50px Magnet & -15% Hazard loss.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 38,
      wallBounceElasticity: 1.14,
      bonusMagnetRadiusPx: 50,
      doubleOrbChance: 0.38,
      hazardPenaltyMultiplier: 0.85,
      flowGainMultiplier: 1.09,
    },
  },

  // ============================================================================
  // TIER 2: RADIANT GOLD EDITION (+150% Prices: 1500–2400 Orbs)
  // ============================================================================
  {
    id: 'circle_gold',
    name: 'Auric Orb',
    nameFa: 'گوی طلایی',
    shape: 'circle',
    tier: 'gold',
    costOrbs: 1500,
    perkTitle: '+48% ORBS · +10% FLOW',
    perkDesc: '+75px Magnet, +48% Orb yield, +10% Flow & +22% Wall Bounce.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 48,
      wallBounceElasticity: 1.22,
      bonusMagnetRadiusPx: 75,
      doubleOrbChance: 0.48,
      scoreMultiplier: 1.15,
      flowGainMultiplier: 1.1,
    },
  },
  {
    id: 'triangle_gold',
    name: 'Solar Delta',
    nameFa: 'دلتای خورشیدی',
    shape: 'triangle',
    tier: 'gold',
    costOrbs: 1500,
    perkTitle: '+52% ORBS · +11% FLOW',
    perkDesc: '+52% Orb yield, +11% Flow, 30% faster Dash & +24% Wall Bounce.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 52,
      wallBounceElasticity: 1.24,
      bonusMagnetRadiusPx: 65,
      doubleOrbChance: 0.52,
      dashCooldownMultiplier: 0.7,
      scoreMultiplier: 1.2,
      flowGainMultiplier: 1.11,
    },
  },
  {
    id: 'square_gold',
    name: 'Gilded Bastion',
    nameFa: 'دژ طلایی',
    shape: 'square',
    tier: 'gold',
    costOrbs: 1500,
    perkTitle: '+56% ORBS · +12% FLOW',
    perkDesc: '+56% Orb yield, +12% Flow, Starts with Shield & +26% Wall Bounce.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 56,
      wallBounceElasticity: 1.26,
      bonusMagnetRadiusPx: 68,
      doubleOrbChance: 0.56,
      startWithShield: true,
      hazardPenaltyMultiplier: 0.6,
      flowGainMultiplier: 1.12,
    },
  },
  {
    id: 'star_gold',
    name: 'Supernova Gold',
    nameFa: 'ابرنواختر طلایی',
    shape: 'star',
    tier: 'gold',
    costOrbs: 1800,
    perkTitle: '+62% ORBS · +14% FLOW',
    perkDesc: '+62% Orb yield, +14% Flow & +28% Wall Bounce.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 62,
      wallBounceElasticity: 1.28,
      bonusMagnetRadiusPx: 74,
      doubleOrbChance: 0.62,
      flowGainMultiplier: 1.14,
      scoreMultiplier: 1.25,
    },
  },
  {
    id: 'crescent_gold',
    name: 'Golden Eclipse',
    nameFa: 'کسوف طلایی',
    shape: 'crescent',
    tier: 'gold',
    costOrbs: 1800,
    perkTitle: '+68% ORBS · +15% FLOW',
    perkDesc: '+68% Orb yield, +15% Flow, +18px wider pads & +30% Wall Bounce.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 68,
      wallBounceElasticity: 1.3,
      bonusMagnetRadiusPx: 78,
      doubleOrbChance: 0.68,
      platformWidthBonusPx: 18,
      stallDecayMultiplier: 0.5,
      flowGainMultiplier: 1.15,
    },
  },
  {
    id: 'diamond_gold',
    name: 'Sovereign Jewel',
    nameFa: 'گوهر شاهانه',
    shape: 'diamond',
    tier: 'gold',
    costOrbs: 2025,
    perkTitle: '+74% ORBS · +16% FLOW',
    perkDesc: '+74% Orb yield, +16% Flow, +40% Score & +32% Wall Bounce.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 74,
      wallBounceElasticity: 1.32,
      bonusMagnetRadiusPx: 84,
      doubleOrbChance: 0.74,
      scoreMultiplier: 1.4,
      powerUpDurationMultiplier: 1.35,
      flowGainMultiplier: 1.16,
    },
  },
  {
    id: 'hexagon_gold',
    name: 'Midas Hexa',
    nameFa: 'شش‌ضلعی میداس',
    shape: 'hexagon',
    tier: 'gold',
    costOrbs: 2175,
    perkTitle: '+80% ORBS · +17% FLOW',
    perkDesc: '+80% Orb yield, +17% Flow, +1 Gate Orb & +34% Wall Bounce.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 80,
      wallBounceElasticity: 1.34,
      bonusMagnetRadiusPx: 90,
      doubleOrbChance: 0.8,
      chordGateBonusOrbs: 1,
      flowGainMultiplier: 1.17,
    },
  },
  {
    id: 'pentagon_gold',
    name: 'Valkyrie Gold',
    nameFa: 'والکیری طلایی',
    shape: 'pentagon',
    tier: 'gold',
    costOrbs: 2400,
    perkTitle: '+88% ORBS · +18% FLOW',
    perkDesc: '+88% Orb yield, +18% Flow, Air Jump, Shield & +38% Wall Bounce.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 88,
      wallBounceElasticity: 1.38,
      bonusMagnetRadiusPx: 96,
      doubleOrbChance: 0.88,
      permanentAirJump: true,
      startWithShield: true,
      flowGainMultiplier: 1.18,
    },
  },

  // ============================================================================
  // TIER 3: PRISMATIC 7-COLOR RAINBOW EDITION (+150% Prices: 3000–3900 Orbs)
  // ============================================================================
  {
    id: 'circle_rainbow',
    name: 'Prism Orb',
    nameFa: 'گوی پریزم',
    shape: 'circle',
    tier: 'rainbow',
    costOrbs: 3000,
    perkTitle: '+100% ORBS · +19% FLOW',
    perkDesc: '+135px Magnet, +100% Orb yield, +19% Flow & +45% Wall Bounce.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 100,
      wallBounceElasticity: 1.45,
      bonusMagnetRadiusPx: 135,
      doubleOrbChance: 0.9,
      scoreMultiplier: 1.4,
      flowGainMultiplier: 1.19,
    },
  },
  {
    id: 'triangle_rainbow',
    name: 'Prism Delta',
    nameFa: 'دلتای پریزم',
    shape: 'triangle',
    tier: 'rainbow',
    costOrbs: 3000,
    perkTitle: '+108% ORBS · +20% FLOW',
    perkDesc: '+108% Orbs, +20% Flow, Air Jump, 45% faster Dash & +48% Wall Bounce.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 108,
      wallBounceElasticity: 1.48,
      bonusMagnetRadiusPx: 115,
      doubleOrbChance: 0.92,
      permanentAirJump: true,
      dashCooldownMultiplier: 0.55,
      scoreMultiplier: 1.4,
      flowGainMultiplier: 1.2,
    },
  },
  {
    id: 'square_rainbow',
    name: 'Chroma Cube',
    nameFa: 'مکعب رنگین‌کمان',
    shape: 'square',
    tier: 'rainbow',
    costOrbs: 3000,
    perkTitle: '+115% ORBS · +21% FLOW',
    perkDesc: '+115% Orbs, +21% Flow, Auto-Shield (18s) & +50% Wall Bounce.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 115,
      wallBounceElasticity: 1.5,
      bonusMagnetRadiusPx: 120,
      doubleOrbChance: 0.95,
      startWithShield: true,
      autoRegenShieldSec: 18,
      hazardPenaltyMultiplier: 0.4,
      flowGainMultiplier: 1.21,
    },
  },
  {
    id: 'star_rainbow',
    name: 'Astral Nova',
    nameFa: 'نواختر کیهانی',
    shape: 'star',
    tier: 'rainbow',
    costOrbs: 3300,
    perkTitle: '+125% ORBS · +22% FLOW',
    perkDesc: '+125% Orbs, +22% Flow, +50% Score & +54% Wall Bounce.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 125,
      wallBounceElasticity: 1.54,
      flowGainMultiplier: 1.22,
      scoreMultiplier: 1.5,
      bonusMagnetRadiusPx: 125,
      doubleOrbChance: 1.0,
    },
  },
  {
    id: 'crescent_rainbow',
    name: 'Prism Moon',
    nameFa: 'ماه پریزم',
    shape: 'crescent',
    tier: 'rainbow',
    costOrbs: 3300,
    perkTitle: '+132% ORBS · +22% FLOW',
    perkDesc: '+132% Orbs, +22% Flow, +28px wider pads, Air Jump & +56% Wall Bounce.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 132,
      wallBounceElasticity: 1.56,
      bonusMagnetRadiusPx: 130,
      doubleOrbChance: 1.0,
      platformWidthBonusPx: 28,
      stallDecayMultiplier: 0.3,
      permanentAirJump: true,
      flowGainMultiplier: 1.22,
    },
  },
  {
    id: 'diamond_rainbow',
    name: 'Prism Rhombus',
    nameFa: 'الماس پریزم',
    shape: 'diamond',
    tier: 'rainbow',
    costOrbs: 3600,
    perkTitle: '+140% ORBS · +23% FLOW',
    perkDesc: '+140% Orbs, +23% Flow, +75% Score & +60% Wall Bounce.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 140,
      wallBounceElasticity: 1.6,
      bonusMagnetRadiusPx: 140,
      scoreMultiplier: 1.75,
      powerUpDurationMultiplier: 1.6,
      doubleOrbChance: 1.0,
      flowGainMultiplier: 1.23,
    },
  },
  {
    id: 'hexagon_rainbow',
    name: 'Archon Hex',
    nameFa: 'آرکون پریزم',
    shape: 'hexagon',
    tier: 'rainbow',
    costOrbs: 3750,
    perkTitle: '+150% ORBS · +24% FLOW',
    perkDesc: '+150% Orbs, +24% Flow, +2 Gate Orbs, 2x Gate Buff & +62% Wall Bounce.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 150,
      wallBounceElasticity: 1.62,
      bonusMagnetRadiusPx: 145,
      doubleOrbChance: 1.0,
      chordGateBonusOrbs: 2,
      chordGateDoublePowerUp: true,
      flowGainMultiplier: 1.24,
    },
  },
  {
    id: 'pentagon_rainbow',
    name: 'Omni Crest',
    nameFa: 'تاج اُمنی',
    shape: 'pentagon',
    tier: 'rainbow',
    costOrbs: 3900,
    perkTitle: '+165% ORBS · +25% FLOW',
    perkDesc: '+165% Orbs, +25% Flow, Auto-Shield (16s), Air Jump & +65% Wall Bounce.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 165,
      wallBounceElasticity: 1.65,
      doubleOrbChance: 1.0,
      startWithShield: true,
      autoRegenShieldSec: 16,
      permanentAirJump: true,
      bonusMagnetRadiusPx: 160,
      scoreMultiplier: 1.65,
      flowGainMultiplier: 1.25,
    },
  },

  // ============================================================================
  // SECRET LEGENDARY SKINS (Hidden until Unlocked at Level 5, Level 10, Level 15)
  // ============================================================================
  // --- LEVEL 5 SECRET WHITE SKINS (Heart, Flower, Cherry/Apple) ---
  {
    id: 'secret_heart',
    name: 'Cyber Heart',
    nameFa: 'قلب سایبری',
    shape: 'heart',
    tier: 'standard',
    costOrbs: 0,
    isSecret: true,
    unlockLevel: 5,
    perkTitle: 'SECRET LV.5 · +42% ORBS',
    perkDesc: 'Secret Level 5 Heart Skin · +42% Orb yield, +8% Flow & Start Shield.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 42,
      wallBounceElasticity: 1.18,
      bonusMagnetRadiusPx: 55,
      doubleOrbChance: 0.42,
      startWithShield: true,
      flowGainMultiplier: 1.08,
    },
  },
  {
    id: 'secret_flower',
    name: 'Lotus Blossom',
    nameFa: 'گل نیلوفر',
    shape: 'flower',
    tier: 'standard',
    costOrbs: 0,
    isSecret: true,
    unlockLevel: 5,
    perkTitle: 'SECRET LV.5 · +45% ORBS',
    perkDesc: 'Secret Level 5 Flower Skin · +45% Orb yield, +9% Flow & +14px wider pads.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 45,
      wallBounceElasticity: 1.18,
      bonusMagnetRadiusPx: 60,
      doubleOrbChance: 0.45,
      platformWidthBonusPx: 14,
      flowGainMultiplier: 1.09,
    },
  },
  {
    id: 'secret_cherry',
    name: 'Ruby Cherry',
    nameFa: 'گیلاس/سیب پیکسلی',
    shape: 'cherry',
    tier: 'standard',
    costOrbs: 0,
    isSecret: true,
    unlockLevel: 5,
    perkTitle: 'SECRET LV.5 · +48% ORBS',
    perkDesc: 'Secret Level 5 Fruit Skin · +48% Orb yield, +10% Flow & +20% Score.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 48,
      wallBounceElasticity: 1.2,
      bonusMagnetRadiusPx: 64,
      doubleOrbChance: 0.48,
      scoreMultiplier: 1.2,
      flowGainMultiplier: 1.1,
    },
  },

  // --- LEVEL 10 SECRET GOLD SKINS (Rock & Roll Hand, Botanical Leaf, Cyber Skull) ---
  {
    id: 'secret_rockhand',
    name: 'Rock & Roll Hand',
    nameFa: 'دست راک اند رول',
    shape: 'rockhand',
    tier: 'gold',
    costOrbs: 0,
    isSecret: true,
    unlockLevel: 10,
    perkTitle: 'SECRET LV.10 · +92% ORBS',
    perkDesc: 'Secret Level 10 Gold Rock Hand · +92% Orbs, +16% Flow, Fast Dash & Air Jump.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 92,
      wallBounceElasticity: 1.4,
      bonusMagnetRadiusPx: 105,
      doubleOrbChance: 0.9,
      dashCooldownMultiplier: 0.65,
      permanentAirJump: true,
      scoreMultiplier: 1.45,
      flowGainMultiplier: 1.16,
    },
  },
  {
    id: 'secret_leaf',
    name: 'Golden Sativa Leaf',
    nameFa: 'برگ طلایی',
    shape: 'leaf',
    tier: 'gold',
    costOrbs: 0,
    isSecret: true,
    unlockLevel: 10,
    perkTitle: 'SECRET LV.10 · +95% ORBS',
    perkDesc: 'Secret Level 10 Gold Leaf · +95% Orbs, +18% Flow & Slow Decay.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 95,
      wallBounceElasticity: 1.4,
      bonusMagnetRadiusPx: 110,
      doubleOrbChance: 0.92,
      flowGainMultiplier: 1.18,
      stallDecayMultiplier: 0.4,
      scoreMultiplier: 1.45,
    },
  },
  {
    id: 'secret_skull',
    name: 'Midas Cyber Skull',
    nameFa: 'جمجمه طلایی',
    shape: 'skull',
    tier: 'gold',
    costOrbs: 0,
    isSecret: true,
    unlockLevel: 10,
    perkTitle: 'SECRET LV.10 · +98% ORBS',
    perkDesc: 'Secret Level 10 Gold Skull · +98% Orbs, +19% Flow, Auto-Shield (20s) & Armor.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 98,
      wallBounceElasticity: 1.42,
      bonusMagnetRadiusPx: 115,
      doubleOrbChance: 0.95,
      startWithShield: true,
      autoRegenShieldSec: 20,
      hazardPenaltyMultiplier: 0.45,
      flowGainMultiplier: 1.19,
    },
  },

  // --- LEVEL 15 SECRET PRISM LEGENDARY SKINS (Prism Eyeball, Star of David, Cat Head) ---
  {
    id: 'secret_eyeball',
    name: 'Omni Prism Eyeball',
    nameFa: 'چشم پریزم متحرک',
    shape: 'eyeball',
    tier: 'rainbow',
    costOrbs: 0,
    isSecret: true,
    unlockLevel: 15,
    hasSingleCentralIris: true,
    perkTitle: 'SECRET LV.15 · +180% ORBS',
    perkDesc: 'Prismatic Sclera with live tracking central Cornea · +180% Orbs & +25% Flow!',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 180,
      wallBounceElasticity: 1.72,
      bonusMagnetRadiusPx: 185,
      doubleOrbChance: 1.0,
      startWithShield: true,
      autoRegenShieldSec: 14,
      permanentAirJump: true,
      scoreMultiplier: 1.85,
      flowGainMultiplier: 1.25,
    },
  },
  {
    id: 'secret_hexagram',
    name: 'Prism Star of David',
    nameFa: 'ستاره داوود پریزم',
    shape: 'hexagram',
    tier: 'rainbow',
    costOrbs: 0,
    isSecret: true,
    unlockLevel: 15,
    perkTitle: 'SECRET LV.15 · +175% ORBS',
    perkDesc: 'Sacred 6-Pointed Prism Star · +175% Orbs, +24% Flow, 2x Gate Buff & +3 Gate Orbs.',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 175,
      wallBounceElasticity: 1.7,
      bonusMagnetRadiusPx: 175,
      doubleOrbChance: 1.0,
      chordGateBonusOrbs: 3,
      chordGateDoublePowerUp: true,
      permanentAirJump: true,
      scoreMultiplier: 1.8,
      flowGainMultiplier: 1.24,
    },
  },
  {
    id: 'secret_cat',
    name: 'Prism Neko Cat',
    nameFa: 'گربه نئونی پریزم',
    shape: 'cat',
    tier: 'rainbow',
    costOrbs: 0,
    isSecret: true,
    unlockLevel: 15,
    perkTitle: 'SECRET LV.15 · +185% ORBS',
    perkDesc: '9-Lives Prismatic Cat · +185% Orbs, +25% Flow, Hyper Wall-Bounce & Auto-Shield (14s).',
    perks: {
      ...DEFAULT_PERKS,
      orbBonusPct: 185,
      wallBounceElasticity: 1.78,
      bonusMagnetRadiusPx: 190,
      doubleOrbChance: 1.0,
      startWithShield: true,
      autoRegenShieldSec: 14,
      permanentAirJump: true,
      dashCooldownMultiplier: 0.5,
      scoreMultiplier: 1.85,
      flowGainMultiplier: 1.25,
    },
  },
];

export const CHARACTER_AVATARS: CharacterAvatarDef[] = RAW_CHARACTER_AVATARS.map((av) => {
  const tierMaxHp = av.tier === 'rainbow' ? 15 : av.tier === 'gold' ? 7 : 3;
  return {
    ...av,
    maxHealth: tierMaxHp,
    perks: {
      ...av.perks,
      maxHealth: tierMaxHp,
    },
  };
});

export const SECRET_AVATAR_IDS: string[] = CHARACTER_AVATARS.filter((c) => c.isSecret).map(
  (c) => c.id
);

export const STARTER_UNLOCKED_AVATARS: string[] = ['circle', 'triangle', 'square'];

export function getCharacterById(id?: string): CharacterAvatarDef {
  if (!id) return CHARACTER_AVATARS[0];
  return CHARACTER_AVATARS.find((c) => c.id === id) || CHARACTER_AVATARS[0];
}

const SEVEN_RAINBOW_COLORS = [
  '#ff1e56', // 1. Crimson Red
  '#ff7b00', // 2. Vivid Orange
  '#ffe600', // 3. Solar Yellow
  '#00ff88', // 4. Emerald Green
  '#00d4ff', // 5. Cyber Cyan
  '#5e5ce6', // 6. Indigo Blue
  '#d946ef', // 7. Electric Violet
];

/**
 * Pixel-Art Bitmap Grids for 8 geometric shapes (11x11) + 9 high-resolution Secret Skins (15x15).
 * '1' = filled pixel block, '.' = transparent.
 */
const PIXEL_GRIDS: Record<BaseAvatarShape, string[]> = {
  circle: [
    '...11111...',
    '..1111111..',
    '.111111111.',
    '11111111111',
    '11111111111',
    '11111111111',
    '11111111111',
    '11111111111',
    '.111111111.',
    '..1111111..',
    '...11111...',
  ],
  square: [
    '.111111111.',
    '11111111111',
    '11111111111',
    '11111111111',
    '11111111111',
    '11111111111',
    '11111111111',
    '11111111111',
    '11111111111',
    '11111111111',
    '.111111111.',
  ],
  triangle: [
    '.....1.....',
    '....111....',
    '....111....',
    '...11111...',
    '...11111...',
    '..1111111..',
    '..1111111..',
    '.111111111.',
    '.111111111.',
    '11111111111',
    '11111111111',
  ],
  star: [
    '.....1.....',
    '....111....',
    '....111....',
    '11111111111',
    '.111111111.',
    '..1111111..',
    '..1111111..',
    '.111111111.',
    '.1111.1111.',
    '111.....111',
    '11.......11',
  ],
  crescent: [
    '...111111..',
    '..11111111.',
    '.1111111...',
    '1111111....',
    '111111.....',
    '111111.....',
    '111111.....',
    '1111111....',
    '.1111111...',
    '..11111111.',
    '...111111..',
  ],
  diamond: [
    '.....1.....',
    '....111....',
    '...11111...',
    '..1111111..',
    '.111111111.',
    '11111111111',
    '.111111111.',
    '..1111111..',
    '...11111...',
    '....111....',
    '.....1.....',
  ],
  hexagon: [
    '...11111...',
    '..1111111..',
    '.111111111.',
    '11111111111',
    '11111111111',
    '11111111111',
    '11111111111',
    '11111111111',
    '.111111111.',
    '..1111111..',
    '...11111...',
  ],
  pentagon: [
    '.....1.....',
    '...11111...',
    '..1111111..',
    '.111111111.',
    '11111111111',
    '11111111111',
    '11111111111',
    '.111111111.',
    '.111111111.',
    '..1111111..',
    '..1111111..',
  ],

  // --- 15x15 HIGH-RESOLUTION SECRET SKINS ---
  heart: [
    '..1111...1111..',
    '.111111.111111.',
    '111111111111111',
    '111111111111111',
    '111111111111111',
    '111111111111111',
    '.1111111111111.',
    '.1111111111111.',
    '..11111111111..',
    '...111111111...',
    '....1111111....',
    '.....11111.....',
    '......111......',
    '.......1.......',
    '...............',
  ],
  flower: [
    '.....11.11.....',
    '....1111111....',
    '..11.11111.11..',
    '.1111111111111.',
    '.1111111111111.',
    '111111111111111',
    '.1111111111111.',
    '..11111111111..',
    '.1111111111111.',
    '111111111111111',
    '.1111111111111.',
    '.1111111111111.',
    '..11.11111.11..',
    '....1111111....',
    '.....11.11.....',
  ],
  cherry: [
    '.......11111...',
    '......11..111..',
    '.....11....11..',
    '....11.........',
    '...11.111.111..',
    '..111111111111.',
    '.11111111111111',
    '.11111111111111',
    '111111111111111',
    '111111111111111',
    '111111111111111',
    '.11111111111111',
    '.1111111111111.',
    '..11111111111..',
    '....111.111....',
  ],
  rockhand: [
    '..11.......11..',
    '..11.......11..',
    '..11.......11..',
    '..11.11.11.11..',
    '..11.11.11.11..',
    '..11111111111..',
    '.1111111111111.',
    '11111111111111.',
    '11111111111111.',
    '11111111111111.',
    '.111111111111..',
    '..1111111111...',
    '...11111111....',
    '...11111111....',
    '....111111.....',
  ],
  leaf: [
    '.......1.......',
    '......111......',
    '..1...111...1..',
    '..11..111..11..',
    '...111111111...',
    '11..1111111..11',
    '.1111111111111.',
    '..11111111111..',
    '...111111111...',
    '.1111111111111.',
    '....1111111....',
    '.....11111.....',
    '.......1.......',
    '.......1.......',
    '......111......',
  ],
  skull: [
    '....1111111....',
    '..11111111111..',
    '.1111111111111.',
    '111111111111111',
    '111111111111111',
    '111111111111111',
    '111111111111111',
    '111111111111111',
    '.1111111111111.',
    '..11111.11111..',
    '...111111111...',
    '...11.111.11...',
    '...11.111.11...',
    '....1111111....',
    '...............',
  ],
  eyeball: [
    '....1111111....',
    '..11111111111..',
    '.1111111111111.',
    '.1111111111111.',
    '111111111111111',
    '111111111111111',
    '111111111111111',
    '111111111111111',
    '111111111111111',
    '111111111111111',
    '111111111111111',
    '.1111111111111.',
    '.1111111111111.',
    '..11111111111..',
    '....1111111....',
  ],
  hexagram: [
    '.......1.......',
    '......111......',
    '.....11111.....',
    '111111111111111',
    '.1111111111111.',
    '..11111111111..',
    '...111111111...',
    '..11111111111..',
    '.1111111111111.',
    '111111111111111',
    '.....11111.....',
    '......111......',
    '.......1.......',
    '...............',
    '...............',
  ],
  cat: [
    '.11.........11.',
    '.111.......111.',
    '.1111.....1111.',
    '.1111111111111.',
    '111111111111111',
    '111111111111111',
    '111111111111111',
    '111111111111111',
    '111111111111111',
    '111111111111111',
    '.1111111111111.',
    '.1111111111111.',
    '..11111111111..',
    '....1111111....',
    '...............',
  ],
};

/**
 * Traces the stepped pixel-art path of any avatar shape inside [0..w, 0..h].
 * Each horizontal run of '1' cells is added as a crisp axis-aligned sub-rectangle.
 */
export function traceAvatarShapePath(
  ctx: CanvasRenderingContext2D,
  shape: BaseAvatarShape,
  w: number,
  h: number
): void {
  const grid = PIXEL_GRIDS[shape] || PIXEL_GRIDS.circle;
  const rows = grid.length;
  const cols = grid[0].length;
  const cellW = w / cols;
  const cellH = h / rows;

  ctx.beginPath();
  for (let r = 0; r < rows; r++) {
    const rowStr = grid[r];
    let c = 0;
    while (c < cols) {
      if (rowStr[c] === '1') {
        let endC = c + 1;
        while (endC < cols && rowStr[endC] === '1') {
          endC++;
        }
        const rx = Math.floor(c * cellW);
        const ry = Math.floor(r * cellH);
        const rw = Math.ceil(endC * cellW) - rx;
        const rh = Math.ceil((r + 1) * cellH) - ry;
        ctx.rect(rx, ry, rw, rh);
        c = endC;
      } else {
        c++;
      }
    }
  }
}

/**
 * Draws the stepped pixel-art border cells around the silhouette for authentic 8-bit/16-bit crispness.
 */
function drawPixelBorderCells(
  ctx: CanvasRenderingContext2D,
  shape: BaseAvatarShape,
  w: number,
  h: number,
  borderColor: string
): void {
  const grid = PIXEL_GRIDS[shape] || PIXEL_GRIDS.circle;
  const rows = grid.length;
  const cols = grid[0].length;
  const cellW = w / cols;
  const cellH = h / rows;

  ctx.fillStyle = borderColor;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== '1') continue;
      const isEdge =
        r === 0 ||
        r === rows - 1 ||
        c === 0 ||
        c === cols - 1 ||
        grid[r - 1]?.[c] !== '1' ||
        grid[r + 1]?.[c] !== '1' ||
        grid[r]?.[c - 1] !== '1' ||
        grid[r]?.[c + 1] !== '1';
      if (isEdge) {
        const rx = Math.floor(c * cellW);
        const ry = Math.floor(r * cellH);
        const rw = Math.max(1, Math.ceil((c + 1) * cellW) - rx);
        const rh = Math.max(1, Math.ceil((r + 1) * cellH) - ry);
        ctx.fillRect(rx, ry, rw, rh);
      }
    }
  }
}

/**
 * Renders any CharacterAvatarDef at [0..w, 0..h] local coordinates with:
 * - Stepped Pixel-Art Silhouette (11x11 standard or 15x15 secret legendary)
 * - Standard / Radiant Gold / Animated 7-Color Rainbow shaders
 * - For `secret_eyeball` (`hasSingleCentralIris: true`): Prismatic 7-color rainbow sclera body with a
 *   single moving pixel-art Cornea/Iris + Pupil in the center (instead of two rectangular eyes).
 * - For all other characters: Two solid rectangular eyes tracking (eyeLookX, eyeLookY).
 */
export function drawCharacterAvatar(
  ctx: CanvasRenderingContext2D,
  avatar: CharacterAvatarDef,
  w: number,
  h: number,
  gameTime: number,
  primaryColor: string,
  horizonColor: string,
  eyeLookX: number,
  eyeLookY: number,
  tintOverride?: string
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  traceAvatarShapePath(ctx, avatar.shape, w, h);

  if (tintOverride) {
    ctx.fillStyle = tintOverride;
    ctx.fill();
    ctx.restore();
    return;
  }

  // 1. Pixel Body Fill & Stepped Rim by Tier
  if (avatar.tier === 'gold') {
    const shimmerPhase = (gameTime * 1.6) % 2;
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#fef08a');
    grad.addColorStop(0.35, '#f59e0b');
    grad.addColorStop(0.55, '#fffbeb');
    grad.addColorStop(0.8, '#d97706');
    grad.addColorStop(1, '#fde047');

    ctx.shadowBlur = 12;
    ctx.shadowColor = '#fbbf24';
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.save();
    ctx.clip();
    const bandX = Math.floor((shimmerPhase - 0.5) * w * 1.8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillRect(bandX, 0, Math.max(3, Math.floor(w * 0.25)), h);
    ctx.restore();

    ctx.shadowBlur = 0;
    drawPixelBorderCells(ctx, avatar.shape, w, h, '#fef08a');
  } else if (avatar.tier === 'rainbow') {
    const angle = gameTime * 2.2;
    const gx = Math.cos(angle) * w * 0.6;
    const gy = Math.sin(angle) * h * 0.6;
    const grad = ctx.createLinearGradient(
      w * 0.5 - gx,
      h * 0.5 - gy,
      w * 0.5 + gx,
      h * 0.5 + gy
    );

    const shift = (gameTime * 0.45) % 1;
    for (let i = 0; i <= 7; i++) {
      const stop = i / 7;
      const colorIdx = Math.floor(((stop + shift) * 7) % 7);
      grad.addColorStop(stop, SEVEN_RAINBOW_COLORS[colorIdx]);
    }

    ctx.shadowBlur = 14;
    ctx.shadowColor = SEVEN_RAINBOW_COLORS[Math.floor((gameTime * 4) % 7)];
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.shadowBlur = 0;
    drawPixelBorderCells(ctx, avatar.shape, w, h, '#ffffff');
  } else {
    // Standard Tier: Crisp White Pixel Body with Biome Pixel Rim
    ctx.shadowBlur = 8;
    ctx.shadowColor = primaryColor;
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.shadowBlur = 0;
    drawPixelBorderCells(ctx, avatar.shape, w, h, horizonColor);
  }

  ctx.shadowBlur = 0;

  const clampedLookX = Math.max(-1, Math.min(1, eyeLookX));
  const clampedLookY = Math.max(-1, Math.min(1, eyeLookY));

  // 2A. Special Case: Secret Level 15 Prism Eyeball — Single Moving Cornea / Iris in Center!
  if (avatar.shape === 'eyeball' || avatar.hasSingleCentralIris) {
    const shiftX = Math.round(clampedLookX * (w * 0.2));
    const shiftY = Math.round(clampedLookY * (h * 0.2));
    const cx = Math.round(w * 0.5 + shiftX);
    const cy = Math.round(h * 0.5 + shiftY);

    // Outer Cornea Ring (Dark obsidian border + glowing cyan/white iris ring)
    const irisR = Math.max(4, Math.round(w * 0.22));
    const pupilR = Math.max(2, Math.round(w * 0.11));

    ctx.fillStyle = '#04050a';
    ctx.fillRect(cx - irisR - 1, cy - irisR + 1, (irisR + 1) * 2, (irisR - 1) * 2);
    ctx.fillRect(cx - irisR + 1, cy - irisR - 1, (irisR - 1) * 2, (irisR + 1) * 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - irisR + 1, cy - irisR + 1, (irisR - 1) * 2, (irisR - 1) * 2);

    // Inner Dark Moving Pupil
    ctx.fillStyle = '#04050a';
    ctx.fillRect(cx - pupilR, cy - pupilR, pupilR * 2, pupilR * 2);

    ctx.restore();
    return;
  }

  // 2B. Classic Solid Rectangular Pixel Eyes (Strictly two clean rectangles without inner dots)
  const eyeShiftX = Math.round(clampedLookX * (w * 0.14));
  const eyeShiftY = Math.round(clampedLookY * (h * 0.12));

  const baseEyeY =
    avatar.shape === 'triangle'
      ? h * 0.58
      : avatar.shape === 'pentagon' || avatar.shape === 'cat'
      ? h * 0.5
      : avatar.shape === 'cherry'
      ? h * 0.62
      : avatar.shape === 'rockhand'
      ? h * 0.56
      : h * 0.45;
  const leftEyeCenterX =
    avatar.shape === 'crescent' ? w * 0.25 : avatar.shape === 'triangle' ? w * 0.38 : w * 0.34;
  const rightEyeCenterX =
    avatar.shape === 'crescent' ? w * 0.46 : avatar.shape === 'triangle' ? w * 0.62 : w * 0.66;

  const eyeW = Math.max(3, Math.round(w * 0.14));
  const eyeH = Math.max(5, Math.round(h * 0.24));

  ctx.fillStyle = '#04050a';

  const lx = Math.round(leftEyeCenterX + eyeShiftX - eyeW * 0.5);
  const ly = Math.round(baseEyeY + eyeShiftY - eyeH * 0.5);
  ctx.fillRect(lx, ly, eyeW, eyeH);

  const rx = Math.round(rightEyeCenterX + eyeShiftX - eyeW * 0.5);
  const ry = Math.round(baseEyeY + eyeShiftY - eyeH * 0.5);
  ctx.fillRect(rx, ry, eyeW, eyeH);

  ctx.restore();
}

