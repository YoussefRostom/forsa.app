import React from 'react';
import { View, Text, TextInput, Switch, StyleSheet } from 'react-native';

const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

type DayConfig = { day_off: boolean; start?: string; end?: string };
type WorkingHoursValue = { [day: string]: DayConfig };

interface WorkingHoursInputProps {
  value: WorkingHoursValue;
  onChange: (value: WorkingHoursValue) => void;
}

export default function WorkingHoursInput({ value, onChange }: WorkingHoursInputProps) {
  return (
    <View style={styles.container}>
      {days.map(day => {
        const config = value?.[day] || { day_off: false, start: '', end: '' };
        return (
          <View key={day} style={styles.dayRow}>
            <Text style={styles.dayText}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
            <Switch
              value={!config.day_off}
              onValueChange={val =>
                onChange({
                  ...value,
                  [day]: val ? { day_off: false, start: '', end: '' } : { day_off: true }
                })
              }
            />
            {!config.day_off && (
              <View style={styles.times}>
                <TextInput
                  placeholder="Start"
                  style={styles.timeInput}
                  value={config.start}
                  onChangeText={text =>
                    onChange({ ...value, [day]: { ...config, start: text } })
                  }
                />
                <TextInput
                  placeholder="End"
                  style={styles.timeInput}
                  value={config.end}
                  onChangeText={text =>
                    onChange({ ...value, [day]: { ...config, end: text } })
                  }
                />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 10 },
  dayRow: {
    flexDirection: 'column',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 10,
  },
  dayText: { fontSize: 16, fontWeight: '600' },
  times: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  timeInput: {
    borderBottomWidth: 1,
    borderColor: '#ccc',
    padding: 6,
    flex: 1,
  },
});
