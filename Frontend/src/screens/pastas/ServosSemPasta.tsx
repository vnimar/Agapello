import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Cores } from "@/constants/theme";
import NomeComApelido, { nomeExibido } from "@/components/NomeComApelido";
import { PERFIS_ADMIN, temPerfil } from "../../services/auth/auth";
import { useAuth } from "../../context/AuthContext";
import { getServosSemPasta, marcarExcecoesSemPasta, ServosSemPasta } from "../../services/pastas/pastas";
import { styles as base } from "./ImportarPastas.styles";

// Exceção da virada: servo ativo sem pasta no Pós-Encontro do ano fica inativo
// em 1º de janeiro, a não ser que o administrador ou a coordenação geral marque
// que ele continua ativo, com o motivo. Vale só para aquele ano: se no ano
// seguinte ficar sem pasta de novo, volta a aparecer aqui.

export default function ServosSemPastaScreen() {
  const { usuario } = useAuth();
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual + 1);
  const [dados, setDados] = useState<ServosSemPasta | null>(null);
  const [motivos, setMotivos] = useState<Map<number, string>>(new Map()); // marcados → motivo
  const [gravando, setGravando] = useState(false);

  const voltar = () => (router.canGoBack() ? router.back() : router.replace("/conta"));

  const carregar = useCallback(async (anoEscolhido: number) => {
    setDados(null);
    try {
      const d = await getServosSemPasta(anoEscolhido);
      setDados(d);
      setMotivos(new Map(d.servos.filter((s) => s.excecao).map((s) => [s.id, s.motivo ?? ""])));
    } catch (err: any) {
      Alert.alert("Não foi possível carregar", err?.message || "Tente novamente.");
    }
  }, []);

  useEffect(() => { carregar(ano); }, [carregar, ano]);

  const alternar = (id: number) =>
    setMotivos((atual) => {
      const novo = new Map(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.set(id, "");
      return novo;
    });

  const escrever = (id: number, texto: string) =>
    setMotivos((atual) => new Map(atual).set(id, texto));

  const servos = useMemo(() => dados?.servos ?? [], [dados]);
  const marcados = useMemo(() => servos.filter((s) => motivos.has(s.id)), [servos, motivos]);
  const semMotivo = marcados.filter((s) => !motivos.get(s.id)?.trim());
  const inativados = servos.length - marcados.length;

  const gravar = () => {
    if (semMotivo.length) {
      Alert.alert("Falta o motivo", `Escreva o motivo da exceção de:\n${semMotivo.map((s) => `• ${nomeExibido(s)}`).join("\n")}`);
      return;
    }
    const quando = ano > anoAtual ? `em 1º de janeiro de ${ano}` : "se a virada for refeita";
    const lista = marcados.map((s) => `• ${nomeExibido(s)}: ${motivos.get(s.id)!.trim()}`).join("\n");
    Alert.alert(
      marcados.length ? `Confirmar ${marcados.length} exceção(ões)?` : `Nenhuma exceção em ${ano}?`,
      (marcados.length ? `Continuam ativos mesmo sem pasta:\n${lista}\n\n` : "") +
        (inativados ? `${inativados} servo(s) sem pasta ficam inativos ${quando}.` : "Ninguém fica inativo por falta de pasta."),
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            setGravando(true);
            try {
              const r = await marcarExcecoesSemPasta(
                ano,
                marcados.map((s) => ({ id_servo: s.id, motivo: motivos.get(s.id)!.trim() }))
              );
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
        <Text style={base.titulo}>Servos sem pasta</Text>
        <View style={base.voltar} />
      </View>

      {!temPerfil(usuario, PERFIS_ADMIN) ? (
        <Text style={[base.texto, styles.centro]}>Só o administrador e a coordenação geral marcam as exceções.</Text>
      ) : (
        <ScrollView contentContainerStyle={base.container} keyboardShouldPersistTaps="handled">
          <Text style={base.texto}>
            Quem está sem pasta no Pós-Encontro fica inativo na virada do ano. Marque quem continua ativo mesmo
            assim e escreva o motivo. A exceção vale só para este ano.
          </Text>

          <View style={base.anos}>
            {(dados?.anos_permitidos ?? [anoAtual, anoAtual + 1]).map((a) => (
              <TouchableOpacity key={a} style={[base.ano, ano === a && base.anoAtivo]}
                                onPress={() => setAno(a)} disabled={gravando}>
                <Text style={[base.anoText, ano === a && base.anoTextAtivo]}>{a}</Text>
                <Text style={base.anoSub}>{a === anoAtual ? "ano atual" : "vale em janeiro"}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {dados === null ? (
            <ActivityIndicator size="large" color={Cores.primaria} style={{ marginTop: 24 }} />
          ) : !dados.pastas_importadas ? (
            <Text style={[base.texto, styles.centro]}>
              As pastas de {ano} ainda não foram importadas. Importe as pastas primeiro: a lista de quem ficou
              sem pasta sai delas.
            </Text>
          ) : servos.length === 0 ? (
            <Text style={[base.texto, styles.centro]}>Todos os servos ativos têm pasta no Pós-Encontro de {ano}.</Text>
          ) : (
            <>
              <Text style={base.resumo}>
                {servos.length} sem pasta · {marcados.length} continua(m) ativo(s) · {inativados} fica(m) inativo(s)
              </Text>

              {servos.map((s) => {
                const marcado = motivos.has(s.id);
                return (
                  <View key={s.id} style={base.pasta}>
                    <TouchableOpacity style={styles.linha} onPress={() => alternar(s.id)} disabled={gravando}
                                      activeOpacity={0.7}>
                      <Ionicons name={marcado ? "checkbox" : "square-outline"} size={24}
                                color={marcado ? Cores.primaria : Cores.iconeInativo} />
                      <View style={styles.linhaTextos}>
                        <NomeComApelido nome={s.nome} apelido={s.apelido} style={base.pastaNome} />
                        <Text style={base.pastaPlanilha}>
                          {marcado ? "Continua ativo (exceção)" : "Fica inativo na virada"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {marcado && (
                      <TextInput
                        style={[styles.motivo, !motivos.get(s.id)?.trim() && styles.motivoVazio]}
                        placeholder="Motivo da exceção (obrigatório)"
                        placeholderTextColor={Cores.textoSuave}
                        value={motivos.get(s.id)}
                        onChangeText={(t) => escrever(s.id, t)}
                        maxLength={300}
                        multiline
                        editable={!gravando}
                      />
                    )}
                  </View>
                );
              })}

              <TouchableOpacity style={[base.botao, base.botaoConfirmar, gravando && base.botaoDesativado]}
                                onPress={gravar} disabled={gravando}>
                {gravando ? (
                  <ActivityIndicator color={Cores.textoSobrePrimaria} />
                ) : (
                  <Text style={base.botaoText}>Gravar exceções de {ano}</Text>
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
    marginTop: 24,
    paddingHorizontal: 12,
  },
  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  linhaTextos: {
    flex: 1,
  },
  motivo: {
    marginTop: 10,
    backgroundColor: Cores.fundo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: Cores.texto,
    minHeight: 40,
  },
  motivoVazio: {
    borderColor: Cores.primaria,
  },
});
