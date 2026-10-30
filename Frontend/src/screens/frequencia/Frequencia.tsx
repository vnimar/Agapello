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
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./Frequencia.styles";
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
import { Cores } from "@/constants/theme";
import { STATUS_CORES } from "@/constants/frequencia";

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

const STATUS_LISTA: StatusFrequencia[] = ["Presente", "Justificada", "Falta"];

function normalize(str: string){
  return str.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function formatarData(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

// YYYY-MM-DD no fuso do aparelho (toISOString usaria UTC)
function hojeKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "2026-11-15" → "Domingo, 15 de novembro"
function dataPorExtenso(dateStr: string) {
  const [ano, mes, dia] = dateStr.slice(0, 10).split("-").map(Number);
  const texto = new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
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

  // Filtra mantendo a ordem da API (da mais recente para a mais antiga)
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

  // Carregamento inicial

  const carregarDados = useCallback(async () => {
    setLoadingMissoes(true);
    setLoadingServos(true);
    try {
      const [missoesData, servosData] = await Promise.all([getMissoesComFrequencia(), getServos()]);
      // A API já manda só as missões até hoje, da mais recente para a mais antiga
      // (o filtro aqui cobre a diferença de fuso entre o servidor e o aparelho)
      const hoje = hojeKey();
      const ateHoje = missoesData.data.filter((m) => m.data <= hoje);
      setMissoes(ateHoje);

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

      // Já abre na missão de hoje ou, se não tiver, na última que passou
      if (ateHoje.length > 0) selecionarMissao(ateHoje[0]);
    } catch (error: any) {
      Alert.alert("Erro", error?.message || "Falha ao carregar dados.");
    } finally {
      setLoadingMissoes(false);
      setLoadingServos(false);
    }
  }, [selecionarMissao]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Marcar status de um servo

  const marcarStatus = useCallback((id: number, status: StatusFrequencia) => {
    setAttendance((prev) => ({ ...prev, [id]: status }));
  }, []);

  const marcarTodosPresentes = useCallback(() => {
    const todos: Record<number, StatusFrequencia | null> = {};
    servosRef.current.forEach((s) => { todos[s.id] = "Presente"; });
    setAttendance(todos);
  }, []);

  // Marca a missão como lançada na lista do seletor
  const marcarMissaoLancada = (id_missao: number) => {
    setMissoes((prev) =>
      prev.map((m) => (m.id_missao === id_missao ? { ...m, tem_frequencia: true } : m))
    );
  };

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
      marcarMissaoLancada(missaoSelecionada.id_missao);
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
  const todosPresentes = servos.length > 0 && contagem.presente === servos.length;

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
          {STATUS_LISTA.map((s) => {
            const ativo = statusAtual === s;
            const cor = STATUS_CORES[s];
            return (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusBtn,
                  ativo && { backgroundColor: cor.fundo, borderColor: cor.forte },
                  !podeEditar && !ativo && styles.statusBtnBloqueado,
                ]}
                onPress={() => podeEditar && marcarStatus(item.id, s)}
                activeOpacity={podeEditar ? 0.7 : 1}
                accessibilityLabel={`${item.nome}: ${s}`}
              >
                <Text style={[styles.statusBtnText, ativo && { color: cor.texto }]}>
                  {s === "Presente" ? "P" : s === "Justificada" ? "J" : "F"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // Selo do estado da frequência no card da missão
  const selo = modoEdicao
    ? { texto: "Editando", cor: STATUS_CORES.Justificada }
    : jaLancada
    ? { texto: "Registrada", cor: STATUS_CORES.Presente }
    : { texto: "Pendente", cor: { fundo: Cores.primariaSuave, texto: Cores.primaria } };

  // Render principal

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Cores.fundo} />

      {/* Header */}
      <Header title="Frequência" />

      {/* Card da missão (toque para trocar) */}
      <TouchableOpacity
        style={styles.missaoCard}
        onPress={abrirModalMissoes}
        activeOpacity={0.7}
      >
        <View style={styles.missaoIcon}>
          <Ionicons name="calendar-outline" size={22} color={Cores.primaria} />
        </View>
        {missaoSelecionada ? (
          <View style={styles.missaoBody}>
            <Text style={styles.missaoTitulo} numberOfLines={1}>
              {missaoSelecionada.descricao || "Missão"}
            </Text>
            <View style={styles.missaoInfoRow}>
              <Text style={styles.missaoData} numberOfLines={1}>
                {dataPorExtenso(missaoSelecionada.data)}
              </Text>
              <View style={[styles.selo, { backgroundColor: selo.cor.fundo }]}>
                <Text style={[styles.seloTexto, { color: selo.cor.texto }]}>{selo.texto}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.missaoBody}>
            <Text style={styles.missaoTitulo}>Selecione uma missão</Text>
            <Text style={styles.missaoData}>Toque para escolher</Text>
          </View>
        )}
        <Ionicons name="swap-vertical" size={20} color={Cores.primaria} />
      </TouchableOpacity>

      {/* Busca + Todos presentes */}
      {missaoSelecionada && !loadingServos && (
        <>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={Cores.iconeInativo} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar servo..."
              placeholderTextColor={Cores.iconeInativo}
              value={busca}
              onChangeText={setBusca}
              autoCorrect={false}
              returnKeyType="search"
            />
            {busca.length > 0 && (
              <TouchableOpacity onPress={() => setBusca("")}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={Cores.iconeInativo} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.listaTopo}>
            <Text style={styles.searchCount}>
              {busca.trim().length > 0
                ? `${servosFiltrados.length} de ${servos.length} servos`
                : `${servos.length} servos`}
            </Text>
            {podeEditar && servos.length > 0 && (
              <TouchableOpacity
                style={[styles.todosBtn, todosPresentes && styles.todosBtnFeito]}
                onPress={marcarTodosPresentes}
                disabled={todosPresentes}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={todosPresentes ? "checkmark-done" : "checkmark-done-outline"}
                  size={16}
                  color={todosPresentes ? STATUS_CORES.Presente.texto : Cores.primaria}
                />
                <Text style={[styles.todosBtnText, todosPresentes && styles.todosBtnTextFeito]}>
                  Todos presentes
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {/* Conteúdo principal */}
      {loadingServos ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Cores.primaria} />
        </View>
      ) : !missaoSelecionada ? (
        <View style={styles.emptyState}>
          <Ionicons name="clipboard-outline" size={40} color={Cores.iconeInativo} />
          <Text style={styles.emptyStateText}>Selecione uma missão</Text>
          <Text style={styles.emptyStateSubtext}>para carregar a lista de servos</Text>
        </View>
      ) : servosFiltrados.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={40} color={Cores.iconeInativo} />
          <Text style={styles.emptyStateText}>Nenhum servo encontrado</Text>
          <Text style={styles.emptyStateSubtext}>Confira o nome digitado</Text>
        </View>
      ) : (
        <FlatList
          style={styles.lista}
          data={servosFiltrados}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderServos}
          extraData={{ attendance, podeEditar }}
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
            {[
              { status: "Presente" as const, valor: contagem.presente, label: "presentes" },
              { status: "Justificada" as const, valor: contagem.justificada, label: "justificados" },
              { status: "Falta" as const, valor: contagem.falta, label: "faltas" },
            ].map((c) => (
              <View key={c.status} style={[styles.counterCard, { backgroundColor: STATUS_CORES[c.status].fundo }]}>
                <Text style={[styles.counterNum, { color: STATUS_CORES[c.status].texto }]}>{c.valor}</Text>
                <Text style={[styles.counterLabel, { color: STATUS_CORES[c.status].texto }]}>{c.label}</Text>
              </View>
            ))}
          </View>

          {!jaLancada && (
            <TouchableOpacity
              style={[styles.btnConfirmar, salvando && styles.btnDisabled]}
              onPress={confirmarFrequencia}
              disabled={salvando}
              activeOpacity={0.8}
            >
              {salvando ? (
                <ActivityIndicator color={Cores.textoSobrePrimaria} size="small" />
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
              <Ionicons name="create-outline" size={18} color={Cores.primaria} />
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
                style={[styles.btnConfirmar, styles.btnConfirmarFlex, salvando && styles.btnDisabled]}
                onPress={salvarEdicao}
                disabled={salvando}
                activeOpacity={0.8}
              >
                {salvando ? (
                  <ActivityIndicator color={Cores.textoSobrePrimaria} size="small" />
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
              <Ionicons name="search" size={18} color={Cores.iconeInativo} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por data ou descrição..."
                placeholderTextColor={Cores.iconeInativo}
                value={buscaMissao}
                onChangeText={setBuscaMissao}
                autoCorrect={false}
                returnKeyType="search"
              />
              {buscaMissao.length > 0 && (
                <TouchableOpacity onPress={() => setBuscaMissao("")}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={Cores.iconeInativo} />
                </TouchableOpacity>
              )}
            </View>
            {loadingMissoes ? (
              <ActivityIndicator color={Cores.primaria} style={{ marginTop: 24 }} />
            ) : missoesFiltradas.length === 0 ? (
              <Text style={styles.missaoEmpty}>Nenhuma missão encontrada</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {missoesFiltradas.map((m) => {
                  const selecionada = missaoSelecionada?.id_missao === m.id_missao;
                  return (
                    <TouchableOpacity
                      key={m.id_missao}
                      style={[styles.missaoItem, selecionada && styles.missaoItemSelected]}
                      onPress={() => selecionarMissao(m)}
                    >
                      <View style={styles.missaoItemBody}>
                        <View style={styles.missaoItemTopo}>
                          <Text style={styles.missaoItemData}>{formatarData(m.data)}</Text>
                          {m.data === hojeKey() && (
                            <View style={styles.tagHoje}>
                              <Text style={styles.tagHojeText}>Hoje</Text>
                            </View>
                          )}
                          {m.tem_frequencia && (
                            <View style={[styles.tagHoje, { backgroundColor: STATUS_CORES.Presente.fundo }]}>
                              <Text style={[styles.tagHojeText, { color: STATUS_CORES.Presente.texto }]}>Registrada</Text>
                            </View>
                          )}
                        </View>
                        {m.descricao && (
                          <Text style={styles.missaoItemDesc} numberOfLines={1}>{m.descricao}</Text>
                        )}
                      </View>
                      {selecionada && (
                        <Ionicons name="checkmark-circle" size={22} color={Cores.primaria} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
