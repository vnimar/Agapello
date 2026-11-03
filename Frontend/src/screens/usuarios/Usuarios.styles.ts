import { Platform, StyleSheet } from "react-native";
import { Cores } from "@/constants/theme";
import { STATUS_CORES } from "@/constants/frequencia";

const TEXTO = Cores.texto;
const CINZA = Cores.textoSuave;

const sombra = {
  shadowColor: Cores.sombra,
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },
  topo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  voltar: {
    width: 72,
    padding: 4,
  },
  titulo: {
    fontSize: 24,
    fontWeight: "800",
    color: Cores.marinho,
    letterSpacing: -0.5,
  },
  novo: {
    width: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: Cores.primaria,
    borderRadius: 18,
    paddingVertical: 7,
  },
  novoText: {
    color: Cores.textoSobrePrimaria,
    fontWeight: "600",
    fontSize: 13,
  },
  busca: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 6,
    backgroundColor: Cores.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Cores.borda,
    paddingHorizontal: 14,
  },
  buscaInput: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: 15,
    color: TEXTO,
  },
  lista: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  item: {
    backgroundColor: Cores.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Cores.borda,
    padding: 14,
    marginTop: 10,
    ...sombra,
  },
  itemInativo: {
    opacity: 0.55,
  },
  itemNome: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXTO,
  },
  itemLinha: {
    fontSize: 13,
    color: CINZA,
    marginTop: 2,
  },
  selos: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 6,
  },
  selo: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Cores.primariaSuave,
  },
  seloText: {
    fontSize: 11,
    fontWeight: "600",
    color: Cores.primaria,
  },
  seloAlerta: {
    backgroundColor: STATUS_CORES.Justificada.fundo,
  },
  seloAlertaText: {
    color: STATUS_CORES.Justificada.texto,
  },
  seloPerigo: {
    backgroundColor: STATUS_CORES.Falta.fundo,
  },
  seloPerigoText: {
    color: STATUS_CORES.Falta.texto,
  },
  vazio: {
    textAlign: "center",
    color: CINZA,
    marginTop: 40,
  },

  // ── Formulário ──
  formTitulo: {
    fontSize: 24,
    fontWeight: "800",
    color: Cores.marinho,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  opcoes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  opcao: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Cores.borda,
    backgroundColor: Cores.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  opcaoAtiva: {
    backgroundColor: Cores.primariaSuave,
    borderColor: Cores.primaria,
  },
  opcaoText: {
    fontSize: 13,
    fontWeight: "500",
    color: CINZA,
  },
  opcaoAtivaText: {
    color: Cores.primaria,
    fontWeight: "700",
  },
  linhaSwitch: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  servoEscolhido: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Cores.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Cores.borda,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  servoEscolhidoText: {
    flex: 1,
    fontSize: 15,
    color: TEXTO,
  },
  servoItem: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Cores.borda,
  },

  // ── Senha temporária ──
  senhaCaixa: {
    backgroundColor: Cores.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Cores.borda,
    paddingVertical: 20,
    alignItems: "center",
    marginTop: 8,
    ...sombra,
  },
  senha: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: 1,
    color: Cores.marinho,
    marginTop: 4,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
  },
});
