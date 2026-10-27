import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  DEFAULT_CFG,
  DEFAULT_FINE_TUNE,
  FineTuneConfig,
  GameConfig,
  FLOW_THRESHOLDS,
  FLOW_PLATFORMS_PER_STEP,
  MASTER_SCALES,
  SOUND_BANKS,
  SoundBankDef,
  NOTES_MAP,
  SEQUENCER_PRESETS,
  RUN_UPGRADES,
  ActivePowerUp,
  PowerUpItemId,
  PowerUpCategory,
  PowerUpStoreDef,
  PowerUpStoreItemDef,
  EquippedPowerUpSlotRuntime,
  POWERUP_STORE_ITEMS,
  getPowerUpDef,
  getPowerUpItemById,
  sortEquippedPowerUpsActiveFirst,
  canSpawnHeartPickup,
  getPowerUpUpgradeCost,
  getPowerUpLevelStats,
  computePassiveDashUpgrades,
  computeUnlockedPowerUpSlots,
  getNextPowerUpSlotMilestone,
  ScaleBiome,
  PlatformEntity,
  PlatformArchetype,
  AerialHazardEntity,
  HeartPickupEntity,
  HarmonicOrb,
  ParticlePool,
  computeFlowDynamicDifficulty,
  computeBpmLockedKinematics,
  computeNoteDurationKinematics,
  computeScatteredPlatformPlacement,
  getPlatformThemeColor,
  getFlowMilestoneInfo,
  tickActivePowerUps,
  calculateStyleRank,
  stepSquashStretch,
  shuffleArray,
  pickBiomeChordProgression,
  buildExtendedScale,
  computePostDefeatShopRecommendation,
  LEVEL_PROGRESSION_TABLE,
  LevelUpRewardDef,
  computePlayerLevelInfo,
  getCumulativeUnlocksForLevel,
  getLevelUpRewardsBetween,
  getRequiredLevelForScale,
  getRequiredLevelForSoundBank,
  getAllBiomes,
  lighten,
  withAlpha,
} from './game/rules';
import {
  ALL_CURATED_MELODIES,
  CuratedBiomeMelody,
  pickRandomCuratedMelodyForBiome,
  evaluateCuratedMelodyStep,
} from './game/melodies';
import { OmniAudioEngine } from './game/audioEngine';
import {
  renderGameFrame,
  drawCircularPixelGauge,
  FloatingTextItem,
  PlayerRenderState,
  BiomeDissolveState,
  ChordComboHudState,
  DyingSequenceState,
  GlitterParticle,
} from './game/renderer';
import {
  CHARACTER_AVATARS,
  CharacterAvatarDef,
  getCharacterById,
  STARTER_UNLOCKED_AVATARS,
  SECRET_AVATAR_IDS,
} from './game/characters';
import {
  CustomStage,
  DEFAULT_BUILT_IN_STAGES,
  ALL_CURATED_MELODY_STAGES,
  getUnifiedStageLibrary,
  compileStageForGameplay,
  parseMidiBufferToStage,
} from './game/stages';
import CharacterSelectModal, {
  SelectedAvatarMiniBadge,
  RadiantOrbIcon,
} from './components/CharacterSelectModal';
import StageCreatorModal from './components/StageCreatorModal';
import {
  parseTelegramGameSession,
  initTelegramWebViewOptimizations,
  submitTelegramRankedScore,
  fetchTelegramLeaderboard,
  shareScoreToTelegramChat,
  savePlayerProfile,
  RankedLeaderboardEntry,
} from './game/telegram';

type ScreenState =
  | 'title'
  | 'playing'
  | 'paused'
  | 'gameover'
  | 'sequencer'
  | 'settings'
  | 'store'
  | 'characters'
  | 'stage_creator';

type GameMode = 'STANDARD' | 'SEQUENCER' | 'MIDI' | 'STAGE';

type FineTuneCategory =
  | 'ALL'
  | 'MOBILE'
  | 'FLOW'
  | 'PLATFORMS'
  | 'FRAGILE'
  | 'ENEMIES'
  | 'PHYSICS';

interface PersistentStats {
  highScore: number;
  maxCombo: number;
  totalOrbs: number;
  runsPlayed: number;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const NOTE_KEYS = Object.keys(NOTES_MAP);
const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV'] as const;

const FINE_TUNE_CATEGORIES: Array<{ id: FineTuneCategory; label: string }> = [
  { id: 'ALL', label: 'ALL (32)' },
  { id: 'MOBILE', label: '📱 MOBILE (4)' },
  { id: 'FLOW', label: '⚡ FLOW (6)' },
  { id: 'PLATFORMS', label: '🧱 PLATFORMS (6)' },
  { id: 'FRAGILE', label: '💥 FRAGILE (4)' },
  { id: 'ENEMIES', label: '👾 ENEMIES (6)' },
  { id: 'PHYSICS', label: '🚀 PHYSICS & DASH (6)' },
];

const FINE_TUNE_SLIDERS: Array<{
  key: keyof FineTuneConfig;
  category: Exclude<FineTuneCategory, 'ALL'>;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  desc: string;
}> = [
  // --- FLOW & BIOME PROGRESSION CATEGORY ---
  {
    key: 'flowGainRate',
    category: 'FLOW',
    label: 'Flow Gain Rate',
    min: 0.2,
    max: 3.0,
    step: 0.1,
    unit: 'x',
    desc: 'Speed at which climbing platforms increases Flow',
  },
  {
    key: 'flowDecayRate',
    category: 'FLOW',
    label: 'Idle / Stall Flow Decay',
    min: 0.0,
    max: 3.0,
    step: 0.1,
    unit: 'x',
    desc: 'Penalty speed when stalling or waiting on one platform',
  },
  {
    key: 'difficultyRampSpeed',
    category: 'FLOW',
    label: 'Altitude Width Narrowing Speed',
    min: 0.1,
    max: 10.0,
    step: 0.1,
    unit: 'x',
    desc: 'Wide-range multiplier for how fast platform width narrows as Altitude (M) climbs',
  },
  {
    key: 'biomePlatformDuration',
    category: 'FLOW',
    label: 'Biome Duration (Platforms)',
    min: 15,
    max: 150,
    step: 5,
    unit: ' plats',
    desc: 'Number of platforms climbed before shifting to the next Biome',
  },
  {
    key: 'biomeShiftSpeed',
    category: 'FLOW',
    label: 'Biome Transition Shift Speed',
    min: 0.3,
    max: 3.0,
    step: 0.1,
    unit: 'x',
    desc: 'Speed of the pixelated bottom-to-top dissolve when shifting Biomes',
  },
  {
    key: 'chordGateCooldownSteps',
    category: 'FLOW',
    label: 'Chord Gate Cooldown Steps',
    min: 4,
    max: 40,
    step: 1,
    unit: ' steps',
    desc: 'Platforms between 4-Gate Chord Progression sequences',
  },

  // --- PLATFORMS CATEGORY ---
  {
    key: 'maxPlatformWidth',
    category: 'PLATFORMS',
    label: 'Low-Flow Max Platform Width',
    min: 110,
    max: 240,
    step: 4,
    unit: 'px',
    desc: 'Starting platform width at Flow x0',
  },
  {
    key: 'minPlatformWidth',
    category: 'PLATFORMS',
    label: 'High-Flow Min Platform Width',
    min: 48,
    max: 150,
    step: 4,
    unit: 'px',
    desc: 'Narrowest platform width at peak Flow',
  },
  {
    key: 'horizontalScatterMult',
    category: 'PLATFORMS',
    label: 'Horizontal Scatter Spread',
    min: 0.3,
    max: 2.2,
    step: 0.1,
    unit: 'x',
    desc: 'Horizontal zig-zag distance between consecutive platforms',
  },
  {
    key: 'wideLeapSpawnRate',
    category: 'PLATFORMS',
    label: 'Wide Opposite-Direction Leap Rate',
    min: 0.0,
    max: 3.0,
    step: 0.1,
    unit: 'x',
    desc: 'Frequency of maximum-distance opposite-side platform leaps as Flow rises',
  },
  {
    key: 'orbSpawnRate',
    category: 'PLATFORMS',
    label: 'Harmonic Orb Spawn Chance',
    min: 0.0,
    max: 1.0,
    step: 0.05,
    unit: '',
    desc: 'Probability of spawning a collectible Orb per platform',
  },
  {
    key: 'orbScatterSpread',
    category: 'PLATFORMS',
    label: 'Orb Horizontal Offset Spread',
    min: 0.1,
    max: 1.0,
    step: 0.05,
    unit: '',
    desc: 'How far across the platform Orbs scatter horizontally',
  },

  // --- FRAGILE PLATFORMS & STREAKS CATEGORY ---
  {
    key: 'fragileSpawnRate',
    category: 'FRAGILE',
    label: 'Fragile Platform Spawn Rate',
    min: 0.0,
    max: 3.0,
    step: 0.1,
    unit: 'x',
    desc: 'Probability multiplier for fragile crumbling platforms as Flow rises',
  },
  {
    key: 'fragileStreakChance',
    category: 'FRAGILE',
    label: 'Fragile Multi-Streak Rate',
    min: 0.0,
    max: 3.0,
    step: 0.1,
    unit: 'x',
    desc: 'Chance of spawning consecutive fragile platform streaks back-to-back at high Flow',
  },
  {
    key: 'fragileStreakMaxLen',
    category: 'FRAGILE',
    label: 'Fragile Streak Max Length',
    min: 1,
    max: 6,
    step: 1,
    unit: ' plats',
    desc: 'Maximum consecutive fragile platforms in a single high-Flow streak',
  },
  {
    key: 'disguisedFragileChance',
    category: 'FRAGILE',
    label: 'Disguised Fragile Trap Rate',
    min: 0.0,
    max: 0.75,
    step: 0.02,
    unit: '',
    desc: 'Chance that a fragile platform looks like a normal platform (scales up at high Flow)',
  },

  // --- ENEMIES & HAZARDS CATEGORY ---
  {
    key: 'spikeHazardRate',
    category: 'ENEMIES',
    label: 'Platform Spike Hazard Rate',
    min: 0.0,
    max: 3.0,
    step: 0.1,
    unit: 'x',
    desc: 'Multiplier for on-platform red spike frequency',
  },
  {
    key: 'aerialDroneRate',
    category: 'ENEMIES',
    label: 'Aerial Drone Hazard Rate',
    min: 0.0,
    max: 3.0,
    step: 0.1,
    unit: 'x',
    desc: 'Multiplier for mid-air patrolling Dissonance Drones',
  },
  {
    key: 'enemyMoveSpeedMult',
    category: 'ENEMIES',
    label: 'Enemy & Moving Platform Speed',
    min: 0.4,
    max: 3.5,
    step: 0.1,
    unit: 'x',
    desc: 'Horizontal speed multiplier for patrolling drones and moving platforms',
  },
  {
    key: 'enemyMoveRangeMult',
    category: 'ENEMIES',
    label: 'Enemy Patrol Movement Range',
    min: 0.4,
    max: 2.8,
    step: 0.1,
    unit: 'x',
    desc: 'Horizontal patrol displacement distance for drones and moving platforms',
  },
  {
    key: 'hazardFlowPenalty',
    category: 'ENEMIES',
    label: 'Hazard Flow Penalty',
    min: 0.0,
    max: 3.0,
    step: 0.1,
    unit: 'x',
    desc: 'Flow lost when hitting spikes or aerial drones without shield',
  },
  {
    key: 'heartSpawnRate',
    category: 'ENEMIES',
    label: 'Heart Pickup Spawn Rate',
    min: 0.0,
    max: 1.0,
    step: 0.02,
    unit: '',
    desc: 'Rare mid-air Heart health recovery rate (always strictly lower than Aerial Drone rate)',
  },

  // --- PHYSICS & DASH CATEGORY ---
  {
    key: 'dashBoostPowerMult',
    category: 'PHYSICS',
    label: 'Dash Boost Power & Lift',
    min: 0.5,
    max: 3.0,
    step: 0.05,
    unit: 'x',
    desc: 'Horizontal burst velocity and upward anti-gravity rescue lift of Phase Dash',
  },
  {
    key: 'powerUpDurationSec',
    category: 'PHYSICS',
    label: 'Base Power-Up Duration',
    min: 4,
    max: 35,
    step: 1,
    unit: 's',
    desc: 'Duration in seconds before temporary power-ups expire',
  },
  {
    key: 'baseMoveSpeed',
    category: 'PHYSICS',
    label: 'Lateral Steering Speed',
    min: 180,
    max: 520,
    step: 10,
    unit: ' px/s',
    desc: 'Constant horizontal movement speed',
  },
  {
    key: 'baseJumpTempo',
    category: 'PHYSICS',
    label: 'Base Jump Tempo (Gravity)',
    min: 65,
    max: 250,
    step: 5,
    unit: ' BPM',
    desc: 'Baseline auto-bounce arc tempo in Standard mode',
  },
  {
    key: 'minJumpBpm',
    category: 'PHYSICS',
    label: 'Minimum Jump Speed (Low Flow)',
    min: 96,
    max: 250,
    step: 2,
    unit: ' BPM',
    desc: 'Starting Jump Speed (BPM) at Flow x0',
  },
  {
    key: 'maxJumpBpm',
    category: 'PHYSICS',
    label: 'Maximum Jump Speed (Peak Flow)',
    min: 96,
    max: 250,
    step: 2,
    unit: ' BPM',
    desc: 'Fastest Jump Speed (BPM) as Flow increases toward Peak Flow',
  },

  // --- MOBILE / ANDROID STEERING & COVERAGE RANGE CATEGORY ---
  {
    key: 'mobileTouchSpeedMult',
    category: 'MOBILE',
    label: 'Touch Drag Steer Speed',
    min: 0.2,
    max: 2.5,
    step: 0.05,
    unit: 'x',
    desc: 'Horizontal character steering speed multiplier when dragging finger on screen',
  },
  {
    key: 'mobileTouchRangePx',
    category: 'MOBILE',
    label: 'Touch Drag Coverage Range',
    min: 25,
    max: 200,
    step: 5,
    unit: 'px',
    desc: 'Finger drag distance in pixels required to reach 100% full steering speed',
  },
  {
    key: 'mobileTiltSpeedMult',
    category: 'MOBILE',
    label: 'Gravity Tilt Steer Speed',
    min: 0.2,
    max: 2.5,
    step: 0.05,
    unit: 'x',
    desc: 'Horizontal character steering speed multiplier when tilting phone (gravity sensor)',
  },
  {
    key: 'mobileTiltMaxAngleDeg',
    category: 'MOBILE',
    label: 'Gravity Tilt Coverage Range',
    min: 6,
    max: 35,
    step: 1,
    unit: '°',
    desc: 'Phone tilt angle in degrees required to reach 100% full steering speed',
  },
];

/**
 * Right-Side Interactive Circular Power-Up Loadout Slots:
 * - Starts empty (0% charge) at the beginning of a run and gradually fills up with pixels.
 * - Click / Tap (or press keys 1..7) when READY to activate!
 * - Stays active for its duration (pixels drain from 100% to 0%), then enters Cooldown to refill!
 */
function RightSidePowerUpSlotsHud({
  slotsCount,
  getSlotRuntime,
  onActivateSlot,
}: {
  slotsCount: number;
  getSlotRuntime: (idx: number) => EquippedPowerUpSlotRuntime | undefined;
  onActivateSlot: (idx: number) => void;
}) {
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const badgeRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    let animId = 0;
    const render = (now: number) => {
      animId = requestAnimationFrame(render);
      const t = now / 1000;
      for (let idx = 0; idx < slotsCount; idx++) {
        const cvs = canvasRefs.current[idx];
        const slot = getSlotRuntime(idx);
        if (!cvs || !slot) continue;
        const ctx = cvs.getContext('2d');
        if (!ctx) continue;

        ctx.clearRect(0, 0, cvs.width, cvs.height);

        const isPassiveSlot = slot.activationMode === 'PASSIVE';
        const isReady = isPassiveSlot ? true : slot.phase === 'ready' && slot.usesLeft > 0;
        const isActive = isPassiveSlot ? true : slot.phase === 'active';
        const isDepleted =
          !isPassiveSlot && (slot.phase === 'depleted' || (slot.usesLeft <= 0 && !isActive));

        const isShieldNoTimer = slot.id === 'combo_shield';
        const ratio = isPassiveSlot
          ? 1
          : isActive
          ? isShieldNoTimer
            ? 1
            : Math.max(0, Math.min(1, slot.activeRemainingSec / Math.max(0.2, slot.durationSec)))
          : isReady
          ? 1
          : isDepleted
          ? 0
          : Math.max(0, Math.min(1, slot.chargeProgress));

        const baseCol = slot.accentColor || '#00ff88';
        const fillCol = isPassiveSlot
          ? withAlpha(baseCol, 0.34 + 0.1 * Math.sin(t * 3.5 + idx))
          : isActive
          ? withAlpha(lighten(baseCol, 0.25), 0.72)
          : isReady
          ? withAlpha(baseCol, 0.52 + 0.14 * Math.sin(t * 7))
          : withAlpha(baseCol, 0.32);
        const topEdgeCol = isActive ? '#ffffff' : lighten(baseCol, 0.45);
        const borderCol = isPassiveSlot
          ? baseCol
          : isActive
          ? '#ffffff'
          : isReady
          ? baseCol
          : isDepleted
          ? 'rgba(71, 85, 105, 0.45)'
          : withAlpha(baseCol, 0.55);

        drawCircularPixelGauge(
          ctx,
          32,
          32,
          isPassiveSlot ? 14 : 19,
          ratio,
          fillCol,
          topEdgeCol,
          borderCol,
          isReady,
          isActive,
          idx + 1,
          3
        );

        // Draw Center Icon (smaller for PASSIVE slots so Active vs Passive is immediately distinguishable)
        ctx.save();
        ctx.fillStyle = isDepleted ? 'rgba(148, 163, 184, 0.45)' : '#ffffff';
        ctx.shadowBlur = isReady || isActive ? 6 : 3;
        ctx.shadowColor = isReady || isActive ? baseCol : '#000000';
        ctx.font = isPassiveSlot
          ? "9px 'Press Start 2P', monospace"
          : "12px 'Press Start 2P', monospace";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(slot.icon, 32, 33);
        ctx.restore();

        const badge = badgeRefs.current[idx];
        if (badge) {
          badge.textContent = isPassiveSlot
            ? 'PASS'
            : isActive
            ? isShieldNoTimer
              ? 'ON'
              : `${slot.activeRemainingSec.toFixed(1)}s`
            : `x${slot.usesLeft}`;
          badge.style.color = isPassiveSlot
            ? '#67e8f9'
            : isActive
            ? '#ffffff'
            : isReady
            ? '#fde047'
            : isDepleted
            ? '#64748b'
            : '#cbd5e1';
          badge.style.borderColor = isReady || isActive ? baseCol : '#334155';
        }
        const btn = btnRefs.current[idx];
        if (btn) {
          btn.style.opacity = isDepleted ? '0.45' : isPassiveSlot ? '0.92' : '1';
        }
      }
    };
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [slotsCount, getSlotRuntime]);

  if (slotsCount <= 0) return null;

