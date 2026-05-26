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

registerRootComponent(App);
