import { Ionicons } from '@expo/vector-icons';
import React from 'react';

import { PublicoMissao } from '@/src/services/missao/missao';

type NomeIcone = React.ComponentProps<typeof Ionicons>['name'];

/** Ícone de cada missão conforme o público (Home e Calendário). */
export const ICONE_PUBLICO: Record<PublicoMissao, NomeIcone> = {
  servos: 'people-outline',
  cursistas: 'school-outline',
  ambos: 'people-circle-outline',
};
