import { Platform, StyleSheet } from "react-native";

export const AZUL_AGAPELLO = "#043673";
const TEXTO = "#1A2C3E";

export const authStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
    justifyContent: "center",
  },
  // No fluxo (sem position absolute) para respeitar a área segura
  // e não ficar embaixo da barra de status
  fechar: {
    alignSelf: "flex-end",
    marginTop: 4,
    marginRight: 16,
    padding: 8,
  },
  fecharText: {
    fontSize: 20,
    color: "#6C757D",
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: TEXTO,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#6C757D",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6C757D",
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize: 15,
    color: TEXTO,
  },
  senhaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  senhaInput: {
    flex: 1,
  },
  mostrar: {
    position: "absolute",
    right: 12,
    padding: 4,
  },
  mostrarText: {
    fontSize: 13,
    color: "#649AFA",
    fontWeight: "600",
  },
  btnPrimary: {
    backgroundColor: AZUL_AGAPELLO,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 24,
  },
  btnPrimaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  btnSecondary: {
    backgroundColor: "#F1F3F5",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 12,
  },
  btnSecondaryText: {
    color: TEXTO,
    fontSize: 15,
    fontWeight: "500",
  },
  btnDanger: {
    backgroundColor: "#FCEBEB",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 12,
  },
  btnDangerText: {
    color: "#A32D2D",
    fontSize: 15,
    fontWeight: "600",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  dica: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 20,
  },

  // ── Conta ──
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: AZUL_AGAPELLO,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F0F0F0",
  },
  cardRowLast: {
    borderBottomWidth: 0,
  },
  cardKey: {
    fontSize: 14,
    color: "#6C757D",
  },
  cardValue: {
    fontSize: 14,
    color: TEXTO,
    fontWeight: "500",
    flexShrink: 1,
    textAlign: "right",
    marginLeft: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXTO,
    marginBottom: 4,
  },
});
