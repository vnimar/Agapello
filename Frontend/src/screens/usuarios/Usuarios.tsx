import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { useAuth } from "../../context/AuthContext";
import { Perfil, PERFIL_LABEL, temPerfil } from "../../services/auth/auth";
import { getServos } from "../../services/servos/servos";
import {
  UsuarioAdmin,
  UsuarioForm,
  SenhaTemporaria,
  listarUsuarios,
  criarUsuario,
  editarUsuario,
  resetarSenha,
} from "../../services/usuarios/usuarios";
import { authStyles } from "../login/Login.styles";
import { styles } from "./Usuarios.styles";

// Gerenciar contas de acesso (só administrador): criar, editar perfil,
// desativar e resetar senha. Senhas novas são temporárias: a pessoa troca
// no primeiro acesso.

interface ServoOpcao {
  id: number;
  nome: string;
  status?: string;
}

const PERFIS = Object.keys(PERFIL_LABEL) as Perfil[];

const FORM_VAZIO: UsuarioForm = { nome: "", email: "", perfil: "servo", id_servo: null, ativo: true };

function semAcento(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function formatarUltimoLogin(iso: string | null) {
  if (!iso) return "Nunca entrou";
  const d = new Date(iso);
  return `Último acesso: ${d.toLocaleDateString("pt-BR")}`;
}

export default function UsuariosScreen() {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [servos, setServos] = useState<ServoOpcao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");

  const [editando, setEditando] = useState<UsuarioAdmin | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [senhaGerada, setSenhaGerada] = useState<SenhaTemporaria | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [lista, listaServos] = await Promise.all([listarUsuarios(), getServos()]);
      setUsuarios(lista);
      setServos(listaServos as ServoOpcao[]);
    } catch (err: any) {
      Alert.alert("Não foi possível carregar", err?.message || "Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = semAcento(busca.trim());
    if (!termo) return usuarios;
    return usuarios.filter((u) => semAcento(`${u.nome} ${u.email} ${u.servo_nome ?? ""}`).includes(termo));
  }, [usuarios, busca]);

  if (!temPerfil(usuario, ["administrador"])) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.vazio}>Só o administrador gerencia usuários.</Text>
        <TouchableOpacity style={authStyles.btnSecondary} onPress={() => router.back()}>
          <Text style={authStyles.btnSecondaryText}>Voltar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const abrirNovo = () => { setEditando(null); setFormAberto(true); };
  const abrirEdicao = (u: UsuarioAdmin) => { setEditando(u); setFormAberto(true); };

  const aoSalvar = (resultado: { usuario: UsuarioAdmin; senha?: SenhaTemporaria }) => {
    setFormAberto(false);
    setUsuarios((atual) => {
      const sem = atual.filter((u) => u.id !== resultado.usuario.id);
      return [...sem, resultado.usuario].sort((a, b) =>
        Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, "pt-BR"));
    });
    if (resultado.senha) setSenhaGerada(resultado.senha);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.topo}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.voltar}>‹ Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>Usuários</Text>
        <TouchableOpacity style={styles.novo} onPress={abrirNovo}>
          <Text style={styles.novoText}>+ Novo</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.busca}
        value={busca}
        onChangeText={setBusca}
        placeholder="Buscar por nome ou email"
        placeholderTextColor="#9CA3AF"
        autoCapitalize="none"
      />

      {carregando ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={(u) => String(u.id)}
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={false} onRefresh={carregar} />}
          ListEmptyComponent={<Text style={styles.vazio}>Nenhum usuário encontrado.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.item, !item.ativo && styles.itemInativo]}
              onPress={() => abrirEdicao(item)}
            >
              <Text style={styles.itemNome}>{item.nome}</Text>
              <Text style={styles.itemLinha}>{item.email}</Text>
              <Text style={styles.itemLinha}>{formatarUltimoLogin(item.ultimo_login)}</Text>
              <View style={styles.selos}>
                {(item.perfil !== "servo" || item.perfis_pasta.length === 0) && (
                  <View style={styles.selo}>
                    <Text style={styles.seloText}>{PERFIL_LABEL[item.perfil] ?? item.perfil}</Text>
                  </View>
                )}
                {item.perfis_pasta.map((p) => (
                  <View key={p} style={styles.selo}>
                    <Text style={styles.seloText}>{PERFIL_LABEL[p] ?? p} · pasta</Text>
                  </View>
                ))}
                {!item.ativo && (
                  <View style={[styles.selo, styles.seloPerigo]}>
                    <Text style={[styles.seloText, styles.seloPerigoText]}>Login desativado</Text>
                  </View>
                )}
                {item.servo_ativo === false && (
                  <View style={[styles.selo, styles.seloPerigo]}>
                    <Text style={[styles.seloText, styles.seloPerigoText]}>Servo inativo</Text>
                  </View>
                )}
                {item.trocar_senha && item.ativo && (
                  <View style={[styles.selo, styles.seloAlerta]}>
                    <Text style={[styles.seloText, styles.seloAlertaText]}>Senha temporária</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <FormUsuario
        visivel={formAberto}
        usuario={editando}
        souEu={editando?.id === usuario?.id}
        servos={servos}
        servosComLogin={new Set(usuarios.filter((u) => u.id_servo).map((u) => u.id_servo as number))}
        onFechar={() => setFormAberto(false)}
        onSalvo={aoSalvar}
      />

      <SenhaGeradaModal senha={senhaGerada} onFechar={() => setSenhaGerada(null)} />
    </SafeAreaView>
  );
}

