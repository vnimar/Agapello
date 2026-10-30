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
} from "react-native";
import { styles, getFreqColor } from "./Servo.style";
import { getServos } from "../../services/servos/servos";
import {
  getFrequenciaServos,
  FrequenciaServoResumo,
} from "../../services/frequencia/frequencia";
import Header from "../../../components/Header";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Servo {
  id: number;
  nome: string;
  telefone: string | null;
  status: string | null;
  ano_ingresso: number | null;
  pastas: string[];
}

// ─── Sub-componente: detalhes expandidos de um servo (inalterado) ────────────

function ServoDetalhes({
  servo,
  resumo,
}: {
  servo: Servo;
  resumo: FrequenciaServoResumo | null;
}) {
  const percentual = resumo?.percentual_presenca ?? null;
  const cor = getFreqColor(percentual);
  const total = resumo
    ? resumo.presente + resumo.justificada + resumo.falta
    : 0;

  return (
    <View>
      {/* Barra de frequência */}
      <View style={styles.barraWrap}>
        <View style={styles.barraRow}>
          <Text style={styles.barraLabel}>Frequência em {new Date().getFullYear()}</Text>
          <Text style={[styles.barraValor, { color: cor.text }]}>
            {percentual !== null ? `${percentual}%` : "Sem dados"}
          </Text>
        </View>
        <View style={styles.barraFundo}>
          <View
            style={[
              styles.barraPreenchimento,
              {
                width: `${percentual ?? 0}%`,
                backgroundColor: cor.bar,
              },
            ]}
          />
        </View>
      </View>

      {/* Mini contadores P / J / F */}
      {resumo && total > 0 && (
        <View style={styles.contadores}>
          {[
            {
              label: "Presentes",
              val: resumo.presente,
              bg: "#EAF3DE",
              col: "#3B6D11",
            },
            {
              label: "Justificadas",
              val: resumo.justificada,
              bg: "#FAEEDA",
              col: "#854F0B",
            },
            {
              label: "Faltas",
              val: resumo.falta,
              bg: "#FCEBEB",
              col: "#A32D2D",
            },
          ].map((item) => (
            <View
              key={item.label}
              style={[styles.contadorCard, { backgroundColor: item.bg }]}
            >
              <Text style={[styles.contadorNum, { color: item.col }]}>
                {item.val}
              </Text>
              <Text style={[styles.contadorLabel, { color: item.col }]}>
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

  // Novos estados para busca e filtros
  const [searchText, setSearchText] = useState("");
  const [filterFreq, setFilterFreq] = useState<string>("todas");
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
    if (filterFreq !== "todas") {
      result = result.filter((s) => {
        const freq = frequencias[s.id]?.percentual_presenca;
        if (freq === null || freq === undefined) return false;
        if (filterFreq === "boa") return freq >= 75;
        if (filterFreq === "regular") return freq >= 50 && freq < 75;
        if (filterFreq === "critica") return freq < 50;
        return true;
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
      return (
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.cardHeader}
            onPress={() => toggleExpand(item.id)}
            activeOpacity={0.7}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(item.nome)}</Text>
            </View>

            <View style={styles.cardInfo}>
              <Text style={styles.cardNome} numberOfLines={1}>
                {item.nome}
              </Text>
              <Text style={styles.cardPastas} numberOfLines={1}>
                {item.pastas && item.pastas.length > 0
                  ? item.pastas.join(" · ")
                  : "Sem pasta"}
              </Text>
            </View>

            <Text style={styles.chevron}>{isExpanded ? "˄" : "˅"}</Text>
          </TouchableOpacity>

          {isExpanded && (
            <View style={styles.details}>
              <ServoDetalhes servo={item} resumo={resumo} />
            </View>
          )}
        </View>
      );
    },
    [expandedId, toggleExpand, frequencias]
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
    setTempFreq("todas");
    setTempStatus("todos");
  };

  // Chips de filtros ativos
  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    const freqLabels: Record<string, string> = {
      boa: "Boa",
      regular: "Regular",
      critica: "Crítica",
    };
    if (filterFreq !== "todas") {
      chips.push({
        key: "freq",
        label: freqLabels[filterFreq],
        onRemove: () => setFilterFreq("todas"),
      });
    }
    if (filterStatus !== "todos") {
      chips.push({
        key: "status",
        label: filterStatus === "Ativo" ? "Ativo" : "Inativo",
        onRemove: () => setFilterStatus("todos"),
      });
    }
    return chips;
  }, [filterFreq, filterStatus]);

  const isAnyFilterActive = filterFreq !== "todas" || filterStatus !== "todos";
  const activeFilterCount = (filterFreq !== "todas" ? 1 : 0) + (filterStatus !== "todos" ? 1 : 0);

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
        <ActivityIndicator size="large" color="#1E3A8A" />
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
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar servo..."
            placeholderTextColor="#9CA3AF"
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
              <Text style={styles.clearButtonText}>✕</Text>
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
          <View style={styles.filterIconLines}>
            <View style={[styles.filterLine, isAnyFilterActive && styles.filterLineActive]} />
            <View style={[styles.filterLine, styles.filterLineShort, isAnyFilterActive && styles.filterLineActive]} />
            <View style={[styles.filterLine, styles.filterLineShorter, isAnyFilterActive && styles.filterLineActive]} />
          </View>
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
              <Text style={styles.chipClose}>✕</Text>
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
        extraData={{ expandedId, frequencias }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
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
              <Text style={styles.modalCloseButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Frequência */}
          <Text style={styles.filterSectionTitle}>Frequência</Text>
          <View style={styles.filterOptionsRow}>
            {[
              { value: "todas", label: "Todas" },
              { value: "boa", label: "Boa", indicator: "#5A9E1E" },
              {
                value: "regular",
                label: "Regular",
                indicator: "#F59E0B",
              },
              {
                value: "critica",
                label: "Crítica",
                indicator: "#E24B4A",
              },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.filterOption,
                  tempFreq === opt.value && styles.filterOptionActive,
                ]}
                onPress={() => setTempFreq(opt.value)}
                activeOpacity={0.7}
              >
                {opt.indicator && (
                  <View
                    style={[
                      styles.filterOptionDot,
                      { backgroundColor: opt.indicator },
                    ]}
                  />
                )}
                <Text
                  style={[
                    styles.filterOptionText,
                    tempFreq === opt.value && styles.filterOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
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
    </SafeAreaView>
  );
}