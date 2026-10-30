import { Platform, StyleSheet } from "react-native";
import { Cores } from "@/constants/theme";

export const adminStyles = StyleSheet.create({
  // ── Folha ──
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(27,43,94,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Cores.fundo,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    maxHeight: "90%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Cores.borda,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: Cores.marinho,
    marginBottom: 4,
  },

  // ── Campos ──
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Cores.textoSuave,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Cores.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Cores.borda,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    fontSize: 15,
    color: Cores.texto,
  },
  inputMultiline: {
    minHeight: 76,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  rowItem: {
    flex: 1,
  },
  chips: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Cores.card,
    borderWidth: 1,
    borderColor: Cores.borda,
  },
  chipActive: {
    backgroundColor: Cores.primariaSuave,
    borderColor: Cores.primaria,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "500",
    color: Cores.textoSuave,
  },
  chipTextActive: {
    color: Cores.primaria,
    fontWeight: "700",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    backgroundColor: Cores.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Cores.borda,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 15,
    color: Cores.texto,
  },

  // ── Botões ──
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: Cores.primaria,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnPrimaryText: {
    color: Cores.textoSobrePrimaria,
    fontSize: 15,
    fontWeight: "700",
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: Cores.primariaSuave,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnSecondaryText: {
    color: Cores.marinho,
    fontSize: 15,
    fontWeight: "600",
  },
  btnDanger: {
    flex: 1,
    backgroundColor: "#FCEBEB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnDangerText: {
    color: "#A32D2D",
    fontSize: 15,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  linkFechar: {
    alignSelf: "center",
    paddingTop: 12,
  },
  linkFecharText: {
    fontSize: 14,
    color: Cores.textoSuave,
  },
});
