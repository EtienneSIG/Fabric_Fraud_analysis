import { Fragment } from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide as slidePresentation } from '@remotion/transitions/slide';
import { slides, SLIDE_FRAMES, TITLE_FRAMES, END_FRAMES, TRANSITION_FRAMES, THEME } from './slides';
import { Slide } from './Slide';
import { TitleSlide, EndSlide } from './Chrome';

const timing = linearTiming({ durationInFrames: TRANSITION_FRAMES });

// subtitles is a composition input prop (toggle in Studio's props panel or via --props on render).
export const Deck: React.FC<{ subtitles?: boolean }> = ({ subtitles = true }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={TITLE_FRAMES}>
          <TitleSlide />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        {slides.map((s, i) => (
          <Fragment key={i}>
            <TransitionSeries.Sequence durationInFrames={s.frames ?? SLIDE_FRAMES}>
              <Slide data={s} index={i} total={slides.length} subtitles={subtitles} />
            </TransitionSeries.Sequence>
            <TransitionSeries.Transition presentation={slidePresentation({ direction: 'from-right' })} timing={timing} />
          </Fragment>
        ))}
        <TransitionSeries.Sequence durationInFrames={END_FRAMES}>
          <EndSlide />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
