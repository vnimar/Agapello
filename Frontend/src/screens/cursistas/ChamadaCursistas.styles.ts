import { StyleSheet } from "react-native";
import { Cores } from "@/constants/theme";

// O resto da tela usa os estilos da Frequência (mesmo visual da chamada de servos)
export const chamadaStyles = StyleSheet.create({
  // Alternância Chamada | Lista
  segmento: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 8,
    padding: 4,
    borderRadius: 12,
    backgroundColor: Cores.primariaSuave,
  },
  segmentoBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: "center",
  },
  segmentoAtivo: {
    backgroundColor: Cores.card,
    shadowColor: Cores.sombra,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentoTexto: {
    fontSize: 14,
    fontWeight: "600",
    color: Cores.textoSuave,
  },
  segmentoTextoAtivo: {
    color: Cores.marinho,
  },
  chips: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Cores.card,
    borderWidth: 1,
    borderColor: Cores.borda,
  },
  chipAtivo: {
    backgroundColor: Cores.primariaSuave,
    borderColor: Cores.primaria,
  },
  chipTexto: {
    fontSize: 14,
    fontWeight: "500",
    color: Cores.textoSuave,
  },
  chipTextoAtivo: {
    color: Cores.primaria,
    fontWeight: "700",
  },
});
