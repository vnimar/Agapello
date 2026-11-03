import { apiRequest } from "../api";

// Virada de pastas: importa a planilha de distribuição (administrador e
// coordenação geral; o backend confere).

export type Momento = "encontro" | "pos";

export interface PessoaImportada {
  nome_planilha: string;
  id_servo: number | null;
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
