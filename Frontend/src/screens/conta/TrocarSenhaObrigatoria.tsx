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
import { Redirect, router } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { trocarSenha } from "../../services/auth/auth";
import { authStyles as styles } from "../login/Login.styles";

// Quem entra com a senha temporária (conta nova ou senha resetada pelo
// administrador) precisa criar a própria senha antes de usar o app.

export default function TrocarSenhaObrigatoria() {
  const { usuario, sair, recarregarUsuario } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConfirma, setSenhaConfirma] = useState("");
  const [salvando, setSalvando] = useState(false);

  if (!usuario) return <Redirect href="/" />;

  const salvar = async () => {
    if (!senhaAtual) return Alert.alert("Atenção", "Informe a senha temporária que você recebeu.");
    if (senhaNova.length < 8) return Alert.alert("Atenção", "A nova senha precisa ter pelo menos 8 caracteres.");
    if (senhaNova !== senhaConfirma) return Alert.alert("Atenção", "As senhas não conferem.");

    setSalvando(true);
    try {
      await trocarSenha(senhaAtual, senhaNova);
      await recarregarUsuario();
      router.replace("/");
    } catch (err: any) {
      Alert.alert("Não foi possível trocar a senha", err?.message || "Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  const voltarParaLogin = async () => {
    await sair();
    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Crie sua senha</Text>
          <Text style={styles.subtitle}>
            Olá, {usuario.nome.split(" ")[0]}! Você entrou com uma senha temporária.{"\n"}
            Escolha uma senha só sua para continuar.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Senha temporária</Text>
            <TextInput style={styles.input} value={senhaAtual} onChangeText={setSenhaAtual}
                       secureTextEntry autoCapitalize="none" autoCorrect={false} />
            <Text style={styles.label}>Nova senha (mín. 8 caracteres)</Text>
            <TextInput style={styles.input} value={senhaNova} onChangeText={setSenhaNova}
                       secureTextEntry autoCapitalize="none" />
            <Text style={styles.label}>Repita a nova senha</Text>
            <TextInput style={styles.input} value={senhaConfirma} onChangeText={setSenhaConfirma}
                       secureTextEntry autoCapitalize="none" onSubmitEditing={salvar} />

            <TouchableOpacity
              style={[styles.btnPrimary, salvando && styles.btnDisabled]}
              onPress={salvar}
              disabled={salvando}
            >
              {salvando ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>Salvar e continuar</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.btnSecondary} onPress={voltarParaLogin}>
            <Text style={styles.btnSecondaryText}>Sair</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
