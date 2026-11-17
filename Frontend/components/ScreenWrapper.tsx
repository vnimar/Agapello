import React from 'react';
import { View, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cores } from '@/constants/theme';

type ScreenWrapperProps = {
  children: React.ReactNode;
  scrollable?: boolean;
  backgroundColor?: string;
};

export default function ScreenWrapper({
  children,
  scrollable = true,
  backgroundColor = Cores.fundo,
}: ScreenWrapperProps) {
  const insets = useSafeAreaInsets();
  const Container = scrollable ? ScrollView : View;
  const contentContainerStyle = scrollable ? {
    flexGrow: 1,
    paddingBottom: 20,
  } : { flex: 1 };

  return (
    <View style={[styles.root, { backgroundColor }]}>
      <StatusBar barStyle="dark-content" backgroundColor={backgroundColor} />
      <Container
        showsVerticalScrollIndicator={false}
        contentContainerStyle={contentContainerStyle}
      >
        <View style={[styles.content, { paddingTop: insets.top }]}>
          {children}
        </View>
      </Container>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
});