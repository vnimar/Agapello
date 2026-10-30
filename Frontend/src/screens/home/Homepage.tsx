import {Ionicons} from '@expo/vector-icons';
import React, {useEffect, useState} from 'react';
import {ActivityIndicator, ScrollView, Text, TouchableOpacity, View} from 'react-native';
import {useRouter} from 'expo-router';
import Svg, {Circle, Defs, LinearGradient, Rect, Stop} from 'react-native-svg';

import ScreenWrapper from '../../../components/ScreenWrapper';
import Header from '../../../components/Header';
import {Cores} from '@/constants/theme';
import {styles} from './Home.styles';
import {ICONE_PUBLICO} from '@/constants/missao';
import {getMissoes, getProximaMissao, Missao} from '../../services/missao/missao';
import {buscarMeuResumo, MeuResumo} from '../../services/auth/auth';
import {useAuth} from '../../context/AuthContext';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const PROXIMOS_VISIVEIS = 6;

type NomeIcone = React.ComponentProps<typeof Ionicons>['name'];

function separarData(data: string) {
  const [ano, mes, dia] = data.slice(0, 10).split('-').map(Number);
  return {ano, mes, dia};
}

function diaMes(data: string) {
  const {mes, dia} = separarData(data);
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
}

function diaSemana(data: string) {
  const {ano, mes, dia} = separarData(data);
  return DIAS_SEMANA[new Date(ano, mes - 1, dia).getDay()];
}

function hojeISO() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
}

