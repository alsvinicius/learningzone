# Contribuindo

Obrigado por considerar uma contribuição. Este guia define como preparar, validar e propor mudanças no Skill Builder. Para decisões de arquitetura, prefira uma issue ou discussão antes de uma mudança ampla; correções pequenas podem vir diretamente em pull request.

## Princípios do projeto

1. **Código genérico:** regras específicas de uma certificação pertencem a adaptadores locais ou aos dados do usuário, nunca à interface comum.
2. **Conteúdo privado por padrão:** `data/` é ignorado, salvo o `data/index.json` vazio que serve de ponto de entrada. Não force arquivos de conteúdo com `git add -f`.
3. **Local-first:** não introduza telemetria, conta, sincronização ou chamadas de rede sem requisito discutido e aprovado no projeto.
4. **Sem dependência de runtime:** a aplicação web deve continuar estática e funcionar sem instalação de pacotes. Ferramentas de desenvolvimento precisam declarar requisitos e propósito.
5. **Contrato explícito:** mudanças no formato de conteúdo devem atualizar a referência, validador, exemplos de teste e guia de migração.
6. **Acessibilidade e segurança:** preserve navegação por teclado, semântica HTML, tratamento de Markdown como conteúdo não confiável e validação de caminhos.

## Ambiente

- Python 3.10+ para validar e executar os testes Python.
- Node.js 18+ para os testes JavaScript (`node --test`).
- Navegador moderno para revisar interface e PWA.
- Git para controle de versão.

Nenhum `npm install` é necessário. Os testes são executados com bibliotecas padrão. Na raiz do clone:

```bash
make check
make serve
```

Para iniciar ou parar a interface por meio da Project Gallery, use `make start` e `make stop`. O serviço declarado no manifesto é somente a aplicação Web estática; o alvo `start` recebe a porta alocada pela galeria em `WEB_PORT`.

## Fluxo de contribuição

1. Crie uma branch curta a partir da versão atual.
2. Faça uma mudança focada e mantenha o diff legível.
3. Atualize documentação Diátaxis na mesma alteração sempre que comportamento, contrato ou procedimento mudar.
4. Execute `make check`.
5. Para mudanças de interface, abra a aplicação e teste estados com catálogo vazio, conteúdo presente em fixture local, tamanhos estreitos, teclado e leitor de tela quando aplicável.
6. Revise `git status --short` e `git diff --check`. Confirme que nenhum dado pessoal ou exportação bruta aparece no diff.
7. Abra um pull request descrevendo problema, comportamento anterior/novo, decisão de compatibilidade e evidências de validação.

Não inclua screenshots com dados pessoais, dumps, cookies, tokens, exportações de cursos, questões protegidas, chaves ou dados do navegador. Se uma fixture for necessária, crie dados sintéticos originais em `tests/fixtures/`, identifique-os como sintéticos e mantenha-os pequenos.

## Testes e critérios de pronto

`make check` executa a suíte Python, os testes JavaScript e `tools/check.py`. `make check-public` também verifica que o índice está vazio e que arquivos locais em `data/` são ignorados; execute-o antes de preparar uma distribuição pública. A mudança está pronta quando:

- os testes relevantes passam e novas regras têm cobertura de comportamento;
- o catálogo público continua vazio, exceto se uma fixture sintética tiver autorização e localização exclusiva em `tests/fixtures/`;
- conteúdo de `data/` não aparece no diff;
- o contrato, exemplos, navegação da documentação e instruções de agente continuam consistentes;
- não há links locais quebrados, caminhos inseguros ou erros de console introduzidos.

Não escreva testes que apenas repetem a implementação. Dê preferência a casos que protegem comportamento, compatibilidade, acessibilidade, privacidade ou integridade dos dados.

## Alterações no contrato de conteúdo

O contrato está em `docs/diataxis/reference/content-contract.md`. Mudanças incompatíveis exigem aumento de `schemaVersion` e uma nota de migração. Um validador deve rejeitar formatos desconhecidos com erro que aponte arquivo e campo. Teste catálogo vazio, catálogo mínimo válido e casos inválidos sem usar conteúdo real.

## Segurança e privacidade

Reporte vulnerabilidades em privado ao mantenedor do projeto, usando o canal de segurança configurado no repositório quando existir. Não publique detalhes exploráveis antes de uma correção coordenada. Não envie dados de usuários nos relatos. A aplicação não deve carregar Markdown remoto nem interpretar HTML arbitrário dos materiais.

## Escopo de revisão

Uma contribuição não deve ampliar silenciosamente o produto para um serviço multiusuário ou de hospedagem de conteúdo. Discuta primeiro mudanças que adicionem sincronização, analytics, backend, dependências de terceiros, suporte específico de fornecedor ou distribuição de bancos de questões.
