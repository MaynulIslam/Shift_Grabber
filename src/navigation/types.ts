import {NavigatorScreenParams} from '@react-navigation/native';

/** Stack nested inside the "Home" tab. */
export type HomeStackParamList = {
  Home: undefined;
  Skip: undefined;
  ShiftGrabber: undefined;
};

/** Bottom tab navigator. */
export type RootTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  LogsTab: undefined;
  SettingsTab: undefined;
};
