import { Composition } from 'remotion';
import { Deck } from './Deck';
import { WIDTH, HEIGHT, FPS, totalFrames } from './slides';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DemoDeck"
      component={Deck}
      durationInFrames={totalFrames}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
