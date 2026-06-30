/**
 * Shift Grabber root component.
 *
 * Gates: not signed in -> AuthScreen. Signed in but no active trial/subscription
 * -> PaywallScreen. Signed in with access -> the app.
 */
import React, {useEffect} from 'react';
import {StatusBar, View, ActivityIndicator} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';

import {AppNavigator} from '@/navigation/AppNavigator';
import {AuthScreen} from '@/screens/AuthScreen';
import {PaywallScreen} from '@/screens/PaywallScreen';
import {useNativeBridge} from '@/hooks/useNativeBridge';
import {useAuthStore} from '@/store/useAuthStore';
import {useEntitlementStore} from '@/store/useEntitlementStore';
import {NotificationService} from '@/services/NotificationService';
import {colors} from '@/theme';

const Splash: React.FC = () => (
  <View
    style={{
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
    <ActivityIndicator color={colors.primary} size="large" />
  </View>
);

const App: React.FC = () => {
  // Wire native events -> stores/logs/notifications (mounts once).
  useNativeBridge();

  const session = useAuthStore(s => s.session);
  const initializing = useAuthStore(s => s.initializing);
  const initAuth = useAuthStore(s => s.init);

  const entLoading = useEntitlementStore(s => s.loading);
  const hasAccess = useEntitlementStore(s => s.hasAccess);
  const refreshEntitlement = useEntitlementStore(s => s.refresh);
  const resetEntitlement = useEntitlementStore(s => s.reset);

  useEffect(() => {
    initAuth();
    NotificationService.requestPermission().catch(() => {});
  }, [initAuth]);

  // Whenever the session appears/changes, re-check entitlement.
  useEffect(() => {
    if (session) {
      refreshEntitlement();
    } else {
      resetEntitlement();
    }
  }, [session, refreshEntitlement, resetEntitlement]);

  const renderBody = () => {
    if (initializing) {
      return <Splash />;
    }
    if (!session) {
      return <AuthScreen />;
    }
    if (entLoading) {
      return <Splash />;
    }
    return hasAccess ? <AppNavigator /> : <PaywallScreen />;
  };

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
        {renderBody()}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
