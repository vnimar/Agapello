import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { styles } from "./Calendario.styles";
import { getMissoes, Missao } from "../../services/missao/missao";
import { MissaoEditModal } from "./CalendarioAdmin";
import { useAuth } from "../../context/AuthContext";
import Header, { headerStyles } from '../../../components/Header';
import { Cores } from "@/constants/theme";
import { ICONE_PUBLICO } from "@/constants/missao";

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

// Helper: formata data para YYYY-MM-DD no fuso do aparelho
// (toISOString usa UTC: depois das 21h no Brasil cairia no dia seguinte)
const formatDateKey = (date: Date): string => {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
};

// "2026-11-15" → Date local (new Date("2026-11-15") seria meia-noite UTC)
const parseDateKey = (key: string): Date => {
  const [ano, mes, dia] = key.slice(0, 10).split("-").map(Number);
  return new Date(ano, mes - 1, dia);
};

const tituloDoDia = (date: Date) => {
  const texto = date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

// Retorna os dias do mês (array de objetos com info do dia)
const getDaysInMonth = (year: number, month: number) => {
  const firstDayOfMonth = new Date(year, month, 1);
  const startWeekday = firstDayOfMonth.getDay(); // 0 = domingo
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const daysArray = [];
  // Dias do mês anterior para completar a primeira semana
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startWeekday - 1; i >= 0; i--) {
    daysArray.push({
      date: new Date(year, month - 1, prevMonthDays - i),
      isCurrentMonth: false,
    });
  }
  // Dias do mês atual
  for (let i = 1; i <= daysInMonth; i++) {
    daysArray.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }
  // Dias do próximo mês para completar 42 (6 linhas)
  const remaining = 42 - daysArray.length;
  for (let i = 1; i <= remaining; i++) {
    daysArray.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }
  return daysArray;
};

