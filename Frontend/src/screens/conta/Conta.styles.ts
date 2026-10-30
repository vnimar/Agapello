import { StyleSheet } from "react-native";
import { Cores } from "@/constants/theme";

const TEXTO = Cores.texto;
const CINZA = Cores.textoSuave;

export { STATUS_CORES } from "@/constants/frequencia";

export const resumoStyles = StyleSheet.create({
  carregando: {
    marginTop: 20,
  },
  erro: {
    fontSize: 13,
    color: CINZA,
    textAlign: "center",
    marginTop: 20,
  },

  // Foguinho
  fogoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  fogoEmoji: {
    fontSize: 40,
    marginRight: 12,
  },
  fogoTextos: {
    flex: 1,
  },
  fogoApagado: {
    opacity: 0.25,
  },
  fogoNumero: {
    fontSize: 32,
    fontWeight: "700",
    color: TEXTO,
  },
  fogoLabel: {
    fontSize: 13,
    color: CINZA,
  },
  fogoTexto: {
    fontSize: 13,
    color: CINZA,
    marginTop: 8,
  },
  recorde: {
    backgroundColor: Cores.primariaSuave,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  recordeNumero: {
    fontSize: 18,
    fontWeight: "700",
    color: Cores.marinho,
  },
  recordeLabel: {
    fontSize: 11,
    color: CINZA,
  },

  // Frequência
  percentual: {
    fontSize: 32,
    fontWeight: "700",
    color: TEXTO,
    marginTop: 4,
  },
  contadores: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },
  contador: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  contadorNumero: {
    fontSize: 20,
    fontWeight: "700",
  },
  contadorLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  missaoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: Cores.borda,
  },
  missaoData: {
    fontSize: 13,
    color: CINZA,
    width: 48,
  },
  missaoDescricao: {
    flex: 1,
    fontSize: 14,
    color: TEXTO,
    marginRight: 8,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeTexto: {
    fontSize: 12,
    fontWeight: "600",
  },
  verTodas: {
    fontSize: 14,
    color: Cores.primaria,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 12,
  },
  vazio: {
    fontSize: 14,
    color: CINZA,
    marginTop: 8,
  },

  // Pastas
  momento: {
    fontSize: 12,
    fontWeight: "600",
    color: CINZA,
    textTransform: "uppercase",
    marginTop: 12,
  },
  pasta: {
    fontSize: 15,
    color: TEXTO,
    marginTop: 6,
  },
  coordenador: {
    fontSize: 13,
    color: CINZA,
  },
});
