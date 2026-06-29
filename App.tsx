/**
 * SmartCourier root component.
 */
import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';

import {AppNavigator} from '@/navigation/AppNavigator';
import {useNativeBridge} from '@/hooks/useNativeBridge';
import {NotificationService} from '@/services/NotificationService';
import {colors} from '@/theme';

const App: React.FC = () => {
  // Wire native events -> stores/logs/notifications (mounts once).
  useNativeBridge();

  useEffect(() => {
    NotificationService.requestPermission().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
