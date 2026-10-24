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
  | 'pentagon';

export type AvatarTier = 'standard' | 'gold' | 'rainbow';

export interface CharacterPerkModifiers {
  bonusMagnetRadiusPx: number;
  doubleOrbChance: number;
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
  shape: BaseAvatarShape;
  tier: AvatarTier;
  costOrbs: number;
  perkTitle: string;
  perkDesc: string;
  perks: CharacterPerkModifiers;
}

const DEFAULT_PERKS: CharacterPerkModifiers = {
  bonusMagnetRadiusPx: 0,
  doubleOrbChance: 0,
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

export const CHARACTER_AVATARS: CharacterAvatarDef[] = [
  // ============================================================================
  // TIER 1: STANDARD PIXEL AVATARS (Circle, Triangle, Square = FREE; then 80, 160, 300, 520, 800)
  // ============================================================================
  {
    id: 'circle',
    name: 'Pulse Orb',
    shape: 'circle',
    tier: 'standard',
    costOrbs: 0,
    perkTitle: 'Balanced Core',
    perkDesc: 'Classic pixel sphere with dual rectangular eyes.',
    perks: { ...DEFAULT_PERKS },
  },
  {
    id: 'triangle',
    name: 'Delta Prism',
    shape: 'triangle',
    tier: 'standard',
    costOrbs: 0,
    perkTitle: 'Agile Apex',
    perkDesc: 'Stepped pixel delta with reactive rectangular eyes.',
    perks: { ...DEFAULT_PERKS },
  },
  {
    id: 'square',
    name: 'Neon Cube',
    shape: 'square',
    tier: 'standard',
    costOrbs: 0,
    perkTitle: 'Solid Chassis',
    perkDesc: 'Precision pixel cube with high-contrast gaze.',
    perks: { ...DEFAULT_PERKS },
  },
  {
    id: 'star',
    name: 'Nova Star',
    shape: 'star',
    tier: 'standard',
    costOrbs: 80,
    perkTitle: '+5% SCORE',
    perkDesc: 'Pixel celestial star with reactive core eyes.',
    perks: { ...DEFAULT_PERKS, scoreMultiplier: 1.05 },
  },
  {
    id: 'crescent',
    name: 'Lunar Crescent',
    shape: 'crescent',
    tier: 'standard',
    costOrbs: 160,
    perkTitle: '+6PX PAD WIDTH',
    perkDesc: 'Pixel crescent moon whose eyes track motion.',
    perks: { ...DEFAULT_PERKS, platformWidthBonusPx: 6 },
  },
  {
    id: 'diamond',
    name: 'Aether Rhombus',
    shape: 'diamond',
    tier: 'standard',
    costOrbs: 300,
    perkTitle: '+15PX MAGNET',
    perkDesc: 'Stepped pixel diamond with twin rectangular optics.',
    perks: { ...DEFAULT_PERKS, bonusMagnetRadiusPx: 15 },
  },
  {
    id: 'hexagon',
    name: 'Hexa Core',
    shape: 'hexagon',
    tier: 'standard',
    costOrbs: 520,
    perkTitle: '+8% FLOW GAIN',
    perkDesc: 'Six-sided pixel resonator with twin optics.',
    perks: { ...DEFAULT_PERKS, flowGainMultiplier: 1.08 },
  },
  {
    id: 'pentagon',
    name: 'Omni Shield',
    shape: 'pentagon',
    tier: 'standard',
    costOrbs: 800,
    perkTitle: '-15% HAZARD LOSS',
    perkDesc: 'Armored pixel crest with vigilant eyes.',
    perks: { ...DEFAULT_PERKS, hazardPenaltyMultiplier: 0.85 },
  },

  // ============================================================================
  // TIER 2: RADIANT GOLD EDITION (1000–1600 Orbs)
  // ============================================================================
  {
    id: 'circle_gold',
    name: 'Auric Orb',
    shape: 'circle',
    tier: 'gold',
    costOrbs: 1000,
    perkTitle: 'MAGNET + 2X ORB',
    perkDesc: '+70px Magnet & 30% Double Orbs.',
    perks: {
      ...DEFAULT_PERKS,
      bonusMagnetRadiusPx: 70,
      doubleOrbChance: 0.3,
      scoreMultiplier: 1.15,
    },
  },
  {
    id: 'triangle_gold',
    name: 'Solar Delta',
    shape: 'triangle',
    tier: 'gold',
    costOrbs: 1000,
    perkTitle: 'FAST DASH +20% PTS',
    perkDesc: '30% faster Dash & +20% Score.',
    perks: {
      ...DEFAULT_PERKS,
      dashCooldownMultiplier: 0.7,
      scoreMultiplier: 1.2,
    },
  },
  {
    id: 'square_gold',
    name: 'Gilded Bastion',
    shape: 'square',
    tier: 'gold',
    costOrbs: 1000,
    perkTitle: 'START SHIELD',
    perkDesc: 'Starts with Shield & -40% hazard loss.',
    perks: {
      ...DEFAULT_PERKS,
      startWithShield: true,
      hazardPenaltyMultiplier: 0.6,
    },
  },
  {
    id: 'star_gold',
    name: 'Supernova Gold',
    shape: 'star',
    tier: 'gold',
    costOrbs: 1200,
    perkTitle: '+30% FLOW GAIN',
    perkDesc: 'Builds Flow +30% faster & +25% Score.',
    perks: {
      ...DEFAULT_PERKS,
      flowGainMultiplier: 1.3,
      scoreMultiplier: 1.25,
    },
  },
  {
    id: 'crescent_gold',
    name: 'Golden Eclipse',
    shape: 'crescent',
    tier: 'gold',
    costOrbs: 1200,
    perkTitle: '+18PX PAD WIDTH',
    perkDesc: '+18px wider pads & -50% stall decay.',
    perks: {
      ...DEFAULT_PERKS,
      platformWidthBonusPx: 18,
      stallDecayMultiplier: 0.5,
    },
  },
  {
    id: 'diamond_gold',
    name: 'Sovereign Jewel',
    shape: 'diamond',
    tier: 'gold',
    costOrbs: 1350,
    perkTitle: '+40% SCORE + BUFF',
    perkDesc: '+40% Score & +35% Power-Up time.',
    perks: {
      ...DEFAULT_PERKS,
      scoreMultiplier: 1.4,
      powerUpDurationMultiplier: 1.35,
    },
  },
  {
    id: 'hexagon_gold',
    name: 'Midas Hexa',
    shape: 'hexagon',
    tier: 'gold',
    costOrbs: 1450,
    perkTitle: 'GATE ORBS + FLOW',
    perkDesc: '+1 Orb per Chord Gate & +25% Flow.',
    perks: {
      ...DEFAULT_PERKS,
      chordGateBonusOrbs: 1,
      flowGainMultiplier: 1.25,
    },
  },
  {
    id: 'pentagon_gold',
    name: 'Valkyrie Gold',
    shape: 'pentagon',
    tier: 'gold',
    costOrbs: 1600,
    perkTitle: 'AIR JUMP + SHIELD',
    perkDesc: 'Permanent Air Jump + Start Shield.',
    perks: {
      ...DEFAULT_PERKS,
      permanentAirJump: true,
      startWithShield: true,
    },
  },

  // ============================================================================
  // TIER 3: PRISMATIC 7-COLOR RAINBOW EDITION (2000–2600 Orbs)
  // ============================================================================
  {
    id: 'circle_rainbow',
    name: 'Prism Orb',
    shape: 'circle',
    tier: 'rainbow',
    costOrbs: 2000,
    perkTitle: 'MEGA MAGNET +40%',
    perkDesc: '+135px Magnet, 65% 2x Orb & +40% Score.',
    perks: {
      ...DEFAULT_PERKS,
      bonusMagnetRadiusPx: 135,
      doubleOrbChance: 0.65,
      scoreMultiplier: 1.4,
    },
  },
  {
    id: 'triangle_rainbow',
    name: 'Prism Delta',
    shape: 'triangle',
    tier: 'rainbow',
    costOrbs: 2000,
    perkTitle: 'AIR JUMP + DASH',
    perkDesc: 'Air Jump + 45% faster Dash + 40% Score.',
    perks: {
      ...DEFAULT_PERKS,
      permanentAirJump: true,
      dashCooldownMultiplier: 0.55,
      scoreMultiplier: 1.4,
    },
  },
  {
    id: 'square_rainbow',
    name: 'Chroma Cube',
    shape: 'square',
    tier: 'rainbow',
    costOrbs: 2000,
    perkTitle: 'AUTO-SHIELD 18S',
    perkDesc: 'Auto-regenerates Shield every 18s.',
    perks: {
      ...DEFAULT_PERKS,
      startWithShield: true,
      autoRegenShieldSec: 18,
      hazardPenaltyMultiplier: 0.4,
    },
  },
  {
    id: 'star_rainbow',
    name: 'Astral Nova',
    shape: 'star',
    tier: 'rainbow',
    costOrbs: 2200,
    perkTitle: '+55% FLOW +50% PTS',
    perkDesc: '+55% Flow gain, +50% Score & Magnet.',
    perks: {
      ...DEFAULT_PERKS,
      flowGainMultiplier: 1.55,
      scoreMultiplier: 1.5,
      bonusMagnetRadiusPx: 60,
    },
  },
  {
    id: 'crescent_rainbow',
    name: 'Prism Moon',
    shape: 'crescent',
    tier: 'rainbow',
    costOrbs: 2200,
    perkTitle: '+28PX PAD + JUMP',
    perkDesc: '+28px wider pads + Permanent Air Jump.',
    perks: {
      ...DEFAULT_PERKS,
      platformWidthBonusPx: 28,
      stallDecayMultiplier: 0.3,
      permanentAirJump: true,
    },
  },
  {
    id: 'diamond_rainbow',
    name: 'Prism Rhombus',
    shape: 'diamond',
    tier: 'rainbow',
    costOrbs: 2400,
    perkTitle: '+75% PTS + 2X ORB',
    perkDesc: '+75% Score, +60% Buff time & 50% 2x Orb.',
    perks: {
      ...DEFAULT_PERKS,
      scoreMultiplier: 1.75,
      powerUpDurationMultiplier: 1.6,
      doubleOrbChance: 0.5,
    },
  },
  {
    id: 'hexagon_rainbow',
    name: 'Archon Hex',
    shape: 'hexagon',
    tier: 'rainbow',
    costOrbs: 2500,
    perkTitle: '2X GATE POWERUP',
    perkDesc: '+2 Gate Orbs, 2x Power-Up & +40% Flow.',
    perks: {
      ...DEFAULT_PERKS,
      chordGateBonusOrbs: 2,
      chordGateDoublePowerUp: true,
      flowGainMultiplier: 1.4,
    },
  },
  {
    id: 'pentagon_rainbow',
    name: 'Omni Crest',
    shape: 'pentagon',
    tier: 'rainbow',
    costOrbs: 2600,
    perkTitle: 'OMNI ASCENSION',
    perkDesc: 'Auto-Shield (16s), Air Jump, Magnet & +65% Pts.',
    perks: {
      ...DEFAULT_PERKS,
      startWithShield: true,
      autoRegenShieldSec: 16,
      permanentAirJump: true,
      bonusMagnetRadiusPx: 100,
      scoreMultiplier: 1.65,
    },
  },
];

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
 * 11x11 Pixel-Art Bitmap Grids for each of the 8 geometric avatar shapes.
 * '1' = filled pixel block, '.' = transparent.
 * Renders crisp stepped pixel-art silhouettes instead of smooth vector curves.
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
};

/**
 * Traces the stepped pixel-art path of any of the 8 avatar shapes inside [0..w, 0..h].
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
 * - Stepped Pixel-Art Silhouette
 * - Standard / Radiant Gold / Animated 7-Color Rainbow shaders
 * - Two solid rectangular eyes (NO inner dots/catchlights) that track (eyeLookX, eyeLookY)
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

  // 2. Classic Solid Rectangular Pixel Eyes (Strictly two clean rectangles without inner dots)
  const clampedLookX = Math.max(-1, Math.min(1, eyeLookX));
  const clampedLookY = Math.max(-1, Math.min(1, eyeLookY));

  const eyeShiftX = Math.round(clampedLookX * (w * 0.14));
  const eyeShiftY = Math.round(clampedLookY * (h * 0.12));

  const baseEyeY =
    avatar.shape === 'triangle'
      ? h * 0.58
      : avatar.shape === 'pentagon'
      ? h * 0.5
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
