import { StyleSheet } from "react-native";
import { Cores } from "@/constants/theme";

// O resto da tela usa os estilos da Frequência (mesmo visual da chamada de servos)
export const chamadaStyles = StyleSheet.create({
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
