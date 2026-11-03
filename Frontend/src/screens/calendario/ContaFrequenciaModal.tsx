import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { adminStyles as styles } from "./CalendarioAdmin.styles";
import { Cores } from "@/constants/theme";
import { Missao, marcarContaFrequencia } from "../../services/missao/missao";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type Props = {
  visible: boolean;
  missoes: Missao[];
  ano: number;
  onClose: () => void;
  onSaved: () => void;
};

/**
 * Marca de uma vez quais missões do ano contam na frequência (administrador/coord. geral).
 * Todas continuam no calendário; as que não contam saem da chamada e da porcentagem.
 */
export function ContaFrequenciaModal({ visible, missoes, ano, onClose, onSaved }: Props) {
  const [marcado, setMarcado] = useState<Record<number, boolean>>({});
  const [salvando, setSalvando] = useState(false);

  const doAno = useMemo(
    () =>
      missoes
        .filter((m) => m.data.startsWith(`${ano}-`))
        .sort((a, b) => a.data.localeCompare(b.data) || a.id_missao - b.id_missao),
    [missoes, ano]
  );

  // Agrupa por mês, na ordem do calendário
  const porMes = useMemo(() => {
    const grupos: { mes: number; itens: Missao[] }[] = [];
    doAno.forEach((m) => {
      const mes = Number(m.data.slice(5, 7)) - 1;
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.mes === mes) ultimo.itens.push(m);
      else grupos.push({ mes, itens: [m] });
    });
    return grupos;
  }, [doAno]);

  // Toda vez que abre, parte do que está salvo
  useEffect(() => {
    if (!visible) return;
    const inicial: Record<number, boolean> = {};
    doAno.forEach((m) => { inicial[m.id_missao] = m.conta_frequencia; });
    setMarcado(inicial);
  }, [visible, doAno]);

  const alteradas = doAno.filter((m) => marcado[m.id_missao] !== m.conta_frequencia);

  const salvar = async () => {
    if (alteradas.length === 0) {
      onClose();
      return;
    }
    setSalvando(true);
    try {
      await marcarContaFrequencia(
        alteradas.filter((m) => marcado[m.id_missao]).map((m) => m.id_missao),
        alteradas.filter((m) => !marcado[m.id_missao]).map((m) => m.id_missao)
      );
      onSaved();
    } catch (err: any) {
      Alert.alert("Não foi possível salvar", err?.message || "Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>O que conta na frequência</Text>
          <Text style={local.subtitulo}>
            Tudo continua no calendário. As desligadas ficam como presença livre: sem chamada e
            fora da porcentagem.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {porMes.length === 0 && (
              <Text style={local.vazio}>Nenhuma missão em {ano}.</Text>
            )}
            {porMes.map((grupo) => (
              <View key={grupo.mes}>
                <Text style={styles.label}>{MESES[grupo.mes]}</Text>
                <View style={local.grupo}>
                  {grupo.itens.map((m, i) => (
                    <View
                      key={m.id_missao}
                      style={[local.linha, i === grupo.itens.length - 1 && local.linhaUltima]}
                    >
                      <Text style={local.dia}>{m.data.slice(8, 10)}/{m.data.slice(5, 7)}</Text>
                      <Text style={local.descricao} numberOfLines={2}>{m.descricao}</Text>
                      <Switch
                        value={!!marcado[m.id_missao]}
                        onValueChange={(v) => setMarcado((prev) => ({ ...prev, [m.id_missao]: v }))}
                        trackColor={{ false: Cores.borda, true: Cores.primariaClara }}
                        thumbColor={marcado[m.id_missao] ? Cores.primaria : Cores.card}
                        disabled={salvando}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnSecondary} onPress={onClose} disabled={salvando}>
              <Text style={styles.btnSecondaryText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrimary, salvando && styles.btnDisabled]}
              onPress={salvar}
              disabled={salvando}
            >
              {salvando ? (
                <ActivityIndicator color={Cores.textoSobrePrimaria} size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>
                  {alteradas.length > 0 ? `Salvar (${alteradas.length})` : "Salvar"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const local = StyleSheet.create({
  subtitulo: {
    fontSize: 14,
    lineHeight: 20,
    color: Cores.textoSuave,
    marginBottom: 4,
  },
  vazio: {
    fontSize: 15,
    color: Cores.textoSuave,
    textAlign: "center",
    paddingVertical: 24,
  },
  grupo: {
    backgroundColor: Cores.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Cores.borda,
    paddingHorizontal: 14,
  },
  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Cores.primariaSuave,
  },
  linhaUltima: {
    borderBottomWidth: 0,
  },
  dia: {
    width: 44,
    fontSize: 14,
    fontWeight: "700",
    color: Cores.marinho,
  },
  descricao: {
    flex: 1,
    fontSize: 15,
    color: Cores.texto,
  },
});
