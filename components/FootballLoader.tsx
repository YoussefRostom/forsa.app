import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

type FootballLoaderProps = {
  size?: 'small' | 'large' | number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

const resolveSize = (size: FootballLoaderProps['size']) => {
  if (typeof size === 'number') return size;
  if (size === 'large') return 24;
  return 16;
};

export default function FootballLoader({ size = 'small', color = '#ffffff', style }: FootballLoaderProps) {
  const spinAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();

    return () => {
      loop.stop();
    };
  }, [spinAnim]);

  const iconSize = resolveSize(size);
  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const iconInnerSize = Math.max(12, Math.round(iconSize));

  return (
    <Animated.View style={[{ transform: [{ rotate: spin }] }, style]}>
      <MaterialCommunityIcons name="soccer" size={iconInnerSize} color={color} />
    </Animated.View>
  );
}
