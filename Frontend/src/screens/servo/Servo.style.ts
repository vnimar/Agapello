import { StyleSheet } from "react-native";
import { Cores } from "@/constants/theme";

// ─── Estilos globais ──────────────────────────────────────────────────────

export const styles = StyleSheet.create({
  // Layout base
  safeArea: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Cores.fundo,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Cores.textoSuave,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 8,
  },

  // ─── Barra de busca e filtro ────────────────────────────────────────────
  searchArea: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },

  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Cores.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Cores.borda,
    paddingHorizontal: 12,
    height: 46,
  },

  searchIcon: {
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Cores.texto,
    paddingVertical: 0,
    includeFontPadding: false,
  },

  clearButton: {
    paddingLeft: 4,
  },

  filterButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Cores.primariaSuave,
    alignItems: "center",
    justifyContent: "center",
  },

  filterButtonActive: {
    backgroundColor: Cores.primaria,
  },

  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Cores.marinho,
    borderWidth: 2,
    borderColor: Cores.fundo,
    alignItems: "center",
    justifyContent: "center",
  },

  badgeText: {
    fontSize: 9,
    color: Cores.textoSobrePrimaria,
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
    gap: 4,
    backgroundColor: Cores.primariaSuave,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },

  chipLabel: {
    fontSize: 13,
    color: Cores.primaria,
    fontWeight: "600",
  },

  // Contador
  counterWrap: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },

  counterText: {
    fontSize: 13,
    color: Cores.textoSuave,
    fontWeight: "500",
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 10,
  },

  emptyStateText: {
    fontSize: 15,
    color: Cores.textoSuave,
  },

  // ─── MODAL (bottom sheet) ───────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(27,43,94,0.45)",
  },

  modalContent: {
    backgroundColor: Cores.card,
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
    backgroundColor: Cores.borda,
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
    fontSize: 18,
    fontWeight: "700",
    color: Cores.texto,
  },

  filterSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Cores.textoSuave,
    letterSpacing: 1,
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
    borderColor: Cores.borda,
    backgroundColor: Cores.card,
  },

  filterOptionActive: {
    backgroundColor: Cores.primaria,
    borderColor: Cores.primaria,
  },

  filterOptionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },

  filterOptionText: {
    fontSize: 14,
    color: Cores.texto,
    fontWeight: "500",
  },

  filterOptionTextActive: {
    color: Cores.textoSobrePrimaria,
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },

  modalBtnClear: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Cores.primariaSuave,
    alignItems: "center",
  },

  modalBtnClearText: {
    fontSize: 15,
    color: Cores.primaria,
    fontWeight: "600",
  },

  modalBtnApply: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Cores.primaria,
    alignItems: "center",
  },

  modalBtnApplyText: {
    fontSize: 15,
    color: Cores.textoSobrePrimaria,
    fontWeight: "600",
  },

  // ─── Cards e detalhes ─────────────────────────────
  card: {
    backgroundColor: Cores.card,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Cores.borda,
    overflow: "hidden",
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

  cardNomeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  cardNome: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "600",
    color: Cores.texto,
  },

  cardNomeInativo: {
    color: Cores.textoSuave,
  },

  tagInativo: {
    backgroundColor: "#EEF1F6",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },

  tagInativoText: {
    fontSize: 11,
    fontWeight: "600",
    color: Cores.textoSuave,
  },

  cardPastas: {
    fontSize: 13,
    color: Cores.textoSuave,
    marginTop: 2,
  },

  freqPill: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },

  freqPillText: {
    fontSize: 13,
    fontWeight: "700",
  },

  chevron: {
    marginLeft: 8,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Cores.primariaSuave,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  avatarInativo: {
    backgroundColor: "#EEF1F6",
  },

  avatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: Cores.primaria,
  },

  avatarTextInativo: {
    color: Cores.iconeInativo,
  },

  details: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: Cores.primariaSuave,
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
    fontSize: 13,
    color: Cores.textoSuave,
    fontWeight: "500",
  },

  barraValor: {
    fontSize: 14,
    fontWeight: "700",
  },

  barraFundo: {
    height: 8,
    backgroundColor: Cores.primariaSuave,
    borderRadius: 4,
    overflow: "hidden",
  },

  barraPreenchimento: {
    height: 8,
    borderRadius: 4,
  },

  contadores: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },

  contadorCard: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },

  contadorNum: {
    fontSize: 18,
    fontWeight: "700",
  },

  contadorLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },

  dadosBox: {
    backgroundColor: Cores.fundo,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  dadosRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Cores.primariaSuave,
  },

  dadosRowLast: {
    borderBottomWidth: 0,
  },

  dadosKey: {
    fontSize: 14,
    color: Cores.textoSuave,
  },

  dadosValue: {
    fontSize: 14,
    color: Cores.texto,
    fontWeight: "500",
    maxWidth: "60%",
    textAlign: "right",
  },
});
