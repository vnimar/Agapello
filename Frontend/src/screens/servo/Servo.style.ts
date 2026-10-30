import { StyleSheet, Platform } from "react-native";

// ─── Cores por frequência ──────────────────────────────────────────────────

export const FREQ_VERDE = {
  bg: "#EAF3DE",
  text: "#3B6D11",
  bar: "#639922",
  label: "Boa",
};

export const FREQ_AMARELO = {
  bg: "#FAEEDA",
  text: "#854F0B",
  bar: "#BA7517",
  label: "Regular",
};

export const FREQ_VERMELHO = {
  bg: "#FCEBEB",
  text: "#A32D2D",
  bar: "#E24B4A",
  label: "Crítica",
};

// Função unificada (aceita null e limites 75/50)
export const getFreqColor = (value: number | null) => {
  if (value === null)
    return { background: "#F3F4F6", text: "#9CA3AF", bar: "#D1D5DB" };
  if (value >= 75)
    return { background: "#EAF3DE", text: "#3B6D11", bar: "#5A9E1E" };
  if (value >= 50)
    return { background: "#FFF6E5", text: "#854F0B", bar: "#F59E0B" };
  return { background: "#FCEBEB", text: "#A32D2D", bar: "#E24B4A" };
};

// ─── Estilos globais ──────────────────────────────────────────────────────

export const styles = StyleSheet.create({
  // Layout base
  safeArea: {
    flex: 1,
    backgroundColor: "#F8F9FB",
  },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FB",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#888",
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 8,
  },

  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1E3A8A",
    marginTop: 2,
  },

  logo: {
    width: 44,
    height: 44,
    resizeMode: "contain",
    borderRadius: 10,
  },

  // ─── NOVO: Barra de busca e filtro ──────────────────────────────────────
  searchArea: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },

  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    height: 42,
  },

  searchIcon: {
    fontSize: 15,
    color: "#9CA3AF",
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1F2937",
    paddingVertical: 0,
    includeFontPadding: false,
  },

  clearButton: {
    paddingLeft: 4,
  },

  clearButtonText: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "600",
  },

  filterButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },

  filterButtonActive: {
    backgroundColor: "#1E3A8A",
    borderColor: "#1E3A8A",
  },

  filterIconLines: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },

  filterLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#6B7280",
  },

  filterLineShort: {
    width: 11,
  },

  filterLineShorter: {
    width: 6,
  },

  filterLineActive: {
    backgroundColor: "#FFFFFF",
  },

  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },

  badgeText: {
    fontSize: 9,
    color: "#FFFFFF",
    fontWeight: "700",
  },

  // Chips de filtros ativos
  chipsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 6,
  },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },

  chipLabel: {
    fontSize: 12,
    color: "#1E3A8A",
    fontWeight: "500",
    marginRight: 5,
  },

  chipClose: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1E3A8A",
  },

  // Contador
  counterWrap: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },

  counterText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
  },

  // ─── MODAL (bottom sheet) ───────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: "70%",
  },

  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 20,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },

  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },

  modalCloseButton: {
    fontSize: 16,
    color: "#6B7280",
    padding: 4,
  },

  filterSectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 12,
  },

  filterOptionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },

  filterOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },

  filterOptionActive: {
    backgroundColor: "#1E3A8A",
    borderColor: "#1E3A8A",
  },

  filterOptionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },

  filterOptionText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
  },

  filterOptionTextActive: {
    color: "#FFFFFF",
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },

  modalBtnClear: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },

  modalBtnClearText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },

  modalBtnApply: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#1E3A8A",
    alignItems: "center",
  },

  modalBtnApplyText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "600",
  },

  // ─── Cards e detalhes ─────────────────────────────
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },

  cardNome: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0C447C",
  },

  cardPastas: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },

  chevron: {
    fontSize: 18,
    color: "#9CA3AF",
    marginLeft: 8,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  avatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E3A8A",
  },

  details: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 0.5,
    borderTopColor: "#F3F4F6",
  },

  barraWrap: {
    marginTop: 12,
    marginBottom: 10,
  },

  barraRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  barraLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },

  barraValor: {
    fontSize: 13,
    fontWeight: "700",
  },

  barraFundo: {
    height: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 3,
    overflow: "hidden",
  },

  barraPreenchimento: {
    height: 6,
    borderRadius: 3,
  },

  contadores: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },

  contadorCard: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },

  contadorNum: {
    fontSize: 18,
    fontWeight: "700",
  },

  contadorLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: "500",
  },

  dadosBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  dadosRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
  },

  dadosRowLast: {
    borderBottomWidth: 0,
  },

  dadosKey: {
    fontSize: 13,
    color: "#6B7280",
  },

  dadosValue: {
    fontSize: 13,
    color: "#1F2937",
    fontWeight: "500",
    maxWidth: "60%",
    textAlign: "right",
  },

  inlineLoading: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
  },

  inlineLoadingText: {
    fontSize: 13,
    color: "#9CA3AF",
  },
});