import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '../utils/theme';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import VaultExplorerScreen from '../screens/VaultExplorerScreen';
import NoteEditorScreen from '../screens/NoteEditorScreen';
import VaultChatScreen from '../screens/VaultChatScreen';
import GraphViewScreen from '../screens/GraphViewScreen';
import ProfileScreen from '../screens/ProfileScreen';

export default function AppNavigator() {
  const [session, setSession] = useState({ user: { id: 'demo-user' } });
  const [currentScreen, setCurrentScreen] = useState('Dashboard');
  const [screenParams, setScreenParams] = useState({});

  const navigation = {
    navigate: (screenName, params = {}) => {
      setScreenParams(params);
      setCurrentScreen(screenName);
    },
    goBack: () => {
      setCurrentScreen('Dashboard');
    },
    setParams: (params) => {
      setScreenParams((prev) => ({ ...prev, ...params }));
    },
  };

  if (!session) {
    return <LoginScreen navigation={navigation} />;
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'VaultExplorer':
        return <VaultExplorerScreen navigation={navigation} route={{ params: screenParams }} />;
      case 'NoteEditor':
        return <NoteEditorScreen navigation={navigation} route={{ params: screenParams }} />;
      case 'VaultChat':
        return <VaultChatScreen navigation={navigation} route={{ params: screenParams }} />;
      case 'GraphView':
        return <GraphViewScreen navigation={navigation} route={{ params: screenParams }} />;
      case 'Profile':
        return <ProfileScreen navigation={navigation} route={{ params: screenParams }} />;
      case 'Dashboard':
      default:
        return <DashboardScreen navigation={navigation} route={{ params: screenParams }} />;
    }
  };

  return <View style={styles.container}>{renderScreen()}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.bg,
  },
});
