import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from '@/src/context/AuthContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        {/* O app só tem visual claro, mesmo com o celular no modo escuro */}
        <ThemeProvider value={DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="login" options={{ presentation: 'modal' }} />
            <Stack.Screen name="recuperar-senha" options={{ presentation: 'modal' }} />
            <Stack.Screen name="conta" options={{ presentation: 'modal' }} />
            <Stack.Screen name="trocar-senha" options={{ gestureEnabled: false }} />
            <Stack.Screen name="usuarios" />
            <Stack.Screen name="importar-pastas" />
            <Stack.Screen name="importar-calendario" />
            <Stack.Screen name="revisao-inativos" />
            <Stack.Screen name="cursistas-gerenciar" />
            <Stack.Screen name="importar-cursistas" />
            <Stack.Screen name="historico" />
            <Stack.Screen name="subir-apostolado" />
            <Stack.Screen name="apostolado" options={{ gestureEnabled: false }} />
          </Stack>
          <StatusBar style="dark" />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
