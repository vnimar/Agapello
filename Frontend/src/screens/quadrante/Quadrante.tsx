import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Cores } from "@/constants/theme";
import { styles } from "../servo/Servo.style";
import { chamadaStyles } from "../cursistas/ChamadaCursistas.styles";
import Header from "../../../components/Header";
import NomeComApelido, { nomeExibido, textoDeBusca } from "../../../components/NomeComApelido";
import DadosServoModal, { ServoComDados, dataBr } from "../servo/DadosServoModal";
import { useAuth } from "../../context/AuthContext";
import {
  CursistaQuadrante,
  PastaQuadrante,
  Quadrante,
  ServoQuadrante,
  getQuadrante,
  putDadosCursista,
} from "../../services/quadrante/quadrante";

// Quadrante: dados de todos os servos ativos e dos cursistas do ano, aberto a
// qualquer servo logado (sem frequência). O próprio servo edita os dados dele;
// admin e coord. geral editam os de qualquer servo ou cursista.

type Pessoa = { tipo: "servo"; p: ServoQuadrante } | { tipo: "cursista"; p: CursistaQuadrante };

const getInitials = (nome: string) =>
  nome.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join("");

function semAcento(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// "Encontro: Cozinha · Pós: Música (coord.)"
// Pastas de um momento numa linha só: "Música, Social e Eventos (coord.)"
function pastasDo(pastas: PastaQuadrante[], momento: "encontro" | "pos") {
  return pastas.filter((p) => p.momento === momento).map((p) => p.nome + (p.coordenador ? " (coord.)" : "")).join(", ");
}

function resumoPastas(pastas: PastaQuadrante[]) {
  const encontro = pastasDo(pastas, "encontro");
  const pos = pastasDo(pastas, "pos");
  return [encontro && `Encontro: ${encontro}`, pos && `Pós: ${pos}`].filter(Boolean).join(" · ");
}

// Números de um campo de telefone livre ("Pai: (61) 9... Mãe: (61) 9...")
function numeros(texto: string) {
  return (texto.match(/(\(?\d{2}\)?[\s.-]*)?\d{4,5}[\s.-]?\d{4}/g) ?? []).map((t) => t.replace(/\D/g, ""));
}

function abrir(url: string) {
  Linking.openURL(url).catch(() => Alert.alert("Não foi possível abrir", "Confira se o app está instalado."));
}

function Telefone({ rotulo, texto, ultima }: { rotulo: string; texto: string; ultima?: boolean }) {
  const lista = numeros(texto);
  return (
    <View style={[styles.dadosRow, ultima && styles.dadosRowLast, { alignItems: "flex-start" }]}>
      <Text style={styles.dadosKey}>{rotulo}</Text>
      <View style={{ flexShrink: 1, alignItems: "flex-end", gap: 6 }}>
        <Text style={styles.dadosValue}>{texto}</Text>
        {lista.map((n) => (
          <View key={n} style={{ flexDirection: "row", gap: 14 }}>
            {lista.length > 1 && <Text style={styles.cardPastas}>…{n.slice(-4)}</Text>}
            <TouchableOpacity onPress={() => abrir(`tel:${n}`)} accessibilityLabel={`Ligar para ${texto}`}>
              <Ionicons name="call-outline" size={20} color={Cores.primaria} />
            </TouchableOpacity>
            {/* WhatsApp precisa de DDD + número (10 ou 11 dígitos) */}
            {(n.length === 10 || n.length === 11) && (
              <TouchableOpacity onPress={() => abrir(`https://wa.me/55${n}`)} accessibilityLabel={`WhatsApp de ${texto}`}>
                <Ionicons name="logo-whatsapp" size={20} color={Cores.primaria} />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function Detalhes({ pessoa, onEditar }: { pessoa: Pessoa; onEditar?: () => void }) {
  const { p } = pessoa;
  const linhas: { rotulo: string; valor: string; telefone?: boolean }[] = [];
  if (p.telefone) linhas.push({ rotulo: "Telefone", valor: p.telefone, telefone: true });
  if (p.email) linhas.push({ rotulo: "Email", valor: p.email });
  if (p.data_nascimento) {
    linhas.push({
      rotulo: "Nascimento",
      valor: dataBr(p.data_nascimento) + (p.idade !== null ? ` (${p.idade} anos)` : ""),
    });
  }
  if (p.endereco) linhas.push({ rotulo: "Endereço", valor: p.endereco });
  if (p.responsavel_nome) linhas.push({ rotulo: "Responsável", valor: p.responsavel_nome });
  if (p.responsavel_telefone) {
    linhas.push({ rotulo: "Tel. do responsável", valor: p.responsavel_telefone, telefone: true });
  }
  if (pessoa.tipo === "servo") {
    // Uma linha por momento; "—" deixa à vista quem ficou sem pasta
    linhas.push({ rotulo: "Encontro", valor: pastasDo(pessoa.p.pastas, "encontro") || "—" });
    linhas.push({ rotulo: "Pós-encontro", valor: pastasDo(pessoa.p.pastas, "pos") || "—" });
    if (pessoa.p.ano_ingresso) linhas.push({ rotulo: "Servo desde", valor: String(pessoa.p.ano_ingresso) });
  } else if (pessoa.p.comunidade) {
    linhas.push({ rotulo: "Comunidade", valor: pessoa.p.comunidade });
  }

  return (
    <View>
      <View style={styles.dadosBox}>
        {linhas.length === 0 && <Text style={styles.cardPastas}>Nenhum dado cadastrado ainda.</Text>}
        {linhas.map((l, i) =>
          l.telefone ? (
            <Telefone key={l.rotulo} rotulo={l.rotulo} texto={l.valor} ultima={i === linhas.length - 1} />
          ) : (
            <View key={`${l.rotulo}-${i}`} style={[styles.dadosRow, i === linhas.length - 1 && styles.dadosRowLast]}>
              <Text style={styles.dadosKey}>{l.rotulo}</Text>
              <Text style={[styles.dadosValue, { flexShrink: 1, textAlign: "right" }]}>{l.valor}</Text>
            </View>
          )
        )}
      </View>
      {onEditar && (
        <TouchableOpacity style={styles.btnReativar} onPress={onEditar} activeOpacity={0.7}>
          <Ionicons name="create-outline" size={16} color={Cores.primaria} />
          <Text style={styles.btnReativarText}>Editar dados</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const chave = (pessoa: Pessoa) => (pessoa.tipo === "servo" ? `s${pessoa.p.id}` : `c${pessoa.p.id_cursista}`);

export default function QuadranteScreen() {
  const { usuario, isAdmin, recarregarUsuario } = useAuth();
  const [dados, setDados] = useState<Quadrante | null>(null);
  const [aba, setAba] = useState<"servos" | "cursistas">("servos");
  const [comunidade, setComunidade] = useState<string | null>(null); // null = todas
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [editando, setEditando] = useState<Pessoa | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setDados(await getQuadrante());
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível carregar o quadrante.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const comunidades = useMemo(
    () => [...new Set((dados?.cursistas ?? []).map((c) => c.comunidade ?? "Sem comunidade"))],
    [dados]
  );

  // A busca acha por apelido, nome ou pasta (servos) / comunidade (cursistas)
  const lista: Pessoa[] = useMemo(() => {
    if (!dados) return [];
    const termo = semAcento(busca.trim());
    const pessoas: Pessoa[] =
      aba === "servos"
        ? dados.servos.map((p) => ({ tipo: "servo", p }))
        : dados.cursistas
            .filter((c) => !comunidade || (c.comunidade ?? "Sem comunidade") === comunidade)
            .map((p) => ({ tipo: "cursista", p }));
    if (!termo) return pessoas;
    return pessoas.filter((pessoa) => {
      const extra =
        pessoa.tipo === "servo" ? pessoa.p.pastas.map((x) => x.nome).join(" ") : pessoa.p.comunidade ?? "";
      return semAcento(`${textoDeBusca(pessoa.p)} ${extra}`).includes(termo);
    });
  }, [dados, aba, comunidade, busca]);

  const podeEditar = (pessoa: Pessoa) =>
    isAdmin || (pessoa.tipo === "servo" && pessoa.p.id === usuario?.id_servo);

  const editar: ServoComDados | null = editando
    ? { ...editando.p, id: editando.tipo === "servo" ? editando.p.id : editando.p.id_cursista }
    : null;

  const renderItem = ({ item }: { item: Pessoa }) => {
    const k = chave(item);
    const isOpen = aberto === k;
    const subtitulo = item.tipo === "servo" ? resumoPastas(item.p.pastas) : item.p.comunidade ?? "";
    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.cardHeader} onPress={() => setAberto(isOpen ? null : k)} activeOpacity={0.7}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(nomeExibido(item.p))}</Text>
          </View>
          <View style={styles.cardInfo}>
            <NomeComApelido nome={item.p.nome} apelido={item.p.apelido} style={styles.cardNome} />
            {!!subtitulo && <Text style={styles.cardPastas} numberOfLines={1}>{subtitulo}</Text>}
          </View>
          <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18}
                    color={Cores.iconeInativo} style={styles.chevron} />
        </TouchableOpacity>
        {isOpen && (
          <View style={styles.details}>
            <Detalhes pessoa={item} onEditar={podeEditar(item) ? () => setEditando(item) : undefined} />
          </View>
        )}
      </View>
    );
  };

  const total = aba === "servos" ? dados?.servos.length ?? 0 : dados?.cursistas.length ?? 0;
  const rotulo = aba === "servos" ? "servos" : "cursistas";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <Header title="Quadrante" />

      <View style={chamadaStyles.segmento}>
        {([["servos", "Servos"], ["cursistas", "Cursistas"]] as const).map(([valor, texto]) => (
          <TouchableOpacity key={valor} style={[chamadaStyles.segmentoBtn, aba === valor && chamadaStyles.segmentoAtivo]}
                            onPress={() => { setAba(valor); setAberto(null); }} activeOpacity={0.7}>
            <Text style={[chamadaStyles.segmentoTexto, aba === valor && chamadaStyles.segmentoTextoAtivo]}>
              {texto}{dados ? ` · ${valor === "servos" ? dados.servos.length : dados.cursistas.length}` : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {aba === "cursistas" && comunidades.length > 1 && (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={chamadaStyles.chips}>
            {[null, ...comunidades].map((c) => {
              const ativa = c === comunidade;
              return (
                <TouchableOpacity key={c ?? "todas"} style={[chamadaStyles.chip, ativa && chamadaStyles.chipAtivo]}
                                  onPress={() => { setComunidade(c); setAberto(null); }}>
                  <Text style={[chamadaStyles.chipTexto, ativa && chamadaStyles.chipTextoAtivo]}>{c ?? "Todas"}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={styles.searchArea}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={18} color={Cores.iconeInativo} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={aba === "servos" ? "Buscar nome, apelido ou pasta..." : "Buscar nome ou apelido..."}
            placeholderTextColor={Cores.iconeInativo}
            value={busca}
            onChangeText={setBusca}
            returnKeyType="search"
          />
          {busca.length > 0 && (
            <TouchableOpacity onPress={() => setBusca("")} style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color={Cores.iconeInativo} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!dados ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Cores.primaria} />
          <Text style={styles.loadingText}>Carregando quadrante...</Text>
        </View>
      ) : (
        <>
          <View style={styles.counterWrap}>
            <Text style={styles.counterText}>
              {busca || comunidade ? `${lista.length} de ${total} ${rotulo}` : `${total} ${rotulo} em ${dados.ano}`}
            </Text>
          </View>
          <FlatList
            data={lista}
            keyExtractor={chave}
            renderItem={renderItem}
            extraData={aberto}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={36} color={Cores.iconeInativo} />
                <Text style={styles.emptyStateText}>
                  {busca ? "Ninguém encontrado" : `Nenhum ${rotulo === "servos" ? "servo" : "cursista"} em ${dados.ano}`}
                </Text>
              </View>
            }
          />
        </>
      )}

      <DadosServoModal
        servo={editar}
        titulo="Editar dados"
        onFechar={() => setEditando(null)}
        onSalvo={() => {
          if (editando?.tipo === "servo" && editando.p.id === usuario?.id_servo) {
            recarregarUsuario().catch(() => {}); // o "Olá" usa o apelido
          }
          setEditando(null);
          carregar();
        }}
        gravar={editando?.tipo === "cursista" ? putDadosCursista : undefined}
      />
    </SafeAreaView>
  );
}
