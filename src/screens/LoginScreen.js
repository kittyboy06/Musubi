import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { theme } from '../utils/theme';
import Input from '../components/Input';
import Button from '../components/Button';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    setErrorMessage('');
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });

    setLoading(false);
    if (error) {
      if (error.status === 429 || error.message?.toLowerCase().includes('rate limit')) {
        setErrorMessage('Rate limit reached. Please wait 60 seconds before trying to log in again.');
      } else {
        setErrorMessage(error.message);
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Ionicons name="journal-outline" size={36} color={theme.colors.primaryLight} />
            </View>
            <Text style={styles.title}>Musubi</Text>
            <Text style={styles.subtitle}>Cloud-Based Obsidian Journal</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={18} color={theme.colors.danger} />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            ) : null}

            <Input
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              placeholder="user@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon={<Ionicons name="mail-outline" size={18} color={theme.colors.textSubtle} />}
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              leftIcon={<Ionicons name="lock-closed-outline" size={18} color={theme.colors.textSubtle} />}
            />

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              style={{ marginTop: 8 }}
            />
          </View>

          {/* Footer Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.linkText}>Create One</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  form: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    padding: 24,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.dangerBg,
    borderColor: theme.colors.danger,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    color: theme.colors.danger,
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  linkText: {
    color: theme.colors.primaryLight,
    fontSize: 14,
    fontWeight: '600',
  },
});
