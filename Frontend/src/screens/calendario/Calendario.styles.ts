import { StyleSheet } from "react-native";
import { Cores } from "@/constants/theme";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Cores.fundo,
  },

  /* Cabeçalho */
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  editModeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Cores.primaria,
  },
  editModeButtonActive: {
    backgroundColor: Cores.primaria,
  },
  editModeText: {
    fontSize: 13,
    fontWeight: "600",
    color: Cores.primaria,
  },
  editModeTextActive: {
    color: Cores.textoSobrePrimaria,
  },

  /* Card do calendário */
  calendarCard: {
    marginHorizontal: 16,
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Cores.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Cores.borda,
  },
  navigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  navButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Cores.primariaSuave,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Cores.texto,
    textTransform: "capitalize",
  },
  weekHeader: {
    flexDirection: "row",
    marginBottom: 4,
  },
  weekDay: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
    color: Cores.textoSuave,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: "center",
    paddingVertical: 3,
  },
  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  todayCircle: {
    borderWidth: 1.5,
    borderColor: Cores.primaria,
  },
  selectedCircle: {
    backgroundColor: Cores.primaria,
    borderWidth: 0,
  },
  dayText: {
    fontSize: 15,
    fontWeight: "500",
    color: Cores.texto,
  },
  otherMonthText: {
    color: "#C3CCDA",
  },
  missionDayText: {
    fontWeight: "700",
    color: Cores.primaria,
  },
  todayText: {
    color: Cores.primaria,
    fontWeight: "700",
  },
  selectedDayText: {
    color: Cores.textoSobrePrimaria,
    fontWeight: "700",
  },
  // Ponto embaixo do dia que tem missão (fica vazio nos outros para não desalinhar)
  missionDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 3,
  },
  missionDotOn: {
    backgroundColor: Cores.primaria,
  },
  missionDotOtherMonth: {
    opacity: 0.35,
  },
  todayButton: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 4,
    marginBottom: 4,
    borderRadius: 16,
    backgroundColor: Cores.primariaSuave,
  },
  todayButtonText: {
    color: Cores.primaria,
    fontWeight: "600",
    fontSize: 13,
  },

  /* Missões do dia */
  missionsSection: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  missionsSectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Cores.texto,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  missionCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: Cores.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Cores.borda,
  },
  missionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Cores.primariaSuave,
    alignItems: "center",
    justifyContent: "center",
  },
  missionBody: {
    flex: 1,
  },
  missionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  missionDescription: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "600",
    color: Cores.texto,
    marginBottom: 6,
  },
  missionEditHint: {
    fontSize: 13,
    color: Cores.primaria,
    fontWeight: "500",
  },
  missionDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  missionDetailText: {
    flexShrink: 1,
    fontSize: 14,
    color: Cores.textoSuave,
  },
  missionObservacao: {
    fontSize: 13,
    color: "#854F0B",
    backgroundColor: "#FAEEDA",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
  },
  emptyMissions: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 10,
    backgroundColor: Cores.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Cores.borda,
  },
  emptyMissionsText: {
    fontSize: 15,
    color: Cores.textoSuave,
  },
  nextMissionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Cores.primariaSuave,
  },
  nextMissionText: {
    flexShrink: 1,
    color: Cores.primaria,
    fontWeight: "600",
    fontSize: 14,
  },
  addMissionButton: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Cores.primaria,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  addMissionText: {
    fontSize: 15,
    fontWeight: "600",
    color: Cores.primaria,
  },
});
