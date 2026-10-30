import { StyleSheet } from 'react-native';
import { Cores } from '@/constants/theme';

const sombra = {
  shadowColor: Cores.sombra,
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

export const styles = StyleSheet.create({
  /* Topo */
  marca: {
    fontSize: 24,
    fontWeight: '800',
    color: Cores.marinho,
    letterSpacing: -0.5,
  },
  saudacao: {
    fontSize: 30,
    fontWeight: '700',
    color: Cores.texto,
    marginTop: 4,
    marginBottom: 20,
    paddingHorizontal: 4,
  },

  /* Próxima missão */
  missaoCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    overflow: 'hidden',
    backgroundColor: Cores.primaria,
    ...sombra,
    shadowOpacity: 0.2,
  },
  missaoFundo: {
    ...StyleSheet.absoluteFillObject,
  },
  missaoRotulo: {
    color: Cores.textoSobrePrimaria,
    opacity: 0.8,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  missaoTitulo: {
    color: Cores.textoSobrePrimaria,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
  },
  missaoInfo: {
    color: Cores.textoSobrePrimaria,
    opacity: 0.92,
    fontSize: 15,
    marginBottom: 2,
  },
  missaoCarregando: {
    alignSelf: 'flex-start',
    marginVertical: 12,
  },
  missaoBotao: {
    alignSelf: 'flex-start',
    backgroundColor: Cores.card,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 14,
  },
  missaoBotaoTexto: {
    color: Cores.marinho,
    fontSize: 15,
    fontWeight: '600',
  },

  /* Atalhos */
  atalhos: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 28,
  },
  atalho: {
    width: '25%',
    alignItems: 'center',
  },
  atalhoCirculo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Cores.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    ...sombra,
  },
  atalhoTexto: {
    color: Cores.textoSuave,
    fontSize: 13,
  },

  /* Seções */
  secaoTitulo: {
    fontSize: 20,
    fontWeight: '700',
    color: Cores.texto,
    marginBottom: 12,
    paddingHorizontal: 4,
  },

  /* Próximos */
  proximosLista: {
    marginHorizontal: -16, // cards vão até a borda da tela ao rolar
    marginBottom: 28,
  },
  proximosConteudo: {
    paddingHorizontal: 16,
    gap: 10,
  },
  proximoCard: {
    width: 150,
    backgroundColor: Cores.card,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 14,
    padding: 12,
    justifyContent: 'space-between',
    minHeight: 92,
  },
  proximoTopo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  proximoNome: {
    flex: 1,
    color: Cores.texto,
    fontSize: 14,
    fontWeight: '500',
  },
  proximoData: {
    color: Cores.textoSuave,
    fontSize: 13,
    marginTop: 8,
  },

  /* Meu resumo */
  resumoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Cores.card,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  resumoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resumoTextos: {
    flexShrink: 1,
  },
  resumoEmoji: {
    fontSize: 26,
  },
  resumoApagado: {
    opacity: 0.3,
  },
  resumoNumero: {
    color: Cores.texto,
    fontSize: 20,
    fontWeight: '700',
  },
  resumoLabel: {
    color: Cores.textoSuave,
    fontSize: 12,
  },
  resumoDivisor: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: Cores.borda,
    marginHorizontal: 12,
  },
});
