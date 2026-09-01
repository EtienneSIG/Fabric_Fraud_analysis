import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { SlideData, THEME, BRAND } from './slides';

export const Slide: React.FC<{ data: SlideData; index: number; total: number }> = ({ data, index, total }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 } });
  const fade = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const textX = interpolate(enter, [0, 1], [-40, 0]);
  // Subtle Ken Burns on the screenshot.
  const zoom = interpolate(frame, [0, durationInFrames], [1.04, 1.09]);
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

          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ width: 4, borderRadius: 4, backgroundColor: THEME.accent }} />
            <div>
              <div style={{ color: '#818cf8', fontSize: 15, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                À dire
              </div>
              <p style={{ color: '#cbd5e1', fontSize: 22, lineHeight: 1.5, margin: '8px 0 0', fontStyle: 'italic' }}>
                {data.say}
              </p>
            </div>
          </div>

          <div style={{ marginTop: 'auto', color: THEME.muted, fontSize: 20, fontWeight: 700 }}>
            <span style={{ color: THEME.text }}>{BRAND.top}</span> {BRAND.bottom}
            <span style={{ color: THEME.muted, fontWeight: 500 }}> · Microsoft Fabric + Foundry</span>
          </div>
        </div>

        {/* Right: screenshot */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              width: '100%',
              borderRadius: 18,
              overflow: 'hidden',
              border: `1px solid ${THEME.border}`,
              boxShadow: '0 40px 90px rgba(0,0,0,0.55)',
              background: THEME.panel,
            }}
          >
            <Img
              src={staticFile(data.image)}
              style={{ width: '100%', display: 'block', transform: `scale(${zoom})`, transformOrigin: 'center' }}
            />
          </div>
        </div>
      </div>

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
