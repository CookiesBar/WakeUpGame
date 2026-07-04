import { Image, ImageStyle, StyleProp } from 'react-native';

export type MascotMood = 'happy' | 'wakeup' | 'alarm' | 'shake' | 'snooze';

const SOURCES: Record<MascotMood, number> = {
  happy: require('../assets/mascots/mascot-happy.png'),
  wakeup: require('../assets/mascots/mascot-wakeup.png'),
  alarm: require('../assets/mascots/mascot-alarm.png'),
  shake: require('../assets/mascots/mascot-shake.png'),
  snooze: require('../assets/mascots/mascot-snooze.png'),
};

interface MascotProps {
  mood?: MascotMood;
  size?: number;
  style?: StyleProp<ImageStyle>;
}

/** The Wakey 3D alarm-clock mascot. */
export default function Mascot({ mood = 'happy', size = 120, style }: MascotProps) {
  return (
    <Image
      source={SOURCES[mood]}
      style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
    />
  );
}
