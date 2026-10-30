import { StyleSheet, Platform } from "react-native";
import { Cores } from "@/constants/theme";
import { STATUS_CORES } from "@/constants/frequencia";

export const styles = StyleSheet.create({
  // ── Container principal ──
  safeArea: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },

  // ── Card da missão ──
  missaoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    padding: 14,
    backgroundColor: Cores.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Cores.borda,
  },

  missaoIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Cores.primariaSuave,
    alignItems: "center",
    justifyContent: "center",
  },

  missaoBody: {
    flex: 1,
  },

  missaoTitulo: {
    fontSize: 16,
    fontWeight: "700",
    color: Cores.texto,
    marginBottom: 3,
  },

  missaoInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  missaoData: {
    flexShrink: 1,
    fontSize: 14,
    color: Cores.textoSuave,
  },

  selo: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },

  seloTexto: {
    fontSize: 12,
    fontWeight: "600",
  },

  // ── Busca ──
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Cores.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Cores.borda,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 46,
    gap: 8,
  },

  searchContainerModal: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 8,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Cores.texto,
    paddingVertical: 0, // remove padding vertical padrão do Android
  },

  listaTopo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 8,
  },

  searchCount: {
    fontSize: 13,
    color: Cores.textoSuave,
    fontWeight: "500",
  },

  todosBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Cores.primariaSuave,
  },

  todosBtnFeito: {
    backgroundColor: STATUS_CORES.Presente.fundo,
  },

  todosBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Cores.primaria,
  },

  todosBtnTextFeito: {
    color: STATUS_CORES.Presente.texto,
  },

  // ── Estado vazio ──
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  emptyStateText: {
    fontSize: 16,
    color: Cores.texto,
    fontWeight: "600",
    marginTop: 8,
  },

  emptyStateSubtext: {
    fontSize: 14,
    color: Cores.textoSuave,
  },

  // ── Lista (num card branco) ──
  lista: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Cores.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Cores.borda,
  },

  listContent: {
    paddingVertical: 4,
  },

  separator: {
    height: 1,
    backgroundColor: Cores.primariaSuave,
    marginLeft: 66,
  },

  // ── Linha de servo ──
  servoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Cores.primariaSuave,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },

  avatarText: {
    fontSize: 13,
    fontWeight: "700",
    color: Cores.primaria,
  },

  servoNome: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: Cores.texto,
  },

  statusButtons: {
    flexDirection: "row",
    gap: 6,
  },

  statusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Cores.borda,
    backgroundColor: Cores.card,
  },

  // Frequência já registrada (fora do modo edição): só o status marcado aparece forte
  statusBtnBloqueado: {
    opacity: 0.4,
  },

  statusBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Cores.iconeInativo,
  },

  // ── Footer e Botões ──
  footer: {
    backgroundColor: Cores.card,
    borderTopWidth: 1,
    borderTopColor: Cores.borda,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
  },

  counters: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },

  counterCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 5,
    borderRadius: 10,
    paddingVertical: 8,
  },

  counterNum: {
    fontSize: 18,
    fontWeight: "700",
  },

  counterLabel: {
    fontSize: 12,
    fontWeight: "500",
  },

  actionButtons: {
    flexDirection: "row",
    gap: 10,
  },

  btnConfirmar: {
    backgroundColor: Cores.primaria,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },

  btnConfirmarFlex: {
    flex: 2,
  },

  btnConfirmarText: {
    color: Cores.textoSobrePrimaria,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    includeFontPadding: false,
  },

  btnAtualizar: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: Cores.primariaSuave,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  btnAtualizarText: {
    color: Cores.primaria,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },

  btnCancelar: {
    flex: 1,
    backgroundColor: Cores.primariaSuave,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  btnCancelarText: {
    color: Cores.primaria,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },

  btnDisabled: {
    opacity: 0.6,
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(27,43,94,0.45)",
    justifyContent: "flex-end",
  },

  modalSheet: {
    backgroundColor: Cores.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    maxHeight: "70%",
  },

  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Cores.borda,
    alignSelf: "center",
    marginBottom: 16,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Cores.texto,
    marginBottom: 16,
  },

  missaoItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Cores.primariaSuave,
  },

  missaoItemSelected: {
    backgroundColor: Cores.primariaSuave,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },

  missaoItemBody: {
    flex: 1,
  },

  missaoItemTopo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  missaoItemData: {
    fontSize: 15,
    fontWeight: "600",
    color: Cores.texto,
  },

  tagHoje: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: Cores.primaria,
  },

  tagHojeText: {
    fontSize: 11,
    fontWeight: "600",
    color: Cores.textoSobrePrimaria,
  },

  missaoItemDesc: {
    fontSize: 13,
    color: Cores.textoSuave,
    marginTop: 2,
  },

  missaoEmpty: {
    fontSize: 14,
    color: Cores.textoSuave,
    textAlign: "center",
    paddingVertical: 24,
  },
});
