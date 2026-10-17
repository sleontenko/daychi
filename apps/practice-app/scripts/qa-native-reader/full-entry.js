// Isolated data/provider fixture; use the real Expo Router and all app screens.
import './full-network';
import {LogBox} from 'react-native';
// This known development-only toast covers the phone's bottom navigation.
// Keep other warnings/errors visible; production screens are not modified.
LogBox.ignoreLogs(['Linking found multiple possible URI schemes in your Expo config.']);
import 'expo-router/entry';