  return (
    <div
      id="right-powerup-slots"
      data-testid="right-powerup-slots"
      className="pointer-events-auto absolute right-2.5 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-20"
    >
      {Array.from({ length: slotsCount }, (_, idx) => {
        const slot = getSlotRuntime(idx);
        const isPassive = slot?.activationMode === 'PASSIVE';
        return (
          <button
            key={idx}
            ref={(el) => {
              btnRefs.current[idx] = el;
            }}
            type="button"
            data-testid={`powerup-slot-btn-${idx}`}
            data-slot-mode={isPassive ? 'PASSIVE' : 'ACTIVE'}
            aria-label={
              slot
                ? isPassive
                  ? `Passive ${slot.name}`
                  : `Activate ${slot.name}`
                : `Power-Up Slot ${idx + 1}`
            }
            title={
              slot
                ? isPassive
                  ? `${slot.name} (Lv.${slot.level} PASSIVE — Always Active)`
                  : `${slot.name} (Lv.${slot.level}) — Click or press [${idx + 1}] when full`
                : ''
            }
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isPassive) onActivateSlot(idx);
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (!isPassive) onActivateSlot(idx);
            }}
            className={`relative rounded-full flex items-center justify-center transition-transform ${
              isPassive
                ? 'w-8 h-8 cursor-default opacity-95'
                : 'w-11 h-11 active:scale-90 cursor-pointer'
            }`}
          >
            <canvas
              ref={(el) => {
                canvasRefs.current[idx] = el;
              }}
              width={64}
              height={64}
              className={
                isPassive
                  ? 'w-12 h-12 -m-2 block pointer-events-none'
                  : 'w-16 h-16 -m-2.5 block pointer-events-none'
              }
            />
            <span
              ref={(el) => {
                badgeRefs.current[idx] = el;
              }}
              className="pointer-events-none absolute -bottom-1 -right-0.5 px-1 py-0.2 bg-slate-950/95 border border-slate-700 text-[5px] text-amber-300 leading-none"
            >
              {isPassive ? 'PASS' : `x${slot?.usesLeft ?? 0}`}
            </span>
            <span className="pointer-events-none absolute -top-1 -left-0.5 px-1 py-0.2 bg-slate-950/90 border border-slate-800 text-[5px] text-cyan-300 leading-none">
              L{slot?.level ?? 1}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Circular Pixel-Cooldown Dash Button for Android / Touch & Desktop:
 * - 30% smaller than the old rectangular button (54x54px), while still larger than the 44x44px Power-Up icons!
 * - Circular shape (`rounded-full`) with ONLY the Dash icon (`⚡`) inside (no text).
 * - Empties its pixel interior on activation and refills pixel-by-pixel during cooldown!
 */
function CircularPixelDashButton({
  getDashCooldownState,
  onTriggerDash,
  sizePx = 54,
}: {
  getDashCooldownState: () => {
    dashCool: number;
    dashMaxCool: number;
    dashAct: number;
    primaryColor: string;
    horizonColor: string;
  };
  onTriggerDash: () => void;
  sizePx?: number;
}) {
  const cvsRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animId = 0;
    const render = (now: number) => {
      animId = requestAnimationFrame(render);
      const cvs = cvsRef.current;
      if (!cvs) return;
      const ctx = cvs.getContext('2d');
      if (!ctx) return;

      const t = now / 1000;
      const st = getDashCooldownState();
      const isReady = st.dashCool <= 0.01;
      const isActive = st.dashAct > 0;
      const ratio = isReady
        ? 1
        : Math.max(0, Math.min(1, 1 - st.dashCool / Math.max(0.1, st.dashMaxCool)));

      ctx.clearRect(0, 0, cvs.width, cvs.height);

      const baseCol = st.primaryColor || '#00ff88';
      const horizCol = st.horizonColor || '#00d4ff';
      const fillCol = isActive
        ? withAlpha('#ffffff', 0.78)
        : isReady
        ? withAlpha(baseCol, 0.48 + 0.14 * Math.sin(t * 6.5))
        : withAlpha(horizCol, 0.34);
      const topEdgeCol = isReady || isActive ? '#ffffff' : lighten(horizCol, 0.4);
      const borderCol = isActive
        ? '#ffffff'
        : isReady
        ? baseCol
        : withAlpha(horizCol, 0.65);

      drawCircularPixelGauge(
        ctx,
        38,
        38,
        24,
        ratio,
        fillCol,
        topEdgeCol,
        borderCol,
        isReady,
        isActive,
        19,
        3
      );

      // Draw ONLY the lightning icon inside the circle (no text!)
      ctx.save();
      ctx.fillStyle = isReady || isActive ? '#ffffff' : 'rgba(226, 232, 240, 0.75)';
      ctx.shadowBlur = isReady || isActive ? 8 : 3;
      ctx.shadowColor = isReady || isActive ? baseCol : '#000000';
      ctx.font = "16px 'Press Start 2P', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', 38, 39);
      ctx.restore();
    };
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [getDashCooldownState]);

  const clampedSize = Math.max(36, Math.min(96, Math.round(sizePx || 54)));
  const canvasPx = Math.round(clampedSize * (76 / 54));
  const negMarginPx = Math.round((canvasPx - clampedSize) * 0.5);

  return (
    <button
      type="button"
      id="mobile-dash-btn"
      data-testid="mobile-dash-btn"
      aria-label="Phase Dash"
      onTouchStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onTriggerDash();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onTriggerDash();
      }}
      style={{ width: `${clampedSize}px`, height: `${clampedSize}px` }}
      className="pointer-events-auto rounded-full flex items-center justify-center transition-transform active:scale-90 cursor-pointer overflow-visible"
    >
      <canvas
        ref={cvsRef}
        width={76}
        height={76}
        style={{
          width: `${canvasPx}px`,
          height: `${canvasPx}px`,
          margin: `-${negMarginPx}px`,
        }}
        className="block pointer-events-none"
      />
    </button>
  );
}

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<OmniAudioEngine>(new OmniAudioEngine());

  // High-frequency HUD DOM refs
  const scoreDomRef = useRef<HTMLDivElement | null>(null);
  const altDomRef = useRef<HTMLSpanElement | null>(null);
  const orbsDomRef = useRef<HTMLSpanElement | null>(null);
  const comboTextDomRef = useRef<HTMLSpanElement | null>(null);
  const milestoneDomRef = useRef<HTMLSpanElement | null>(null);
  const comboBarDomRef = useRef<HTMLDivElement | null>(null);
  const rankBadgeDomRef = useRef<HTMLDivElement | null>(null);
  const biomeTagDomRef = useRef<HTMLDivElement | null>(null);
  const melodyHudDomRef = useRef<HTMLDivElement | null>(null);
  const mobileHintDomRef = useRef<HTMLDivElement | null>(null);
  const hpHeartsDomRef = useRef<HTMLDivElement | null>(null);
  const lastRenderedHpKeyRef = useRef<string>('');

  const [screen, setScreen] = useState<ScreenState>('title');
  const [storeTab, setStoreTab] = useState<'powerups' | 'characters' | 'banks' | 'scales'>('powerups');
  const [powerUpModeFilter, setPowerUpModeFilter] = useState<'ALL' | 'ACTIVE' | 'PASSIVE'>('ALL');
  const [traditionFilter, setTraditionFilter] = useState<string>('ALL');
  const [fineTuneCategory, setFineTuneCategory] = useState<FineTuneCategory>('ALL');
  const [isEditingDashLayout, setIsEditingDashLayout] = useState<boolean>(false);
  const dashDragActiveRef = useRef<boolean>(false);
  const [customBankSampleNames, setCustomBankSampleNames] = useState<Record<string, string>>({});
  const [melodyBiomeFilter, setMelodyBiomeFilter] = useState<number | 'ALL'>('ALL');
  const [gameMode, setGameMode] = useState<GameMode>('STANDARD');
  const [storeOrbInput, setStoreOrbInput] = useState<string>('');
  const [devBundleStatus, setDevBundleStatus] = useState<string>('');
  const [tutorialStep, setTutorialStep] = useState<0 | 1 | 2 | 3>(0);
  const [showLevelRoadmapModal, setShowLevelRoadmapModal] = useState<boolean>(false);
  const [showRankedModal, setShowRankedModal] = useState<boolean>(false);
  const [telegramSession, setTelegramSession] = useState(() => parseTelegramGameSession());
  const [rankedLeaderboard, setRankedLeaderboard] = useState<RankedLeaderboardEntry[]>([]);
  const [telegramSyncedBadge, setTelegramSyncedBadge] = useState<boolean>(false);
  const [pilotNameInput, setPilotNameInput] = useState<string>(
    () => parseTelegramGameSession().firstName
  );
  const [gameOverAnimElapsed, setGameOverAnimElapsed] = useState<number>(0);
  const menuBeatInfoRef = useRef<{ phase: number; beatCount: number }>({
    phase: 0,
    beatCount: 0,
  });
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    initTelegramWebViewOptimizations();
    const sess = parseTelegramGameSession();
    setTelegramSession(sess);
    setPilotNameInput(sess.firstName);
    fetchTelegramLeaderboard().then((list) => {
      setRankedLeaderboard(list);
    });
  }, []);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  // Unlock Web Audio Context on first user gesture so muffled background menu music starts immediately
  useEffect(() => {
    const unlockAudioOnGesture = () => {
      if (!simRef.current.isMuted) {
        audioRef.current.init(simRef.current.cfg);
        audioRef.current.resume();
      }
    };
    window.addEventListener('pointerdown', unlockAudioOnGesture, { passive: true });
    window.addEventListener('touchstart', unlockAudioOnGesture, { passive: true });
    window.addEventListener('keydown', unlockAudioOnGesture, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudioOnGesture);
      window.removeEventListener('touchstart', unlockAudioOnGesture);
      window.removeEventListener('keydown', unlockAudioOnGesture);
    };
  }, []);

  const [cfg, setCfg] = useState<GameConfig>(() => {
    const isTgRelease = parseTelegramGameSession().isTelegramEnv;
    try {
      const saved = localStorage.getItem('omni_cfg_v8');
      if (saved) {
        const parsed = JSON.parse(saved);
        const validAvatar = CHARACTER_AVATARS.some((a) => a.id === parsed.playerShape)
          ? parsed.playerShape
          : DEFAULT_CFG.playerShape;
        const lvInfo = computePlayerLevelInfo(parsed.playerXp || 0);
        const cumUnlocks = getCumulativeUnlocksForLevel(lvInfo.level);
        const allowBetaSecrets = !isTgRelease && Boolean(parsed.betaUnlockSecretSkins);
        const betaSecrets = allowBetaSecrets ? SECRET_AVATAR_IDS : [];
        const rawSavedAvatars: string[] = Array.isArray(parsed.unlockedAvatars)
          ? parsed.unlockedAvatars
          : [];
        const sanitizedSavedAvatars = isTgRelease
          ? rawSavedAvatars.filter(
              (id) =>
                !SECRET_AVATAR_IDS.includes(id as CharacterAvatarDef['id']) ||
                cumUnlocks.unlockedSecretAvatars.includes(id as CharacterAvatarDef['id'])
            )
          : rawSavedAvatars;
        const unlockedAvatars = Array.from(
          new Set([
            ...STARTER_UNLOCKED_AVATARS,
            ...sanitizedSavedAvatars,
            ...cumUnlocks.unlockedSecretAvatars,
            ...betaSecrets,
          ])
        );
        const activePlayerShape = unlockedAvatars.includes(validAvatar)
          ? validAvatar
          : DEFAULT_CFG.playerShape;
        return {
          ...DEFAULT_CFG,
          ...parsed,
          language: parsed.language === 'fa' ? 'fa' : 'en',
          playerXp: lvInfo.totalXp,
          playerLevel: lvInfo.level,
          betaUnlockSecretSkins: allowBetaSecrets,
          tutorialSeen: Boolean(parsed.tutorialSeen),
          customBiomes: Array.isArray(parsed.customBiomes) ? parsed.customBiomes : [],
          playerShape: activePlayerShape,
          unlockedAvatars,
          powerUpLevels: {
            ...DEFAULT_CFG.powerUpLevels,
            ...(parsed.powerUpLevels || {}),
          },
          equippedPowerUps:
            Array.isArray(parsed.equippedPowerUps) && parsed.equippedPowerUps.length > 0
              ? sortEquippedPowerUpsActiveFirst(parsed.equippedPowerUps)
              : DEFAULT_CFG.equippedPowerUps,
          fineTune: isTgRelease
            ? { ...DEFAULT_FINE_TUNE }
            : {
                ...DEFAULT_FINE_TUNE,
                ...(parsed.fineTune || {}),
              },
          unlockedScales: Array.from(
            new Set([
              ...(parsed.unlockedScales?.length ? parsed.unlockedScales : DEFAULT_CFG.unlockedScales),
              ...cumUnlocks.unlockedScales,
            ])
          ),
          enabledScales: parsed.enabledScales?.length
            ? parsed.enabledScales
            : DEFAULT_CFG.enabledScales,
          unlockedSoundBanks: Array.from(
            new Set([
              ...(parsed.unlockedSoundBanks?.length
                ? parsed.unlockedSoundBanks
                : DEFAULT_CFG.unlockedSoundBanks),
              ...cumUnlocks.unlockedSoundBanks,
            ])
          ),
          enabledSoundBanks: parsed.enabledSoundBanks?.length
            ? parsed.enabledSoundBanks
            : DEFAULT_CFG.enabledSoundBanks,
        };
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_CFG, fineTune: { ...DEFAULT_FINE_TUNE } };
  });

  const [customStages, setCustomStages] = useState<CustomStage[]>(() => {
    try {
      const saved = localStorage.getItem('omni_stages_v1');
      if (saved) {
        const parsed: CustomStage[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return getUnifiedStageLibrary(parsed);
        }
      }
    } catch {
      // ignore
    }
    return getUnifiedStageLibrary(DEFAULT_BUILT_IN_STAGES);
  });

  const [activeStageId, setActiveStageId] = useState<string>(
    () => DEFAULT_BUILT_IN_STAGES[0]?.id || 'stage_neon_prelude'
  );

  const [stats, setStats] = useState<PersistentStats>(() => {
    try {
      const saved = localStorage.getItem('omni_stats_v4');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return { highScore: 0, maxCombo: 0, totalOrbs: 60, runsPlayed: 0 };
  });

  const [isMuted, setIsMuted] = useState(false);
  const [midiStatus, setMidiStatus] = useState<string>('');
  const [endSnapshot, setEndSnapshot] = useState<{
    score: number;
    best: number;
    isNewRecord: boolean;
    maxFlow: number;
    altitude: number;
    orbsCollected: number;
    rank: string;
    xpGained: number;
    prevLevel: number;
    newLevel: number;
    prevRatio: number;
    progressRatio: number;
    xpIntoLevel: number;
    xpNeededForNext: number;
    levelRewards: LevelUpRewardDef[];
  }>({
    score: 0,
    best: 0,
    isNewRecord: false,
    maxFlow: 0,
    altitude: 0,
    orbsCollected: 0,
    rank: 'D',
    xpGained: 0,
    prevLevel: 0,
    newLevel: 0,
    prevRatio: 0,
    progressRatio: 0,
    xpIntoLevel: 0,
    xpNeededForNext: 4500,
    levelRewards: [],
  });

  const [seqGrid, setSeqGrid] = useState<string[][]>(() => {
    const initial: string[][] = Array.from({ length: 16 }, () => []);
    const defaultNotes = [
      'C4', 'D4', 'G4', 'C5', 'G4', 'D4', 'F4', 'A4',
      'C4', 'D4', 'G4', 'C5', 'A4', 'G4', 'F4', 'D4',
    ];
    defaultNotes.forEach((n, idx) => {
      initial[idx] = [n];
    });
    return initial;
  });
  const [activePreset, setActivePreset] = useState<string>('cyber_arp');

  const pointerEyeRef = useRef<{ x: number; y: number; activeUntil: number }>({
    x: 300,
    y: 400,
    activeUntil: 0,
  });

  const lastPreviewedBankIdRef = useRef<string | null>(null);

  const touchDragRef = useRef<{
    active: boolean;
    touchId: number;
    startX: number;
    startY: number;
    startTimeMs: number;
    maxMoveDistPx: number;
    anchorX: number;
    lastX: number;
    lastTimeMs: number;
    speedBoost: number;
  }>({
    active: false,
    touchId: -1,
    startX: 0,
    startY: 0,
    startTimeMs: 0,
    maxMoveDistPx: 0,
    anchorX: 0,
    lastX: 0,
    lastTimeMs: 0,
    speedBoost: 0.85,
  });

  const mouseTapRef = useRef<{
    down: boolean;
    startX: number;
    startY: number;
    startTimeMs: number;
  }>({
    down: false,
    startX: 0,
    startY: 0,
    startTimeMs: 0,
  });

  const simRef = useRef<{
    state: ScreenState;
    mode: GameMode;
    cfg: GameConfig;
    isMuted: boolean;
    score: number;
    maxFlowThisRun: number;
    orbsThisRun: number;
    flowEnergy: number;
    combo: number;
    flowSubSteps: number;
    timeSinceLastClimb: number;
    highestPlatformY: number;
    styleMeter: number;
    camY: number;
    viewH: number;
    gameTime: number;
    hitstop: number;
    shake: number;
    aberration: number;
    activeBiomeIdx: number;
    biomeOrder: number[];
    activeSoundBankId: string;
    activeCuratedMelody: CuratedBiomeMelody;
    curatedMelodyStepCursor: number;
    menuMelodyCursor: number;
    menuMelodyTimer: number;
    menuMelodyBeatCount: number;
    fragileStreakRemaining: number;
    biomeDissolve: BiomeDissolveState;
    dyingSequence: DyingSequenceState;
    seqData: number[][];
    seqIdx: number;
    activeStage?: CustomStage;
    stageStepCursor: number;
    nextStagePlatformDurRatio: number;
    activeJumpGravity: number;
    shieldRegenTimer: number;
    activePowerUps: ActivePowerUp[];
    pendingRhythmRings: Array<{ triggerAt: number; color: string; maxR: number }>;
    activeChordChainTargetId?: number;
    chordComboHud: ChordComboHudState;
    recentPlayedPlatformNotes: number[];
    chordGatePlan: {
      nextGateStepIndex: number;
      nextGateChordIdx: 0 | 1 | 2 | 3;
      progressionVariant: number;
      prevGatePlatId?: number;
      cooldownSteps: number;
      sequenceNumberInBiome: 1 | 2;
    };
    platformsGeneratedCount: number;
    biomeStepsGenerated: number;
    chordSequencesSpawnedInBiome: number;
    chordSequencesCompletedInBiome: number;
    equippedSlotRuntimes: EquippedPowerUpSlotRuntime[];
    tutorialActive: boolean;
    jetpackGlitters: GlitterParticle[];
    jetpackNoteTimer: number;
    jetpackStepCounter: number;
    platformsClimbedCount: number;
    player: PlayerRenderState & {
      hp: number;
      maxHp: number;
      airJumpsLeft: number;
      wallDashGraceTimer: number;
      wallBounceCooldownPenaltyActive: boolean;
    };
    inputs: {
      left: boolean;
      right: boolean;
      tiltX: boolean | number;
      touchSteerX: number;
      upJustPressed: boolean;
      dashJustPressed: boolean;
    };
    platforms: PlatformEntity[];
    aerialHazards: AerialHazardEntity[];
    heartPickups: HeartPickupEntity[];
    orbs: HarmonicOrb[];
    particles: ParticlePool;
    texts: FloatingTextItem[];
    shockwaves: Array<{ x: number; y: number; r: number; maxR: number; color: string; alpha: number }>;
    nextPlatformId: number;
  }>({
    state: 'title',
    mode: 'STANDARD',
    cfg: DEFAULT_CFG,
    isMuted: false,
    score: 0,
    maxFlowThisRun: 0,
    orbsThisRun: 0,
    flowEnergy: 0,
    combo: 0,
    flowSubSteps: 0,
    timeSinceLastClimb: 0,
    highestPlatformY: 782,
    styleMeter: 0,
    camY: 0,
    viewH: 800,
    gameTime: 0,
    hitstop: 0,
    shake: 0,
    aberration: 0,
    activeBiomeIdx: 0,
    biomeOrder: [0, 1, 2, 6],
    activeSoundBankId: 'crt_velvet',
    activeCuratedMelody:
      ALL_CURATED_MELODIES[Math.floor(Math.random() * ALL_CURATED_MELODIES.length)] ||
      ALL_CURATED_MELODIES[0],
    curatedMelodyStepCursor: 0,
    menuMelodyCursor: 0,
    menuMelodyTimer: 0.65,
    menuMelodyBeatCount: 0,
    fragileStreakRemaining: 0,
    biomeDissolve: {
      active: false,
      progress: 1,
      fromBiome: MASTER_SCALES[0],
      toBiome: MASTER_SCALES[0],
    },
    dyingSequence: {
      active: false,
      phase: 'none',
      timer: 0,
      dissolveProgress: 0,
      glitters: [],
    },
    seqData: SEQUENCER_PRESETS.cyber_arp.steps,
    seqIdx: 0,
    activeStage: undefined,
    stageStepCursor: 0,
    nextStagePlatformDurRatio: 1.0,
    activeJumpGravity: 1472,
    shieldRegenTimer: 0,
    activePowerUps: [],
    pendingRhythmRings: [],
    activeChordChainTargetId: undefined,
    chordComboHud: {
      active: false,
      completedCount: 0,
      chordNames: MASTER_SCALES[0].chordNames,
      completionFlashTimer: 0,
    },
    recentPlayedPlatformNotes: [],
    chordGatePlan: {
      nextGateStepIndex: -1,
      nextGateChordIdx: 0,
      progressionVariant: 0,
      prevGatePlatId: undefined,
      cooldownSteps: 8,
      sequenceNumberInBiome: 1,
    },
    platformsGeneratedCount: 0,
    biomeStepsGenerated: 0,
    chordSequencesSpawnedInBiome: 0,
    chordSequencesCompletedInBiome: 0,
    equippedSlotRuntimes: [],
    tutorialActive: false,
    jetpackGlitters: [],
    jetpackNoteTimer: 0,
    jetpackStepCounter: 0,
    platformsClimbedCount: 0,
    player: {
      x: 288,
      y: 740,
      w: 24,
      h: 24,
      vx: 0,
      vy: 0,
      grounded: false,
      wallSlideDir: 0,
      scaleX: 1,
      scaleY: 1,
      facing: 1,
      eyeLookX: 0,
      eyeLookY: -0.2,
      impactSquashTimer: 0,
      dashCool: 0,
      dashMaxCool: 2.0,
      dashAct: 0,
      hasShield: false,
      doubleJumpReady: false,
      damageGlitchTimer: 0,
      hp: 3,
      maxHp: 3,
      airJumpsLeft: 0,
      wallDashGraceTimer: 0,
      wallBounceCooldownPenaltyActive: false,
      trail: [],
      scarfNodes: Array.from({ length: 6 }, () => ({ x: 300, y: 750 })),
    },
    inputs: {
      left: false,
      right: false,
      tiltX: 0,
      touchSteerX: 0,
      upJustPressed: false,
      dashJustPressed: false,
    },
    platforms: [],
    aerialHazards: [],
    heartPickups: [],
    orbs: [],
    particles: new ParticlePool(320),
    texts: Array.from({ length: 12 }, () => ({
      active: false,
      text: '',
      x: 0,
      y: 0,
      vy: -1.0,
      life: 0,
      maxLife: 1,
      color: '#ffffff',
      scale: 1,
    })),
    shockwaves: [],
    nextPlatformId: 1,
  });

  useEffect(() => {
    (window as unknown as { __NEON_ASCENT_SIM__?: typeof simRef.current }).__NEON_ASCENT_SIM__ =
      simRef.current;
  }, []);

  useEffect(() => {
    const bodyState =
      screen === 'playing'
        ? 'playing'
        : screen === 'paused'
        ? 'paused'
        : screen === 'gameover'
        ? 'gameover'
        : 'title';
    document.body.dataset.state = bodyState;
    simRef.current.state = screen;
    simRef.current.tutorialActive = tutorialStep > 0;
  }, [screen, tutorialStep]);

  // Choreographed Arcade Game Over Timeline Timer (0.0s -> 2.0s, skippable via click/Enter/Space)
  useEffect(() => {
    if (screen !== 'gameover') {
      setGameOverAnimElapsed(0);
      return;
    }
    let animId = 0;
    const startTs = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - startTs) / 1000;
      setGameOverAnimElapsed((prev) => (prev >= 9.0 ? prev : elapsed));
      if (elapsed < 3.0) {
        animId = requestAnimationFrame(tick);
      }
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [screen]);

  useEffect(() => {
    simRef.current.cfg = cfg;
    try {
      localStorage.setItem('omni_cfg_v8', JSON.stringify(cfg));
    } catch {
      // ignore
    }
  }, [cfg]);

  useEffect(() => {
    try {
      localStorage.setItem('omni_stages_v1', JSON.stringify(customStages));
    } catch {
      // ignore
    }
  }, [customStages]);

  useEffect(() => {
    try {
      localStorage.setItem('omni_stats_v4', JSON.stringify(stats));
    } catch {
      // ignore
    }
  }, [stats]);

  useEffect(() => {
    simRef.current.isMuted = isMuted;
    if (audioRef.current.masterGain && audioRef.current.ctx) {
      const t = audioRef.current.ctx.currentTime;
      audioRef.current.masterGain.gain.cancelScheduledValues(t);
      audioRef.current.masterGain.gain.setTargetAtTime(
        isMuted ? 0 : Math.min(0.92, cfg.volMaster * 0.92),
        t,
        0.05
      );
    }
  }, [isMuted, cfg.volMaster]);

  // Dynamic 1:1 Square-Pixel Canvas Height Matching (eliminates vertical stretching on tall phones)
  useEffect(() => {
    const syncViewportAspect = () => {
      const el = containerRef.current;
      const cvs = canvasRef.current;
      if (!el || !cvs) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const nextViewH = Math.max(
        640,
        Math.min(1600, Math.round(600 * (rect.height / rect.width)))
      );
      if (cvs.height !== nextViewH) {
        cvs.height = nextViewH;
      }
      const sim = simRef.current;
      const prevViewH = sim.viewH || 800;
      if (prevViewH !== nextViewH) {
        sim.viewH = nextViewH;
        if (sim.state !== 'playing') {
          sim.camY = 800 - nextViewH;
        } else {
          sim.camY += prevViewH - nextViewH;
        }
      }
    };

    syncViewportAspect();
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => syncViewportAspect())
        : null;
    if (ro && containerRef.current) {
      ro.observe(containerRef.current);
    }
    window.addEventListener('resize', syncViewportAspect);
    window.addEventListener('orientationchange', syncViewportAspect);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', syncViewportAspect);
      window.removeEventListener('orientationchange', syncViewportAspect);
    };
  }, []);

  const getScaleByIndex = useCallback((idx: number, currentCfg: GameConfig): ScaleBiome => {
    const allBiomes = getAllBiomes(currentCfg.customBiomes);
    const order = simRef.current.biomeOrder;
    const pool =
      order && order.length > 0
        ? order
        : currentCfg.enabledScales.length
        ? currentCfg.enabledScales
        : [0];
    const safeIdx = Math.abs(Math.floor(idx)) % pool.length;
    const id = pool[safeIdx];
    return allBiomes.find((s) => s.id === id) || MASTER_SCALES[0];
  }, []);

  const getActiveSoundBank = useCallback((currentCfg: GameConfig): SoundBankDef => {
    if (simRef.current.mode === 'STAGE' && simRef.current.activeStage) {
      const matchedStageBank = SOUND_BANKS.find(
        (b) => b.id === simRef.current.activeStage?.soundBankId
      );
      if (matchedStageBank) return matchedStageBank;
    }
    const activeId = simRef.current.activeSoundBankId;
    const matched = SOUND_BANKS.find((b) => b.id === activeId);
    if (matched) return matched;
    const enabledId = currentCfg.enabledSoundBanks[0] || 'crt_velvet';
    return SOUND_BANKS.find((b) => b.id === enabledId) || SOUND_BANKS[0];
  }, []);

  const pickRandomEnabledSoundBankId = useCallback(
    (currentCfg: GameConfig, avoidId?: string): string => {
      const pool = currentCfg.enabledSoundBanks.length
        ? currentCfg.enabledSoundBanks
        : ['crt_velvet'];
      if (pool.length === 1) return pool[0];
      const filtered = avoidId ? pool.filter((id) => id !== avoidId) : pool;
      const candidates = filtered.length > 0 ? filtered : pool;
      return candidates[Math.floor(Math.random() * candidates.length)];
    },
    []
  );

  const spawnFloatingText = useCallback(
    (text: string, x: number, y: number, color: string, scale = 1.0, subtext?: string) => {
      const list = simRef.current.texts;
      for (let i = 0; i < list.length; i++) {
        list[i].active = false;
      }
      const item = list[0];
      item.active = true;
      item.text = text;
      item.subtext = subtext;
      item.x = Math.max(110, Math.min(490, x));
      item.y = y;
      item.vy = -0.9;
      item.life = 0.85;
      item.maxLife = 0.85;
      item.color = color;
      item.scale = scale;
    },
    []
  );

  const spawnShockwave = useCallback((x: number, y: number, color: string, maxR = 75) => {
    const list = simRef.current.shockwaves;
    list.push({ x, y, r: 8, maxR, color, alpha: 0.78 });
    if (list.length > 10) {
      list.shift();
    }
  }, []);

  const syncFlowStateFromEnergy = (sim: typeof simRef.current) => {
    sim.flowEnergy = Math.max(0, Math.min(45, sim.flowEnergy));
    sim.combo = Math.floor(sim.flowEnergy);
    sim.flowSubSteps = Math.round((sim.flowEnergy - sim.combo) * FLOW_PLATFORMS_PER_STEP);
  };

  const downgradeRemainingChordGates = (sim: typeof simRef.current, color = '#fb7185') => {
    let anyDowngraded = false;
    for (let i = 0; i < sim.platforms.length; i++) {
      const pl = sim.platforms[i];
      if (pl.type === 'chord_gate' && !pl.hit) {
        anyDowngraded = true;
        pl.type = 'normal';
        pl.chordGateIndex = undefined;
        pl.chordProgressionVariant = undefined;
        pl.chordNameOverride = undefined;
        pl.nextGateId = undefined;
        pl.nextGateX = undefined;
        pl.nextGateY = undefined;
        sim.particles.burst(pl.x + pl.w * 0.5, pl.y, color, 6, 3.5, 'dust');
      }
    }
    sim.activeChordChainTargetId = undefined;
    sim.chordComboHud.active = false;
    sim.chordComboHud.completedCount = 0;
    sim.chordComboHud.completionFlashTimer = 0;
    if (anyDowngraded || sim.chordGatePlan.nextGateStepIndex >= 0) {
      sim.chordGatePlan = {
        nextGateStepIndex: -1,
        nextGateChordIdx: 0,
        progressionVariant: Math.floor(Math.random() * 4),
        prevGatePlatId: undefined,
        cooldownSteps: Math.max(4, Math.round(sim.cfg.fineTune?.chordGateCooldownSteps ?? 12)),
        sequenceNumberInBiome: sim.chordSequencesSpawnedInBiome >= 2 ? 2 : 1,
      };
    }
  };

  const grantTemporaryPowerUp = useCallback(
    (biome: ScaleBiome, reasonLabel: string, forcedId?: ActivePowerUp['id']) => {
      const sim = simRef.current;
      if (sim.activePowerUps.length >= 4) return;

      const available = RUN_UPGRADES.filter(
        (u) => !sim.activePowerUps.some((active) => active.id === u.id)
      );
      if (available.length === 0) return;

      const picked =
        (forcedId && available.find((u) => u.id === forcedId)) ||
        available[Math.floor(Math.random() * available.length)];

      const charPerks = getCharacterById(sim.cfg.playerShape).perks;
      const baseDurMult = (sim.cfg.fineTune?.powerUpDurationSec ?? 14) / 14;
      const finalDurationSec = Math.max(
        4,
        Math.round(picked.durationSec * baseDurMult * charPerks.powerUpDurationMultiplier * 10) / 10
      );

      sim.activePowerUps.push({
        id: picked.id,
        name: picked.name,
        icon: picked.icon,
        remainingSec: finalDurationSec,
        durationSec: finalDurationSec,
      });

      if (picked.id === 'combo_shield') {
        sim.player.hasShield = true;
      }
      if (!sim.isMuted) {
        audioRef.current.sfxLevelUp(biome, sim.cfg);
      }
      spawnShockwave(sim.player.x + 12, sim.player.y + 12, biome.fg, 95);
      spawnFloatingText(
        `${picked.icon} ${picked.name}`,
        300,
        sim.player.y - 32,
        biome.horizonColor,
        1.0,
        reasonLabel
      );
    },
    [spawnFloatingText, spawnShockwave]
  );

  // Trigger an immediate biome shift (used when completing the 2nd Chord Gate sequence of a biome)
  const triggerNextBiomeShift = useCallback(
    (sim: typeof simRef.current) => {
      const c = sim.cfg;
      const prevBiome = getScaleByIndex(sim.activeBiomeIdx, c);
      sim.activeBiomeIdx = sim.activeBiomeIdx + 1;
      const nextBiome = getScaleByIndex(sim.activeBiomeIdx, c);
      sim.biomeStepsGenerated = 0;
      sim.chordSequencesSpawnedInBiome = 0;
      sim.chordSequencesCompletedInBiome = 0;
      sim.chordGatePlan = {
        nextGateStepIndex: -1,
        nextGateChordIdx: 0,
        progressionVariant: Math.floor(Math.random() * 4),
        prevGatePlatId: undefined,
        cooldownSteps: 6,
        sequenceNumberInBiome: 1,
      };
      sim.activeSoundBankId = pickRandomEnabledSoundBankId(c, sim.activeSoundBankId);
      sim.activeCuratedMelody = pickRandomCuratedMelodyForBiome(
        nextBiome.id,
        c.disabledMelodies,
        sim.activeCuratedMelody?.id,
        c.customBiomes
      );
      sim.curatedMelodyStepCursor = 0;
      sim.menuMelodyCursor = 0;
      sim.biomeDissolve = {
        active: true,
        progress: 0,
        fromBiome: prevBiome,
        toBiome: nextBiome,
      };
      grantTemporaryPowerUp(nextBiome, `BIOME · ${nextBiome.name}`);
    },
    [getScaleByIndex, grantTemporaryPowerUp, pickRandomEnabledSoundBankId]
  );

  // Activate an equipped right-side Power-Up slot when clicked/tapped or triggered via 1..7 hotkey
  const activateEquippedPowerUpSlot = useCallback(
    (slotIdx: number) => {
      const sim = simRef.current;
      if (sim.state !== 'playing' || sim.dyingSequence.active) return;
      const slot = sim.equippedSlotRuntimes[slotIdx];
      if (!slot || slot.activationMode === 'PASSIVE' || slot.phase !== 'ready' || slot.usesLeft <= 0) return;

      const biome = getScaleByIndex(sim.activeBiomeIdx, sim.cfg);
      const charPerks = getCharacterById(sim.cfg.playerShape).perks;
      const isShieldNoTimer = slot.id === 'combo_shield';
      const finalDurationSec = isShieldNoTimer
        ? 9999
        : Math.max(
            1.4,
            Number((slot.durationSec * charPerks.powerUpDurationMultiplier).toFixed(2))
          );

      slot.usesLeft = Math.max(0, slot.usesLeft - 1);
      slot.phase = 'active';
      slot.durationSec = finalDurationSec;
      slot.activeRemainingSec = finalDurationSec;
      slot.chargeProgress = 1;

      const existingIdx = sim.activePowerUps.findIndex((ap) => ap.id === slot.id);
      if (existingIdx >= 0) {
        sim.activePowerUps[existingIdx].remainingSec = finalDurationSec;
        sim.activePowerUps[existingIdx].durationSec = finalDurationSec;
      } else {
        sim.activePowerUps.push({
          id: slot.id,
          name: slot.name,
          icon: slot.icon,
          remainingSec: finalDurationSec,
          durationSec: finalDurationSec,
        });
      }

      const p = sim.player;
      if (slot.id === 'combo_shield') {
        p.hasShield = true;
      } else if (slot.id === 'nano_heal') {
        const healAmt = Math.max(2, Math.round(slot.powerValue));
        p.hp = Math.min(p.maxHp, p.hp + healAmt);
        spawnShockwave(p.x + p.w * 0.5, p.y + p.h * 0.5, '#fb7185', 145);
        sim.particles.burst(p.x + p.w * 0.5, p.y + p.h * 0.5, '#fb7185', 18, 6, 'spark');
        // Clear nearby aerial drones within 210px on heal pulse!
        for (let i = 0; i < sim.aerialHazards.length; i++) {
          const ah = sim.aerialHazards[i];
          if (ah.active && Math.hypot(ah.x - (p.x + 12), ah.y - (p.y + 12)) <= 210) {
            ah.active = false;
            sim.particles.burst(ah.x, ah.y, '#fb7185', 12, 5, 'spark');
          }
        }
        spawnFloatingText(
          `+${healAmt} HP ♥ (${p.hp}/${p.maxHp})`,
          300,
          p.y - 48,
          '#fb7185',
          1.05,
          'VITALITY PULSE'
        );
      } else if (slot.id === 'orb_magnet') {
        // Immediately magnet-lock all visible orbs + spawn 4 harmonic bonus orbs around the player!
        for (let i = 0; i < sim.orbs.length; i++) {
          if (!sim.orbs[i].collected) {
            sim.orbs[i].magnetLocked = true;
          }
        }
        for (let k = 0; k < 4; k++) {
          const angle = (Math.PI * 2 * k) / 4;
          sim.orbs.push({
            id: sim.nextPlatformId++,
            x: Math.max(45, Math.min(555, p.x + 12 + Math.cos(angle) * 110)),
            y: p.y - 60 + Math.sin(angle) * 70,
            baseY: p.y - 60 + Math.sin(angle) * 70,
            radius: 6,
            collected: false,
            freq: biome.scale[k % biome.scale.length] || 523.25,
            color: '#fbbf24',
            phase: k * 0.9,
            magnetLocked: true,
          });
        }
      } else if (slot.id === 'rhythm_aura') {
        // Boost Flow Energy immediately + emit harmonic shockwave
        sim.flowEnergy = Math.min(45, sim.flowEnergy + 1.5);
        syncFlowStateFromEnergy(sim);
      } else if (slot.id === 'chrono_slow') {
        // Disarm nearby spikes & slow all moving entities
        for (let i = 0; i < sim.platforms.length; i++) {
          if (Math.abs(sim.platforms[i].y - p.y) < 550) {
            sim.platforms[i].hasHazard = false;
          }
        }
      } else if (slot.id === 'dash_capacitor' || slot.id === 'dash_turbine') {
        p.dashCool = 0;
        sim.inputs.dashJustPressed = true;
      } else if (slot.id === 'dash_shockwave') {
        p.dashCool = 0;
        const empRadius = Math.max(220, slot.powerValue);
        spawnShockwave(p.x + p.w * 0.5, p.y + p.h * 0.5, '#ffffff', empRadius * 0.75);
        spawnShockwave(p.x + p.w * 0.5, p.y + p.h * 0.5, '#f472b6', empRadius);
        spawnShockwave(p.x + p.w * 0.5, p.y + p.h * 0.5, biome.horizonColor, empRadius * 1.35);
        sim.shake = 7.5;
        sim.aberration = 0.92;
        p.vy = Math.min(p.vy, -560);

        // Vaporize all visible aerial drones and award bonus score
        for (let i = 0; i < sim.aerialHazards.length; i++) {
          const ah = sim.aerialHazards[i];
          if (ah.active && Math.hypot(ah.x - (p.x + 12), ah.y - (p.y + 12)) <= empRadius * 2.2) {
            ah.active = false;
            sim.score += 10;
            sim.particles.burst(ah.x, ah.y, '#f472b6', 16, 6.5, 'spark');
          }
        }
        // Clear platform spikes and stabilize fragile/phase platforms on screen
        for (let i = 0; i < sim.platforms.length; i++) {
          const pl = sim.platforms[i];
          if (Math.abs(pl.y - p.y) <= empRadius * 2.2) {
            if (pl.hasHazard) {
              pl.hasHazard = false;
              sim.particles.burst(pl.x + pl.w * 0.5, pl.y, '#38bdf8', 8, 4, 'spark');
            }
            if (pl.type === 'crumble' || pl.type === 'phase') {
              pl.type = 'normal';
              pl.broken = false;
              pl.crumbleTimer = 0;
              pl.disguisedFragile = false;
            }
          }
        }
        // Magnet-lock all orbs on screen
        for (let i = 0; i < sim.orbs.length; i++) {
          const o = sim.orbs[i];
          if (!o.collected) {
            o.magnetLocked = true;
          }
        }
      } else if (slot.id === 'star_rain') {
        const count = Math.round(slot.powerValue);
        for (let k = 0; k < count; k++) {
          sim.orbs.push({
            id: sim.nextPlatformId++,
            x: 65 + ((k * 92 + Math.random() * 45) % 470),
            y: p.y - 120 - k * 42,
            baseY: p.y - 120 - k * 42,
            radius: 6,
            collected: false,
            freq: biome.scale[k % biome.scale.length] || 523.25,
            color: '#f472b6',
            phase: k * 0.8,
            magnetLocked: true,
          });
        }
      } else if (
        slot.id === 'jetpack_white' ||
        slot.id === 'jetpack_gold' ||
        slot.id === 'jetpack_prism'
      ) {
        p.vy = -slot.powerValue;
        p.grounded = false;
        p.scaleX = 0.68;
        p.scaleY = 1.38;
        sim.shake = 5.5;
        sim.aberration = 0.82;
        sim.jetpackNoteTimer = 0;
        generateWorldUpTo(p.y - 1100);
      }

      if (!sim.isMuted) {
        audioRef.current.sfxLevelUp(biome, sim.cfg);
      }
      spawnShockwave(p.x + p.w * 0.5, p.y + p.h * 0.5, slot.accentColor, 105);
      spawnFloatingText(
        `${slot.icon} ${slot.name} LV.${slot.level}`,
        300,
        p.y - 34,
        slot.accentColor,
        1.0,
        `${slot.usesLeft}/${slot.maxUses} LEFT`
      );
    },
    [getScaleByIndex, spawnFloatingText, spawnShockwave]
  );

  /**
   * Generates strictly ONE clean platform per vertical step.
   * Integrates:
   * 1. Curated Melody Mode (3 melodies per biome, harmonically synchronized Gate Chords & Triplets)
   * 2. Fragile Platform Streaks at high Flow (`fragileSpawnRate`, `fragileStreakChance`, `fragileStreakMaxLen`)
   * 3. Configurable Enemy & Moving Platform Speed + Patrol Range (`enemyMoveSpeedMult`, `enemyMoveRangeMult`)
   */
  const generateWorldUpTo = useCallback(
    (minY: number) => {
      const sim = simRef.current;
      const currentCfg = sim.cfg;
      const fine = currentCfg.fineTune || DEFAULT_FINE_TUNE;
      const charPerks = getCharacterById(currentCfg.playerShape).perks;
      const isCuratedMelodyMode =
        sim.mode === 'STANDARD' && (currentCfg.melodyMode ?? 'curated') === 'curated';

      let lastPlat =
        sim.platforms.length > 0
          ? sim.platforms[sim.platforms.length - 1]
          : {
              id: 1,
              x: 200,
              y: 782,
              w: 176,
              targetW: 176,
              centerX: 288,
              type: 'normal' as PlatformArchetype,
            };
      let lastY = lastPlat.y;
      let prevCenterX = lastPlat.centerX ?? lastPlat.x + lastPlat.w * 0.5;
      let prevType: PlatformArchetype = lastPlat.type || 'normal';

      const isStageMode = sim.mode === 'STAGE' && sim.activeStage !== undefined;
      const compiledStageSteps =
        isStageMode && sim.activeStage
          ? compileStageForGameplay(sim.activeStage, sim.combo)
          : [];

      while (lastY > minY - Math.max(420, sim.viewH * 0.55)) {
        const currentStepAltitudeMeters = Math.floor(Math.abs(Math.min(0, lastY - 782)) / 100);
        const diff = computeFlowDynamicDifficulty(
          sim.flowEnergy,
          fine,
          currentStepAltitudeMeters
        );
        sim.platformsGeneratedCount++;
        sim.biomeStepsGenerated++;

        const biomeDurationSteps = Math.max(22, Math.round(fine.biomePlatformDuration ?? 55));
        const cooldownCfgSteps = Math.max(4, Math.round(fine.chordGateCooldownSteps ?? 12));
        const firstSeqTriggerStep = Math.max(5, Math.round(biomeDurationSteps * 0.26));
        const minGapSteps = Math.max(14, Math.round(cooldownCfgSteps * 1.25) + 10);
        const secondSeqTriggerStep = Math.max(
          firstSeqTriggerStep + minGapSteps,
          Math.round(biomeDurationSteps * 0.68)
        );

        let stageStepData = undefined;
        let stageNoteKin = undefined;
        let stepYForThisGap = diff.stepY;

        if (isStageMode && sim.activeStage && compiledStageSteps.length > 0) {
          const prevDurKin = computeNoteDurationKinematics(
            sim.activeStage.bpm,
            sim.nextStagePlatformDurRatio || 1.0
          );
          stepYForThisGap = prevDurKin.stepY;

          stageStepData =
            compiledStageSteps[sim.stageStepCursor % compiledStageSteps.length];
          sim.stageStepCursor++;
          stageNoteKin = computeNoteDurationKinematics(
            sim.activeStage.bpm,
            stageStepData.durationBeats
          );
          sim.nextStagePlatformDurRatio = stageNoteKin.beatDurationRatio;

          if (stageStepData.isChordGateTrigger && sim.chordGatePlan.nextGateStepIndex < 0) {
            sim.chordGatePlan.nextGateStepIndex = sim.platformsGeneratedCount;
            sim.chordGatePlan.nextGateChordIdx = 0;
            sim.chordGatePlan.progressionVariant = 0;
            sim.chordGatePlan.prevGatePlatId = undefined;
            sim.chordGatePlan.sequenceNumberInBiome = 1;
          }
        }

        // 2 Chord Gate sequences per biome:
        // - Sequence 1 spawns around the middle-early part of the biome
        // - Sequence 2 spawns after `minGapSteps` (synced with `chordGateCooldownSteps`), and completing its 4th gate shifts to the next biome!
        if (!isStageMode && sim.chordGatePlan.nextGateStepIndex < 0) {
          if (
            sim.chordSequencesSpawnedInBiome === 0 &&
            sim.biomeStepsGenerated >= firstSeqTriggerStep
          ) {
            sim.chordSequencesSpawnedInBiome = 1;
            sim.chordGatePlan.nextGateStepIndex = sim.platformsGeneratedCount + 1;
            sim.chordGatePlan.nextGateChordIdx = 0;
            sim.chordGatePlan.progressionVariant = isCuratedMelodyMode
              ? sim.activeCuratedMelody?.chordVariant ?? 0
              : Math.floor(Math.random() * 4);
            sim.chordGatePlan.prevGatePlatId = undefined;
            sim.chordGatePlan.sequenceNumberInBiome = 1;
          } else if (
            sim.chordSequencesSpawnedInBiome === 1 &&
            sim.biomeStepsGenerated >= secondSeqTriggerStep
          ) {
            sim.chordSequencesSpawnedInBiome = 2;
            sim.chordGatePlan.nextGateStepIndex = sim.platformsGeneratedCount + 1;
            sim.chordGatePlan.nextGateChordIdx = 0;
            sim.chordGatePlan.progressionVariant = isCuratedMelodyMode
              ? ((sim.activeCuratedMelody?.chordVariant ?? 0) + 1) % 4
              : Math.floor(Math.random() * 4);
            sim.chordGatePlan.prevGatePlatId = undefined;
            sim.chordGatePlan.sequenceNumberInBiome = 2;
          } else if (sim.chordSequencesSpawnedInBiome >= 2) {
            if (sim.chordGatePlan.cooldownSteps > 0) {
              sim.chordGatePlan.cooldownSteps--;
            } else {
              // If player missed the 2nd sequence, re-offer Sequence 2 after cooldown so they can trigger the biome shift!
              sim.chordGatePlan.nextGateStepIndex = sim.platformsGeneratedCount + 2;
              sim.chordGatePlan.nextGateChordIdx = 0;
              sim.chordGatePlan.progressionVariant = isCuratedMelodyMode
                ? sim.activeCuratedMelody?.chordVariant ?? 0
                : Math.floor(Math.random() * 4);
              sim.chordGatePlan.prevGatePlatId = undefined;
              sim.chordGatePlan.sequenceNumberInBiome = 2;
            }
          }
        }

        const isChordGateStep =
          sim.chordGatePlan.nextGateStepIndex === sim.platformsGeneratedCount;

        const widthJitter = isChordGateStep ? 1.08 : 0.92 + Math.random() * 0.16;
        const w = Math.max(
          48,
          Math.round((diff.targetPlatformWidth + charPerks.platformWidthBonusPx) * widthJitter)
        );

        const prevPlatCenterX = prevCenterX;
        const prevPlatY = lastY;

        const placed = computeScatteredPlatformPlacement(
          prevCenterX,
          lastY,
          stepYForThisGap,
          w,
          sim.flowEnergy + (isChordGateStep ? Math.min(10, sim.flowEnergy * 0.35) : 0),
          sim.nextPlatformId,
          fine,
          isStageMode && !isChordGateStep
        );
        const x = placed.x;
        lastY = placed.y;
        prevCenterX = placed.centerX;

        const altitudePx = Math.abs(lastY - 782);
        const themeIdx = sim.activeBiomeIdx;
        const allBiomes = getAllBiomes(currentCfg.customBiomes);
        const biome =
          stageStepData?.biomeId !== undefined
            ? allBiomes.find((b) => b.id === stageStepData.biomeId) ||
              getScaleByIndex(themeIdx, currentCfg)
            : getScaleByIndex(themeIdx, currentCfg);

        // Evaluate Curated Melody step if active
        let curatedStepOut: ReturnType<typeof evaluateCuratedMelodyStep> | undefined = undefined;
        if (isCuratedMelodyMode) {
          const melodyForBiome =
            sim.activeCuratedMelody?.biomeId === biome.id
              ? sim.activeCuratedMelody
              : pickRandomCuratedMelodyForBiome(
                  biome.id,
                  currentCfg.disabledMelodies,
                  undefined,
                  currentCfg.customBiomes
                );
          curatedStepOut = evaluateCuratedMelodyStep(
            melodyForBiome,
            biome,
            sim.curatedMelodyStepCursor++,
            sim.combo,
            currentCfg
          );
        }

        let type: PlatformArchetype = 'normal';
        let chordGateIndex: 0 | 1 | 2 | 3 | undefined = undefined;
        let chordProgressionVariant: number | undefined = undefined;
        let chordNameOverride: string | undefined = undefined;

        if (isChordGateStep) {
          type = 'chord_gate';
          chordGateIndex = sim.chordGatePlan.nextGateChordIdx;
          chordProgressionVariant =
            curatedStepOut?.chordProgressionVariant ??
            sim.chordGatePlan.progressionVariant;
          const prog = pickBiomeChordProgression(biome, chordProgressionVariant);
          chordNameOverride = prog.chordNames[chordGateIndex];
        } else if (!isStageMode) {
          // Check active consecutive Fragile Streak first!
          if (sim.fragileStreakRemaining > 0 && altitudePx > 600) {
            type = 'crumble';
            sim.fragileStreakRemaining--;
          } else {
            const roll = Math.random();
            if (roll < diff.movingPlatformChance) {
              type = 'moving';
            } else if (altitudePx > 450 && roll < diff.movingPlatformChance + 0.09) {
              type = 'bounce';
            } else if (
              altitudePx > 650 &&
              prevType !== 'phase' &&
              roll < diff.movingPlatformChance + 0.09 + diff.fragilePlatformChance
            ) {
              type = 'crumble';
              if (
                diff.fragileStreakMaxLen >= 2 &&
                Math.random() < diff.fragileStreakChance
              ) {
                sim.fragileStreakRemaining =
                  1 + Math.floor(Math.random() * (diff.fragileStreakMaxLen - 1));
              }
            } else if (
              altitudePx > 1400 &&
              prevType !== 'phase' &&
              prevType !== 'crumble' &&
              roll < diff.movingPlatformChance + 0.09 + diff.fragilePlatformChance + 0.06
            ) {
              type = 'phase';
            }
          }
        } else {
          const roll = Math.random();
          if (roll < diff.movingPlatformChance * 0.65) {
            type = 'moving';
          }
        }
        prevType = type;

        const noteScaleIdx = Math.floor(
          (sim.nextPlatformId * 3 + Math.floor(x / 50)) % Math.max(1, biome.noteNames.length)
        );
        const noteName =
          stageStepData?.label ||
          curatedStepOut?.label ||
          biome.noteNames[noteScaleIdx] ||
          'C4';
        const noteFreq =
          stageStepData?.freqs?.[0] ||
          curatedStepOut?.freqs?.[0] ||
          biome.scale[noteScaleIdx % Math.max(1, biome.scale.length)] ||
          261.63;

        // Multi-Spike Clusters at higher Flow (2, 3, 4, 5, 6, up to 7 spikes)
        const spikeCount =
          2 + Math.floor(Math.random() * Math.max(1, (diff.maxSpikeCount || 2) - 1));
        const hazardWidth = spikeCount * 9;
        const hasHazard =
          type === 'normal' &&
          w >= Math.max(64, hazardWidth + 24) &&
          altitudePx > 900 &&
          Math.random() < diff.platformHazardChance;

        const moveSpeedMult = Math.max(0.3, fine.enemyMoveSpeedMult ?? 1.35);
        const moveRangeMult = Math.max(0.3, fine.enemyMoveRangeMult ?? 1.3);
        const movePlatSpeed = Number((1.15 * moveSpeedMult).toFixed(2));
        const movePlatHalfRange = Math.round(70 * moveRangeMult);

        // Moving + Fragile platforms: allow `crumble` (and `disguised_fragile`) platforms to also move horizontally at higher Flow!
        const isMovingFragile =
          type === 'crumble' &&
          altitudePx > 750 &&
          Math.random() < diff.movingFragileChance;
        const shouldMoveHorizontally = type === 'moving' || isMovingFragile;

        const platId = sim.nextPlatformId++;
        const plat: PlatformEntity = {
          id: platId,
          x,
          y: lastY,
          w,
          targetW: w,
          centerX: prevCenterX,
          h: 14,
          type,
          vx: shouldMoveHorizontally
            ? Math.random() > 0.5
              ? movePlatSpeed
              : -movePlatSpeed
            : 0,
          vy: 0,
          minX: Math.max(14, x - movePlatHalfRange),
          maxX: Math.min(586 - w, x + movePlatHalfRange),
          hit: false,
          repeatBounces: 0,
          themeIdx,
          noteLabel: noteName,
          noteFreq,
          crumbleTimer: 0,
          broken: false,
          respawnTimer: 0,
          phaseSolid: true,
          hasHazard,
          hazardXOffset: hasHazard
            ? Math.max(8, Math.min(w - hazardWidth - 8, Math.round((w - hazardWidth) * (0.28 + Math.random() * 0.44))))
            : 0,
          hazardWidth: hasHazard ? hazardWidth : 0,
          spikeCount: hasHazard ? spikeCount : undefined,
          chordGateIndex,
          chordProgressionVariant,
          chordNameOverride,
          beatDurationRatio: stageNoteKin?.beatDurationRatio,
          customStepY: stageNoteKin?.stepY,
          customJumpVelocityPxPerSec: stageNoteKin?.jumpVelocityPxPerSec,
          customGravityPxPerSec2: stageNoteKin?.gravityPxPerSec2,
          customClusterFreqs: stageStepData?.freqs || curatedStepOut?.freqs,
          tripletFreqs: curatedStepOut?.tripletFreqs,
          customSynthFreqs: stageStepData?.synthFreqs,
          customSynthDurationSec: stageStepData
            ? stageStepData.synthDurationBeats * (60 / Math.max(60, sim.activeStage?.bpm || 100))
            : undefined,
          customBiomeId: stageStepData?.biomeId,
          disguisedFragile:
            type === 'crumble' && Math.random() < diff.disguisedFragileChance,
        };

        if (isChordGateStep) {
          if (sim.chordGatePlan.prevGatePlatId !== undefined) {
            const prevGate = sim.platforms.find(
              (pl) => pl.id === sim.chordGatePlan.prevGatePlatId
            );
            if (prevGate) {
              prevGate.nextGateId = platId;
              prevGate.nextGateX = prevCenterX;
              prevGate.nextGateY = lastY;
            }
          }

          if (sim.chordGatePlan.nextGateChordIdx < 3) {
            sim.chordGatePlan.prevGatePlatId = platId;
            sim.chordGatePlan.nextGateChordIdx = (sim.chordGatePlan.nextGateChordIdx + 1) as
              | 0
              | 1
              | 2
              | 3;
            // Scatter Chord Gate steps wider apart as Flow increases so gates aren't stacked right after each other
            const gateStepGap = 4 + Math.min(4, Math.floor(sim.flowEnergy / 7));
            sim.chordGatePlan.nextGateStepIndex = sim.platformsGeneratedCount + gateStepGap;
          } else {
            sim.chordGatePlan.nextGateStepIndex = -1;
            sim.chordGatePlan.nextGateChordIdx = 0;
            sim.chordGatePlan.progressionVariant = isCuratedMelodyMode
              ? sim.activeCuratedMelody?.chordVariant ?? 0
              : Math.floor(Math.random() * 4);
            sim.chordGatePlan.prevGatePlatId = undefined;
            sim.chordGatePlan.cooldownSteps = Math.max(
              4,
              Math.round(fine.chordGateCooldownSteps)
            );
          }
        }

        sim.platforms.push(plat);

        // Place Aerial Drone Enemies directly in the player's navigation trajectory between `prevPlatCenterX` and `prevCenterX`!
        if (
          !isChordGateStep &&
          altitudePx > 750 &&
          Math.random() < diff.aerialHazardChance
        ) {
          const navMidX = (prevPlatCenterX + prevCenterX) * 0.5;
          const hazardX = Math.max(
            42,
            Math.min(558, Math.round(navMidX + (Math.random() - 0.5) * 44))
          );
          const hazardY = Math.round(
            lastY + (prevPlatY - lastY) * (0.36 + Math.random() * 0.26)
          );
          sim.aerialHazards.push({
            id: sim.nextPlatformId++,
            x: hazardX,
            y: hazardY,
            vx: (Math.random() < 0.5 ? 1 : -1) * diff.enemySpeedPxPerSec,
            minX: Math.max(24, hazardX - diff.enemyHalfRangePx),
            maxX: Math.min(576, hazardX + diff.enemyHalfRangePx),
            radius: 11,
            active: true,
            phase: Math.random() * Math.PI * 2,
          });
        }

        // Spawn rare mid-air Heart Health Pickups ONLY after the character has taken damage (`canSpawnHeartPickup`)!
        if (
          !isChordGateStep &&
          altitudePx > 850 &&
          canSpawnHeartPickup(sim.player.hp, sim.player.maxHp) &&
          Math.random() < diff.heartPickupChance
        ) {
          const heartX = Math.max(
            48,
            Math.min(
              552,
              Math.round((prevPlatCenterX + prevCenterX) * 0.5 + (Math.random() - 0.5) * 140)
            )
          );
          const heartY = Math.round(lastY - 36 - Math.random() * 54);
          sim.heartPickups.push({
            id: sim.nextPlatformId++,
            x: heartX,
            y: heartY,
            baseY: heartY,
            radius: 9,
            collected: false,
            healAmount: 1,
            phase: Math.random() * Math.PI * 2,
          });
        }

        // Diverse Aerial, Gap-Arc, and Wall-Bounce Orb Placement at varied heights!
        const orbChance = Math.max(0, Math.min(1, fine.orbSpawnRate));
        if (Math.random() < orbChance) {
          const orbFreq =
            curatedStepOut?.tripletFreqs?.[1] ||
            biome.scale[Math.floor(Math.random() * biome.scale.length)];
          const spread = Math.max(0.1, Math.min(1.0, fine.orbScatterSpread));
          const placementRoll = Math.random();
          let orbX = prevCenterX;
          let orbY = lastY - 40;

          if (placementRoll < 0.36) {
            // 1) Mid-air jump arc between previous platform and current platform
            const arcT = 0.32 + Math.random() * 0.38;
            orbX = Math.max(
              38,
              Math.min(
                562,
                prevPlatCenterX + (prevCenterX - prevPlatCenterX) * arcT + (Math.random() - 0.5) * 42 * spread
              )
            );
            orbY = Math.round(
              lastY + (prevPlatY - lastY) * (0.25 + Math.random() * 0.45) - (28 + Math.random() * 44)
            );
          } else if (placementRoll < 0.6) {
            // 2) Far off-platform / Wall-Dash & Wall-Bounce zone near left or right arena wall
            const nearLeftWall =
              prevCenterX < 260 ? true : prevCenterX > 340 ? false : Math.random() < 0.5;
            orbX = nearLeftWall
              ? Math.round(30 + Math.random() * 34)
              : Math.round(536 + Math.random() * 34);
            orbY = Math.round(lastY - 48 - Math.random() * 52);
          } else {
            // 3) Varied high/low aerial elevation around platform corridor
            const offsetRatio = 0.5 + (Math.random() - 0.5) * spread * 1.45;
            orbX = Math.max(36, Math.min(564, x + w * offsetRatio));
            orbY = Math.round(lastY - 32 - Math.random() * 68);
          }

          sim.orbs.push({
            id: sim.nextPlatformId++,
            x: orbX,
            y: orbY,
            baseY: orbY,
            radius: 6,
            collected: false,
            freq: orbFreq,
            color: biome.horizonColor,
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
    },
    [getScaleByIndex]
  );

  const startNewRun = useCallback(
    (
      modeOverride?: GameMode,
      customSeq?: number[][],
      fromUserGesture = true,
      stageOverride?: CustomStage
    ) => {
      const sim = simRef.current;
      const activeMode = stageOverride ? 'STAGE' : modeOverride || sim.mode;
      sim.mode = activeMode;
      setGameMode(activeMode);

      if (stageOverride) {
        sim.activeStage = stageOverride;
      } else if (activeMode !== 'STAGE') {
        sim.activeStage = undefined;
      }

      if (customSeq && customSeq.length > 0) {
        sim.seqData = customSeq;
      }

      audioRef.current.resetMusicalState();
      if (activeMode !== 'STANDARD') {
        audioRef.current.stopChoir();
      }

      if (!sim.isMuted && fromUserGesture) {
        audioRef.current.init(sim.cfg);
        audioRef.current.resume();
      }

      if (fromUserGesture && window.innerWidth < 768) {
        const docEl = document.documentElement as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void>;
        };
        if (!document.fullscreenElement) {
          if (docEl.requestFullscreen) {
            docEl.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
          } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen().catch(() => {});
          }
        }
      }

      const fine = sim.cfg.fineTune || DEFAULT_FINE_TUNE;
      const charPerks = getCharacterById(sim.cfg.playerShape).perks;
      const dashMods = computePassiveDashUpgrades(
        sim.cfg.powerUpLevels,
        sim.cfg.equippedPowerUps
      );

      if (activeMode === 'STAGE' && sim.activeStage) {
        sim.biomeOrder = [sim.activeStage.biomeId];
        sim.activeSoundBankId = sim.activeStage.soundBankId;
      } else {
        const customBiomeIds = (sim.cfg.customBiomes || []).map((cb) => cb.id);
        const enabledScales = Array.from(
          new Set([
            ...(sim.cfg.enabledScales.length ? sim.cfg.enabledScales : [0]),
            ...customBiomeIds,
          ])
        );
        const menuMelBiomeId =
          sim.activeCuratedMelody && enabledScales.includes(sim.activeCuratedMelody.biomeId)
            ? sim.activeCuratedMelody.biomeId
            : enabledScales[0];
        const otherBiomes = shuffleArray(enabledScales.filter((id) => id !== menuMelBiomeId));
        sim.biomeOrder = [menuMelBiomeId, ...otherBiomes];
        sim.activeSoundBankId = sim.activeSoundBankId || pickRandomEnabledSoundBankId(sim.cfg);
      }

      const baseBpm =
        activeMode === 'STAGE' && sim.activeStage
          ? sim.activeStage.bpm
          : fine.baseJumpTempo || 100;
      const kin = computeBpmLockedKinematics(baseBpm, 1.0);
      const startBiome = getScaleByIndex(0, sim.cfg);
      const initialDiff = computeFlowDynamicDifficulty(0, fine);
      const startMelody =
        sim.activeCuratedMelody && sim.activeCuratedMelody.biomeId === startBiome.id
          ? sim.activeCuratedMelody
          : pickRandomCuratedMelodyForBiome(
              startBiome.id,
              sim.cfg.disabledMelodies,
              undefined,
              sim.cfg.customBiomes
            );

      sim.score = 0;
      sim.maxFlowThisRun = 0;
      sim.orbsThisRun = 0;
      sim.flowEnergy = 0;
      sim.combo = 0;
      sim.flowSubSteps = 0;
      sim.timeSinceLastClimb = 0;
      sim.highestPlatformY = 782;
      sim.styleMeter = 0;
      sim.camY = 800 - (sim.viewH || 800);
      sim.gameTime = 0;
      sim.hitstop = 0;
      sim.shake = 0;
      sim.aberration = 0;
      sim.activeBiomeIdx = 0;
      sim.activeCuratedMelody = startMelody;
      sim.curatedMelodyStepCursor = sim.menuMelodyCursor || 0;
      sim.fragileStreakRemaining = 0;
      sim.biomeDissolve = {
        active: false,
        progress: 1,
        fromBiome: startBiome,
        toBiome: startBiome,
      };
      sim.dyingSequence = {
        active: false,
        phase: 'none',
        timer: 0,
        dissolveProgress: 0,
        glitters: [],
      };
      sim.seqIdx = 0;
      sim.stageStepCursor = 0;
      sim.nextStagePlatformDurRatio = 1.0;
      sim.activeJumpGravity = kin.gravityPxPerSec2;
      sim.shieldRegenTimer = 0;
      sim.activePowerUps = [];
      sim.pendingRhythmRings = [];
      sim.activeChordChainTargetId = undefined;
      sim.chordComboHud = {
        active: false,
        completedCount: 0,
        chordNames: startBiome.chordNames,
        completionFlashTimer: 0,
      };
      sim.recentPlayedPlatformNotes = [startBiome.scale[0] || 261.63];
      sim.platformsGeneratedCount = 0;
      sim.biomeStepsGenerated = 0;
      sim.chordSequencesSpawnedInBiome = 0;
      sim.chordSequencesCompletedInBiome = 0;
      sim.chordGatePlan = {
        nextGateStepIndex: -1,
        nextGateChordIdx: 0,
        progressionVariant: startMelody.chordVariant ?? Math.floor(Math.random() * 4),
        prevGatePlatId: undefined,
        cooldownSteps: Math.max(4, Math.round(fine.chordGateCooldownSteps * 0.6)),
        sequenceNumberInBiome: 1,
      };

      // Initialize Equipped Power-Up Loadout Slots (ACTIVE slots ALWAYS sorted above PASSIVE slots in gameplay HUD!)
      const maxSlots = computeUnlockedPowerUpSlots(stats.highScore, sim.cfg.playerLevel);
      const equippedIds = sortEquippedPowerUpsActiveFirst(
        sim.cfg.equippedPowerUps && sim.cfg.equippedPowerUps.length > 0
          ? sim.cfg.equippedPowerUps
          : (['combo_shield'] as PowerUpItemId[])
      ).slice(0, maxSlots);

      sim.equippedSlotRuntimes = equippedIds
        .map((id, idx): EquippedPowerUpSlotRuntime | null => {
          const item = getPowerUpItemById(id);
          if (!item) return null;
          const lv = Math.max(1, Number(sim.cfg.powerUpLevels?.[id] || 1));
          const st = getPowerUpLevelStats(id, lv);
          if (item.activationMode === 'PASSIVE') {
            return {
              id: item.id,
              name: item.name,
              icon: item.icon,
              accentColor: item.accentColor,
              activationMode: 'PASSIVE',
              level: lv,
              usesLeft: 99,
              maxUses: 99,
              phase: 'active',
              chargeProgress: 1,
              chargeTimeSec: 0,
              cooldownSec: 0,
              durationSec: 9999,
              activeRemainingSec: 9999,
              powerValue: st.powerValue,
            };
          }
          const initialChargeTime = Math.max(
            2.0,
            Number((st.cooldownSec * 0.34 + idx * 0.5).toFixed(2))
          );
          return {
            id: item.id,
            name: item.name,
            icon: item.icon,
            accentColor: item.accentColor,
            activationMode: item.activationMode,
            level: lv,
            usesLeft: st.usesPerRun,
            maxUses: st.usesPerRun,
            phase: 'charging',
            chargeProgress: 0,
            chargeTimeSec: initialChargeTime,
            cooldownSec: st.cooldownSec,
            durationSec: st.durationSec,
            activeRemainingSec: 0,
            powerValue: st.powerValue,
          };
        })
        .filter((x): x is EquippedPowerUpSlotRuntime => x !== null);

      sim.jetpackGlitters = [];
      sim.jetpackNoteTimer = 0;
      sim.jetpackStepCounter = 0;
      sim.platformsClimbedCount = 0;
      sim.heartPickups = [];

      const totalMaxHp = Math.max(1, (charPerks.maxHealth || 3) + dashMods.bonusMaxHp);
      sim.player.maxHp = totalMaxHp;
      sim.player.hp = totalMaxHp;
      sim.player.x = 288;
      sim.player.y = 782 - sim.player.h;
      sim.player.vx = 0;
      sim.player.vy = kin.jumpVelocityPxPerSec;
      sim.player.grounded = false;
      sim.player.wallSlideDir = 0;
      sim.player.scaleX = 0.72;
      sim.player.scaleY = 1.32;
      sim.player.impactSquashTimer = 0;
      sim.player.dashCool = 0;
      sim.player.dashMaxCool =
        1.8 * charPerks.dashCooldownMultiplier * dashMods.cooldownMultiplier;
      sim.player.dashAct = 0;
      sim.player.hasShield = charPerks.startWithShield;
      sim.player.doubleJumpReady = charPerks.permanentAirJump;
      sim.player.damageGlitchTimer = 0;
      sim.player.airJumpsLeft = charPerks.permanentAirJump ? 1 : 0;
      sim.player.wallDashGraceTimer = 0;
      sim.player.wallBounceCooldownPenaltyActive = false;
      sim.player.trail = [];
      sim.player.scarfNodes = Array.from({ length: 6 }, () => ({ x: 300, y: 760 }));

      if (charPerks.startWithShield) {
        sim.activePowerUps.push({
          id: 'combo_shield',
          name: 'Aegis Shield',
          icon: '🛡',
          remainingSec: 25,
          durationSec: 25,
        });
      }

      sim.inputs.left = false;
      sim.inputs.right = false;
      sim.inputs.tiltX = 0;
      sim.inputs.touchSteerX = 0;
      sim.inputs.upJustPressed = false;
      sim.inputs.dashJustPressed = false;
      touchDragRef.current.active = false;

      const firstStepW = initialDiff.targetPlatformWidth + charPerks.platformWidthBonusPx;
      const firstStepX = Math.random() < 0.5 ? 95 : 325;

      let firstStepY = 782 - initialDiff.stepY;
      let firstStagePlatFields: Partial<PlatformEntity> = {};

      if (activeMode === 'STAGE' && sim.activeStage) {
        const compiled = compileStageForGameplay(sim.activeStage, 0);
        const firstStep = compiled[0];
        if (firstStep) {
          const firstDurKin = computeNoteDurationKinematics(
            sim.activeStage.bpm,
            firstStep.durationBeats
          );
          sim.stageStepCursor = 1;
          sim.nextStagePlatformDurRatio = firstDurKin.beatDurationRatio;
          firstStagePlatFields = {
            noteLabel: firstStep.label,
            noteFreq: firstStep.freqs[0] || 261.63,
            beatDurationRatio: firstDurKin.beatDurationRatio,
            customStepY: firstDurKin.stepY,
            customJumpVelocityPxPerSec: firstDurKin.jumpVelocityPxPerSec,
            customGravityPxPerSec2: firstDurKin.gravityPxPerSec2,
            customClusterFreqs: firstStep.freqs,
            customSynthFreqs: firstStep.synthFreqs,
            customSynthDurationSec:
              firstStep.synthDurationBeats * (60 / Math.max(60, sim.activeStage.bpm)),
            customBiomeId: firstStep.biomeId,
          };
        }
      } else if (activeMode === 'STANDARD' && (sim.cfg.melodyMode ?? 'curated') === 'curated') {
        const step0 = evaluateCuratedMelodyStep(
          sim.activeCuratedMelody,
          startBiome,
          sim.curatedMelodyStepCursor++,
          0,
          sim.cfg
        );
        firstStagePlatFields = {
          noteLabel: step0.label,
          noteFreq: step0.freqs[0] || 311.13,
          customClusterFreqs: step0.freqs,
          tripletFreqs: step0.tripletFreqs,
        };
      }

      sim.platforms = [
        {
          id: 1,
          x: 12,
          y: 770,
          w: 576,
          targetW: 576,
          centerX: 300,
          h: 16,
          type: 'normal',
          vx: 0,
          vy: 0,
          minX: 0,
          maxX: 600,
          hit: true,
          repeatBounces: 0,
          themeIdx: 0,
          noteLabel: `${startBiome.noteNames[0] || 'C4'}`,
          noteFreq: startBiome.scale[0] || 261.63,
          crumbleTimer: 0,
          broken: false,
          respawnTimer: 0,
          phaseSolid: true,
        },
        {
          id: 2,
          x: firstStepX,
          y: firstStepY,
          w: firstStepW,
          targetW: firstStepW,
          centerX: firstStepX + firstStepW * 0.5,
          h: 14,
          type: 'normal',
          vx: 0,
          vy: 0,
          minX: 0,
          maxX: 600,
          hit: false,
          repeatBounces: 0,
          themeIdx: 0,
          noteLabel: startBiome.noteNames[2] || 'Eb4',
          noteFreq: startBiome.scale[2] || 311.13,
          crumbleTimer: 0,
          broken: false,
          respawnTimer: 0,
          phaseSolid: true,
          ...firstStagePlatFields,
        },
      ];
      sim.aerialHazards = [];
      sim.orbs = [
        {
          id: 3,
          x: firstStepX + firstStepW * 0.5,
          y: firstStepY - 40,
          baseY: firstStepY - 40,
          radius: 6,
          collected: false,
          freq: startBiome.scale[4] || 523.25,
          color: startBiome.horizonColor,
          phase: 0,
        },
      ];
      sim.nextPlatformId = 10;
      sim.particles.clear();
      sim.shockwaves = [];
      sim.texts.forEach((t) => (t.active = false));

      generateWorldUpTo(sim.camY - 450);

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setScreen('playing');
    },
    [generateWorldUpTo, getScaleByIndex, pickRandomEnabledSoundBankId, stats.highScore]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      startNewRun('STANDARD', undefined, false);
    } else {
      simRef.current.biomeOrder = shuffleArray(
        simRef.current.cfg.enabledScales.length ? simRef.current.cfg.enabledScales : [0]
      );
      generateWorldUpTo(-600);
    }
  }, [startNewRun, generateWorldUpTo]);

  // Keyboard & Blur Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const sim = simRef.current;

      if (!sim.isMuted && audioRef.current.ctx?.state === 'suspended') {
        audioRef.current.resume();
      }

      if (e.code === 'KeyM') {
        setIsMuted((m) => !m);
        return;
      }

      if (sim.state === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startNewRun('STANDARD');
        }
        return;
      }

      if (sim.state === 'gameover') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          setGameOverAnimElapsed((prev) => {
            if (prev < 1.85) return 9.9;
            startNewRun(sim.mode, undefined, true, sim.activeStage);
            return prev;
          });
          return;
        }
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (sim.state === 'playing') {
          audioRef.current.stopChoir();
          setScreen('paused');
        } else if (sim.state === 'paused') {
          if (!sim.isMuted) audioRef.current.resume();
          setScreen('playing');
        }
        return;
      }

      if (
        e.code === 'KeyR' &&
        (sim.state === 'playing' || sim.state === 'paused' || sim.state === 'gameover')
      ) {
        startNewRun(sim.mode, undefined, true, sim.activeStage);
        return;
      }

      if (sim.state !== 'playing') return;

      if (e.code.startsWith('Digit')) {
        const digit = parseInt(e.code.replace('Digit', ''), 10);
        if (digit >= 1 && digit <= 7) {
          activateEquippedPowerUpSlot(digit - 1);
          return;
        }
      }

      if (e.key === 'ArrowLeft' || e.code === 'KeyA') sim.inputs.left = true;
      if (e.key === 'ArrowRight' || e.code === 'KeyD') sim.inputs.right = true;
      if (e.key === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
        e.preventDefault();
        sim.inputs.upJustPressed = true;
      }
      if (e.key === 'Shift' || e.code === 'KeyK' || e.code === 'KeyX') {
        sim.inputs.dashJustPressed = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const sim = simRef.current;
      if (e.key === 'ArrowLeft' || e.code === 'KeyA') sim.inputs.left = false;
      if (e.key === 'ArrowRight' || e.code === 'KeyD') sim.inputs.right = false;
    };

    const clearInputs = () => {
      const sim = simRef.current;
      sim.inputs.left = false;
      sim.inputs.right = false;
      sim.inputs.touchSteerX = 0;
      sim.inputs.upJustPressed = false;
      sim.inputs.dashJustPressed = false;
      touchDragRef.current.active = false;
    };

    let lastAccelTime = 0;
    let smoothedRawTilt = 0;

    // Primary Low-Latency Hardware Gravity Sensor (60Hz direct accelerometer on Android)
    const onDeviceMotion = (e: DeviceMotionEvent) => {
      const sim = simRef.current;
      if (sim.cfg.tiltControlEnabled === false) {
        sim.inputs.tiltX = 0;
        return;
      }
      const ag = e.accelerationIncludingGravity;
      if (!ag || typeof ag.x !== 'number') return;

      lastAccelTime = performance.now();
      const angle =
        typeof window.screen?.orientation?.angle === 'number'
          ? window.screen.orientation.angle
          : 0;
      let rawG = -ag.x;
      if (angle === 90 && typeof ag.y === 'number') rawG = ag.y;
      else if ((angle === -90 || angle === 270) && typeof ag.y === 'number') rawG = -ag.y;

      smoothedRawTilt = smoothedRawTilt * 0.25 + rawG * 0.75;

      const deadzoneG = 0.16;
      const maxTiltDeg = Math.max(
        6,
        Math.min(35, sim.cfg.fineTune?.mobileTiltMaxAngleDeg ?? 18)
      );
      const maxG = Math.max(0.85, (maxTiltDeg / 90) * 9.81);
      if (Math.abs(smoothedRawTilt) <= deadzoneG) {
        sim.inputs.tiltX = 0;
      } else {
        const sign = smoothedRawTilt > 0 ? 1 : -1;
        const linear = Math.min(1, (Math.abs(smoothedRawTilt) - deadzoneG) / Math.max(0.3, maxG - deadzoneG));
        const curved = Math.pow(linear, 0.92);
        sim.inputs.tiltX = Number((sign * curved).toFixed(3));
      }
    };

    // Fallback Orientation Sensor (used only if hardware devicemotion is unavailable)
    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      const sim = simRef.current;
      if (sim.cfg.tiltControlEnabled === false) {
        sim.inputs.tiltX = 0;
        return;
      }
      if (performance.now() - lastAccelTime < 160) {
        return;
      }
      const angle =
        typeof window.screen?.orientation?.angle === 'number'
          ? window.screen.orientation.angle
          : 0;
      let rawDeg = e.gamma ?? 0;
      if (angle === 90 && e.beta !== null) rawDeg = e.beta;
      else if (angle === -90 || angle === 270) rawDeg = -(e.beta ?? 0);

      const deadzoneDeg = 1.0;
      const maxTiltDeg = Math.max(
        6,
        Math.min(35, sim.cfg.fineTune?.mobileTiltMaxAngleDeg ?? 18)
      );
      if (Math.abs(rawDeg) <= deadzoneDeg) {
        sim.inputs.tiltX = 0;
      } else {
        const sign = rawDeg > 0 ? 1 : -1;
        const linear = Math.min(1, (Math.abs(rawDeg) - deadzoneDeg) / Math.max(2, maxTiltDeg - deadzoneDeg));
        const curved = Math.pow(linear, 0.92);
        sim.inputs.tiltX = Number((sign * curved).toFixed(3));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    window.addEventListener('devicemotion', onDeviceMotion, { passive: true });
    window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      window.removeEventListener('devicemotion', onDeviceMotion);
      window.removeEventListener('deviceorientation', onDeviceOrientation);
    };
  }, [startNewRun]);

  // Main 60Hz Simulation & Render Loop
  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();

    const hasPowerUp = (id: ActivePowerUp['id']) =>
      simRef.current.activePowerUps.some((p) => p.id === id);

    const stepSimulation = (dt: number) => {
      const sim = simRef.current;
      const c = sim.cfg;
      const fine = c.fineTune || DEFAULT_FINE_TUNE;
      const charPerks = getCharacterById(c.playerShape).perks;
      sim.gameTime += dt;

      // Poll Gamepad API
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = gamepads[0];
      if (gp && sim.state === 'playing' && !sim.dyingSequence.active) {
        const axisX = gp.axes[0] || 0;
        if (axisX < -0.25 || gp.buttons[14]?.pressed) sim.inputs.left = true;
        else if (axisX > 0.25 || gp.buttons[15]?.pressed) sim.inputs.right = true;
        if (gp.buttons[2]?.pressed || gp.buttons[5]?.pressed) {
          sim.inputs.dashJustPressed = true;
        }
      }

      const currentBiomeIdx =
        sim.mode === 'STAGE' && sim.activeStage ? 0 : sim.activeBiomeIdx;
      const biome = getScaleByIndex(currentBiomeIdx, c);

      if (sim.biomeDissolve.active) {
        const shiftSpeedMult = Math.max(0.2, fine.biomeShiftSpeed ?? 1.2);
        sim.biomeDissolve.progress += dt * 0.56 * shiftSpeedMult;
        if (sim.biomeDissolve.progress >= 1) {
          sim.biomeDissolve.progress = 1;
          sim.biomeDissolve.active = false;
        }
      }

      // Compute 5-Note Harmonic Context for Synthesizer
      const playedHist = sim.recentPlayedPlatformNotes;
      const currentNoteFreq =
        playedHist.length > 0 ? playedHist[playedHist.length - 1] : biome.scale[0];
      const prevTwoFreqs = playedHist.slice(
        Math.max(0, playedHist.length - 3),
        Math.max(0, playedHist.length - 1)
      );
      const nextTwoFreqs: number[] = [];
      for (let i = 0; i < sim.platforms.length; i++) {
        const pl = sim.platforms[i];
        if (!pl.broken && pl.y < sim.player.y - 8 && pl.noteFreq) {
          nextTwoFreqs.push(pl.noteFreq);
          if (nextTwoFreqs.length >= 2) break;
        }
      }

      const { beatPulse: ambientPulse } = audioRef.current.tickRhythmAndStems(
        sim.gameTime,
        sim.combo,
        biome,
        c,
        sim.state === 'playing' && !sim.dyingSequence.active && !sim.isMuted,
        sim.mode === 'STAGE' ? 'MIDI' : sim.mode,
        {
          current: currentNoteFreq,
          prevTwo: prevTwoFreqs,
          nextTwo: nextTwoFreqs,
        }
      );

      // Update reactive eye tracking vector
      const p = sim.player;
      const nowMs = performance.now();
      let targetEyeX = p.facing * 0.45;
      let targetEyeY = Math.max(-0.85, Math.min(0.85, Number(p.vy) / 650));

      if (nowMs < pointerEyeRef.current.activeUntil) {
        const screenPlayerY = p.y - sim.camY;
        const dx = pointerEyeRef.current.x - (p.x + p.w * 0.5);
        const dy = pointerEyeRef.current.y - (screenPlayerY + p.h * 0.5);
        const dist = Math.hypot(dx, dy) || 1;
        targetEyeX = Math.max(-1, Math.min(1, (dx / dist) * Math.min(1, dist / 60)));
        targetEyeY = Math.max(-1, Math.min(1, (dy / dist) * Math.min(1, dist / 60)));
      } else if (Math.abs(sim.inputs.touchSteerX) > 0.04) {
        targetEyeX = sim.inputs.touchSteerX;
      } else if (Math.abs(Number(sim.inputs.tiltX)) > 0.05) {
        targetEyeX = Number(sim.inputs.tiltX);
      }

      p.eyeLookX = (p.eyeLookX ?? 0) + (targetEyeX - (p.eyeLookX ?? 0)) * Math.min(1, dt * 14);
      p.eyeLookY = (p.eyeLookY ?? 0) + (targetEyeY - (p.eyeLookY ?? 0)) * Math.min(1, dt * 14);

      if ((p.impactSquashTimer ?? 0) > 0) {
        p.impactSquashTimer = Math.max(0, (p.impactSquashTimer ?? 0) - dt);
      }

      // Continuous Muffled + Lush Reverb Background Melody on Menu, Pause, and Game Over screens!
      const menuBeatSec = 0.84;
      if (
        sim.state !== 'playing' &&
        sim.state !== 'stage_creator' &&
        sim.state !== 'sequencer'
      ) {
        sim.menuMelodyTimer += dt;
        if (sim.menuMelodyTimer >= menuBeatSec) {
          sim.menuMelodyTimer -= menuBeatSec;
          sim.menuMelodyBeatCount = (sim.menuMelodyBeatCount || 0) + 1;
          if (!sim.isMuted && audioRef.current.ctx && audioRef.current.ctx.state === 'running') {
            const activeMel = sim.activeCuratedMelody || ALL_CURATED_MELODIES[0];
            const melBiome =
              MASTER_SCALES.find((s) => s.id === activeMel.biomeId) || MASTER_SCALES[0];
            const stepEval = evaluateCuratedMelodyStep(
              activeMel,
              melBiome,
              sim.menuMelodyCursor,
              0,
              c
            );
            sim.menuMelodyCursor = (sim.menuMelodyCursor + 1) % 72;
            audioRef.current.playMenuMuffledMelodyNote(
              stepEval.freqs[0] || 261.63,
              c,
              getActiveSoundBank(c)
            );
          }
        }
        menuBeatInfoRef.current = {
          phase: Math.max(0, Math.min(1, sim.menuMelodyTimer / menuBeatSec)),
          beatCount: sim.menuMelodyBeatCount || 0,
        };
      }

      // Title / Menu screen or First-Time Tutorial idle animation (1:1 synced with menuMelodyTimer!)
      if (
        sim.state === 'title' ||
        sim.state === 'sequencer' ||
        sim.state === 'settings' ||
        sim.state === 'store' ||
        sim.state === 'characters' ||
        sim.state === 'stage_creator' ||
        sim.tutorialActive
      ) {
        const beatPhase = Math.max(0, Math.min(1, sim.menuMelodyTimer / menuBeatSec));
        const bouncePhase = Math.sin(beatPhase * Math.PI);
        sim.player.x = 288 + Math.sin(sim.gameTime * 1.4) * 45;
        sim.player.y = 758 - bouncePhase * 55;
        if (beatPhase < 0.1 || beatPhase > 0.92) {
          sim.player.scaleX = 1.32;
          sim.player.scaleY = 0.72;
        } else {
          sim.player.scaleX = 0.92 + (1 - bouncePhase) * 0.1;
          sim.player.scaleY = 1.12 - (1 - bouncePhase) * 0.12;
        }
        sim.particles.update(dt);
        return ambientPulse;
      }

      if (sim.state !== 'playing') {
        return ambientPulse;
      }

      const frameScale = dt * 60;

      // =========================================================================
      // 3-PHASE DEFEAT SEQUENCE:
      // 1) 'falling' (1.0s): Camera follows falling character downward
      // 2) 'exploding' (0.55s): Character explodes at center screen into sparkling glitters
      // 3) 'dissolving' (0.32s): Fast 16x16px pixelated dissolve into Game Over dialog
      // =========================================================================
      if (sim.dyingSequence.active) {
        sim.dyingSequence.timer += dt;

        // Keep updating particles & shockwaves during the defeat sequence
        sim.particles.update(dt);
        for (let i = 0; i < sim.shockwaves.length; i++) {
          const sw = sim.shockwaves[i];
          sw.r += (sw.maxR - sw.r) * 0.18 * frameScale;
          sw.alpha -= 0.05 * frameScale;
        }

        if (sim.shake > 0.1) {
          sim.camY += (Math.random() - 0.5) * sim.shake;
          sim.shake *= Math.pow(0.86, frameScale);
        } else {
          sim.shake = 0;
        }

        if (sim.dyingSequence.phase === 'falling') {
          // 1-Second Camera-Tracked Downward Fall (gentle drift toward center, explode wherever the character is!)
          p.vy = Math.max(p.vy, 640) + 980 * dt;
          p.y += p.vy * dt;
          p.x += (288 - p.x) * Math.min(1, dt * 1.1);
          p.x = Math.max(28, Math.min(572 - p.w, p.x));
          p.scaleX = 0.76;
          p.scaleY = 1.32;
          p.damageGlitchTimer = 0.4;

          const centerOffsetY = (sim.viewH || 800) * 0.485;
          const targetFallCamY = p.y - centerOffsetY;
          sim.camY += (targetFallCamY - sim.camY) * Math.min(1, dt * 16);

          p.trail.push({
            x: p.x + p.w * 0.5,
            y: p.y + p.h * 0.5,
            vx: p.vx,
            vy: p.vy,
          });
          if (p.trail.length > 14) p.trail.shift();

          if (sim.dyingSequence.timer >= 1.0) {
            sim.dyingSequence.phase = 'exploding';
            sim.dyingSequence.timer = 0;

            // Explode right at the character's current horizontal & vertical position!
            p.x = Math.max(28, Math.min(572 - p.w, p.x));
            p.y = sim.camY + centerOffsetY;
            const centerX = p.x + p.w * 0.5;
            const centerY = p.y + p.h * 0.5;

            if (!sim.isMuted) {
              audioRef.current.sfxPlayerShatter(biome, c);
            }
            sim.shake = 14;
            sim.aberration = 1.0;

            spawnShockwave(centerX, centerY, '#ffffff', 160);
            spawnShockwave(centerX, centerY, biome.fg, 220);
            spawnShockwave(centerX, centerY, '#f472b6', 110);

            const glitterColors = [
              '#ffffff',
              biome.fg,
              biome.horizonColor,
              '#fde047',
              '#f472b6',
              '#38bdf8',
              '#a855f7',
              '#fb7185',
            ];
            const glitters: GlitterParticle[] = [];
            for (let g = 0; g < 96; g++) {
              const angle = (Math.PI * 2 * g) / 96 + (Math.random() - 0.5) * 0.25;
              const speed = 70 + Math.random() * 420;
              const maxLife = 0.55 + Math.random() * 0.45;
              glitters.push({
                x: centerX + (Math.random() - 0.5) * 10,
                y: centerY + (Math.random() - 0.5) * 10,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 60,
                size: 3 + Math.floor(Math.random() * 5),
                color: glitterColors[g % glitterColors.length],
                life: maxLife,
                maxLife,
                twinklePhase: Math.random() * Math.PI * 2,
              });
            }
            sim.dyingSequence.glitters = glitters;
          }
        } else if (sim.dyingSequence.phase === 'exploding') {
          for (let i = 0; i < sim.dyingSequence.glitters.length; i++) {
            const g = sim.dyingSequence.glitters[i];
            g.x += g.vx * dt;
            g.y += g.vy * dt;
            g.vy += 280 * dt;
            g.vx *= Math.pow(0.95, frameScale);
            g.life -= dt;
          }

          if (sim.dyingSequence.timer >= 0.55) {
            sim.dyingSequence.phase = 'dissolving';
            sim.dyingSequence.timer = 0;
          }
        } else if (sim.dyingSequence.phase === 'dissolving') {
          for (let i = 0; i < sim.dyingSequence.glitters.length; i++) {
            const g = sim.dyingSequence.glitters[i];
            g.x += g.vx * dt;
            g.y += g.vy * dt;
            g.vy += 280 * dt;
            g.life -= dt;
          }
          sim.dyingSequence.dissolveProgress = Math.min(1, sim.dyingSequence.timer / 0.32);

          if (sim.dyingSequence.timer >= 0.32) {
            const finalAlt = Math.floor(Math.abs(Math.min(0, sim.highestPlatformY - 782)) / 100);
            const styleRank = calculateStyleRank(sim.maxFlowThisRun, sim.styleMeter).rank;

            // Calculate XP Gained & 15-Level Progression Rewards!
            const xpGained = Math.max(
              25,
              Math.round(sim.score * 1.2 + sim.orbsThisRun * 8 + sim.maxFlowThisRun * 6)
            );
            const prevLvInfo = computePlayerLevelInfo(c.playerXp || 0);
            const nextLvInfo = computePlayerLevelInfo((c.playerXp || 0) + xpGained);
            const levelRewards = getLevelUpRewardsBetween(prevLvInfo.level, nextLvInfo.level);
            const cumUnlocks = getCumulativeUnlocksForLevel(nextLvInfo.level);

            setCfg((prev) => ({
              ...prev,
              playerXp: nextLvInfo.totalXp,
              playerLevel: nextLvInfo.level,
              unlockedScales: Array.from(
                new Set([...prev.unlockedScales, ...cumUnlocks.unlockedScales])
              ),
              enabledScales: Array.from(
                new Set([
                  ...prev.enabledScales,
                  ...levelRewards
                    .map((r) => r.scaleId)
                    .filter((id): id is number => id !== undefined),
                ])
              ),
              unlockedSoundBanks: Array.from(
                new Set([...prev.unlockedSoundBanks, ...cumUnlocks.unlockedSoundBanks])
              ),
              enabledSoundBanks: Array.from(
                new Set([
                  ...prev.enabledSoundBanks,
                  ...levelRewards
                    .map((r) => r.soundBankId)
                    .filter((id): id is string => id !== undefined),
                ])
              ),
              unlockedAvatars: Array.from(
                new Set([
                  ...prev.unlockedAvatars,
                  ...cumUnlocks.unlockedSecretAvatars,
                ])
              ),
            }));

            setStats((prev) => {
              const isNew = sim.score > prev.highScore;
              const next: PersistentStats = {
                highScore: Math.max(prev.highScore, sim.score),
                maxCombo: Math.max(prev.maxCombo, sim.maxFlowThisRun),
                totalOrbs: prev.totalOrbs + sim.orbsThisRun,
                runsPlayed: prev.runsPlayed + 1,
              };
              setEndSnapshot({
                score: Math.round(sim.score),
                best: Math.round(next.highScore),
                isNewRecord: isNew,
                maxFlow: sim.maxFlowThisRun,
                altitude: finalAlt,
                orbsCollected: sim.orbsThisRun,
                rank: styleRank,
                xpGained,
                prevLevel: prevLvInfo.level,
                newLevel: nextLvInfo.level,
                prevRatio: prevLvInfo.progressRatio,
                progressRatio: nextLvInfo.progressRatio,
                xpIntoLevel: nextLvInfo.xpIntoLevel,
                xpNeededForNext: nextLvInfo.xpNeededForNext,
                levelRewards,
              });
              return next;
            });

            if (nextLvInfo.level > prevLvInfo.level && !sim.isMuted) {
              audioRef.current.sfxLevelUp(biome, c);
            }
            submitTelegramRankedScore({
              score: Math.round(sim.score),
              maxFlow: sim.maxFlowThisRun,
              avatarShape: c.playerShape,
            }).then((res) => {
              setRankedLeaderboard(res.leaderboard);
              setTelegramSyncedBadge(res.syncedToTelegram);
            });
            setGameOverAnimElapsed(0);
            sim.dyingSequence.active = false;
            setScreen('gameover');
          }
        }

        return ambientPulse;
      }

      if (sim.hitstop > 0) {
        sim.hitstop -= dt;
        return ambientPulse;
      }

      if (p.damageGlitchTimer > 0) {
        p.damageGlitchTimer = Math.max(0, p.damageGlitchTimer - dt);
      }
      if (sim.chordComboHud.completionFlashTimer > 0) {
        sim.chordComboHud.completionFlashTimer = Math.max(
          0,
          sim.chordComboHud.completionFlashTimer - dt
        );
      }

      // Gold / Rainbow Character Passive Shield Auto-Regeneration
      if (charPerks.autoRegenShieldSec > 0 && !p.hasShield) {
        sim.shieldRegenTimer += dt;
        if (sim.shieldRegenTimer >= charPerks.autoRegenShieldSec) {
          sim.shieldRegenTimer = 0;
          p.hasShield = true;
          if (!hasPowerUp('combo_shield')) {
            sim.activePowerUps.push({
              id: 'combo_shield',
              name: 'Aegis Shield',
              icon: '🛡',
              remainingSec: 20,
              durationSec: 20,
            });
          }
          spawnShockwave(p.x + 12, p.y + 12, biome.horizonColor, 80);
          spawnFloatingText('🛡 SHIELD READY', 300, p.y - 26, '#fde047', 0.95);
        }
      } else {
        sim.shieldRegenTimer = 0;
      }

      // Emit Scheduled 3-Note Subdivision Ring Pulses Centered on Player!
      if (sim.pendingRhythmRings.length > 0) {
        const remainingRings: typeof sim.pendingRhythmRings = [];
        for (let i = 0; i < sim.pendingRhythmRings.length; i++) {
          const item = sim.pendingRhythmRings[i];
          if (sim.gameTime >= item.triggerAt) {
            spawnShockwave(p.x + p.w * 0.5, p.y + p.h * 0.5, item.color, item.maxR);
          } else {
            remainingRings.push(item);
          }
        }
        sim.pendingRhythmRings = remainingRings;
      }

      // Continuous Gradual Flow Decay when not actively climbing
      sim.timeSinceLastClimb += dt;
      if (sim.flowEnergy > 0 && sim.timeSinceLastClimb > 2.2) {
        const decayRate =
          (0.08 + sim.flowEnergy * 0.008) *
          fine.flowDecayRate *
          charPerks.stallDecayMultiplier;
        sim.flowEnergy = Math.max(0, sim.flowEnergy - decayRate * dt);
        syncFlowStateFromEnergy(sim);
      }

      sim.activePowerUps = tickActivePowerUps(sim.activePowerUps, dt);
      if (!hasPowerUp('combo_shield')) {
        p.hasShield = false;
      }

      // Tick Equipped Right-Side Power-Up Loadout Slots (Initial Empty -> Charge -> Ready -> Active -> Cooldown)
      let activeJetpackSlot: EquippedPowerUpSlotRuntime | undefined = undefined;
      let jetpackJustFinished = false;
      for (let s = 0; s < sim.equippedSlotRuntimes.length; s++) {
        const slot = sim.equippedSlotRuntimes[s];
        if (slot.activationMode === 'PASSIVE') continue;
        if (slot.phase === 'charging') {
          slot.chargeProgress = Math.min(
            1,
            slot.chargeProgress + dt / Math.max(0.5, slot.chargeTimeSec)
          );
          if (slot.chargeProgress >= 1) {
            slot.chargeProgress = 1;
            slot.phase = 'ready';
          }
        } else if (slot.phase === 'active') {
          if (slot.id === 'combo_shield') {
            // Shield has NO expiration timer! It remains active until broken by a hazard or fall rescue,
            // and only then enters cooldown to recharge the next shield!
            if (!p.hasShield) {
              if (slot.usesLeft > 0) {
                slot.phase = 'cooldown';
                slot.chargeProgress = 0;
                slot.chargeTimeSec = slot.cooldownSec;
              } else {
                slot.phase = 'depleted';
                slot.chargeProgress = 0;
              }
            }
          } else {
            const isJetpack =
              slot.id === 'jetpack_white' ||
              slot.id === 'jetpack_gold' ||
              slot.id === 'jetpack_prism';
            slot.activeRemainingSec = Math.max(0, slot.activeRemainingSec - dt);
            if (isJetpack && slot.activeRemainingSec > 0) {
              activeJetpackSlot = slot;
            }
            if (slot.activeRemainingSec <= 0) {
              if (isJetpack) {
                jetpackJustFinished = true;
              }
              if (slot.usesLeft > 0) {
                slot.phase = 'cooldown';
                slot.chargeProgress = 0;
                slot.chargeTimeSec = slot.cooldownSec;
              } else {
                slot.phase = 'depleted';
                slot.chargeProgress = 0;
              }
            }
          }
        } else if (slot.phase === 'cooldown') {
          slot.chargeProgress = Math.min(
            1,
            slot.chargeProgress + dt / Math.max(0.5, slot.cooldownSec)
          );
          if (slot.chargeProgress >= 1) {
            slot.chargeProgress = 1;
            slot.phase = 'ready';
          }
        }
      }

      // Update Fading Jetpack Glitter Particles
      if (sim.jetpackGlitters.length > 0) {
        const nextGlitters: GlitterParticle[] = [];
        for (let i = 0; i < sim.jetpackGlitters.length; i++) {
          const g = sim.jetpackGlitters[i];
          g.x += g.vx * dt;
          g.y += g.vy * dt;
          g.vy += 110 * dt;
          g.life -= dt;
          if (g.life > 0) {
            nextGlitters.push(g);
          }
        }
        sim.jetpackGlitters = nextGlitters;
      }

      generateWorldUpTo(Math.min(sim.camY, p.y - 600));

      const currentRunAltMeters = Math.floor(Math.abs(Math.min(0, p.y - 782)) / 100);
      const flowDiff = computeFlowDynamicDifficulty(
        sim.flowEnergy,
        fine,
        currentRunAltMeters
      );
      const baseBpm =
        sim.mode === 'STAGE' && sim.activeStage
          ? sim.activeStage.bpm
          : flowDiff.dynamicJumpBpm || fine.baseJumpTempo || 100;
      const kin = computeBpmLockedKinematics(baseBpm, 1.0);
      const activeBank = getActiveSoundBank(c);
      const dashMods = computePassiveDashUpgrades(c.powerUpLevels, c.equippedPowerUps);

      if (jetpackJustFinished) {
        p.vy = kin.bouncePadVelocityPxPerSec * 0.92;
        sim.activeJumpGravity = kin.gravityPxPerSec2;
        // Spawn a safety platform right beneath the player's apex AND keep `sim.platforms` sorted by descending `y`
        // so `sim.platforms[sim.platforms.length - 1]` ALWAYS points to the highest generated platform!
        const safeW = Math.max(120, flowDiff.targetPlatformWidth + 24);
        const safeX = Math.max(24, Math.min(576 - safeW, p.x + p.w * 0.5 - safeW * 0.5));
        sim.platforms.push({
          id: sim.nextPlatformId++,
          x: safeX,
          y: p.y + 42,
          w: safeW,
          targetW: safeW,
          centerX: safeX + safeW * 0.5,
          h: 14,
          type: 'normal',
          vx: 0,
          vy: 0,
          minX: 0,
          maxX: 600,
          hit: false,
          repeatBounces: 0,
          themeIdx: sim.activeBiomeIdx,
          noteLabel: biome.noteNames[0] || 'C4',
          noteFreq: biome.scale[0] || 261.63,
          crumbleTimer: 0,
          broken: false,
          respawnTimer: 0,
          phaseSolid: true,
        });
        sim.platforms.sort((a, b) => b.y - a.y);
      }

      // Dynamically adapt upper platform widths based on each platform's Altitude (M)
      for (let i = 0; i < sim.platforms.length; i++) {
        const plat = sim.platforms[i];
        if (plat.id === 1) continue;
        if (!plat.hit && plat.y < p.y - 20) {
          const platAltM = Math.floor(Math.abs(Math.min(0, plat.y - 782)) / 100);
          const platDiff = computeFlowDynamicDifficulty(sim.flowEnergy, fine, platAltM);
          const baseTargetW = platDiff.targetPlatformWidth + charPerks.platformWidthBonusPx;
          const desiredW =
            plat.type === 'chord_gate'
              ? Math.round(baseTargetW * 1.08)
              : baseTargetW;
          plat.targetW = desiredW;
        }
        if (Math.abs(plat.w - plat.targetW) > 0.4) {
          plat.w += (plat.targetW - plat.w) * Math.min(1, dt * 6.5);
          if (Math.abs(plat.vx) === 0) {
            plat.x = plat.centerX - plat.w * 0.5;
          }
        } else {
          plat.w = plat.targetW;
        }
      }

      // Chord Gate Rule: ONLY fade/downgrade an unhit Chord Gate if its FIRST platform (chordGateIndex === 0) exits the bottom of the screen!
      const screenBottomY = sim.camY + (sim.viewH || 800);
      for (let i = 0; i < sim.platforms.length; i++) {
        const pl = sim.platforms[i];
        if (pl.type === 'chord_gate' && pl.chordGateIndex === 0 && !pl.hit && pl.y > screenBottomY) {
          downgradeRemainingChordGates(sim, biome.horizonColor);
          break;
        }
      }

      const inp = sim.inputs;

      // Dash Cooldown & Flow Tier 4 Overdrive + Character Perk Bonus + Dash Capacitor Passive Upgrade
      const flowDashBonus = sim.combo >= FLOW_THRESHOLDS.OVERDRIVE ? 0.68 : 1.0;
      const maxDashCool =
        (hasPowerUp('dash_capacitor') ? 0.85 : 1.8) *
        flowDashBonus *
        charPerks.dashCooldownMultiplier *
        dashMods.cooldownMultiplier;
      p.dashMaxCool = maxDashCool;
      if (p.dashCool > 0) {
        const rechargeRate = p.wallBounceCooldownPenaltyActive
          ? dashMods.wallBounceRechargeRateFactor
          : 1.0;
        p.dashCool = Math.max(0, p.dashCool - dt * rechargeRate);
        if (p.dashCool <= 0) {
          p.wallBounceCooldownPenaltyActive = false;
        }
      }
      if (p.wallDashGraceTimer > 0) {
        p.wallDashGraceTimer = Math.max(0, p.wallDashGraceTimer - dt);
      }

      // UPGRADED PHASE DASH BOOST: High-velocity horizontal burst + anti-gravity upward rescue lift + Wall-Bounce window!
      if (inp.dashJustPressed && p.dashCool <= 0) {
        const activeTurbineMult = hasPowerUp('dash_turbine') ? 1.28 : 1.0;
        const dashPowerMult =
          Math.max(0.5, fine.dashBoostPowerMult ?? 1.25) *
          dashMods.dashPowerMultiplier *
          activeTurbineMult;
        p.dashAct = 0.25;
        p.wallDashGraceTimer = 0.34;
        p.wallBounceCooldownPenaltyActive = false;
        p.dashCool = maxDashCool;
        const touchDir =
          Math.abs(inp.touchSteerX) > 0.08 ? (inp.touchSteerX > 0 ? 1 : -1) : 0;
        const dir = inp.left
          ? -1
          : inp.right
          ? 1
          : touchDir !== 0
          ? touchDir
          : p.facing;
        p.facing = dir;
        p.vx = dir * Math.round(760 * dashPowerMult);
        p.vy = Math.min(p.vy, -Math.round(255 * dashPowerMult));
        p.scaleX = 1.48;
        p.scaleY = 0.6;
        sim.aberration = 0.78;
        sim.shake = 4.5;
        if (!sim.isMuted) audioRef.current.sfxDash(biome, c);

        const shockwaveRadius =
          (hasPowerUp('dash_capacitor') || hasPowerUp('dash_shockwave') ? 115 : 85) +
          dashMods.shockwaveRadiusBonusPx;
        spawnShockwave(
          p.x + p.w * 0.5,
          p.y + p.h * 0.5,
          biome.horizonColor,
          shockwaveRadius
        );
        sim.particles.burst(p.x + p.w * 0.5, p.y + p.h * 0.5, biome.fg, 12, 6, 'spark');

        // If Dash Shockwave is unlocked (or active), clear nearby drones & magnet-lock nearby orbs on every Dash!
        if (dashMods.shockwaveRadiusBonusPx > 0 || hasPowerUp('dash_shockwave')) {
          const empR = 85 + dashMods.shockwaveRadiusBonusPx;
          for (let i = 0; i < sim.aerialHazards.length; i++) {
            const ah = sim.aerialHazards[i];
            if (ah.active && Math.hypot(ah.x - (p.x + 12), ah.y - (p.y + 12)) <= empR) {
              ah.active = false;
              sim.particles.burst(ah.x, ah.y, '#f472b6', 12, 5.5, 'spark');
            }
          }
          for (let i = 0; i < sim.orbs.length; i++) {
            const o = sim.orbs[i];
            if (!o.collected && Math.hypot(o.x - (p.x + 12), o.y - (p.y + 12)) <= empR * 1.35) {
              o.magnetLocked = true;
            }
          }
        }
      }
      inp.dashJustPressed = false;

      // Optional Character Innate Air Jump (for avatars with permanentAirJump)
      if (inp.upJustPressed) {
        inp.upJustPressed = false;
        if (charPerks.permanentAirJump && p.airJumpsLeft > 0 && p.vy > -100) {
          p.airJumpsLeft--;
          p.vy = kin.jumpVelocityPxPerSec * 0.95;
          sim.activeJumpGravity = kin.gravityPxPerSec2;
          p.scaleX = 0.72;
          p.scaleY = 1.32;
          if (!sim.isMuted) audioRef.current.sfxJump(biome, c, true);
          spawnShockwave(p.x + p.w * 0.5, p.y + p.h, biome.fg, 50);
        }
      }

      // 3-TIER JETPACK THRUST + FADING GLITTER TRAIL (BLUE / GOLD / 7-COLOR PRISM) + RAPID BIOME MICRO-NOTES!
      if (activeJetpackSlot) {
        const tier: 'white' | 'gold' | 'prism' =
          activeJetpackSlot.id === 'jetpack_prism'
            ? 'prism'
            : activeJetpackSlot.id === 'jetpack_gold'
            ? 'gold'
            : 'white';
        // Force strong upward ascent so Jetpack NEVER gets stuck in mid-air!
        p.vy = -Math.max(880, activeJetpackSlot.powerValue);
        p.grounded = false;
        p.scaleX = 0.78;
        p.scaleY = 1.28;
        sim.timeSinceLastClimb = 0;
        if (p.y < sim.highestPlatformY) {
          sim.highestPlatformY = p.y;
        }
        // Keep camera locked onto Jetpack ascent and continuously generate upper platforms!
        const viewHJet = sim.viewH || 800;
        const jetCamTarget = p.y - viewHJet * 0.48;
        if (jetCamTarget < sim.camY) {
          sim.camY = jetCamTarget;
        }
        generateWorldUpTo(sim.camY - 900);

        const whiteBluePalette = ['#38bdf8', '#7dd3fc', '#e0f2fe', '#0284c7'];
        const goldPalette = ['#fbbf24', '#fde047', '#fef08a', '#f59e0b'];
        const prismPalette = [
          '#ff2a85',
          '#ff7a00',
          '#fde047',
          '#00ff88',
          '#00d4ff',
          '#8b5cf6',
          '#f472b6',
        ];
        const palette =
          tier === 'prism'
            ? prismPalette
            : tier === 'gold'
            ? goldPalette
            : whiteBluePalette;

        for (let g = 0; g < 3; g++) {
          const maxLife = 0.34 + Math.random() * 0.24;
          const col =
            palette[(sim.jetpackStepCounter + g + Math.floor(Math.random() * palette.length)) % palette.length];
          sim.jetpackGlitters.push({
            x: p.x + p.w * 0.5 + (Math.random() - 0.5) * 18,
            y: p.y + p.h + Math.random() * 8,
            vx: -p.vx * 0.14 + (Math.random() - 0.5) * 85,
            vy: 140 + Math.random() * 160,
            size: tier === 'prism' ? 4 + (g % 3) : 3 + (g % 3),
            color: col,
            life: maxLife,
            maxLife,
            twinklePhase: Math.random() * Math.PI * 2,
          });
        }
        if (sim.jetpackGlitters.length > 140) {
          sim.jetpackGlitters.splice(0, sim.jetpackGlitters.length - 140);
        }

        const noteInterval = tier === 'prism' ? 0.055 : tier === 'gold' ? 0.064 : 0.074;
        sim.jetpackNoteTimer += dt;
        if (sim.jetpackNoteTimer >= noteInterval) {
          sim.jetpackNoteTimer = 0;
          const stepIdx = sim.jetpackStepCounter++;
          if (!sim.isMuted) {
            audioRef.current.playJetpackGlitterNote(biome, stepIdx, tier, c);
          }
        }

        // Credit platforms passed during Jetpack flight so Flow & Score climb smoothly!
        for (let i = 0; i < sim.platforms.length; i++) {
          const plat = sim.platforms[i];
          if (!plat.hit && plat.y >= p.y && plat.y <= p.y + 110) {
            plat.hit = true;
            sim.flowEnergy = Math.min(
              45,
              sim.flowEnergy + (0.45 * fine.flowGainRate) / FLOW_PLATFORMS_PER_STEP
            );
            syncFlowStateFromEnergy(sim);
            if (sim.combo > sim.maxFlowThisRun) sim.maxFlowThisRun = sim.combo;
            sim.score += Math.max(2, Math.round(2 * charPerks.scoreMultiplier));
          }
        }
      }

      // Constant Horizontal Steering Speed (Touch Finger Overrides Gravity Tilt 100% while touching screen!)
      if (p.dashAct > 0) {
        p.dashAct = Math.max(0, p.dashAct - dt);
        sim.particles.spawn(
          p.x + p.w * 0.5,
          p.y + p.h * 0.5,
          -p.vx * 0.01,
          (Math.random() - 0.5) * 2,
          biome.horizonColor,
          3.8,
          0.26,
          'spark'
        );
      } else {
        const keyAxis = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
        const touchAxis = Number(inp.touchSteerX) || 0;
        const tiltAxis = c.tiltControlEnabled !== false ? Number(inp.tiltX) || 0 : 0;
        // While finger is touching the screen (`touchDragRef.current.active`), gravity tilt is completely disabled!
        const isTouchActive =
          keyAxis === 0 && (touchDragRef.current.active || Math.abs(touchAxis) > 0.01);
        const isTiltActive = keyAxis === 0 && !isTouchActive && Math.abs(tiltAxis) > 0.01;

        const combinedAxis = Math.max(
          -1,
          Math.min(
            1,
            keyAxis !== 0 ? keyAxis : isTouchActive ? touchAxis : tiltAxis
          )
        );
        // Controlled velocity scaling via Fine-Tune Mobile sliders (`mobileTouchSpeedMult`, `mobileTiltSpeedMult`)
        const touchSpeedMult = Math.max(0.2, fine.mobileTouchSpeedMult ?? 0.85);
        const tiltSpeedMult = Math.max(0.2, fine.mobileTiltSpeedMult ?? 0.80);
        const touchDynBoost =
          touchSpeedMult *
          Math.max(
            0.75,
            Math.min(1.65, (touchDragRef.current.speedBoost || 1.0) + Math.abs(touchAxis) * 0.35)
          );
        const tiltDynBoost = tiltSpeedMult * (0.85 + Math.abs(tiltAxis) * 0.55);
        const speedBoost = isTouchActive
          ? touchDynBoost
          : isTiltActive
          ? tiltDynBoost
          : 1.0;
        const targetVx = combinedAxis * flowDiff.moveSpeedPxPerSec * speedBoost;
        const isReversing = p.vx * targetVx < 0;
        const steerRate =
          isTouchActive || isTiltActive
            ? isReversing
              ? 28
              : 20
            : Math.abs(combinedAxis) > 0.05
            ? 16
            : 11;
        p.vx += (targetVx - p.vx) * Math.min(1, dt * steerRate);
        if (combinedAxis < -0.05) p.facing = -1;
        if (combinedAxis > 0.05) p.facing = 1;
      }

      const baseGravity =
        sim.mode === 'STAGE' && sim.activeJumpGravity > 100
          ? sim.activeJumpGravity
          : kin.gravityPxPerSec2;
      const activeGravity = activeJetpackSlot
        ? 0
        : p.dashAct > 0
        ? baseGravity * 0.25
        : baseGravity;

      if (!activeJetpackSlot) {
        p.vy += activeGravity * dt;
        p.vy = Math.min(p.vy, Math.abs(kin.jumpVelocityPxPerSec) * 1.35);
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Update Tapered Triangular Trail Points Behind Character
      p.trail.push({
        x: p.x + p.w * 0.5,
        y: p.y + p.h * 0.5,
        vx: p.vx,
        vy: p.vy,
      });
      if (p.trail.length > 14) {
        p.trail.shift();
      }

      // 30°–45° UPWARD WALL-BOUNCE BACK WHEN DASHING INTO LEFT/RIGHT WALL BOUNDARIES
      // (Requires the 4-Level Passive Power-Up `wall_bounce` to be unlocked & equipped; scales with Character Tier `wallBounceElasticity`!)
      p.wallSlideDir = 0;
      const isDashingIntoWall = p.dashAct > 0 || p.wallDashGraceTimer > 0;
      const canWallBounceDash = isDashingIntoWall && dashMods.wallBounceUnlocked;
      const charElasticity = charPerks.wallBounceElasticity || 1.0;

      if (p.x <= 8) {
        p.x = 8;
        if (canWallBounceDash) {
          p.dashAct = 0;
          p.wallDashGraceTimer = 0;
          const activeTurbineMult = hasPowerUp('dash_turbine') ? 1.2 : 1.0;
          const totalElasticMult =
            dashMods.wallBounceLiftMultiplier * charElasticity * activeTurbineMult;
          // 30°–45° angle bounce-back: strong horizontal rebound away from wall + upward launch!
          const bounceBackVx = Math.round(540 * totalElasticMult);
          const bounceUpVy = kin.jumpVelocityPxPerSec * 0.98 * totalElasticMult;
          p.vx = bounceBackVx;
          p.vy = bounceUpVy;
          p.facing = 1;
          p.scaleX = 0.62;
          p.scaleY = 1.44;
          p.dashCool = p.dashMaxCool;
          p.wallBounceCooldownPenaltyActive = true;
          p.airJumpsLeft = Math.max(p.airJumpsLeft, 1);
          sim.timeSinceLastClimb = 0;
          sim.flowEnergy = Math.min(
            45,
            sim.flowEnergy + (0.55 * fine.flowGainRate) / FLOW_PLATFORMS_PER_STEP
          );
          syncFlowStateFromEnergy(sim);
          sim.styleMeter = Math.min(100, sim.styleMeter + 10);
          sim.shake = 5.5;
          sim.aberration = 0.85;
          if (!sim.isMuted) audioRef.current.sfxBouncePad(biome, c);
          spawnShockwave(10, p.y + p.h * 0.5, '#38bdf8', 95);
          sim.particles.burst(10, p.y + p.h * 0.5, '#38bdf8', 14, 5.5, 'spark');
          spawnFloatingText(
            `⚡ WALL BOUNCE LV.${dashMods.wallBounceLevel}!`,
            165,
            p.y - 24,
            '#38bdf8',
            0.95,
            `38° REBOUND · ${Math.round(dashMods.wallBounceRechargeRateFactor * 100)}% CD RATE`
          );
        } else {
          p.vx = Math.abs(p.vx) * 0.75 + 140;
          p.facing = 1;
          sim.particles.burst(8, p.y + p.h * 0.5, biome.fg, 5, 3.5, 'dust');
        }
      } else if (p.x + p.w >= 592) {
        p.x = 592 - p.w;
        if (canWallBounceDash) {
          p.dashAct = 0;
          p.wallDashGraceTimer = 0;
          const activeTurbineMult = hasPowerUp('dash_turbine') ? 1.2 : 1.0;
          const totalElasticMult =
            dashMods.wallBounceLiftMultiplier * charElasticity * activeTurbineMult;
          const bounceBackVx = -Math.round(540 * totalElasticMult);
          const bounceUpVy = kin.jumpVelocityPxPerSec * 0.98 * totalElasticMult;
          p.vx = bounceBackVx;
          p.vy = bounceUpVy;
          p.facing = -1;
          p.scaleX = 0.62;
          p.scaleY = 1.44;
          p.dashCool = p.dashMaxCool;
          p.wallBounceCooldownPenaltyActive = true;
          p.airJumpsLeft = Math.max(p.airJumpsLeft, 1);
          sim.timeSinceLastClimb = 0;
          sim.flowEnergy = Math.min(
            45,
            sim.flowEnergy + (0.55 * fine.flowGainRate) / FLOW_PLATFORMS_PER_STEP
          );
          syncFlowStateFromEnergy(sim);
          sim.styleMeter = Math.min(100, sim.styleMeter + 10);
          sim.shake = 5.5;
          sim.aberration = 0.85;
          if (!sim.isMuted) audioRef.current.sfxBouncePad(biome, c);
          spawnShockwave(590, p.y + p.h * 0.5, '#38bdf8', 95);
          sim.particles.burst(590, p.y + p.h * 0.5, '#38bdf8', 14, 5.5, 'spark');
          spawnFloatingText(
            `⚡ WALL BOUNCE LV.${dashMods.wallBounceLevel}!`,
            435,
            p.y - 24,
            '#38bdf8',
            0.95,
            `38° REBOUND · ${Math.round(dashMods.wallBounceRechargeRateFactor * 100)}% CD RATE`
          );
        } else {
          p.vx = -Math.abs(p.vx) * 0.75 - 140;
          p.facing = -1;
          sim.particles.burst(592, p.y + p.h * 0.5, biome.fg, 5, 3.5, 'dust');
        }
      }

      const sq = stepSquashStretch(p.scaleX, p.scaleY, dt);
      p.scaleX = sq.scaleX;
      p.scaleY = sq.scaleY;

      // Chrono Slow dilation factor for enemies and moving platforms
      const chronoSlot = sim.equippedSlotRuntimes.find(
        (s) => s.id === 'chrono_slow' && s.phase === 'active'
      );
      const hazardTimeScale = chronoSlot
        ? chronoSlot.powerValue
        : hasPowerUp('chrono_slow')
        ? 0.45
        : 1.0;

      // Immediate Player Explosion Helper when Skin Health (`p.hp`) reaches 0
      const triggerImmediatePlayerExplosion = (hitBiome: ScaleBiome) => {
        audioRef.current.stopChoir();
        if (!sim.isMuted) {
          audioRef.current.sfxPlayerShatter(hitBiome, c);
        }
        const centerX = p.x + p.w * 0.5;
        const centerY = p.y + p.h * 0.5;
        sim.shake = 14;
        sim.aberration = 1.0;
        spawnShockwave(centerX, centerY, '#ffffff', 160);
        spawnShockwave(centerX, centerY, hitBiome.fg, 220);
        spawnShockwave(centerX, centerY, '#fb7185', 120);
        spawnFloatingText('💥 0 HP · SHATTERED!', 300, p.y - 32, '#fb7185', 1.1);

        const glitterColors = [
          '#ffffff',
          hitBiome.fg,
          hitBiome.horizonColor,
          '#fde047',
          '#f472b6',
          '#38bdf8',
          '#a855f7',
          '#fb7185',
        ];
        const glitters: GlitterParticle[] = [];
        for (let g = 0; g < 96; g++) {
          const angle = (Math.PI * 2 * g) / 96 + (Math.random() - 0.5) * 0.25;
          const speed = 70 + Math.random() * 420;
          const maxLife = 0.55 + Math.random() * 0.45;
          glitters.push({
            x: centerX + (Math.random() - 0.5) * 10,
            y: centerY + (Math.random() - 0.5) * 10,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 60,
            size: 3 + Math.floor(Math.random() * 5),
            color: glitterColors[g % glitterColors.length],
            life: maxLife,
            maxLife,
            twinklePhase: Math.random() * Math.PI * 2,
          });
        }
        sim.dyingSequence = {
          active: true,
          phase: 'exploding',
          timer: 0,
          dissolveProgress: 0,
          glitters,
        };
      };

      // Update Mid-Air Obstacles & Check Collision
      for (let i = 0; i < sim.aerialHazards.length; i++) {
        const ah = sim.aerialHazards[i];
        if (!ah.active) continue;
        ah.x += ah.vx * dt * hazardTimeScale;
        if (ah.x < ah.minX || ah.x > ah.maxX) {
          ah.vx *= -1;
          ah.x = Math.max(ah.minX, Math.min(ah.maxX, ah.x));
        }

        if (p.dashAct <= 0 && !activeJetpackSlot && !sim.dyingSequence.active) {
          const dx = p.x + p.w * 0.5 - ah.x;
          const dy = p.y + p.h * 0.5 - ah.y;
          if (Math.hypot(dx, dy) < p.w * 0.5 + ah.radius - 2) {
            ah.active = false;
            if (p.hasShield) {
              p.hasShield = false;
              sim.activePowerUps = sim.activePowerUps.filter((u) => u.id !== 'combo_shield');
              if (!sim.isMuted) audioRef.current.sfxShieldBreak(biome, c);
              spawnFloatingText('🛡 BLOCKED', 300, p.y - 24, biome.horizonColor, 1.0);
            } else {
              if (!sim.isMuted) audioRef.current.sfxHazardDamage(biome, c);
              p.hp = Math.max(0, p.hp - 1);
              const droneLoss = Number(
                (1.2 * fine.hazardFlowPenalty * charPerks.hazardPenaltyMultiplier).toFixed(1)
              );
              sim.flowEnergy = Math.max(0, sim.flowEnergy - droneLoss);
              syncFlowStateFromEnergy(sim);
              sim.styleMeter = Math.max(0, sim.styleMeter - 25);
              p.damageGlitchTimer = 0.65;
              sim.shake = 5;
              sim.aberration = 0.75;
              sim.particles.burst(ah.x, ah.y, '#fb7185', 12, 5, 'spark');
              if (p.hp <= 0) {
                triggerImmediatePlayerExplosion(biome);
                return ambientPulse;
              }
              spawnFloatingText(
                `-1 HP (♥ ${p.hp}/${p.maxHp})`,
                300,
                p.y - 24,
                '#fb7185',
                1.0,
                `-${droneLoss} FLOW`
              );
            }
          }
        }
      }

      // Update Platforms & Auto-Bounce Collisions
      p.grounded = false;

      for (let i = 0; i < sim.platforms.length; i++) {
        const plat = sim.platforms[i];

        if (Math.abs(plat.vx) > 0 && !plat.broken) {
          plat.x += plat.vx * frameScale * hazardTimeScale;
          if (plat.x < plat.minX || plat.x > plat.maxX) {
            plat.vx *= -1;
            plat.x = Math.max(plat.minX, Math.min(plat.maxX, plat.x));
          }
          plat.centerX = plat.x + plat.w * 0.5;
        }

        if (plat.type === 'phase') {
          plat.phaseSolid = Math.floor(sim.gameTime * 1.1) % 4 !== 3;
        }

        if (plat.type === 'crumble') {
          if (plat.broken) {
            plat.respawnTimer -= dt;
            if (plat.respawnTimer <= 0) {
              plat.broken = false;
              plat.crumbleTimer = 0;
              plat.hit = false;
              plat.repeatBounces = 0;
            }
            continue;
          } else if (plat.crumbleTimer > 0) {
            plat.crumbleTimer -= dt;
            if (plat.crumbleTimer <= 0) {
              plat.broken = true;
              plat.respawnTimer = 3.0;
              if (!sim.isMuted) audioRef.current.sfxCrumble(biome, c);
              sim.particles.burst(plat.x + plat.w * 0.5, plat.y, biome.fg, 8, 3.5, 'dust');
              continue;
            }
          }
        }

        if (
          p.vy >= 0 &&
          !plat.broken &&
          (plat.type !== 'phase' || plat.phaseSolid)
        ) {
          const overlapX = p.x + p.w > plat.x - 3 && p.x < plat.x + plat.w + 3;
          const prevBottom = p.y + p.h - p.vy * dt;
          const overlapY = p.y + p.h >= plat.y && prevBottom <= plat.y + 24;

          if (overlapX && overlapY) {
            // If in STAGE mode and this platform has a per-bar `customBiomeId`, transition to it!
            let activePlatBiome = biome;
            if (sim.mode === 'STAGE' && plat.customBiomeId !== undefined) {
              const targetBarBiome =
                MASTER_SCALES.find((s) => s.id === plat.customBiomeId) || biome;
              activePlatBiome = targetBarBiome;
              if (sim.biomeOrder[0] !== plat.customBiomeId) {
                const prevBarBiome =
                  MASTER_SCALES.find((s) => s.id === sim.biomeOrder[0]) || biome;
                sim.biomeOrder = [plat.customBiomeId];
                sim.biomeDissolve = {
                  active: true,
                  progress: 0,
                  fromBiome: prevBarBiome,
                  toBiome: targetBarBiome,
                };
              }
            }

            const pCol = getPlatformThemeColor(
              activePlatBiome,
              plat.type,
              c.useBiomes,
              c.fixedColor
            );

            // Check On-Platform Dissonance Spike collision
            if (
              plat.hasHazard &&
              plat.hazardWidth &&
              plat.hazardXOffset !== undefined &&
              p.dashAct <= 0 &&
              !activeJetpackSlot
            ) {
              const hx = plat.x + plat.hazardXOffset;
              if (p.x + p.w > hx + 2 && p.x < hx + plat.hazardWidth - 2) {
                plat.hasHazard = false;
                if (p.hasShield) {
                  p.hasShield = false;
                  sim.activePowerUps = sim.activePowerUps.filter((u) => u.id !== 'combo_shield');
                  if (!sim.isMuted) audioRef.current.sfxShieldBreak(activePlatBiome, c);
                  spawnFloatingText('🛡 BLOCKED', 300, p.y - 24, activePlatBiome.horizonColor, 1.0);
                } else {
                  if (!sim.isMuted) audioRef.current.sfxHazardDamage(activePlatBiome, c);
                  p.hp = Math.max(0, p.hp - 1);
                  const spikeLoss = Number(
                    (1.0 * fine.hazardFlowPenalty * charPerks.hazardPenaltyMultiplier).toFixed(1)
                  );
                  sim.flowEnergy = Math.max(0, sim.flowEnergy - spikeLoss);
                  syncFlowStateFromEnergy(sim);
                  sim.styleMeter = Math.max(0, sim.styleMeter - 22);
                  p.damageGlitchTimer = 0.55;
                  sim.shake = 4.5;
                  sim.aberration = 0.65;
                  if (p.hp <= 0) {
                    triggerImmediatePlayerExplosion(activePlatBiome);
                    return ambientPulse;
                  }
                  spawnFloatingText(
                    `-1 HP (♥ ${p.hp}/${p.maxHp})`,
                    300,
                    p.y - 24,
                    '#fb7185',
                    1.0,
                    `-${spikeLoss} FLOW`
                  );
                }
              }
            }

            // AUTO-BOUNCE + Elastic Impact Squash-and-Stretch
            p.y = plat.y - p.h;
            p.impactSquashTimer = 0.095;
            p.airJumpsLeft = charPerks.permanentAirJump ? 1 : 0;

            if (plat.type === 'crumble' && plat.crumbleTimer <= 0) {
              plat.crumbleTimer = 0.15;
              if (plat.disguisedFragile) {
                plat.disguisedFragile = false;
                sim.particles.burst(plat.x + plat.w * 0.5, plat.y, '#fbbf24', 10, 4.5, 'spark');
                spawnFloatingText('! TRAP', plat.x + plat.w * 0.5, plat.y - 20, '#fbbf24', 0.85);
              }
            }

            // 4-GATE HARMONIC CHORD PROGRESSION PORTAL TRIGGER (One-time trigger per gate; converts to normal platform once hit!)
            if (plat.type === 'chord_gate' && !plat.hit) {
              const gateIdx = plat.chordGateIndex ?? 0;
              const variantIdx = plat.chordProgressionVariant ?? 0;
              const savedNextGateId = plat.nextGateId;
              const prog = pickBiomeChordProgression(activePlatBiome, variantIdx);
              const roman = ROMAN_NUMERALS[gateIdx % 4];
              const chordName =
                plat.chordNameOverride || prog.chordNames[gateIdx % 4] || 'HARMONY';

              // Immediately convert this Chord Gate into a standard hit platform so landing on it again NEVER re-triggers rewards or XP!
              plat.hit = true;
              plat.repeatBounces = 0;
              plat.type = 'normal';
              plat.chordGateIndex = undefined;
              plat.chordProgressionVariant = undefined;
              plat.chordNameOverride = undefined;
              plat.nextGateId = undefined;
              plat.nextGateX = undefined;
              plat.nextGateY = undefined;

              sim.timeSinceLastClimb = 0;
              if (plat.y < sim.highestPlatformY) {
                sim.highestPlatformY = plat.y;
              }

              sim.chordComboHud = {
                active: gateIdx < 3,
                completedCount: gateIdx + 1,
                chordNames: prog.chordNames,
                completionFlashTimer: gateIdx === 3 ? 2.4 : 0,
              };

              const baseChordTone = prog.chords[gateIdx % 4]?.[1] || activePlatBiome.scale[0];
              sim.recentPlayedPlatformNotes.push(baseChordTone);
              if (sim.recentPlayedPlatformNotes.length > 6) {
                sim.recentPlayedPlatformNotes.shift();
              }

              const prevComboGate = sim.combo;
              sim.flowEnergy = Math.min(
                45,
                sim.flowEnergy +
                  (gateIdx === 3 ? 0.65 : 0.25) *
                    fine.flowGainRate *
                    charPerks.flowGainMultiplier *
                    dashMods.flowAccelMultiplier
              );
              syncFlowStateFromEnergy(sim);
              const didGateLevelUp = sim.combo > prevComboGate && sim.combo >= 1;

              if (sim.combo > sim.maxFlowThisRun) sim.maxFlowThisRun = sim.combo;
              sim.styleMeter = Math.min(100, sim.styleMeter + (gateIdx === 3 ? 24 : 12));
              sim.score += Math.round(
                (gateIdx === 3 ? 25 : 4 + gateIdx * 3) * charPerks.scoreMultiplier
              );

              if (!sim.isMuted) {
                audioRef.current.playChordGate(
                  activePlatBiome,
                  gateIdx,
                  c,
                  activeBank,
                  variantIdx
                );
                if (gateIdx === 3) {
                  audioRef.current.playChordCadenceReward(
                    activePlatBiome,
                    variantIdx,
                    c,
                    activeBank
                  );
                } else if (didGateLevelUp) {
                  const res = audioRef.current.playPlatformNote(
                    activePlatBiome,
                    sim.combo,
                    c,
                    plat.customClusterFreqs,
                    activeBank,
                    true,
                    1.0,
                    plat.tripletFreqs
                  );
                  res.subdivisionRingDelaysSec.forEach((delaySec, idx) => {
                    sim.pendingRhythmRings.push({
                      triggerAt: sim.gameTime + delaySec,
                      color: idx % 2 === 0 ? activePlatBiome.horizonColor : activePlatBiome.fg,
                      maxR: 54 + idx * 18,
                    });
                  });
                }
              }

              if (gateIdx === 3) {
                sim.chordSequencesCompletedInBiome++;
                // Ensure any stray chord_gate platforms left behind are converted to normal platforms
                for (let gi = 0; gi < sim.platforms.length; gi++) {
                  const gPlat = sim.platforms[gi];
                  if (gPlat.type === 'chord_gate' && gPlat.y >= plat.y - 20) {
                    gPlat.type = 'normal';
                    gPlat.chordGateIndex = undefined;
                    gPlat.chordProgressionVariant = undefined;
                    gPlat.chordNameOverride = undefined;
                    gPlat.nextGateId = undefined;
                    gPlat.nextGateX = undefined;
                    gPlat.nextGateY = undefined;
                  }
                }
                // Chord Sequence Completion Restores 35% of Max HP!
                const chordHeal = Math.max(1, Math.ceil(p.maxHp * 0.35));
                const actualHealed = Math.min(p.maxHp - p.hp, chordHeal);
                p.hp = Math.min(p.maxHp, p.hp + chordHeal);
                // Instant 5x Base Orb Rate Reward * Character Bonus * Passive Overdrive Multiplier!
                const charBonusFactor = 1 + (charPerks.orbBonusPct || 0) / 100;
                const instantChordOrbs = Math.max(
                  5,
                  Math.round(5 * charBonusFactor * dashMods.passiveOverdriveMult)
                );
                sim.orbsThisRun += instantChordOrbs + (charPerks.chordGateBonusOrbs || 0);
                sim.particles.burst(plat.x + plat.w * 0.5, plat.y, '#fde047', 18, 6.5, 'spark');
                spawnFloatingText(
                  `+${instantChordOrbs} ORBS${actualHealed > 0 ? ` · +${actualHealed} HP ♥` : ' (5x CADENCE!)'}`,
                  300,
                  plat.y - 54,
                  '#fde047',
                  1.05,
                  `♥ ${p.hp}/${p.maxHp} HP`
                );
                // If this was the 2nd Chord Gate sequence of the biome, completing it shifts immediately to the next biome!
                if (
                  sim.mode !== 'STAGE' &&
                  (sim.chordSequencesCompletedInBiome >= 2 ||
                    sim.chordSequencesSpawnedInBiome >= 2)
                ) {
                  triggerNextBiomeShift(sim);
                } else {
                  grantTemporaryPowerUp(activePlatBiome, `4-GATE CADENCE (1/2)`);
                }
                if (charPerks.chordGateDoublePowerUp) {
                  grantTemporaryPowerUp(
                    activePlatBiome,
                    getCharacterById(c.playerShape).perkTitle
                  );
                }
              } else {
                // Mid-sequence Gate II (`gateIdx === 1`) restores +1 HP if damaged
                if (gateIdx === 1 && p.hp < p.maxHp) {
                  p.hp = Math.min(p.maxHp, p.hp + 1);
                }
                spawnShockwave(plat.x + plat.w * 0.5, plat.y, activePlatBiome.horizonColor, 115);
                sim.particles.burst(plat.x + plat.w * 0.5, plat.y, activePlatBiome.fg, 14, 5.5, 'spark');
                spawnFloatingText(
                  `${roman} · ${chordName}`,
                  300,
                  plat.y - 36,
                  activePlatBiome.horizonColor,
                  1.0,
                  `${gateIdx + 1}/4`
                );
              }

              generateWorldUpTo(plat.y - 900);

              if (gateIdx < 3 && savedNextGateId !== undefined) {
                const nextGate = sim.platforms.find((pl) => pl.id === savedNextGateId);
                if (nextGate) {
                  sim.activeChordChainTargetId = nextGate.id;
                  const verticalSpan = Math.max(380, Math.abs(plat.y - nextGate.y));
                  const boostApex = verticalSpan + 78;
                  sim.activeJumpGravity = kin.gravityPxPerSec2;
                  p.vy = -Math.sqrt(2 * kin.gravityPxPerSec2 * boostApex);
                  p.scaleX = 0.64;
                  p.scaleY = 1.42;
                  break;
                }
              }

              sim.activeChordChainTargetId = undefined;
              sim.activeJumpGravity = kin.gravityPxPerSec2;
              p.vy = kin.bouncePadVelocityPxPerSec * 1.15;
              p.scaleX = 0.66;
              p.scaleY = 1.38;
              break;
            }

            // If a Chord Gate sequence was started (completedCount >= 1) and the player lands on a non-chord_gate platform,
            // immediately break the sequence and convert remaining chord_gate platforms to normal platforms!
            if (
              sim.chordComboHud.active &&
              sim.chordComboHud.completedCount >= 1 &&
              sim.chordComboHud.completedCount < 4
            ) {
              downgradeRemainingChordGates(sim, '#fb7185');
              spawnFloatingText('CHORD BROKEN', 300, plat.y - 32, '#fb7185', 0.9);
            }

            // Launch velocity & duration-proportional gravity
            if (
              sim.mode === 'STAGE' &&
              plat.customJumpVelocityPxPerSec !== undefined &&
              plat.customGravityPxPerSec2 !== undefined
            ) {
              p.vy = plat.customJumpVelocityPxPerSec;
              sim.activeJumpGravity = plat.customGravityPxPerSec2;
              p.scaleX = 0.72;
              p.scaleY = 1.32;
            } else if (plat.type === 'bounce') {
              p.vy = kin.bouncePadVelocityPxPerSec;
              sim.activeJumpGravity = kin.gravityPxPerSec2;
              p.scaleX = 0.64;
              p.scaleY = 1.4;
              sim.shake = 3.5;
              if (!sim.isMuted) audioRef.current.sfxBouncePad(activePlatBiome, c);
              spawnShockwave(p.x + p.w * 0.5, plat.y, pCol, 75);
              sim.particles.burst(p.x + p.w * 0.5, plat.y, pCol, 10, 5, 'spark');
            } else {
              p.vy = kin.jumpVelocityPxPerSec;
              sim.activeJumpGravity = kin.gravityPxPerSec2;
              p.scaleX = 0.72;
              p.scaleY = 1.32;
            }

            if (!plat.hit) {
              plat.hit = true;
              plat.repeatBounces = 0;
              sim.menuMelodyCursor = (sim.menuMelodyCursor + 1) % 72;

              const isClimbingUp = plat.y <= sim.highestPlatformY + 25;
              if (plat.y < sim.highestPlatformY) {
                sim.highestPlatformY = plat.y;
              }

              let didFlowLevelUp = false;

              if (isClimbingUp) {
                sim.timeSinceLastClimb = 0;
                sim.platformsClimbedCount = (sim.platformsClimbedCount || 0) + 1;
                if (
                  dashMods.regenPlatformsInterval > 0 &&
                  sim.platformsClimbedCount % dashMods.regenPlatformsInterval === 0 &&
                  p.hp < p.maxHp
                ) {
                  p.hp = Math.min(p.maxHp, p.hp + 1);
                  spawnShockwave(p.x + p.w * 0.5, p.y + p.h * 0.5, '#f43f5e', 75);
                  spawnFloatingText(
                    `💖 +1 HP REGEN (${p.hp}/${p.maxHp})`,
                    300,
                    plat.y - 44,
                    '#f43f5e',
                    0.95
                  );
                }
                const prevCombo = sim.combo;
                const stepGain =
                  (plat.type === 'bounce' ? 2 : 1) *
                  fine.flowGainRate *
                  charPerks.flowGainMultiplier *
                  dashMods.flowAccelMultiplier;
                sim.flowEnergy = Math.min(
                  45,
                  sim.flowEnergy + stepGain / FLOW_PLATFORMS_PER_STEP
                );
                syncFlowStateFromEnergy(sim);

                didFlowLevelUp = sim.combo > prevCombo && sim.combo >= 1;

                if (sim.combo > sim.maxFlowThisRun) sim.maxFlowThisRun = sim.combo;
                sim.styleMeter = Math.min(100, sim.styleMeter + 3 * stepGain);

                const auraMult =
                  dashMods.passiveOverdriveMult * (hasPowerUp('rhythm_aura') ? 1.35 : 1.0);
                const styleInfo = calculateStyleRank(sim.combo, sim.styleMeter);
                const rawStepPoints =
                  (0.7 + Math.min(1.5, sim.combo * 0.12)) *
                  styleInfo.multiplier *
                  auraMult *
                  charPerks.scoreMultiplier;
                sim.score += Math.max(1, Math.round(rawStepPoints));

                if (prevCombo < FLOW_THRESHOLDS.HARMONIC && sim.combo >= FLOW_THRESHOLDS.HARMONIC) {
                  sim.score += 5;
                  if (!sim.isMuted) audioRef.current.sfxLevelUp(activePlatBiome, c);
                  spawnFloatingText(
                    `FLOW x${FLOW_THRESHOLDS.HARMONIC}`,
                    300,
                    plat.y - 36,
                    activePlatBiome.horizonColor,
                    1.0
                  );
                  spawnShockwave(p.x + 10, plat.y, activePlatBiome.fg, 90);
                } else if (
                  prevCombo < FLOW_THRESHOLDS.SUBDIVISION &&
                  sim.combo >= FLOW_THRESHOLDS.SUBDIVISION
                ) {
                  sim.score += 8;
                  if (!sim.isMuted) audioRef.current.sfxLevelUp(activePlatBiome, c);
                  spawnFloatingText(
                    `FLOW x${FLOW_THRESHOLDS.SUBDIVISION}`,
                    300,
                    plat.y - 36,
                    activePlatBiome.horizonColor,
                    1.0
                  );
                  spawnShockwave(p.x + 10, plat.y, activePlatBiome.horizonColor, 95);
                } else if (prevCombo < FLOW_THRESHOLDS.CHORD && sim.combo >= FLOW_THRESHOLDS.CHORD) {
                  sim.score += 12;
                  grantTemporaryPowerUp(
                    activePlatBiome,
                    `FLOW x${FLOW_THRESHOLDS.CHORD}`,
                    'combo_shield'
                  );
                } else if (
                  prevCombo < FLOW_THRESHOLDS.OVERDRIVE &&
                  sim.combo >= FLOW_THRESHOLDS.OVERDRIVE
                ) {
                  sim.score += 25;
                  grantTemporaryPowerUp(
                    activePlatBiome,
                    `OMNI x${FLOW_THRESHOLDS.OVERDRIVE}`
                  );
                }
              } else {
                const dropDistPx = plat.y - sim.highestPlatformY;
                const platformsMissed = Math.floor(dropDistPx / Math.max(100, flowDiff.stepY));
                if (platformsMissed >= 2) {
                  const penalty =
                    Math.min(3.2, platformsMissed * 0.65) *
                    fine.flowDecayRate *
                    charPerks.stallDecayMultiplier;
                  sim.flowEnergy = Math.max(0, sim.flowEnergy - penalty);
                  syncFlowStateFromEnergy(sim);
                  sim.highestPlatformY = plat.y;
                  spawnFloatingText(
                    `-${penalty.toFixed(1)} FLOW`,
                    300,
                    plat.y - 28,
                    '#fb7185',
                    0.95
                  );
                }
              }

              sim.particles.burst(p.x + p.w * 0.5, plat.y, pCol, 7, 4, 'dust');

              if (!sim.isMuted) {
                let res;
                if (sim.mode === 'STAGE') {
                  const cluster = plat.customClusterFreqs || [plat.noteFreq || 261.63];
                  res = audioRef.current.playPlatformNote(
                    activePlatBiome,
                    sim.combo,
                    c,
                    cluster,
                    activeBank,
                    didFlowLevelUp,
                    plat.beatDurationRatio || 1.0
                  );
                  if (plat.customSynthFreqs && plat.customSynthFreqs.length > 0) {
                    plat.customSynthFreqs.forEach((sFreq) => {
                      audioRef.current.playCustomSynthNote(
                        sFreq,
                        plat.customSynthDurationSec || 1.2,
                        c
                      );
                    });
                  }
                } else if (sim.mode === 'SEQUENCER' || sim.mode === 'MIDI') {
                  const cluster = sim.seqData[sim.seqIdx % sim.seqData.length] || [261.63];
                  res = audioRef.current.playPlatformNote(
                    activePlatBiome,
                    sim.combo,
                    c,
                    cluster,
                    activeBank,
                    didFlowLevelUp
                  );
                  sim.seqIdx = (sim.seqIdx + 1) % Math.max(1, sim.seqData.length);
                } else {
                  const curatedCluster =
                    (c.melodyMode ?? 'curated') === 'curated'
                      ? plat.customClusterFreqs
                      : undefined;
                  const curatedTriplets =
                    (c.melodyMode ?? 'curated') === 'curated'
                      ? plat.tripletFreqs
                      : undefined;
                  res = audioRef.current.playPlatformNote(
                    activePlatBiome,
                    sim.combo,
                    c,
                    curatedCluster,
                    activeBank,
                    didFlowLevelUp,
                    1.0,
                    curatedTriplets
                  );
                }
                if (res.notes[0]) {
                  plat.noteFreq = res.notes[0];
                  sim.recentPlayedPlatformNotes.push(res.notes[0]);
                  if (sim.recentPlayedPlatformNotes.length > 6) {
                    sim.recentPlayedPlatformNotes.shift();
                  }
                }
                if (res.subdivisionRingDelaysSec.length > 0) {
                  res.subdivisionRingDelaysSec.forEach((delaySec, idx) => {
                    sim.pendingRhythmRings.push({
                      triggerAt: sim.gameTime + delaySec,
                      color:
                        idx % 2 === 0
                          ? activePlatBiome.horizonColor
                          : activePlatBiome.fg,
                      maxR: 54 + idx * 18,
                    });
                  });
                }
              } else if (plat.noteFreq) {
                sim.recentPlayedPlatformNotes.push(plat.noteFreq);
                if (sim.recentPlayedPlatformNotes.length > 6) {
                  sim.recentPlayedPlatformNotes.shift();
                }
              }
            } else {
              plat.repeatBounces = (plat.repeatBounces || 0) + 1;
              const dropDistPx = plat.y - sim.highestPlatformY;
              const platformsMissed = Math.floor(dropDistPx / Math.max(100, flowDiff.stepY));

              if (platformsMissed >= 2) {
                const dropPenalty =
                  Math.min(3.5, platformsMissed * 0.7) *
                  fine.flowDecayRate *
                  charPerks.stallDecayMultiplier;
                sim.flowEnergy = Math.max(0, sim.flowEnergy - dropPenalty);
                syncFlowStateFromEnergy(sim);
                sim.highestPlatformY = plat.y;
                sim.styleMeter = Math.max(0, sim.styleMeter - 18);
                spawnFloatingText(
                  `-${dropPenalty.toFixed(1)} FLOW`,
                  300,
                  plat.y - 28,
                  '#fb7185',
                  0.95
                );
              } else if (plat.repeatBounces >= 1) {
                const stallPenalty =
                  0.42 *
                  Math.min(3, plat.repeatBounces) *
                  fine.flowDecayRate *
                  charPerks.stallDecayMultiplier;
                sim.flowEnergy = Math.max(0, sim.flowEnergy - stallPenalty);
                syncFlowStateFromEnergy(sim);
                sim.styleMeter = Math.max(0, sim.styleMeter - 10);
              }

              if (!sim.isMuted) {
                if (sim.mode === 'STAGE') {
                  const cluster = plat.customClusterFreqs || [plat.noteFreq || 261.63];
                  audioRef.current.playPlatformNote(
                    activePlatBiome,
                    sim.combo,
                    c,
                    cluster,
                    activeBank,
                    false
                  );
                } else if (sim.mode === 'SEQUENCER' || sim.mode === 'MIDI') {
                  const cluster = sim.seqData[sim.seqIdx % sim.seqData.length] || [261.63];
                  audioRef.current.playPlatformNote(
                    activePlatBiome,
                    sim.combo,
                    c,
                    cluster,
                    activeBank,
                    false
                  );
                } else {
                  const curatedCluster =
                    (c.melodyMode ?? 'curated') === 'curated'
                      ? plat.customClusterFreqs
                      : undefined;
                  audioRef.current.playPlatformNote(
                    activePlatBiome,
                    sim.combo,
                    c,
                    curatedCluster,
                    activeBank,
                    false
                  );
                }
              }
              sim.particles.burst(p.x + p.w * 0.5, plat.y, pCol, 4, 2.5, 'dust');
            }
            break;
          }
        }
      }

      // Collectible Mid-Air Heart Health Pickups (`♥`) — Hide/clear if player is already at full health!
      for (let i = 0; i < sim.heartPickups.length; i++) {
        const hpItem = sim.heartPickups[i];
        if (hpItem.collected) continue;
        if (!canSpawnHeartPickup(p.hp, p.maxHp)) {
          hpItem.collected = true;
          continue;
        }
        const pCenterX = p.x + p.w * 0.5;
        const pCenterY = p.y + p.h * 0.5;
        const dist = Math.hypot(pCenterX - hpItem.x, pCenterY - hpItem.y);
        if (dist < p.w * 0.9 + hpItem.radius + 6) {
          hpItem.collected = true;
          const prevHp = p.hp;
          p.hp = Math.min(p.maxHp, p.hp + hpItem.healAmount);
          const healed = p.hp - prevHp;
          sim.score += Math.round(15 * charPerks.scoreMultiplier);
          if (!sim.isMuted) audioRef.current.sfxOrbCollect(biome, c);
          spawnShockwave(hpItem.x, hpItem.y, '#fb7185', 85);
          sim.particles.burst(hpItem.x, hpItem.y, '#fb7185', 14, 5, 'spark');
          spawnFloatingText(
            healed > 0 ? `+${healed} HP ♥ (${p.hp}/${p.maxHp})` : `♥ MAX HP (${p.hp}/${p.maxHp})`,
            300,
            hpItem.y - 24,
            '#fb7185',
            1.0
          );
        }
      }

      // Collectible Harmonic Orbs & Passive Harmonic Magnet + Passive Resonance Overdrive + Character Orb Yield Bonus!
      const isActiveMagnetBurst = hasPowerUp('orb_magnet') || Boolean(activeJetpackSlot);
      const magnetRadius =
        Math.max(38, dashMods.passiveMagnetRadiusPx, hasPowerUp('orb_magnet') ? 185 : 38) +
        charPerks.bonusMagnetRadiusPx +
        (activeJetpackSlot ? 135 : 0);
      // At Level 1, Harmonic Magnet only pulls orbs when the player is practically on the same platform (`|dy| <= 40px`)
      // and never yanks orbs down from upper platforms! As Magnet upgrades from Lv.1 -> Lv.5, vertical reach scales up smoothly.
      const maxMagnetVerticalSpan = isActiveMagnetBurst
        ? 260
        : dashMods.passiveMagnetLevel <= 1
        ? 40
        : 40 + (dashMods.passiveMagnetLevel - 1) * 32;

      const auraOrbMult =
        dashMods.passiveOverdriveMult * (hasPowerUp('rhythm_aura') ? 1.35 : 1.0);

      for (let i = 0; i < sim.orbs.length; i++) {
        const orb = sim.orbs[i];
        if (orb.collected) continue;
        const pCenterX = p.x + p.w * 0.5;
        const pCenterY = p.y + p.h * 0.5;
        const dx = pCenterX - orb.x;
        const dy = pCenterY - orb.y;
        const dist = Math.hypot(dx, dy);

        if (dist < magnetRadius && Math.abs(dy) <= maxMagnetVerticalSpan) {
          orb.magnetLocked = true;
        }

        if (orb.magnetLocked && dist > 0.5) {
          const playerSpeed = Math.hypot(p.vx, p.vy);
          // Gentle pull at Level 1, scaling stronger across Levels 1..5
          const magnetLvFactor = isActiveMagnetBurst
            ? 1.0
            : 0.34 + Math.max(0, dashMods.passiveMagnetLevel - 1) * 0.165;
          const pullSpeed = Math.max(220, (playerSpeed * 1.15 + 380) * magnetLvFactor);
          const stepMove = pullSpeed * dt;
          if (stepMove >= dist) {
            orb.x = pCenterX;
            orb.y = pCenterY;
          } else {
            orb.x += (dx / dist) * stepMove + p.vx * dt * 0.25 * magnetLvFactor;
            orb.y += (dy / dist) * stepMove + p.vy * dt * 0.25 * magnetLvFactor;
          }
        }

        const newDist = Math.hypot(pCenterX - orb.x, pCenterY - orb.y);
        if (newDist < p.w * 0.85 + orb.radius) {
          orb.collected = true;
          // Progressive Character Orb Bonus (% extra orb yield + doubleOrbChance + Rhythm Aura)
          const charBonusFactor = 1 + (charPerks.orbBonusPct || 0) / 100;
          const baseOrbRoll = Math.random() < charPerks.doubleOrbChance ? 2 : 1;
          const exactGain = baseOrbRoll * charBonusFactor * auraOrbMult;
          const guaranteedOrbs = Math.floor(exactGain);
          const fractionalChance = exactGain - guaranteedOrbs;
          const orbGain = Math.max(
            1,
            guaranteedOrbs + (Math.random() < fractionalChance ? 1 : 0)
          );

          sim.orbsThisRun += orbGain;
          sim.flowEnergy = Math.min(
            45,
            sim.flowEnergy +
              0.14 *
                fine.flowGainRate *
                charPerks.flowGainMultiplier *
                dashMods.flowAccelMultiplier
          );
          syncFlowStateFromEnergy(sim);
          if (sim.combo > sim.maxFlowThisRun) sim.maxFlowThisRun = sim.combo;
          sim.styleMeter = Math.min(100, sim.styleMeter + 6);
          sim.score += Math.round(orbGain * charPerks.scoreMultiplier);
          if (!sim.isMuted) audioRef.current.sfxOrbCollect(biome, c);
          sim.particles.burst(orb.x, orb.y, biome.horizonColor, 10, 4.5, 'spark');

          if (sim.orbsThisRun % 7 === 0) {
            grantTemporaryPowerUp(biome, 'ORB BONUS');
          }
        }
      }

      // ONE-WAY UPWARD CAMERA TRACKING DURING NORMAL PLAY
      const viewH = sim.viewH || 800;
      const targetCamY = p.y - viewH * 0.56;
      if (targetCamY < sim.camY) {
        sim.camY += (targetCamY - sim.camY) * Math.min(1, dt * 8.5);
      }

      if (sim.shake > 0.1) {
        sim.camY += (Math.random() - 0.5) * sim.shake;
        sim.shake *= Math.pow(0.86, frameScale);
      } else {
        sim.shake = 0;
      }

      if (sim.aberration > 0.02) {
        sim.aberration *= Math.pow(0.88, frameScale);
      } else {
        sim.aberration = 0;
      }

      const currentAlt = Math.floor(Math.abs(Math.min(0, p.y - 782)) / 100);
      if (currentAlt > sim.score) sim.score = currentAlt;

      // Optimized culling
      const cullBottomY = sim.camY + viewH + 60;
      if (sim.platforms.length > 0 && sim.platforms[0].y >= cullBottomY) {
        sim.platforms = sim.platforms.filter((pl) => pl.y < cullBottomY);
      }
      if (sim.aerialHazards.length > 16) {
        sim.aerialHazards = sim.aerialHazards.filter((ah) => ah.active && ah.y < cullBottomY);
      }
      if (sim.heartPickups.length > 12) {
        sim.heartPickups = sim.heartPickups.filter((hp) => !hp.collected && hp.y < cullBottomY);
      }
      if (sim.orbs.length > 24) {
        sim.orbs = sim.orbs.filter((o) => !o.collected && o.y < cullBottomY);
      }

      // Update Particles, Shockwaves & Texts
      sim.particles.update(dt);
      for (let i = 0; i < sim.shockwaves.length; i++) {
        const sw = sim.shockwaves[i];
        sw.r += (sw.maxR - sw.r) * 0.18 * frameScale;
        sw.alpha -= 0.05 * frameScale;
      }
      for (let i = 0; i < sim.texts.length; i++) {
        const ft = sim.texts[i];
        if (!ft.active) continue;
        ft.y += ft.vy * frameScale;
        ft.life -= 0.025 * frameScale;
        if (ft.life <= 0) ft.active = false;
      }

      // Shield Fall Rescue at bottom of screen
      if (p.vy > 0 && p.y > sim.camY + viewH - 40 && p.hasShield) {
        p.hasShield = false;
        sim.activePowerUps = sim.activePowerUps.filter((u) => u.id !== 'combo_shield');
        sim.activeJumpGravity = kin.gravityPxPerSec2;
        p.vy = kin.bouncePadVelocityPxPerSec * 1.1;
        if (!sim.isMuted) audioRef.current.sfxShieldBreak(biome, c);
        spawnShockwave(p.x + 12, p.y, biome.horizonColor, 100);
        spawnFloatingText('🛡 SAVED', 300, p.y - 25, biome.horizonColor, 1.05);
      }

      // Trigger 3-Phase Fall -> Center-Screen Shatter/Glitter -> Pixelated Dissolve Defeat Sequence!
      if (p.vy > 0 && p.y > sim.camY + viewH - 15 && !p.hasShield && !sim.dyingSequence.active) {
        audioRef.current.stopChoir();
        if (!sim.isMuted) audioRef.current.sfxComboLost(biome, c);
        sim.dyingSequence = {
          active: true,
          phase: 'falling',
          timer: 0,
          dissolveProgress: 0,
          glitters: [],
        };
      }

      // Direct DOM HUD updates (Minimal Icon-Driven Format — Rank System Removed)
      const milestoneInfo = getFlowMilestoneInfo(sim.combo, sim.flowSubSteps);

      if (scoreDomRef.current) {
        scoreDomRef.current.textContent = String(Math.round(sim.score)).padStart(4, '0');
      }
      if (altDomRef.current) {
        altDomRef.current.textContent = `${currentAlt}M`;
      }
      if (orbsDomRef.current) {
        orbsDomRef.current.textContent = `${sim.orbsThisRun}`;
      }
      if (hpHeartsDomRef.current) {
        const hpKey = `${p.hp}/${p.maxHp}`;
        if (lastRenderedHpKeyRef.current !== hpKey) {
          lastRenderedHpKeyRef.current = hpKey;
          const totalHearts = Math.max(1, p.maxHp);
          const currentHearts = Math.max(0, Math.min(totalHearts, p.hp));
          let heartsHtml = '';
          for (let hIdx = 0; hIdx < totalHearts; hIdx++) {
            const isFull = hIdx < currentHearts;
            heartsHtml += isFull
              ? `<svg data-heart-state="full" viewBox="0 0 12 11" class="w-3 h-3 shrink-0 drop-shadow-[0_0_4px_rgba(251,113,133,0.85)]" style="shape-rendering:crispEdges"><path d="M2 1h3v1h2V1h3v1h1v3h-1v2H9v1H8v1H7v1H5V9H4V8H3V7H2V5H1V2h1V1z" fill="#fb7185"/><rect x="2" y="2" width="2" height="1" fill="#ffe4e6"/></svg>`
              : `<svg data-heart-state="empty" viewBox="0 0 12 11" class="w-3 h-3 shrink-0 opacity-75" style="shape-rendering:crispEdges"><path d="M2 1h3v1h2V1h3v1h1v3h-1v2H9v1H8v1H7v1H5V9H4V8H3V7H2V5H1V2h1V1zm0 1v3h1v2h1v1h1v1h2V8h1V7h1V5h1V2H7v1H5V2H2z" fill="#fb7185"/></svg>`;
          }
          hpHeartsDomRef.current.innerHTML = heartsHtml;
        }
      }
      if (comboTextDomRef.current) {
        comboTextDomRef.current.textContent = `FLOW x${sim.combo}`;
        comboTextDomRef.current.style.color = biome.fg;
      }
      if (milestoneDomRef.current) {
        milestoneDomRef.current.textContent = `>x${milestoneInfo.nextThreshold}`;
      }
      if (comboBarDomRef.current) {
        comboBarDomRef.current.style.width = `${milestoneInfo.progressPct.toFixed(1)}%`;
        comboBarDomRef.current.style.backgroundColor = biome.fg;
      }
      if (biomeTagDomRef.current) {
        biomeTagDomRef.current.textContent = c.useBiomes
          ? `${biome.name} · ${biome.subtitle}`
          : `${activeBank.name}`;
        biomeTagDomRef.current.style.color = c.useBiomes ? biome.fg : c.fixedColor;
      }
      if (melodyHudDomRef.current) {
        if (sim.mode === 'STAGE' && sim.activeStage) {
          melodyHudDomRef.current.textContent = `🎹 STAGE · ${sim.activeStage.name}`;
          melodyHudDomRef.current.style.color = '#f472b6';
        } else {
          const activeMel = sim.activeCuratedMelody;
          melodyHudDomRef.current.textContent = activeMel
            ? `🎼 MELODY · ${activeMel.title}`
            : '🎼 CURATED MELODY';
          melodyHudDomRef.current.style.color = c.useBiomes ? biome.fg : '#00ff88';
        }
        if (mobileHintDomRef.current) {
          if (sim.gameTime < 3.2) {
            mobileHintDomRef.current.style.display = '';
            mobileHintDomRef.current.style.opacity = '1';
          } else if (sim.gameTime < 4.2) {
            mobileHintDomRef.current.style.display = '';
            mobileHintDomRef.current.style.opacity = String(
              Math.max(0, Number((1 - (sim.gameTime - 3.2)).toFixed(2)))
            );
          } else {
            mobileHintDomRef.current.style.display = 'none';
          }
        }
      }

      return ambientPulse;
    };

    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dynPace = computeFlowDynamicDifficulty(
        simRef.current.flowEnergy,
        simRef.current.cfg.fineTune
      ).paceMultiplier;
      const clampedDt = Math.min(0.04, Math.max(0.001, rawDt)) * dynPace;

      const ambientPulse = stepSimulation(clampedDt);

      const cvs = canvasRef.current;
      if (!cvs) return;
      const ctx = cvs.getContext('2d');
      if (!ctx) return;

      const sim = simRef.current;
      const biome = getScaleByIndex(sim.activeBiomeIdx, sim.cfg);

      renderGameFrame(
        ctx,
        600,
        sim.viewH || 800,
        sim.camY,
        sim.gameTime,
        ambientPulse,
        sim.combo,
        biome,
        sim.cfg,
        sim.player,
        sim.platforms,
        sim.orbs,
        sim.particles,
        sim.texts,
        sim.aberration,
        sim.shockwaves,
        MASTER_SCALES,
        sim.activePowerUps,
        sim.biomeDissolve,
        sim.aerialHazards,
        sim.chordComboHud,
        sim.dyingSequence,
        sim.jetpackGlitters,
        sim.heartPickups
      );
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [
    generateWorldUpTo,
    getActiveSoundBank,
    getScaleByIndex,
    grantTemporaryPowerUp,
    pickRandomEnabledSoundBankId,
    spawnFloatingText,
    spawnShockwave,
  ]);

  // --- STORE UNLOCK & TOGGLE HANDLERS ---
  const handleUnlockSoundBank = (bank: SoundBankDef) => {
    if (cfg.unlockedSoundBanks.includes(bank.id)) return;
    if (stats.totalOrbs < bank.costOrbs) return;
    setStats((prev) => ({ ...prev, totalOrbs: prev.totalOrbs - bank.costOrbs }));
    setCfg((prev) => ({
      ...prev,
      unlockedSoundBanks: [...prev.unlockedSoundBanks, bank.id],
      enabledSoundBanks: [...prev.enabledSoundBanks, bank.id],
    }));
    if (!isMuted) {
      audioRef.current.previewNote(392.0, cfg, bank);
    }
  };

  const handleToggleSoundBank = (bankId: string, enabled: boolean) => {
    setCfg((prev) => {
      const next = enabled
        ? Array.from(new Set([...prev.enabledSoundBanks, bankId]))
        : prev.enabledSoundBanks.filter((id) => id !== bankId);
      return {
        ...prev,
        enabledSoundBanks: next.length > 0 ? next : [prev.unlockedSoundBanks[0] || 'crt_velvet'],
      };
    });
  };

  const handleUnlockScale = (scaleBiome: ScaleBiome) => {
    if (cfg.unlockedScales.includes(scaleBiome.id)) return;
    if (stats.totalOrbs < scaleBiome.costOrbs) return;
    setStats((prev) => ({ ...prev, totalOrbs: prev.totalOrbs - scaleBiome.costOrbs }));
    setCfg((prev) => ({
      ...prev,
      unlockedScales: [...prev.unlockedScales, scaleBiome.id],
      enabledScales: [...prev.enabledScales, scaleBiome.id],
    }));
    if (!isMuted) {
      audioRef.current.playChordGate(scaleBiome, 0, cfg, getActiveSoundBank(cfg));
    }
  };

  const handleToggleScale = (scaleId: number, enabled: boolean) => {
    setCfg((prev) => {
      const next = enabled
        ? Array.from(new Set([...prev.enabledScales, scaleId]))
        : prev.enabledScales.filter((id) => id !== scaleId);
      return {
        ...prev,
        enabledScales: next.length > 0 ? next : [prev.unlockedScales[0] ?? 0],
      };
    });
  };

  const handleSelectAvatar = (avatarId: CharacterAvatarDef['id']) => {
    setCfg((prev) => ({ ...prev, playerShape: avatarId }));
    if (!isMuted) {
      audioRef.current.sfxUiClick(MASTER_SCALES[0], cfg);
    }
  };

  const handleUnlockAvatar = (avatar: CharacterAvatarDef) => {
    if (cfg.unlockedAvatars.includes(avatar.id)) return;
    if (stats.totalOrbs < avatar.costOrbs) return;
    setStats((prev) => ({ ...prev, totalOrbs: prev.totalOrbs - avatar.costOrbs }));
    setCfg((prev) => ({
      ...prev,
      unlockedAvatars: Array.from(new Set([...prev.unlockedAvatars, avatar.id])),
      playerShape: avatar.id,
    }));
    if (!isMuted) {
      audioRef.current.sfxLevelUp(MASTER_SCALES[0], cfg);
    }
  };

  // Commit current run's score, orbs, and XP when exiting mid-run via Pause -> Menu
  const commitMidRunProgressOnExit = () => {
    const sim = simRef.current;
    const c = sim.cfg;
    const finalAlt = Math.floor(Math.abs(Math.min(0, sim.player.y - 782)) / 100);
    const runScore = Math.max(sim.score, finalAlt);
    if (runScore <= 0 && sim.orbsThisRun <= 0 && sim.maxFlowThisRun <= 0) {
      return;
    }
    const xpGained = Math.max(
      25,
      Math.round(runScore * 1.2 + sim.orbsThisRun * 8 + sim.maxFlowThisRun * 6)
    );
    const prevXp = Math.max(0, Math.floor(c.playerXp ?? 0));
    const prevLvInfo = computePlayerLevelInfo(prevXp);
    const nextXp = prevXp + xpGained;
    const nextLvInfo = computePlayerLevelInfo(nextXp);
    const levelRewards = getLevelUpRewardsBetween(prevLvInfo.level, nextLvInfo.level);
    const cumUnlocks = getCumulativeUnlocksForLevel(nextLvInfo.level);

    setCfg((prev) => ({
      ...prev,
      playerXp: nextXp,
      playerLevel: nextLvInfo.level,
      unlockedScales: Array.from(
        new Set([...prev.unlockedScales, ...cumUnlocks.unlockedScales])
      ),
      enabledScales: Array.from(
        new Set([
          ...prev.enabledScales,
          ...levelRewards
            .map((r) => r.scaleId)
            .filter((id): id is number => id !== undefined),
        ])
      ),
      unlockedSoundBanks: Array.from(
        new Set([...prev.unlockedSoundBanks, ...cumUnlocks.unlockedSoundBanks])
      ),
      enabledSoundBanks: Array.from(
        new Set([
          ...prev.enabledSoundBanks,
          ...levelRewards
            .map((r) => r.soundBankId)
            .filter((id): id is string => id !== undefined),
        ])
      ),
      unlockedAvatars: Array.from(
        new Set([
          ...prev.unlockedAvatars,
          ...cumUnlocks.unlockedSecretAvatars,
        ])
      ),
    }));

    setStats((prev) => ({
      highScore: Math.max(prev.highScore, Math.round(runScore)),
      maxCombo: Math.max(prev.maxCombo, sim.maxFlowThisRun),
      totalOrbs: prev.totalOrbs + sim.orbsThisRun,
      runsPlayed: prev.runsPlayed + 1,
    }));

    submitTelegramRankedScore({
      score: Math.round(runScore),
      maxFlow: sim.maxFlowThisRun,
      avatarShape: c.playerShape,
    }).then((res) => {
      setRankedLeaderboard(res.leaderboard);
      setTelegramSyncedBadge(res.syncedToTelegram);
    });

    // Zero out run counters so it cannot be double-committed
    sim.score = 0;
    sim.orbsThisRun = 0;
    sim.maxFlowThisRun = 0;
  };

  // Unlock (Lv.0 -> Lv.1) or Upgrade (Lv.1 -> maxLevel) a Power-Up Store Item
  // When `forceAutoEquip` is true (e.g., purchased from the Game Over dialog), automatically equip it so it's active immediately!
  const handleBuyOrUpgradePowerUp = (item: PowerUpStoreItemDef, forceAutoEquip = false) => {
    const maxLv = item.maxLevel || 5;
    const currentLv = Math.max(0, Math.min(maxLv, Math.floor(cfg.powerUpLevels?.[item.id] ?? 0)));
    if (currentLv >= maxLv) return;
    const cost = getPowerUpUpgradeCost(item, currentLv);
    if (stats.totalOrbs < cost) return;

    const nextLv = currentLv + 1;
    const maxSlots = computeUnlockedPowerUpSlots(stats.highScore, cfg.playerLevel);
    setStats((prev) => ({ ...prev, totalOrbs: prev.totalOrbs - cost }));
    setCfg((prev) => {
      const prevEquipped = prev.equippedPowerUps || ['combo_shield'];
      let nextEquipped = prevEquipped;
      if (!prevEquipped.includes(item.id)) {
        if (prevEquipped.length < maxSlots) {
          nextEquipped = [...prevEquipped, item.id];
        } else if (forceAutoEquip || currentLv === 0) {
          // Replace the first equipped slot of the same activationMode (or the oldest slot) so the newly bought power-up is immediately active
          const sameModeIdx = prevEquipped.findIndex(
            (eqId) => getPowerUpItemById(eqId)?.activationMode === item.activationMode
          );
          if (sameModeIdx >= 0) {
            nextEquipped = [...prevEquipped];
            nextEquipped[sameModeIdx] = item.id;
          } else {
            nextEquipped = [...prevEquipped.slice(1), item.id];
          }
        }
      }
      return {
        ...prev,
        powerUpLevels: {
          ...(prev.powerUpLevels || {}),
          [item.id]: nextLv,
        },
        equippedPowerUps: sortEquippedPowerUpsActiveFirst(nextEquipped),
      };
    });
    if (!isMuted) {
      audioRef.current.sfxLevelUp(MASTER_SCALES[0], cfg);
    }
  };

  // Equip or Unequip an unlocked Power-Up into the player's available Loadout Slots (ACTIVE always prioritized above PASSIVE)
  const handleToggleEquipPowerUp = (itemId: PowerUpItemId) => {
    const currentLv = Number(cfg.powerUpLevels?.[itemId] || 0);
    if (currentLv <= 0) return;
    const maxSlots = computeUnlockedPowerUpSlots(stats.highScore, cfg.playerLevel);

    setCfg((prev) => {
      const current = prev.equippedPowerUps || [];
      if (current.includes(itemId)) {
        return {
          ...prev,
          equippedPowerUps: sortEquippedPowerUpsActiveFirst(
            current.filter((id) => id !== itemId)
          ),
        };
      }
      if (current.length >= maxSlots) {
        return {
          ...prev,
          equippedPowerUps: sortEquippedPowerUpsActiveFirst([...current.slice(1), itemId]),
        };
      }
      return {
        ...prev,
        equippedPowerUps: sortEquippedPowerUpsActiveFirst([...current, itemId]),
      };
    });
    if (!isMuted) {
      audioRef.current.sfxUiClick(MASTER_SCALES[0], cfg);
    }
  };

  const handleSetExactOrbs = (orbs: number) => {
    if (telegramSession.isTelegramEnv) return;
    setStats((prev) => ({ ...prev, totalOrbs: Math.max(0, Math.round(orbs)) }));
  };

  // Beta Reset All Save / Stats / Progression back to Level 0 & fresh tutorial
  const handleResetAllSaveData = () => {
    if (telegramSession.isTelegramEnv) return;
    try {
      localStorage.removeItem('omni_cfg_v8');
      localStorage.removeItem('omni_stats_v4');
    } catch {
      // ignore
    }
    setStats({ highScore: 0, maxCombo: 0, totalOrbs: 60, runsPlayed: 0 });
    setCfg({
      ...DEFAULT_CFG,
      fineTune: { ...DEFAULT_FINE_TUNE },
      playerXp: 0,
      playerLevel: 0,
      betaUnlockSecretSkins: false,
      tutorialSeen: false,
      customBiomes: [],
    });
    setTutorialStep(0);
    setDevBundleStatus('ALL SAVE DATA & STATS RESET TO LEVEL 0!');
  };

  const toggleSeqCell = (stepIdx: number, noteKey: string) => {
    const freq = NOTES_MAP[noteKey];
    if (!isMuted && freq) {
      audioRef.current.previewNote(freq, cfg, getActiveSoundBank(cfg));
    }
    setSeqGrid((prev) => {
      const next = prev.map((col) => [...col]);
      const col = next[stepIdx];
      if (col.includes(noteKey)) {
        next[stepIdx] = col.filter((k) => k !== noteKey);
      } else {
        next[stepIdx] = [...col, noteKey].slice(-3);
      }
      return next;
    });
  };

  const applyPreset = (presetKey: string) => {
    const preset = SEQUENCER_PRESETS[presetKey];
    if (!preset) return;
    setActivePreset(presetKey);
    setCfg((prev) => ({ ...prev, synthWaveform: preset.wave }));
    const newGrid: string[][] = Array.from({ length: 16 }, () => []);
    preset.steps.forEach((freqs, stepIdx) => {
      const matchedKeys: string[] = [];
      freqs.forEach((f) => {
        let closestKey = 'C4';
        let minDiff = Infinity;
        for (const [k, nf] of Object.entries(NOTES_MAP)) {
          const diff = Math.abs(nf - f);
          if (diff < minDiff) {
            minDiff = diff;
            closestKey = k;
          }
        }
        if (!matchedKeys.includes(closestKey)) matchedKeys.push(closestKey);
      });
      newGrid[stepIdx] = matchedKeys;
    });
    setSeqGrid(newGrid);
    if (!isMuted && preset.steps[0]?.[0]) {
      audioRef.current.previewNote(preset.steps[0][0], cfg, getActiveSoundBank(cfg));
    }
  };

  const startSequencerRun = () => {
    const compiledSteps: number[][] = [];
    seqGrid.forEach((col) => {
      if (col.length > 0) {
        compiledSteps.push(col.map((k) => NOTES_MAP[k] || 261.63));
      }
    });
    if (compiledSteps.length === 0) {
      compiledSteps.push([261.63], [329.63], [392.0], [523.25]);
    }
    startNewRun('SEQUENCER', compiledSteps);
  };

  const handleMidiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMidiStatus(`LOADING ${file.name.toUpperCase()}...`);
    try {
      const buf = await file.arrayBuffer();
      const importedStage = parseMidiBufferToStage(
        buf,
        file.name,
        cfg.enabledScales[0] ?? 0,
        cfg.enabledSoundBanks[0] ?? 'crt_velvet'
      );
      setCustomStages((prev) => [importedStage, ...prev]);
      setActiveStageId(importedStage.id);
      setMidiStatus(`READY: ${importedStage.notes.length} NOTES`);
      setTimeout(() => {
        startNewRun('STAGE', undefined, true, importedStage);
      }, 380);
    } catch {
      setMidiStatus('MIDI ERROR');
    }
  };

  // --- CURATED MELODY PREVIEW & TOGGLE HANDLERS ---
  const handlePreviewCuratedMelody = (melody: CuratedBiomeMelody) => {
    const biome = MASTER_SCALES.find((s) => s.id === melody.biomeId) || MASTER_SCALES[0];
    const ext = buildExtendedScale(biome.scale);
    const previewFreqs = melody.degrees.slice(0, 8).map((deg: number) => {
      const idx = Math.max(0, Math.min(ext.length - 1, 7 + deg));
      return ext[idx] || 261.63;
    });
    audioRef.current.previewMelodySequence(previewFreqs, cfg, getActiveSoundBank(cfg));
  };

  const handleToggleCuratedMelody = (melodyId: string, enabled: boolean) => {
    setCfg((prev) => {
      const prevDisabled = prev.disabledMelodies || [];
      const nextDisabled = enabled
        ? prevDisabled.filter((id) => id !== melodyId)
        : Array.from(new Set([...prevDisabled, melodyId]));
      return {
        ...prev,
        disabledMelodies: nextDisabled,
      };
    });
  };

  // --- DEVELOPER CONFIG + CUSTOM STAGES + CURATED MELODIES BUNDLE EXPORT / IMPORT ---
  const buildDeveloperBundleObject = () => {
    const disabledSet = new Set(cfg.disabledMelodies || []);
    const keptMelodies = ALL_CURATED_MELODIES.filter((m) => !disabledSet.has(m.id)).map((m) => ({
      id: m.id,
      biomeId: m.biomeId,
      biomeName: m.biomeName,
      title: m.title,
      styleTag: m.styleTag,
      chordVariant: m.chordVariant,
    }));
    return {
      bundleType: 'NEON_ASCENT_OMNI_DEV_BUNDLE_V2',
      exportedAt: new Date().toISOString(),
      fineTune: cfg.fineTune || DEFAULT_FINE_TUNE,
      melodyMode: cfg.melodyMode || 'curated',
      disabledMelodies: cfg.disabledMelodies || [],
      enabledMelodiesCount: keptMelodies.length,
      enabledMelodies: keptMelodies,
      audioMixer: {
        volMaster: cfg.volMaster,
        volNotes: cfg.volNotes,
        volIntervals: cfg.volIntervals,
        volChords: cfg.volChords,
        volBass: cfg.volBass,
        volChoir: cfg.volChoir,
      },
      playerShape: cfg.playerShape,
      customStages,
    };
  };

  const handleExportDevBundleFile = () => {
    const bundle = buildDeveloperBundleObject();
    const jsonText = JSON.stringify(bundle, null, 2);
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Neon_Ascent_Omni_Dev_Bundle.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    const keptCount = ALL_CURATED_MELODIES.length - (cfg.disabledMelodies?.length || 0);
    setDevBundleStatus(
      `EXPORTED (${customStages.length} STAGES · ${keptCount}/81 MELODIES · 22 FINE-TUNE)`
    );
  };

  const handleCopyDevBundleClipboard = async () => {
    try {
      const jsonText = JSON.stringify(buildDeveloperBundleObject(), null, 2);
      await navigator.clipboard.writeText(jsonText);
      setDevBundleStatus('COPIED DEV BUNDLE JSON TO CLIPBOARD!');
    } catch {
      setDevBundleStatus('CLIPBOARD COPY FAILED — USE DOWNLOAD BUTTON');
    }
  };

  const handleImportDevBundleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setCfg((prev) => ({
        ...prev,
        fineTune: {
          ...DEFAULT_FINE_TUNE,
          ...(parsed.fineTune || prev.fineTune || {}),
        },
        melodyMode:
          parsed.melodyMode === 'random' || parsed.melodyMode === 'curated'
            ? parsed.melodyMode
            : prev.melodyMode || 'curated',
        disabledMelodies: Array.isArray(parsed.disabledMelodies)
          ? parsed.disabledMelodies
          : prev.disabledMelodies || [],
        ...(parsed.audioMixer || {}),
      }));
      if (Array.isArray(parsed.customStages) && parsed.customStages.length > 0) {
        setCustomStages(parsed.customStages);
        setActiveStageId(parsed.customStages[0].id);
      }
      setDevBundleStatus(`IMPORTED BUNDLE FROM ${file.name.toUpperCase()}`);
    } catch {
      setDevBundleStatus('INVALID DEV BUNDLE JSON FILE');
    }
    e.target.value = '';
  };

  const selectedAvatarDef = getCharacterById(cfg.playerShape);
  const allAvailableBiomes = getAllBiomes(cfg.customBiomes);
  const uniqueTraditions = [
    'ALL',
    ...Array.from(new Set(allAvailableBiomes.map((s) => s.tradition))),
  ];
  const filteredScales =
    traditionFilter === 'ALL'
      ? allAvailableBiomes
      : allAvailableBiomes.filter((s) => s.tradition === traditionFilter);

  const visibleFineTuneSliders =
    fineTuneCategory === 'ALL'
      ? FINE_TUNE_SLIDERS
      : FINE_TUNE_SLIDERS.filter((sl) => sl.category === fineTuneCategory);

  const filteredCuratedMelodies =
    melodyBiomeFilter === 'ALL'
      ? ALL_CURATED_MELODIES
      : ALL_CURATED_MELODIES.filter((m) => m.biomeId === melodyBiomeFilter);

  const keptMelodiesCount =
    ALL_CURATED_MELODIES.length - (cfg.disabledMelodies?.length || 0);
  const isFa = cfg.language === 'fa';
  const playerLvInfo = computePlayerLevelInfo(cfg.playerXp || 0);

  return (
    <main
      className={`fixed inset-0 w-full h-full bg-[#04050a] flex items-center justify-center overflow-hidden select-none ${
        isFa ? 'font-fa' : 'font-pixel'
      }`}
    >
      {/* Core Game Viewport: Fullscreen Edge-to-Edge on Mobile, 600x800 Cabinet on Desktop */}
      <div
        ref={containerRef}
        id="game-container"
        onMouseDown={(e) => {
          const sim = simRef.current;
          if (sim.state !== 'playing' || tutorialStep > 0 || isEditingDashLayout) return;
          const targetEl = e.target as HTMLElement | null;
          if (targetEl && targetEl.closest('button, input, label, select')) return;
          mouseTapRef.current = {
            down: true,
            startX: e.clientX,
            startY: e.clientY,
            startTimeMs: performance.now(),
          };
        }}
        onMouseUp={(e) => {
          const sim = simRef.current;
          const mt = mouseTapRef.current;
          if (!mt.down) return;
          mt.down = false;
          if (sim.state !== 'playing' || tutorialStep > 0 || isEditingDashLayout) return;
          const dashMode = sim.cfg.fineTune?.mobileDashMode ?? 'tap';
          const dtMs = performance.now() - mt.startTimeMs;
          const dist = Math.hypot(e.clientX - mt.startX, e.clientY - mt.startY);
          if (dashMode === 'tap' && dtMs < 260 && dist < 14) {
            sim.inputs.dashJustPressed = true;
          }
        }}
        onTouchStart={(e) => {
          const sim = simRef.current;
          if (sim.state !== 'playing' || isEditingDashLayout) return;
          const targetEl = e.target as HTMLElement | null;
          if (targetEl && targetEl.closest('button, input, label, select')) {
            return;
          }
          const dashMode = sim.cfg.fineTune?.mobileDashMode ?? 'tap';
          const td = touchDragRef.current;

          // If one finger is ALREADY holding/dragging to steer and a 2nd finger taps anywhere,
          // trigger Dash immediately while keeping the 1st finger's steering active simultaneously!
          if (td.active && dashMode === 'tap') {
            for (let i = 0; i < e.changedTouches.length; i++) {
              if (e.changedTouches[i].identifier !== td.touchId) {
                sim.inputs.dashJustPressed = true;
              }
            }
            return;
          }

          const touch = e.changedTouches[0];
          if (!touch) return;
          const nowMs = performance.now();
          touchDragRef.current = {
            active: true,
            touchId: touch.identifier,
            startX: touch.clientX,
            startY: touch.clientY,
            startTimeMs: nowMs,
            maxMoveDistPx: 0,
            anchorX: touch.clientX,
            lastX: touch.clientX,
            lastTimeMs: nowMs,
            speedBoost: 1.0,
          };
          sim.inputs.touchSteerX = 0;
        }}
        onTouchMove={(e) => {
          const sim = simRef.current;
          const td = touchDragRef.current;
          if (!td.active || sim.state !== 'playing' || isEditingDashLayout) return;
          let matchedTouch: React.Touch | undefined = undefined;
          for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === td.touchId) {
              matchedTouch = e.touches[i];
              break;
            }
          }
          if (!matchedTouch && e.touches.length > 0) {
            matchedTouch = e.touches[0];
          }
          if (!matchedTouch) return;

          const nowMs = performance.now();
          const dtSec = Math.max(0.004, Math.min(0.1, (nowMs - (td.lastTimeMs || nowMs - 16)) / 1000));
          const curX = matchedTouch.clientX;
          const curY = matchedTouch.clientY;
          const distFromStart = Math.hypot(curX - td.startX, curY - td.startY);
          if (distFromStart > td.maxMoveDistPx) {
            td.maxMoveDistPx = distFromStart;
          }

          const rangePx = Math.max(25, Math.min(200, sim.cfg.fineTune?.mobileTouchRangePx ?? 85));
          const anchorClamp = rangePx * 1.25;
          const stepDx = curX - td.lastX;
          const totalDx = curX - td.anchorX;
          const swipeVelPxPerSec = stepDx / dtSec;

          // Dynamic floating anchor: if finger reverses direction, slide anchor closer so direction change is responsive
          if ((totalDx > 16 && stepDx < -1.5) || (totalDx < -16 && stepDx > 1.5)) {
            td.anchorX = curX - stepDx * 4;
          } else if (Math.abs(totalDx) > anchorClamp) {
            td.anchorX = curX - Math.sign(totalDx) * anchorClamp;
          }
          td.lastX = curX;
          td.lastTimeMs = nowMs;

          const dispNorm = (curX - td.anchorX) / rangePx;
          const velNorm = swipeVelPxPerSec / (rangePx * 13);
          const rawNorm =
            Math.sign(dispNorm !== 0 ? dispNorm : velNorm) *
            Math.min(1, Math.max(Math.abs(dispNorm), Math.abs(dispNorm) * 0.72 + Math.abs(velNorm) * 0.35));
          td.speedBoost =
            0.85 +
            Math.min(1, Math.abs(swipeVelPxPerSec) / (rangePx * 15)) * 0.4 +
            Math.min(1, Math.abs(dispNorm)) * 0.35;

          const deadzone = 0.04;
          if (Math.abs(rawNorm) <= deadzone) {
            sim.inputs.touchSteerX = 0;
          } else {
            const sign = rawNorm > 0 ? 1 : -1;
            const mag = Math.min(1, (Math.abs(rawNorm) - deadzone) / (1 - deadzone));
            sim.inputs.touchSteerX = Number((sign * Math.pow(mag, 0.92)).toFixed(3));
          }
        }}
        onTouchEnd={(e) => {
          const sim = simRef.current;
          const td = touchDragRef.current;
          if (!td.active) return;

          const dashMode = sim.cfg.fineTune?.mobileDashMode ?? 'tap';
          let primaryFingerLifted = false;
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === td.touchId) {
              primaryFingerLifted = true;
              break;
            }
          }

          if (primaryFingerLifted) {
            const tapDurationMs = performance.now() - td.startTimeMs;
            // Single-tap anywhere (< 260ms and < 16px drag) triggers Dash in 'tap' mode!
            if (
              dashMode === 'tap' &&
              sim.state === 'playing' &&
              !isEditingDashLayout &&
              tapDurationMs < 260 &&
              td.maxMoveDistPx < 16
            ) {
              sim.inputs.dashJustPressed = true;
            }
          }

          let stillTouching = false;
          for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === td.touchId) {
              stillTouching = true;
              break;
            }
          }
          if (!stillTouching) {
            if (e.touches.length > 0) {
              // Seamlessly hand over steering to remaining finger on screen
              const nextTouch = e.touches[0];
              td.touchId = nextTouch.identifier;
              td.anchorX = nextTouch.clientX;
              td.lastX = nextTouch.clientX;
              td.maxMoveDistPx = 999;
            } else {
              td.active = false;
              sim.inputs.touchSteerX = 0;
            }
          }
        }}
        onTouchCancel={() => {
          touchDragRef.current.active = false;
          simRef.current.inputs.touchSteerX = 0;
        }}
        className="relative w-full h-full md:max-w-[600px] md:max-h-[800px] md:border md:border-slate-800 bg-[#04050a] shadow-[0_0_90px_rgba(0,0,0,0.9)] overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          id="canvas"
          data-testid="game-canvas"
          width={600}
          height={800}
          className="block w-full h-full"
        />

        {cfg.crtScanlines && (
          <div className="pointer-events-none absolute inset-0 crt-scanlines crt-vignette z-10" />
        )}

        {/* --- MINIMAL ICON-FIRST PLAYING HUD --- */}
        <div
          id="ui-hud"
          className={`pointer-events-none absolute inset-0 z-20 transition-opacity duration-200 ${
            screen === 'playing' || screen === 'paused' ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Compact Top-Left Score, Altitude & Flow Metrics */}
          <div className="absolute top-3.5 left-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <div
                ref={scoreDomRef}
                id="score"
                className="text-lg text-white drop-shadow-[0_2px_0_#000]"
              >
                0000
              </div>
              <div className="text-[9px] text-slate-300 flex items-center gap-2">
                <span className="text-emerald-400">
                  +<span ref={altDomRef}>0M</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                ref={comboTextDomRef}
                id="combo-meter"
                className="text-[9px] text-emerald-300"
              >
                FLOW x0
              </span>
              <span ref={milestoneDomRef} className="text-[8px] text-slate-400">
                &gt;x3
              </span>
            </div>

            <div className="relative w-36 h-1.5 bg-slate-900/90 border border-slate-700/80 overflow-hidden">
              <div
                ref={comboBarDomRef}
                id="combo-bar-fill"
                className="relative h-full bg-emerald-400 transition-none"
                style={{ width: '0%' }}
              />
            </div>

            {/* Compact Top-Corner Active Melody Title Indicator */}
            <div
              ref={melodyHudDomRef}
              id="melody-hud-indicator"
              data-testid="melody-hud-indicator"
              className="text-[8px] tracking-wider uppercase text-emerald-300 drop-shadow-[0_1px_0_#000] whitespace-nowrap mt-0.5"
            >
              🎼 MELODY · {simRef.current.activeCuratedMelody?.title || 'Neon Cyber Odyssey'}
            </div>
          </div>

          {/* Top-Right HUD: Heart Icons + Collected Orbs + Mute / Pause / Restart Buttons */}
          <div className="absolute top-3.5 right-4 flex items-center gap-2">
            {/* Heart Icons (Filled when healthy, Hollow when damaged) & Collected Orbs */}
            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800/90 px-2 py-1">
              <div
                ref={hpHeartsDomRef}
                id="hud-hp-badge"
                data-testid="hud-hp-badge"
                aria-label="Player Health Hearts"
                className="flex items-center justify-end gap-1 flex-wrap max-w-[118px]"
              >
                {Array.from({ length: 3 }, (_, idx) => (
                  <svg
                    key={idx}
                    data-heart-state="full"
                    viewBox="0 0 12 11"
                    className="w-3 h-3 shrink-0 drop-shadow-[0_0_4px_rgba(251,113,133,0.85)]"
                    style={{ shapeRendering: 'crispEdges' }}
                  >
                    <path
                      d="M2 1h3v1h2V1h3v1h1v3h-1v2H9v1H8v1H7v1H5V9H4V8H3V7H2V5H1V2h1V1z"
                      fill="#fb7185"
                    />
                    <rect x="2" y="2" width="2" height="1" fill="#ffe4e6" />
                  </svg>
                ))}
              </div>

              <div
                data-testid="hud-orbs-badge"
                className="flex items-center gap-1 text-[9px] text-amber-300 border-l border-slate-800 pl-2"
              >
                <RadiantOrbIcon size={11} />
                <span ref={orbsDomRef}>0</span>
              </div>
            </div>

            <div className="pointer-events-auto flex items-center gap-1">
              <button
                type="button"
                tabIndex={-1}
                aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setIsMuted((m) => !m);
                }}
                className="w-7 h-7 flex items-center justify-center bg-slate-900/90 border border-slate-700 hover:border-white text-slate-200 transition-colors cursor-pointer"
                title="Mute [M]"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                  {isMuted ? (
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  ) : (
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  )}
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Pause Game"
                onClick={(e) => {
                  e.currentTarget.blur();
                  if (screen === 'playing') {
                    audioRef.current.stopChoir();
                    setScreen('paused');
                  } else if (screen === 'paused') {
                    if (!isMuted) audioRef.current.resume();
                    setScreen('playing');
                  }
                }}
                className="w-7 h-7 flex items-center justify-center bg-slate-900/90 border border-slate-700 hover:border-white text-slate-200 transition-colors cursor-pointer"
                title="Pause [P]"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Restart Run"
                onClick={(e) => {
                  e.currentTarget.blur();
                  startNewRun(gameMode, undefined, true, simRef.current.activeStage);
                }}
                className="w-7 h-7 flex items-center justify-center bg-slate-900/90 border border-slate-700 hover:border-white text-slate-200 transition-colors cursor-pointer"
                title="Restart [R]"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                  <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Middle-Right Clickable Equipped ACTIVE Power-Up Loadout Slots (PASSIVE items apply automatically!) */}
          <RightSidePowerUpSlotsHud
            slotsCount={simRef.current.equippedSlotRuntimes.length}
            getSlotRuntime={(idx) => simRef.current.equippedSlotRuntimes[idx]}
            onActivateSlot={activateEquippedPowerUpSlot}
          />

          {/* Bottom-Right Compact Biome & Key Indicator */}
          <div
            ref={biomeTagDomRef}
            id="biome-tag"
            className="absolute bottom-3.5 right-4 text-[8px] tracking-wider uppercase text-emerald-400 opacity-85"
          >
            NEON GRID · C Minor Nine
          </div>

          {/* Mobile Touch Controls: Hold & Drag Steer Hint (Shown only for the first ~4 seconds of gameplay) */}
          <div
            ref={mobileHintDomRef}
            data-testid="mobile-gameplay-hint"
            className="md:hidden absolute bottom-28 left-4 pointer-events-none transition-opacity duration-200"
          >
            <div className="px-2.5 py-1.5 bg-slate-950/65 border border-slate-800/80 text-[7px] text-slate-400 uppercase">
              {(cfg.fineTune?.mobileDashMode ?? 'tap') === 'tap'
                ? '⇄ DRAG TO STEER · ⚡ TAP TO DASH'
                : '⇄ TOUCH & DRAG TO STEER'}
            </div>
          </div>

          {(cfg.fineTune?.mobileDashMode ?? 'tap') === 'button' && !isEditingDashLayout && (
            <div
              data-testid="hud-dash-btn-wrapper"
              style={{
                left: `${cfg.fineTune?.dashBtnXPercent ?? 84}%`,
                top: `${cfg.fineTune?.dashBtnYPercent ?? 80}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute z-20 pointer-events-auto"
            >
              <CircularPixelDashButton
                sizePx={cfg.fineTune?.dashBtnSizePx ?? 54}
                getDashCooldownState={() => {
                  const s = simRef.current;
                  const b = MASTER_SCALES[s.activeBiomeIdx] || MASTER_SCALES[0];
                  return {
                    dashCool: s.player.dashCool,
                    dashMaxCool: s.player.dashMaxCool,
                    dashAct: s.player.dashAct,
                    primaryColor: b.fg || '#00ff88',
                    horizonColor: b.bgAccent || '#00d4ff',
                  };
                }}
                onTriggerDash={() => {
                  simRef.current.inputs.dashJustPressed = true;
                }}
              />
            </div>
          )}
        </div>

        {/* --- FIRST-TIME 3-STEP ANIMATED PIXEL-HAND TUTORIAL OVERLAY --- */}
        {screen === 'playing' && tutorialStep > 0 && (
          <div
            id="pixel-hand-tutorial-overlay"
            data-testid="pixel-hand-tutorial-overlay"
            onClick={() => {
              if (!isMuted) audioRef.current.sfxUiClick(MASTER_SCALES[0], cfg);
              if (tutorialStep < 3) {
                setTutorialStep((prev) => (prev + 1) as 1 | 2 | 3);
              } else {
                setCfg((prev) => ({ ...prev, tutorialSeen: true }));
                setTutorialStep(0);
              }
            }}
            className="pointer-events-auto absolute inset-0 z-40 bg-[#04050a]/85 flex flex-col items-center justify-between py-8 px-6 text-center cursor-pointer"
          >
            <div className="px-3 py-1 bg-slate-900/95 border border-emerald-400/70 text-[9px] text-emerald-300 uppercase tracking-wider">
              {isFa
                ? `آموزش سریع · گام ${tutorialStep} از ۳`
                : `HOW TO PLAY · STEP ${tutorialStep} OF 3`}
            </div>

            {/* Interactive Animated Pixel-Art Stage Demonstration */}
            <div className="my-auto w-full max-w-xs bg-slate-950/95 border-2 border-cyan-400/70 p-5 shadow-[0_0_35px_rgba(0,212,255,0.22)] flex flex-col items-center gap-4">
              {tutorialStep === 1 && (
                <>
                  <div className="text-xs text-white uppercase">
                    {isFa ? '۱. کشیدن انگشت به چپ و راست' : '1. SLIDE LEFT & RIGHT'}
                  </div>
                  <div className="text-[8px] text-slate-300 leading-relaxed">
                    {isFa
                      ? 'انگشت خود را روی صفحه نگه دارید و به چپ و راست بکشید تا کاراکتر روی پلتفرم‌های نئونی هدایت شود.'
                      : 'Hold and slide your finger left & right anywhere on screen to steer your avatar across harmonic platforms.'}
                  </div>
                  <div className="relative w-full h-32 bg-slate-900/90 border border-slate-800 overflow-hidden flex items-center justify-center">
                    <style>{`
                      @keyframes tutSlideX {
                        0%, 100% { transform: translateX(-62px); }
                        50% { transform: translateX(62px); }
                      }
                    `}</style>
                    {/* Neon Platform */}
                    <div className="absolute bottom-9 w-36 h-2.5 bg-emerald-400 shadow-[0_0_12px_#00ff88]" />
                    {/* Synchronized Moving Character + Pixel Hand */}
                    <div
                      style={{ animation: 'tutSlideX 2.1s ease-in-out infinite' }}
                      className="flex flex-col items-center gap-2"
                    >
                      <SelectedAvatarMiniBadge
                        avatarId={cfg.playerShape}
                        primaryColor="#00ff88"
                        horizonColor="#00d4ff"
                      />
                      {/* Pixel Hand Icon */}
                      <svg
                        viewBox="0 0 16 16"
                        className="w-8 h-8 drop-shadow-[0_0_8px_#00d4ff]"
                        style={{ shapeRendering: 'crispEdges' }}
                      >
                        <rect x="6" y="1" width="3" height="7" fill="#ffffff" />
                        <rect x="4" y="6" width="8" height="6" fill="#ffffff" />
                        <rect x="3" y="7" width="2" height="4" fill="#cbd5e1" />
                        <rect x="5" y="12" width="6" height="3" fill="#e2e8f0" />
                        <rect x="7" y="1" width="1" height="2" fill="#38bdf8" />
                      </svg>
                    </div>
                  </div>
                </>
              )}

              {tutorialStep === 2 && (
                <>
                  <div className="text-xs text-amber-300 uppercase">
                    {isFa ? '۲. ضربه روی دکمه دش (⚡)' : '2. TAP CIRCULAR DASH (⚡)'}
                  </div>
                  <div className="text-[8px] text-slate-300 leading-relaxed">
                    {isFa
                      ? 'روی دکمه دایره‌ای ⚡ ضربه بزنید تا کاراکتر با دنباله روح‌مانند در جهت نگاهش جهش کند!'
                      : 'Tap the circular ⚡ button to Phase Dash in your facing direction with a spectral ghost trail!'}
                  </div>
                  <div className="relative w-full h-32 bg-slate-900/90 border border-slate-800 overflow-hidden flex items-center justify-between px-5">
                    <style>{`
                      @keyframes tutDashBurst {
                        0%, 35% { transform: translate(0px, 8px) scale(1); opacity: 1; }
                        60%, 85% { transform: translate(68px, -18px) scale(1.15, 0.85); opacity: 1; }
                        100% { transform: translate(0px, 8px) scale(1); opacity: 1; }
                      }
                      @keyframes tutHandTap {
                        0%, 30%, 100% { transform: translate(12px, 14px) scale(1); }
                        45%, 60% { transform: translate(0px, 0px) scale(0.88); }
                      }
                    `}</style>
                    {/* Ghost Trail + Character Launching */}
                    <div className="relative flex items-center">
                      <div className="opacity-30 -mr-4 scale-90">
                        <SelectedAvatarMiniBadge
                          avatarId={cfg.playerShape}
                          primaryColor="#00d4ff"
                          horizonColor="#00ff88"
                        />
                      </div>
                      <div className="opacity-55 -mr-3 scale-95">
                        <SelectedAvatarMiniBadge
                          avatarId={cfg.playerShape}
                          primaryColor="#00d4ff"
                          horizonColor="#00ff88"
                        />
                      </div>
                      <div style={{ animation: 'tutDashBurst 2.0s ease-in-out infinite' }}>
                        <SelectedAvatarMiniBadge
                          avatarId={cfg.playerShape}
                          primaryColor="#00ff88"
                          horizonColor="#00d4ff"
                        />
                      </div>
                    </div>

                    {/* Circular Dash Button + Tapping Pixel Hand */}
                    <div className="relative flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full border-2 border-emerald-400 bg-emerald-500/30 flex items-center justify-center text-base text-white shadow-[0_0_16px_#00ff88]">
                        ⚡
                      </div>
                      <svg
                        viewBox="0 0 16 16"
                        style={{
                          animation: 'tutHandTap 2.0s ease-in-out infinite',
                          shapeRendering: 'crispEdges',
                        }}
                        className="absolute -bottom-3 -right-2 w-8 h-8 drop-shadow-[0_0_8px_#fde047]"
                      >
                        <rect x="6" y="1" width="3" height="7" fill="#ffffff" />
                        <rect x="4" y="6" width="8" height="6" fill="#ffffff" />
                        <rect x="5" y="12" width="6" height="3" fill="#fde047" />
                      </svg>
                    </div>
                  </div>
                </>
              )}

              {tutorialStep === 3 && (
                <>
                  <div className="text-xs text-pink-300 uppercase">
                    {isFa ? '۳. فعال‌سازی پاورآپ‌ها' : '3. ACTIVATE POWER-UPS'}
                  </div>
                  <div className="text-[8px] text-slate-300 leading-relaxed">
                    {isFa
                      ? 'وقتی دایره پاورآپ‌های سمت راست پر شد، روی آن‌ها بزنید تا جت‌پک، سپر یا مگنت فعال شود!'
                      : 'When the right-side Power-Up circles fill up, tap them to unleash Jetpacks, Shields, or Magnets!'}
                  </div>
                  <div className="relative w-full h-32 bg-slate-900/90 border border-slate-800 overflow-hidden flex items-center justify-around px-5">
                    <div className="relative p-2 rounded-full border-2 border-amber-300 bg-amber-400/20 shadow-[0_0_20px_#fde047]">
                      <SelectedAvatarMiniBadge
                        avatarId={cfg.playerShape}
                        primaryColor="#fde047"
                        horizonColor="#f472b6"
                      />
                    </div>
                    <div className="flex flex-col gap-2 relative">
                      <div className="w-10 h-10 rounded-full border-2 border-sky-400 bg-sky-500/35 flex items-center justify-center text-xs shadow-[0_0_14px_#38bdf8]">
                        🚀
                      </div>
                      <div className="w-10 h-10 rounded-full border-2 border-emerald-400 bg-emerald-500/35 flex items-center justify-center text-xs">
                        🛡
                      </div>
                      <svg
                        viewBox="0 0 16 16"
                        style={{ shapeRendering: 'crispEdges' }}
                        className="absolute -top-1 -right-3 w-8 h-8 animate-bounce drop-shadow-[0_0_8px_#f472b6]"
                      >
                        <rect x="6" y="1" width="3" height="7" fill="#ffffff" />
                        <rect x="4" y="6" width="8" height="6" fill="#ffffff" />
                        <rect x="5" y="12" width="6" height="3" fill="#f472b6" />
                      </svg>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-5 py-2.5 bg-emerald-400 text-slate-950 text-[10px] uppercase tracking-wider animate-pulse shadow-[0_0_20px_rgba(0,255,136,0.4)]">
              {isFa
                ? tutorialStep < 3
                  ? 'برای ادامه ضربه بزنید ◄'
                  : 'شروع بازی! ◄'
                : tutorialStep < 3
                ? 'TAP TO CONTINUE >'
                : 'TAP TO START GAME >'}
            </div>
          </div>
        )}

        {/* --- MINIMAL ICON-FIRST TITLE SCREEN OVERLAY --- */}
        {screen === 'title' && (
          <div
            id="start-screen"
            className="absolute inset-0 z-30 bg-[#04050a]/84 flex flex-col items-center justify-between py-5 px-5 text-center"
          >
            {/* Top Minimal Icon Bar + Clickable Level Badge + Radiant Orb Icon + Mute & Language Buttons */}
            <div className="w-full flex flex-wrap items-center justify-between gap-2 text-[8px] text-slate-300 border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  data-testid="title-level-badge"
                  onClick={() => {
                    if (!isMuted) audioRef.current.sfxUiClick(MASTER_SCALES[0], cfg);
                    setShowLevelRoadmapModal(true);
                  }}
                  className="px-2 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400 text-emerald-300 cursor-pointer transition-colors"
                  title="Click to view 15-Level Progression Roadmap & Detailed Stats"
                >
                  ⭐ LV.{playerLvInfo.level} ▾
                </button>
                <span title="High Score">
                  {isFa ? 'رکورد' : 'BEST'}{' '}
                  <strong className="text-amber-400">{stats.highScore}</strong>
                </span>
                <span title="Max Flow">
                  {isFa ? 'فلو' : 'FLOW'}{' '}
                  <strong className="text-emerald-400">x{stats.maxCombo}</strong>
                </span>
                <span className="inline-flex items-center gap-1" title="Harmonic Orbs">
                  <RadiantOrbIcon size={13} />
                  <strong className="text-amber-300">{stats.totalOrbs}</strong>
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-testid="title-mute-btn"
                  aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                  onClick={() => setIsMuted((m) => !m)}
                  className={`px-2 py-1 border text-[8px] cursor-pointer transition-colors ${
                    isMuted
                      ? 'bg-rose-950/60 border-rose-400 text-rose-300'
                      : 'bg-slate-900 border-slate-700 hover:border-white text-emerald-300'
                  }`}
                  title="Mute / Unmute [M]"
                >
                  {isMuted ? '🔇 MUTE' : '🔊 AUDIO'}
                </button>
                <button
                  type="button"
                  data-testid="title-lang-btn"
                  onClick={() =>
                    setCfg((prev) => ({
                      ...prev,
                      language: prev.language === 'fa' ? 'en' : 'fa',
                    }))
                  }
                  className="px-2 py-1 bg-slate-900 border border-cyan-400/70 hover:border-cyan-300 text-cyan-300 text-[8px] cursor-pointer"
                  title="Switch Language (English / فارسی)"
                >
                  🌐 {isFa ? 'EN' : 'فارسی'}
                </button>
              </div>
            </div>

            <div className="my-auto flex flex-col items-center max-w-xs w-full">
              <svg
                viewBox="0 0 460 105"
                className="w-full max-w-[360px] h-auto mb-3 overflow-visible"
                role="img"
                aria-label="Neon Ascent: Omni"
              >
                <defs>
                  <linearGradient id="omniTitleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#00ff88" />
                    <stop offset="50%" stopColor="#00d4ff" />
                    <stop offset="100%" stopColor="#ff2a85" />
                  </linearGradient>
                </defs>
                <rect
                  x="216"
                  y="8"
                  width="28"
                  height="28"
                  fill="none"
                  stroke="url(#omniTitleGrad)"
                  strokeWidth="3"
                />
                <rect x="225" y="17" width="10" height="10" fill="#00ff88" />
                <line x1="60" y1="22" x2="198" y2="22" stroke="#1e293b" strokeWidth="2" />
                <line x1="262" y1="22" x2="400" y2="22" stroke="#1e293b" strokeWidth="2" />
                <text
                  x="230"
                  y="72"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontFamily="'Press Start 2P', monospace"
                  fontSize="24"
                  letterSpacing="3"
                >
                  NEON ASCENT
                </text>
                <text
                  x="230"
                  y="96"
                  textAnchor="middle"
                  fill="url(#omniTitleGrad)"
                  fontFamily="'Press Start 2P', monospace"
                  fontSize="10"
                  letterSpacing="5"
                >
                  OMNI EDITION
                </text>
              </svg>

              <div className="flex flex-col items-center gap-2 w-full mt-1">
                {/* Primary Play Action (Triggers 3-Step Pixel-Hand Tutorial on First Run!) */}
                <button
                  type="button"
                  data-start="true"
                  data-testid="start-play-btn"
                  onClick={() => {
                    startNewRun('STANDARD');
                    if (!cfg.tutorialSeen) {
                      setTutorialStep(1);
                    }
                  }}
                  className="w-full py-3.5 px-6 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs tracking-wider uppercase transition-transform active:scale-95 cursor-pointer shadow-[0_0_25px_rgba(0,255,136,0.35)]"
                >
                  {isFa ? '▶ شروع بازی (PLAY)' : '> PLAY'}
                </button>

                {/* Compact Selected Character Button -> Opens Store with AVATARS tab active so all Shop tabs remain at top! */}
                <button
                  type="button"
                  id="open-characters-btn"
                  data-testid="open-characters-btn"
                  onClick={() => {
                    if (!isMuted) audioRef.current.sfxUiClick(MASTER_SCALES[0], cfg);
                    setStoreTab('characters');
                    setScreen('store');
                  }}
                  className="w-full py-2 px-3 bg-slate-900/95 hover:bg-slate-800 border border-cyan-400/75 hover:border-cyan-300 transition-colors cursor-pointer flex items-center justify-between gap-2 text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <SelectedAvatarMiniBadge
                      avatarId={cfg.playerShape}
                      primaryColor="#00ff88"
                      horizonColor="#00d4ff"
                    />
                    <div className="min-w-0">
                      <div className="text-[9px] text-white uppercase truncate">
                        {selectedAvatarDef.name}
                      </div>
                      <div className="text-[7px] text-cyan-300 truncate mt-0.5">
                        * {selectedAvatarDef.perkTitle}
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] text-cyan-300 shrink-0">&gt;</span>
                </button>

                {/* Minimal 4-Column Icon Row for Stage DAW, Store, Ranked Leaderboard & Level Roadmap */}
                <div className="grid grid-cols-4 gap-1.5 w-full">
                  <button
                    type="button"
                    id="open-stage-creator-btn"
                    data-testid="open-stage-creator-btn"
                    onClick={() => {
                      if (!isMuted) audioRef.current.sfxUiClick(MASTER_SCALES[0], cfg);
                      setScreen('stage_creator');
                    }}
                    className="py-2.5 px-1.5 bg-slate-900/95 hover:bg-slate-800 border border-emerald-400/80 hover:border-emerald-300 text-emerald-300 text-[8px] uppercase transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>🎹 {isFa ? 'ساخت' : 'DAW'}</span>
                    <span className="text-[7px] text-slate-400">{customStages.length}</span>
                  </button>

                  <button
                    type="button"
                    id="open-store-btn"
                    data-testid="open-store-btn"
                    onClick={() => {
                      if (!isMuted) audioRef.current.sfxUiClick(MASTER_SCALES[0], cfg);
                      setScreen('store');
                    }}
                    className="py-2.5 px-1.5 bg-slate-900/95 hover:bg-slate-800 border border-amber-400/80 hover:border-amber-300 text-amber-300 text-[8px] uppercase transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>🛒 {isFa ? 'شاپ' : 'SHOP'}</span>
                    <span className="inline-flex items-center gap-0.5 text-[7px] text-amber-300">
                      <RadiantOrbIcon size={10} />
                      {stats.totalOrbs}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-testid="open-ranked-leaderboard-btn"
                    onClick={() => {
                      if (!isMuted) audioRef.current.sfxUiClick(MASTER_SCALES[0], cfg);
                      fetchTelegramLeaderboard().then((list) => setRankedLeaderboard(list));
                      setShowRankedModal(true);
                    }}
                    className="py-2.5 px-1.5 bg-slate-900/95 hover:bg-slate-800 border border-cyan-400/80 hover:border-cyan-300 text-cyan-300 text-[8px] uppercase transition-colors cursor-pointer text-center"
                  >
                    🏆 {isFa ? 'رنکینگ' : 'RANKED'}
                  </button>

                  <button
                    type="button"
                    data-testid="open-level-roadmap-btn"
                    onClick={() => {
                      if (!isMuted) audioRef.current.sfxUiClick(MASTER_SCALES[0], cfg);
                      setShowLevelRoadmapModal(true);
                    }}
                    className="py-2.5 px-1.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-600 hover:border-pink-400 text-pink-300 text-[8px] uppercase transition-colors cursor-pointer text-center"
                  >
                    ⭐ {isFa ? `لول ${playerLvInfo.level}` : `LV.${playerLvInfo.level}`}
                  </button>
                </div>

                {/* Config / Export / Beta Reset / Install Row (Hidden in Telegram Release Build) */}
                {(!telegramSession.isTelegramEnv || deferredInstallPrompt) && (
                  <div className="flex items-center justify-center gap-1.5 w-full">
                    {!telegramSession.isTelegramEnv && (
                      <>
                        <button
                          type="button"
                          id="open-settings-btn"
                          data-testid="open-settings-btn"
                          onClick={() => {
                            if (!isMuted) audioRef.current.sfxUiClick(MASTER_SCALES[0], cfg);
                            setScreen('settings');
                          }}
                          className="flex-1 py-2 px-2 bg-transparent hover:bg-slate-900 border border-slate-700 hover:border-white text-slate-300 text-[8px] uppercase transition-colors cursor-pointer"
                        >
                          ⚙ {isFa ? 'تنظیمات' : 'FINE-TUNE'}
                        </button>

                        <button
                          type="button"
                          data-testid="beta-reset-save-btn"
                          onClick={handleResetAllSaveData}
                          className="py-2 px-2 bg-transparent hover:bg-rose-950/50 border border-rose-500/60 hover:border-rose-400 text-rose-300 text-[8px] uppercase transition-colors cursor-pointer"
                          title="Beta: Reset All Save Data & Stats to Zero"
                        >
                          ↺ {isFa ? 'ریست' : 'RESET'}
                        </button>

                        <button
                          type="button"
                          onClick={handleExportDevBundleFile}
                          className="py-2 px-2 bg-transparent hover:bg-slate-900 border border-slate-700 hover:border-amber-400 text-amber-300 text-[8px] uppercase transition-colors cursor-pointer"
                          title="Export Dev Bundle (.JSON)"
                        >
                          .JSON
                        </button>
                      </>
                    )}

                    {deferredInstallPrompt && (
                      <button
                        type="button"
                        onClick={async () => {
                          await deferredInstallPrompt.prompt();
                          await deferredInstallPrompt.userChoice;
                          setDeferredInstallPrompt(null);
                        }}
                        className="py-2 px-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400 text-emerald-300 text-[8px] uppercase cursor-pointer"
                        title="Install App on Android / Desktop"
                      >
                        📲 APP
                      </button>
                    )}
                  </div>
                )}
              </div>

              {midiStatus && (
                <div className="mt-2 text-[8px] text-amber-400">{midiStatus}</div>
              )}
            </div>

            {/* Minimal Icon Legend */}
            <div className="flex items-center justify-center gap-4 text-[8px] text-slate-400">
              <span>⇄ {isFa ? 'کشیدن انگشت' : 'DRAG/STEER'}</span>
              <span>{isFa ? 'ژیروسکوپ' : 'TILT'}</span>
              <span>⚡ {isFa ? 'دش' : 'DASH'}</span>
            </div>
          </div>
        )}

        {/* --- REACTIVE-EYE CHARACTER SELECTOR MODAL --- */}
        {screen === 'characters' && (
          <CharacterSelectModal
            selectedAvatarId={cfg.playerShape}
            unlockedAvatars={cfg.unlockedAvatars}
            totalOrbs={stats.totalOrbs}
            primaryColor="#00ff88"
            horizonColor="#00d4ff"
            bpm={cfg.fineTune?.baseJumpTempo || 100}
            menuBeatInfoRef={menuBeatInfoRef}
            onSelectAvatar={handleSelectAvatar}
            onUnlockAvatar={handleUnlockAvatar}
            onSetOrbs={handleSetExactOrbs}
            hideOrbSetter={telegramSession.isTelegramEnv}
            onClose={() => setScreen('title')}
          />
        )}

        {/* --- CREATE STAGE (DAW PIANO ROLL, CUSTOM BIOME BUILDER & STAGE MANAGER) MODAL --- */}
        {screen === 'stage_creator' && (
          <StageCreatorModal
            stages={customStages}
            activeStageId={activeStageId}
            cfg={cfg}
            audioEngine={audioRef.current}
            isMuted={isMuted}
            onSaveStages={(nextStages, nextActiveId) => {
              setCustomStages(nextStages);
              if (nextActiveId) setActiveStageId(nextActiveId);
            }}
            onSaveCustomBiomes={(nextCustomBiomes) => {
              setCfg((prev) => ({
                ...prev,
                customBiomes: nextCustomBiomes,
                unlockedScales: Array.from(
                  new Set([...prev.unlockedScales, ...nextCustomBiomes.map((b) => b.id)])
                ),
                enabledScales: Array.from(
                  new Set([...prev.enabledScales, ...nextCustomBiomes.map((b) => b.id)])
                ),
              }));
            }}
            onPlayStage={(stage) => {
              setActiveStageId(stage.id);
              startNewRun('STAGE', undefined, true, stage);
            }}
            onClose={() => setScreen('title')}
          />
        )}

        {/* --- MINIMAL ICON-DRIVEN HARMONIC STORE MODAL --- */}
        {screen === 'store' && (() => {
          const unlockedSlots = computeUnlockedPowerUpSlots(stats.highScore, cfg.playerLevel);
          const nextSlotMilestone = getNextPowerUpSlotMilestone(stats.highScore);
          const equippedList = (
            cfg.equippedPowerUps && cfg.equippedPowerUps.length > 0
              ? cfg.equippedPowerUps
              : (['orb_magnet', 'combo_shield', 'jetpack_white'] as PowerUpItemId[])
          ).slice(0, unlockedSlots);
          const unlockedPowerUpCount = POWERUP_STORE_ITEMS.filter(
            (it) => (cfg.powerUpLevels?.[it.id] || 0) > 0
          ).length;
          const visibleStorePowerUps = POWERUP_STORE_ITEMS.filter((it) =>
            powerUpModeFilter === 'ALL' ? true : it.activationMode === powerUpModeFilter
          );
          const visibleAvatarTotal = CHARACTER_AVATARS.filter(
            (a) => !a.isSecret || cfg.unlockedAvatars.includes(a.id)
          ).length;

          return (
            <div
              id="store-screen"
              className="absolute inset-0 z-30 bg-[#05070f]/96 flex flex-col justify-between p-4 overflow-hidden text-[9px]"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400">🛒</span>
                  <h2 className="text-xs text-white tracking-wider uppercase">
                    {isFa ? 'فروشگاه نئونی' : 'SHOP'}
                  </h2>
                  <button
                    type="button"
                    data-testid="store-level-badge"
                    onClick={() => setShowLevelRoadmapModal(true)}
                    className="px-1.5 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400 text-[7px] text-emerald-300 cursor-pointer"
                    title="View 15-Level Roadmap & Stats"
                  >
                    ⭐ LV.{playerLvInfo.level}/15 ▾
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2.5 py-1 bg-slate-900 border border-amber-400/60 text-[9px] text-amber-300 flex items-center gap-1.5">
                    <RadiantOrbIcon size={14} />
                    <strong id="store-orb-count">{stats.totalOrbs}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScreen('title')}
                    className="px-3 py-1.5 bg-emerald-400 text-slate-950 text-[9px] uppercase cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Store Category Tabs (Stay visible even when entering Character Menu from Main Menu!) */}
              <div className="flex flex-wrap items-center justify-between gap-2 my-2">
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    data-testid="store-tab-powerups"
                    onClick={() => setStoreTab('powerups')}
                    className={`px-2 py-1.5 text-[7px] uppercase border cursor-pointer ${
                      storeTab === 'powerups'
                        ? 'bg-pink-500/20 border-pink-400 text-pink-200'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    ⚡ POWER-UPS ({unlockedPowerUpCount}/{POWERUP_STORE_ITEMS.length})
                  </button>
                  <button
                    type="button"
                    data-testid="store-tab-characters"
                    onClick={() => setStoreTab('characters')}
                    className={`px-2 py-1.5 text-[7px] uppercase border cursor-pointer ${
                      storeTab === 'characters'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    ◈ AVATARS ({cfg.unlockedAvatars.length}/{visibleAvatarTotal})
                  </button>
                  <button
                    type="button"
                    data-testid="store-tab-banks"
                    onClick={() => setStoreTab('banks')}
                    className={`px-2 py-1.5 text-[7px] uppercase border cursor-pointer ${
                      storeTab === 'banks'
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    🔊 SYNTH ({cfg.unlockedSoundBanks.length}/{SOUND_BANKS.length})
                  </button>
                  <button
                    type="button"
                    data-testid="store-tab-scales"
                    onClick={() => setStoreTab('scales')}
                    className={`px-2 py-1.5 text-[7px] uppercase border cursor-pointer ${
                      storeTab === 'scales'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    ♫ KEYS ({cfg.unlockedScales.length}/{allAvailableBiomes.length})
                  </button>
                </div>

                {!telegramSession.isTelegramEnv && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={999999}
                      placeholder="Orbs..."
                      value={storeOrbInput}
                      onChange={(e) => setStoreOrbInput(e.target.value)}
                      className="w-20 px-1.5 py-1 bg-slate-950 border border-slate-700 text-[8px] text-amber-300"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = parseInt(storeOrbInput, 10);
                        if (!Number.isNaN(val)) {
                          handleSetExactOrbs(val);
                          setStoreOrbInput('');
                        }
                      }}
                      className="px-2 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 text-[8px] uppercase cursor-pointer"
                    >
                      SET
                    </button>
                  </div>
                )}
              </div>

              {storeTab === 'powerups' ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Loadout Slots Manager — Separated into ACTIVE (HUD Buttons) and PASSIVE (Innate Perks) */}
                  <div
                    data-testid="powerup-loadout-bar"
                    className="mb-2 p-2.5 bg-slate-900/95 border border-pink-400/50 flex flex-col gap-2 shrink-0"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                      <span className="text-[8px] text-pink-300 uppercase">
                        LOADOUT CAPACITY ({equippedList.length}/{unlockedSlots} SLOTS USED)
                      </span>
                      <span className="text-[7px] text-slate-400">
                        {unlockedSlots < 7
                          ? `NEXT SLOT AT LV.${unlockedSlots === 3 ? 3 : unlockedSlots === 4 ? 6 : unlockedSlots === 5 ? 9 : 12} OR ${nextSlotMilestone} PTS`
                          : 'ALL 7 SLOTS UNLOCKED'}
                      </span>
                    </div>

                    {(() => {
                      const equippedItems = equippedList
                        .map((id) => getPowerUpItemById(id))
                        .filter((it): it is PowerUpStoreItemDef => it !== undefined);
                      const activeEquipped = equippedItems.filter(
                        (it) => it.activationMode === 'ACTIVE'
                      );
                      const passiveEquipped = equippedItems.filter(
                        (it) => it.activationMode === 'PASSIVE'
                      );
                      const freeSlotsCount = Math.max(0, unlockedSlots - equippedItems.length);
                      const lockedSlotsCount = Math.max(0, 7 - unlockedSlots);

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* ACTIVE HUD SLOTS SECTION */}
                          <div
                            data-testid="loadout-active-section"
                            className="p-2 bg-slate-950/90 border border-emerald-500/40 flex flex-col gap-1.5"
                          >
                            <div className="flex items-center justify-between text-[7px]">
                              <span className="text-emerald-300 uppercase">
                                ⚡ ACTIVE HUD SLOTS ({activeEquipped.length})
                              </span>
                              <span className="text-slate-400">IN-GAME BUTTONS</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap min-h-[28px]">
                              {activeEquipped.map((eqItem) => (
                                <button
                                  key={eqItem.id}
                                  type="button"
                                  onClick={() => handleToggleEquipPowerUp(eqItem.id)}
                                  title={`${eqItem.name} (ACTIVE) — Click to unequip`}
                                  className="h-7 px-2 bg-emerald-950/60 border border-emerald-400 hover:border-rose-400 text-white flex items-center gap-1 text-[8px] cursor-pointer"
                                >
                                  <span>{eqItem.icon}</span>
                                  <span className="text-[7px] text-emerald-200 truncate max-w-[72px]">
                                    {eqItem.name.split(' ')[0]}
                                  </span>
                                  <span className="text-[6px] text-amber-300">
                                    L{cfg.powerUpLevels?.[eqItem.id] || 1}
                                  </span>
                                  <span className="text-[7px] text-rose-300 ml-0.5">✕</span>
                                </button>
                              ))}
                              {activeEquipped.length === 0 && (
                                <span className="text-[7px] text-slate-500 italic">
                                  No Active HUD Power-Ups equipped
                                </span>
                              )}
                            </div>
                          </div>

                          {/* PASSIVE INNATE SLOTS SECTION */}
                          <div
                            data-testid="loadout-passive-section"
                            className="p-2 bg-slate-950/90 border border-cyan-500/40 flex flex-col gap-1.5"
                          >
                            <div className="flex items-center justify-between text-[7px]">
                              <span className="text-cyan-300 uppercase">
                                🧬 PASSIVE INNATE SLOTS ({passiveEquipped.length})
                              </span>
                              <span className="text-slate-400">ALWAYS ON IN RUN</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap min-h-[28px]">
                              {passiveEquipped.map((eqItem) => (
                                <button
                                  key={eqItem.id}
                                  type="button"
                                  onClick={() => handleToggleEquipPowerUp(eqItem.id)}
                                  title={`${eqItem.name} (PASSIVE) — Click to unequip`}
                                  className="h-7 px-2 bg-cyan-950/60 border border-cyan-400 hover:border-rose-400 text-white flex items-center gap-1 text-[8px] cursor-pointer"
                                >
                                  <span>{eqItem.icon}</span>
                                  <span className="text-[7px] text-cyan-200 truncate max-w-[72px]">
                                    {eqItem.name.split(' ')[0]}
                                  </span>
                                  <span className="text-[6px] text-amber-300">
                                    L{cfg.powerUpLevels?.[eqItem.id] || 1}
                                  </span>
                                  <span className="text-[7px] text-rose-300 ml-0.5">✕</span>
                                </button>
                              ))}
                              {passiveEquipped.length === 0 && (
                                <span className="text-[7px] text-slate-500 italic">
                                  No Passive Innate Perks equipped
                                </span>
                              )}
                            </div>
                          </div>

                          {/* FREE & LOCKED CAPACITY PILLS */}
                          {(freeSlotsCount > 0 || lockedSlotsCount > 0) && (
                            <div className="sm:col-span-2 flex items-center gap-1.5 flex-wrap pt-0.5">
                              {Array.from({ length: freeSlotsCount }, (_, idx) => (
                                <span
                                  key={`free_${idx}`}
                                  className="px-2 py-0.5 bg-slate-950 border border-dashed border-emerald-400/50 text-[7px] text-emerald-300"
                                >
                                  + OPEN SLOT READY
                                </span>
                              ))}
                              {Array.from({ length: lockedSlotsCount }, (_, idx) => {
                                const slotIdx = unlockedSlots + idx;
                                const reqLv =
                                  slotIdx === 3 ? 3 : slotIdx === 4 ? 6 : slotIdx === 5 ? 9 : 12;
                                return (
                                  <span
                                    key={`lock_${idx}`}
                                    className="px-2 py-0.5 bg-slate-950/50 border border-slate-800 text-[7px] text-slate-500"
                                  >
                                    🔒 SLOT #{slotIdx + 1} (LV.{reqLv})
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Two Power-Up Category Filter Buttons: ACTIVE (Button-Triggered) vs. PASSIVE (Innate Character Ability) */}
                  <div className="flex items-center gap-1.5 mb-2 shrink-0">
                    <button
                      type="button"
                      data-testid="powerup-filter-all"
                      onClick={() => setPowerUpModeFilter('ALL')}
                      className={`px-2 py-1 text-[7px] border uppercase cursor-pointer ${
                        powerUpModeFilter === 'ALL'
                          ? 'bg-white/15 border-white text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      ALL ({POWERUP_STORE_ITEMS.length})
                    </button>
                    <button
                      type="button"
                      data-testid="powerup-filter-active"
                      onClick={() => setPowerUpModeFilter('ACTIVE')}
                      className={`px-2 py-1 text-[7px] border uppercase cursor-pointer ${
                        powerUpModeFilter === 'ACTIVE'
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      ⚡ ACTIVE · HUD BUTTON (7)
                    </button>
                    <button
                      type="button"
                      data-testid="powerup-filter-passive"
                      onClick={() => setPowerUpModeFilter('PASSIVE')}
                      className={`px-2 py-1 text-[7px] border uppercase cursor-pointer ${
                        powerUpModeFilter === 'PASSIVE'
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      🧬 PASSIVE · INNATE ABILITY (5)
                    </button>
                  </div>

                  {/* Scrollable Power-Ups Grid */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {visibleStorePowerUps.map((item) => {
                      const maxLv = item.maxLevel || 10;
                      const currentLv = Math.max(
                        0,
                        Math.min(maxLv, Math.floor(cfg.powerUpLevels?.[item.id] ?? 0))
                      );
                      const isUnlocked = currentLv > 0;
                      const isMax = currentLv >= maxLv;
                      const isEquipped = equippedList.includes(item.id);
                      const upgradeCost = getPowerUpUpgradeCost(item, currentLv);
                      const canAfford = !isMax && stats.totalOrbs >= upgradeCost;
                      const previewStats = getPowerUpLevelStats(
                        item.id,
                        Math.max(1, currentLv)
                      );
                      const nextStats = !isMax
                        ? getPowerUpLevelStats(item.id, currentLv + 1)
                        : previewStats;

                      return (
                        <div
                          key={item.id}
                          data-testid={`powerup-card-${item.id}`}
                          className={`p-2.5 border flex items-center justify-between gap-2 ${
                            isEquipped
                              ? 'bg-emerald-950/25 border-emerald-400/90'
                              : isUnlocked
                              ? 'bg-slate-900/80 border-slate-700'
                              : 'bg-slate-950/85 border-slate-800/80'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm">{item.icon}</span>
                              <span
                                className="text-[9px] uppercase"
                                style={{ color: item.accentColor }}
                              >
                                {item.name}
                              </span>
                              <span className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 text-[7px] text-amber-300">
                                {isUnlocked ? `LV.${currentLv}/${maxLv}` : `LOCKED (0/${maxLv})`}
                              </span>
                              {item.activationMode === 'PASSIVE' ? (
                                <span className="px-1.5 py-0.5 bg-cyan-950/90 border border-cyan-400/60 text-[6px] text-cyan-200">
                                  🧬 PASSIVE · INNATE (NO BUTTON)
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-emerald-950/90 border border-emerald-400/60 text-[6px] text-emerald-200">
                                  ⚡ ACTIVE · HUD BUTTON
                                </span>
                              )}
                            </div>

                            <div className="text-[7px] text-slate-300 mt-1">
                              {item.desc}
                            </div>

                            {item.activationMode === 'PASSIVE' ? (
                              <div className="flex items-center gap-3 text-[7px] text-cyan-300 mt-1 flex-wrap">
                                <span>
                                  INNATE POWER:{' '}
                                  <strong className="text-white">
                                    {(previewStats.powerValue * 100).toFixed(0)}%
                                  </strong>
                                  {!isMax
                                    ? ` → ${(nextStats.powerValue * 100).toFixed(0)}%`
                                    : ''}
                                </span>
                                <span className="text-emerald-300">
                                  +{previewStats.flowBonusPct}% FLOW SPEED
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 text-[7px] text-slate-400 mt-1 flex-wrap">
                                <span>
                                  USES:{' '}
                                  <strong className="text-white">
                                    {previewStats.usesPerRun}x
                                  </strong>
                                  {!isMax && nextStats.usesPerRun > previewStats.usesPerRun
                                    ? ` → ${nextStats.usesPerRun}x`
                                    : ''}
                                </span>
                                {item.id === 'combo_shield' ? (
                                  <span>
                                    DUR: <strong className="text-emerald-300">NO TIMER (UNTIL HIT)</strong>
                                  </span>
                                ) : (
                                  <span>
                                    DUR:{' '}
                                    <strong className="text-emerald-300">
                                      {previewStats.durationSec}s
                                    </strong>
                                    {!isMax ? ` → ${nextStats.durationSec}s` : ''}
                                  </span>
                                )}
                                <span>
                                  CD:{' '}
                                  <strong className="text-cyan-300">
                                    {previewStats.cooldownSec}s
                                  </strong>
                                  {!isMax && nextStats.cooldownSec < previewStats.cooldownSec
                                    ? ` → ${nextStats.cooldownSec}s`
                                    : ''}
                                </span>
                                <span className="text-emerald-300">
                                  +{previewStats.flowBonusPct}% FLOW
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            {isUnlocked && (
                              <button
                                type="button"
                                data-testid={`equip-powerup-${item.id}`}
                                onClick={() => handleToggleEquipPowerUp(item.id)}
                                className={`px-2.5 py-1 text-[7px] border uppercase cursor-pointer ${
                                  isEquipped
                                    ? 'bg-emerald-400 text-slate-950 border-emerald-300'
                                    : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-600'
                                }`}
                              >
                                {isEquipped ? '✓ EQUIPPED' : '+ EQUIP'}
                              </button>
                            )}

                            <button
                              type="button"
                              data-testid={`upgrade-powerup-${item.id}`}
                              disabled={isMax || !canAfford}
                              onClick={() => handleBuyOrUpgradePowerUp(item)}
                              className={`px-2.5 py-1 text-[8px] border uppercase cursor-pointer inline-flex items-center gap-1 ${
                                isMax
                                  ? 'bg-slate-900 text-emerald-400 border-emerald-500/40 cursor-default'
                                  : canAfford
                                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-300'
                                  : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                              }`}
                            >
                              {isMax ? (
                                `MAX LV.${maxLv}`
                              ) : (
                                <>
                                  <span>{isUnlocked ? 'UPGRADE' : 'UNLOCK'}</span>
                                  <RadiantOrbIcon size={10} />
                                  <span>{upgradeCost}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : storeTab === 'characters' ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <CharacterSelectModal
                    embeddedInStore
                    selectedAvatarId={cfg.playerShape}
                    unlockedAvatars={cfg.unlockedAvatars}
                    totalOrbs={stats.totalOrbs}
                    primaryColor="#00ff88"
                    horizonColor="#00d4ff"
                    bpm={cfg.fineTune?.baseJumpTempo || 100}
                    menuBeatInfoRef={menuBeatInfoRef}
                    onSelectAvatar={handleSelectAvatar}
                    onUnlockAvatar={handleUnlockAvatar}
                    onSetOrbs={handleSetExactOrbs}
                    hideOrbSetter={telegramSession.isTelegramEnv}
                    onClose={() => setScreen('title')}
                  />
                </div>
              ) : storeTab === 'banks' ? (
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  <div className="p-2 bg-slate-900/80 border border-cyan-500/40 text-[7px] text-cyan-200 leading-relaxed">
                    🔊 Sound Banks unlock via LV.0–15. You can also click <strong className="text-amber-300">📥 WAV/MP3</strong> on any bank to import a single-note <strong className="text-white">C4 (261.63Hz)</strong> audio sample exported from <strong className="text-emerald-300">Magical 8bit Plug 2, SocaLabs, Plogue Chipsounds / Sforzando, or Vital / Surge XT</strong>!
                  </div>
                  {SOUND_BANKS.map((bank) => {
                    const unlocked = cfg.unlockedSoundBanks.includes(bank.id);
                    const enabled = cfg.enabledSoundBanks.includes(bank.id);
                    const reqLv = getRequiredLevelForSoundBank(bank.id);
                    const customSampleName = customBankSampleNames[bank.id];

                    return (
                      <div
                        key={bank.id}
                        className={`p-2.5 border flex items-center justify-between gap-2 ${
                          unlocked
                            ? 'bg-slate-900/75 border-slate-700'
                            : 'bg-slate-950/80 border-slate-800/80 opacity-75'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[9px] text-white">{bank.name}</span>
                            <span className="text-[7px] px-1 py-0.5 bg-slate-800 text-cyan-300 border border-slate-700">
                              {bank.category}
                            </span>
                            {customSampleName && (
                              <span className="text-[6px] px-1 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-400/60">
                                🎵 SAMPLE: {customSampleName}
                              </span>
                            )}
                          </div>
                          <div className="text-[7px] text-slate-400 mt-0.5 truncate">
                            {bank.desc}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              lastPreviewedBankIdRef.current = bank.id;
                              audioRef.current.previewNote(329.63, cfg, bank);
                            }}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[8px] text-slate-200 cursor-pointer"
                            title="Listen"
                          >
                            ▶
                          </button>

                          <label
                            className="px-1.5 py-1 bg-slate-900 hover:bg-slate-800 border border-amber-400/60 text-[7px] text-amber-300 cursor-pointer"
                            title="Import C4 (.wav / .mp3 / .ogg) sample exported from VST plugin"
                          >
                            📥 WAV
                            <input
                              type="file"
                              accept=".wav,.mp3,.ogg,audio/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const buf = await file.arrayBuffer();
                                const ok = await audioRef.current.loadCustomBankSample(
                                  bank.id,
                                  buf,
                                  cfg
                                );
                                if (ok) {
                                  setCustomBankSampleNames((prev) => ({
                                    ...prev,
                                    [bank.id]: file.name,
                                  }));
                                  lastPreviewedBankIdRef.current = bank.id;
                                  audioRef.current.previewNote(261.63, cfg, bank);
                                }
                                e.target.value = '';
                              }}
                            />
                          </label>

                          {unlocked ? (
                            <label className="flex items-center gap-1 px-2 py-1 bg-slate-950 border border-emerald-500/50 text-[8px] text-emerald-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={enabled}
                                onChange={(e) => handleToggleSoundBank(bank.id, e.target.checked)}
                                className="accent-emerald-400"
                              />
                              <span>ON</span>
                            </label>
                          ) : (
                            <span className="px-2 py-1 bg-slate-900 border border-slate-800 text-[7px] text-amber-300">
                              🔒 LV.{reqLv}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-2 mb-2 bg-slate-900/80 border border-emerald-500/40 text-[7px] text-emerald-200">
                    ♫ Biomes unlock automatically via Player Level (LV.1–15) or Custom Biome Creator in DAW!
                  </div>
                  <div className="flex flex-wrap items-center gap-1 mb-2">
                    {uniqueTraditions.map((tr) => (
                      <button
                        key={tr}
                        type="button"
                        onClick={() => setTraditionFilter(tr)}
                        className={`px-1.5 py-0.5 text-[7px] border cursor-pointer ${
                          traditionFilter === tr
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {tr}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {filteredScales.map((sc) => {
                      const unlocked = sc.id >= 100 || cfg.unlockedScales.includes(sc.id);
                      const enabled = cfg.enabledScales.includes(sc.id);
                      const reqLv = getRequiredLevelForScale(sc.id);

                      return (
                        <div
                          key={sc.id}
                          className={`p-2 border flex items-center justify-between gap-2 ${
                            unlocked
                              ? 'bg-slate-900/75 border-slate-700'
                              : 'bg-slate-950/80 border-slate-800/80 opacity-75'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span style={{ color: sc.fg }} className="text-[9px]">
                                {sc.name}
                              </span>
                              <span className="text-[7px] text-slate-300">{sc.subtitle}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                const previewBank =
                                  SOUND_BANKS.find(
                                    (b) => b.id === lastPreviewedBankIdRef.current
                                  ) || getActiveSoundBank(cfg);
                                audioRef.current.previewScaleAscendingDescending(
                                  sc,
                                  cfg,
                                  previewBank
                                );
                              }}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[8px] text-slate-200 cursor-pointer"
                            >
                              ▶
                            </button>

                            {unlocked ? (
                              <label className="flex items-center gap-1 px-2 py-1 bg-slate-950 border border-emerald-500/50 text-[8px] text-emerald-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={enabled}
                                  onChange={(e) => handleToggleScale(sc.id, e.target.checked)}
                                  className="accent-emerald-400"
                                />
                                <span>ON</span>
                              </label>
                            ) : (
                              <span className="px-2 py-1 bg-slate-900 border border-slate-800 text-[7px] text-amber-300">
                                🔒 LV.{reqLv}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* 16-SEQ removed per user request — all melody & stage editing is unified in the DAW Stage Creator */}

        {/* --- SYSTEM CONFIG, CURATED MELODY LIBRARY & CATEGORIZED FINE-TUNE SLIDERS --- */}
        {screen === 'settings' && !telegramSession.isTelegramEnv && (
          <div
            id="settings-screen"
            className="absolute inset-0 z-30 bg-[#060810]/96 flex flex-col justify-between p-4 overflow-y-auto text-[9px]"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 shrink-0">
              <div>
                <h2 className="text-xs text-white tracking-wider uppercase">
                  ⚙ FINE-TUNE &amp; MELODIES
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setScreen('title')}
                className="px-3 py-1.5 bg-emerald-400 text-slate-950 text-[9px] uppercase cursor-pointer"
              >
                ✓ DONE
              </button>
            </div>

            <div className="space-y-3.5 my-2.5 text-[9px]">
              {/* 01. Developer Bundle Export / Import (Includes Fine-Tune + Kept Melodies + Custom Stages) */}
              <div className="bg-slate-900/80 border border-emerald-500/50 p-3 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                  <span className="text-emerald-400 uppercase">
                    01. Dev Bundle (.JSON)
                  </span>
                  <span className="text-[7px] text-slate-400">
                    {keptMelodiesCount}/{ALL_CURATED_MELODIES.length} Melodies · {customStages.length} Stages
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    id="export-dev-bundle-btn"
                    onClick={handleExportDevBundleFile}
                    className="px-2.5 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[8px] uppercase cursor-pointer"
                  >
                    ⬇ DOWNLOAD .JSON
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyDevBundleClipboard}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-cyan-400/70 text-cyan-300 text-[8px] uppercase cursor-pointer"
                  >
                    📋 COPY
                  </button>
                  <label
                    htmlFor="import-dev-bundle-input"
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-amber-400/70 text-amber-300 text-[8px] uppercase cursor-pointer"
                  >
                    📂 IMPORT
                  </label>
                  <input
                    id="import-dev-bundle-input"
                    type="file"
                    accept=".json,.txt"
                    onChange={handleImportDevBundleFile}
                    className="hidden"
                  />
                </div>
                {devBundleStatus && (
                  <div className="text-[8px] text-amber-300 pt-1">{devBundleStatus}</div>
                )}
              </div>

              {/* 02. Unified Curated Biome Melody Library (3 Per Biome, Editable in DAW!) */}
              <div className="bg-slate-900/70 border border-cyan-500/50 p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                  <span className="text-cyan-300 uppercase">
                    02. Curated &amp; DAW Melody Library ({keptMelodiesCount}/{ALL_CURATED_MELODIES.length} Active)
                  </span>
                  <button
                    type="button"
                    onClick={() => setScreen('stage_creator')}
                    className="px-2 py-1 bg-emerald-400 text-slate-950 text-[8px] uppercase cursor-pointer"
                  >
                    🎹 EDIT IN DAW ({ALL_CURATED_MELODY_STAGES.length})
                  </button>
                </div>

                <div className="text-[7px] text-slate-400 leading-relaxed">
                  Each biome has 3 composed 72-step melodies (Anthem, Arpeggio, Nocturne) with
                  synchronized 4-Gate Chords &amp; Triplets. Audition with ▶, uncheck any you
                  dislike, and export your selection in the .JSON bundle.
                </div>

                {/* Biome Filter & Bulk Actions */}
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <select
                    aria-label="Filter Melodies by Biome"
                    value={melodyBiomeFilter}
                    onChange={(e) =>
                      setMelodyBiomeFilter(
                        e.target.value === 'ALL' ? 'ALL' : Number(e.target.value)
                      )
                    }
                    className="px-2 py-1 bg-slate-950 border border-slate-700 text-[8px] text-emerald-300 cursor-pointer"
                  >
                    <option value="ALL">ALL {MASTER_SCALES.length} BIOMES ({ALL_CURATED_MELODIES.length} MELODIES)</option>
                    {MASTER_SCALES.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        #{sc.id + 1} {sc.name} · {sc.subtitle}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCfg((prev) => ({ ...prev, disabledMelodies: [] }))}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[7px] text-emerald-300 cursor-pointer"
                    >
                      KEEP ALL
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (melodyBiomeFilter === 'ALL') return;
                        const biomeIds = ALL_CURATED_MELODIES.filter(
                          (m) => m.biomeId === melodyBiomeFilter
                        ).map((m) => m.id);
                        setCfg((prev) => ({
                          ...prev,
                          disabledMelodies: (prev.disabledMelodies || []).filter(
                            (id) => !biomeIds.includes(id)
                          ),
                        }));
                      }}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[7px] text-cyan-300 cursor-pointer"
                    >
                      ENABLE BIOME
                    </button>
                  </div>
                </div>

                {/* Scrollable Curated Melody List */}
                <div
                  id="curated-melody-list"
                  className="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-slate-800 bg-slate-950/80 p-2"
                >
                  {filteredCuratedMelodies.map((mel) => {
                    const biome =
                      MASTER_SCALES.find((s) => s.id === mel.biomeId) || MASTER_SCALES[0];
                    const isKept = !(cfg.disabledMelodies || []).includes(mel.id);
                    const prog = pickBiomeChordProgression(biome, mel.chordVariant);
                    return (
                      <div
                        key={mel.id}
                        className={`p-2 border flex items-center justify-between gap-2 ${
                          isKept
                            ? 'bg-slate-900/80 border-slate-700'
                            : 'bg-slate-950/60 border-slate-800/60 opacity-60'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              style={{ color: biome.fg }}
                              className="text-[8px] uppercase"
                            >
                              {biome.name}
                            </span>
                            <span className="text-[8px] text-white">{mel.title}</span>
                            <span className="px-1 py-0.5 bg-slate-800 border border-slate-700 text-[6px] text-cyan-300">
                              {mel.styleTag}
                            </span>
                          </div>
                          <div className="text-[7px] text-slate-400 mt-0.5 truncate">
                            {mel.subtitle} · Gates: {prog.chordNames.join(' → ')}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handlePreviewCuratedMelody(mel)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[8px] text-emerald-300 cursor-pointer"
                            title="Preview Melody"
                          >
                            ▶
                          </button>
                          <label className="flex items-center gap-1 px-2 py-1 bg-slate-950 border border-emerald-500/50 text-[7px] text-emerald-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isKept}
                              onChange={(e) =>
                                handleToggleCuratedMelody(mel.id, e.target.checked)
                              }
                              className="accent-emerald-400"
                            />
                            <span>KEEP</span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 03. Categorized Developer Fine-Tune Sliders (22 Sliders across 5 Categories) */}
              <div className="bg-slate-900/60 border border-slate-800 p-3 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                  <span className="text-cyan-400 uppercase">
                    03. Categorized Fine-Tune ({FINE_TUNE_SLIDERS.length} Sliders)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCfg((prev) => ({
                        ...prev,
                        fineTune: { ...DEFAULT_FINE_TUNE },
                      }));
                      setDevBundleStatus('RESET ALL 22 SLIDERS TO DEFAULT');
                    }}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[8px] text-amber-300 cursor-pointer"
                  >
                    RESET ALL
                  </button>
                </div>

                {/* Category Filter Tabs */}
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  {FINE_TUNE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      data-testid={`finetune-cat-${cat.id.toLowerCase()}`}
                      onClick={() => setFineTuneCategory(cat.id)}
                      className={`px-2 py-1 text-[7px] border uppercase cursor-pointer transition-colors ${
                        fineTuneCategory === cat.id
                          ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Mobile Dash Input Mode Switch & Live Position/Size Customizer */}
                {(fineTuneCategory === 'ALL' || fineTuneCategory === 'MOBILE') && (
                  <div
                    data-testid="mobile-dash-finetune-panel"
                    className="p-2.5 bg-slate-950/90 border border-emerald-400/60 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[8px] text-emerald-300 uppercase">
                        📱 MOBILE DASH MODE &amp; LIVE BUTTON LAYOUT
                      </span>
                      <span className="text-[7px] text-amber-300 uppercase">
                        {(cfg.fineTune?.mobileDashMode ?? 'tap') === 'tap'
                          ? '⚡ SINGLE-TAP ANYWHERE'
                          : '🔘 ON-SCREEN BUTTON'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        data-testid="dash-mode-tap-btn"
                        onClick={() =>
                          setCfg((prev) => ({
                            ...prev,
                            fineTune: {
                              ...(prev.fineTune || DEFAULT_FINE_TUNE),
                              mobileDashMode: 'tap',
                            },
                          }))
                        }
                        className={`py-2 px-2 text-[7px] border uppercase cursor-pointer ${
                          (cfg.fineTune?.mobileDashMode ?? 'tap') === 'tap'
                            ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        ⚡ تک تاچ (SINGLE-TAP DASH)
                      </button>

                      <button
                        type="button"
                        data-testid="dash-mode-button-btn"
                        onClick={() =>
                          setCfg((prev) => ({
                            ...prev,
                            fineTune: {
                              ...(prev.fineTune || DEFAULT_FINE_TUNE),
                              mobileDashMode: 'button',
                            },
                          }))
                        }
                        className={`py-2 px-2 text-[7px] border uppercase cursor-pointer ${
                          (cfg.fineTune?.mobileDashMode ?? 'tap') === 'button'
                            ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        🔘 دکمه ظاهر شدنی (SHOW ICON)
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/90">
                      <div className="text-[7px] text-slate-400">
                        X: <strong className="text-white">{Math.round(cfg.fineTune?.dashBtnXPercent ?? 84)}%</strong> · Y:{' '}
                        <strong className="text-white">{Math.round(cfg.fineTune?.dashBtnYPercent ?? 80)}%</strong> · SIZE:{' '}
                        <strong className="text-cyan-300">{cfg.fineTune?.dashBtnSizePx ?? 54}px</strong>
                      </div>
                      <button
                        type="button"
                        data-testid="open-live-dash-editor-btn"
                        onClick={() => {
                          setCfg((prev) => ({
                            ...prev,
                            fineTune: {
                              ...(prev.fineTune || DEFAULT_FINE_TUNE),
                              mobileDashMode: 'button',
                            },
                          }));
                          setIsEditingDashLayout(true);
                        }}
                        className="px-2.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-[7px] uppercase cursor-pointer"
                      >
                        🎯 تنظیم لایو مکان و سایز دکمه دش
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-1">
                  {visibleFineTuneSliders.map((sl) => {
                    const currentVal =
                      (cfg.fineTune && cfg.fineTune[sl.key]) ?? DEFAULT_FINE_TUNE[sl.key];
                    return (
                      <div
                        key={sl.key}
                        className="p-2 bg-slate-950/70 border border-slate-800/80 flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1 py-0.5 bg-slate-900 border border-slate-700 text-[6px] text-cyan-300">
                              {sl.category}
                            </span>
                            <span className="text-white text-[8px]">{sl.label}</span>
                          </div>
                          <span className="text-emerald-300 text-[8px]">
                            {currentVal}
                            {sl.unit}
                          </span>
                        </div>
                        <div className="text-[7px] text-slate-400">{sl.desc}</div>
                        <input
                          type="range"
                          min={sl.min}
                          max={sl.max}
                          step={sl.step}
                          value={currentVal}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setCfg((prev) => ({
                              ...prev,
                              fineTune: {
                                ...(prev.fineTune || DEFAULT_FINE_TUNE),
                                [sl.key]: val,
                              },
                            }));
                          }}
                          className="w-full accent-cyan-400 mt-0.5"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 04. Harmonic Web Audio Mixer */}
              <div className="bg-slate-900/60 border border-slate-800 p-3 space-y-2">
                <div className="text-pink-400 uppercase border-b border-slate-800 pb-1">
                  04. Audio Mixer
                </div>
                <div className="flex items-center justify-between">
                  <span>Master Gain</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={cfg.volMaster}
                    onChange={(e) => setCfg({ ...cfg, volMaster: parseFloat(e.target.value) })}
                    className="w-32 accent-pink-400"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span>Lead Pluck Notes</span>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={cfg.volNotes}
                    onChange={(e) => setCfg({ ...cfg, volNotes: parseFloat(e.target.value) })}
                    className="w-32 accent-pink-400"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span>Sub-Bass &amp; 5ths</span>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={cfg.volIntervals}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        volIntervals: parseFloat(e.target.value),
                        volBass: parseFloat(e.target.value),
                      })
                    }
                    className="w-32 accent-pink-400"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span>Chord Gates</span>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={cfg.volChords}
                    onChange={(e) => setCfg({ ...cfg, volChords: parseFloat(e.target.value) })}
                    className="w-32 accent-pink-400"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span>Synth Pad</span>
                  <input
                    type="range"
                    min={0}
                    max={2.5}
                    step={0.1}
                    value={cfg.volChoir}
                    onChange={(e) => setCfg({ ...cfg, volChoir: parseFloat(e.target.value) })}
                    className="w-32 accent-pink-400"
                  />
                </div>
              </div>

              {/* 05. Cyber-Biomes, Sensors, Beta Secret Skins & Reset */}
              <div className="bg-slate-900/60 border border-slate-800 p-3 space-y-2">
                <div className="text-amber-400 uppercase border-b border-slate-800 pb-1">
                  05. Sensors, Beta &amp; Visuals
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-pink-300">
                    ✨ Unlock 9 Secret Legendary Skins (Beta)
                  </span>
                  <input
                    type="checkbox"
                    data-testid="beta-unlock-secret-skins-toggle"
                    checked={Boolean(cfg.betaUnlockSecretSkins)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setCfg((prev) => {
                        const cum = getCumulativeUnlocksForLevel(prev.playerLevel || 1);
                        const nextUnlocked = checked
                          ? Array.from(new Set([...prev.unlockedAvatars, ...SECRET_AVATAR_IDS]))
                          : prev.unlockedAvatars.filter(
                              (id) =>
                                !SECRET_AVATAR_IDS.includes(id) ||
                                cum.unlockedSecretAvatars.includes(id)
                            );
                        return {
                          ...prev,
                          betaUnlockSecretSkins: checked,
                          unlockedAvatars: nextUnlocked,
                        };
                      });
                    }}
                    className="w-4 h-4 accent-pink-400 cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span>Android Gravity Tilt</span>
                  <input
                    type="checkbox"
                    checked={cfg.tiltControlEnabled !== false}
                    onChange={(e) =>
                      setCfg({ ...cfg, tiltControlEnabled: e.target.checked })
                    }
                    className="w-4 h-4 accent-emerald-400"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span>Dynamic Biomes</span>
                  <input
                    type="checkbox"
                    checked={cfg.useBiomes}
                    onChange={(e) => setCfg({ ...cfg, useBiomes: e.target.checked })}
                    className="w-4 h-4 accent-emerald-400"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span>CRT Scanlines</span>
                  <input
                    type="checkbox"
                    checked={cfg.crtScanlines}
                    onChange={(e) => setCfg({ ...cfg, crtScanlines: e.target.checked })}
                    className="w-4 h-4 accent-emerald-400"
                  />
                </div>
                <div className="pt-1 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-rose-300">Reset All Save Data &amp; Stats (Beta)</span>
                  <button
                    type="button"
                    onClick={handleResetAllSaveData}
                    className="px-2.5 py-1 bg-rose-950/70 hover:bg-rose-900 border border-rose-500 text-rose-200 text-[8px] uppercase cursor-pointer"
                  >
                    ↺ RESET ALL
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- LIVE INTERACTIVE DASH BUTTON POSITION & SIZE EDITOR OVERLAY --- */}
        {isEditingDashLayout && (
          <div
            id="live-dash-layout-editor"
            data-testid="live-dash-layout-editor"
            onPointerMove={(e) => {
              if (!dashDragActiveRef.current) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const xPct = Math.max(
                8,
                Math.min(92, ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100)
              );
              const yPct = Math.max(
                12,
                Math.min(92, ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100)
              );
              setCfg((prev) => ({
                ...prev,
                fineTune: {
                  ...(prev.fineTune || DEFAULT_FINE_TUNE),
                  dashBtnXPercent: Number(xPct.toFixed(1)),
                  dashBtnYPercent: Number(yPct.toFixed(1)),
                },
              }));
            }}
            onPointerUp={() => {
              dashDragActiveRef.current = false;
            }}
            onPointerCancel={() => {
              dashDragActiveRef.current = false;
            }}
            className="pointer-events-auto absolute inset-0 z-50 bg-[#04050a]/45 flex flex-col justify-between p-4 touch-none"
          >
            {/* Top Live Control Panel */}
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full bg-slate-950/95 border-2 border-amber-400 p-3 shadow-[0_0_30px_rgba(251,191,36,0.3)] space-y-2.5 text-[8px]"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-amber-300 uppercase">
                  🎯 LIVE DASH ICON POSITION &amp; SIZE
                </span>
                <button
                  type="button"
                  data-testid="save-live-dash-editor-btn"
                  onClick={() => {
                    dashDragActiveRef.current = false;
                    setIsEditingDashLayout(false);
                  }}
                  className="px-3 py-1 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[8px] uppercase cursor-pointer"
                >
                  ✓ SAVE &amp; DONE
                </button>
              </div>

              <div className="text-[7px] text-slate-300">
                آیکون دش (⚡) را با انگشت یا ماوس به هر نقطه دلخواه صفحه بکشید و سایز آن را به صورت زنده تغییر دهید:
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-cyan-300">
                  SIZE: <strong className="text-white">{cfg.fineTune?.dashBtnSizePx ?? 54}px</strong>
                </span>
                <input
                  type="range"
                  data-testid="live-dash-size-slider"
                  min={36}
                  max={96}
                  step={2}
                  value={cfg.fineTune?.dashBtnSizePx ?? 54}
                  onChange={(e) => {
                    const sz = parseInt(e.target.value, 10);
                    setCfg((prev) => ({
                      ...prev,
                      fineTune: {
                        ...(prev.fineTune || DEFAULT_FINE_TUNE),
                        dashBtnSizePx: sz,
                      },
                    }));
                  }}
                  className="flex-1 accent-amber-400"
                />
                <button
                  type="button"
                  onClick={() =>
                    setCfg((prev) => ({
                      ...prev,
                      fineTune: {
                        ...(prev.fineTune || DEFAULT_FINE_TUNE),
                        dashBtnXPercent: 84,
                        dashBtnYPercent: 80,
                        dashBtnSizePx: 54,
                      },
                    }))
                  }
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[7px] text-slate-200 cursor-pointer"
                >
                  ↺ RESET
                </button>
              </div>
            </div>

            {/* Live Draggable Dash Button Target */}
            <div
              data-testid="live-draggable-dash-target"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture?.(e.pointerId);
                dashDragActiveRef.current = true;
              }}
              style={{
                left: `${cfg.fineTune?.dashBtnXPercent ?? 84}%`,
                top: `${cfg.fineTune?.dashBtnYPercent ?? 80}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute z-50 p-2 rounded-full border-2 border-dashed border-amber-300 bg-amber-400/15 shadow-[0_0_25px_rgba(251,191,36,0.45)] cursor-move flex flex-col items-center"
            >
              <div className="pointer-events-none">
                <CircularPixelDashButton
                  sizePx={cfg.fineTune?.dashBtnSizePx ?? 54}
                  getDashCooldownState={() => ({
                    dashCool: 0,
                    dashMaxCool: 1.8,
                    dashAct: 0,
                    primaryColor: '#00ff88',
                    horizonColor: '#00d4ff',
                  })}
                  onTriggerDash={() => {}}
                />
              </div>
              <span className="mt-1 px-1.5 py-0.5 bg-slate-950/95 border border-amber-400 text-[6px] text-amber-300 whitespace-nowrap pointer-events-none">
                ✥ DRAG ME ({Math.round(cfg.fineTune?.dashBtnXPercent ?? 84)}%,{' '}
                {Math.round(cfg.fineTune?.dashBtnYPercent ?? 80)}%)
              </span>
            </div>
          </div>
        )}

        {/* --- MINIMAL PAUSE MODAL --- */}
        {screen === 'paused' && (
          <div
            id="pause-screen"
            className="absolute inset-0 z-30 bg-[#04050a]/90 flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="w-full max-w-xs border border-slate-700 bg-slate-950 p-5">
              <h2 className="text-base text-white mb-5">⏸ PAUSED</h2>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!isMuted) audioRef.current.resume();
                    setScreen('playing');
                  }}
                  className="w-full py-3 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[10px] uppercase cursor-pointer"
                >
                  ▶ RESUME
                </button>
                <button
                  type="button"
                  onClick={() =>
                    startNewRun(gameMode, undefined, true, simRef.current.activeStage)
                  }
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white text-[10px] uppercase cursor-pointer"
                >
                  ↻ RESTART
                </button>
                <button
                  type="button"
                  onClick={() => {
                    commitMidRunProgressOnExit();
                    audioRef.current.stopChoir();
                    setScreen('title');
                  }}
                  className="w-full py-3 bg-transparent hover:bg-rose-950/40 border border-rose-500/60 text-rose-400 text-[10px] uppercase cursor-pointer"
                >
                  ⌂ MENU
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- 15-LEVEL PROGRESSION ROADMAP & DETAILED PLAYER STATS MODAL --- */}
        {showLevelRoadmapModal && (
          <div
            id="level-roadmap-modal"
            data-testid="level-roadmap-modal"
            onClick={() => setShowLevelRoadmapModal(false)}
            className="absolute inset-0 z-50 bg-[#04050a]/92 flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[88vh] bg-slate-950 border-2 border-emerald-400 shadow-[0_0_40px_rgba(0,255,136,0.25)] p-4 flex flex-col gap-3 text-[8px]"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <div className="text-[10px] text-emerald-300 uppercase">
                    ⭐ {isFa ? `کارنامه و مسیر ارتقای لول (${playerLvInfo.level}/15)` : `PLAYER LEVEL ${playerLvInfo.level}/15 & ROADMAP`}
                  </div>
                  <div className="text-[7px] text-slate-400 mt-0.5">
                    TOTAL XP: <strong className="text-white">{playerLvInfo.totalXp}</strong> · NEXT LEVEL:{' '}
                    <strong className="text-cyan-300">
                      {playerLvInfo.xpIntoLevel}/{playerLvInfo.xpNeededForNext} XP
                    </strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLevelRoadmapModal(false)}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* XP Progress Bar + Lifetime Stats Summary */}
              <div className="p-2.5 bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="w-full h-2.5 bg-slate-950 border border-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-pink-400"
                    style={{
                      width: `${Math.max(5, Math.round(playerLvInfo.progressRatio * 100))}%`,
                    }}
                  />
                </div>
                <div className="grid grid-cols-4 gap-1.5 text-center pt-1">
                  <div className="p-1.5 bg-slate-950 border border-slate-800">
                    <div className="text-[6px] text-slate-400">BEST SCORE</div>
                    <div className="text-[9px] text-amber-300 mt-0.5">{stats.highScore}</div>
                  </div>
                  <div className="p-1.5 bg-slate-950 border border-slate-800">
                    <div className="text-[6px] text-slate-400">MAX FLOW</div>
                    <div className="text-[9px] text-emerald-300 mt-0.5">x{stats.maxCombo}</div>
                  </div>
                  <div className="p-1.5 bg-slate-950 border border-slate-800">
                    <div className="text-[6px] text-slate-400">RUNS</div>
                    <div className="text-[9px] text-cyan-300 mt-0.5">{stats.runsPlayed}</div>
                  </div>
                  <div className="p-1.5 bg-slate-950 border border-slate-800">
                    <div className="text-[6px] text-slate-400">LOADOUT SLOTS</div>
                    <div className="text-[9px] text-pink-300 mt-0.5">
                      {computeUnlockedPowerUpSlots(stats.highScore, playerLvInfo.level)}/7
                    </div>
                  </div>
                </div>
              </div>

              {/* Scrollable 15-Level Rewards List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {LEVEL_PROGRESSION_TABLE.map((lvRow) => {
                  const unlocked = playerLvInfo.level >= lvRow.level;
                  const isCurrent = playerLvInfo.level === lvRow.level;
                  const rowRewards = getLevelUpRewardsBetween(lvRow.level - 1, lvRow.level);
                  return (
                    <div
                      key={lvRow.level}
                      className={`p-2 border flex items-start justify-between gap-2 ${
                        isCurrent
                          ? 'bg-emerald-950/35 border-emerald-400'
                          : unlocked
                          ? 'bg-slate-900/80 border-slate-700'
                          : 'bg-slate-950/75 border-slate-800/70 opacity-65'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 text-[7px] border ${
                              unlocked
                                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                                : 'bg-slate-900 border-slate-700 text-slate-400'
                            }`}
                          >
                            {unlocked ? '✓' : '🔒'} LV.{lvRow.level}
                          </span>
                          <span className="text-[7px] text-white">
                            {isFa ? lvRow.titleFa : lvRow.titleEn}
                          </span>
                          <span className="text-[7px] text-slate-400">{lvRow.minXp} XP</span>
                        </div>
                        {rowRewards.length > 0 && (
                          <div className="space-y-0.5">
                            {rowRewards.map((rw, idx) => (
                              <div key={idx} className="text-[7px] text-slate-200">
                                • {isFa ? rw.nameFa : rw.nameEn}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 bg-amber-400 text-slate-950 text-[6px] uppercase shrink-0">
                          CURRENT
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* --- CHOREOGRAPHED ARCADE GAME OVER MODAL (0.0s–0.7s 3 Cards -> 0.7s–1.4s XP Bar -> 1.4s+ Level-Up OR Shop Rec -> Buttons) --- */}
        {screen === 'gameover' && (() => {
          const recItem = computePostDefeatShopRecommendation(
            stats.totalOrbs,
            cfg,
            CHARACTER_AVATARS
          );
          const didLevelUp = endSnapshot.newLevel > endSnapshot.prevLevel;

          // Choreographed timing milestones (fast & skippable on click/Space/Enter)
          const showCard1 = gameOverAnimElapsed >= 0.02;
          const showCard2 = gameOverAnimElapsed >= 0.24;
          const showCard3 = gameOverAnimElapsed >= 0.46;
          const showXpPanel = gameOverAnimElapsed >= 0.7;
          const xpBarFillRatio =
            gameOverAnimElapsed < 0.82
              ? didLevelUp
                ? endSnapshot.prevRatio
                : endSnapshot.prevRatio
              : endSnapshot.progressRatio;
          const showPostXpSection = gameOverAnimElapsed >= 1.4;
          const showButtons = gameOverAnimElapsed >= 1.75;

          const getRewardIcon = (kind: LevelUpRewardDef['kind']) => {
            if (kind === 'biome') return '♫';
            if (kind === 'sound_bank') return '🔊';
            if (kind === 'slot') return '⚡';
            return '👑';
          };

          const getConciseRewardLabel = (rw: LevelUpRewardDef) => {
            const raw = isFa ? rw.nameFa : rw.nameEn;
            return raw.replace(/^Unlocked\s+/i, '').replace(/^باز شدن\s+/i, '');
          };

          return (
            <div
              id="game-over-screen"
              data-testid="game-over-screen"
              onClick={() => {
                if (gameOverAnimElapsed < 1.85) {
                  setGameOverAnimElapsed(9.9);
                }
              }}
              className="pixel-dissolve-enter absolute inset-0 z-30 bg-[#04050a]/92 flex flex-col items-center justify-center p-4 text-center overflow-y-auto"
            >
              <div
                onClick={(e) => {
                  if (gameOverAnimElapsed < 1.85) {
                    setGameOverAnimElapsed(9.9);
                  } else {
                    e.stopPropagation();
                  }
                }}
                className="w-full max-w-sm border-2 border-slate-700 bg-slate-950 p-4 transition-all duration-300 ease-out my-auto shadow-[0_0_50px_rgba(0,0,0,0.85)]"
              >
                {/* Animated Jumping Legendary Skins Showcase at Top of Game Over Dialog Frame when reaching Level 5, 10, or 15! */}
                {(() => {
                  const unlockedSecretIds = Array.from(
                    new Set(
                      endSnapshot.levelRewards
                        .filter((r) => r.kind === 'secret_skin' && Boolean(r.avatarId))
                        .map((r) => r.avatarId as CharacterAvatarDef['id'])
                    )
                  );
                  if (!didLevelUp || unlockedSecretIds.length === 0) return null;
                  return (
                    <div
                      data-testid="gameover-legendary-skins-showcase"
                      className="mb-3 p-2.5 bg-gradient-to-b from-amber-500/20 via-pink-500/15 to-slate-950 border-2 border-amber-400 shadow-[0_0_28px_rgba(251,191,36,0.35)]"
                    >
                      <style>{`
                        @keyframes legendarySkinJump {
                          0%, 100% { transform: translateY(0px) scale(1.12, 0.88); }
                          45% { transform: translateY(-14px) scale(0.92, 1.14); }
                          55% { transform: translateY(-15px) scale(0.95, 1.1); }
                        }
                      `}</style>
                      <div className="text-[7px] text-amber-300 uppercase tracking-wider mb-2">
                        👑 LEGENDARY SECRET SKINS UNLOCKED!
                      </div>
                      <div className="flex items-center justify-around gap-2 py-1">
                        {unlockedSecretIds.map((skinId, idx) => {
                          const skinDef = getCharacterById(skinId);
                          return (
                            <div
                              key={skinId}
                              data-testid={`legendary-showcase-skin-${skinId}`}
                              className="flex flex-col items-center gap-1"
                            >
                              <div
                                style={{
                                  animation: `legendarySkinJump 0.85s ease-in-out ${idx * 0.16}s infinite`,
                                }}
                                className="p-1.5 rounded-full bg-slate-900/90 border border-amber-300/80 shadow-[0_0_14px_rgba(251,191,36,0.4)]"
                              >
                                <SelectedAvatarMiniBadge
                                  avatarId={skinId}
                                  primaryColor="#fde047"
                                  horizonColor="#f472b6"
                                />
                              </div>
                              <span className="text-[6px] text-white uppercase truncate max-w-[82px]">
                                {skinDef.name}
                              </span>
                              <span className="text-[6px] text-rose-300">
                                ♥ {skinDef.maxHealth} HP
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <h2
                  id="go-msg"
                  className={`text-base mb-3 ${
                    didLevelUp
                      ? 'text-amber-300 animate-bounce'
                      : endSnapshot.isNewRecord
                      ? 'text-amber-400'
                      : 'text-rose-500'
                  }`}
                >
                  {didLevelUp
                    ? `🎉 LEVEL UP! LV.${endSnapshot.newLevel}`
                    : endSnapshot.isNewRecord
                    ? '* NEW RECORD!'
                    : '* SHATTERED *'}
                </h2>

                {/* PHASE 1 (0.0s -> 0.7s): 3 Left-to-Right Arcade Stat Cards (SCORE, FLOW, HEIGHT (M)) — Rank Removed */}
                <div className="grid grid-cols-3 gap-2 mb-3 text-[9px]">
                  <div
                    className={`bg-slate-900 border border-slate-800 p-2 transition-all duration-200 ${
                      showCard1 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
                    }`}
                  >
                    <div className="text-[7px] text-slate-400">{isFa ? 'امتیاز' : 'SCORE'}</div>
                    <div id="go-score" className="text-sm text-white mt-1">
                      {endSnapshot.score}
                    </div>
                    <div className="text-[7px] text-amber-400 mt-1">
                      BEST {endSnapshot.best}
                    </div>
                  </div>

                  <div
                    className={`bg-slate-900 border border-slate-800 p-2 transition-all duration-200 ${
                      showCard2 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
                    }`}
                  >
                    <div className="text-[7px] text-slate-400">{isFa ? 'فلو' : 'FLOW'}</div>
                    <div className="text-sm text-emerald-400 mt-1">
                      x{endSnapshot.maxFlow}
                    </div>
                    <div className="text-[7px] text-slate-400 mt-1">
                      MAX COMBO
                    </div>
                  </div>

                  <div
                    data-testid="gameover-orbs-card"
                    className={`bg-slate-900 border border-slate-800 p-2 transition-all duration-200 ${
                      showCard3 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
                    }`}
                  >
                    <div className="text-[7px] text-slate-400">{isFa ? 'ارب‌ها' : 'ORBS'}</div>
                    <div
                      id="go-orbs"
                      className="text-sm text-amber-300 mt-1 inline-flex items-center justify-center gap-1"
                    >
                      <RadiantOrbIcon size={12} />
                      <span>+{endSnapshot.orbsCollected}</span>
                    </div>
                    <div className="text-[7px] text-cyan-300 mt-1">
                      TOTAL {stats.totalOrbs}
                    </div>
                  </div>
                </div>

                {/* PHASE 2 (0.7s -> 1.4s): Smooth Downward Expansion for Animated XP Bar (Starts at Pre-Run Ratio -> Fills to New Ratio) */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-out ${
                    showXpPanel ? 'max-h-40 opacity-100 mb-3' : 'max-h-0 opacity-0 mb-0'
                  }`}
                >
                  <div
                    data-testid="gameover-xp-panel"
                    className="p-2.5 bg-slate-900/95 border border-cyan-400/60 text-left"
                  >
                    <div className="flex items-center justify-between text-[8px] mb-1.5">
                      <span className="text-cyan-300 uppercase">
                        ⭐ PLAYER LV.{endSnapshot.newLevel}/15
                      </span>
                      <span className="text-emerald-300">
                        +{endSnapshot.xpGained} XP ({endSnapshot.xpIntoLevel}/{endSnapshot.xpNeededForNext})
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-950 border border-slate-700 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-pink-400 transition-all duration-500 ease-out"
                        style={{
                          width: `${Math.max(5, Math.round(xpBarFillRatio * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* PHASE 3A (1.4s+ IF LEVEL-UP): Vertical Unlocked Rewards List with Icon + Concise Label (Skips Shop Recommendation!) */}
                {didLevelUp && endSnapshot.levelRewards.length > 0 && (
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-out ${
                      showPostXpSection ? 'max-h-64 opacity-100 mb-3' : 'max-h-0 opacity-0 mb-0'
                    }`}
                  >
                    <div
                      data-testid="level-up-congrats-banner"
                      className="p-2.5 bg-amber-500/15 border-2 border-amber-400 text-left space-y-1.5 shadow-[0_0_24px_rgba(251,191,36,0.22)]"
                    >
                      <div className="flex items-center justify-between text-[8px] text-amber-300 uppercase border-b border-amber-400/30 pb-1">
                        <span>✨ LEVEL {endSnapshot.prevLevel} → {endSnapshot.newLevel} UNLOCKS</span>
                        <span>+{endSnapshot.levelRewards.length} NEW</span>
                      </div>
                      <div className="flex flex-col gap-1.5 pt-0.5">
                        {endSnapshot.levelRewards.map((rw, rIdx) => (
                          <div
                            key={`${rw.level}_${rIdx}`}
                            className="px-2 py-1.5 bg-slate-950/90 border border-amber-400/50 flex items-center gap-2 text-[8px] text-white"
                          >
                            <span className="w-5 h-5 flex items-center justify-center bg-amber-400/20 border border-amber-300 text-amber-300 shrink-0">
                              {getRewardIcon(rw.kind)}
                            </span>
                            <span className="truncate flex-1">{getConciseRewardLabel(rw)}</span>
                            <span className="text-[6px] text-amber-300 uppercase shrink-0">
                              LV.{rw.level}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* PHASE 3B (1.4s+ IF NO LEVEL-UP): Smart Post-Defeat Shop Purchase Recommendation */}
                {!didLevelUp && recItem && (
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-out ${
                      showPostXpSection ? 'max-h-36 opacity-100 mb-3' : 'max-h-0 opacity-0 mb-0'
                    }`}
                  >
                    <div
                      data-testid="post-defeat-recommendation"
                      className={`p-2.5 border text-left flex items-center justify-between gap-2.5 ${
                        recItem.canAfford
                          ? 'bg-emerald-950/35 border-emerald-400/80 shadow-[0_0_16px_rgba(0,255,136,0.18)]'
                          : 'bg-slate-900/90 border-amber-400/50'
                      }`}
                    >
                      {recItem.kind === 'character' && (
                        <SelectedAvatarMiniBadge
                          avatarId={recItem.id as CharacterAvatarDef['id']}
                          primaryColor="#00ff88"
                          horizonColor="#00d4ff"
                        />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="text-[7px] uppercase tracking-wider text-amber-300 inline-flex items-center gap-1">
                          {recItem.canAfford ? (
                            <>
                              <span>✨ UNLOCK NOW</span>
                              <RadiantOrbIcon size={10} />
                              <span>{stats.totalOrbs}</span>
                            </>
                          ) : (
                            <>
                              <span>🎯 +{recItem.orbsNeeded}</span>
                              <RadiantOrbIcon size={10} />
                              <span>TO UNLOCK</span>
                            </>
                          )}
                        </div>
                        <div className="text-[9px] text-white uppercase truncate mt-1">
                          {recItem.kind === 'character' ? '◈ ' : '⚡ '}
                          {recItem.name}
                        </div>
                        <div
                          className="text-[7px] truncate mt-0.5"
                          style={{ color: recItem.accentColor }}
                        >
                          * {recItem.shortBenefit}
                        </div>
                      </div>

                      {recItem.canAfford ? (
                        <button
                          type="button"
                          data-testid="buy-recommended-item-btn"
                          onClick={() => {
                            if (recItem.kind === 'character') {
                              const av = CHARACTER_AVATARS.find((a) => a.id === recItem.id);
                              if (av) handleUnlockAvatar(av);
                            } else if (recItem.kind === 'power_up') {
                              const pu = POWERUP_STORE_ITEMS.find((p) => p.id === recItem.id);
                              if (pu) handleBuyOrUpgradePowerUp(pu, true);
                            }
                          }}
                          className="px-2.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-[8px] uppercase whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1"
                        >
                          <span>BUY & EQUIP</span>
                          <RadiantOrbIcon size={10} />
                          <span>{recItem.costOrbs}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setStoreTab(
                              recItem.kind === 'character' ? 'characters' : 'powerups'
                            );
                            setScreen('store');
                          }}
                          className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 border border-amber-400/60 text-amber-300 text-[8px] uppercase whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1"
                        >
                          <RadiantOrbIcon size={10} />
                          <span>{recItem.costOrbs} SHOP</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* TELEGRAM GROUP RANKED MINI-LEADERBOARD & SHARE BUTTON IN GAME OVER */}
                {showButtons && (
                  <div
                    data-testid="gameover-ranked-panel"
                    className="mb-3 p-2.5 bg-slate-900/90 border border-cyan-500/50 text-left space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[7px]">
                      <span className="text-cyan-300 uppercase">
                        🏆 {isFa ? 'لیدربورد گروه تلگرام (RANKED)' : 'GROUP RANKED LEADERBOARD'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {telegramSyncedBadge && (
                          <span className="px-1 py-0.5 bg-emerald-500/20 border border-emerald-400 text-[6px] text-emerald-300">
                            ✓ TG SYNCED
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            fetchTelegramLeaderboard().then((list) => setRankedLeaderboard(list));
                            setShowRankedModal(true);
                          }}
                          className="text-amber-300 hover:underline cursor-pointer uppercase"
                        >
                          {isFa ? 'مشاهده کامل ◄' : 'FULL TABLE >'}
                        </button>
                      </div>
                    </div>

                    {rankedLeaderboard.slice(0, 3).map((row) => (
                      <div
                        key={row.userId}
                        className={`px-2 py-1 border flex items-center justify-between text-[7px] ${
                          row.isCurrentUser
                            ? 'bg-emerald-950/40 border-emerald-400/70 text-emerald-200'
                            : 'bg-slate-950/80 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-amber-300">
                            {row.position === 1 ? '🥇' : row.position === 2 ? '🥈' : '🥉'} #{row.position}
                          </span>
                          <span className="text-white truncate">{row.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {row.maxFlow ? (
                            <span className="text-emerald-400">x{row.maxFlow}</span>
                          ) : null}
                          <strong className="text-amber-300">{row.score}</strong>
                        </div>
                      </div>
                    ))}

                    {telegramSession.isTelegramEnv && (
                      <button
                        type="button"
                        onClick={() => shareScoreToTelegramChat(endSnapshot.score, endSnapshot.maxFlow)}
                        className="w-full py-1.5 bg-sky-500/25 hover:bg-sky-500/35 border border-sky-400 text-sky-200 text-[7px] uppercase cursor-pointer text-center"
                      >
                        📤 {isFa ? 'اشتراک‌گذاری رکورد در گروه تلگرام' : 'SHARE SCORE IN TELEGRAM CHAT'}
                      </button>
                    )}
                  </div>
                )}

                {/* PHASE 4 (1.75s+): Action Buttons */}
                <div
                  className={`flex flex-col gap-2 transition-all duration-200 ${
                    showButtons ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
                  }`}
                >
                  <button
                    type="button"
                    data-start="true"
                    onClick={() =>
                      startNewRun(gameMode, undefined, true, simRef.current.activeStage)
                    }
                    className="w-full py-3 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[10px] uppercase cursor-pointer"
                  >
                    &gt; RETRY
                  </button>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setScreen('store')}
                      className="py-2.5 bg-slate-900 hover:bg-slate-800 border border-amber-400/70 text-amber-300 text-[9px] uppercase cursor-pointer inline-flex items-center justify-center gap-1"
                    >
                      <span>SHOP</span>
                      <RadiantOrbIcon size={10} />
                      <span>{stats.totalOrbs}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        fetchTelegramLeaderboard().then((list) => setRankedLeaderboard(list));
                        setShowRankedModal(true);
                      }}
                      className="py-2.5 bg-slate-900 hover:bg-slate-800 border border-cyan-400/70 text-cyan-300 text-[9px] uppercase cursor-pointer"
                    >
                      🏆 RANKED
                    </button>
                    <button
                      type="button"
                      onClick={() => setScreen('title')}
                      className="py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[9px] uppercase cursor-pointer"
                    >
                      MENU
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* --- TELEGRAM GROUP RANKED LEADERBOARD MODAL --- */}
        {showRankedModal && (
          <div
            id="telegram-ranked-modal"
            data-testid="telegram-ranked-modal"
            onClick={() => setShowRankedModal(false)}
            className="absolute inset-0 z-50 bg-[#04050a]/94 flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[88vh] bg-slate-950 border-2 border-cyan-400 shadow-[0_0_40px_rgba(0,212,255,0.25)] p-4 flex flex-col gap-3 text-[8px]"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <div className="text-[10px] text-cyan-300 uppercase">
                    🏆 {isFa ? 'جدول رده‌بندی اعضای گروه (TELEGRAM RANKED)' : 'TELEGRAM GROUP RANKED LEADERBOARD'}
                  </div>
                  <div className="text-[7px] text-slate-400 mt-0.5">
                    {telegramSession.groupTitle || 'GLOBAL / INLINE GROUP'} · PILOT:{' '}
                    <strong className="text-emerald-300">{telegramSession.firstName}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRankedModal(false)}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Player Callsign / Telegram Profile Bar */}
              <div className="p-2.5 bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-slate-400 shrink-0">{isFa ? 'نام بازیکن:' : 'NAME:'}</span>
                  <input
                    type="text"
                    value={pilotNameInput}
                    onChange={(e) => setPilotNameInput(e.target.value)}
                    maxLength={24}
                    className="flex-1 px-2 py-1 bg-slate-950 border border-slate-700 text-white text-[8px]"
                    placeholder="Your Name / Telegram Handle"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    savePlayerProfile({ firstName: pilotNameInput });
                    const updated = parseTelegramGameSession();
                    setTelegramSession(updated);
                    submitTelegramRankedScore({
                      score: stats.highScore,
                      maxFlow: stats.maxCombo,
                      avatarShape: cfg.playerShape,
                    }).then((res) => {
                      setRankedLeaderboard(res.leaderboard);
                      setTelegramSyncedBadge(res.syncedToTelegram);
                    });
                  }}
                  className="px-2.5 py-1 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[7px] uppercase cursor-pointer shrink-0"
                >
                  {isFa ? 'ثبت رکورد' : 'SYNC SCORE'}
                </button>
              </div>

              {/* Ranked Group Members List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[180px]">
                {rankedLeaderboard.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 border border-dashed border-slate-800">
                    {isFa
                      ? 'هنوز رکوردی در این گروه ثبت نشده است! یک دست بازی کنید یا روی دکمه ثبت رکورد کلیک کنید.'
                      : 'No scores recorded in this group yet! Play a run or click SYNC SCORE to post your best score.'}
                  </div>
                ) : (
                  rankedLeaderboard.map((entry) => (
                    <div
                      key={`${entry.userId}_${entry.position}`}
                      className={`p-2 border flex items-center justify-between gap-2 ${
                        entry.isCurrentUser
                          ? 'bg-emerald-950/40 border-emerald-400'
                          : entry.position <= 3
                          ? 'bg-slate-900/90 border-amber-400/50'
                          : 'bg-slate-900/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-7 text-center text-[9px] text-amber-300 shrink-0">
                          {entry.position === 1
                            ? '🥇'
                            : entry.position === 2
                            ? '🥈'
                            : entry.position === 3
                            ? '🥉'
                            : `#${entry.position}`}
                        </span>
                        {entry.avatarShape && (
                          <div className="scale-75 -mx-1 shrink-0">
                            <SelectedAvatarMiniBadge
                              avatarId={entry.avatarShape}
                              primaryColor="#00ff88"
                              horizonColor="#00d4ff"
                            />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-[8px] text-white truncate">
                            {entry.name}{' '}
                            {entry.isCurrentUser && (
                              <span className="text-[6px] text-emerald-300 uppercase">(YOU)</span>
                            )}
                          </div>
                          {entry.username && (
                            <div className="text-[6px] text-cyan-400 truncate">
                              @{entry.username}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {entry.maxFlow ? (
                          <span className="px-1.5 py-0.5 bg-slate-950 border border-emerald-500/40 text-[7px] text-emerald-300">
                            FLOW x{entry.maxFlow}
                          </span>
                        ) : null}
                        <span className="text-[10px] text-amber-300">{entry.score}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    fetchTelegramLeaderboard().then((list) => setRankedLeaderboard(list));
                  }}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-[8px] uppercase cursor-pointer"
                >
                  ↻ {isFa ? 'بروزرسانی جدول' : 'REFRESH'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const shared = shareScoreToTelegramChat(stats.highScore, stats.maxCombo);
                    if (!shared && typeof window !== 'undefined') {
                      const shareText = encodeURIComponent(
                        `🏆 رکورد من در NEON ASCENT: OMNI — امتیاز: ${stats.highScore} (Max Flow x${stats.maxCombo})!`
                      );
                      const shareUrl = encodeURIComponent(window.location.origin);
                      window.location.href = `https://t.me/share/url?url=${shareUrl}&text=${shareText}`;
                    }
                  }}
                  className="flex-1 py-2 bg-sky-500/25 hover:bg-sky-500/35 border border-sky-400 text-sky-200 text-[8px] uppercase cursor-pointer text-center"
                >
                  📤 {isFa ? 'ارسال رکورد به گروه تلگرام' : 'SHARE SCORE TO TELEGRAM'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
