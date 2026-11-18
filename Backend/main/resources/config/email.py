import logging
import os

import httpx

# ── Envio de email (Brevo) ────────────────────────────────────────────────────
#
# O Render gratuito bloqueia SMTP, então o envio é pela API HTTP do Brevo.
# Variáveis no Render:
#   BREVO_API_KEY       chave da API (Brevo → SMTP & API → API Keys)
#   EMAIL_REMETENTE     email confirmado como remetente no Brevo (o Gmail do movimento)
#   EMAIL_REMETENTE_NOME nome que aparece para quem recebe (padrão "Agapello")
#   EMAIL_LOG_CODIGO    "true" só no ambiente de TESTE: escreve o email no log
#                       em vez de exigir o Brevo. Nunca ligar em produção.

logger = logging.getLogger(__name__)

BREVO_URL = "https://api.brevo.com/v3/smtp/email"


def _config() -> tuple[str, str, str, bool]:
    return (
        os.getenv("BREVO_API_KEY", ""),
        os.getenv("EMAIL_REMETENTE", ""),
        os.getenv("EMAIL_REMETENTE_NOME", "Agapello"),
        os.getenv("EMAIL_LOG_CODIGO", "false").lower() == "true",
    )


def enviar_email(para: str, nome: str, assunto: str, texto: str, html: str) -> bool:
    """Envia um email. Devolve False se falhou (quem chama decide o que fazer)."""
    chave, remetente, nome_remetente, so_log = _config()

    if so_log:
        logger.warning(f"[email de teste] para {para} | {assunto}\n{texto}")
        return True

    if not chave or not remetente:
        logger.error("Envio de email não configurado (BREVO_API_KEY / EMAIL_REMETENTE).")
        return False

    try:
        resposta = httpx.post(
            BREVO_URL,
            headers={"api-key": chave, "accept": "application/json"},
            json={
                "sender": {"email": remetente, "name": nome_remetente},
                "to": [{"email": para, "name": nome}],
                "subject": assunto,
                "textContent": texto,
                "htmlContent": html,
            },
            timeout=15,
        )
    except httpx.HTTPError as e:
        logger.error(f"Falha ao enviar email: {e}")
        return False

    if resposta.status_code >= 300:
        logger.error(f"Brevo recusou o email ({resposta.status_code}): {resposta.text[:300]}")
        return False
    return True
