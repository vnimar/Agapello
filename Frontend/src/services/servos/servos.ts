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

// Dados de contato: o próprio servo ou admin/coord. geral. Campo vazio = apagar.
export interface DadosServo {
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  data_nascimento: string | null; // AAAA-MM-DD
}

export function putDadosServo(id_servo: number, dados: DadosServo) {
  return apiRequest(`/servos/${id_servo}/dados`, {
    method: "PUT",
    body: JSON.stringify(dados),
  });
}
