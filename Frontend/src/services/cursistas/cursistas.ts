import { apiRequest } from "../api";
import { StatusFrequencia } from "../frequencia/frequencia";

// Chamada de cursistas: só Formação de Cursistas e Encontro Querigmático,
// só até hoje e só as comunidades de quem faz a chamada (o backend filtra).

export interface MissaoCursista {
  id_missao: number;
  data: string;            // YYYY-MM-DD
  descricao: string;
  tem_frequencia: boolean; // já tem chamada em alguma comunidade minha
}

export interface CursistaChamada {
  id_cursista: number;
  nome: string;
  status: StatusFrequencia | null;  // null = chamada ainda não feita
}

export interface ComunidadeChamada {
  id_comunidade: number;
  nome: string;
  cursistas: CursistaChamada[];
}

export interface ChamadaCursista {
  id_missao: number;
  data: string;
  descricao: string;
  comunidades: ComunidadeChamada[];
}

export function getMissoesCursistas() {
  return apiRequest<{ data: MissaoCursista[] }>("/cursistas/chamada/missoes");
}

export function getChamadaCursistas(id_missao: number) {
  return apiRequest<ChamadaCursista>(`/cursistas/chamada/${id_missao}`);
}

export function salvarChamadaCursistas(
  id_missao: number,
  itens: { id_cursista: number; status: StatusFrequencia }[]
) {
  return apiRequest<{ message: string }>(`/cursistas/chamada/${id_missao}`, {
    method: "PUT",
    body: JSON.stringify({ itens }),
  });
}
