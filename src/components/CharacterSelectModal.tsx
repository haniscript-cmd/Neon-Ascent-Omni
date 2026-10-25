import React, { useEffect, useRef, useState } from 'react';
import {
  CHARACTER_AVATARS,
  CharacterAvatarDef,
  AvatarTier,
  getCharacterById,
  drawCharacterAvatar,
} from '../game/characters';

/**
 * Larger, glowing faceted Harmonic Orb SVG icon for Menus, Shop, Character Cards, and Game Over.
 */
export function RadiantOrbIcon({
  size = 13,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`inline-block shrink-0 align-middle drop-shadow-[0_0_6px_rgba(251,191,36,0.95)] ${className}`}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" fill="rgba(251, 191, 36, 0.22)" />
      <polygon
        points="12,2 20,8 18,19 6,19 4,8"
        fill="#f59e0b"
        stroke="#fef08a"
        strokeWidth="1.5"
      />
      <polygon points="12,4 18,9 12,13 6,9" fill="#fde047" />
      <circle cx="10" cy="8" r="2.1" fill="#ffffff" />
    </svg>
  );
}

interface CharacterSelectModalProps {
  selectedAvatarId: string;
  unlockedAvatars: string[];
  totalOrbs: number;
  primaryColor: string;
  horizonColor: string;
  bpm?: number;
  onSelectAvatar: (avatarId: string) => void;
  onUnlockAvatar: (avatar: CharacterAvatarDef) => void;
  onSetOrbs: (newAmount: number) => void;
  onClose: () => void;
  embeddedInStore?: boolean;
}

interface PointerClientState {
  x: number;
  y: number;
  hasMouse: boolean;
  tiltX: number;
  tiltY: number;
}

/**
 * Mini Pixel Canvas Icon for each character in the grid with live Reactive Rectangular Eyes.
 * When `pointerRef` is provided, each character independently computes the vector from its
 * own bounding-box center on screen to the cursor so every character locks eyes on the mouse!
 */
function CharacterIconCanvas({
  avatar,
  lookX = 0.25,
  lookY = -0.15,
  pointerRef,
  primaryColor,
  horizonColor,
}: {
  avatar: CharacterAvatarDef;
  lookX?: number;
  lookY?: number;
  pointerRef?: React.MutableRefObject<PointerClientState>;
  primaryColor: string;
  horizonColor: string;
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
      ctx.imageSmoothingEnabled = false;
      const t = now / 1000;

      let curLookX = lookX;
      let curLookY = lookY;

      if (pointerRef) {
        const ptr = pointerRef.current;
        if (ptr.hasMouse) {
          const rect = cvs.getBoundingClientRect();
          const cx = rect.left + rect.width * 0.5;
          const cy = rect.top + rect.height * 0.5;
          const dx = ptr.x - cx;
          const dy = ptr.y - cy;
          const dist = Math.hypot(dx, dy);
          if (dist > 1) {
            const strength = Math.min(1, dist / 95);
            curLookX = (dx / dist) * strength;
            curLookY = (dy / dist) * strength;
          } else {
            curLookX = 0;
            curLookY = 0;
          }
        } else {
          curLookX = ptr.tiltX;
          curLookY = ptr.tiltY;
        }
      }

      ctx.clearRect(0, 0, cvs.width, cvs.height);
      ctx.save();
      ctx.translate(6, 6);
      drawCharacterAvatar(
        ctx,
        avatar,
        28,
        28,
        t,
        primaryColor,
        horizonColor,
        curLookX,
        curLookY
      );
      ctx.restore();
    };
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [avatar, lookX, lookY, pointerRef, primaryColor, horizonColor]);

  return (
    <canvas
      ref={cvsRef}
      width={40}
      height={40}
      className="w-10 h-10 shrink-0 pointer-events-none"
    />
  );
}

/**
 * Small inline preview icon used on the Title Screen button & Post-Defeat Recommendation.
 */
export function SelectedAvatarMiniBadge({
  avatarId,
  primaryColor,
  horizonColor,
}: {
  avatarId: string;
  primaryColor: string;
  horizonColor: string;
}) {
  const avatar = getCharacterById(avatarId);
  return (
    <CharacterIconCanvas
      avatar={avatar}
      lookX={0.25}
      lookY={-0.15}
      primaryColor={primaryColor}
      horizonColor={horizonColor}
    />
  );
}

