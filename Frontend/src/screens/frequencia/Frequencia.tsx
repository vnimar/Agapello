import React, {useState, useEffect, useCallback, useRef, useMemo} from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { styles } from "./Frequencia.styles";
import { getMissoes } from "../../services/missao/missao";
import { getServos } from "../../services/servos/servos";
import {
  getFrequenciaById,
  postFrequencia,
  putFrequencia,
  getMissoesComFrequencia,
  StatusFrequencia,
  FrequenciaResponse,
  MissaoComFrequencia
} from "../../services/frequencia/frequencia";
import Header from '../../../components/Header';

// Tipos locais

interface Missao {
  id_missao: number;
  data: string;
  descricao: string | null;
  tem_frequencia: boolean;
}

interface ServoNormalizado {
  id: number;
  nome: string;
  status: string | null;
}

interface FrequenciaRegistro {
  id_servo: number;
  status: StatusFrequencia;
}

function normalize(str: string){
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatarData(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}
// Componente

export default function FrequenciaScreen() {
  const [missoes, setMissoes] = useState<MissaoComFrequencia[]>([]);
  const [missaoSelecionada, setMissaoSelecionada] = useState<Missao | null>(null);
  const [servos, setServos] = useState<ServoNormalizado[]>([]);
  const [attendance, setAttendance] = useState<Record<number, StatusFrequencia | null>>({});
  const [frequenciaExistente, setFrequenciaExistente] = useState<FrequenciaRegistro[]>([]);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [loadingMissoes, setLoadingMissoes] = useState(false);
  const [loadingServos, setLoadingServos] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [modalMissoesVisible, setModalMissoesVisible] = useState(false);
  const [busca, setBusca] = useState("");
  const [buscaMissao, setBuscaMissao] = useState("");

  const servosFiltrados = useMemo(() => {
    if (!busca.trim()) return servos;
    const q = normalize(busca);
    return servos.filter((s) => normalize(s.nome).includes(q));
  }, [busca, servos]);

  // Filtra mantendo a ordem da API (próximas primeiro, depois as passadas)
  const missoesFiltradas = useMemo(() => {
    if (!buscaMissao.trim()) return missoes;
    const q = normalize(buscaMissao.trim());
    return missoes.filter((m) =>
      normalize(`${formatarData(m.data)} ${m.descricao ?? ""}`).includes(q)
    );
  }, [buscaMissao, missoes]);

  const abrirModalMissoes = () => {
    setBuscaMissao("");
    setModalMissoesVisible(true);
  };

  const servosRef = useRef<ServoNormalizado[]>([]);
  servosRef.current = servos;

  useEffect(() => {
    carregarDados();
  }, []);

  // Carregamento inicial

  const carregarDados = async () => {
    setLoadingMissoes(true);
    setLoadingServos(true);
    try {
      const [missoesData, servosData] = await Promise.all([getMissoesComFrequencia(), getServos()]);
      setMissoes(missoesData.data)

      // @ts-ignore
      const servosRaw = Array.isArray(servosData) ? servosData : servosData?.data || [];
      const servosNormalizados: ServoNormalizado[] = servosRaw
        .filter((s: any) => s && (s.id_servo || s.id))
        .map((s: any) => ({
          id: s.id_servo ?? s.id,
          nome: s.nome || "Sem nome",
          status: s.status ?? null,
        }));

      setServos(servosNormalizados);
      servosRef.current = servosNormalizados;
    } catch (error: any) {
      Alert.alert("Erro", error?.message || "Falha ao carregar dados.");
    } finally {
      setLoadingMissoes(false);
      setLoadingServos(false);
    }
  };

  // Selecionar missão e carregar frequência existente
  const selecionarMissao = useCallback(async (missao: Missao) => {
    setMissaoSelecionada(missao);
    setModalMissoesVisible(false);
    setModoEdicao(false);
    setFrequenciaExistente([]);
    setBusca("");

    const initialAttendance: Record<number, StatusFrequencia | null> = {};
    servosRef.current.forEach((s) => { initialAttendance[s.id] = "Falta"; });
    setAttendance(initialAttendance);

    try {
      const result = await getFrequenciaById(missao.id_missao);

      const registrosRaw = (result as FrequenciaResponse).data ?? [];

      if (registrosRaw.length === 0) {
        setFrequenciaExistente([]);
        return;
      }

      const registros: FrequenciaRegistro[] = registrosRaw.map((item) => ({
        id_servo: item.id_servo,
        status: item.status,
      }));

      setFrequenciaExistente(registros);

      const preenchido = { ...initialAttendance };
      registros.forEach((r) => { preenchido[r.id_servo] = r.status; });
      setAttendance(preenchido);
    } catch (err: any) {
      if (err?.message?.includes("404") || err?.message?.toLowerCase().includes("não encontrada")) {
        setFrequenciaExistente([]);
        return;
      }
      Alert.alert("Erro", err?.message || "Não foi possível carregar frequências.");
      setFrequenciaExistente([]);
    }
  }, []);

  // Marcar status de um servo

  const marcarStatus = useCallback((id: number, status: StatusFrequencia) => {
    setAttendance((prev) => ({ ...prev, [id]: status }));
  }, []);

  // Confirmar frequência (POST)

  const confirmarFrequencia = async () => {
    if (!missaoSelecionada) return;

    const pendentes = servosRef.current.filter((s) => !attendance[s.id]);
    if (pendentes.length) {
      Alert.alert("Atenção", `${pendentes.length} servo(s) ainda sem marcação.`);
      return;
    }

    setSalvando(true);
    try {
      await Promise.all(
        servosRef.current.map((s) =>
          postFrequencia(s.id, missaoSelecionada.id_missao, attendance[s.id] as StatusFrequencia)
        )
      );

      Alert.alert("Sucesso", "Frequência registrada!");

      const novaExistente: FrequenciaRegistro[] = servosRef.current.map((s) => ({
        id_servo: s.id,
        status: attendance[s.id] as StatusFrequencia,
      }));
      setFrequenciaExistente(novaExistente);
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  // Salvar edição (PUT)

  const salvarEdicao = async () => {
    if (!missaoSelecionada) return;

    const pendentes = servosRef.current.filter((s) => !attendance[s.id]);
    if (pendentes.length) {
      Alert.alert("Atenção", `${pendentes.length} servo(s) sem marcação.`);
      return;
    }

    setSalvando(true);
    try {
      const alterados = servosRef.current.filter((s) => {
        const original = frequenciaExistente.find((f) => f.id_servo === s.id);
        return original?.status !== attendance[s.id];
      });

      await Promise.all(
        alterados.map((s) =>
          putFrequencia(s.id, missaoSelecionada.id_missao, attendance[s.id] as StatusFrequencia)
        )
      );

      Alert.alert("Sucesso", "Frequência atualizada!");

      const atualizada: FrequenciaRegistro[] = servosRef.current.map((s) => ({
        id_servo: s.id,
        status: attendance[s.id] as StatusFrequencia,
      }));
      setFrequenciaExistente(atualizada);
      setModoEdicao(false);
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível atualizar.");
    } finally {
      setSalvando(false);
    }
  };

  // Cancelar edição

  const cancelarEdicao = useCallback(() => {
    setModoEdicao(false);
    const restaurado: Record<number, StatusFrequencia | null> = {};
    servosRef.current.forEach((s) => { restaurado[s.id] = null; });
    frequenciaExistente.forEach((f) => { restaurado[f.id_servo] = f.status; });
    setAttendance(restaurado);
  }, [frequenciaExistente]);

  // Helpers de UI

  const getInitials = (nome: string) =>
    nome.split(" ").slice(0, 2).map((n) => n[0].toUpperCase()).join("");

  const contagem = {
    presente: Object.values(attendance).filter((v) => v === "Presente").length,
    falta: Object.values(attendance).filter((v) => v === "Falta").length,
    justificada: Object.values(attendance).filter((v) => v === "Justificada").length,
  };

  const jaLancada = frequenciaExistente.length > 0;
  const podeEditar = !jaLancada || modoEdicao;

  // Render de cada servo

  const renderServos = ({ item }: { item: ServoNormalizado }) => {
    const statusAtual = attendance[item.id];
    return (
      <View style={styles.servoRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item.nome)}</Text>
        </View>
        <Text style={styles.servoNome} numberOfLines={1}>{item.nome}</Text>
        <View style={styles.statusButtons}>
          {(["Presente", "Justificada", "Falta"] as StatusFrequencia[]).map((s) => {
            const ativo = statusAtual === s;
            const buttonStyle: any[] = [styles.statusBtn];
            const textStyle: any[] = [styles.statusBtnText];
            if (ativo) {
              if (s === "Presente") {
                buttonStyle.push(styles.statusBtn_Presente);
                textStyle.push(styles.statusBtnText_Presente);
              } else if (s === "Justificada") {
                buttonStyle.push(styles.statusBtn_Justificada);
                textStyle.push(styles.statusBtnText_Justificada);
              } else {
                buttonStyle.push(styles.statusBtn_Falta);
                textStyle.push(styles.statusBtnText_Falta);
              }
            }
            return (
              <TouchableOpacity
                key={s}
                style={buttonStyle}
                onPress={() => podeEditar && marcarStatus(item.id, s)}
                activeOpacity={podeEditar ? 0.7 : 1}
              >
                <Text style={textStyle}>
                  {s === "Presente" ? "P" : s === "Justificada" ? "J" : "F"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // Render principal

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <Header title="Frequência" />
        <TouchableOpacity
          style={styles.missaoSelector}
          onPress={abrirModalMissoes}
        >
          <Text style={styles.missaoSelectorLabel}>Missão</Text>
          <Text style={styles.missaoSelectorValue} numberOfLines={1}>
            {missaoSelecionada
              ? `${formatarData(missaoSelecionada.data)}${missaoSelecionada.descricao ? ` — ${missaoSelecionada.descricao}` : ""}`
              : "Selecione uma missão"}
          </Text>
          <Text style={styles.missaoSelectorChevron}>›</Text>
        </TouchableOpacity>

        {jaLancada && !modoEdicao && (
          <View style={styles.badgeLancada}>
            <Text style={styles.badgeLancadaText}>Frequência já registrada</Text>
          </View>
        )}
        {modoEdicao && (
          <View style={styles.badgeEdicao}>
            <Text style={styles.badgeEdicaoText}>Modo edição — altere e confirme</Text>
          </View>
        )}

      {/* Search Bar */}
      {missaoSelecionada && !loadingServos && (
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar servo..."
            placeholderTextColor="#9CA3AF"
            value={busca}
            onChangeText={setBusca}
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          {busca.length > 0 && (
            <TouchableOpacity onPress={() => setBusca("")}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Contador de resultados da busca */}
      {missaoSelecionada && busca.trim().length > 0 && (
        <Text style={styles.searchCount}>
          {servosFiltrados.length} de {servos.length} servos
        </Text>
      )}

      {/* Conteúdo principal */}
      {!missaoSelecionada ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>📋</Text>
          <Text style={styles.emptyStateText}>Selecione uma missão</Text>
          <Text style={styles.emptyStateSubtext}>para carregar a lista de servos</Text>
        </View>
      ) : loadingServos ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#1D9E75" />
        </View>
      ) : servosFiltrados.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>🔍</Text>
          <Text style={styles.emptyStateText}>Nenhum servo encontrado</Text>
          <Text style={styles.emptyStateSubtext}>Nome inexistente</Text>
        </View>
      ) : (
        <FlatList
          data={servosFiltrados}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderServos}
          extraData={attendance}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Footer com contadores e botões */}
      {missaoSelecionada && (
        <View style={styles.footer}>
          <View style={styles.counters}>
            <View style={[styles.counterCard, styles.counterPresente]}>
              <Text style={[styles.counterNum, styles.counterNumPresente]}>{contagem.presente}</Text>
              <Text style={[styles.counterLabel, styles.counterLabelPresente]}>presentes</Text>
            </View>
            <View style={[styles.counterCard, styles.counterJustificada]}>
              <Text style={[styles.counterNum, styles.counterNumJustificada]}>{contagem.justificada}</Text>
              <Text style={[styles.counterLabel, styles.counterLabelJustificada]}>justificados</Text>
            </View>
            <View style={[styles.counterCard, styles.counterFalta]}>
              <Text style={[styles.counterNum, styles.counterNumFalta]}>{contagem.falta}</Text>
              <Text style={[styles.counterLabel, styles.counterLabelFalta]}>faltas</Text>
            </View>
          </View>

          {!jaLancada && (
            <TouchableOpacity
              style={[styles.btnConfirmar, salvando && styles.btnDisabled]}
              onPress={confirmarFrequencia}
              disabled={salvando}
              activeOpacity={0.8}
            >
              {salvando ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.btnConfirmarText}>Confirmar frequência</Text>
              )}
            </TouchableOpacity>
          )}

          {jaLancada && !modoEdicao && (
            <TouchableOpacity
              style={styles.btnAtualizar}
              onPress={() => setModoEdicao(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.btnAtualizarText}>Editar frequência</Text>
            </TouchableOpacity>
          )}

          {jaLancada && modoEdicao && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.btnCancelar}
                onPress={cancelarEdicao}
                activeOpacity={0.8}
              >
                <Text style={styles.btnCancelarText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnConfirmar, salvando && styles.btnDisabled]}
                onPress={salvarEdicao}
                disabled={salvando}
                activeOpacity={0.8}
              >
                {salvando ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.btnConfirmarText}>Salvar alterações</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Modal de seleção de missão */}
      <Modal
        visible={modalMissoesVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalMissoesVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalMissoesVisible(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Selecione a missão</Text>
            <View style={[styles.searchContainer, styles.searchContainerModal]}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por data ou descrição..."
                placeholderTextColor="#9CA3AF"
                value={buscaMissao}
                onChangeText={setBuscaMissao}
                autoCorrect={false}
                returnKeyType="search"
              />
              {buscaMissao.length > 0 && (
                <TouchableOpacity onPress={() => setBuscaMissao("")}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.searchClear}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            {loadingMissoes ? (
              <ActivityIndicator color="#1D9E75" style={{ marginTop: 24 }} />
            ) : missoesFiltradas.length === 0 ? (
              <Text style={styles.missaoEmpty}>Nenhuma missão encontrada</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {missoesFiltradas.map((m) => (
                  <TouchableOpacity
                    key={m.id_missao}
                    style={[
                      styles.missaoItem,
                      missaoSelecionada?.id_missao === m.id_missao && styles.missaoItemSelected,
                    ]}
                    onPress={() => selecionarMissao(m)}
                  >
                    <View>
                      <Text style={styles.missaoItemData}>{formatarData(m.data)}</Text>
                      {m.descricao && (
                        <Text style={styles.missaoItemDesc}>{m.descricao}</Text>
                      )}
                    </View>
                    {missaoSelecionada?.id_missao === m.id_missao && (
                      <Text style={styles.missaoItemCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}