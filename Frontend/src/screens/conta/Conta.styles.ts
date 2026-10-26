import { StyleSheet } from "react-native";
import {
  VERDE_LIGHT, VERDE_DARK, AMARELO_LIGHT, AMARELO_DARK, VERMELHO_LIGHT, VERMELHO_DARK,
} from "../frequencia/Frequencia.styles";

const TEXTO = "#1A2C3E";
const CINZA = "#6C757D";

export const STATUS_CORES = {
  Presente: { fundo: VERDE_LIGHT, texto: VERDE_DARK },
  Justificada: { fundo: AMARELO_LIGHT, texto: AMARELO_DARK },
  Falta: { fundo: VERMELHO_LIGHT, texto: VERMELHO_DARK },
} as const;

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
  },
  fogoEmoji: {
    fontSize: 44,
    marginRight: 14,
  },
  fogoApagado: {
    opacity: 0.25,
  },
  fogoNumero: {
    fontSize: 28,
    fontWeight: "700",
    color: TEXTO,
  },
  fogoTexto: {
    fontSize: 13,
    color: CINZA,
    marginTop: 2,
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
    borderBottomColor: "#F0F0F0",
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
    color: "#649AFA",
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
