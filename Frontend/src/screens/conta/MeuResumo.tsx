import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { buscarMeuResumo, MeuResumo as Resumo, StatusFrequencia } from "../../services/auth/auth";
import { authStyles } from "../login/Login.styles";
import { resumoStyles as styles, STATUS_CORES } from "./Conta.styles";

const MISSOES_VISIVEIS = 5;

const MOMENTO_LABEL = { encontro: "Encontro", pos: "Pós-Encontro" } as const;

function diaMes(data: string) {
  const [, mes, dia] = data.split("-");
  return `${dia}/${mes}`;
}

function Contador({ status, valor }: { status: StatusFrequencia; valor: number }) {
  const cor = STATUS_CORES[status];
  return (
    <View style={[styles.contador, { backgroundColor: cor.fundo }]}>
      <Text style={[styles.contadorNumero, { color: cor.texto }]}>{valor}</Text>
      <Text style={[styles.contadorLabel, { color: cor.texto }]}>{status}</Text>
    </View>
  );
}

/** Foguinho, frequência do ano e pastas do ano — só para contas ligadas a um servo. */
export default function MeuResumo() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState(false);
  const [todas, setTodas] = useState(false);

  useEffect(() => {
    buscarMeuResumo().then(setResumo).catch(() => setErro(true));
  }, []);

  if (erro) return <Text style={styles.erro}>Não foi possível carregar sua frequência.</Text>;
  if (!resumo) return <ActivityIndicator style={styles.carregando} />;
  if (resumo.id_servo === null) return null;

  const { frequencia, foguinho, missoes, pastas, ano } = resumo;
  const visiveis = todas ? missoes : missoes.slice(0, MISSOES_VISIVEIS);
  const momentos = (["pos", "encontro"] as const).filter((m) => pastas.some((p) => p.momento === m));

  return (
    <>
      <View style={authStyles.card}>
        <Text style={authStyles.sectionTitle}>Foguinho</Text>
        <View style={styles.fogoRow}>
          <Text style={[styles.fogoEmoji, !foguinho.chama_acesa && styles.fogoApagado]}>🔥</Text>
          <View>
            <Text style={styles.fogoNumero}>
              {foguinho.sequencia_atual} {foguinho.sequencia_atual === 1 ? "presença" : "presenças"} seguidas
            </Text>
            <Text style={styles.fogoTexto}>
              {foguinho.chama_acesa ? "Não falte para manter a chama acesa" : "Venha na próxima missão para acender"}
              {"\n"}Recorde: {foguinho.recorde}
            </Text>
          </View>
        </View>
      </View>

      <View style={authStyles.card}>
        <Text style={authStyles.sectionTitle}>Minha frequência em {ano}</Text>
        {frequencia.percentual_presenca === null ? (
          <Text style={styles.vazio}>Ainda não houve chamada este ano.</Text>
        ) : (
          <>
            <Text style={styles.percentual}>{Math.round(frequencia.percentual_presenca)}%</Text>
            <Text style={styles.fogoTexto}>de presença (justificada conta como presença)</Text>
            <View style={styles.contadores}>
              <Contador status="Presente" valor={frequencia.presente} />
              <Contador status="Justificada" valor={frequencia.justificada} />
              <Contador status="Falta" valor={frequencia.falta} />
            </View>

            {visiveis.map((m, i) => (
              <View
                key={`${m.data}-${i}`}
                style={[styles.missaoRow, i === visiveis.length - 1 && authStyles.cardRowLast]}
              >
                <Text style={styles.missaoData}>{diaMes(m.data)}</Text>
                <Text style={styles.missaoDescricao} numberOfLines={2}>{m.descricao}</Text>
                <View style={[styles.badge, { backgroundColor: STATUS_CORES[m.status].fundo }]}>
                  <Text style={[styles.badgeTexto, { color: STATUS_CORES[m.status].texto }]}>{m.status}</Text>
                </View>
              </View>
            ))}
            {missoes.length > MISSOES_VISIVEIS && (
              <TouchableOpacity onPress={() => setTodas(!todas)} hitSlop={8}>
                <Text style={styles.verTodas}>{todas ? "Ver menos" : `Ver todas (${missoes.length})`}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      <View style={authStyles.card}>
        <Text style={authStyles.sectionTitle}>Minhas pastas em {ano}</Text>
        {pastas.length === 0 ? (
          <Text style={styles.vazio}>Nenhuma pasta este ano.</Text>
        ) : (
          momentos.map((momento) => (
            <View key={momento}>
              <Text style={styles.momento}>{MOMENTO_LABEL[momento]}</Text>
              {pastas.filter((p) => p.momento === momento).map((p) => (
                <Text key={p.nome} style={styles.pasta}>
                  {p.nome}
                  {p.coordenador && <Text style={styles.coordenador}>  · coordenador(a)</Text>}
                </Text>
              ))}
            </View>
          ))
        )}
      </View>
    </>
  );
}
