import type { CapacitorConfig } from '@capacitor/cli';

// Native iOS shell around the web app. The bundle id can be changed in Xcode
// (Signing & Capabilities) to one registered with your Apple developer account.
const config: CapacitorConfig = {
  appId: 'de.vonhuelsen.handwritten',
  appName: 'Handwritten',
  webDir: 'dist',
  ios: { contentInset: 'never', backgroundColor: '#ffffff' },
};

export default config;
