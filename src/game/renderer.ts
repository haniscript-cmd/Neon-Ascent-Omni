import {
  GameConfig,
  ScaleBiome,
  PlatformEntity,
  AerialHazardEntity,
  HeartPickupEntity,
  HarmonicOrb,
  ActivePowerUp,
  ParticlePool,
  FLOW_THRESHOLDS,
  MASTER_SCALES,
  getPlatformThemeColor,
  lighten,
  darken,
  blendHex,
  withAlpha,
} from './rules';
import { getCharacterById, drawCharacterAvatar } from './characters';

export interface FloatingTextItem {
  active: boolean;
  text: string;
  subtext?: string;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  scale: number;
}

export interface BiomeDissolveState {
  active: boolean;
  progress: number; // 0.0 -> 1.0 (sweeps from bottom to top)
  fromBiome: ScaleBiome;
  toBiome: ScaleBiome;
}

export interface ChordComboHudState {
  active: boolean;
  completedCount: number; // 1..4
  chordNames: [string, string, string, string];
  completionFlashTimer: number; // > 0 when 4/4 completed
}

export interface GlitterParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  twinklePhase: number;
}

export interface DyingSequenceState {
  active: boolean;
  phase: 'none' | 'falling' | 'exploding' | 'dissolving';
  timer: number;
  dissolveProgress: number; // 0.0 -> 1.0
  glitters: GlitterParticle[];
}

export interface PlayerRenderState {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  grounded: boolean;
  wallSlideDir: number;
  scaleX: number;
  scaleY: number;
  facing: number;
  dashCool: number;
  dashMaxCool: number;
  dashAct: number;
  hasShield: boolean;
  doubleJumpReady: boolean;
  damageGlitchTimer: number;
  impactSquashTimer?: number;
  eyeLookX?: number;
  eyeLookY?: number;
  trail: Array<{ x: number; y: number; vx: number; vy: number }>;
  scarfNodes: Array<{ x: number; y: number }>;
}

const ROMAN_GATES = ['I', 'II', 'III', 'IV'] as const;

function cellNoise(col: number, row: number): number {
  const n = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function drawCircularPixelGauge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  ratio: number,
  fillColor: string,
  topEdgeColor: string,
  borderColor: string,
  isReadyPulse = false,
  isActiveGlow = false,
  seedOffset = 0,
  pxSize = 3
): void {
  const clamped = Math.max(0, Math.min(1, ratio));
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = 'rgba(4, 6, 14, 0.9)';
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = isActiveGlow || isReadyPulse ? 2.4 : 1.8;
  if (isActiveGlow || isReadyPulse) {
    ctx.shadowBlur = isActiveGlow ? 12 : 8;
    ctx.shadowColor = borderColor;
  }
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.arc(cx, cy, radius - 3, 0, Math.PI * 2);
  ctx.clip();

  const gridRadius = radius - 2;
  const totalRows = Math.ceil((gridRadius * 2) / pxSize);
  let rowIdx = 0;

  for (let py = cy - gridRadius; py < cy + gridRadius; py += pxSize) {
    const rowNormFromBottom = 1 - rowIdx / Math.max(1, totalRows);
    let colIdx = 0;
    for (let px = cx - gridRadius; px < cx + gridRadius; px += pxSize) {
      const dither = (cellNoise(colIdx + seedOffset * 7, rowIdx) - 0.5) * 0.14;
      if (clamped > 0.01 && rowNormFromBottom + dither <= clamped) {
        const isTopEdge = clamped < 0.98 && rowNormFromBottom + dither > clamped - 0.14;
        ctx.fillStyle = isTopEdge ? topEdgeColor : fillColor;
        ctx.fillRect(Math.round(px), Math.round(py), pxSize - 1, pxSize - 1);
      }
      colIdx++;
    }
    rowIdx++;
  }

  ctx.restore();
}

