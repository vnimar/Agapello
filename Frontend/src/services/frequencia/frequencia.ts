// eslint-disable-next-line import/namespace
import { apiRequest } from "../api";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type StatusFrequencia = "Presente" | "Falta" | "Justificada";

export interface FrequenciaItem {
  id_servo: number;
  nome: string;
  status: StatusFrequencia;
}

export interface FrequenciaResponse {
  message: string;
  data_missao: string;
  descricao: string;
  data: FrequenciaItem[];
}

export interface FrequenciaEmptyResponse {
  message: string;
  data_missao: string;
  descricao: string;
}

export interface FrequenciaServoResumo {
  id_servo: number;
  nome: string;
  presente: number;
  justificada: number;
  falta: number;
  percentual_presenca: number | null;
}

export interface FrequenciaServosResponse {
  message: string;
  ano: number;  // a frequência é anual (reinicia em 1º de janeiro)
  data: FrequenciaServoResumo[];
}

export interface MissaoComFrequencia {
  id_missao: number;
  data: string;
  descricao: string | null;
  tem_frequencia: boolean;
}

export interface MissaoDoServo {
  data: string;
  descricao: string | null;
  status: StatusFrequencia;
}

export interface MissoesDoServoResponse {
  ano: number;
  data: MissaoDoServo[];
}

// ── Funções de serviço ────────────────────────────────────────────────────────

export function getFrequenciaById(id_missao: number) {
  return apiRequest<FrequenciaResponse | FrequenciaEmptyResponse>(
    `/frequencia/missao/${id_missao}`
  );
}

export function getFrequenciaServos() {
  return apiRequest<FrequenciaServosResponse>(`/frequencia/servos`);
}

// Datas de cada status do servo no ano (coordenação confere pela Lista)
export function getMissoesDoServo(id_servo: number) {
  return apiRequest<MissoesDoServoResponse>(`/frequencia/servo/${id_servo}/missoes`);
}

export function getMissoesComFrequencia(){
  return apiRequest<{data: MissaoComFrequencia[]}>("/frequencia/missoes")
}

export function postFrequencia(
  id_servo: number,
  id_missao: number,
  status: StatusFrequencia
) {
  return apiRequest<{ message: string }>("/frequencia/register", {
    method: "POST",
    body: JSON.stringify({ id_servo, id_missao, status }),
  });
}

export function putFrequencia(
  id_servo: number,
  id_missao: number,
  status: StatusFrequencia
) {
  return apiRequest<{ message: string }>("/frequencia/update", {
    method: "PUT",
    body: JSON.stringify({ id_servo, id_missao, status }),
  });
}

