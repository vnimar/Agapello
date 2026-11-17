import {apiRequest} from "../api"
import type { ArquivoEscolhido } from "../pastas/pastas";

export type PublicoMissao = "servos" | "cursistas" | "ambos";

export interface Missao {
  id_missao: number;
  data: string;            // YYYY-MM-DD
  descricao: string;
  local: string;
  horario: string;         // "HH:MM" ou "Horário não definido"
  publico: PublicoMissao;
  conta_frequencia: boolean;
  observacao: string | null;
}

export interface MissaoInput {
  data: string;            // YYYY-MM-DD
  descricao: string;
  horario: string | null;  // HH:MM
  local: string | null;
  publico: PublicoMissao;
  conta_frequencia: boolean;
  observacao: string | null;
}

export interface MissaoImportItem {
  linha: number;
  data: string | null;     // YYYY-MM-DD (null quando a data da planilha é inválida)
  descricao: string;
  horario: string | null;
  local: string | null;
  publico: PublicoMissao;
  conta_frequencia: boolean;
  observacao: string | null;
  situacao: "nova" | "duplicada" | "erro";
  erro: string | null;
  avisos: string[];
  nome_novo: boolean;      // nome que ainda não existe no calendário
}

export interface ImportacaoCalendario {
  message: string;
  gravadas: number;
  novas: number;
  duplicadas: number;
  erros: string[];
  avisos: string[];
  itens: MissaoImportItem[];
}

//Endpoint para buscar informação na Api
export function getProximaMissao(){
    return apiRequest<Missao>("/missao/proxima")
    }

export function getMissoes() {
    return apiRequest<Missao[]>("/missao/");
    }

export async function getUltimasMissoes() {
    return apiRequest<Missao[]>("/missao/ultimas");
    }

// ── Edição (administrador/coord. geral) ─────────────────────────────────────

export function criarMissao(missao: MissaoInput) {
    return apiRequest<Missao>("/missao/", {
        method: "POST",
        body: JSON.stringify(missao),
    });
    }

export function atualizarMissao(id_missao: number, missao: MissaoInput) {
    return apiRequest<Missao>(`/missao/${id_missao}`, {
        method: "PUT",
        body: JSON.stringify(missao),
    });
    }

export function excluirMissao(id_missao: number) {
    return apiRequest<void>(`/missao/${id_missao}`, {
        method: "DELETE",
    });
    }

// Planilha do calendário (Modelo - Calendário). confirmar=false → só a prévia.
export function importarCalendario(arquivo: ArquivoEscolhido, confirmar: boolean) {
  const form = new FormData();
  if (arquivo.file) {
    form.append("arquivo", arquivo.file);
  } else {
    // React Native: o fetch lê o arquivo pela uri
    form.append("arquivo", {
      uri: arquivo.uri,
      name: arquivo.name,
      type: arquivo.mimeType ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    } as any);
  }
  form.append("confirmar", String(confirmar));
  return apiRequest<ImportacaoCalendario>("/missao/importar", { method: "POST", body: form });
}

// Marca de uma vez o que conta (ou não) na frequência; só as alteradas
export function marcarContaFrequencia(ids_conta: number[], ids_nao_conta: number[]) {
    return apiRequest<{ atualizadas: number }>("/missao/conta-frequencia", {
        method: "PUT",
        body: JSON.stringify({ ids_conta, ids_nao_conta }),
    });
    }
