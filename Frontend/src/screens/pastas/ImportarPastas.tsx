import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";

import { Cores } from "@/constants/theme";

import {
  ArquivoEscolhido,
  EquipeImportada,
  ImportacaoPastas,
  PastaImportada,
  PessoaImportada,
  importarPastas,
} from "../../services/pastas/pastas";
import { styles } from "./ImportarPastas.styles";

// Virada de pastas: escolhe a planilha de distribuição (.xlsx), confere a
// prévia e só então grava. As pastas do ano seguinte valem a partir de janeiro.

const TIPOS_XLSX = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

const NOME_MOMENTO = { encontro: "Encontro", pos: "Pós-Encontro" };

function Pessoa({ p, coordenador }: { p: PessoaImportada; coordenador: boolean }) {
  const prefixo = coordenador ? "★ " : "• ";
  if (!p.id_servo) {
    return (
      <Text style={[styles.pessoa, styles.pessoaFora]}>
        {prefixo}{p.nome_planilha} <Text style={styles.detalhe}>(não encontrado)</Text>
      </Text>
    );
  }
  return (
    <View>
      <Text style={[styles.pessoa, p.erro ? styles.pessoaErro : null]}>
        {prefixo}{p.servo}
        {p.conferir && <Text style={styles.conferir}>  confira: “{p.nome_planilha}”</Text>}
      </Text>
      {p.erro && <Text style={styles.detalheErro}>   {p.erro}</Text>}
    </View>
  );
}

function Equipe({ e }: { e: EquipeImportada }) {
  return (
    <View>
      <Text style={styles.momento}>{NOME_MOMENTO[e.momento]}</Text>
      {e.coordenadores.map((p, i) => <Pessoa key={`c${i}`} p={p} coordenador />)}
      {e.membros.map((p, i) => <Pessoa key={`m${i}`} p={p} coordenador={false} />)}
      {e.ignorados.length > 0 && (
        <Text style={styles.detalhe}>Fora do sistema: {e.ignorados.join(", ")}</Text>
      )}
    </View>
  );
}

function Pasta({ p }: { p: PastaImportada }) {
  const vazia = p.equipes.length === 0;
  return (
    <View style={[styles.pasta, !p.pasta && styles.pastaIgnorada]}>
      <Text style={styles.pastaNome}>{p.pasta ?? p.funcao_planilha}</Text>
      {!p.pasta && <Text style={styles.pastaPlanilha}>Não existe no sistema: ignorada</Text>}
      {p.pasta && p.conferir && (
        <Text style={[styles.pastaPlanilha, styles.conferir]}>Na planilha: “{p.funcao_planilha}”</Text>
      )}
      {vazia && <Text style={styles.pastaPlanilha}>Ninguém nesta pasta</Text>}
      {p.equipes.map((e) => <Equipe key={e.momento} e={e} />)}
    </View>
  );
}

export default function ImportarPastasScreen() {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual + 1);
  const [arquivo, setArquivo] = useState<ArquivoEscolhido | null>(null);
  const [previa, setPrevia] = useState<ImportacaoPastas | null>(null);
  const [enviando, setEnviando] = useState(false);

  const voltar = () => (router.canGoBack() ? router.back() : router.replace("/conta"));

  async function verPrevia(escolhido: ArquivoEscolhido, anoEscolhido: number) {
    setEnviando(true);
    setPrevia(null);
    try {
      setPrevia(await importarPastas(escolhido, anoEscolhido, false));
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
    const substitui = previa.substituidos
      ? `\n\nOs ${previa.substituidos} lançamento(s) que já existem em ${ano} serão substituídos.`
      : "";
    const antigos = previa.antigos
      ? `\n\nOs ${previa.antigos} lançamento(s) de antes de ${ano - 2} serão apagados (só ficam ${ano - 2} a ${ano}).`
      : "";
    const quando = ano > anoAtual ? `\n\nAs pastas de ${ano} passam a valer em 1º de janeiro.` : "";
    Alert.alert("Gravar as pastas?", `${previa.message}${substitui}${antigos}${quando}`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Gravar",
        onPress: async () => {
          setEnviando(true);
          try {
            const r = await importarPastas(arquivo, ano, true);
            if (r.erros.length) {
              setPrevia(r);
              Alert.alert("Nada foi gravado", r.message);
            } else {
              Alert.alert("Pastas gravadas", r.message, [{ text: "OK", onPress: voltar }]);
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
        <Text style={styles.titulo}>Importar pastas</Text>
        <View style={styles.voltar} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.texto}>
          Escolha a planilha de distribuição de pastas (.xlsx). Antes de gravar, você confere tudo aqui.
          Apostolado, Missionária Jovem e quem não é servo ficam de fora.
        </Text>

        <View style={styles.anos}>
          {[anoAtual, anoAtual + 1].map((a) => (
            <TouchableOpacity key={a} style={[styles.ano, ano === a && styles.anoAtivo]}
                              onPress={() => trocarAno(a)} disabled={enviando}>
              <Text style={[styles.anoText, ano === a && styles.anoTextAtivo]}>{a}</Text>
              <Text style={styles.anoSub}>{a === anoAtual ? "ano atual" : "vale em janeiro"}</Text>
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

            {previa.pastas.map((p) => <Pasta key={`${p.linha}-${p.funcao_planilha}`} p={p} />)}

            <TouchableOpacity style={[styles.botao, styles.botaoConfirmar, !podeGravar && styles.botaoDesativado]}
                              onPress={confirmar} disabled={!podeGravar}>
              <Text style={styles.botaoText}>Gravar pastas de {ano}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
