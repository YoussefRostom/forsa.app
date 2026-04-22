import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../locales/i18n';
import { subscribeToUploadProgress, getUploadProgressState } from '../services/UploadProgressService';

export default function UploadProgressBanner() {
  const [state, setState] = React.useState(getUploadProgressState());
  const progressAnim = React.useRef(new Animated.Value(0)).current;
  const spinAnim = React.useRef(new Animated.Value(0)).current;
  const visibleRef = React.useRef(state.visible);

  React.useEffect(() => {
    return subscribeToUploadProgress(setState);
  }, []);

  React.useEffect(() => {
    // Reset to 0 whenever the banner becomes newly visible (new upload started)
    if (state.visible && !visibleRef.current) {
      progressAnim.setValue(0);
    }
    visibleRef.current = state.visible;
  }, [state.visible]);

  React.useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: state.progress,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [state.progress]);

  React.useEffect(() => {
    if (!state.visible) {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 900,
        // This component also animates `width` and `left`, so keep all values on JS driver.
        useNativeDriver: false,
      })
    );
    loop.start();

    return () => {
      loop.stop();
    };
  }, [state.visible, spinAnim]);

  if (!state.visible) return null;

  const widthInterpolated = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });
  const footballLeftInterpolated = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['2%', '98%'],
  });
  const footballSpinInterpolated = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const percentDisplay = state.progress > 0
    ? `${state.progress}%`
    : '';

  const detail = state.inProgress
    ? percentDisplay
    : (i18n.t('uploadMeterDone') || 'Done');

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>{state.label || (i18n.t('uploadMeterUploadingMedia') || 'Uploading media...')}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: widthInterpolated }]} />
        <Animated.View style={[styles.ballGlow, { left: footballLeftInterpolated }]} />
        <Animated.View style={[styles.ball, { left: footballLeftInterpolated, transform: [{ rotate: footballSpinInterpolated }] }]}>
          <Ionicons name="football" size={16} color="#ffffff" />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 24,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  detail: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '600',
  },
  track: {
    position: 'relative',
    height: 8,
    borderRadius: 999,
    backgroundColor: '#d1d5db',
    overflow: 'visible',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  ball: {
    position: 'absolute',
    top: -6,
    marginLeft: -8,
    shadowColor: '#111827',
    shadowOpacity: 0.32,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  ballGlow: {
    position: 'absolute',
    top: -4,
    marginLeft: -6,
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    opacity: 0.85,
  },
});
