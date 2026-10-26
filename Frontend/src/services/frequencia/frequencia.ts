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

// ── Funções de serviço ────────────────────────────────────────────────────────

export function getFrequenciaById(id_missao: number) {
  return apiRequest<FrequenciaResponse | FrequenciaEmptyResponse>(
    `/frequencia/missao/${id_missao}`
  );
}

export function getFrequenciaServos() {
  return apiRequest<FrequenciaServosResponse>(`/frequencia/servos`);
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

