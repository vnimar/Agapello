import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Cores } from "@/constants/theme";
import { useAuth } from "../../context/AuthContext";
import { temPerfil } from "../../services/auth/auth";
import { listarAuditoria, RegistroAuditoria } from "../../services/auditoria/auditoria";
import { styles as base } from "../pastas/ImportarPastas.styles";

// Histórico de alterações (só administrador): quem mudou o quê e quando.
// Guarda 1 ano; dados pessoais aparecem como ***.

type Regra = [string, RegExp, (m: RegExpMatchArray) => string];

// Método + rota → frase. O que não estiver aqui aparece como a rota mesmo.
const DESCRICOES: Regra[] = [
  ["PUT", /^\/servos\/(\d+)\/dados/, (m) => `Editou os dados de contato do servo #${m[1]}`],
  ["PUT", /^\/servos\/(\d+)\/status/, (m) => `Inativou ou reativou o servo #${m[1]}`],
  ["POST", /^\/servos\/excluir/, () => "Excluiu servos na revisão de inativos"],
  ["POST", /^\/frequencia\/register/, () => "Lançou frequência de servo"],
  ["PUT", /^\/frequencia\/update/, () => "Corrigiu frequência de servo"],
  ["PUT", /^\/cursistas\/chamada\/(\d+)/, (m) => `Salvou a chamada de cursistas (missão #${m[1]})`],
  ["POST", /^\/cursistas\/importar/, () => "Importou a planilha de cursistas"],
  ["POST", /^\/cursistas\/excluir/, () => "Removeu cursistas"],
  ["POST", /^\/pastas\/importar/, () => "Importou as pastas"],
  ["POST", /^\/missao\/importar/, () => "Importou o calendário"],
  ["PUT", /^\/missao\/conta-frequencia/, () => "Mudou o que conta na frequência"],
  ["POST", /^\/missao\/?$/, () => "Criou uma missão"],
  ["PUT", /^\/missao\/(\d+)/, (m) => `Editou a missão #${m[1]}`],
  ["DELETE", /^\/missao\/(\d+)/, (m) => `Apagou a missão #${m[1]}`],
  ["POST", /^\/usuarios\/(\d+)\/resetar-senha/, (m) => `Resetou a senha do usuário #${m[1]}`],
  ["POST", /^\/usuarios\/?$/, () => "Criou um usuário"],
  ["PUT", /^\/usuarios\/(\d+)/, (m) => `Editou o usuário #${m[1]}`],
  ["PUT", /^\/auth\/senha/, () => "Trocou a própria senha"],
];

function descrever(r: RegistroAuditoria) {
  for (const [metodo, padrao, frase] of DESCRICOES) {
    const achado = r.metodo === metodo ? r.rota.match(padrao) : null;
    if (achado) return frase(achado);
  }
  return `${r.metodo} ${r.rota}`;
}

function quando(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function HistoricoScreen() {
  const { usuario } = useAuth();
  const [registros, setRegistros] = useState<RegistroAuditoria[] | null>(null);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<number | null>(null);
  const [temMais, setTemMais] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);

  const voltar = () => (router.canGoBack() ? router.back() : router.replace("/conta"));

  const carregar = useCallback(async (termo: string) => {
    try {
      const lista = await listarAuditoria(termo);
      setRegistros(lista);
      setTemMais(lista.length === 50);
    } catch (err: any) {
      Alert.alert("Não foi possível carregar", err?.message || "Tente novamente.");
      setRegistros([]);
    }
  }, []);

  useEffect(() => { carregar(""); }, [carregar]);

  const carregarMais = async () => {
    if (!registros?.length || carregandoMais || !temMais) return;
    setCarregandoMais(true);
    try {
      const mais = await listarAuditoria(busca, registros[registros.length - 1].id_auditoria);
      setRegistros([...registros, ...mais]);
      setTemMais(mais.length === 50);
    } catch (err: any) {
      Alert.alert("Não foi possível carregar", err?.message || "Tente novamente.");
    } finally {
      setCarregandoMais(false);
    }
  };

  if (!temPerfil(usuario, ["administrador"])) {
    return (
      <SafeAreaView style={base.safeArea}>
        <Text style={[base.texto, local.centro]}>Só o administrador vê o histórico.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={base.safeArea} edges={["top"]}>
      <View style={base.topo}>
        <TouchableOpacity style={base.voltar} onPress={voltar} hitSlop={12} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={26} color={Cores.marinho} />
        </TouchableOpacity>
        <Text style={base.titulo}>Histórico</Text>
        <View style={base.voltar} />
      </View>

      <View style={local.busca}>
        <Ionicons name="search" size={18} color={Cores.iconeInativo} />
        <TextInput
          style={local.buscaInput}
          value={busca}
          onChangeText={setBusca}
          onSubmitEditing={() => { setRegistros(null); carregar(busca); }}
          returnKeyType="search"
          placeholder="Buscar por pessoa ou rota"
          placeholderTextColor={Cores.iconeInativo}
        />
      </View>

      {registros === null ? (
        <ActivityIndicator size="large" color={Cores.primaria} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={registros}
          keyExtractor={(r) => String(r.id_auditoria)}
          contentContainerStyle={base.container}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => carregar(busca)} />}
          onEndReached={carregarMais}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<Text style={[base.texto, local.centro]}>Nenhuma alteração registrada.</Text>}
          ListFooterComponent={carregandoMais ? <ActivityIndicator color={Cores.primaria} /> : null}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={base.pasta}
              onPress={() => setAberto((a) => (a === item.id_auditoria ? null : item.id_auditoria))}
              activeOpacity={0.7}
            >
              <Text style={base.pastaNome}>{descrever(item)}</Text>
              <Text style={base.pastaPlanilha}>
                {quando(item.criado_em)} · {item.usuario ?? "sem login"}
              </Text>
              {aberto === item.id_auditoria && (
                <Text style={local.corpo} selectable>
                  {item.metodo} {item.rota} → {item.status}
                  {item.corpo && item.corpo !== "-" ? `\n${item.corpo}` : ""}
                </Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const local = StyleSheet.create({
  centro: {
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 24,
  },
  busca: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Cores.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Cores.borda,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  buscaInput: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 10,
    fontSize: 15,
    color: Cores.texto,
  },
  corpo: {
    marginTop: 8,
    fontSize: 12,
    color: Cores.textoSuave,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
});
