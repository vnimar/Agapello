import { Platform, StyleSheet } from "react-native";
import { Cores } from "@/constants/theme";

// Usado por Importar pastas e Usuários (ainda no visual antigo)
export const AZUL_AGAPELLO = "#043673";

const sombra = {
  shadowColor: Cores.sombra,
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

// Login, Meu perfil e Crie sua senha (paleta Cores)
export const authStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: "center",
  },
  // No fluxo (sem position absolute) para respeitar a área segura
  // e não ficar embaixo da barra de status
  fechar: {
    alignSelf: "flex-end",
    marginTop: 4,
    marginRight: 12,
    padding: 8,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 22,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: Cores.marinho,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: Cores.textoSuave,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 24,
  },
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
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize: 15,
    color: Cores.texto,
  },
  // Campo com ícone à esquerda (e botão à direita na senha)
  campo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Cores.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Cores.borda,
    paddingHorizontal: 14,
  },
  campoIcone: {
    marginRight: 10,
  },
  campoInput: {
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize: 15,
    color: Cores.texto,
  },
  campoAcao: {
    paddingLeft: 10,
    paddingVertical: 6,
  },
  btnPrimary: {
    backgroundColor: Cores.primaria,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 24,
  },
  btnPrimaryText: {
    color: Cores.textoSobrePrimaria,
    fontSize: 16,
    fontWeight: "600",
  },
  btnSecondary: {
    backgroundColor: Cores.primariaSuave,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 12,
  },
  btnSecondaryText: {
    color: Cores.marinho,
    fontSize: 15,
    fontWeight: "600",
  },
  btnDanger: {
    backgroundColor: "#FCEBEB",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 20,
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
    color: Cores.textoSuave,
    textAlign: "center",
    marginTop: 20,
  },

  // ── Conta ──
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Cores.marinho,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  avatarText: {
    color: Cores.textoSobrePrimaria,
    fontSize: 28,
    fontWeight: "700",
  },
  card: {
    backgroundColor: Cores.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Cores.borda,
    padding: 16,
    marginTop: 16,
    ...sombra,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: Cores.borda,
  },
  cardRowLast: {
    borderBottomWidth: 0,
  },
  cardKey: {
    fontSize: 14,
    color: Cores.textoSuave,
  },
  cardValue: {
    fontSize: 14,
    color: Cores.texto,
    fontWeight: "500",
    flexShrink: 1,
    textAlign: "right",
    marginLeft: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Cores.texto,
    marginBottom: 4,
  },
  // Linha de ação (ícone + texto + seta), como num menu de ajustes
  acao: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Cores.borda,
  },
  acaoIcone: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Cores.primariaSuave,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  acaoTexto: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: Cores.texto,
  },
});
