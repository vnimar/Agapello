import React, { useEffect, useRef, useState } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Cores } from "@/constants/theme";
import { useAuth } from "../../context/AuthContext";
import { pedirCodigoRecuperacao } from "../../services/auth/auth";
import { authStyles as styles } from "./Login.styles";

// Esqueci minha senha, em duas etapas:
// 1. email → o backend manda um código de 6 números para ele
// 2. código + senha nova → troca a senha e já entra no app

const ESPERA_REENVIO = 60; // segundos até poder pedir outro código

export default function RecuperarSenhaScreen() {
  const { redefinirSenha } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [etapa, setEtapa] = useState<"email" | "codigo">("email");
  const [email, setEmail] = useState(params.email ?? "");
  const [codigo, setCodigo] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera] = useState(0);
  const enviandoRef = useRef(false);
  const senhaRef = useRef<TextInput>(null);
  const confirmaRef = useRef<TextInput>(null);

  // Contagem para liberar o "Reenviar código"
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  // Evita dois envios com o "ir" do teclado + o toque no botão
  const executar = async (acao: () => Promise<void>) => {
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    try {
      await acao();
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  const pedirCodigo = () =>
    executar(async () => {
      const limpo = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)) {
        Alert.alert("Atenção", "Informe o email da sua conta.");
        return;
      }
      try {
        await pedirCodigoRecuperacao(limpo);
        setEmail(limpo);
        setCodigo("");
        setEtapa("codigo");
        setEspera(ESPERA_REENVIO);
      } catch (err: any) {
        Alert.alert("Não foi possível enviar o código", err?.message || "Tente novamente.");
      }
    });

  const confirmar = () =>
    executar(async () => {
      if (!/^\d{6}$/.test(codigo)) {
        Alert.alert("Atenção", "Digite o código de 6 números que chegou no seu email.");
        return;
      }
      if (senha.length < 8) {
        Alert.alert("Atenção", "A nova senha precisa ter pelo menos 8 caracteres.");
        return;
      }
      if (senha !== confirma) {
        Alert.alert("Atenção", "As senhas não conferem.");
        return;
      }
      try {
        await redefinirSenha(email, codigo, senha);
      } catch (err: any) {
        Alert.alert("Não foi possível trocar a senha", err?.message || "Tente novamente.");
        return;
      }
      Alert.alert("Pronto!", "Sua senha foi trocada e você já está dentro do app.");
      // Fecha esta tela e a de login
      if (router.canDismiss()) router.dismissAll();
      router.replace("/");
    });

  return (
    <SafeAreaView style={styles.safeArea}>
      <TouchableOpacity style={styles.fechar} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="close" size={26} color={Cores.textoSuave} />
      </TouchableOpacity>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Esqueci minha senha</Text>

          {etapa === "email" ? (
            <>
              <Text style={styles.subtitle}>
                Informe o email da sua conta. Vamos enviar um código para você criar uma nova senha.
              </Text>

              <Text style={styles.label}>Email</Text>
              <View style={styles.campo}>
                <Ionicons name="mail-outline" size={20} color={Cores.iconeInativo} style={styles.campoIcone} />
                <TextInput
                  style={styles.campoInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="seuemail@exemplo.com"
                  placeholderTextColor={Cores.iconeInativo}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="username"
                  returnKeyType="send"
                  onSubmitEditing={pedirCodigo}
                />
              </View>

              <TouchableOpacity
                style={[styles.btnPrimary, enviando && styles.btnDisabled]}
                onPress={pedirCodigo}
                disabled={enviando}
              >
                {enviando ? (
                  <ActivityIndicator color={Cores.textoSobrePrimaria} size="small" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Enviar código</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.subtitle}>
                Se <Text style={{ fontWeight: "700" }}>{email}</Text> tiver conta, enviamos um código de 6
                números para ele. Ele vale por 15 minutos. Não achou? Olhe também no spam.
              </Text>

              <Text style={styles.label}>Código</Text>
              <View style={styles.campo}>
                <Ionicons name="keypad-outline" size={20} color={Cores.iconeInativo} style={styles.campoIcone} />
                <TextInput
                  style={[styles.campoInput, { letterSpacing: 6, fontWeight: "700" }]}
                  value={codigo}
                  onChangeText={(t) => setCodigo(t.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  placeholderTextColor={Cores.iconeInativo}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  returnKeyType="next"
                  onSubmitEditing={() => senhaRef.current?.focus()}
                />
              </View>

              <Text style={styles.label}>Nova senha</Text>
              <View style={styles.campo}>
                <Ionicons name="lock-closed-outline" size={20} color={Cores.iconeInativo} style={styles.campoIcone} />
                <TextInput
                  ref={senhaRef}
                  style={styles.campoInput}
                  value={senha}
                  onChangeText={setSenha}
                  placeholder="Pelo menos 8 caracteres"
                  placeholderTextColor={Cores.iconeInativo}
                  secureTextEntry={!mostrarSenha}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="next"
                  onSubmitEditing={() => confirmaRef.current?.focus()}
                />
                <TouchableOpacity
                  style={styles.campoAcao}
                  onPress={() => setMostrarSenha((v) => !v)}
                  hitSlop={8}
                  accessibilityLabel={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                >
                  <Ionicons name={mostrarSenha ? "eye-off-outline" : "eye-outline"} size={20} color={Cores.primaria} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Repita a nova senha</Text>
              <View style={styles.campo}>
                <Ionicons name="lock-closed-outline" size={20} color={Cores.iconeInativo} style={styles.campoIcone} />
                <TextInput
                  ref={confirmaRef}
                  style={styles.campoInput}
                  value={confirma}
                  onChangeText={setConfirma}
                  placeholder="A mesma senha"
                  placeholderTextColor={Cores.iconeInativo}
                  secureTextEntry={!mostrarSenha}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={confirmar}
                />
              </View>

              <TouchableOpacity
                style={[styles.btnPrimary, enviando && styles.btnDisabled]}
                onPress={confirmar}
                disabled={enviando}
              >
                {enviando ? (
                  <ActivityIndicator color={Cores.textoSobrePrimaria} size="small" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Trocar senha e entrar</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={pedirCodigo} disabled={espera > 0 || enviando} hitSlop={8}>
                <Text style={[styles.link, espera > 0 && { color: Cores.textoSuave }]}>
                  {espera > 0 ? `Reenviar código em ${espera}s` : "Reenviar código"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setEtapa("email")} hitSlop={8}>
                <Text style={styles.dica}>Usar outro email</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
