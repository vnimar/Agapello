import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../../context/AuthContext";

// Área do apostolado (vermelha). Quem subiu para o apostolado não vê nada do
// discipulado; a área completa (calendário, chamada, pastas) vem em 2027,
// quando as regras estiverem definidas.

export const VERMELHO_APOSTOLADO = "#B3261E";

export default function ApostoladoScreen() {
  const { usuario, sair } = useAuth();
  const nome = usuario?.apelido || usuario?.nome?.split(" ")[0] || "";

  const confirmarSair = () =>
    Alert.alert("Sair da conta?", "", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: async () => { await sair(); router.replace("/login"); } },
    ]);

  return (
    <SafeAreaView style={styles.tela}>
      <View style={styles.conteudo}>
        <Text style={styles.marca}>Agapello</Text>
        <Text style={styles.area}>Apostolado</Text>

        <View style={styles.card}>
          <Ionicons name="construct-outline" size={40} color={VERMELHO_APOSTOLADO} />
          <Text style={styles.ola}>Olá{nome ? `, ${nome}` : ""}!</Text>
          <Text style={styles.texto}>
            A área do apostolado está sendo preparada. Em breve você vai ver aqui o calendário, as missões e
            a frequência do apostolado.
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.sair} onPress={confirmarSair}>
        <Text style={styles.sairTexto}>Sair da conta</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: VERMELHO_APOSTOLADO,
    padding: 24,
  },
  conteudo: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  marca: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  area: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFE3E0",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  ola: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2B0B09",
  },
  texto: {
    fontSize: 15,
    lineHeight: 22,
    color: "#5C2B27",
    textAlign: "center",
  },
  sair: {
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  sairTexto: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
