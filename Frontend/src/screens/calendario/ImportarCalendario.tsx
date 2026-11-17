import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";

import { Cores } from "@/constants/theme";
import { STATUS_CORES } from "@/constants/frequencia";

import type { ArquivoEscolhido } from "../../services/pastas/pastas";
import { ImportacaoCalendario, MissaoImportItem, importarCalendario } from "../../services/missao/missao";
import { styles as base } from "../pastas/ImportarPastas.styles";

// Calendário do ano: escolhe a planilha (Modelo - Calendário), confere a prévia
// e só então grava. O que já está no calendário (mesma data e nome) é ignorado.

const TIPOS_XLSX = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho",
               "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const PUBLICO = { servos: null, cursistas: "Cursistas", ambos: "Servos e cursistas" };

function dataCurta(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  return `${DIAS[new Date(a, m - 1, d).getDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

function Linha({ m }: { m: MissaoImportItem }) {
  const duplicada = m.situacao === "duplicada";
  const detalhes = [m.horario, m.local].filter(Boolean).join(" · ");
  const publico = PUBLICO[m.publico];
  return (
    <View style={[styles.linha, duplicada && styles.duplicada]}>
      <Text style={styles.data}>{m.data ? dataCurta(m.data) : `linha ${m.linha}`}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[base.pessoa, m.erro ? base.pessoaErro : null]}>{m.descricao || "(sem nome)"}</Text>
        {!!detalhes && <Text style={base.detalhe}>{detalhes}</Text>}
        <View style={styles.selos}>
          {duplicada && <Text style={[styles.selo, styles.seloNeutro]}>já no calendário</Text>}
          {!!publico && <Text style={[styles.selo, styles.seloNeutro]}>{publico}</Text>}
          {!m.conta_frequencia && <Text style={[styles.selo, styles.seloNeutro]}>não conta frequência</Text>}
          {m.nome_novo && !m.erro && <Text style={[styles.selo, styles.seloAviso]}>nome novo</Text>}
        </View>
        {!!m.erro && <Text style={base.detalheErro}>{m.erro}</Text>}
        {m.avisos.map((a, i) => <Text key={i} style={[base.detalhe, base.conferir]}>{a}</Text>)}
      </View>
    </View>
  );
}

// Agrupa por mês (as linhas com data inválida ficam num grupo à parte, no fim)
function porMes(itens: MissaoImportItem[]) {
  const grupos = new Map<string, MissaoImportItem[]>();
  const ordenados = [...itens].sort((a, b) => (a.data ?? "9999").localeCompare(b.data ?? "9999"));
  for (const m of ordenados) {
    const titulo = m.data ? `${MESES[Number(m.data.slice(5, 7)) - 1]} ${m.data.slice(0, 4)}` : "Sem data";
    grupos.set(titulo, [...(grupos.get(titulo) ?? []), m]);
  }
  return [...grupos.entries()];
}

export default function ImportarCalendarioScreen() {
  const [arquivo, setArquivo] = useState<ArquivoEscolhido | null>(null);
  const [previa, setPrevia] = useState<ImportacaoCalendario | null>(null);
  const [enviando, setEnviando] = useState(false);

  const voltar = () => (router.canGoBack() ? router.back() : router.replace("/conta"));

  async function escolher() {
    const resultado = await DocumentPicker.getDocumentAsync({ type: TIPOS_XLSX, copyToCacheDirectory: true });
    if (resultado.canceled || !resultado.assets?.length) return;
    const a = resultado.assets[0];
    const escolhido: ArquivoEscolhido = { uri: a.uri, name: a.name, mimeType: a.mimeType, file: (a as any).file };
    setArquivo(escolhido);
    setEnviando(true);
    setPrevia(null);
    try {
      setPrevia(await importarCalendario(escolhido, false));
    } catch (err: any) {
      Alert.alert("Não foi possível ler a planilha", err?.message || "Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  function confirmar() {
    if (!arquivo || !previa) return;
    const ignoradas = previa.duplicadas ? `\n\n${previa.duplicadas} já estão no calendário e serão ignoradas.` : "";
    Alert.alert("Gravar o calendário?", `${previa.novas} missão(ões) entram no calendário.${ignoradas}`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Gravar",
        onPress: async () => {
          setEnviando(true);
          try {
            const r = await importarCalendario(arquivo, true);
            if (r.erros.length) {
              setPrevia(r);
              Alert.alert("Nada foi gravado", r.message);
            } else {
              Alert.alert("Calendário gravado", r.message, [{ text: "OK", onPress: voltar }]);
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

  const podeGravar = !!previa && previa.erros.length === 0 && previa.novas > 0 && !enviando;
  const nomesNovos = previa ? [...new Set(previa.itens.filter((m) => m.nome_novo && !m.erro).map((m) => m.descricao))] : [];

  return (
    <SafeAreaView style={base.safeArea}>
      <View style={base.topo}>
        <TouchableOpacity style={base.voltar} onPress={voltar} hitSlop={12} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={26} color={Cores.marinho} />
        </TouchableOpacity>
        <Text style={base.titulo}>Importar calendário</Text>
        <View style={base.voltar} />
      </View>

      <ScrollView contentContainerStyle={base.container}>
        <Text style={base.texto}>
          Escolha a planilha do calendário (.xlsx, no formato do Modelo - Calendário). Antes de gravar, você
          confere tudo aqui. O que já estiver no calendário (mesma data e mesmo nome) não se repete.
        </Text>

        <TouchableOpacity style={[base.botao, !!arquivo && base.botaoSecundario, enviando && base.botaoDesativado]}
                          onPress={escolher} disabled={enviando}>
          <Ionicons name="document-attach-outline" size={20}
                    color={arquivo ? Cores.marinho : Cores.textoSobrePrimaria} />
          <Text style={[base.botaoText, !!arquivo && base.botaoSecundarioText]}>
            {arquivo ? "Escolher outra planilha" : "Escolher planilha"}
          </Text>
        </TouchableOpacity>
        {arquivo && <Text style={base.arquivo}>{arquivo.name}</Text>}

        {enviando && <ActivityIndicator size="large" color={Cores.primaria} />}

        {previa && (
          <>
            <Text style={base.resumo}>{previa.message}</Text>

            {previa.erros.length > 0 && (
              <View style={[base.caixa, base.caixaErro]}>
                <Text style={[base.caixaTitulo, base.erroText]}>
                  Corrija na planilha antes de gravar ({previa.erros.length})
                </Text>
                {previa.erros.map((e, i) => <Text key={i} style={base.erroText}>• {e}</Text>)}
              </View>
            )}

            {nomesNovos.length > 0 && (
              <View style={[base.caixa, base.caixaAviso]}>
                <Text style={[base.caixaTitulo, base.avisoText]}>Missões com nome novo ({nomesNovos.length})</Text>
                <Text style={[base.avisoText, { marginBottom: 6 }]}>
                  Confira a grafia: a chamada de cursistas e outras regras dependem do nome.
                </Text>
                {nomesNovos.map((n) => <Text key={n} style={base.avisoText}>• {n}</Text>)}
              </View>
            )}

            {porMes(previa.itens).map(([mes, itens]) => (
              <View key={mes} style={base.pasta}>
                <Text style={base.pastaNome}>{mes}</Text>
                {itens.map((m) => <Linha key={m.linha} m={m} />)}
              </View>
            ))}

            <TouchableOpacity style={[base.botao, base.botaoConfirmar, !podeGravar && base.botaoDesativado]}
                              onPress={confirmar} disabled={!podeGravar}>
              <Text style={base.botaoText}>
                {previa.novas > 0 ? `Gravar ${previa.novas} missão(ões)` : "Nada novo para gravar"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const AVISO = STATUS_CORES.Justificada;

const styles = StyleSheet.create({
  linha: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Cores.borda,
  },
  duplicada: {
    opacity: 0.5,
  },
  data: {
    width: 78,
    fontSize: 13,
    fontWeight: "600",
    color: Cores.textoSuave,
    paddingTop: 2,
  },
  selos: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  selo: {
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },
  seloNeutro: {
    color: Cores.marinho,
    backgroundColor: Cores.primariaSuave,
  },
  seloAviso: {
    color: AVISO.texto,
    backgroundColor: AVISO.fundo,
  },
});
