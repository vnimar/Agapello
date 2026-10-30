import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { setAuthToken, setOnSessaoExpirada } from "../services/api";
import {
  Usuario,
  PERFIS_ADMIN,
  PERFIS_COORD_SERVOS,
  PERFIS_CURSISTAS,
  temPerfil,
  buscarLoginObrigatorio,
  login as loginApi,
  buscarUsuarioLogado,
  lerTokenSalvo,
  salvarToken,
  apagarToken,
} from "../services/auth/auth";

// Com sessão, o token vai em todas as chamadas e o que
// aparece depende do perfil.

const CHAVE_USUARIO = "agapello_auth_usuario";
const CHAVE_LOGIN_OBRIGATORIO = "agapello_login_obrigatorio";

interface AuthContextValue {
  usuario: Usuario | null;
  carregando: boolean;        // restaurando a sessão salva ao abrir o app
  isAdmin: boolean;
  loginObrigatorio: boolean;  // backend já exige login de todos
  cuidaDosServos: boolean;    // pode ver a lista de servos e fazer a chamada
  cuidaDosCursistas: boolean; // faz a chamada de cursistas
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
  recarregarUsuario: () => Promise<void>;  // ex.: depois de trocar a senha
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  // Começa exigindo login: sem isso, enquanto o backend (Render) acorda, o app
  // instalado agora abriria sem login. O valor salvo ou o do backend corrige depois.
  const [loginObrigatorio, setLoginObrigatorio] = useState(true);

  const sair = useCallback(async () => {
    setAuthToken(null);
    setUsuario(null);
    await apagarToken();
    try {
      await SecureStore.deleteItemAsync(CHAVE_USUARIO);
    } catch {}
  }, []);

  // Token recusado pelo backend (expirou, foi inativado...) → sai
  useEffect(() => {
    setOnSessaoExpirada(() => { sair(); });
    return () => setOnSessaoExpirada(null);
  }, [sair]);

  // Login obrigatório: usa o último valor salvo e confere com o backend
  useEffect(() => {
    (async () => {
      try {
        const salvo = await SecureStore.getItemAsync(CHAVE_LOGIN_OBRIGATORIO);
        if (salvo) setLoginObrigatorio(salvo === "true");
      } catch {}
      try {
        const atual = await buscarLoginObrigatorio();
        setLoginObrigatorio(atual);
        await SecureStore.setItemAsync(CHAVE_LOGIN_OBRIGATORIO, String(atual));
      } catch {}
    })();
  }, []);

  // Restaura a sessão salva
  useEffect(() => {
    (async () => {
      const token = await lerTokenSalvo();
      if (!token) {
        setCarregando(false);
        return;
      }
      setAuthToken(token);

      // Mostra logo o usuário salvo (funciona sem internet / com o Render acordando)
      try {
        const salvo = await SecureStore.getItemAsync(CHAVE_USUARIO);
        if (salvo) setUsuario(JSON.parse(salvo));
      } catch {}
      setCarregando(false);

      // Confere com o backend; se o token for recusado, o onSessaoExpirada faz o logout
      try {
        const atual = await buscarUsuarioLogado();
        setUsuario(atual);
        await SecureStore.setItemAsync(CHAVE_USUARIO, JSON.stringify(atual));
      } catch {}
    })();
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    const resposta = await loginApi(email.trim().toLowerCase(), senha);
    setAuthToken(resposta.access_token);
    await salvarToken(resposta.access_token);
    await SecureStore.setItemAsync(CHAVE_USUARIO, JSON.stringify(resposta.usuario));
    setUsuario(resposta.usuario);
  }, []);

  const recarregarUsuario = useCallback(async () => {
    const atual = await buscarUsuarioLogado();
    setUsuario(atual);
    await SecureStore.setItemAsync(CHAVE_USUARIO, JSON.stringify(atual));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    usuario,
    carregando,
    isAdmin: temPerfil(usuario, PERFIS_ADMIN),
    loginObrigatorio,
    // Sem login (só na transição) continua vendo tudo, como antes
    cuidaDosServos: usuario ? temPerfil(usuario, PERFIS_COORD_SERVOS) : !loginObrigatorio,
    cuidaDosCursistas: temPerfil(usuario, PERFIS_CURSISTAS),
    entrar,
    sair,
    recarregarUsuario,
  }), [usuario, carregando, loginObrigatorio, entrar, sair, recarregarUsuario]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
