import React, { useState, useEffect, useCallback, useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./Servo.style";
import { getServos, putStatusServo } from "../../services/servos/servos";
import {
  getFrequenciaServos,
  FrequenciaServoResumo,
} from "../../services/frequencia/frequencia";
import Header from "../../../components/Header";
import { Cores } from "@/constants/theme";
import { STATUS_CORES, corDaFrequencia } from "@/constants/frequencia";
import { useAuth } from "../../context/AuthContext";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Servo {
  id: number;
  nome: string;
  telefone: string | null;
  status: string | null;
  ano_ingresso: number | null;
  pastas: string[];
}

type FaixaFreq = "boa" | "regular" | "critica";

// Faixas do filtro: boa ≥ 75%, regular ≥ 50%, crítica abaixo disso
const FAIXAS_FREQ: { value: FaixaFreq; label: string; indicator: string }[] = [
  { value: "boa", label: "Boa", indicator: STATUS_CORES.Presente.forte },
  { value: "regular", label: "Regular", indicator: STATUS_CORES.Justificada.forte },
  { value: "critica", label: "Crítica", indicator: STATUS_CORES.Falta.forte },
];

// ─── Sub-componente: detalhes expandidos de um servo ──────────────────────────

function ServoDetalhes({
  servo,
  resumo,
  onAlterarStatus,
}: {
  servo: Servo;
  resumo: FrequenciaServoResumo | null;
  onAlterarStatus?: () => void; // só para quem pode inativar/reativar
}) {
  const percentual = resumo?.percentual_presenca ?? null;
  const cor = corDaFrequencia(percentual);
  const total = resumo
    ? resumo.presente + resumo.justificada + resumo.falta
    : 0;

  return (
    <View>
      {/* Barra de frequência */}
      <View style={styles.barraWrap}>
        <View style={styles.barraRow}>
          <Text style={styles.barraLabel}>Frequência em {new Date().getFullYear()}</Text>
          <Text style={[styles.barraValor, { color: cor.texto }]}>
            {percentual !== null ? `${percentual}%` : "Sem dados"}
          </Text>
        </View>
        <View style={styles.barraFundo}>
          <View
            style={[
              styles.barraPreenchimento,
              {
                width: `${percentual ?? 0}%`,
                backgroundColor: cor.forte,
              },
            ]}
          />
        </View>
      </View>

      {/* Mini contadores P / J / F */}
      {resumo && total > 0 && (
        <View style={styles.contadores}>
          {[
            { label: "Presentes", val: resumo.presente, cor: STATUS_CORES.Presente },
            { label: "Justificadas", val: resumo.justificada, cor: STATUS_CORES.Justificada },
            { label: "Faltas", val: resumo.falta, cor: STATUS_CORES.Falta },
          ].map((item) => (
            <View
              key={item.label}
              style={[styles.contadorCard, { backgroundColor: item.cor.fundo }]}
            >
              <Text style={[styles.contadorNum, { color: item.cor.texto }]}>
                {item.val}
              </Text>
              <Text style={[styles.contadorLabel, { color: item.cor.texto }]}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Dados do servo */}
      <View style={styles.dadosBox}>
        {servo.telefone ? (
          <View style={styles.dadosRow}>
            <Text style={styles.dadosKey}>Telefone</Text>
            <Text style={styles.dadosValue}>{servo.telefone}</Text>
          </View>
        ) : null}

        <View style={styles.dadosRow}>
          <Text style={styles.dadosKey}>Ano de ingresso</Text>
          <Text style={styles.dadosValue}>
            {servo.ano_ingresso && servo.ano_ingresso > 0
              ? servo.ano_ingresso
              : "—"}
          </Text>
        </View>

        {total > 0 && (
          <View style={styles.dadosRow}>
            <Text style={styles.dadosKey}>Missões registradas</Text>
            <Text style={styles.dadosValue}>{total}</Text>
          </View>
        )}

        <View style={[styles.dadosRow, styles.dadosRowLast]}>
          <Text style={styles.dadosKey}>Pastas</Text>
          <Text style={styles.dadosValue}>
            {servo.pastas && servo.pastas.length > 0
              ? servo.pastas.join(", ")
              : "Sem pasta"}
          </Text>
        </View>
      </View>

      {onAlterarStatus && (
        servo.status === "Inativo" ? (
          <TouchableOpacity style={styles.btnReativar} onPress={onAlterarStatus} activeOpacity={0.7}>
            <Ionicons name="refresh" size={16} color={Cores.primaria} />
            <Text style={styles.btnReativarText}>Reativar servo</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btnInativar} onPress={onAlterarStatus} activeOpacity={0.7}>
            <Ionicons name="person-remove-outline" size={16} color={STATUS_CORES.Falta.texto} />
            <Text style={styles.btnInativarText}>Inativar servo</Text>
          </TouchableOpacity>
        )
      )}
    </View>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ServosScreen() {
  const [servos, setServos] = useState<Servo[]>([]);
  const [frequencias, setFrequencias] = useState<
    Record<number, FrequenciaServoResumo>
  >({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();

  // Inativação: servo escolhido, motivo (opcional) e envio
  const [servoInativar, setServoInativar] = useState<Servo | null>(null);
  const [motivo, setMotivo] = useState("");
  const [salvandoStatus, setSalvandoStatus] = useState(false);

  // Novos estados para busca e filtros
  const [searchText, setSearchText] = useState("");
  // Faixas de frequência selecionadas (vazio = todas)
  const [filterFreq, setFilterFreq] = useState<FaixaFreq[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  // Modal de filtro
  const [modalVisible, setModalVisible] = useState(false);
  const [tempFreq, setTempFreq] = useState(filterFreq);
  const [tempStatus, setTempStatus] = useState(filterStatus);

  useEffect(() => {
    async function carregar() {
      try {
        const [servosData, freqData] = await Promise.all([
          getServos(),
          getFrequenciaServos(),
        ]);

        let servosArray: Servo[] = [];
        if (Array.isArray(servosData)) {
          servosArray = servosData;
        } else if (
          servosData &&
          typeof servosData === "object" &&
          "data" in servosData &&
          Array.isArray((servosData as any).data)
        ) {
          servosArray = (servosData as any).data;
        }
        setServos(servosArray);

        const freqMap: Record<number, FrequenciaServoResumo> = {};
        const freqList =
          freqData &&
          typeof freqData === "object" &&
          "data" in freqData &&
          Array.isArray((freqData as any).data)
            ? (freqData as any).data
            : Array.isArray(freqData)
            ? freqData
            : [];

        freqList.forEach((f: any) => {
          freqMap[Number(f.id_servo)] = f;
        });
        setFrequencias(freqMap);
      } catch (error) {
        console.error("Erro ao carregar servos:", error);
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, []);

  // Filtragem combinada (busca + filtros)
  const filteredServos = useMemo(() => {
    let result = servos;

    // Busca textual
    if (searchText.trim().length > 0) {
      const normalizedSearch = searchText
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      result = result.filter((s) =>
        s.nome
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .includes(normalizedSearch)
      );
    }

    // Filtro de frequência
    if (filterFreq.length > 0) {
      result = result.filter((s) => {
        const freq = frequencias[s.id]?.percentual_presenca;
        if (freq === null || freq === undefined) return false;
        const faixa: FaixaFreq = freq >= 75 ? "boa" : freq >= 50 ? "regular" : "critica";
        return filterFreq.includes(faixa);
      });
    }

    // Filtro de status
    if (filterStatus !== "todos") {
      result = result.filter((s) => s.status === filterStatus);
    }

    return result;
  }, [servos, searchText, filterFreq, filterStatus, frequencias]);

  const toggleExpand = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const salvarStatus = useCallback(
    async (servo: Servo, status: "Ativo" | "Inativo", motivoSaida?: string) => {
      setSalvandoStatus(true);
      try {
        await putStatusServo(servo.id, status, motivoSaida?.trim());
        setServos((prev) => prev.map((s) => (s.id === servo.id ? { ...s, status } : s)));
        setServoInativar(null);
      } catch (err: any) {
        Alert.alert("Erro", err?.message || "Não foi possível alterar o status.");
      } finally {
        setSalvandoStatus(false);
      }
    },
    []
  );

  // Inativar pede o motivo no modal; reativar só confirma
  const alterarStatus = useCallback(
    (servo: Servo) => {
      if (servo.status === "Inativo") {
        Alert.alert(
          "Reativar servo",
          `${servo.nome} volta para a chamada e recupera o acesso ao app.`,
          [
            { text: "Cancelar", style: "cancel" },
            { text: "Reativar", onPress: () => salvarStatus(servo, "Ativo") },
          ]
        );
        return;
      }
      setMotivo("");
      setServoInativar(servo);
    },
    [salvarStatus]
  );

  function getInitials(nome: string) {
    return nome
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0].toUpperCase())
      .join("");
  }

  const renderItem = useCallback(
    ({ item }: { item: Servo }) => {
      const isExpanded = expandedId === item.id;
      const resumo = frequencias[item.id] ?? null;
      const percentual = resumo?.percentual_presenca ?? null;
      const cor = corDaFrequencia(percentual);
      const inativo = item.status === "Inativo";
      return (
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.cardHeader}
            onPress={() => toggleExpand(item.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.avatar, inativo && styles.avatarInativo]}>
              <Text style={[styles.avatarText, inativo && styles.avatarTextInativo]}>
                {getInitials(item.nome)}
              </Text>
            </View>

            <View style={styles.cardInfo}>
              <View style={styles.cardNomeRow}>
                <Text
                  style={[styles.cardNome, inativo && styles.cardNomeInativo]}
                  numberOfLines={1}
                >
                  {item.nome}
                </Text>
                {inativo && (
                  <View style={styles.tagInativo}>
                    <Text style={styles.tagInativoText}>Inativo</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardPastas} numberOfLines={1}>
                {item.pastas && item.pastas.length > 0
                  ? item.pastas.join(" · ")
                  : "Sem pasta"}
              </Text>
            </View>

            {percentual !== null && (
              <View style={[styles.freqPill, { backgroundColor: cor.fundo }]}>
                <Text style={[styles.freqPillText, { color: cor.texto }]}>
                  {percentual}%
                </Text>
              </View>
            )}

            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={Cores.iconeInativo}
              style={styles.chevron}
            />
          </TouchableOpacity>

          {isExpanded && (
            <View style={styles.details}>
              <ServoDetalhes
                servo={item}
                resumo={resumo}
                onAlterarStatus={isAdmin ? () => alterarStatus(item) : undefined}
              />
            </View>
          )}
        </View>
      );
    },
    [expandedId, toggleExpand, frequencias, isAdmin, alterarStatus]
  );

  // Controle do modal de filtro
  const openModal = () => {
    setTempFreq(filterFreq);
    setTempStatus(filterStatus);
    setModalVisible(true);
  };
  const closeModal = () => setModalVisible(false);

  const applyFilters = () => {
    setFilterFreq(tempFreq);
    setFilterStatus(tempStatus);
    closeModal();
  };

  const clearFilters = () => {
    setTempFreq([]);
    setTempStatus("todos");
  };

  // Marca/desmarca uma faixa; com as três marcadas volta para "Todas"
  const toggleTempFreq = (faixa: FaixaFreq) => {
    setTempFreq((prev) => {
      const next = prev.includes(faixa)
        ? prev.filter((f) => f !== faixa)
        : [...prev, faixa];
      return next.length === FAIXAS_FREQ.length ? [] : next;
    });
  };

  // Chips de filtros ativos
  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    FAIXAS_FREQ.filter((f) => filterFreq.includes(f.value)).forEach((f) => {
      chips.push({
        key: `freq-${f.value}`,
        label: f.label,
        onRemove: () =>
          setFilterFreq((prev) => prev.filter((v) => v !== f.value)),
      });
    });
    if (filterStatus !== "todos") {
      chips.push({
        key: "status",
        label: filterStatus === "Ativo" ? "Ativo" : "Inativo",
        onRemove: () => setFilterStatus("todos"),
      });
    }
    return chips;
  }, [filterFreq, filterStatus]);

  const isAnyFilterActive = filterFreq.length > 0 || filterStatus !== "todos";
  const activeFilterCount = filterFreq.length + (filterStatus !== "todos" ? 1 : 0);

  // Contador de servos
  const countText = useMemo(() => {
    const total = servos.length;
    const showing = filteredServos.length;
    if (
      searchText.trim().length === 0 &&
      !isAnyFilterActive
    ) {
      return `${total} servos`;
    }
    return `${showing} de ${total} servos`;
  }, [servos, filteredServos, searchText, isAnyFilterActive]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Cores.primaria} />
        <Text style={styles.loadingText}>Carregando servos...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <Header title="Servos" />

      {/* Barra de busca e filtro */}
      <View style={styles.searchArea}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={18} color={Cores.iconeInativo} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar servo..."
            placeholderTextColor={Cores.iconeInativo}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchText("")}
              style={styles.clearButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={Cores.iconeInativo} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.filterButton,
            isAnyFilterActive && styles.filterButtonActive,
          ]}
          onPress={openModal}
          activeOpacity={0.7}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={isAnyFilterActive ? Cores.textoSobrePrimaria : Cores.primaria}
          />
          {activeFilterCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Chips de filtros ativos */}
      {activeFilters.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsContainer}
        >
          {activeFilters.map((chip) => (
            <TouchableOpacity
              key={chip.key}
              style={styles.chip}
              onPress={chip.onRemove}
              activeOpacity={0.7}
            >
              <Text style={styles.chipLabel}>{chip.label}</Text>
              <Ionicons name="close" size={14} color={Cores.primaria} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Contador */}
      <View style={styles.counterWrap}>
        <Text style={styles.counterText}>{countText}</Text>
      </View>

      {/* Lista de servos */}
      <FlatList
        data={filteredServos}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        extraData={{ expandedId, frequencias, isAdmin }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={36} color={Cores.iconeInativo} />
            <Text style={styles.emptyStateText}>Nenhum servo encontrado</Text>
          </View>
        }
      />

      {/* Modal de filtro (bottom sheet) */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeModal}
        >
          <View />
        </TouchableOpacity>
        <View style={styles.modalContent}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtrar servos</Text>
            <TouchableOpacity onPress={closeModal} hitSlop={12}>
              <Ionicons name="close" size={22} color={Cores.textoSuave} />
            </TouchableOpacity>
          </View>

          {/* Frequência */}
          <Text style={styles.filterSectionTitle}>Frequência</Text>
          <View style={styles.filterOptionsRow}>
            <TouchableOpacity
              style={[
                styles.filterOption,
                tempFreq.length === 0 && styles.filterOptionActive,
              ]}
              onPress={() => setTempFreq([])}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterOptionText,
                  tempFreq.length === 0 && styles.filterOptionTextActive,
                ]}
              >
                Todas
              </Text>
            </TouchableOpacity>
            {FAIXAS_FREQ.map((opt) => {
              const ativo = tempFreq.includes(opt.value);
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.filterOption, ativo && styles.filterOptionActive]}
                  onPress={() => toggleTempFreq(opt.value)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.filterOptionDot,
                      { backgroundColor: opt.indicator },
                    ]}
                  />
                  <Text
                    style={[
                      styles.filterOptionText,
                      ativo && styles.filterOptionTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Status */}
          <Text style={styles.filterSectionTitle}>Status</Text>
          <View style={styles.filterOptionsRow}>
            {[
              { value: "todos", label: "Todos" },
              { value: "Ativo", label: "Ativo" },
              { value: "Inativo", label: "Inativo" },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.filterOption,
                  tempStatus === opt.value && styles.filterOptionActive,
                ]}
                onPress={() => setTempStatus(opt.value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    tempStatus === opt.value && styles.filterOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Botões do modal */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalBtnClear}
              onPress={clearFilters}
              activeOpacity={0.7}
            >
              <Text style={styles.modalBtnClearText}>Limpar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalBtnApply}
              onPress={applyFilters}
              activeOpacity={0.7}
            >
              <Text style={styles.modalBtnApplyText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de inativação (motivo opcional) */}
      <Modal
        visible={servoInativar !== null}
        animationType="slide"
        transparent
        onRequestClose={() => !salvandoStatus && setServoInativar(null)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => !salvandoStatus && setServoInativar(null)}
          >
            <View />
          </TouchableOpacity>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Inativar servo</Text>
              <TouchableOpacity
                onPress={() => setServoInativar(null)}
                disabled={salvandoStatus}
                hitSlop={12}
              >
                <Ionicons name="close" size={22} color={Cores.textoSuave} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inativarAviso}>
              <Text style={styles.inativarNome}>{servoInativar?.nome}</Text> sai da chamada a
              partir de hoje e perde o acesso ao app. O histórico fica guardado e o servo pode
              ser reativado em até 2 anos.
            </Text>

            <Text style={styles.filterSectionTitle}>Motivo (opcional)</Text>
            <TextInput
              style={styles.inativarMotivo}
              placeholder="Ex.: mudou de cidade"
              placeholderTextColor={Cores.iconeInativo}
              value={motivo}
              onChangeText={setMotivo}
              multiline
              editable={!salvandoStatus}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnClear}
                onPress={() => setServoInativar(null)}
                disabled={salvandoStatus}
                activeOpacity={0.7}
              >
                <Text style={styles.modalBtnClearText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnInativar}
                onPress={() => servoInativar && salvarStatus(servoInativar, "Inativo", motivo)}
                disabled={salvandoStatus}
                activeOpacity={0.7}
              >
                {salvandoStatus ? (
                  <ActivityIndicator color={Cores.textoSobrePrimaria} />
                ) : (
                  <Text style={styles.modalBtnApplyText}>Inativar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}