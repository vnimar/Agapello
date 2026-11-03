// eslint-disable-next-line import/namespace
import { apiRequest } from "../api";

//Endpoint para buscar informação na Api
export function getServos() {
  // Com a barra: sem ela o backend redireciona e o token se perde no caminho (401 → logout)
  return apiRequest("/servos/");
}

export function getServosById(id_servo: number) {
  return apiRequest(`/servos/${id_servo}`);
}
// Inativar (motivo opcional) ou reativar: só coord. geral e administrador
export function putStatusServo(
  id_servo: number,
  status: "Ativo" | "Inativo",
  motivo?: string
) {
  return apiRequest(`/servos/${id_servo}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, motivo: motivo || null }),
  });
}
