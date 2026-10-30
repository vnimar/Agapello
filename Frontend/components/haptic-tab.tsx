import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';

import { Cores } from '@/constants/theme';

export function HapticTab(props: BottomTabBarButtonProps) {
  const ativa = props['aria-selected'];

  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    >
      {/* Traço azul em cima da aba ativa (mockup) */}
      {ativa && <View style={styles.indicador} />}
      {props.children}
    </PlatformPressable>
  );
}

const styles = StyleSheet.create({
  indicador: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: 36,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: Cores.primaria,
  },
});
