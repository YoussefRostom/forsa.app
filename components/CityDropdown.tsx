import { Picker } from '@react-native-picker/picker';
import React from 'react';
import { Text, View } from 'react-native';
import i18n from '../locales/i18n';

const cityOptions = [
  'cairo', 'alexandria', 'giza', 'portSaid', 'suez', 'luxor', 'aswan', 'mansoura', 'tanta', 'zagazig',
  'ismailia', 'fayoum', 'sohag', 'damietta', 'beniSuef', 'minya', 'assiut', 'hurghada', 'sharmElSheikh', 'marsaMatrouh'
];

interface CityDropdownProps {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
}

export default function CityDropdown({ value, onChange, error }: CityDropdownProps) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 16, marginBottom: 8 }}>{i18n.t('city')} <Text style={{color:'red'}}>*</Text></Text>
      <View style={{ borderWidth: 1, borderColor: error ? 'red' : '#ccc', borderRadius: 6, overflow: 'hidden' }}>
        <Picker
          selectedValue={value}
          onValueChange={onChange}
          style={{ height: 44, backgroundColor: '#fff' }}
        >
          <Picker.Item label={i18n.t('selectCity')} value="" color="#000" />
          {cityOptions.map((key) => (
            <Picker.Item label={i18n.t(`cities.${key}`)} value={key} key={key} color="#000" />
          ))}
        </Picker>
      </View>
    </View>
  );
}
