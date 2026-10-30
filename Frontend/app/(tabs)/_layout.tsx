import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Cores } from '@/constants/theme';
import { useAuth } from '@/src/context/AuthContext';


export default function TabLayout() {
  const { usuario, carregando, loginObrigatorio, cuidaDosServos } = useAuth();

  // Ainda lendo o token salvo: não monta as telas, senão elas chamam a API
  // sem o token, recebem 401 e ficam vazias até sair e entrar de novo
  if (carregando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Login obrigatório e ninguém logado → tela de login
  if (!carregando && loginObrigatorio && !usuario) {
    return <Redirect href="/login" />;
  }

  // Entrou com senha temporária → troca antes de usar o app
  if (usuario?.trocar_senha) {
    return <Redirect href="/trocar-senha" />;
  }

  // Abas só de quem cuida dos servos ficam escondidas para os outros perfis
  const soCoordServos = cuidaDosServos ? {} : { href: null };

  // @ts-ignore
    return (
    <Tabs
        screenOptions={{
            tabBarActiveTintColor: Cores.primaria,
            tabBarInactiveTintColor: Cores.iconeInativo,
            tabBarStyle: { backgroundColor: Cores.card, borderTopColor: Cores.borda },
            headerShown: false,
            tabBarButton: HapticTab,
            }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Início',
                    tabBarIcon: ({color}) => <IconSymbol size={28} name="house.fill" color={color}/>,
                }}/>
            <Tabs.Screen
                name="servo"
                options={{
                    ...soCoordServos,
                    title: 'Servo',
                    tabBarIcon: ({color}) => (
                        <IconSymbol size={28} name="person.2.fill" color={color}/>
                    ),
                }}/>
            <Tabs.Screen
                name="calendario"
                options={{
                    title: 'Calendário',
                    tabBarIcon: ({color}) => (
                        <IconSymbol size={28} name="calendar" color={color}/>
                    ),
                }}/>
            <Tabs.Screen
                name="frequencia"
                options={{
                    ...soCoordServos,
                    title: 'Frequência',
                    tabBarIcon: ({color}) => (
                        <IconSymbol size={28} name="checkmark.circle" color={color}/>
                    ),
                }}/>
            {/* Sem aba própria: abre pelo atalho da Home (a barra não cresce) */}
            <Tabs.Screen name="cursistas" options={{ href: null, title: 'Cursistas' }}/>
        </Tabs>
  );
}
