import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Cores } from "@/constants/theme";
import { STATUS_CORES } from "@/constants/frequencia";
import { useAuth } from "../../context/AuthContext";
import { excluirServos, getRevisaoInativos, InativoParaRevisao } from "../../services/servos/servos";
import { styles as base } from "../pastas/ImportarPastas.styles";
import { dataBr } from "./DadosServoModal";

// Revisão anual: quem está inativo há mais de 2 anos vem marcado para sair.
// Desmarca quem tem exceção (vai voltar); essa pessoa aparece de novo na
// revisão do ano seguinte. Excluir mantém nome e histórico, apaga o resto.

function anosFora(data_saida: string) {
  const saida = new Date(`${data_saida}T00:00:00`);
  const hoje = new Date();
  let anos = hoje.getFullYear() - saida.getFullYear();
  if (hoje < new Date(hoje.getFullYear(), saida.getMonth(), saida.getDate())) anos -= 1;
  return anos;
}

export default function RevisaoInativosScreen() {
  const { isAdmin } = useAuth();
  const [lista, setLista] = useState<InativoParaRevisao[] | null>(null);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [excluindo, setExcluindo] = useState(false);

  const voltar = () => (router.canGoBack() ? router.back() : router.replace("/conta"));

  const carregar = useCallback(async () => {
    try {
      const dados = await getRevisaoInativos();
      setLista(dados);
      setMarcados(new Set(dados.map((i) => i.id)));
    } catch (err: any) {
      Alert.alert("Não foi possível carregar", err?.message || "Tente novamente.");
      setLista([]);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const alternar = (id: number) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const escolhidos = useMemo(() => (lista ?? []).filter((i) => marcados.has(i.id)), [lista, marcados]);

  const confirmar = () => {
    const total = escolhidos.length;
    if (!total) return;
    const nomes = escolhidos.map((i) => `• ${i.nome}`).join("\n");
    Alert.alert(
      `Excluir ${total} ${total > 1 ? "pessoas" : "pessoa"}?`,
      `${nomes}\n\nSaem do app de vez e perdem telefone, email, endereço, nascimento e login. ` +
        "O nome continua nas chamadas e pastas antigas. Não dá para desfazer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            setExcluindo(true);
            try {
              const r = await excluirServos(escolhidos.map((i) => i.id));
              Alert.alert("Revisão concluída", r.message);
              await carregar();
            } catch (err: any) {
              Alert.alert("Não foi possível excluir", err?.message || "Tente novamente.");
            } finally {
              setExcluindo(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={base.safeArea}>
      <View style={base.topo}>
        <TouchableOpacity style={base.voltar} onPress={voltar} hitSlop={12} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={26} color={Cores.marinho} />
        </TouchableOpacity>
        <Text style={base.titulo}>Revisão de inativos</Text>
        <View style={base.voltar} />
      </View>

      {!isAdmin ? (
        <Text style={[base.texto, styles.centro]}>Só o administrador e a coordenação geral fazem a revisão.</Text>
      ) : lista === null ? (
        <ActivityIndicator size="large" color={Cores.primaria} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={base.container}>
          <Text style={base.texto}>
            Quem está inativo há mais de 2 anos já vem marcado para sair. Desmarque quem tem exceção
            (vai voltar): essa pessoa continua inativa e aparece de novo na revisão do ano que vem.
          </Text>

          {lista.length === 0 ? (
            <View style={styles.vazio}>
              <Ionicons name="checkmark-circle-outline" size={40} color={Cores.iconeInativo} />
              <Text style={styles.vazioTexto}>Ninguém está inativo há mais de 2 anos.</Text>
            </View>
          ) : (
            <>
              {lista.map((i) => {
                const marcado = marcados.has(i.id);
                const anos = anosFora(i.data_saida);
                return (
                  <TouchableOpacity
                    key={i.id}
                    style={[base.pasta, styles.linha, !marcado && styles.linhaExcecao]}
                    onPress={() => alternar(i.id)}
                    disabled={excluindo}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={marcado ? "checkbox" : "square-outline"}
                      size={24}
                      color={marcado ? STATUS_CORES.Falta.forte : Cores.iconeInativo}
                    />
                    <View style={styles.linhaTextos}>
                      <Text style={base.pastaNome}>{i.nome}</Text>
                      <Text style={base.pastaPlanilha}>
                        Saiu em {dataBr(i.data_saida)} · há {anos} anos{i.tem_login ? " · tem login" : ""}
                      </Text>
                      {!marcado && <Text style={[base.pastaPlanilha, styles.excecao]}>Exceção: continua inativo</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[base.botao, styles.botaoExcluir, (!escolhidos.length || excluindo) && base.botaoDesativado]}
                onPress={confirmar}
                disabled={!escolhidos.length || excluindo}
              >
                {excluindo ? (
                  <ActivityIndicator color={Cores.textoSobrePrimaria} />
                ) : (
                  <Text style={base.botaoText}>
                    {escolhidos.length
                      ? `Excluir ${escolhidos.length} ${escolhidos.length > 1 ? "pessoas" : "pessoa"}`
                      : "Ninguém marcado"}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centro: {
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 24,
  },
  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  linhaExcecao: {
    opacity: 0.7,
  },
  linhaTextos: {
    flex: 1,
  },
  excecao: {
    color: Cores.primaria,
    fontWeight: "600",
  },
  vazio: {
    alignItems: "center",
    marginTop: 32,
    gap: 10,
  },
  vazioTexto: {
    fontSize: 15,
    color: Cores.textoSuave,
  },
  botaoExcluir: {
    backgroundColor: STATUS_CORES.Falta.forte,
    marginTop: 8,
  },
});
