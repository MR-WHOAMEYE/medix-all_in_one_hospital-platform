import React from 'react';
import { Composition } from 'remotion';
import { MedixPromo } from './MedixPromo';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="MedixPromo"
    component={MedixPromo}
    durationInFrames={600}
    fps={30}
    width={1920}
    height={1080}
  />
);
