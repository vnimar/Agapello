import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";

import { Cores } from "@/constants/theme";
import { STATUS_CORES } from "@/constants/frequencia";
import { ArquivoEscolhido } from "../../services/pastas/pastas";
import { CursistaImportado, ImportacaoCursistas, importarCursistas } from "../../services/cursistas/cursistas";
import { styles } from "../pastas/ImportarPastas.styles";

// Planilha do encontro: sobe antes ou no 1º dia, com o nome e a comunidade de
// cada cursista (email, telefone, endereço e nascimento são opcionais).
// Quem já está no ano é atualizado; ninguém é removido por aqui.

const TIPOS_XLSX = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

const ACAO = {
  novo: { texto: "Novo", cor: STATUS_CORES.Presente },
  atualiza: { texto: "Atualiza", cor: { fundo: Cores.primariaSuave, texto: Cores.primaria } },
  erro: { texto: "Erro", cor: STATUS_CORES.Falta },
};

function Linha({ c }: { c: CursistaImportado }) {
  const acao = ACAO[c.acao];
  return (
    <View style={[styles.pasta, local.linha]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.pastaNome}>{c.nome || "(sem nome)"}</Text>
        <Text style={styles.pastaPlanilha}>
          Linha {c.linha}{c.comunidade ? ` · ${c.comunidade}` : ""}
        </Text>
        {c.erro && <Text style={styles.detalheErro}>{c.erro}</Text>}
        {c.avisos.map((a, i) => (
          <Text key={i} style={[styles.detalhe, styles.conferir]}>{a}</Text>
        ))}
      </View>
      <View style={[local.tag, { backgroundColor: acao.cor.fundo }]}>
        <Text style={[local.tagTexto, { color: acao.cor.texto }]}>{acao.texto}</Text>
      </View>
    </View>
  );
}

export default function ImportarCursistasScreen() {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [arquivo, setArquivo] = useState<ArquivoEscolhido | null>(null);
  const [previa, setPrevia] = useState<ImportacaoCursistas | null>(null);
  const [enviando, setEnviando] = useState(false);

  const voltar = () => (router.canGoBack() ? router.back() : router.replace("/cursistas-gerenciar"));

  async function verPrevia(escolhido: ArquivoEscolhido, anoEscolhido: number) {
    setEnviando(true);
    setPrevia(null);
    try {
      setPrevia(await importarCursistas(escolhido, anoEscolhido, false));
    } catch (err: any) {
      Alert.alert("Não foi possível ler a planilha", err?.message || "Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  async function escolher() {
    const resultado = await DocumentPicker.getDocumentAsync({ type: TIPOS_XLSX, copyToCacheDirectory: true });
    if (resultado.canceled || !resultado.assets?.length) return;
    const a = resultado.assets[0];
    const escolhido: ArquivoEscolhido = { uri: a.uri, name: a.name, mimeType: a.mimeType, file: (a as any).file };
    setArquivo(escolhido);
    verPrevia(escolhido, ano);
  }

  function trocarAno(novo: number) {
    setAno(novo);
    if (arquivo) verPrevia(arquivo, novo);
  }

  function confirmar() {
    if (!arquivo || !previa) return;
    Alert.alert("Gravar os cursistas?", previa.message, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Gravar",
        onPress: async () => {
          setEnviando(true);
          try {
            const r = await importarCursistas(arquivo, ano, true);
            if (!r.gravado) {
              setPrevia(r);
              Alert.alert("Nada foi gravado", r.message);
            } else {
              Alert.alert("Cursistas gravados", r.message, [{ text: "OK", onPress: voltar }]);
            }
          } catch (err: any) {
            Alert.alert("Não foi possível gravar", err?.message || "Tente novamente.");
          } finally {
            setEnviando(false);
          }
        },
      },
    ]);
  }

  const podeGravar = !!previa && previa.erros.length === 0 && !enviando;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topo}>
        <TouchableOpacity style={styles.voltar} onPress={voltar} hitSlop={12} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={26} color={Cores.marinho} />
        </TouchableOpacity>
        <Text style={styles.titulo}>Importar cursistas</Text>
        <View style={styles.voltar} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.texto}>
          Planilha do encontro (.xlsx) com as colunas Nome e Comunidade. Email, Telefone, Endereço e
          Data de nascimento são opcionais. Quem já está cadastrado no ano é atualizado, sem duplicar.
        </Text>

        <View style={styles.anos}>
          {[anoAtual, anoAtual + 1].map((a) => (
            <TouchableOpacity key={a} style={[styles.ano, ano === a && styles.anoAtivo]}
                              onPress={() => trocarAno(a)} disabled={enviando}>
              <Text style={[styles.anoText, ano === a && styles.anoTextAtivo]}>{a}</Text>
              <Text style={styles.anoSub}>{a === anoAtual ? "ano atual" : "próximo encontro"}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.botao, !!arquivo && styles.botaoSecundario, enviando && styles.botaoDesativado]}
                          onPress={escolher} disabled={enviando}>
          <Ionicons name="document-attach-outline" size={20}
                    color={arquivo ? Cores.marinho : Cores.textoSobrePrimaria} />
          <Text style={[styles.botaoText, !!arquivo && styles.botaoSecundarioText]}>
            {arquivo ? "Escolher outra planilha" : "Escolher planilha"}
          </Text>
        </TouchableOpacity>
        {arquivo && <Text style={styles.arquivo}>{arquivo.name}</Text>}

        {enviando && <ActivityIndicator size="large" color={Cores.primaria} />}

        {previa && (
          <>
            <Text style={styles.resumo}>{previa.message}</Text>

            {previa.erros.length > 0 && (
              <View style={[styles.caixa, styles.caixaErro]}>
                <Text style={[styles.caixaTitulo, styles.erroText]}>
                  Corrija na planilha antes de gravar ({previa.erros.length})
                </Text>
                {previa.erros.map((e, i) => <Text key={i} style={styles.erroText}>• {e}</Text>)}
              </View>
            )}

            {previa.avisos.length > 0 && (
              <View style={[styles.caixa, styles.caixaAviso]}>
                <Text style={[styles.caixaTitulo, styles.avisoText]}>Para conferir ({previa.avisos.length})</Text>
                {previa.avisos.map((a, i) => <Text key={i} style={styles.avisoText}>• {a}</Text>)}
              </View>
            )}

            {previa.cursistas.map((c) => <Linha key={c.linha} c={c} />)}

            <TouchableOpacity style={[styles.botao, styles.botaoConfirmar, !podeGravar && styles.botaoDesativado]}
                              onPress={confirmar} disabled={!podeGravar}>
              <Text style={styles.botaoText}>Gravar cursistas de {ano}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const local = StyleSheet.create({
  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tag: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagTexto: {
    fontSize: 11,
    fontWeight: "700",
  },
});
