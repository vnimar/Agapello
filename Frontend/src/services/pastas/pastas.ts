import { apiRequest } from "../api";

// Virada de pastas: importa a planilha de distribuição (administrador e
// coordenação geral; o backend confere).

export type Momento = "encontro" | "pos";

export interface PessoaImportada {
  nome_planilha: string;
  id_servo: number | null;
  id_cursista?: number | null; // cursista do ano anterior: vira servo na virada
  servo: string | null;     // nome no sistema
  conferir: boolean;        // achado por aproximação
  erro: string | null;      // recusado (ex.: repetição de pasta)
}

export interface EquipeImportada {
  momento: Momento;
  coordenadores: PessoaImportada[];
  membros: PessoaImportada[];
  ignorados: string[];
}

export interface PastaImportada {
  funcao_planilha: string;
  linha: number;
  id_pasta: number | null;
  pasta: string | null;     // null = não existe no sistema
  conferir: boolean;
  equipes: EquipeImportada[];
}

export interface ImportacaoPastas {
  ano: number;
  message: string;
  gravados: number;
  substituidos: number;
  antigos: number; // lançamentos de mais de 2 anos antes, apagados ao gravar
  pastas: PastaImportada[];
  erros: string[];
  avisos: string[];
  // O que a virada do ano faz (1º de janeiro, ou na hora se o ano já começou)
  promovidos: string[];          // cursistas que viram servos
  cursistas_sem_pasta: string[]; // deixam o movimento
  servos_sem_pasta: string[];    // ficam inativos
  sobem_apostolado?: string[];   // marcados para subir: sem pasta, mas não saem
  continuam_ativos?: string[];   // sem pasta, com exceção no ano ("Nome: motivo")
}

export interface ArquivoEscolhido {
  uri: string;
  name: string;
  mimeType?: string;
  file?: File;              // só na web
}

export function importarPastas(arquivo: ArquivoEscolhido, ano: number, confirmar: boolean) {
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
  form.append("ano", String(ano));
  form.append("confirmar", String(confirmar));
  return apiRequest<ImportacaoPastas>("/pastas/importar", { method: "POST", body: form });
}

// ── Exceção: servo sem pasta que continua ativo ──────────────────────────────
// Depois de gravar as pastas do ano, quem ficou sem pasta no Pós-Encontro seria
// inativado na virada; administrador e coordenação geral marcam quem continua
// ativo, com o motivo (vale só para aquele ano).

export interface ServoSemPasta {
  id: number;
  nome: string;
  apelido?: string | null;
  excecao: boolean;
  motivo?: string | null;
}

export interface ServosSemPasta {
  ano: number;
  anos_permitidos: number[];
  pastas_importadas: boolean; // sem as pastas do ano, a lista fica vazia
  servos: ServoSemPasta[];
}

export function getServosSemPasta(ano?: number): Promise<ServosSemPasta> {
  return apiRequest(ano ? `/pastas/sem-pasta?ano=${ano}` : "/pastas/sem-pasta");
}

export function marcarExcecoesSemPasta(ano: number, excecoes: { id_servo: number; motivo: string }[]) {
  return apiRequest<{ message: string; marcados: number }>("/pastas/sem-pasta", {
    method: "PUT",
    body: JSON.stringify({ ano, excecoes }),
  });
}
