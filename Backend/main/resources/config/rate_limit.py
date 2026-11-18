import math
import time

from fastapi import HTTPException, Request, status

# ── Bloqueio contra tentativa e erro ──────────────────────────────────────────
#
# Guarda em memória as falhas recentes por chave (ex.: IP + email).
# MAX_TENTATIVAS falhas dentro da janela bloqueiam a chave por BLOQUEIO_SEGUNDOS,
# inclusive com a senha certa. Passado o bloqueio, o contador recomeça do zero:
# antes ele "deslizava" (só a falha mais antiga expirava), então um único erro
# depois dos 15 minutos bloqueava de novo.
# Em memória basta: o Render roda uma instância só.

MAX_TENTATIVAS = 5
JANELA_SEGUNDOS = 15 * 60
BLOQUEIO_SEGUNDOS = 15 * 60


class LimitadorTentativas:
    def __init__(self, mensagem: str, max_tentativas: int = MAX_TENTATIVAS,
                 janela: int = JANELA_SEGUNDOS, bloqueio: int = BLOQUEIO_SEGUNDOS):
        # "{minutos}" na mensagem é trocado pelo tempo que falta para liberar
        self.mensagem = mensagem
        self.max_tentativas = max_tentativas
        self.janela = janela
        self.bloqueio = bloqueio
        self._falhas: dict[str, list[float]] = {}
        self._bloqueado_ate: dict[str, float] = {}

    def verificar(self, chave: str) -> None:
        fim = self._bloqueado_ate.get(chave)
        if fim is None:
            return
        restante = fim - time.time()
        if restante <= 0:
            self.limpar(chave)  # cumpriu o bloqueio: volta a ter todas as tentativas
            return
        minutos = max(1, math.ceil(restante / 60))
        texto = f"{minutos} minuto" if minutos == 1 else f"{minutos} minutos"
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=self.mensagem.format(minutos=texto),
            headers={"Retry-After": str(math.ceil(restante))},
        )

    def registrar_falha(self, chave: str) -> None:
        agora = time.time()
        falhas = [t for t in self._falhas.get(chave, []) if agora - t < self.janela]
        falhas.append(agora)
        if len(falhas) >= self.max_tentativas:
            self._falhas.pop(chave, None)
            self._bloqueado_ate[chave] = agora + self.bloqueio
        else:
            self._falhas[chave] = falhas

    def limpar(self, chave: str) -> None:
        self._falhas.pop(chave, None)
        self._bloqueado_ate.pop(chave, None)

    def limpar_email(self, email: str) -> None:
        """Tira o bloqueio do email em qualquer aparelho (chaves "ip|email")."""
        sufixo = "|" + email.lower()
        for chave in [c for c in {*self._falhas, *self._bloqueado_ate} if c.endswith(sufixo)]:
            self.limpar(chave)


# ── Limitadores do login e da recuperação de senha ────────────────────────────
# Ficam aqui (e não no router) porque o reset do administrador também limpa.

limitador_login = LimitadorTentativas(
    "Muitas tentativas com senha errada. Por segurança, o login deste email "
    "fica bloqueado por {minutos}, mesmo com a senha certa."
)

# Pedidos de código: 3 por email a cada 15 min (não entope a caixa de ninguém)
limitador_pedido_email = LimitadorTentativas(
    "Já enviamos códigos demais para este email. Confira a caixa de entrada e o "
    "spam, ou peça de novo daqui a {minutos}.",
    max_tentativas=3,
)

# Pedidos e códigos errados por aparelho: freia quem testa vários emails
limitador_recuperacao_ip = LimitadorTentativas(
    "Muitas tentativas de recuperar senha deste aparelho. Tente de novo daqui a {minutos}.",
    max_tentativas=10,
    janela=60 * 60,
    bloqueio=30 * 60,
)


def ip_do_cliente(request: Request) -> str:
    # No Render o IP real do cliente vem no X-Forwarded-For
    encaminhado = request.headers.get("x-forwarded-for")
    if encaminhado:
        return encaminhado.split(",")[0].strip()
    return request.client.host if request.client else "desconhecido"
