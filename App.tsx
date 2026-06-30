/**
 * SmartCourier root component.
 */
import React, {useEffect} from 'react';
import {StatusBar, View, ActivityIndicator} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';

import {AppNavigator} from '@/navigation/AppNavigator';
import {AuthScreen} from '@/screens/AuthScreen';
import {useNativeBridge} from '@/hooks/useNativeBridge';
import {useAuthStore} from '@/store/useAuthStore';
import {NotificationService} from '@/services/NotificationService';
import {colors} from '@/theme';

const App: React.FC = () => {
  // Wire native events -> stores/logs/notifications (mounts once).
  useNativeBridge();

  const session = useAuthStore(s => s.session);
  const initializing = useAuthStore(s => s.initializing);
  const initAuth = useAuthStore(s => s.init);

  useEffect(() => {
    initAuth();
    NotificationService.requestPermission().catch(() => {});
  }, [initAuth]);

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
        {initializing ? (
          <View
            style={{
              flex: 1,
              backgroundColor: colors.bg,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : session ? (
          <AppNavigator />
        ) : (
          <AuthScreen />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
