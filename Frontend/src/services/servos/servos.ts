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
// Inativar (motivo opcional) ou reativar: só coord. geral e administrador.
// Quem saiu há mais de 2 anos só volta como exceção (excecao: true).
export function putStatusServo(
  id_servo: number,
  status: "Ativo" | "Inativo",
  motivo?: string,
  excecao = false
) {
  return apiRequest(`/servos/${id_servo}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, motivo: motivo || null, excecao }),
  });
}

// Saiu há mais de 2 anos (data_saida = "AAAA-MM-DD")
export function passouDoPrazo(data_saida: string | null | undefined) {
  if (!data_saida) return false;
  const limite = new Date();
  limite.setFullYear(limite.getFullYear() - 2);
  return new Date(`${data_saida}T00:00:00`) <= limite;
}

// ── Revisão anual de inativos (admin e coord. geral) ──

export interface InativoParaRevisao {
  id: number;
  nome: string;
  data_saida: string; // AAAA-MM-DD
  tem_login: boolean;
}

export function getRevisaoInativos(): Promise<InativoParaRevisao[]> {
  return apiRequest("/servos/revisao-inativos");
}

export function excluirServos(ids: number[]): Promise<{ message: string; excluidos: number }> {
  return apiRequest("/servos/excluir", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

// Dados de contato, apelido e responsável: o próprio servo ou admin/coord. geral.
// Campo vazio = apagar.
export interface DadosServo {
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  data_nascimento: string | null; // AAAA-MM-DD
  apelido: string | null;
  responsavel_nome: string | null;
  responsavel_telefone: string | null;
}

export function putDadosServo(id_servo: number, dados: DadosServo) {
  return apiRequest(`/servos/${id_servo}/dados`, {
    method: "PUT",
    body: JSON.stringify(dados),
  });
}
