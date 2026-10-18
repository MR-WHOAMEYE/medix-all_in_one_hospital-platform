import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const C = {
  navy: '#061225',
  deep: '#081a30',
  cyan: '#42e8e0',
  blue: '#4f8cff',
  white: '#f5fbff',
  muted: '#9fb3c9',
};

type Shot = {
  file: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  start: number;
  duration: number;
  scaleFrom: number;
  scaleTo: number;
  xFrom: number;
  xTo: number;
  yFrom: number;
};

const shots: Shot[] = [
  { file: 'svg-pages/public-login.svg', eyebrow: 'INTELLIGENCE, CONNECTED', title: 'Care moves forward.', subtitle: 'One connected platform for modern healthcare.', start: 0, duration: 120, scaleFrom: 1.12, scaleTo: 1.0, xFrom: 25, xTo: 0, yFrom: 0 },
  { file: 'svg-pages/admin-dashboard.svg', eyebrow: 'ONE CLEAR PICTURE', title: 'Your hospital. In focus.', subtitle: 'Turn operational signals into a shared view.', start: 105, duration: 120, scaleFrom: 1.10, scaleTo: 1.02, xFrom: -18, xTo: 0, yFrom: 8 },
  { file: 'svg-pages/admin-operations.svg', eyebrow: 'OPERATIONS, IN MOTION', title: 'See the whole system.', subtitle: 'Bring complex workflows into view.', start: 210, duration: 120, scaleFrom: 1.12, scaleTo: 1.01, xFrom: 22, xTo: 0, yFrom: -5 },
  { file: 'svg-pages/admin-clinical-decision-support.svg', eyebrow: 'CLINICAL INTELLIGENCE', title: 'Make insight actionable.', subtitle: 'Put decision support closer to care teams.', start: 315, duration: 120, scaleFrom: 1.13, scaleTo: 1.01, xFrom: -16, xTo: 0, yFrom: 3 },
  { file: 'svg-pages/patient-dashboard.svg', eyebrow: 'A MORE CONNECTED EXPERIENCE', title: 'Care, from every side.', subtitle: 'A clearer experience for patients and teams.', start: 420, duration: 105, scaleFrom: 1.11, scaleTo: 1.0, xFrom: 16, xTo: 0, yFrom: 0 },
];

const ease = Easing.bezier(0.22, 1, 0.36, 1);

const Backdrop: React.FC<{ frame: number }> = ({ frame }) => {
  const drift = interpolate(frame, [0, 600], [0, -110]);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at ${65 + drift * 0.05}% 42%, #153b60 0%, ${C.deep} 44%, ${C.navy} 100%)` }}>
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="lineGlow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={C.cyan} stopOpacity="0" />
            <stop offset="0.5" stopColor={C.cyan} stopOpacity="0.42" />
            <stop offset="1" stopColor={C.blue} stopOpacity="0" />
          </linearGradient>
          <radialGradient id="orb">
            <stop offset="0" stopColor={C.cyan} stopOpacity="0.16" />
            <stop offset="1" stopColor={C.cyan} stopOpacity="0" />
          </radialGradient>
        </defs>
        {Array.from({ length: 15 }).map((_, i) => (
          <path key={i} d={`M ${-120 + i * 150 + drift} 1080 Q ${430 + i * 90} 480 ${350 + i * 150} -50`} fill="none" stroke="url(#lineGlow)" strokeWidth="1" opacity="0.55" />
        ))}
        <circle cx="1470" cy="220" r="380" fill="url(#orb)" />
        <circle cx="330" cy="900" r="300" fill="url(#orb)" />
      </svg>
    </AbsoluteFill>
  );
};

const Grain: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none', opacity: 0.12, backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 180 180%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%22.85%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%22.28%22/%3E%3C/svg%3E")' }} />
);

