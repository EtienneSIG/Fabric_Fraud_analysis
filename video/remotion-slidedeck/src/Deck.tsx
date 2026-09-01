import { AbsoluteFill, Series } from 'remotion';
import { slides, SLIDE_FRAMES, TITLE_FRAMES, END_FRAMES, THEME } from './slides';
import { Slide } from './Slide';
import { TitleSlide, EndSlide } from './Chrome';

export const Deck: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg }}>
      <Series>
        <Series.Sequence durationInFrames={TITLE_FRAMES}>
          <TitleSlide />
        </Series.Sequence>
        {slides.map((s, i) => (
          <Series.Sequence key={s.image} durationInFrames={SLIDE_FRAMES}>
            <Slide data={s} index={i} total={slides.length} />
          </Series.Sequence>
        ))}
        <Series.Sequence durationInFrames={END_FRAMES}>
          <EndSlide />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
