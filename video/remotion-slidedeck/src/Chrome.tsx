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
        <p style={{ color: THEME.muted, fontSize: 30, marginTop: 24 }}>
          Fraud investigation on Microsoft Fabric + Foundry
        </p>
        <p style={{ color: '#64748b', fontSize: 22, marginTop: 12 }}>
          {slides.length} écrans · déroulé pas à pas · ~1 min
        </p>
      </div>
    </AbsoluteFill>
  );
};

export const EndSlide: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg, alignItems: 'center', justifyContent: 'center', opacity: o }}>
      <div style={{ textAlign: 'center' }}>
        <Brand size={90} />
        <p style={{ color: THEME.muted, fontSize: 28, marginTop: 24 }}>
          Human-in-the-loop · identity passthrough (RLS + PII) · explainable agents
        </p>
        <p style={{ color: '#64748b', fontSize: 22, marginTop: 16, fontFamily: 'monospace' }}>
          npm run dev:demo — offline demo · npx rayfin up — live on Fabric
        </p>
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
