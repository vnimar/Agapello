import { StatusFrequencia } from '@/src/services/frequencia/frequencia';

type CorStatus = { fundo: string; texto: string; forte: string };

/**
 * Cores de presença/justificada/falta (Frequência, Servos e Conta).
 * Só para indicar status; a cor principal das telas continua em Cores.
 */
export const STATUS_CORES: Record<StatusFrequencia, CorStatus> = {
  Presente: { fundo: '#EAF3DE', texto: '#3B6D11', forte: '#5A9E1E' },
  Justificada: { fundo: '#FAEEDA', texto: '#854F0B', forte: '#BA7517' },
  Falta: { fundo: '#FCEBEB', texto: '#A32D2D', forte: '#E24B4A' },
};

const SEM_DADOS: CorStatus = { fundo: '#F1F4F9', texto: '#9AA9C7', forte: '#C9D3E3' };

/** Frequência mínima do estatuto (boa a partir daqui) e limite da faixa regular. */
export const FREQ_MINIMA = 70;
export const FREQ_REGULAR = 50;

/** Cor da frequência anual: boa ≥ 70%, regular ≥ 50%, crítica abaixo disso. */
export function corDaFrequencia(percentual: number | null | undefined): CorStatus {
  if (percentual === null || percentual === undefined) return SEM_DADOS;
  if (percentual >= FREQ_MINIMA) return STATUS_CORES.Presente;
  if (percentual >= FREQ_REGULAR) return STATUS_CORES.Justificada;
  return STATUS_CORES.Falta;
}