export default function CharacterSelectModal({
  selectedAvatarId,
  unlockedAvatars,
  totalOrbs,
  primaryColor,
  horizonColor,
  bpm = 100,
  onSelectAvatar,
  onUnlockAvatar,
  onSetOrbs,
  onClose,
  embeddedInStore = false,
}: CharacterSelectModalProps) {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tierFilter, setTierFilter] = useState<'ALL' | AvatarTier>('ALL');
  const [previewedId, setPreviewedId] = useState<string>(selectedAvatarId);
  const [orbInputVal, setOrbInputVal] = useState<string>(String(totalOrbs));

  const pointerRef = useRef<PointerClientState>({
    x: 300,
    y: 400,
    hasMouse: false,
    tiltX: 0.25,
    tiltY: -0.1,
  });

  useEffect(() => {
    setOrbInputVal(String(totalOrbs));
  }, [totalOrbs]);

  useEffect(() => {
    setPreviewedId(selectedAvatarId);
  }, [selectedAvatarId]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      pointerRef.current.x = e.clientX;
      pointerRef.current.y = e.clientY;
      pointerRef.current.hasMouse = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      pointerRef.current.x = touch.clientX;
      pointerRef.current.y = touch.clientY;
      pointerRef.current.hasMouse = true;
    };

    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma === null && e.beta === null) return;
      const gx = Math.max(-1, Math.min(1, (e.gamma || 0) / 25));
      const gy = Math.max(-1, Math.min(1, ((e.beta || 45) - 45) / 25));
      pointerRef.current.tiltX = gx;
      pointerRef.current.tiltY = gy;
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('deviceorientation', onDeviceOrientation);
    };
  }, []);

  // Top Stage Live Left-to-Right Bouncing Pixel Character Preview Loop synced to background music BPM
  useEffect(() => {
    let animId = 0;
    const avatar = getCharacterById(previewedId);
    const safeBpm = Math.max(60, Math.min(180, bpm || 100));
    const hopDuration = 60 / safeBpm; // 1 beat per hop, locked to background music BPM!

    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);
      const cvs = previewCanvasRef.current;
      if (!cvs) return;
      const ctx = cvs.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;

      const w = cvs.width;
      const h = cvs.height;
      const t = now / 1000;

      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = '#050811';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.08)';
      ctx.lineWidth = 1;
      for (let gx = 40; gx < w; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 30; gy < h; gy += 30) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      const padY = h - 20;
      const leftPadX = w * 0.28;
      const rightPadX = w * 0.72;
      const padW = 86;

      const totalCycle = hopDuration * 2;
      const cycleTime = t % totalCycle;
      const goingRight = cycleTime < hopDuration;
      const phase = (cycleTime % hopDuration) / hopDuration;

      const startX = goingRight ? leftPadX : rightPadX;
      const endX = goingRight ? rightPadX : leftPadX;
      const charX = startX + (endX - startX) * phase;

      const arcHeight = 64;
      const normArc = 4 * phase * (1 - phase);
      const charBottomY = padY - normArc * arcHeight;

      let scaleX = 1.0;
      let scaleY = 1.0;
      const distFromPad = Math.min(phase, 1 - phase);
      if (distFromPad < 0.12) {
        const impactIntensity = 1 - distFromPad / 0.12;
        scaleX = 1 + 0.48 * impactIntensity;
        scaleY = 1 - 0.4 * impactIntensity;
      } else if (distFromPad < 0.34) {
        const stretchIntensity = 1 - Math.abs(distFromPad - 0.22) / 0.12;
        scaleX = 1 - 0.22 * stretchIntensity;
        scaleY = 1 + 0.34 * stretchIntensity;
      }

      const leftHit =
        (!goingRight && phase > 0.85) || (goingRight && phase < 0.15);
      const rightHit =
        (goingRight && phase > 0.85) || (!goingRight && phase < 0.15);

      const drawPad = (cx: number, isHit: boolean) => {
        ctx.save();
        ctx.fillStyle = isHit ? '#ffffff' : primaryColor;
        ctx.fillRect(cx - padW * 0.5, padY, padW, 10);
        ctx.fillStyle = 'rgba(4, 6, 14, 0.7)';
        ctx.fillRect(cx - padW * 0.5 + 2, padY + 2, padW - 4, 6);
        ctx.restore();
      };
      drawPad(leftPadX, leftHit);
      drawPad(rightPadX, rightHit);

      // Compute independent eye look vector from the bouncing character's screen position to the cursor
      let stageLookX = pointerRef.current.tiltX;
      let stageLookY = pointerRef.current.tiltY;
      if (pointerRef.current.hasMouse) {
        const rect = cvs.getBoundingClientRect();
        const screenCharX = rect.left + (charX / w) * rect.width;
        const screenCharY = rect.top + ((charBottomY - 16) / h) * rect.height;
        const dx = pointerRef.current.x - screenCharX;
        const dy = pointerRef.current.y - screenCharY;
        const dist = Math.hypot(dx, dy);
        if (dist > 1) {
          const strength = Math.min(1, dist / 110);
          stageLookX = (dx / dist) * strength;
          stageLookY = (dy / dist) * strength;
        }
      }

      const charSize = 33;
      ctx.save();
      ctx.translate(charX, charBottomY);
      ctx.scale(scaleX, scaleY);
      ctx.translate(-charSize * 0.5, -charSize);

      drawCharacterAvatar(
        ctx,
        avatar,
        charSize,
        charSize,
        t,
        primaryColor,
        horizonColor,
        stageLookX,
        stageLookY
      );
      ctx.restore();
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [previewedId, primaryColor, horizonColor, bpm]);

  const previewAvatar = getCharacterById(previewedId);
  const isPreviewUnlocked =
    unlockedAvatars.includes(previewAvatar.id) ||
    (!previewAvatar.isSecret && previewAvatar.costOrbs === 0);
  const isPreviewEquipped = selectedAvatarId === previewAvatar.id;

  // Hide secret skins from the normal Shop list unless they have been unlocked (by Level 5/10/15 or Beta Toggle)!
  const visibleAvatars = CHARACTER_AVATARS.filter(
    (a) => !a.isSecret || unlockedAvatars.includes(a.id)
  );

  const filteredAvatars =
    tierFilter === 'ALL'
      ? visibleAvatars
      : visibleAvatars.filter((a) => a.tier === tierFilter);

  const innerContent = (
    <>
      {/* Top Live Bouncing Pixel Showcase */}
      <div className="my-1.5 bg-slate-950 border border-slate-800 p-2 flex flex-col gap-2 shrink-0">
        <div className="relative w-full h-[96px] border border-slate-800/90 overflow-hidden">
          <canvas
            ref={previewCanvasRef}
            width={540}
            height={96}
            className="w-full h-full block"
          />
          <div className="absolute top-2 left-2.5 flex items-center gap-2">
            <span className="text-[10px] text-white uppercase">
              {previewAvatar.name}
            </span>
            <span
              className={`text-[8px] uppercase px-1.5 py-0.5 border ${
                previewAvatar.tier === 'rainbow'
                  ? 'text-pink-300 border-pink-400'
                  : previewAvatar.tier === 'gold'
                  ? 'text-amber-300 border-amber-400'
                  : 'text-emerald-300 border-emerald-500/60'
              }`}
            >
              {previewAvatar.isSecret ? `★ SECRET ${previewAvatar.tier}` : previewAvatar.tier}
            </span>
            {previewAvatar.perks.orbBonusPct > 0 && (
              <span className="text-[7px] px-1.5 py-0.5 bg-amber-500/20 border border-amber-400/60 text-amber-300 flex items-center gap-1">
                +{previewAvatar.perks.orbBonusPct}% <RadiantOrbIcon size={10} />
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <div className="text-[9px] text-cyan-300 truncate">
              * {previewAvatar.perkTitle}
            </div>
            <div className="text-[7px] text-slate-400 truncate mt-0.5">
              {previewAvatar.perkDesc} · Wall Rebound {previewAvatar.perks.wallBounceElasticity}x
            </div>
          </div>

          <div className="shrink-0">
            {isPreviewUnlocked ? (
              <button
                type="button"
                onClick={() => onSelectAvatar(previewAvatar.id)}
                className={`px-3.5 py-1.5 text-[9px] uppercase cursor-pointer ${
                  isPreviewEquipped
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                }`}
              >
                {isPreviewEquipped ? '[ACTIVE]' : 'SELECT'}
              </button>
            ) : (
              <button
                type="button"
                disabled={totalOrbs < previewAvatar.costOrbs}
                onClick={() => {
                  onUnlockAvatar(previewAvatar);
                  onSelectAvatar(previewAvatar.id);
                }}
                className={`px-3 py-1.5 text-[9px] uppercase cursor-pointer flex items-center gap-1 ${
                  totalOrbs >= previewAvatar.costOrbs
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                    : 'bg-slate-900 border border-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                <span>BUY {previewAvatar.costOrbs}</span>
                <RadiantOrbIcon size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Minimal Tier Filter Tabs */}
      <div className="grid grid-cols-4 gap-1.5 mb-2 shrink-0">
        {(
          [
            { id: 'ALL', label: `ALL (${visibleAvatars.length})` },
            { id: 'standard', label: 'STD' },
            { id: 'gold', label: '* GOLD' },
            { id: 'rainbow', label: '+ PRISM' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTierFilter(tab.id)}
            className={`px-2 py-1.5 text-[8px] border uppercase cursor-pointer truncate ${
              tierFilter === tab.id
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable Avatar Icon Grid */}
      <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 pr-1">
        {filteredAvatars.map((av) => {
          const unlocked =
            unlockedAvatars.includes(av.id) || (!av.isSecret && av.costOrbs === 0);
          const equipped = selectedAvatarId === av.id;
          const isPreviewed = previewedId === av.id;
          const canAfford = totalOrbs >= av.costOrbs;

          return (
            <div
              key={av.id}
              onClick={() => {
                setPreviewedId(av.id);
                if (unlocked) {
                  onSelectAvatar(av.id);
                }
              }}
              className={`p-2 border flex flex-col justify-between gap-2 cursor-pointer transition-colors ${
                equipped
                  ? 'bg-emerald-950/40 border-emerald-400'
                  : isPreviewed
                  ? 'bg-slate-900 border-cyan-400'
                  : unlocked
                  ? 'bg-slate-900/70 border-slate-700 hover:border-slate-500'
                  : 'bg-slate-950/90 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <CharacterIconCanvas
                  avatar={av}
                  pointerRef={pointerRef}
                  primaryColor={primaryColor}
                  horizonColor={horizonColor}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] text-white truncate flex items-center gap-1">
                    {av.isSecret && <span className="text-pink-400">★</span>}
                    <span className="truncate">{av.name}</span>
                  </div>
                  <div className="text-[7px] text-cyan-300 truncate mt-0.5">
                    {av.perkTitle}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                <span
                  className={`text-[7px] uppercase flex items-center gap-0.5 ${
                    av.tier === 'rainbow'
                      ? 'text-pink-400'
                      : av.tier === 'gold'
                      ? 'text-amber-300'
                      : 'text-slate-400'
                  }`}
                >
                  {av.perks.orbBonusPct > 0 ? (
                    <>
                      <span>+{av.perks.orbBonusPct}%</span>
                      <RadiantOrbIcon size={9} />
                    </>
                  ) : (
                    av.tier
                  )}
                </span>

                {unlocked ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewedId(av.id);
                      onSelectAvatar(av.id);
                    }}
                    className={`px-2 py-0.5 text-[8px] uppercase cursor-pointer ${
                      equipped
                        ? 'bg-emerald-400 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {equipped ? 'ON' : 'USE'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewedId(av.id);
                      onUnlockAvatar(av);
                      onSelectAvatar(av.id);
                    }}
                    className={`px-2 py-0.5 text-[8px] uppercase border cursor-pointer flex items-center gap-1 ${
                      canAfford
                        ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-300'
                        : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                    }`}
                  >
                    <span>{av.costOrbs}</span>
                    <RadiantOrbIcon size={10} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  if (embeddedInStore) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden text-[9px]">
        {innerContent}
      </div>
    );
  }

  return (
    <div
      id="character-select-screen"
      className="absolute inset-0 z-30 bg-[#05070f]/96 flex flex-col justify-between p-4 overflow-hidden font-pixel text-[9px]"
    >
      {/* Minimal Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 text-xs">+</span>
          <h2 className="text-xs text-white tracking-wider uppercase">
            AVATARS
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-900 border border-amber-400/60 px-2 py-1">
            <RadiantOrbIcon size={13} />
            <input
              type="number"
              aria-label="Test Orb Amount"
              value={orbInputVal}
              onChange={(e) => setOrbInputVal(e.target.value)}
              className="w-16 bg-slate-950 border border-slate-700 px-1.5 py-0.5 text-[9px] text-amber-300"
            />
            <button
              type="button"
              onClick={() => {
                const parsed = parseInt(orbInputVal, 10);
                if (!Number.isNaN(parsed) && parsed >= 0) {
                  onSetOrbs(parsed);
                }
              }}
              className="px-1.5 py-0.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-[8px] uppercase cursor-pointer"
            >
              SET
            </button>
          </div>

          <button
            type="button"
            data-testid="close-characters-btn"
            onClick={onClose}
            className="px-3 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[9px] uppercase cursor-pointer"
          >
            X
          </button>
        </div>
      </div>

      {innerContent}
    </div>
  );
}

