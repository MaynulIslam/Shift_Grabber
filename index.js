/**
 * @format
 */

import 'react-native-url-polyfill/auto';
import {AppRegistry} from 'react-native';
import notifee from '@notifee/react-native';
import App from './App';
import {name as appName} from './app.json';

// Notifee requires a background event handler to be registered (for taps /
// dismissals while the app is backgrounded). We don't need special handling
// yet, so this just satisfies the requirement and clears the warning.
notifee.onBackgroundEvent(async () => {});

AppRegistry.registerComponent(appName, () => App);
