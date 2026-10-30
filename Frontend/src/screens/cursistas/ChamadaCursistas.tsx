import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../frequencia/Frequencia.styles";
import { chamadaStyles } from "./ChamadaCursistas.styles";
import {
  getMissoesCursistas,
  getChamadaCursistas,
  salvarChamadaCursistas,
  MissaoCursista,
  ChamadaCursista,
} from "../../services/cursistas/cursistas";
import { StatusFrequencia } from "../../services/frequencia/frequencia";
import Header from "../../../components/Header";
import { Cores } from "@/constants/theme";
import { STATUS_CORES } from "@/constants/frequencia";

const STATUS_LISTA: StatusFrequencia[] = ["Presente", "Justificada", "Falta"];

type Marcacoes = Record<number, StatusFrequencia>;

function formatarData(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

// YYYY-MM-DD no fuso do aparelho (toISOString usaria UTC)
function hojeKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "2026-11-15" → "Domingo, 15 de novembro"
function dataPorExtenso(dateStr: string) {
  const [ano, mes, dia] = dateStr.slice(0, 10).split("-").map(Number);
  const texto = new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const getInitials = (nome: string) =>
  nome.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join("");

export default function ChamadaCursistasScreen() {
  const [missoes, setMissoes] = useState<MissaoCursista[]>([]);
  const [missao, setMissao] = useState<MissaoCursista | null>(null);
  const [chamada, setChamada] = useState<ChamadaCursista | null>(null);
  const [idComunidade, setIdComunidade] = useState<number | null>(null);
  const [marcacoes, setMarcacoes] = useState<Marcacoes>({});
  const [modoEdicao, setModoEdicao] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [carregandoChamada, setCarregandoChamada] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [modalMissoes, setModalMissoes] = useState(false);

  const comunidade = chamada?.comunidades.find((c) => c.id_comunidade === idComunidade) ?? null;
  const cursistas = useMemo(() => comunidade?.cursistas ?? [], [comunidade]);
  const jaLancada = cursistas.some((c) => c.status !== null);
  const podeEditar = !jaLancada || modoEdicao;

  // Começa com o que já foi lançado; quem ainda não tem marcação fica com Falta
  const marcacoesIniciais = useCallback((lista: typeof cursistas): Marcacoes => {
    const iniciais: Marcacoes = {};
    lista.forEach((c) => { iniciais[c.id_cursista] = c.status ?? "Falta"; });
    return iniciais;
  }, []);

  useEffect(() => {
    setMarcacoes(marcacoesIniciais(cursistas));
    setModoEdicao(false);
  }, [cursistas, marcacoesIniciais]);

  const abrirMissao = useCallback(async (m: MissaoCursista, manterComunidade?: number | null) => {
    setMissao(m);
    setModalMissoes(false);
    setCarregandoChamada(true);
    try {
      const dados = await getChamadaCursistas(m.id_missao);
      setChamada(dados);
      // Fica na mesma comunidade; senão, a primeira que tem cursistas
      const manter = dados.comunidades.find((c) => c.id_comunidade === manterComunidade);
      const inicial = manter ?? dados.comunidades.find((c) => c.cursistas.length > 0) ?? dados.comunidades[0];
      setIdComunidade(inicial?.id_comunidade ?? null);
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível carregar a chamada.");
    } finally {
      setCarregandoChamada(false);
    }
  }, []);

  const carregar = useCallback(async () => {
    try {
      const { data } = await getMissoesCursistas();
      // A API já manda só até hoje (o filtro cobre o fuso do servidor)
      const ateHoje = data.filter((m) => m.data <= hojeKey());
      setMissoes(ateHoje);
      if (ateHoje.length > 0) await abrirMissao(ateHoje[0]);
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Falha ao carregar as missões.");
    } finally {
      setCarregando(false);
    }
  }, [abrirMissao]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const contagem = {
    presente: cursistas.filter((c) => marcacoes[c.id_cursista] === "Presente").length,
    justificada: cursistas.filter((c) => marcacoes[c.id_cursista] === "Justificada").length,
    falta: cursistas.filter((c) => marcacoes[c.id_cursista] === "Falta").length,
  };
  const todosPresentes = cursistas.length > 0 && contagem.presente === cursistas.length;

  const marcarTodosPresentes = () => {
    const todos: Marcacoes = {};
    cursistas.forEach((c) => { todos[c.id_cursista] = "Presente"; });
    setMarcacoes(todos);
  };

  const salvar = async () => {
    if (!missao || cursistas.length === 0) return;
    setSalvando(true);
    try {
      await salvarChamadaCursistas(
        missao.id_missao,
        cursistas.map((c) => ({ id_cursista: c.id_cursista, status: marcacoes[c.id_cursista] }))
      );
      Alert.alert("Sucesso", jaLancada ? "Chamada atualizada!" : "Chamada registrada!");
      setMissoes((prev) => prev.map((m) => (m.id_missao === missao.id_missao ? { ...m, tem_frequencia: true } : m)));
      await abrirMissao(missao, idComunidade);
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const cancelarEdicao = () => {
    setMarcacoes(marcacoesIniciais(cursistas));
    setModoEdicao(false);
  };

  const selo = modoEdicao
    ? { texto: "Editando", cor: STATUS_CORES.Justificada }
    : jaLancada
    ? { texto: "Registrada", cor: STATUS_CORES.Presente }
    : { texto: "Pendente", cor: { fundo: Cores.primariaSuave, texto: Cores.primaria } };

  const renderCursista = ({ item }: { item: (typeof cursistas)[number] }) => {
    const statusAtual = marcacoes[item.id_cursista];
    return (
      <View style={styles.servoRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item.nome)}</Text>
        </View>
        <Text style={styles.servoNome} numberOfLines={1}>{item.nome}</Text>
        <View style={styles.statusButtons}>
          {STATUS_LISTA.map((s) => {
            const ativo = statusAtual === s;
            const cor = STATUS_CORES[s];
            return (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusBtn,
                  ativo && { backgroundColor: cor.fundo, borderColor: cor.forte },
                  !podeEditar && !ativo && styles.statusBtnBloqueado,
                ]}
                onPress={() => podeEditar && setMarcacoes((prev) => ({ ...prev, [item.id_cursista]: s }))}
                activeOpacity={podeEditar ? 0.7 : 1}
                accessibilityLabel={`${item.nome}: ${s}`}
              >
                <Text style={[styles.statusBtnText, ativo && { color: cor.texto }]}>
                  {s === "Presente" ? "P" : s === "Justificada" ? "J" : "F"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  if (carregando) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <Header title="Cursistas" />
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Cores.primaria} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Cores.fundo} />
      <Header title="Cursistas" />

      {missoes.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="school-outline" size={40} color={Cores.iconeInativo} />
          <Text style={styles.emptyStateText}>Nenhuma formação até hoje</Text>
          <Text style={styles.emptyStateSubtext}>
            A chamada abre no dia da Formação de Cursistas ou do Encontro
          </Text>
        </View>
      ) : (
        <>
          {/* Card da missão (toque para trocar) */}
          <TouchableOpacity style={styles.missaoCard} onPress={() => setModalMissoes(true)} activeOpacity={0.7}>
            <View style={styles.missaoIcon}>
              <Ionicons name="school-outline" size={22} color={Cores.primaria} />
            </View>
            <View style={styles.missaoBody}>
              <Text style={styles.missaoTitulo} numberOfLines={1}>{missao?.descricao}</Text>
              <View style={styles.missaoInfoRow}>
                <Text style={styles.missaoData} numberOfLines={1}>
                  {missao ? dataPorExtenso(missao.data) : ""}
                </Text>
                {comunidade && cursistas.length > 0 && (
                  <View style={[styles.selo, { backgroundColor: selo.cor.fundo }]}>
                    <Text style={[styles.seloTexto, { color: selo.cor.texto }]}>{selo.texto}</Text>
                  </View>
                )}
              </View>
            </View>
            <Ionicons name="swap-vertical" size={20} color={Cores.primaria} />
          </TouchableOpacity>

          {/* Comunidades: só aparece para quem vê mais de uma (coord. geral/admin) */}
          {chamada && chamada.comunidades.length > 1 && (
            <View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={chamadaStyles.chips}
              >
                {chamada.comunidades.map((c) => {
                  const ativa = c.id_comunidade === idComunidade;
                  return (
                    <TouchableOpacity
                      key={c.id_comunidade}
                      style={[chamadaStyles.chip, ativa && chamadaStyles.chipAtivo]}
                      onPress={() => setIdComunidade(c.id_comunidade)}
                    >
                      <Text style={[chamadaStyles.chipTexto, ativa && chamadaStyles.chipTextoAtivo]}>
                        {c.nome} · {c.cursistas.length}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {!carregandoChamada && cursistas.length > 0 && (
            <View style={styles.listaTopo}>
              <Text style={styles.searchCount}>
                {comunidade?.nome} · {cursistas.length} cursistas
              </Text>
              {podeEditar && (
                <TouchableOpacity
                  style={[styles.todosBtn, todosPresentes && styles.todosBtnFeito]}
                  onPress={marcarTodosPresentes}
                  disabled={todosPresentes}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={todosPresentes ? "checkmark-done" : "checkmark-done-outline"}
                    size={16}
                    color={todosPresentes ? STATUS_CORES.Presente.texto : Cores.primaria}
                  />
                  <Text style={[styles.todosBtnText, todosPresentes && styles.todosBtnTextFeito]}>
                    Todos presentes
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {carregandoChamada ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={Cores.primaria} />
            </View>
          ) : cursistas.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={40} color={Cores.iconeInativo} />
              <Text style={styles.emptyStateText}>Nenhum cursista nesta comunidade</Text>
              <Text style={styles.emptyStateSubtext}>Os cursistas entram no sistema no dia do Encontro</Text>
            </View>
          ) : (
            <FlatList
              style={styles.lista}
              data={cursistas}
              keyExtractor={(item) => item.id_cursista.toString()}
              renderItem={renderCursista}
              extraData={{ marcacoes, podeEditar }}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}

          {/* Rodapé com contadores e botões */}
          {!carregandoChamada && cursistas.length > 0 && (
            <View style={styles.footer}>
              <View style={styles.counters}>
                {[
                  { status: "Presente" as const, valor: contagem.presente, label: "presentes" },
                  { status: "Justificada" as const, valor: contagem.justificada, label: "justificados" },
                  { status: "Falta" as const, valor: contagem.falta, label: "faltas" },
                ].map((c) => (
                  <View key={c.status} style={[styles.counterCard, { backgroundColor: STATUS_CORES[c.status].fundo }]}>
                    <Text style={[styles.counterNum, { color: STATUS_CORES[c.status].texto }]}>{c.valor}</Text>
                    <Text style={[styles.counterLabel, { color: STATUS_CORES[c.status].texto }]}>{c.label}</Text>
                  </View>
                ))}
              </View>

              {!jaLancada && (
                <TouchableOpacity
                  style={[styles.btnConfirmar, salvando && styles.btnDisabled]}
                  onPress={salvar}
                  disabled={salvando}
                  activeOpacity={0.8}
                >
                  {salvando ? (
                    <ActivityIndicator color={Cores.textoSobrePrimaria} size="small" />
                  ) : (
                    <Text style={styles.btnConfirmarText}>Confirmar chamada</Text>
                  )}
                </TouchableOpacity>
              )}

              {jaLancada && !modoEdicao && (
                <TouchableOpacity style={styles.btnAtualizar} onPress={() => setModoEdicao(true)} activeOpacity={0.8}>
                  <Ionicons name="create-outline" size={18} color={Cores.primaria} />
                  <Text style={styles.btnAtualizarText}>Editar chamada</Text>
                </TouchableOpacity>
              )}

              {jaLancada && modoEdicao && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.btnCancelar} onPress={cancelarEdicao} activeOpacity={0.8}>
                    <Text style={styles.btnCancelarText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnConfirmar, styles.btnConfirmarFlex, salvando && styles.btnDisabled]}
                    onPress={salvar}
                    disabled={salvando}
                    activeOpacity={0.8}
                  >
                    {salvando ? (
                      <ActivityIndicator color={Cores.textoSobrePrimaria} size="small" />
                    ) : (
                      <Text style={styles.btnConfirmarText}>Salvar alterações</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </>
      )}

      {/* Seleção da missão */}
      <Modal visible={modalMissoes} transparent animationType="slide" onRequestClose={() => setModalMissoes(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalMissoes(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Selecione a missão</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {missoes.map((m) => {
                const selecionada = missao?.id_missao === m.id_missao;
                return (
                  <TouchableOpacity
                    key={m.id_missao}
                    style={[styles.missaoItem, selecionada && styles.missaoItemSelected]}
                    onPress={() => abrirMissao(m, idComunidade)}
                  >
                    <View style={styles.missaoItemBody}>
                      <View style={styles.missaoItemTopo}>
                        <Text style={styles.missaoItemData}>{formatarData(m.data)}</Text>
                        {m.data === hojeKey() && (
                          <View style={styles.tagHoje}>
                            <Text style={styles.tagHojeText}>Hoje</Text>
                          </View>
                        )}
                        {m.tem_frequencia && (
                          <View style={[styles.tagHoje, { backgroundColor: STATUS_CORES.Presente.fundo }]}>
                            <Text style={[styles.tagHojeText, { color: STATUS_CORES.Presente.texto }]}>Registrada</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.missaoItemDesc} numberOfLines={1}>{m.descricao}</Text>
                    </View>
                    {selecionada && <Ionicons name="checkmark-circle" size={22} color={Cores.primaria} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
