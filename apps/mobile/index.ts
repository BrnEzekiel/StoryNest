import { registerRootComponent } from 'expo';

/**
 * 1. Force Firebase initialization at the absolute top of the entry file.
 * This ensures that the component registry is populated BEFORE any screens or
 * context providers are evaluated.
 */
import './src/api/firebaseConfig';

/**
 * 2. Import the main App component.
 */
import App from './App';

import TrackPlayer from 'react-native-track-player';
import { playbackService } from './src/audio/playbackService';

/**
 * 3. Podcast background playback: notification/lock-screen controls answer
 * even when the app is closed or the screen is off.
 */
TrackPlayer.registerPlaybackService(() => playbackService);

registerRootComponent(App);
