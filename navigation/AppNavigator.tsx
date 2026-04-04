import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import RoleScreen from '../screens/RoleScreen';
import SignInScreen from '../screens/SignInScreen';
import SignUpPlayerScreen from '../screens/SignUpPlayerScreen';
import SplashScreen from '../screens/SplashScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
// ...import other signup screens as needed

const Stack = createStackNavigator<{
  Splash: undefined;
  Welcome: undefined;
  SignIn: undefined;
  Role: undefined;
  SignUpPlayer: undefined;
  // Add other signup screens here
}>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="Role" component={RoleScreen} />
        <Stack.Screen name="SignUpPlayer" component={SignUpPlayerScreen} />
        {/* Add other signup screens here */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
