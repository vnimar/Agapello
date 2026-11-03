import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Cores } from "@/constants/theme";
import { STATUS_CORES } from "@/constants/frequencia";
import { useAuth } from "../../context/AuthContext";
import {
  CursistaItem,
  FaltosoEncontro,
  excluirCursistas,
  listarCursistas,
  listarFaltososEncontro,
} from "../../services/cursistas/cursistas";
import { styles as base } from "../pastas/ImportarPastas.styles";
import { dataBr } from "../servo/DadosServoModal";

// Cursistas do ano (admin e coord. geral): importar a planilha do encontro,
// cortar quem faltou ao encontro e remover quem desistiu ou entrou por engano.
// Tudo isso apaga o cursista por completo, com as presenças.

function semAcento(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default function GerenciarCursistasScreen() {
  const { isAdmin } = useAuth();
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [cursistas, setCursistas] = useState<CursistaItem[] | null>(null);
  const [faltosos, setFaltosos] = useState<FaltosoEncontro[]>([]);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [busca, setBusca] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  const voltar = () => (router.canGoBack() ? router.back() : router.replace("/conta"));

  const carregar = useCallback(async () => {
    try {
      const [lista, faltaram] = await Promise.all([listarCursistas(ano), listarFaltososEncontro(ano)]);
      setCursistas(lista);
      setFaltosos(faltaram);
      setMarcados(new Set(faltaram.map((f) => f.id_cursista)));
    } catch (err: any) {
      Alert.alert("Não foi possível carregar", err?.message || "Tente novamente.");
      setCursistas([]);
    }
  }, [ano]);

  // Recarrega ao voltar da importação
  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const porComunidade = useMemo(() => {
    const termo = semAcento(busca.trim());
    const grupos = new Map<string, CursistaItem[]>();
    (cursistas ?? [])
      .filter((c) => !termo || semAcento(c.nome).includes(termo))
      .forEach((c) => {
        const nome = c.comunidade ?? "Sem comunidade";
        grupos.set(nome, [...(grupos.get(nome) ?? []), c]);
      });
    return [...grupos.entries()];
  }, [cursistas, busca]);

  const excluir = (ids: number[], titulo: string, nomes: string[]) => {
    Alert.alert(
      titulo,
      `${nomes.map((n) => `• ${n}`).join("\n")}\n\nApaga o cursista e as presenças dele. Não dá para desfazer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            setExcluindo(true);
            try {
              const r = await excluirCursistas(ids);
              Alert.alert("Pronto", r.message);
              await carregar();
            } catch (err: any) {
              Alert.alert("Não foi possível remover", err?.message || "Tente novamente.");
            } finally {
              setExcluindo(false);
            }
          },
        },
      ]
    );
  };

  const removerUm = (c: CursistaItem) => {
    if (c.status === "promovido") {
      Alert.alert(c.nome, "Já virou servo: não sai por aqui.");
      return;
    }
    excluir([c.id_cursista], "Remover cursista?", [`${c.nome} (desistência ou lançado por engano)`]);
  };

  const cortar = () => {
    const escolhidos = faltosos.filter((f) => marcados.has(f.id_cursista));
    if (!escolhidos.length) return;
    excluir(
      escolhidos.map((f) => f.id_cursista),
      `Cortar ${escolhidos.length} ${escolhidos.length > 1 ? "cursistas" : "cursista"}?`,
      escolhidos.map((f) => f.nome)
    );
  };

  const alternar = (id: number) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const totalMarcados = faltosos.filter((f) => marcados.has(f.id_cursista)).length;

  return (
    <SafeAreaView style={base.safeArea}>
      <View style={base.topo}>
        <TouchableOpacity style={base.voltar} onPress={voltar} hitSlop={12} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={26} color={Cores.marinho} />
        </TouchableOpacity>
        <Text style={base.titulo}>Cursistas</Text>
        <View style={base.voltar} />
      </View>

      {!isAdmin ? (
        <Text style={[base.texto, local.centro]}>Só o administrador e a coordenação geral gerenciam cursistas.</Text>
      ) : (
        <ScrollView
          contentContainerStyle={base.container}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={false} onRefresh={carregar} />}
        >
          <View style={base.anos}>
            {[anoAtual, anoAtual + 1].map((a) => (
              <TouchableOpacity key={a} style={[base.ano, ano === a && base.anoAtivo]}
                                onPress={() => { setCursistas(null); setAno(a); }}>
                <Text style={[base.anoText, ano === a && base.anoTextAtivo]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={base.botao} onPress={() => router.push("/importar-cursistas")}>
            <Ionicons name="document-attach-outline" size={20} color={Cores.textoSobrePrimaria} />
            <Text style={base.botaoText}>Importar planilha</Text>
          </TouchableOpacity>

          {faltosos.length > 0 && (
            <View style={[base.caixa, base.caixaErro]}>
              <Text style={[base.caixaTitulo, base.erroText]}>
                Faltaram no encontro ({faltosos.length})
              </Text>
              <Text style={[base.erroText, { marginBottom: 8 }]}>
                Quem faltou a um dia ou aos dois é cortado. Se a falta foi lançada por engano, corrija a
                chamada do encontro e a pessoa sai desta lista.
              </Text>
              {faltosos.map((f) => {
                const marcado = marcados.has(f.id_cursista);
                return (
                  <TouchableOpacity key={f.id_cursista} style={local.faltoso}
                                    onPress={() => alternar(f.id_cursista)} disabled={excluindo}>
                    <Ionicons name={marcado ? "checkbox" : "square-outline"} size={22}
                              color={marcado ? STATUS_CORES.Falta.forte : Cores.iconeInativo} />
                    <View style={{ flex: 1 }}>
                      <Text style={base.pastaNome}>{f.nome}</Text>
                      <Text style={base.pastaPlanilha}>
                        {f.comunidade} · faltou {f.faltas.map(dataBr).join(" e ")}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[base.botao, local.botaoCortar, (!totalMarcados || excluindo) && base.botaoDesativado]}
                onPress={cortar}
                disabled={!totalMarcados || excluindo}
              >
                <Text style={base.botaoText}>
                  {totalMarcados ? `Cortar ${totalMarcados} ${totalMarcados > 1 ? "cursistas" : "cursista"}` : "Ninguém marcado"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={local.busca}>
            <Ionicons name="search" size={18} color={Cores.iconeInativo} />
            <TextInput
              style={local.buscaInput}
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar cursista"
              placeholderTextColor={Cores.iconeInativo}
            />
          </View>

          {cursistas === null ? (
            <ActivityIndicator size="large" color={Cores.primaria} style={{ marginTop: 24 }} />
          ) : cursistas.length === 0 ? (
            <View style={local.vazio}>
              <Ionicons name="school-outline" size={40} color={Cores.iconeInativo} />
              <Text style={local.vazioTexto}>Nenhum cursista em {ano}.</Text>
              <Text style={base.pastaPlanilha}>Importe a planilha de cursistas para começar.</Text>
            </View>
          ) : (
            porComunidade.map(([comunidade, lista]) => (
              <View key={comunidade}>
                <Text style={base.momento}>{comunidade} · {lista.length}</Text>
                {lista.map((c) => (
                  <TouchableOpacity key={c.id_cursista} style={[base.pasta, local.item]}
                                    onPress={() => removerUm(c)} disabled={excluindo} activeOpacity={0.7}>
                    <View style={{ flex: 1 }}>
                      <Text style={base.pastaNome}>{c.nome}</Text>
                      {(c.telefone || c.idade !== null) && (
                        <Text style={base.pastaPlanilha}>
                          {[c.telefone, c.idade !== null ? `${c.idade} anos` : null].filter(Boolean).join(" · ")}
                        </Text>
                      )}
                    </View>
                    {c.status === "promovido" ? (
                      <Text style={local.servo}>Servo</Text>
                    ) : (
                      <Ionicons name="trash-outline" size={18} color={Cores.iconeInativo} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))
          )}
        </ScrollView>
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
  faltoso: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  botaoCortar: {
    backgroundColor: STATUS_CORES.Falta.forte,
    marginTop: 8,
    marginBottom: 0,
  },
  busca: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Cores.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Cores.borda,
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  buscaInput: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 10,
    fontSize: 15,
    color: Cores.texto,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  servo: {
    fontSize: 12,
    fontWeight: "700",
    color: Cores.primaria,
  },
  vazio: {
    alignItems: "center",
    marginTop: 32,
    gap: 6,
  },
  vazioTexto: {
    fontSize: 15,
    color: Cores.textoSuave,
  },
});
