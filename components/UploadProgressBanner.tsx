import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import i18n from '../locales/i18n';
import { subscribeToUploadProgress, getUploadProgressState } from '../services/UploadProgressService';

export default function UploadProgressBanner() {
  const [state, setState] = React.useState(getUploadProgressState());
  const progressAnim = React.useRef(new Animated.Value(0)).current;
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

  if (!state.visible) return null;

  const widthInterpolated = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 14,
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
    height: 6,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#111827',
  },
});
