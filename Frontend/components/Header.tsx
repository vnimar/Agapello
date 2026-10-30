import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

interface HeaderProps {
  children?: React.ReactNode;
  title?: string;
  showLogo?: boolean;
  showConta?: boolean;
}

function iniciais(nome: string) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join('');
}

export default function Header({ children, title, showLogo = true, showConta = true }: HeaderProps) {
  const { usuario } = useAuth();

  return (
    <View style={headerStyles.container}>
      <View style={headerStyles.leftSection}>
        {children || <Text style={headerStyles.title}>{title || 'AgapeSys'}</Text>}
      </View>
      {showConta && (
        <TouchableOpacity
          onPress={() => router.push(usuario ? '/conta' : '/login')}
          style={usuario ? headerStyles.avatar : headerStyles.entrar}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={usuario ? 'Minha conta' : 'Entrar'}
        >
          <Text style={usuario ? headerStyles.avatarText : headerStyles.entrarText}>
            {usuario ? iniciais(usuario.nome) : 'Entrar'}
          </Text>
        </TouchableOpacity>
      )}
      {showLogo && (
        <Image
          source={require('../assets/images/logoAgapeJovensDiscipuladoPSMA.png')}
          style={headerStyles.logo}
          resizeMode="contain"
        />
      )}
    </View>
  );
}

export const headerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
    paddingTop: 6,
    paddingBottom: 15,
    // Herda o fundo da tela (ScreenWrapper)
    backgroundColor: 'transparent',
  },
  leftSection: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    color: '#1E3A8A',
    fontWeight: '600',
  },
  logo: {
    width: 36,
    height: 36,
    marginLeft: 12,
  },
  entrar: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#043673',
  },
  entrarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  avatar: {
    marginLeft: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#043673',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
