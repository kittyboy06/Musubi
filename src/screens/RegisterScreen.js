import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { theme } from '../utils/theme';
import Input from '../components/Input';
import Button from '../components/Button';

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleRegister = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!email || !password) {
      setErrorMessage('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
    });

    setLoading(false);
    if (error) {
      if (error.status === 429 || error.message?.toLowerCase().includes('rate limit')) {
        setErrorMessage('Sign-up rate limit reached by Supabase. Please wait a minute or try signing in if your account is created.');
      } else {
        setErrorMessage(error.message);
      }
    } else if (data.session) {
      // Auto logged in via auth state listener
    } else {
      const msg = 'Account created successfully! You can now log in.';
      setSuccessMessage(msg);
      if (Platform.OS !== 'web') {
        Alert.alert('Success', msg, [{ text: 'OK', onPress: () => navigation.navigate('Login') }]);
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
              <Ionicons name="person-add-outline" size={32} color={theme.colors.primaryLight} />
            </View>
            <Text style={styles.title}>Join Musubi</Text>
            <Text style={styles.subtitle}>Create your private digital vault</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={18} color={theme.colors.danger} />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.successContainer}>
                <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.success} />
                <Text style={styles.successBannerText}>{successMessage}</Text>
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
              placeholder="Min 6 characters"
              secureTextEntry
              autoCapitalize="none"
              leftIcon={<Ionicons name="lock-closed-outline" size={18} color={theme.colors.textSubtle} />}
            />

            <Input
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter password"
              secureTextEntry
              autoCapitalize="none"
              leftIcon={<Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.textSubtle} />}
            />

            <Button
              title="Create Account"
              onPress={handleRegister}
              loading={loading}
              style={{ marginTop: 8 }}
            />
          </View>

          {/* Footer Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.linkText}>Sign In</Text>
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
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: theme.colors.success,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 16,
  },
  successBannerText: {
    color: theme.colors.success,
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
