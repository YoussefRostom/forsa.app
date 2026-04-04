import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import HamburgerMenu from '../components/HamburgerMenu';
import { useHamburgerMenu } from '../components/HamburgerMenuContext';

export default function PlayerEditProfileScreen() {
  const { openMenu } = useHamburgerMenu();

  return (
    <View style={{ flex: 1 }}>
      <HamburgerMenu />
      <TouchableOpacity
        style={{
          position: 'absolute',
          left: 18,
          top: 48,
          zIndex: 20,
        }}
        onPress={openMenu}
      >
        <View
          style={{
            width: 44,
            height: 44,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#fff',
            borderRadius: 22,
            borderWidth: 1,
            borderColor: '#000',
          }}
        >
          <View
            style={{
              width: 28,
              height: 4,
              backgroundColor: '#000',
              marginVertical: 3,
              borderRadius: 2,
            }}
          />
          <View
            style={{
              width: 28,
              height: 4,
              backgroundColor: '#000',
              marginVertical: 3,
              borderRadius: 2,
            }}
          />
          <View
            style={{
              width: 28,
              height: 4,
              backgroundColor: '#000',
              marginVertical: 3,
              borderRadius: 2,
            }}
          />
        </View>
      </TouchableOpacity>
      {/* ...existing code... */}
    </View>
  );
}