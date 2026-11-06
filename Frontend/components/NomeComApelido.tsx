import React from "react";
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import { Cores } from "@/constants/theme";

// Servos e cursistas se conhecem pelo apelido (é o do crachá): ele vem em
// destaque e o nome completo, menor, embaixo. Sem apelido, só o nome.

type Props = {
  nome: string;
  apelido?: string | null;
  style?: StyleProp<TextStyle>;          // estilo do texto principal (o da tela)
  containerStyle?: StyleProp<ViewStyle>; // ex.: { flex: 1 } quando o nome ocupa o espaço da linha
};

export default function NomeComApelido({ nome, apelido, style, containerStyle }: Props) {
  return (
    <View style={[styles.container, containerStyle]}>
      {/* O flex do estilo da tela vale para o container, não para o texto */}
      <Text style={[style, styles.texto]} numberOfLines={1}>{apelido || nome}</Text>
      {!!apelido && <Text style={styles.nomeCompleto} numberOfLines={1}>{nome}</Text>}
    </View>
  );
}

/** Nome exibido (para iniciais do avatar e mensagens). */
export function nomeExibido(p: { nome: string; apelido?: string | null }) {
  return p.apelido || p.nome;
}

/** Texto em que a busca procura: acha a pessoa pelo apelido ou pelo nome. */
export function textoDeBusca(p: { nome: string; apelido?: string | null }) {
  return `${p.apelido ?? ""} ${p.nome}`;
}

const styles = StyleSheet.create({
  container: { flexShrink: 1 },
  texto: { flexGrow: 0, flexShrink: 1, flexBasis: "auto" },
  nomeCompleto: { fontSize: 12, color: Cores.textoSuave, marginTop: 1 },
});
