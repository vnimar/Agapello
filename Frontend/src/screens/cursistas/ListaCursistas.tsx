import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Cores } from "@/constants/theme";
import { STATUS_CORES, corDaFrequencia } from "@/constants/frequencia";
import {
  CursistaFrequencia,
  FrequenciaCursistas,
  getFrequenciaCursistas,
} from "../../services/cursistas/cursistas";
import { styles } from "../servo/Servo.style";
import { chamadaStyles } from "./ChamadaCursistas.styles";

// Lista dos cursistas com a % do ano (formação, encontro e confraternização
// que contam). Coordenador e tutor veem a própria comunidade; coord. geral e
// administrador, todas.

const getInitials = (nome: string) =>
  nome.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join("");

function semAcento(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function Cursista({ c, aberto, onPress }: { c: CursistaFrequencia; aberto: boolean; onPress: () => void }) {
  const percentual = c.percentual_presenca;
  const cor = corDaFrequencia(percentual);
  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardHeader} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(c.nome)}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardNome} numberOfLines={1}>{c.nome}</Text>
        </View>
        <View style={[styles.freqPill, { backgroundColor: cor.fundo }]}>
          <Text style={[styles.freqPillText, { color: cor.texto }]}>
            {percentual !== null ? `${percentual}%` : "—"}
          </Text>
        </View>
        <Ionicons name={aberto ? "chevron-up" : "chevron-down"} size={18}
                  color={Cores.iconeInativo} style={styles.chevron} />
      </TouchableOpacity>

      {aberto && (
        <View style={styles.details}>
          <View style={styles.barraWrap}>
            <View style={styles.barraRow}>
              <Text style={styles.barraLabel}>Frequência em {new Date().getFullYear()}</Text>
              <Text style={[styles.barraValor, { color: cor.texto }]}>
                {percentual !== null ? `${percentual}%` : "Sem chamadas ainda"}
              </Text>
            </View>
            <View style={styles.barraFundo}>
              <View style={[styles.barraPreenchimento, { width: `${percentual ?? 0}%`, backgroundColor: cor.forte }]} />
            </View>
          </View>
          <View style={styles.contadores}>
            {[
              { label: "Presentes", val: c.presente, cor: STATUS_CORES.Presente },
              { label: "Justificadas", val: c.justificada, cor: STATUS_CORES.Justificada },
              { label: "Faltas", val: c.falta, cor: STATUS_CORES.Falta },
            ].map((item) => (
              <View key={item.label} style={[styles.contadorCard, { backgroundColor: item.cor.fundo }]}>
                <Text style={[styles.contadorNum, { color: item.cor.texto }]}>{item.val}</Text>
                <Text style={[styles.contadorLabel, { color: item.cor.texto }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

export default function ListaCursistas() {
  const [dados, setDados] = useState<FrequenciaCursistas | null>(null);
  const [idComunidade, setIdComunidade] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await getFrequenciaCursistas();
      setDados(r);
      setIdComunidade((atual) =>
        r.comunidades.some((c) => c.id_comunidade === atual)
          ? atual
          : (r.comunidades.find((c) => c.cursistas.length > 0) ?? r.comunidades[0])?.id_comunidade ?? null
      );
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível carregar os cursistas.");
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const comunidade = dados?.comunidades.find((c) => c.id_comunidade === idComunidade) ?? null;
  const lista = useMemo(() => {
    const termo = semAcento(busca.trim());
    return (comunidade?.cursistas ?? []).filter((c) => !termo || semAcento(c.nome).includes(termo));
  }, [comunidade, busca]);

  if (!dados) {
    return (
      <View style={styles.emptyState}>
        <ActivityIndicator size="large" color={Cores.primaria} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {dados.comunidades.length > 1 && (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={chamadaStyles.chips}>
            {dados.comunidades.map((c) => {
              const ativa = c.id_comunidade === idComunidade;
              return (
                <TouchableOpacity key={c.id_comunidade} style={[chamadaStyles.chip, ativa && chamadaStyles.chipAtivo]}
                                  onPress={() => { setIdComunidade(c.id_comunidade); setAberto(null); }}>
                  <Text style={[chamadaStyles.chipTexto, ativa && chamadaStyles.chipTextoAtivo]}>
                    {c.nome} · {c.cursistas.length}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={styles.searchArea}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={18} color={Cores.iconeInativo} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar cursista..."
            placeholderTextColor={Cores.iconeInativo}
            value={busca}
            onChangeText={setBusca}
          />
        </View>
      </View>

      <FlatList
        data={lista}
        keyExtractor={(c) => String(c.id_cursista)}
        renderItem={({ item }) => (
          <Cursista c={item} aberto={aberto === item.id_cursista}
                    onPress={() => setAberto((a) => (a === item.id_cursista ? null : item.id_cursista))} />
        )}
        extraData={aberto}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={carregar} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={36} color={Cores.iconeInativo} />
            <Text style={styles.emptyStateText}>
              {busca ? "Nenhum cursista encontrado" : "Nenhum cursista nesta comunidade"}
            </Text>
          </View>
        }
      />
    </View>
  );
}
