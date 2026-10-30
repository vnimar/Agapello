import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Cores } from "@/constants/theme";
import { useAuth } from "../../context/AuthContext";
import { PERFIL_LABEL, PERFIS_ADMIN, temPerfil, trocarSenha } from "../../services/auth/auth";
import { authStyles as styles } from "../login/Login.styles";
import MeuResumo from "./MeuResumo";

type NomeIcone = React.ComponentProps<typeof Ionicons>["name"];

function iniciais(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join("");
}

function Acao({ icone, texto, onPress, ultima }: { icone: NomeIcone; texto: string; onPress: () => void; ultima?: boolean }) {
  return (
    <TouchableOpacity style={[styles.acao, ultima && styles.cardRowLast]} onPress={onPress}>
      <View style={styles.acaoIcone}>
        <Ionicons name={icone} size={18} color={Cores.primaria} />
      </View>
      <Text style={styles.acaoTexto}>{texto}</Text>
      <Ionicons name="chevron-forward" size={18} color={Cores.iconeInativo} />
    </TouchableOpacity>
  );
}

export default function ContaScreen() {
  const { usuario, sair, recarregarUsuario } = useAuth();
  const [trocando, setTrocando] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConfirma, setSenhaConfirma] = useState("");
  const [salvando, setSalvando] = useState(false);

  const fechar = () => (router.canGoBack() ? router.back() : router.replace("/"));

  if (!usuario) {
    // Sessão encerrada (ex.: token expirou) enquanto a tela estava aberta
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Você não está logado</Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => router.replace("/login")}>
            <Text style={styles.btnPrimaryText}>Entrar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={fechar}>
            <Text style={styles.btnSecondaryText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const confirmarSair = () => {
    Alert.alert("Sair da conta?", "Para entrar de novo será preciso informar a senha.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await sair();
          fechar();
        },
      },
    ]);
  };

  const salvarSenha = async () => {
    if (senhaNova.length < 8) return Alert.alert("Atenção", "A nova senha precisa ter pelo menos 8 caracteres.");
    if (senhaNova !== senhaConfirma) return Alert.alert("Atenção", "As senhas não conferem.");

    setSalvando(true);
    try {
      await trocarSenha(senhaAtual, senhaNova);
      await recarregarUsuario().catch(() => {});
      Alert.alert("Pronto", "Senha alterada.");
      setTrocando(false);
      setSenhaAtual("");
      setSenhaNova("");
      setSenhaConfirma("");
    } catch (err: any) {
      Alert.alert("Não foi possível trocar a senha", err?.message || "Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <TouchableOpacity style={styles.fechar} onPress={fechar} hitSlop={12}>
        <Ionicons name="close" size={26} color={Cores.textoSuave} />
      </TouchableOpacity>

      {/* padding também no Android: com edge-to-edge a tela não encolhe com o teclado */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{iniciais(usuario.nome)}</Text>
          </View>
          <Text style={styles.title}>{usuario.nome}</Text>
          <Text style={styles.subtitle}>{PERFIL_LABEL[usuario.perfil] ?? usuario.perfil}</Text>

          <MeuResumo />

          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.cardKey}>Email</Text>
              <Text style={styles.cardValue}>{usuario.email}</Text>
            </View>
            <View style={[styles.cardRow, styles.cardRowLast]}>
              <Text style={styles.cardKey}>Acesso</Text>
              <Text style={styles.cardValue}>
                {(usuario.perfis ?? [usuario.perfil])
                  .filter((p, _, todos) => p !== "servo" || todos.length === 1)
                  .map((p) => PERFIL_LABEL[p] ?? p)
                  .join("\n")}
              </Text>
            </View>
          </View>

          {trocando ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Trocar senha</Text>
              <Text style={styles.label}>Senha atual</Text>
              <TextInput style={styles.input} value={senhaAtual} onChangeText={setSenhaAtual}
                         secureTextEntry autoCapitalize="none" />
              <Text style={styles.label}>Nova senha (mín. 8 caracteres)</Text>
              <TextInput style={styles.input} value={senhaNova} onChangeText={setSenhaNova}
                         secureTextEntry autoCapitalize="none" />
              <Text style={styles.label}>Repita a nova senha</Text>
              <TextInput style={styles.input} value={senhaConfirma} onChangeText={setSenhaConfirma}
                         secureTextEntry autoCapitalize="none" onSubmitEditing={salvarSenha} />

              <TouchableOpacity
                style={[styles.btnPrimary, salvando && styles.btnDisabled]}
                onPress={salvarSenha}
                disabled={salvando}
              >
                {salvando ? (
                  <ActivityIndicator color={Cores.textoSobrePrimaria} size="small" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Salvar nova senha</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setTrocando(false)}>
                <Text style={styles.btnSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.card, { paddingVertical: 4 }]}>
              {temPerfil(usuario, ["administrador"]) && (
                <Acao icone="people-outline" texto="Gerenciar usuários" onPress={() => router.push("/usuarios")} />
              )}
              {temPerfil(usuario, PERFIS_ADMIN) && (
                <Acao icone="folder-open-outline" texto="Importar pastas" onPress={() => router.push("/importar-pastas")} />
              )}
              <Acao icone="key-outline" texto="Trocar senha" onPress={() => setTrocando(true)} ultima />
            </View>
          )}

          <TouchableOpacity style={styles.btnDanger} onPress={confirmarSair}>
            <Text style={styles.btnDangerText}>Sair da conta</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
