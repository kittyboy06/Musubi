import './global.css';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const styleId = 'bitcount-font-override-style';
      if (!document.getElementById(styleId)) {
        const styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.innerHTML = `
          @import url('https://fonts.googleapis.com/css2?family=Bitcount+Prop+Single:wght@100..900&display=swap');

          /* Apply Bitcount Prop Single to all text elements except vector icon fonts */
          *, html, body, #root, #root div, div, p, input, textarea, button {
            font-family: 'Bitcount Prop Single', cursive, sans-serif;
          }

          /* Ensure Expo Vector Icons keep their Ionicons font-family */
          [style*="font-family: Ionicons"],
          [style*="font-family: \"Ionicons\""],
          [style*="Ionicons"] {
            font-family: Ionicons !important;
          }
        `;
        document.head.appendChild(styleEl);
      }
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
