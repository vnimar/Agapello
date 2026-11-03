import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from '@/src/context/AuthContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="login" options={{ presentation: 'modal' }} />
            <Stack.Screen name="conta" options={{ presentation: 'modal' }} />
            <Stack.Screen name="trocar-senha" options={{ gestureEnabled: false }} />
            <Stack.Screen name="usuarios" />
            <Stack.Screen name="importar-pastas" />
            <Stack.Screen name="revisao-inativos" />
            <Stack.Screen name="cursistas-gerenciar" />
            <Stack.Screen name="importar-cursistas" />
            <Stack.Screen name="historico" />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