export default function CalendarioScreen() {
  const router = useRouter();
  // A Home abre o calendário já no dia de uma missão (?data=YYYY-MM-DD)
  const { data: dataParam } = useLocalSearchParams<{ data?: string }>();

  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [missionsByDate, setMissionsByDate] = useState<Map<string, Missao[]>>(
    new Map()
  );

  // Modo de edição: só administrador/coord. geral
  const { isAdmin } = useAuth();
  const [modoEdicao, setModoEdicao] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [missaoEditando, setMissaoEditando] = useState<Missao | null>(null);

  const carregar = useCallback(async () => {
    try {
      const data = await getMissoes();
      setMissoes(data);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!dataParam) return;
    irPara(parseDateKey(dataParam));
    // Limpa o parâmetro para o mesmo dia poder ser aberto de novo pela Home
    router.setParams({ data: undefined });
  }, [dataParam, router]);

  // Saiu da conta de administrador → fecha o modo de edição
  useEffect(() => {
    if (!isAdmin) setModoEdicao(false);
  }, [isAdmin]);

  const abrirEdicao = (missao: Missao | null) => {
    setMissaoEditando(missao);
    setEditVisible(true);
  };

  const aoSalvar = () => {
    setEditVisible(false);
    carregar();
  };

  // Agrupar missões por data
  useEffect(() => {
    const map = new Map<string, Missao[]>();
    missoes.forEach((missao) => {
      const dateKey = missao.data;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(missao);
    });
    setMissionsByDate(map);
  }, [missoes]);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const days = getDaysInMonth(currentYear, currentMonth);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  // Mostra o mês do dia e já seleciona o dia
  function irPara(date: Date) {
    setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
    setSelectedDate(date);
  }

  const handleDayPress = (date: Date) => {
    setSelectedDate(date);
  };

  const getMissionsForDate = (date: Date): Missao[] => {
    const key = formatDateKey(date);
    return missionsByDate.get(key) || [];
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date): boolean => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const renderMissionItem = (item: Missao) => (
    <TouchableOpacity
      key={item.id_missao}
      style={styles.missionCard}
      onPress={() => abrirEdicao(item)}
      disabled={!modoEdicao}
      activeOpacity={0.7}
    >
      <View style={styles.missionIcon}>
        <Ionicons name={ICONE_PUBLICO[item.publico] ?? "calendar-outline"} size={22} color={Cores.primaria} />
      </View>
      <View style={styles.missionBody}>
        <View style={styles.missionTitleRow}>
          <Text style={styles.missionDescription}>{item.descricao}</Text>
          {modoEdicao && <Text style={styles.missionEditHint}>Editar ›</Text>}
        </View>
        <View style={styles.missionDetail}>
          <Ionicons name="time-outline" size={15} color={Cores.textoSuave} />
          <Text style={styles.missionDetailText}>{item.horario}</Text>
        </View>
        {!!item.local && (
          <View style={styles.missionDetail}>
            <Ionicons name="location-outline" size={15} color={Cores.textoSuave} />
            <Text style={styles.missionDetailText}>{item.local}</Text>
          </View>
        )}
        {item.observacao ? (
          <Text style={styles.missionObservacao}>{item.observacao}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Cores.primaria} />
      </View>
    );
  }

  const selectedMissions = getMissionsForDate(selectedDate);
  const selectedKey = formatDateKey(selectedDate);
  // Para o dia sem missão: atalho para a próxima depois dele
  const proximaDepois = missoes
    .filter((m) => m.data.slice(0, 10) > selectedKey)
    .sort((a, b) => a.data.localeCompare(b.data))[0];

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cabeçalho */}
        <Header>
          <View style={styles.headerRow}>
            <Text style={headerStyles.title}>Calendário</Text>
            {isAdmin && (
              <TouchableOpacity
                onPress={() => setModoEdicao((v) => !v)}
                style={[styles.editModeButton, modoEdicao && styles.editModeButtonActive]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.editModeText, modoEdicao && styles.editModeTextActive]}>
                  {modoEdicao ? "Editando ✓" : "Editar"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Header>

        <View style={styles.calendarCard}>
          {/* Navegação do mês */}
          <View style={styles.navigation}>
            <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton} accessibilityLabel="Mês anterior">
              <Ionicons name="chevron-back" size={20} color={Cores.primaria} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>
              {currentDate.toLocaleDateString("pt-BR", {
                month: "long",
                year: "numeric",
              })}
            </Text>
            <TouchableOpacity onPress={goToNextMonth} style={styles.navButton} accessibilityLabel="Próximo mês">
              <Ionicons name="chevron-forward" size={20} color={Cores.primaria} />
            </TouchableOpacity>
          </View>

          {/* Cabeçalho dias da semana */}
          <View style={styles.weekHeader}>
            {DIAS_SEMANA.map((day, idx) => (
              <Text key={idx} style={styles.weekDay}>
                {day}
              </Text>
            ))}
          </View>

          {/* Grid de dias */}
          <View style={styles.calendarGrid}>
            {days.map((day, index) => {
              const date = day.date;
              const hasMission = getMissionsForDate(date).length > 0;
              const isCurrentMonth = day.isCurrentMonth;
              const selected = isSelected(date);
              const today = isToday(date);

              return (
                <TouchableOpacity
                  key={index}
                  style={styles.dayCell}
                  onPress={() => handleDayPress(date)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      today && styles.todayCircle,
                      selected && styles.selectedCircle,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        !isCurrentMonth && styles.otherMonthText,
                        hasMission && styles.missionDayText,
                        today && styles.todayText,
                        selected && styles.selectedDayText,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.missionDot,
                      hasMission && styles.missionDotOn,
                      hasMission && !isCurrentMonth && styles.missionDotOtherMonth,
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {!isToday(selectedDate) && (
            <TouchableOpacity onPress={() => irPara(new Date())} style={styles.todayButton}>
              <Text style={styles.todayButtonText}>Voltar para hoje</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Missões do dia selecionado */}
        <View style={styles.missionsSection}>
          <Text style={styles.missionsSectionTitle}>{tituloDoDia(selectedDate)}</Text>
          {selectedMissions.length === 0 && (
            <View style={styles.emptyMissions}>
              <Text style={styles.emptyMissionsText}>Nenhuma missão neste dia</Text>
              {proximaDepois && (
                <TouchableOpacity
                  onPress={() => irPara(parseDateKey(proximaDepois.data))}
                  style={styles.nextMissionButton}
                >
                  <Text style={styles.nextMissionText}>
                    Próxima: {proximaDepois.descricao} · {parseDateKey(proximaDepois.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color={Cores.primaria} />
                </TouchableOpacity>
              )}
            </View>
          )}
          {selectedMissions.map(renderMissionItem)}
          {modoEdicao && (
            <TouchableOpacity style={styles.addMissionButton} onPress={() => abrirEdicao(null)}>
              <Text style={styles.addMissionText}>+ Nova missão neste dia</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <MissaoEditModal
        visible={editVisible}
        missao={missaoEditando}
        dataInicial={selectedKey}
        onClose={() => setEditVisible(false)}
        onSaved={aoSalvar}
      />
    </SafeAreaView>
  );
}