// ── Formulário (novo / editar) ────────────────────────────────────────────────

function FormUsuario({
  visivel, usuario, souEu, servos, servosComLogin, onFechar, onSalvo,
}: {
  visivel: boolean;
  usuario: UsuarioAdmin | null;
  souEu: boolean;
  servos: ServoOpcao[];
  servosComLogin: Set<number>;
  onFechar: () => void;
  onSalvo: (r: { usuario: UsuarioAdmin; senha?: SenhaTemporaria }) => void;
}) {
  const [form, setForm] = useState<UsuarioForm>(FORM_VAZIO);
  const [buscaServo, setBuscaServo] = useState("");
  const [escolhendoServo, setEscolhendoServo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!visivel) return;
    setForm(usuario
      ? { nome: usuario.nome, email: usuario.email, perfil: usuario.perfil, id_servo: usuario.id_servo, ativo: usuario.ativo }
      : FORM_VAZIO);
    setBuscaServo("");
    setEscolhendoServo(false);
  }, [visivel, usuario]);

  const servoEscolhido = servos.find((s) => s.id === form.id_servo);

  const servosDisponiveis = useMemo(() => {
    const termo = semAcento(buscaServo.trim());
    return servos
      .filter((s) => !servosComLogin.has(s.id) || s.id === usuario?.id_servo)
      .filter((s) => !termo || semAcento(s.nome).includes(termo))
      .slice(0, 30);
  }, [servos, servosComLogin, buscaServo, usuario]);

  const escolherServo = (s: ServoOpcao | null) => {
    setForm((f) => ({ ...f, id_servo: s?.id ?? null, nome: f.nome || s?.nome || "" }));
    setEscolhendoServo(false);
  };

  const salvar = async () => {
    if (!form.nome.trim()) return Alert.alert("Atenção", "Informe o nome.");
    if (!form.email.trim()) return Alert.alert("Atenção", "Informe o email.");

    setSalvando(true);
    try {
      const dados = { ...form, email: form.email.trim().toLowerCase() };
      if (usuario) {
        onSalvo({ usuario: await editarUsuario(usuario.id, dados) });
      } else {
        const criado = await criarUsuario(dados);
        onSalvo({ usuario: criado.usuario, senha: criado });
      }
    } catch (err: any) {
      Alert.alert("Não foi possível salvar", err?.message || "Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  const confirmarReset = () => {
    if (!usuario) return;
    Alert.alert(
      "Resetar senha?",
      `${usuario.nome} vai receber uma senha temporária e precisará criar uma nova ao entrar.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Resetar",
          style: "destructive",
          onPress: async () => {
            try {
              const r = await resetarSenha(usuario.id);
              onSalvo({ usuario: r.usuario, senha: r });
            } catch (err: any) {
              Alert.alert("Não foi possível resetar", err?.message || "Tente novamente.");
            }
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visivel} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.titulo}>{usuario ? "Editar usuário" : "Novo usuário"}</Text>

            <Text style={authStyles.label}>Servo vinculado</Text>
            {escolhendoServo ? (
              <View>
                <TextInput
                  style={authStyles.input}
                  value={buscaServo}
                  onChangeText={setBuscaServo}
                  placeholder="Buscar servo"
                  placeholderTextColor="#9CA3AF"
                  autoFocus
                />
                <TouchableOpacity style={styles.servoItem} onPress={() => escolherServo(null)}>
                  <Text style={styles.itemLinha}>Nenhum (conta sem cadastro de servo)</Text>
                </TouchableOpacity>
                {servosDisponiveis.map((s) => (
                  <TouchableOpacity key={s.id} style={styles.servoItem} onPress={() => escolherServo(s)}>
                    <Text style={styles.servoEscolhidoText}>
                      {s.nome}{s.status && s.status !== "Ativo" ? ` (${s.status})` : ""}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <TouchableOpacity style={styles.servoEscolhido} onPress={() => setEscolhendoServo(true)}>
                <Text style={styles.servoEscolhidoText}>
                  {servoEscolhido ? servoEscolhido.nome : "Nenhum — toque para escolher"}
                </Text>
              </TouchableOpacity>
            )}

            <Text style={authStyles.label}>Nome</Text>
            <TextInput style={authStyles.input} value={form.nome}
                       onChangeText={(nome) => setForm((f) => ({ ...f, nome }))} />

            <Text style={authStyles.label}>Email</Text>
            <TextInput style={authStyles.input} value={form.email}
                       onChangeText={(email) => setForm((f) => ({ ...f, email }))}
                       autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />

            {usuario && usuario.perfis_pasta.length > 0 && (
              <>
                <Text style={authStyles.label}>Acesso pelas pastas do ano</Text>
                <Text style={styles.servoEscolhidoText}>
                  {usuario.perfis_pasta.map((p) => PERFIL_LABEL[p] ?? p).join(", ")}
                </Text>
              </>
            )}

            <Text style={authStyles.label}>Perfil manual</Text>
            <Text style={[styles.itemLinha, { marginBottom: 8 }]}>
              Quem tem pasta de coordenação já recebe o acesso dela. Use um perfil aqui
              só para quem precisa de acesso sem ter a pasta (ex.: administrador).
            </Text>
            <View style={styles.opcoes}>
              {PERFIS.map((p) => {
                const ativo = form.perfil === p;
                const bloqueado = souEu && p !== "administrador";
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.opcao, ativo && styles.opcaoAtiva, bloqueado && authStyles.btnDisabled]}
                    onPress={() => !bloqueado && setForm((f) => ({ ...f, perfil: p }))}
                    disabled={bloqueado}
                  >
                    <Text style={[styles.opcaoText, ativo && styles.opcaoAtivaText]}>{PERFIL_LABEL[p]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {usuario && (
              <View style={styles.linhaSwitch}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.servoEscolhidoText}>Login ativo</Text>
                  <Text style={styles.itemLinha}>
                    {souEu ? "Você não pode desativar a própria conta." : "Desativado, não consegue entrar no app."}
                  </Text>
                </View>
                <Switch
                  value={!!form.ativo}
                  onValueChange={(ativo) => setForm((f) => ({ ...f, ativo }))}
                  disabled={souEu}
                />
              </View>
            )}

            <TouchableOpacity
              style={[authStyles.btnPrimary, salvando && authStyles.btnDisabled]}
              onPress={salvar}
              disabled={salvando}
            >
              {salvando ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={authStyles.btnPrimaryText}>{usuario ? "Salvar" : "Criar e gerar senha"}</Text>
              )}
            </TouchableOpacity>

            {usuario && (
              <TouchableOpacity style={authStyles.btnDanger} onPress={confirmarReset}>
                <Text style={authStyles.btnDangerText}>Resetar senha</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={authStyles.btnSecondary} onPress={onFechar}>
              <Text style={authStyles.btnSecondaryText}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Senha temporária gerada ───────────────────────────────────────────────────

function SenhaGeradaModal({ senha, onFechar }: { senha: SenhaTemporaria | null; onFechar: () => void }) {
  if (!senha) return null;
  const { usuario, senha_temporaria } = senha;

  const enviar = () => {
    Share.share({
      message:
        `Olá, ${usuario.nome.split(" ")[0]}! Seu acesso ao Agapello:\n\n` +
        `Email: ${usuario.email}\nSenha temporária: ${senha_temporaria}\n\n` +
        `No primeiro acesso o app vai pedir para você criar a sua própria senha.`,
    }).catch(() => {});
  };

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onFechar}>
      <SafeAreaView style={[styles.safeArea, { justifyContent: "center", padding: 24 }]}>
        <Text style={authStyles.title}>Senha temporária</Text>
        <Text style={authStyles.subtitle}>
          Envie para {usuario.nome}. Ela só aparece agora: se perder, é só resetar de novo.
        </Text>
        <View style={styles.senhaCaixa}>
          <Text style={styles.itemLinha}>{usuario.email}</Text>
          <Text style={styles.senha} selectable>{senha_temporaria}</Text>
        </View>
        <TouchableOpacity style={authStyles.btnPrimary} onPress={enviar}>
          <Text style={authStyles.btnPrimaryText}>Enviar (WhatsApp, etc.)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={authStyles.btnSecondary} onPress={onFechar}>
          <Text style={authStyles.btnSecondaryText}>Concluir</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}
