import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from fastapi import FastAPI, Request, Depends
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from fastapi.templating import Jinja2Templates
from resources.routers import missao_router, servos_router, frequencia_router, auth_router, usuarios_router, pastas_router
from resources.config.auth import verify_api_key
from resources.config.auditoria import AuditoriaMiddleware

app = FastAPI(
    title="AgapeSys Api",
    description="API backend do sistema AgapeSys",
    version="1.0.0"
)

# CORS — necessário para o Expo/React Native acessar a API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Log de quem alterou o quê (POST/PUT/PATCH/DELETE) — ver resources/config/auditoria.py
app.add_middleware(AuditoriaMiddleware)

BASE_DIR = Path(__file__).resolve().parent

templates = Jinja2Templates(
    directory=BASE_DIR / "resources" / "templates"
)

@app.get("/", response_class=HTMLResponse, include_in_schema=False)
def home(request: Request):
    return templates.TemplateResponse(request=request, name="home.html")

# Routers protegidos por API Key
app.include_router(servos_router.router, dependencies=[Depends(verify_api_key)])
app.include_router(missao_router.router, dependencies=[Depends(verify_api_key)])
app.include_router(frequencia_router.router, dependencies=[Depends(verify_api_key)])
app.include_router(auth_router.router, dependencies=[Depends(verify_api_key)])
app.include_router(usuarios_router.router, dependencies=[Depends(verify_api_key)])
app.include_router(pastas_router.router, dependencies=[Depends(verify_api_key)])
