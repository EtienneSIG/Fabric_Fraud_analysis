import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME, BRAND, slides } from './slides';

const Brand: React.FC<{ size: number }> = ({ size }) => (
  <div style={{ fontSize: size, fontWeight: 900, letterSpacing: -1, lineHeight: 1 }}>
    <span style={{ color: THEME.text }}>{BRAND.top}</span>{' '}
    <span style={{ color: THEME.accent }}>{BRAND.bottom}</span>
  </div>
);

export const TitleSlide: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 } });
  const y = interpolate(s, [0, 1], [30, 0]);
  const o = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  const line = interpolate(frame, [10, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const iqs = ['Fabric IQ', 'Work IQ', 'Foundry IQ', 'Web IQ'];
  const iqColors = ['#4f46e5', '#0d9488', '#7c3aed', '#ea580c'];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: THEME.bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: o,
      }}
    >
      <div style={{ transform: `translateY(${y}px)`, textAlign: 'center' }}>
        <div style={{ ...pill }}>GUIDED DEMO</div>
        <div style={{ marginTop: 28 }}>
          <Brand size={110} />
        </div>
        <div style={{ height: 4, width: 220 * line, background: THEME.accent, borderRadius: 4, margin: '18px auto 0' }} />
        <p style={{ color: THEME.muted, fontSize: 30, marginTop: 24 }}>
          Fraud investigation on Microsoft Fabric + Foundry
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 30 }}>
          {iqs.map((n, i) => {
            const cs = spring({ frame: frame - 20 - i * 6, fps, config: { damping: 200 } });
            return (
              <div
                key={n}
                style={{
                  opacity: cs,
                  transform: `translateY(${interpolate(cs, [0, 1], [12, 0])}px)`,
                  color: '#fff',
                  background: iqColors[i],
                  fontSize: 20,
                  fontWeight: 800,
                  padding: '10px 18px',
                  borderRadius: 999,
                }}
              >
                {n}
              </div>
            );
          })}
        </div>
        <p style={{ color: '#64748b', fontSize: 22, marginTop: 26 }}>
          {slides.length} écrans · déroulé pas à pas · ~1 min
        </p>
      </div>
    </AbsoluteFill>
  );
};

export const EndSlide: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  const s = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg, alignItems: 'center', justifyContent: 'center', opacity: o }}>
      <div style={{ textAlign: 'center', transform: `scale(${interpolate(s, [0, 1], [0.94, 1])})` }}>
        <Brand size={90} />
        <div style={{ height: 4, width: 180, background: THEME.accent2, borderRadius: 4, margin: '18px auto 0' }} />
        <p style={{ color: THEME.muted, fontSize: 28, marginTop: 24 }}>
          Human-in-the-loop · identity passthrough (RLS + PII) · explainable agents
        </p>
        <div style={{ display: 'inline-block', marginTop: 22, background: 'rgba(99,102,241,0.12)', border: `1px solid ${THEME.border}`, borderRadius: 12, padding: '14px 22px' }}>
          <p style={{ color: '#c7d2fe', fontSize: 22, margin: 0, fontFamily: 'monospace' }}>
            npm run dev:demo — offline · npx rayfin up — live on Fabric
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const pill: React.CSSProperties = {
  display: 'inline-block',
  color: '#c7d2fe',
  backgroundColor: 'rgba(99,102,241,0.15)',
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: 3,
  padding: '10px 20px',
  borderRadius: 999,
};
