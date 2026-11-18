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
    def __init__(self, mensagem: str):
        # "{minutos}" na mensagem é trocado pelo tempo que falta para liberar
        self.mensagem = mensagem
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
        falhas = [t for t in self._falhas.get(chave, []) if agora - t < JANELA_SEGUNDOS]
        falhas.append(agora)
        if len(falhas) >= MAX_TENTATIVAS:
            self._falhas.pop(chave, None)
            self._bloqueado_ate[chave] = agora + BLOQUEIO_SEGUNDOS
        else:
            self._falhas[chave] = falhas

    def limpar(self, chave: str) -> None:
        self._falhas.pop(chave, None)
        self._bloqueado_ate.pop(chave, None)


def ip_do_cliente(request: Request) -> str:
    # No Render o IP real do cliente vem no X-Forwarded-For
    encaminhado = request.headers.get("x-forwarded-for")
    if encaminhado:
        return encaminhado.split(",")[0].strip()
    return request.client.host if request.client else "desconhecido"
