import { AbsoluteFill, Img, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { SlideData, Callout, THEME, BRAND } from './slides';

export const Slide: React.FC<{ data: SlideData; index: number; total: number; subtitles?: boolean }> = ({ data, index, total, subtitles = true }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 } });
  const fade = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const textX = interpolate(enter, [0, 1], [-40, 0]);
  // Subtle Ken Burns on the screenshot.
  const zoom = interpolate(frame, [0, durationInFrames], [1.04, 1.09]);
  // Spotlight: slow zoom into a focal point on a video slide.
  const spot = data.spotlight;
  const spotP = spot ? interpolate(frame, [spot.atFrame, spot.atFrame + 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
  const spotScale = spot ? 1 + (spot.scale - 1) * spotP : 1;
  const kb = data.callouts ? 1 : zoom; // freeze Ken Burns when callouts must stay pinned to the still
  const progress = (index + interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' })) / total;

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg, opacity: fade }}>
      <div style={{ display: 'flex', width: '100%', height: '100%', padding: 80, gap: 56, boxSizing: 'border-box' }}>
        {/* Left: narrative */}
        <div style={{ flex: '0 0 34%', display: 'flex', flexDirection: 'column', transform: `translateX(${textX}px)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ ...chip, backgroundColor: 'rgba(99,102,241,0.15)', color: '#c7d2fe' }}>
              STEP {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
            <span style={{ ...chip, backgroundColor: 'rgba(16,185,129,0.12)', color: '#6ee7b7' }}>{data.screen}</span>
          </div>

          <h1 style={{ color: THEME.text, fontSize: 52, lineHeight: 1.08, margin: '28px 0 0', fontWeight: 800 }}>
            {data.title}
          </h1>
          <p style={{ color: THEME.muted, fontSize: 26, lineHeight: 1.45, margin: '20px 0 0' }}>{data.caption}</p>

          <div style={{ height: 1, backgroundColor: THEME.border, margin: '28px 0' }} />

          <div style={{ marginTop: 'auto', color: THEME.muted, fontSize: 20, fontWeight: 700 }}>
            <span style={{ color: THEME.text }}>{BRAND.top}</span> {BRAND.bottom}
            <span style={{ color: THEME.muted, fontWeight: 500 }}> · Microsoft Fabric + Foundry</span>
          </div>
        </div>

        {/* Right: screenshot or live capture */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              borderRadius: 18,
              overflow: 'hidden',
              border: `1px solid ${THEME.border}`,
              boxShadow: '0 40px 90px rgba(0,0,0,0.55)',
              background: THEME.panel,
            }}
          >
            {data.video ? (
              <>
                {/* Poster behind the clip so the first frame is never black. */}
                <Img src={staticFile(data.image)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.5)' }} />
                <OffthreadVideo
                  src={staticFile(data.video)}
                  muted
                  style={{ position: 'relative', width: '100%', display: 'block', transform: `scale(${spotScale})`, transformOrigin: `${(data.spotlight?.x ?? 0.5) * 100}% ${(data.spotlight?.y ?? 0.5) * 100}%` }}
                />
                <span style={{ ...capsule, backgroundColor: data.placeholder ? 'rgba(245,158,11,0.92)' : 'rgba(16,185,129,0.92)' }}>
                  {data.placeholder ? '● REC · Scout à venir' : '▶ Capture live'}
                </span>
              </>
            ) : (
              <Img
                src={staticFile(data.image)}
                style={{ width: '100%', display: 'block', transform: `scale(${kb})`, transformOrigin: 'center' }}
              />
            )}
            {data.callouts?.map((c, i) => (
              <CalloutMark key={i} c={c} frame={frame} />
            ))}
          </div>
        </div>
      </div>

      {/* Spoken caption — toggle with the `subtitles` composition prop. */}
      {subtitles && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 40, display: 'flex', justifyContent: 'center', padding: '0 80px', boxSizing: 'border-box' }}>
          <div style={{ maxWidth: '82%', background: 'rgba(2,6,23,0.82)', border: `1px solid ${THEME.border}`, color: '#e5e7eb', fontSize: 23, lineHeight: 1.45, padding: '12px 22px', borderRadius: 12, textAlign: 'center' }}>
            {data.say}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: 6, backgroundColor: 'rgba(148,163,184,0.15)' }}>
        <div style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: THEME.accent }} />
      </div>
    </AbsoluteFill>
  );
};

const chip: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  letterSpacing: 1,
  padding: '8px 14px',
  borderRadius: 999,
};

// Animated marker pinned to a point on the still (x,y in 0..1). Label flips to the left near the edge.
const CalloutMark: React.FC<{ c: Callout; frame: number }> = ({ c, frame }) => {
  const at = c.atFrame ?? 0;
  const appear = interpolate(frame, [at, at + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pulse = 1 + 0.12 * Math.sin(frame / 5);
  const color = c.color ?? '#6366f1';
  const flip = c.x > 0.6;
  return (
    <div style={{ position: 'absolute', left: `${c.x * 100}%`, top: `${c.y * 100}%`, transform: 'translate(-50%,-50%)', opacity: appear, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: -22, top: -22, width: 44, height: 44, borderRadius: 999, border: `3px solid ${color}`, transform: `scale(${pulse})`, boxShadow: `0 0 0 6px ${color}22` }} />
      <div style={{ position: 'absolute', top: -16, ...(flip ? { right: 30 } : { left: 30 }), whiteSpace: 'nowrap', background: color, color: '#fff', fontSize: 18, fontWeight: 800, padding: '6px 12px', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
        {c.label}
      </div>
    </div>
  );
};

const capsule: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
  fontSize: 15,
  fontWeight: 800,
  letterSpacing: 0.5,
  color: '#0b1220',
  padding: '7px 13px',
  borderRadius: 999,
};