function diasRestantes(data: string) {
  const {ano, mes, dia} = separarData(data);
  const alvo = new Date(ano, mes - 1, dia);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

function textoDias(n: number) {
  if (n < 0) return '';
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  return `em ${n} dias`;
}

// Fundo em degradê do card da próxima missão (react-native-svg: não exige build nova)
function FundoMissao() {
  return (
    <Svg style={styles.missaoFundo} width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="fundoMissao" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={Cores.primaria} />
          <Stop offset="1" stopColor={Cores.primariaClara} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#fundoMissao)" />
      <Circle cx="92%" cy="12%" r="70" fill="#FFFFFF" fillOpacity={0.08} />
      <Circle cx="78%" cy="105%" r="55" fill="#FFFFFF" fillOpacity={0.08} />
    </Svg>
  );
}

function Atalho({icone, texto, onPress}: {icone: NomeIcone; texto: string; onPress: () => void}) {
  return (
    <TouchableOpacity style={styles.atalho} onPress={onPress} accessibilityLabel={texto}>
      <View style={styles.atalhoCirculo}>
        <Ionicons name={icone} size={28} color={Cores.primaria} />
      </View>
      <Text style={styles.atalhoTexto}>{texto}</Text>
    </TouchableOpacity>
  );
}

const Home: React.FC = () => {
  const router = useRouter();
  const {usuario, cuidaDosServos} = useAuth();
  const primeiroNome = usuario?.nome.split(' ')[0] || 'Servo';

  const [missao, setMissao] = useState<Missao | null>(null);
  const [proximas, setProximas] = useState<Missao[]>([]);
  const [resumo, setResumo] = useState<MeuResumo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      // allSettled: sem missão futura o /proxima dá 404, e isso não pode
      // esconder o resto da tela
      const [proxima, todas, meuResumo] = await Promise.allSettled([
        getProximaMissao(),
        getMissoes(),
        usuario ? buscarMeuResumo() : Promise.resolve(null),
      ]);
      const atual = proxima.status === 'fulfilled' ? proxima.value : null;
      setMissao(atual);

      if (todas.status === 'fulfilled') {
        const hoje = hojeISO();
        setProximas(
          todas.value
            .filter((m) => m.data.slice(0, 10) >= hoje && m.id_missao !== atual?.id_missao)
            .sort((a, b) => a.data.localeCompare(b.data))
            .slice(0, PROXIMOS_VISIVEIS),
        );
      } else {
        console.error('Erro ao buscar missões:', todas.reason);
        setProximas([]);
      }

      setResumo(meuResumo.status === 'fulfilled' ? meuResumo.value : null);
      setLoading(false);
    }
    carregar();
    // Recarrega ao trocar de usuário (entrar/sair), para usar o token certo
  }, [usuario?.id]);

  // Abre o calendário já no dia da missão
  const abrirNoCalendario = (m: Missao | null) =>
    router.push(m ? {pathname: '/calendario', params: {data: m.data.slice(0, 10)}} : '/calendario');

  const dias = missao ? textoDias(diasRestantes(missao.data)) : '';
  const temHorario = missao?.horario.includes(':');

  return (
    <ScreenWrapper scrollable={true} backgroundColor={Cores.fundo}>
      <Header title="Agapello" />

      <Text style={styles.saudacao}>Olá, {primeiroNome}</Text>

      {/* Próxima missão */}
      <View style={styles.missaoCard}>
        <FundoMissao />
        <Text style={styles.missaoRotulo}>PRÓXIMA MISSÃO</Text>
        {loading ? (
          <ActivityIndicator color={Cores.textoSobrePrimaria} style={styles.missaoCarregando} />
        ) : missao ? (
          <>
            <Text style={styles.missaoTitulo} numberOfLines={2}>{missao.descricao}</Text>
            <Text style={styles.missaoInfo}>
              {diaSemana(missao.data)}, {diaMes(missao.data)}
              {temHorario ? ` · ${missao.horario}` : ''}
              {dias ? ` · ${dias}` : ''}
            </Text>
            {!!missao.local && (
              <Text style={styles.missaoInfo} numberOfLines={1}>📍 {missao.local}</Text>
            )}
          </>
        ) : (
          <Text style={styles.missaoTitulo}>Nenhuma missão marcada</Text>
        )}
        <TouchableOpacity style={styles.missaoBotao} onPress={() => abrirNoCalendario(missao)}>
          <Text style={styles.missaoBotaoTexto}>Ver no calendário</Text>
        </TouchableOpacity>
      </View>

      {/* Atalhos */}
      <View style={styles.atalhos}>
        <Atalho icone="calendar-outline" texto="Calendário" onPress={() => router.push('/calendario')} />
        <Atalho
          icone="person-outline"
          texto="Perfil"
          onPress={() => router.push(usuario ? '/conta' : '/login')}
        />
        {cuidaDosServos && (
          <Atalho icone="checkmark-done-outline" texto="Frequência" onPress={() => router.push('/frequencia')} />
        )}
        {cuidaDosServos && (
          <Atalho icone="people-outline" texto="Servos" onPress={() => router.push('/servo')} />
        )}
      </View>

      {/* Próximos */}
      {proximas.length > 0 && (
        <>
          <Text style={styles.secaoTitulo}>Próximos</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.proximosLista}
            contentContainerStyle={styles.proximosConteudo}
          >
            {proximas.map((m) => (
              <TouchableOpacity
                key={m.id_missao}
                style={styles.proximoCard}
                onPress={() => abrirNoCalendario(m)}
              >
                <View style={styles.proximoTopo}>
                  <Ionicons name={ICONE_PUBLICO[m.publico] ?? 'calendar-outline'} size={24} color={Cores.primaria} />
                  <Text style={styles.proximoNome} numberOfLines={2}>{m.descricao}</Text>
                </View>
                <Text style={styles.proximoData}>{diaMes(m.data)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {/* Meu resumo: só para contas ligadas a um servo */}
      {resumo?.id_servo != null && (
        <>
          <Text style={styles.secaoTitulo}>Meu resumo</Text>
          <TouchableOpacity style={styles.resumoCard} onPress={() => router.push('/conta')}>
            <View style={styles.resumoItem}>
              <Text style={[styles.resumoEmoji, !resumo.foguinho.chama_acesa && styles.resumoApagado]}>🔥</Text>
              <View style={styles.resumoTextos}>
                <Text style={styles.resumoNumero}>{resumo.foguinho.sequencia_atual}</Text>
                <Text style={styles.resumoLabel}>
                  {resumo.foguinho.sequencia_atual === 1 ? 'presença seguida' : 'presenças seguidas'}
                </Text>
              </View>
            </View>
            <View style={styles.resumoDivisor} />
            <View style={styles.resumoItem}>
              <Ionicons name="stats-chart-outline" size={26} color={Cores.primaria} />
              <View style={styles.resumoTextos}>
                <Text style={styles.resumoNumero}>
                  {resumo.frequencia.percentual_presenca === null
                    ? '—'
                    : `${Math.round(resumo.frequencia.percentual_presenca)}%`}
                </Text>
                <Text style={styles.resumoLabel}>frequência em {resumo.ano}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Cores.textoSuave} />
          </TouchableOpacity>
        </>
      )}
    </ScreenWrapper>
  );
};

export default Home;
