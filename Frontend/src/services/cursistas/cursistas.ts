import { apiRequest } from "../api";
import { StatusFrequencia } from "../frequencia/frequencia";
import { ArquivoEscolhido } from "../pastas/pastas";

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
  apelido?: string | null;
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

// ── Lista com a % do ano (mesmas comunidades da chamada) ──

export interface CursistaFrequencia {
  id_cursista: number;
  nome: string;
  apelido?: string | null;
  presente: number;
  justificada: number;
  falta: number;
  percentual_presenca: number | null; // null = nenhuma chamada no ano
}

export interface FrequenciaCursistas {
  ano: number;
  comunidades: { id_comunidade: number; nome: string; cursistas: CursistaFrequencia[] }[];
}

export function getFrequenciaCursistas() {
  return apiRequest<FrequenciaCursistas>("/cursistas/frequencia");
}

// ── Gestão (admin e coord. geral) ──
// O cursista entra pela planilha do encontro; quem falta ao encontro, desiste
// ou foi lançado por engano é apagado por completo.

export interface CursistaImportado {
  linha: number;
  nome: string;
  apelido?: string | null;
  comunidade: string | null; // null = comunidade não achada
  acao: "novo" | "atualiza" | "erro";
  erro: string | null;
  avisos: string[];
}

export interface ImportacaoCursistas {
  ano: number;
  message: string;
  gravado: boolean;
  novos: number;
  atualizados: number;
  cursistas: CursistaImportado[];
  erros: string[];
  avisos: string[];
}

export interface CursistaItem {
  id_cursista: number;
  nome: string;
  apelido?: string | null;
  id_comunidade: number | null;
  comunidade: string | null;
  status: string;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  data_nascimento: string | null;
  idade: number | null;
  responsavel_nome?: string | null;
  responsavel_telefone?: string | null;
}

export interface FaltosoEncontro {
  id_cursista: number;
  nome: string;
  apelido?: string | null;
  comunidade: string | null;
  faltas: string[]; // dias do encontro (YYYY-MM-DD)
}

export function importarCursistas(arquivo: ArquivoEscolhido, ano: number, confirmar: boolean) {
  const form = new FormData();
  if (arquivo.file) {
    form.append("arquivo", arquivo.file);
  } else {
    form.append("arquivo", {
      uri: arquivo.uri,
      name: arquivo.name,
      type: arquivo.mimeType ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    } as any);
  }
  form.append("ano", String(ano));
  form.append("confirmar", String(confirmar));
  return apiRequest<ImportacaoCursistas>("/cursistas/importar", { method: "POST", body: form });
}

export function listarCursistas(ano: number) {
  return apiRequest<CursistaItem[]>(`/cursistas/?ano=${ano}`);
}

export function listarFaltososEncontro(ano: number) {
  return apiRequest<FaltosoEncontro[]>(`/cursistas/faltosos-encontro?ano=${ano}`);
}

export function excluirCursistas(ids: number[]) {
  return apiRequest<{ message: string }>("/cursistas/excluir", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}
