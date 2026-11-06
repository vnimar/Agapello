import { apiRequest } from "../api";
import { DadosServo } from "../servos/servos";

// Quadrante: dados de todos os servos ativos e dos cursistas do ano, para
// qualquer servo logado. Sem frequência.

export interface PastaQuadrante {
  nome: string;
  momento: "encontro" | "pos";
  coordenador: boolean;
}

interface DadosPessoais {
  nome: string;
  apelido: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  data_nascimento: string | null; // AAAA-MM-DD
  idade: number | null;
  responsavel_nome: string | null;
  responsavel_telefone: string | null;
}

export interface ServoQuadrante extends DadosPessoais {
  id: number;
  ano_ingresso: number | null;
  pastas: PastaQuadrante[];
}

export interface CursistaQuadrante extends DadosPessoais {
  id_cursista: number;
  comunidade: string | null;
}

export interface Quadrante {
  ano: number;
  servos: ServoQuadrante[];
  cursistas: CursistaQuadrante[];
}

export function getQuadrante() {
  return apiRequest<Quadrante>("/quadrante/");
}

// Dados do cursista: só admin e coord. geral. Campo vazio = apagar.
export function putDadosCursista(id_cursista: number, dados: DadosServo) {
  return apiRequest(`/cursistas/${id_cursista}/dados`, {
    method: "PUT",
    body: JSON.stringify(dados),
  });
}
