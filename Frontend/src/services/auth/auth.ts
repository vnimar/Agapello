import * as SecureStore from "expo-secure-store";
import { apiRequest } from "../api";

export type Perfil =
  | "servo"
  | "coordenador_formacao_vivencia"
  | "coordenador_comunidade_cursista"
  | "tutor_comunidade_cursista"
  | "coordenador_geral"
  | "administrador";

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;            // principal (o mais alto)
  perfis?: Perfil[];         // todos: o manual + os das pastas do ano
  id_servo: number | null;
  trocar_senha?: boolean;  // senha temporária: precisa trocar antes de usar o app
}

export const PERFIL_LABEL: Record<Perfil, string> = {
  servo: "Servo",
  coordenador_formacao_vivencia: "Coord. de Formação e Vivência",
  coordenador_comunidade_cursista: "Coord. de Comunidade de Cursistas",
  tutor_comunidade_cursista: "Tutor de Comunidade de Cursistas",
  coordenador_geral: "Coordenador Geral",
  administrador: "Administrador",
};

/** Se o usuário tem pelo menos um dos perfis (somando o manual e os das pastas). */
export function temPerfil(usuario: Usuario | null, perfis: Perfil[]): boolean {
  if (!usuario) return false;
  return (usuario.perfis ?? [usuario.perfil]).some((p) => perfis.includes(p));
}

/** Perfis que administram o calendário (mesma lista do backend). */
export const PERFIS_ADMIN: Perfil[] = ["administrador", "coordenador_geral"];

/** Perfis que cuidam dos servos: lista de servos e chamada (mesma lista do backend). */
export const PERFIS_COORD_SERVOS: Perfil[] = [
  "coordenador_formacao_vivencia",
  "coordenador_geral",
  "administrador",
];

/** Chamada de cursistas: coordenador e tutor (só a própria comunidade), coord. geral e administrador. */
export const PERFIS_CURSISTAS: Perfil[] = [
  "coordenador_comunidade_cursista",
  "tutor_comunidade_cursista",
  "coordenador_geral",
  "administrador",
];

/** Se o backend já exige login de todos (LOGIN_OBRIGATORIO no Render). */
export async function buscarLoginObrigatorio(): Promise<boolean> {
  const config = await apiRequest<{ login_obrigatorio: boolean }>("/auth/config");
  return !!config.login_obrigatorio;
}

const CHAVE_TOKEN = "agapello_auth_token";

export async function lerTokenSalvo(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(CHAVE_TOKEN);
  } catch {
    return null;
  }
}

export async function salvarToken(token: string) {
  await SecureStore.setItemAsync(CHAVE_TOKEN, token);
}

export async function apagarToken() {
  try {
    await SecureStore.deleteItemAsync(CHAVE_TOKEN);
  } catch {}
}

export function login(email: string, senha: string) {
  return apiRequest<{ access_token: string; expira_em_dias: number; usuario: Usuario }>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ email, senha }) }
  );
}

export function buscarUsuarioLogado() {
  return apiRequest<Usuario>("/auth/me");
}

export function trocarSenha(senha_atual: string, senha_nova: string) {
  return apiRequest<void>("/auth/senha", {
    method: "PUT",
    body: JSON.stringify({ senha_atual, senha_nova }),
  });
}

export type StatusFrequencia = "Presente" | "Justificada" | "Falta";

/** Minha conta: frequência do ano, foguinho e pastas de quem está logado. */
export interface MeuResumo {
  ano: number;
  id_servo: number | null;  // conta sem servo → resto vem vazio
  frequencia: {
    presente: number;
    justificada: number;
    falta: number;
    percentual_presenca: number | null;  // null = nenhuma chamada no ano
  };
  missoes: { data: string; descricao: string; status: StatusFrequencia }[];
  foguinho: { sequencia_atual: number; recorde: number; chama_acesa: boolean };
  pastas: { nome: string; momento: "encontro" | "pos"; coordenador: boolean }[];
}

export function buscarMeuResumo() {
  return apiRequest<MeuResumo>("/auth/me/resumo");
}
