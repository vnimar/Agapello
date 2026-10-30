import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
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
import { authStyles as styles } from "./Login.styles";

export default function LoginScreen() {
  const { entrar, loginObrigatorio } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const senhaRef = useRef<TextInput>(null);

  const fechar = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const confirmar = async () => {
    if (!email.trim() || !senha) {
      Alert.alert("Atenção", "Informe o email e a senha.");
      return;
    }
    setEntrando(true);
    try {
      await entrar(email, senha);
      fechar();
    } catch (err: any) {
      Alert.alert("Não foi possível entrar", err?.message || "Tente novamente.");
    } finally {
      setEntrando(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Com login obrigatório não há para onde voltar sem entrar */}
      {!loginObrigatorio && (
        <TouchableOpacity style={styles.fechar} onPress={fechar} hitSlop={12}>
          <Ionicons name="close" size={26} color={Cores.textoSuave} />
        </TouchableOpacity>
      )}

      {/* Com edge-to-edge o Android não redimensiona a tela quando o teclado
          abre, então o padding precisa valer nas duas plataformas */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Image source={require("../../../assets/images/icon.png")} style={styles.logo} />
          <Text style={styles.title}>Entrar no Agapello</Text>
          <Text style={styles.subtitle}>Use o email e a senha da sua conta</Text>

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
              returnKeyType="next"
              onSubmitEditing={() => senhaRef.current?.focus()}
            />
          </View>

          <Text style={styles.label}>Senha</Text>
          <View style={styles.campo}>
            <Ionicons name="lock-closed-outline" size={20} color={Cores.iconeInativo} style={styles.campoIcone} />
            <TextInput
              ref={senhaRef}
              style={styles.campoInput}
              value={senha}
              onChangeText={setSenha}
              placeholder="Sua senha"
              placeholderTextColor={Cores.iconeInativo}
              secureTextEntry={!mostrarSenha}
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={confirmar}
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

          <TouchableOpacity
            style={[styles.btnPrimary, entrando && styles.btnDisabled]}
            onPress={confirmar}
            disabled={entrando}
          >
            {entrando ? (
              <ActivityIndicator color={Cores.textoSobrePrimaria} size="small" />
            ) : (
              <Text style={styles.btnPrimaryText}>Entrar</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.dica}>Esqueceu a senha? Fale com a coordenação.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
