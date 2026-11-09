import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Cores } from "@/constants/theme";
import { STATUS_CORES } from "@/constants/frequencia";
import NomeComApelido, { nomeExibido, textoDeBusca } from "@/components/NomeComApelido";
import { temPerfil } from "../../services/auth/auth";
import { useAuth } from "../../context/AuthContext";
import { getSubidaApostolado, marcarSubidaApostolado, SubidaApostolado } from "../../services/servos/servos";
import { styles as base } from "../pastas/ImportarPastas.styles";
import { VERMELHO_APOSTOLADO } from "./Apostolado";

// Quem sobe do discipulado para o apostolado. Marcado em dezembro, vale em
// 1º de janeiro (como as pastas): sai da chamada, da frequência e do quadrante
// e passa a ver só a área do apostolado. Quem não tem os 3 anos completos
// (1 de cursista + 2 de servo) pode ser marcado, mas o app avisa.

function normalizar(texto: string) {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export default function SubirApostoladoScreen() {
  const { usuario } = useAuth();
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual + 1);
  const [dados, setDados] = useState<SubidaApostolado | null>(null);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [busca, setBusca] = useState("");
  const [gravando, setGravando] = useState(false);

  const voltar = () => (router.canGoBack() ? router.back() : router.replace("/conta"));

  const carregar = useCallback(async (anoEscolhido: number) => {
    setDados(null);
    try {
      const d = await getSubidaApostolado(anoEscolhido);
      setDados(d);
      setMarcados(new Set(d.servos.filter((s) => s.marcado).map((s) => s.id)));
    } catch (err: any) {
      Alert.alert("Não foi possível carregar", err?.message || "Tente novamente.");
    }
  }, []);

  useEffect(() => { carregar(ano); }, [carregar, ano]);

  const alternar = (id: number) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    const servos = dados?.servos ?? [];
    // Marcados primeiro, depois quem pode ser convidado
    return servos
      .filter((s) => !termo || normalizar(textoDeBusca(s)).includes(termo))
      .sort((a, b) => Number(marcados.has(b.id)) - Number(marcados.has(a.id)) || Number(b.elegivel) - Number(a.elegivel));
  }, [dados, busca, marcados]);

  const escolhidos = (dados?.servos ?? []).filter((s) => marcados.has(s.id));

  const gravar = () => {
    const semTempo = escolhidos.filter((s) => !s.elegivel);
    const quando = ano > anoAtual ? `em 1º de janeiro de ${ano}` : "agora";
    const nomes = escolhidos.map((s) => `• ${nomeExibido(s)}${s.elegivel ? "" : " (sem os 3 anos)"}`).join("\n");
    const aviso = semTempo.length
      ? `\n\nAtenção: ${semTempo.length} ainda não tem os 3 anos completos (1 de cursista + 2 de servo).`
      : "";
    Alert.alert(
      escolhidos.length ? `Subir ${escolhidos.length} para o apostolado?` : `Ninguém sobe em ${ano}?`,
      escolhidos.length
        ? `${nomes}${aviso}\n\nSaem da chamada, da frequência e do quadrante do discipulado ${quando}.`
        : "A marcação deste ano será apagada.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Gravar",
          onPress: async () => {
            setGravando(true);
            try {
              const r = await marcarSubidaApostolado(ano, escolhidos.map((s) => s.id));
              Alert.alert("Gravado", r.message);
              await carregar(ano);
            } catch (err: any) {
              Alert.alert("Não foi possível gravar", err?.message || "Tente novamente.");
            } finally {
              setGravando(false);
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
        <Text style={base.titulo}>Subir para o apostolado</Text>
        <View style={base.voltar} />
      </View>

      {!temPerfil(usuario, ["administrador"]) ? (
        <Text style={[base.texto, styles.centro]}>Só o administrador marca quem sobe para o apostolado.</Text>
      ) : (
        <ScrollView contentContainerStyle={base.container} keyboardShouldPersistTaps="handled">
          <Text style={base.texto}>
            Marque quem sobe para o apostolado. Essas pessoas saem da chamada, da frequência e do quadrante do
            discipulado e passam a ver só a área do apostolado. Ficar sem pasta do discipulado não as inativa.
          </Text>

          <View style={base.anos}>
            {[anoAtual, anoAtual + 1].map((a) => (
              <TouchableOpacity key={a} style={[base.ano, ano === a && base.anoAtivo]}
                                onPress={() => setAno(a)} disabled={gravando}>
                <Text style={[base.anoText, ano === a && base.anoTextAtivo]}>{a}</Text>
                <Text style={base.anoSub}>{a === anoAtual ? "vale na hora" : "vale em janeiro"}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {dados === null ? (
            <ActivityIndicator size="large" color={Cores.primaria} style={{ marginTop: 24 }} />
          ) : (
            <>
              <TextInput
                style={styles.busca}
                placeholder="Buscar por nome ou apelido"
                placeholderTextColor={Cores.textoSuave}
                value={busca}
                onChangeText={setBusca}
              />

              {visiveis.map((s) => {
                const marcado = marcados.has(s.id);
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[base.pasta, styles.linha]}
                    onPress={() => alternar(s.id)}
                    disabled={gravando}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={marcado ? "checkbox" : "square-outline"}
                      size={24}
                      color={marcado ? VERMELHO_APOSTOLADO : Cores.iconeInativo}
                    />
                    <View style={styles.linhaTextos}>
                      <NomeComApelido nome={s.nome} apelido={s.apelido} style={base.pastaNome} />
                      <Text style={[base.pastaPlanilha, !s.elegivel && styles.aviso]}>
                        {s.ano_ingresso && s.ano_ingresso > 0 ? `Ingresso em ${s.ano_ingresso} · ` : "Sem ano de ingresso · "}
                        {s.elegivel ? "3 anos completos" : "ainda sem os 3 anos completos"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {dados.no_apostolado.length > 0 && (
                <View style={[base.caixa, styles.jaNoApostolado]}>
                  <Text style={[base.caixaTitulo, styles.jaTexto]}>Já no apostolado ({dados.no_apostolado.length})</Text>
                  <Text style={styles.jaTexto}>{dados.no_apostolado.join(", ")}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[base.botao, styles.botaoGravar, gravando && base.botaoDesativado]}
                onPress={gravar}
                disabled={gravando}
              >
                {gravando ? (
                  <ActivityIndicator color={Cores.textoSobrePrimaria} />
                ) : (
                  <Text style={base.botaoText}>
                    {escolhidos.length ? `Gravar: ${escolhidos.length} sobe${escolhidos.length > 1 ? "m" : ""} em ${ano}` : `Ninguém sobe em ${ano}`}
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
  busca: {
    backgroundColor: Cores.card,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Cores.texto,
    marginBottom: 12,
  },
  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  linhaTextos: {
    flex: 1,
  },
  aviso: {
    color: STATUS_CORES.Justificada.texto,
  },
  jaNoApostolado: {
    backgroundColor: "#FCEBEB",
  },
  jaTexto: {
    color: VERMELHO_APOSTOLADO,
    fontSize: 13,
  },
  botaoGravar: {
    backgroundColor: VERMELHO_APOSTOLADO,
    marginTop: 8,
  },
});
