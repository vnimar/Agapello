import { StyleSheet } from "react-native";
import { Cores } from "@/constants/theme";
import { STATUS_CORES } from "@/constants/frequencia";

const TEXTO = Cores.texto;
const CINZA = Cores.textoSuave;
const ERRO = STATUS_CORES.Falta;
const AVISO = STATUS_CORES.Justificada;
const NOVO = STATUS_CORES.Presente;

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
    width: 40,
    padding: 4,
  },
  titulo: {
    fontSize: 24,
    fontWeight: "800",
    color: Cores.marinho,
    letterSpacing: -0.5,
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  texto: {
    fontSize: 14,
    color: CINZA,
    lineHeight: 20,
    marginBottom: 12,
  },
  anos: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  ano: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Cores.borda,
    backgroundColor: Cores.card,
    paddingVertical: 10,
    alignItems: "center",
  },
  anoAtivo: {
    borderColor: Cores.primaria,
    backgroundColor: Cores.primariaSuave,
  },
  anoText: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXTO,
  },
  anoTextAtivo: {
    color: Cores.primaria,
  },
  anoSub: {
    fontSize: 11,
    color: CINZA,
    marginTop: 2,
  },
  botao: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Cores.primaria,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 16,
  },
  botaoSecundario: {
    backgroundColor: Cores.primariaSuave,
  },
  botaoConfirmar: {
    marginTop: 8,
  },
  botaoDesativado: {
    opacity: 0.45,
  },
  botaoText: {
    color: Cores.textoSobrePrimaria,
    fontWeight: "600",
    fontSize: 16,
  },
  botaoSecundarioText: {
    color: Cores.marinho,
  },
  arquivo: {
    fontSize: 13,
    color: CINZA,
    textAlign: "center",
    marginTop: -8,
    marginBottom: 16,
  },
  resumo: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXTO,
    marginBottom: 12,
  },
  caixa: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  caixaErro: {
    backgroundColor: ERRO.fundo,
  },
  caixaAviso: {
    backgroundColor: AVISO.fundo,
  },
  caixaNovo: {
    backgroundColor: NOVO.fundo,
  },
  novoText: {
    color: NOVO.texto,
    fontSize: 13,
    marginBottom: 4,
  },
  caixaNeutra: {
    backgroundColor: Cores.card,
    borderWidth: 1,
    borderColor: Cores.borda,
  },
  neutroText: {
    color: TEXTO,
    fontSize: 13,
    marginBottom: 4,
  },
  caixaTitulo: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  erroText: {
    color: ERRO.texto,
    fontSize: 13,
    marginBottom: 4,
  },
  avisoText: {
    color: AVISO.texto,
    fontSize: 13,
    marginBottom: 4,
  },
  pasta: {
    backgroundColor: Cores.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Cores.borda,
    padding: 14,
    marginBottom: 10,
    ...sombra,
  },
  pastaIgnorada: {
    opacity: 0.55,
  },
  pastaNome: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXTO,
  },
  pastaPlanilha: {
    fontSize: 12,
    color: CINZA,
    marginTop: 2,
  },
  momento: {
    fontSize: 12,
    fontWeight: "600",
    color: CINZA,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 4,
  },
  pessoa: {
    fontSize: 14,
    color: TEXTO,
    paddingVertical: 2,
  },
  pessoaFora: {
    color: CINZA,
    fontStyle: "italic",
  },
  pessoaErro: {
    color: ERRO.texto,
  },
  detalhe: {
    fontSize: 12,
    color: CINZA,
  },
  detalheErro: {
    fontSize: 12,
    color: ERRO.texto,
  },
  conferir: {
    color: AVISO.texto,
    fontWeight: "600",
  },
});