export function renderGameFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  camY: number,
  gameTime: number,
  ambientPulse: number,
  flowCombo: number,
  biome: ScaleBiome,
  cfg: GameConfig,
  player: PlayerRenderState,
  platforms: PlatformEntity[],
  orbs: HarmonicOrb[],
  particlePool: ParticlePool,
  floatingTexts: FloatingTextItem[],
  aberrationAmount: number,
  shockwaves: Array<{ x: number; y: number; r: number; maxR: number; color: string; alpha: number }>,
  _allScales: ScaleBiome[],
  activePowerUps: ActivePowerUp[] = [],
  biomeDissolve?: BiomeDissolveState,
  aerialHazards: AerialHazardEntity[] = [],
  chordComboHud?: ChordComboHudState,
  dyingSequence?: DyingSequenceState,
  jetpackGlitters: GlitterParticle[] = [],
  heartPickups: HeartPickupEntity[] = []
): void {
  ctx.imageSmoothingEnabled = false;

  const isDissolving = Boolean(
    cfg.useBiomes && biomeDissolve && biomeDissolve.active && biomeDissolve.progress < 1
  );
  const dissolveT = isDissolving && biomeDissolve ? biomeDissolve.progress : 1;
  const waveCenter = dissolveT * 1.24 - 0.12;

  const primaryColor = cfg.useBiomes
    ? isDissolving && biomeDissolve
      ? blendHex(biomeDissolve.fromBiome.fg, biomeDissolve.toBiome.fg, dissolveT)
      : biome.fg
    : cfg.fixedColor;

  const bgAccent = cfg.useBiomes
    ? isDissolving && biomeDissolve
      ? blendHex(biomeDissolve.fromBiome.bgAccent, biomeDissolve.toBiome.bgAccent, dissolveT)
      : biome.bgAccent
    : darken(cfg.fixedColor, 0.75);

  const horizonCol = cfg.useBiomes
    ? isDissolving && biomeDissolve
      ? blendHex(
          biomeDissolve.fromBiome.horizonColor,
          biomeDissolve.toBiome.horizonColor,
          dissolveT
        )
      : biome.horizonColor
    : lighten(cfg.fixedColor, 0.4);

  // --- 1. DEEP SKY & PARALLAX LAYER 1 ---
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
  skyGrad.addColorStop(0, '#04050a');
  skyGrad.addColorStop(0.58, '#070a12');
  skyGrad.addColorStop(1, bgAccent);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // Distant Synthwave Sun
  const sunY = ((240 - camY * 0.04) % (height + 300) + (height + 300)) % (height + 300) - 100;
  const sunRadius = 68 + ambientPulse * 3;
  const sunGrad = ctx.createLinearGradient(
    width * 0.5,
    sunY - sunRadius,
    width * 0.5,
    sunY + sunRadius
  );
  sunGrad.addColorStop(0, horizonCol);
  sunGrad.addColorStop(1, primaryColor);

  ctx.save();
  ctx.globalAlpha = 0.2 + (flowCombo >= FLOW_THRESHOLDS.OVERDRIVE ? 0.1 : 0);
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(width * 0.5, sunY, sunRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#060810';
  for (let s = 0; s < 6; s++) {
    const cutY = sunY + 10 + s * 10.5;
    const cutH = 2 + s * 1.1;
    ctx.fillRect(width * 0.5 - sunRadius - 2, cutY, sunRadius * 2 + 4, cutH);
  }
  ctx.restore();

  // Parallax Layer 1: Distant Geometric Monoliths
  ctx.save();
  ctx.strokeStyle = withAlpha(primaryColor, 0.12);
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const mx = (i * 115 + 30) % width;
    const my =
      ((i * 210 - camY * 0.15) % (height + 260) + (height + 260)) % (height + 260) - 130;
    const mw = 44 + (i % 3) * 18;
    const mh = 160 + (i % 2) * 70;
    ctx.strokeRect(mx, my, mw, mh);
    ctx.fillStyle = withAlpha(bgAccent, 0.24);
    ctx.fillRect(mx, my, mw, mh);
  }
  ctx.restore();

  // --- 1B. BOTTOM-TO-TOP DUAL-BIOME PIXELATED DISSOLVE WAVE (16x16px) ---
  if (isDissolving && biomeDissolve) {
    const cellSize = 16;
    const cols = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);
    const halfBand = 0.28;

    const fromPalette = [
      biomeDissolve.fromBiome.fg,
      biomeDissolve.fromBiome.horizonColor,
      lighten(biomeDissolve.fromBiome.bgAccent, 0.35),
    ];
    const toPalette = [
      biomeDissolve.toBiome.fg,
      biomeDissolve.toBiome.horizonColor,
      lighten(biomeDissolve.toBiome.bgAccent, 0.35),
    ];

    ctx.save();
    for (let r = 0; r < rows; r++) {
      const bottomToTopNorm = 1 - (r + 0.5) / rows;
      const distFromWave = bottomToTopNorm - waveCenter;
      if (Math.abs(distFromWave) > halfBand) continue;

      const bandEnvelope = 1 - Math.abs(distFromWave) / halfBand;

      for (let c = 0; c < cols; c++) {
        const rnd = cellNoise(c, r);
        const rnd2 = cellNoise(c + 37, r + 19);

        if (rnd > bandEnvelope * 0.84) continue;

        const toProbability = Math.max(0.18, Math.min(0.82, 0.5 - distFromWave * 1.8));
        const useToBiome = rnd2 < toProbability;
        const pal = useToBiome ? toPalette : fromPalette;
        const colorIdx = Math.floor((rnd * 13) % pal.length);
        const tileColor = pal[colorIdx];

        const alpha = Math.min(0.62, (0.2 + bandEnvelope * 0.44) * (0.75 + rnd2 * 0.25));
        ctx.fillStyle = withAlpha(tileColor, alpha);
        ctx.fillRect(c * cellSize + 1, r * cellSize + 1, cellSize - 2, cellSize - 2);
      }
    }
    ctx.restore();
  }

  // --- 2. HARMONIC GRID (World Space — 1/100th Altitude Scale) ---
  ctx.save();
  ctx.translate(0, -camY);

  const gridAlpha = 0.07 + ambientPulse * 0.04;
  ctx.strokeStyle = withAlpha(primaryColor, gridAlpha);
  ctx.lineWidth = 1;
  const startGridY = Math.floor(camY / 100) * 100;
  for (let gy = startGridY; gy < camY + height + 100; gy += 100) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(width, gy);
    ctx.stroke();

    const altMeters = Math.round(Math.abs(Math.min(0, gy - 782)) / 100);
    if (altMeters > 0 && altMeters % 5 === 0 && Math.abs((gy - 782) % 500) < 100) {
      ctx.fillStyle = withAlpha(primaryColor, 0.24);
      ctx.font = "8px 'Press Start 2P', monospace";
      ctx.fillText(`${altMeters}M`, 14, gy - 6);
    }
  }
  for (let gx = 100; gx < width; gx += 100) {
    ctx.beginPath();
    ctx.moveTo(gx, camY);
    ctx.lineTo(gx, camY + height);
    ctx.stroke();
  }

  // Side Wall-Jump Energy Rails
  const wallGlow = player.wallSlideDir !== 0 ? 0.6 : 0.18;
  ctx.fillStyle = withAlpha(primaryColor, wallGlow);
  ctx.fillRect(0, camY, 4, height);
  ctx.fillRect(width - 4, camY, 4, height);

  // --- 3. SHOCKWAVES (Including 3-Note Subdivision Ring Pulses) ---
  for (let i = 0; i < shockwaves.length; i++) {
    const sw = shockwaves[i];
    if (sw.alpha <= 0) continue;
    ctx.save();
    ctx.strokeStyle = withAlpha(sw.color, sw.alpha);
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // --- 4. PLATFORMS, CHORD GATES & PIXELATED WIDTH MORPHING ---
  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (p.y < camY - 220 || p.y > camY + height + 140) continue;

    const platBiome =
      p.customBiomeId !== undefined
        ? MASTER_SCALES.find((s) => s.id === p.customBiomeId) || biome
        : biome;

    let col: string;
    let platHorizon: string;
    let seamOverlap = 0;

    const visualType =
      p.type === 'crumble' && p.disguisedFragile && p.crumbleTimer <= 0 ? 'normal' : p.type;

    if (isDissolving && biomeDissolve) {
      const screenY = p.y - camY;
      const bottomToTopNorm = Math.max(0, Math.min(1, 1 - screenY / height));
      const localBlend = Math.max(
        0,
        Math.min(1, (waveCenter - bottomToTopNorm + 0.14) / 0.28)
      );
      const fromCol = getPlatformThemeColor(
        biomeDissolve.fromBiome,
        visualType,
        cfg.useBiomes,
        cfg.fixedColor
      );
      const toCol = getPlatformThemeColor(
        biomeDissolve.toBiome,
        visualType,
        cfg.useBiomes,
        cfg.fixedColor
      );
      col = blendHex(fromCol, toCol, localBlend);
      platHorizon = blendHex(
        biomeDissolve.fromBiome.horizonColor,
        biomeDissolve.toBiome.horizonColor,
        localBlend
      );
      seamOverlap = Math.max(0, 1 - Math.abs(waveCenter - bottomToTopNorm) / 0.16);
    } else {
      col = getPlatformThemeColor(platBiome, visualType, cfg.useBiomes, cfg.fixedColor);
      platHorizon = cfg.useBiomes ? platBiome.horizonColor : lighten(cfg.fixedColor, 0.45);
    }

    if (p.broken) {
      ctx.save();
      ctx.strokeStyle = withAlpha(col, 0.25);
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(p.x, p.y, p.w, p.h);
      ctx.restore();
      continue;
    }

    if (p.type === 'moving' || Math.abs(p.vx) > 0) {
      ctx.save();
      ctx.strokeStyle = withAlpha(col, 0.22);
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(p.minX, p.y + p.h * 0.5);
      ctx.lineTo(p.maxX + p.w, p.y + p.h * 0.5);
      ctx.stroke();
      ctx.restore();
    }

    const isPhaseGhost = p.type === 'phase' && !p.phaseSolid;
    ctx.save();
    if (isPhaseGhost) {
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(p.x, p.y, p.w, p.h);
      ctx.restore();
      continue;
    }

    let jx = 0;
    let jy = 0;
    if (p.type === 'crumble' && p.crumbleTimer > 0) {
      jx = (Math.random() - 0.5) * 3.5;
      jy = (Math.random() - 0.5) * 2;
    }

    if (p.hit) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = col;
      ctx.fillStyle = p.repeatBounces > 0 ? darken(col, 0.25) : '#ffffff';
    } else {
      ctx.shadowBlur = flowCombo >= FLOW_THRESHOLDS.CHORD || p.type === 'chord_gate' ? 8 : 0;
      ctx.shadowColor = col;
      ctx.fillStyle = col;
    }

    ctx.fillRect(p.x + jx, p.y + jy, p.w, p.h);
    ctx.shadowBlur = 0;

    ctx.fillStyle = p.hit ? withAlpha(col, 0.42) : 'rgba(6, 9, 18, 0.68)';
    ctx.fillRect(p.x + jx + 2, p.y + jy + 2, p.w - 4, p.h - 4);

    if (seamOverlap > 0.05 && biomeDissolve) {
      const tileW = 12;
      const numTiles = Math.floor(p.w / tileW);
      for (let tIdx = 0; tIdx < numTiles; tIdx++) {
        const n = cellNoise(tIdx + p.id, Math.floor(dissolveT * 20));
        if (n < seamOverlap * 0.75) {
          ctx.fillStyle =
            n > 0.35 ? biomeDissolve.toBiome.fg : biomeDissolve.fromBiome.horizonColor;
          ctx.fillRect(p.x + tIdx * tileW + 1, p.y + 1, tileW - 2, p.h - 2);
        }
      }
    }

    // 4-GATE HARMONIC CHORD PROGRESSION PORTAL VISUALS
    if (p.type === 'chord_gate') {
      const gateIdx = p.chordGateIndex ?? 0;
      const roman = ROMAN_GATES[gateIdx % 4];
      const chordName = p.chordNameOverride || platBiome.chordNames?.[gateIdx % 4] || 'CHORD';
      const archH = 26 + Math.sin(gameTime * 5 + gateIdx) * 3;

      ctx.strokeStyle = p.hit ? '#ffffff' : lighten(platHorizon, 0.35);
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x + 4, p.y - archH, 6, archH);
      ctx.strokeRect(p.x + p.w - 10, p.y - archH, 6, archH);
      ctx.fillStyle = withAlpha(platHorizon, p.hit ? 0.45 : 0.22);
      ctx.fillRect(p.x + 10, p.y - archH + 2, p.w - 20, archH - 4);

      ctx.fillStyle = '#ffffff';
      ctx.font = "7px 'Press Start 2P', monospace";
      ctx.textAlign = 'center';
      ctx.fillText(`${roman}:${chordName}`, p.x + p.w * 0.5, p.y - archH - 4);
      ctx.fillText('▲', p.x + p.w * 0.5, p.y + 11);
    } else if (p.type === 'bounce') {
      ctx.fillStyle = lighten(col, 0.45);
      ctx.fillRect(p.x + 8, p.y - 3, p.w - 16, 3);
      ctx.font = "7px 'Press Start 2P', monospace";
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('▲▲', p.x + p.w * 0.5, p.y + 11);
    } else if (p.type === 'crumble' && (!p.disguisedFragile || p.crumbleTimer > 0)) {
      ctx.strokeStyle = lighten(col, 0.35);
      ctx.beginPath();
      ctx.moveTo(p.x + p.w * 0.35, p.y);
      ctx.lineTo(p.x + p.w * 0.45, p.y + p.h);
      ctx.moveTo(p.x + p.w * 0.7, p.y);
      ctx.lineTo(p.x + p.w * 0.6, p.y + p.h);
      ctx.stroke();
      if (Math.abs(p.vx) > 0) {
        ctx.fillStyle = lighten(col, 0.55);
        ctx.font = "7px 'Press Start 2P', monospace";
        ctx.textAlign = 'right';
        ctx.fillText(p.vx > 0 ? '»' : '«', p.x + p.w - 4, p.y + 11);
      }
    } else if (p.type === 'moving' || Math.abs(p.vx) > 0) {
      ctx.fillStyle = lighten(col, 0.5);
      ctx.font = "7px 'Press Start 2P', monospace";
      ctx.textAlign = 'center';
      ctx.fillText(p.vx > 0 ? '»' : '«', p.x + p.w * 0.5, p.y + 11);
    }

    if (p.noteLabel && p.type !== 'bounce' && p.type !== 'chord_gate') {
      ctx.fillStyle = p.hit ? '#04050a' : withAlpha('#ffffff', 0.78);
      ctx.font = "7px 'Press Start 2P', monospace";
      ctx.textAlign = 'left';
      const beatBadge =
        p.beatDurationRatio && Math.abs(p.beatDurationRatio - 1.0) > 0.05
          ? `·${p.beatDurationRatio}B`
          : '';
      ctx.fillText(`${p.noteLabel}${beatBadge}`, p.x + 6, p.y + 11);
    }

    if (p.hasHazard && p.hazardWidth && p.hazardXOffset !== undefined) {
      const hx = p.x + p.hazardXOffset;
      const hw = p.hazardWidth;
      ctx.fillStyle = '#fb7185';
      const spikeCount = p.spikeCount ? Math.max(2, Math.min(7, p.spikeCount)) : Math.max(2, Math.floor(hw / 9));
      const sw = hw / spikeCount;
      for (let s = 0; s < spikeCount; s++) {
        ctx.beginPath();
        ctx.moveTo(hx + s * sw, p.y);
        ctx.lineTo(hx + s * sw + sw * 0.5, p.y - 9);
        ctx.lineTo(hx + (s + 1) * sw, p.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // --- 4B. MID-AIR OBSTACLES / DISSONANCE DRONES ---
  for (let i = 0; i < aerialHazards.length; i++) {
    const ah = aerialHazards[i];
    if (!ah.active || ah.y < camY - 80 || ah.y > camY + height + 80) continue;

    ctx.save();
    ctx.translate(ah.x, ah.y);
    ctx.rotate(gameTime * 2.2 + ah.phase);

    const r = ah.radius;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#f43f5e';
    ctx.strokeStyle = '#fb7185';
    ctx.fillStyle = 'rgba(76, 5, 25, 0.85)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fda4af';
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }

  // --- 5. COLLECTIBLE HARMONIC ORBS (Circular Core + Pulsing Ring) ---
  for (let i = 0; i < orbs.length; i++) {
    const orb = orbs[i];
    if (orb.collected || orb.y < camY - 80 || orb.y > camY + height + 80) continue;
    const bobY = orb.y + Math.sin(gameTime * 4 + orb.phase) * 5;
    const ox = orb.x;
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = primaryColor;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ox, bobY, orb.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = horizonCol;
    ctx.lineWidth = 2;
    const outerR = orb.radius + 3.5 + ambientPulse * 2.0;
    ctx.beginPath();
    ctx.arc(ox, bobY, outerR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // --- 5B. RARE MID-AIR HEART HEALTH PICKUPS (♥) ---
  for (let i = 0; i < heartPickups.length; i++) {
    const hpItem = heartPickups[i];
    if (hpItem.collected || hpItem.y < camY - 80 || hpItem.y > camY + height + 80) continue;
    const bobY = hpItem.y + Math.sin(gameTime * 3.8 + hpItem.phase) * 5;
    const hx = Math.round(hpItem.x);
    const hy = Math.round(bobY);
    const pulse = 1 + 0.14 * Math.sin(gameTime * 7 + hpItem.phase);

    ctx.save();
    ctx.translate(hx, hy);
    ctx.scale(pulse, pulse);
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#f43f5e';

    // Crisp Pixel Heart Shape
    ctx.fillStyle = '#fb7185';
    ctx.fillRect(-7, -6, 6, 6);
    ctx.fillRect(1, -6, 6, 6);
    ctx.fillRect(-9, -4, 18, 6);
    ctx.fillRect(-7, 2, 14, 3);
    ctx.fillRect(-4, 5, 8, 3);
    ctx.fillRect(-2, 8, 4, 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-6, -4, 2, 2);
    ctx.restore();
  }

  const isShattered =
    dyingSequence?.active &&
    (dyingSequence.phase === 'exploding' || dyingSequence.phase === 'dissolving');

  // --- 6. TAPERED TRIANGULAR TRAIL BEHIND CHARACTER ---
  if (!isShattered && player.trail.length >= 2) {
    ctx.save();
    const len = player.trail.length;
    const leftPts: Array<{ x: number; y: number }> = [];
    const rightPts: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < len; i++) {
      const pt = player.trail[i];
      const t = i / Math.max(1, len - 1);
      const halfWidth = Math.pow(t, 1.15) * (player.w * 0.46);

      const nextPt =
        i < len - 1
          ? player.trail[i + 1]
          : { x: player.x + player.w * 0.5, y: player.y + player.h * 0.5 };
      const dx = nextPt.x - pt.x;
      const dy = nextPt.y - pt.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = -dy / dist;
      const ny = dx / dist;

      leftPts.push({ x: pt.x + nx * halfWidth, y: pt.y + ny * halfWidth });
      rightPts.push({ x: pt.x - nx * halfWidth, y: pt.y - ny * halfWidth });
    }

    const tip = player.trail[0];
    const head = player.trail[len - 1];
    const trailGrad = ctx.createLinearGradient(tip.x, tip.y, head.x, head.y);
    trailGrad.addColorStop(0, withAlpha(horizonCol, 0.0));
    trailGrad.addColorStop(0.45, withAlpha(primaryColor, 0.24));
    trailGrad.addColorStop(1, withAlpha(horizonCol, player.dashAct > 0 ? 0.72 : 0.48));

    ctx.fillStyle = trailGrad;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    for (let i = 1; i < leftPts.length; i++) {
      ctx.lineTo(leftPts[i].x, leftPts[i].y);
    }
    for (let i = rightPts.length - 1; i >= 1; i--) {
      ctx.lineTo(rightPts[i].x, rightPts[i].y);
    }
    ctx.closePath();
    ctx.fill();

    for (let i = 1; i < len; i += 2) {
      const pt = player.trail[i];
      const prev = player.trail[i - 1];
      const t = i / Math.max(1, len - 1);
      const triHalfW = t * (player.w * 0.34);
      const dx = pt.x - prev.x;
      const dy = pt.y - prev.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = -dy / dist;
      const ny = dx / dist;

      ctx.fillStyle = withAlpha('#ffffff', t * 0.32);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(pt.x + nx * triHalfW, pt.y + ny * triHalfW);
      ctx.lineTo(pt.x - nx * triHalfW, pt.y - ny * triHalfW);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  // --- 6A2. JETPACK FADING GLITTER TRAIL (Blue / Gold / 7-Color Rainbow) ---
  if (!isShattered && jetpackGlitters && jetpackGlitters.length > 0) {
    ctx.save();
    for (let i = 0; i < jetpackGlitters.length; i++) {
      const g = jetpackGlitters[i];
      if (g.life <= 0) continue;
      const lifeRatio = Math.max(0, g.life / Math.max(0.05, g.maxLife));
      const twinkle = 0.52 + 0.48 * Math.sin(gameTime * 42 + g.twinklePhase);
      ctx.globalAlpha = Math.min(1, lifeRatio * 1.15 * twinkle);
      ctx.fillStyle = g.color;

      const gx = Math.round(g.x);
      const gy = Math.round(g.y);
      const sz = Math.max(2, Math.round(g.size * (0.55 + 0.45 * lifeRatio)));

      ctx.fillRect(gx - sz * 0.5, gy - sz * 0.5, sz, sz);
      if (twinkle > 0.72) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(gx - sz - 1, gy - 1, sz * 2 + 2, 2);
        ctx.fillRect(gx - 1, gy - sz - 1, 2, sz * 2 + 2);
      }
    }
    ctx.restore();
  }

  // --- 6B. PIXEL-ART AVATAR WITH SOLID RECTANGULAR EYES + DAMAGE GLITCH ---
  if (!isShattered) {
    const isGlitching = player.damageGlitchTimer > 0;
    const activeAvatar = getCharacterById(cfg.playerShape);

    const impactTimer = player.impactSquashTimer || 0;
    let visualScaleX = player.scaleX;
    let visualScaleY = player.scaleY;

    if (impactTimer > 0) {
      const squashT = Math.min(1, impactTimer / 0.095);
      visualScaleX = 1 + 0.52 * squashT;
      visualScaleY = 1 - 0.44 * squashT;
    } else if (player.vy < -40) {
      const stretchFactor = Math.min(0.42, Math.abs(player.vy) / 1450);
      visualScaleX = Math.min(player.scaleX, 1 - stretchFactor * 0.62);
      visualScaleY = Math.max(player.scaleY, 1 + stretchFactor);
    }

    const eyeLookX =
      player.eyeLookX !== undefined
        ? player.eyeLookX
        : Math.max(-1, Math.min(1, player.vx / 220));
    const eyeLookY =
      player.eyeLookY !== undefined
        ? player.eyeLookY
        : Math.max(-1, Math.min(1, player.vy / 480));

    const drawPlayerSprite = (offsetX: number, tintOverride?: string) => {
      ctx.save();
      const cx = player.x + player.w * 0.5 + offsetX;
      const bottomY = player.y + player.h;
      ctx.translate(cx, bottomY);
      ctx.scale(visualScaleX, visualScaleY);
      ctx.translate(-player.w * 0.5, -player.h);

      drawCharacterAvatar(
        ctx,
        activeAvatar,
        player.w,
        player.h,
        gameTime,
        primaryColor,
        horizonCol,
        eyeLookX,
        eyeLookY,
        tintOverride
      );

      if (player.hasShield && !tintOverride) {
        const shieldCol = activeAvatar.tier === 'gold' ? '#fde047' : horizonCol;
        const shieldRadius = Math.max(player.w, player.h) * 0.72 + Math.sin(gameTime * 6) * 1.5;
        ctx.save();
        ctx.strokeStyle = shieldCol;
        ctx.fillStyle = withAlpha(shieldCol, 0.14);
        ctx.lineWidth = 2.2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = shieldCol;
        ctx.beginPath();
        ctx.arc(player.w * 0.5, player.h * 0.5, shieldRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    };

    if (isGlitching) {
      const glitchAlpha = Math.min(0.38, player.damageGlitchTimer * 0.65);
      const jitter = Math.sin(gameTime * 60) * 3.5;
      drawPlayerSprite(jitter - 2.5, `rgba(253, 164, 175, ${glitchAlpha})`);
      drawPlayerSprite(-jitter + 2.5, `rgba(165, 243, 252, ${glitchAlpha})`);
    } else if (cfg.chromaticAberration && aberrationAmount > 0.25) {
      const off = Math.max(1.5, aberrationAmount * 3.5);
      drawPlayerSprite(-off, withAlpha(primaryColor, 0.4));
      drawPlayerSprite(off, withAlpha(horizonCol, 0.4));
    }
    drawPlayerSprite(0, undefined);

    if (player.dashCool > 0) {
      const barW = 24;
      const barH = 3;
      const bx = player.x + player.w * 0.5 - barW * 0.5;
      const by = player.y + player.h + 6;
      const pct = 1 - player.dashCool / Math.max(1, player.dashMaxCool);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = primaryColor;
      ctx.fillRect(bx, by, barW * pct, barH);
    }
  }

  // --- 7. CENTER-SCREEN SHATTER GLITTER PARTICLES (World Space) ---
  if (dyingSequence && dyingSequence.glitters.length > 0) {
    ctx.save();
    for (let i = 0; i < dyingSequence.glitters.length; i++) {
      const g = dyingSequence.glitters[i];
      if (g.life <= 0) continue;
      const lifeRatio = Math.max(0, g.life / g.maxLife);
      const twinkle = 0.55 + 0.45 * Math.sin(gameTime * 36 + g.twinklePhase);
      ctx.globalAlpha = Math.min(1, lifeRatio * 1.25 * twinkle);
      ctx.fillStyle = g.color;

      const gx = Math.round(g.x);
      const gy = Math.round(g.y);
      const sz = Math.max(2, Math.round(g.size));

      // Crisp Pixel Glitter Block + Cross Sparkle
      ctx.fillRect(gx - sz * 0.5, gy - sz * 0.5, sz, sz);
      if (twinkle > 0.78) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(gx - sz, gy - 1, sz * 2, 2);
        ctx.fillRect(gx - 1, gy - sz, 2, sz * 2);
      }
    }
    ctx.restore();
  }

  // --- 8. ZERO-GC POOLED PARTICLES ---
  for (let i = 0; i < particlePool.items.length; i++) {
    const p = particlePool.items[i];
    if (!p.active) continue;
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    if (p.kind === 'ring') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillRect(
        Math.round(p.x - p.size * 0.5),
        Math.round(p.y - p.size * 0.5),
        Math.round(p.size),
        Math.round(p.size)
      );
    }
  }
  ctx.globalAlpha = 1;

  // --- 9. POOLED FLOATING POPUP TEXTS (Pixel Font) ---
  for (let i = 0; i < floatingTexts.length; i++) {
    const ft = floatingTexts[i];
    if (!ft.active) continue;
    const alpha = Math.max(0, Math.min(1, ft.life / ft.maxLife));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${Math.max(8, Math.round(9 * ft.scale))}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000000';
    ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
    if (ft.subtext) {
      ctx.font = "7px 'Press Start 2P', monospace";
      ctx.fillStyle = '#ffffff';
      ctx.fillText(ft.subtext, ft.x, ft.y + 13);
    }
    ctx.restore();
  }

  ctx.restore();

  // --- 9B. UPWARD RUSH SPEED LINES DURING 1-SECOND FALL SEQUENCE ---
  if (dyingSequence?.active && dyingSequence.phase === 'falling') {
    ctx.save();
    ctx.fillStyle = withAlpha(horizonCol, 0.35);
    for (let s = 0; s < 14; s++) {
      const lx = ((s * 43 + 17) % (width - 20)) + 10;
      const ly = ((gameTime * 950 + s * 85) % (height + 80)) - 40;
      ctx.fillRect(lx, height - ly, 2, 34);
    }
    ctx.restore();
  }

  // --- 10. RIGHT-SIDE INTERACTIVE POWER-UP SLOTS ARE RENDERED IN #ui-hud VIA drawCircularPixelGauge ---
  void activePowerUps;

  // --- 11. LEFT-SIDE 4-SQUARE VERTICAL CHORD GATE COMBO COLUMN ---
  if (
    chordComboHud &&
    (chordComboHud.active || chordComboHud.completionFlashTimer > 0) &&
    chordComboHud.completedCount >= 1
  ) {
    const colX = 16;
    const startY = 148;
    const boxSize = 24;
    const gap = 10;
    const completed = Math.min(4, chordComboHud.completedCount);
    const isCompletedAll = completed >= 4 || chordComboHud.completionFlashTimer > 0;

    const fillAlphaTiers = [0.26, 0.5, 0.75, 1.0];
    const borderAlphaTiers = [0.48, 0.68, 0.86, 1.0];

    ctx.save();
    const fadeOutMult =
      !chordComboHud.active && chordComboHud.completionFlashTimer > 0
        ? Math.min(1, chordComboHud.completionFlashTimer / 0.6)
        : 1.0;
    ctx.globalAlpha = fadeOutMult;

    for (let idx = 0; idx < 4; idx++) {
      const by = startY + idx * (boxSize + gap);
      const isLit = idx < completed;
      const roman = ROMAN_GATES[idx];
      const chordLabel = chordComboHud.chordNames?.[idx] || '';

      ctx.save();
      if (isLit) {
        const tierFillAlpha = fillAlphaTiers[idx];
        const tierBorderAlpha = borderAlphaTiers[idx];
        const pulseGlow = isCompletedAll
          ? 14 + Math.sin(gameTime * 12) * 4
          : idx === 3
          ? 14
          : idx * 3;

        ctx.shadowBlur = pulseGlow;
        ctx.shadowColor = idx === 3 || isCompletedAll ? '#ffffff' : horizonCol;

        ctx.fillStyle = withAlpha(
          idx === 3 || isCompletedAll ? lighten(horizonCol, 0.35) : primaryColor,
          tierFillAlpha
        );
        ctx.fillRect(colX, by, boxSize, boxSize);

        ctx.strokeStyle =
          idx === 3 || isCompletedAll
            ? '#ffffff'
            : withAlpha(lighten(horizonCol, 0.25), tierBorderAlpha);
        ctx.lineWidth = idx === 3 || isCompletedAll ? 2.2 : 1.6;
        ctx.strokeRect(colX, by, boxSize, boxSize);

        ctx.shadowBlur = 0;
        ctx.fillStyle = withAlpha('#ffffff', 0.18 + idx * 0.22);
        ctx.fillRect(colX + 4, by + 4, boxSize - 8, boxSize - 8);

        ctx.fillStyle = idx >= 2 || isCompletedAll ? '#04050a' : '#ffffff';
        ctx.font = "8px 'Press Start 2P', monospace";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(roman, colX + boxSize * 0.5, by + boxSize * 0.5 + 1);

        ctx.fillStyle = withAlpha('#ffffff', 0.45 + idx * 0.18);
        ctx.font = "7px 'Press Start 2P', monospace";
        ctx.textAlign = 'left';
        ctx.fillText(chordLabel, colX + boxSize + 6, by + boxSize * 0.5 + 1);
      } else {
        ctx.fillStyle = 'rgba(4, 6, 14, 0.65)';
        ctx.fillRect(colX, by, boxSize, boxSize);
        ctx.strokeStyle = withAlpha(primaryColor, 0.2);
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(colX, by, boxSize, boxSize);
        ctx.setLineDash([]);

        ctx.fillStyle = withAlpha('#ffffff', 0.22);
        ctx.font = "7px 'Press Start 2P', monospace";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(roman, colX + boxSize * 0.5, by + boxSize * 0.5 + 1);
      }
      ctx.restore();
    }

    ctx.restore();
  }

  // --- 12. FAST PIXELATED DISSOLVE OVERLAY INTO GAME OVER DIALOG ---
  if (dyingSequence && dyingSequence.dissolveProgress > 0.01) {
    const prog = Math.max(0, Math.min(1, dyingSequence.dissolveProgress));
    const cellSize = 16;
    const cols = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);

    ctx.save();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const threshold = cellNoise(c + 11, r + 23);
        if (prog >= threshold * 0.88) {
          const edgeGlow = prog < threshold * 0.88 + 0.14;
          ctx.fillStyle = edgeGlow
            ? withAlpha(c % 2 === 0 ? primaryColor : '#fb7185', 0.85)
            : 'rgba(4, 5, 10, 0.94)';
          ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        }
      }
    }
    ctx.restore();
  }
}
