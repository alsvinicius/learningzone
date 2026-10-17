# Comandos e requisitos

Todos os comandos são executados na raiz do projeto. O Makefile usa Python e Node no `PATH`; não instala dependências.

| Comando | Efeito |
|---|---|
| `make check` | Executa testes Python, Node e validador do catálogo/PWA. |
| `make test` | Executa testes Python e Node. |
| `make check-public` | Valida a aplicação e exige catálogo vazio e conteúdo em `data/` ignorado pelo Git. |
| `make serve` | Executa `make check` e serve o app em loopback na porta 8000. |
| `make serve PORT=8080` | Usa uma porta local alternativa. |
| `make serve-private` | Serve `.local/private-data/index.personal.json` pela rota `data/index.json`, sem alterar o índice público; falha se o índice privado não existir. |
| `make clean` | Remove diretórios `__pycache__` do projeto. |
| `python3 tools/check.py` | Valida índice, dados declarados e recursos essenciais do PWA. |
| `python3 tools/normalize.py FILE CERT EXAM ATTEMPT` | Converte exportação local compatível para o formato comum. |

Python 3.10+ é necessário para ferramentas e testes; Node.js 18+ é usado pelos testes JS. A interface não tem build nem dependências de runtime. O servidor local escuta `127.0.0.1`; hospedagem deve fornecer HTTPS para habilitar service worker.
