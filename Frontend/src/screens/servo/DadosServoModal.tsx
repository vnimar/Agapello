import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Cores } from "@/constants/theme";
import { DadosServo, putDadosServo } from "../../services/servos/servos";
import { authStyles as styles } from "../login/Login.styles";

// Dados de contato, apelido e responsável do servo. Usado em Minha conta (o
// próprio servo) e em Servos (admin e coord. geral editam qualquer um).
// Quando o quadrante existir, a edição de admin/coord. geral vai para lá.

export type ServoComDados = DadosServo & { id: number; nome: string; idade?: number | null };

// "AAAA-MM-DD" → "DD/MM/AAAA"
export function dataBr(iso: string | null | undefined) {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

// Digitação livre → "DD/MM/AAAA" com as barras no lugar
function mascaraData(texto: string) {
  const n = texto.replace(/\D/g, "").slice(0, 8);
  if (n.length <= 2) return n;
  if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
  return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
}

// "DD/MM/AAAA" → "AAAA-MM-DD"; null se vazia; undefined se inválida
function dataIso(br: string): string | null | undefined {
  if (!br.trim()) return null;
  const achado = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!achado) return undefined;
  const [, d, m, a] = achado.map(Number);
  const data = new Date(a, m - 1, d);
  const valida = data.getFullYear() === a && data.getMonth() === m - 1 && data.getDate() === d;
  if (!valida || a < 1900 || data > new Date()) return undefined;
  return `${achado[3]}-${achado[2]}-${achado[1]}`;
}

export default function DadosServoModal({
  servo,
  titulo,
  onFechar,
  onSalvo,
}: {
  servo: ServoComDados | null; // null = fechado
  titulo: string;
  onFechar: () => void;
  onSalvo: (atualizado: ServoComDados) => void;
}) {
  const [apelido, setApelido] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [responsavelTelefone, setResponsavelTelefone] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!servo) return;
    setApelido(servo.apelido ?? "");
    setTelefone(servo.telefone ?? "");
    setEmail(servo.email ?? "");
    setEndereco(servo.endereco ?? "");
    setNascimento(dataBr(servo.data_nascimento));
    setResponsavelNome(servo.responsavel_nome ?? "");
    setResponsavelTelefone(servo.responsavel_telefone ?? "");
  }, [servo]);

  const salvar = async () => {
    if (!servo) return;
    const emailLimpo = email.trim().toLowerCase();
    if (emailLimpo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
      return Alert.alert("Atenção", "Confira o email.");
    }
    const data = dataIso(nascimento);
    if (data === undefined) {
      return Alert.alert("Atenção", "Data de nascimento inválida. Use DD/MM/AAAA.");
    }

    setSalvando(true);
    try {
      const atualizado = await putDadosServo(servo.id, {
        telefone: telefone.trim() || null,
        email: emailLimpo || null,
        endereco: endereco.trim() || null,
        data_nascimento: data,
        apelido: apelido.trim() || null,
        responsavel_nome: responsavelNome.trim() || null,
        responsavel_telefone: responsavelTelefone.trim() || null,
      });
      onSalvo({ ...servo, ...(atualizado as ServoComDados) });
    } catch (err: any) {
      Alert.alert("Não foi possível salvar", err?.message || "Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal visible={servo !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={[styles.title, { textAlign: "left" }]}>{titulo}</Text>
            <Text style={[styles.subtitle, { textAlign: "left", marginBottom: 4 }]}>{servo?.nome}</Text>

            <Text style={styles.label}>Apelido</Text>
            <TextInput style={styles.input} value={apelido} onChangeText={setApelido}
                       placeholder="Como é chamado (vai no crachá)" placeholderTextColor={Cores.iconeInativo} />

            <Text style={styles.label}>Telefone</Text>
            <TextInput style={styles.input} value={telefone} onChangeText={setTelefone}
                       placeholder="(00) 00000-0000" placeholderTextColor={Cores.iconeInativo}
                       keyboardType="phone-pad" />

            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail}
                       placeholder="nome@email.com" placeholderTextColor={Cores.iconeInativo}
                       autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />

            <Text style={styles.label}>Endereço</Text>
            <TextInput style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
                       value={endereco} onChangeText={setEndereco} multiline
                       placeholder="Rua, número, bairro e cidade" placeholderTextColor={Cores.iconeInativo} />

            <Text style={styles.label}>Data de nascimento</Text>
            <TextInput style={styles.input} value={nascimento}
                       onChangeText={(t) => setNascimento(mascaraData(t))}
                       placeholder="DD/MM/AAAA" placeholderTextColor={Cores.iconeInativo}
                       keyboardType="number-pad" maxLength={10} />

            <Text style={styles.label}>Responsável (contato)</Text>
            <TextInput style={styles.input} value={responsavelNome} onChangeText={setResponsavelNome}
                       placeholder="Nome (pai, mãe ou outro)" placeholderTextColor={Cores.iconeInativo} />

            <Text style={styles.label}>Telefone do responsável</Text>
            <TextInput style={styles.input} value={responsavelTelefone} onChangeText={setResponsavelTelefone}
                       placeholder="(00) 00000-0000" placeholderTextColor={Cores.iconeInativo}
                       keyboardType="phone-pad" />

            <TouchableOpacity
              style={[styles.btnPrimary, salvando && styles.btnDisabled]}
              onPress={salvar}
              disabled={salvando}
            >
              {salvando ? (
                <ActivityIndicator color={Cores.textoSobrePrimaria} size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>Salvar</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={onFechar} disabled={salvando}>
              <Text style={styles.btnSecondaryText}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