const Scene: React.FC<{ shot: Shot }> = ({ shot }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame;
  const progress = interpolate(local, [0, shot.duration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
  const scale = interpolate(progress, [0, 1], [shot.scaleFrom, shot.scaleTo]);
  const x = interpolate(progress, [0, 1], [shot.xFrom, shot.xTo]);
  const y = interpolate(progress, [0, 1], [shot.yFrom, 0]);
  const inOpacity = interpolate(local, [0, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const outOpacity = interpolate(local, [shot.duration - 14, shot.duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const textOpacity = inOpacity * outOpacity;
  const lift = interpolate(local, [0, 26], [38, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });

  return (
    <AbsoluteFill style={{ opacity: outOpacity }}>
      <AbsoluteFill style={{ left: 110, top: 120, width: 1700, height: 790, transform: `perspective(1800px) rotateY(-3deg) rotateX(1deg) translate3d(${x}px,${y}px,0) scale(${scale})`, transformOrigin: '50% 50%' }}>
        <div style={{ position: 'absolute', inset: -2, borderRadius: 26, background: 'linear-gradient(135deg, rgba(66,232,224,.38), rgba(79,140,255,.12), rgba(255,255,255,.04))', padding: 2, boxShadow: '0 40px 130px rgba(0,0,0,.48), 0 0 70px rgba(66,232,224,.10)' }}>
          <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: 24, background: '#f8fafc' }}>
            <Img src={staticFile(shot.file)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(4,13,27,.94) 0%, rgba(4,13,27,.78) 24%, rgba(4,13,27,.18) 60%, rgba(4,13,27,0) 100%)' }} />
      <div style={{ position: 'absolute', left: 145, top: 220, width: 720, opacity: textOpacity, transform: `translateY(${lift}px)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <div style={{ width: 46, height: 2, background: C.cyan, boxShadow: `0 0 18px ${C.cyan}` }} />
          <div style={{ fontFamily: 'Arial, sans-serif', color: C.cyan, fontSize: 18, letterSpacing: 5, fontWeight: 700 }}>{shot.eyebrow}</div>
        </div>
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 78, lineHeight: 1.04, letterSpacing: -3, fontWeight: 700, color: C.white, maxWidth: 760, textShadow: '0 8px 40px rgba(0,0,0,.35)' }}>{shot.title}</div>
        <div style={{ marginTop: 26, fontFamily: 'Arial, sans-serif', fontSize: 26, lineHeight: 1.45, color: '#c2d2e5', maxWidth: 570 }}>{shot.subtitle}</div>
      </div>
      <div style={{ position: 'absolute', left: 145, bottom: 66, display: 'flex', alignItems: 'center', gap: 14, opacity: textOpacity }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${C.cyan}`, display: 'grid', placeItems: 'center', color: C.cyan, fontWeight: 800, fontFamily: 'Arial' }}>M</div>
        <div style={{ color: '#d8e5f2', fontFamily: 'Arial', fontSize: 15, letterSpacing: 3, fontWeight: 700 }}>MEDIX</div>
      </div>
      <div style={{ position: 'absolute', right: 120, bottom: 80, color: 'rgba(220,238,255,.55)', fontFamily: 'Arial', fontSize: 13, letterSpacing: 3, opacity: textOpacity }}>CONNECTED CARE SYSTEMS</div>
    </AbsoluteFill>
  );
};

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scale = interpolate(frame, [0, 45], [0.9, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
  return (
    <AbsoluteFill style={{ opacity, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ width: 94, height: 94, borderRadius: 27, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #42e8e0, #4f8cff)', boxShadow: '0 0 80px rgba(66,232,224,.3)', transform: `scale(${scale})`, marginBottom: 28 }}>
        <svg width="58" height="58" viewBox="0 0 58 58"><path d="M29 5 L29 53 M5 29 L53 29" stroke="#061225" strokeWidth="8" strokeLinecap="round"/><circle cx="29" cy="29" r="12" fill="none" stroke="#061225" strokeWidth="5"/></svg>
      </div>
      <div style={{ color: C.white, fontFamily: 'Arial, sans-serif', fontWeight: 800, letterSpacing: 9, fontSize: 66 }}>MEDIX</div>
      <div style={{ marginTop: 20, color: C.cyan, fontFamily: 'Arial, sans-serif', letterSpacing: 5, fontSize: 18 }}>INTELLIGENCE THAT MOVES CARE FORWARD</div>
      <div style={{ marginTop: 44, width: 170, height: 2, background: 'linear-gradient(90deg, transparent, #42e8e0, transparent)' }} />
      <div style={{ marginTop: 26, color: '#b3c5da', fontFamily: 'Arial, sans-serif', fontSize: 19 }}>One connected view. A better way forward.</div>
    </AbsoluteFill>
  );
};

export const MedixPromo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const endStart = 525;
  const vignette = interpolate(frame, [0, 30, 570, 600], [0.15, 0.38, 0.4, 0.8], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ backgroundColor: C.navy, overflow: 'hidden' }}>
      <Backdrop frame={frame} />
      {shots.map((shot) => (
        <Sequence key={shot.file} from={shot.start} durationInFrames={shot.duration}>
          <Scene shot={shot} />
        </Sequence>
      ))}
      <Sequence from={endStart} durationInFrames={75}>
        <EndCard />
      </Sequence>
      <AbsoluteFill style={{ pointerEvents: 'none', boxShadow: `inset 0 0 180px rgba(0,0,0,${vignette})` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, background: 'rgba(255,255,255,.10)' }}>
        <div style={{ height: '100%', width: `${(frame / 600) * 100}%`, background: `linear-gradient(90deg, ${C.cyan}, ${C.blue})`, boxShadow: `0 0 16px ${C.cyan}` }} />
      </div>
    </AbsoluteFill>
  );
};
