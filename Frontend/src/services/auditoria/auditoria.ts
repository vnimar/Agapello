import { apiRequest } from "../api";

// Histórico de alterações (só administrador). Guarda 1 ano.

export interface RegistroAuditoria {
  id_auditoria: number;
  criado_em: string; // ISO
  usuario: string | null; // "Nome (#id, perfil)"; null = sem login
  metodo: string;
  rota: string;
  status: number;
  corpo: string | null; // dados pessoais vêm como ***
}

export function listarAuditoria(busca?: string, antes_de?: number) {
  const params = new URLSearchParams({ limite: "50" });
  if (busca?.trim()) params.set("busca", busca.trim());
  if (antes_de) params.set("antes_de", String(antes_de));
  return apiRequest<RegistroAuditoria[]>(`/auditoria/?${params.toString()}`);
}
