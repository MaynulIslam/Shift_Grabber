import React from 'react';
import {Text} from 'react-native';
import {NavigationContainer, DefaultTheme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import {HomeStackParamList, RootTabParamList} from './types';
import {HomeScreen} from '@/screens/HomeScreen';
import {SkipScreen} from '@/screens/SkipScreen';
import {ShiftGrabberScreen} from '@/screens/ShiftGrabberScreen';
import {LogScreen} from '@/screens/LogScreen';
import {SettingsScreen} from '@/screens/SettingsScreen';
import {colors} from '@/theme';

const Stack = createNativeStackNavigator<HomeStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

const screenOptions = {
  headerStyle: {backgroundColor: colors.surface},
  headerTintColor: colors.text,
  contentStyle: {backgroundColor: colors.bg},
} as const;

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{title: 'SmartCourier'}}
      />
      <Stack.Screen
        name="Skip"
        component={SkipScreen}
        options={{title: 'Skip The Dishes'}}
      />
      <Stack.Screen
        name="ShiftGrabber"
        component={ShiftGrabberScreen}
        options={{title: 'Shift Grabber'}}
      />
    </Stack.Navigator>
  );
}

// Emoji tab icons keep the scaffold dependency-free (no vector-icons setup).
const tabIcon =
  (icon: string) =>
  ({focused}: {focused: boolean}) =>
    <Text style={{fontSize: 18, opacity: focused ? 1 : 0.5}}>{icon}</Text>;

export const AppNavigator: React.FC = () => (
  <NavigationContainer theme={navTheme}>
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {backgroundColor: colors.surface, borderTopColor: colors.border},
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}>
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{title: 'Apps', tabBarIcon: tabIcon('🚗')}}
      />
      <Tab.Screen
        name="LogsTab"
        component={LogScreen}
        options={{title: 'Logs', headerShown: true, ...screenOptions, tabBarIcon: tabIcon('📜')}}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{title: 'Settings', headerShown: true, ...screenOptions, tabBarIcon: tabIcon('⚙️')}}
      />
    </Tab.Navigator>
  </NavigationContainer>
);
