import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { adminStyles as styles } from "./CalendarioAdmin.styles";
import { Cores } from "@/constants/theme";
import {
  Missao,
  MissaoInput,
  PublicoMissao,
  criarMissao,
  atualizarMissao,
  excluirMissao,
} from "../../services/missao/missao";

// ── Helpers de data/hora ──────────────────────────────────────────────────────

/** "2027-03-14" → "14/03/2027" */
export function isoParaBr(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** "14/03/2027" → "2027-03-14" (ou null se inválida) */
function brParaIso(br: string): string | null {
  const match = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const data = new Date(Number(y), Number(m) - 1, Number(d));
  if (data.getDate() !== Number(d) || data.getMonth() !== Number(m) - 1) return null;
  return `${y}-${m}-${d}`;
}

/** Insere as barras enquanto digita: 14032027 → 14/03/2027 */
function mascaraData(texto: string) {
  const n = texto.replace(/\D/g, "").slice(0, 8);
  if (n.length <= 2) return n;
  if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
  return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
}

/** 1430 → 14:30 */
function mascaraHora(texto: string) {
  const n = texto.replace(/\D/g, "").slice(0, 4);
  return n.length <= 2 ? n : `${n.slice(0, 2)}:${n.slice(2)}`;
}

function horaValida(hora: string) {
  const match = hora.match(/^(\d{2}):(\d{2})$/);
  return !!match && Number(match[1]) < 24 && Number(match[2]) < 60;
}

const PUBLICOS: { valor: PublicoMissao; label: string }[] = [
  { valor: "servos", label: "Servos" },
  { valor: "cursistas", label: "Cursistas" },
  { valor: "ambos", label: "Ambos" },
];

// ── Modal de criar/editar missão ──────────────────────────────────────────────

export function MissaoEditModal({
  visible,
  missao,
  dataInicial,
  onClose,
  onSaved,
}: {
  visible: boolean;
  missao: Missao | null;        // null = nova missão
  dataInicial: string | null;   // YYYY-MM-DD para nova missão
  onClose: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState("");
  const [descricao, setDescricao] = useState("");
  const [horario, setHorario] = useState("");
  const [local, setLocal] = useState("");
  const [publico, setPublico] = useState<PublicoMissao>("servos");
  const [contaFrequencia, setContaFrequencia] = useState(true);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setData(missao ? isoParaBr(missao.data) : dataInicial ? isoParaBr(dataInicial) : "");
    setDescricao(missao?.descricao ?? "");
    setHorario(missao && horaValida(missao.horario) ? missao.horario : "");
    setLocal(missao && missao.local !== "Local não definido" ? missao.local : "");
    setPublico(missao?.publico ?? "servos");
    setContaFrequencia(missao?.conta_frequencia ?? true);
    setObservacao(missao?.observacao ?? "");
  }, [visible, missao, dataInicial]);

  const salvar = async () => {
    const dataIso = brParaIso(data);
    if (!dataIso) return Alert.alert("Atenção", "Informe a data no formato dd/mm/aaaa.");
    if (!descricao.trim()) return Alert.alert("Atenção", "Informe a descrição da missão.");
    if (horario && !horaValida(horario)) return Alert.alert("Atenção", "Horário inválido. Use hh:mm.");

    const payload: MissaoInput = {
      data: dataIso,
      descricao: descricao.trim(),
      horario: horario || null,
      local: local.trim() || null,
      publico,
      conta_frequencia: contaFrequencia,
      observacao: observacao.trim() || null,
    };

    setSalvando(true);
    try {
      if (missao) await atualizarMissao(missao.id_missao, payload);
      else await criarMissao(payload);
      onSaved();
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const excluir = () => {
    if (!missao) return;
    Alert.alert("Excluir missão", `Excluir "${missao.descricao}" de ${isoParaBr(missao.data)}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await excluirMissao(missao.id_missao);
            onSaved();
          } catch (err: any) {
            Alert.alert("Não foi possível excluir", err?.message || "Tente novamente.");
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.sheetOverlay}
        behavior="padding"
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{missao ? "Editar missão" : "Nova missão"}</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Descrição</Text>
            <TextInput
              style={styles.input}
              value={descricao}
              onChangeText={setDescricao}
              placeholder="Ex.: Missa Mensal do Ágape"
              placeholderTextColor={Cores.iconeInativo}
            />

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <Text style={styles.label}>Data</Text>
                <TextInput
                  style={styles.input}
                  value={data}
                  onChangeText={(t) => setData(mascaraData(t))}
                  placeholder="dd/mm/aaaa"
                  placeholderTextColor={Cores.iconeInativo}
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.rowItem}>
                <Text style={styles.label}>Horário</Text>
                <TextInput
                  style={styles.input}
                  value={horario}
                  onChangeText={(t) => setHorario(mascaraHora(t))}
                  placeholder="hh:mm"
                  placeholderTextColor={Cores.iconeInativo}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <Text style={styles.label}>Local</Text>
            <TextInput
              style={styles.input}
              value={local}
              onChangeText={setLocal}
              placeholder="Ex.: Paróquia São Miguel"
              placeholderTextColor={Cores.iconeInativo}
            />

            <Text style={styles.label}>Público</Text>
            <View style={styles.chips}>
              {PUBLICOS.map((p) => (
                <TouchableOpacity
                  key={p.valor}
                  style={[styles.chip, publico === p.valor && styles.chipActive]}
                  onPress={() => setPublico(p.valor)}
                >
                  <Text style={[styles.chipText, publico === p.valor && styles.chipTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Conta na frequência</Text>
              <Switch
                value={contaFrequencia}
                onValueChange={setContaFrequencia}
                trackColor={{ false: Cores.borda, true: Cores.primariaClara }}
                thumbColor={contaFrequencia ? Cores.primaria : Cores.card}
              />
            </View>

            <Text style={styles.label}>Observação</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={observacao}
              onChangeText={setObservacao}
              placeholder="Ex.: Remarcada por causa da eleição"
              placeholderTextColor={Cores.iconeInativo}
              multiline
            />
          </ScrollView>

          <View style={styles.actions}>
            {missao ? (
              <TouchableOpacity style={styles.btnDanger} onPress={excluir}>
                <Text style={styles.btnDangerText}>Excluir</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.btnSecondary} onPress={onClose}>
                <Text style={styles.btnSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.btnPrimary, salvando && styles.btnDisabled]}
              onPress={salvar}
              disabled={salvando}
            >
              {salvando ? (
                <ActivityIndicator color={Cores.textoSobrePrimaria} size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>Salvar</Text>
              )}
            </TouchableOpacity>
          </View>
          {missao && (
            <TouchableOpacity onPress={onClose} style={styles.linkFechar}>
              <Text style={styles.linkFecharText}>Fechar sem salvar</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
