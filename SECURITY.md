# Segurança

O Skill Builder é uma aplicação estática. Não recebe contas nem envia conteúdo de estudo a um backend. Dados de catálogo e materiais podem conter informação privada; mantenha-os fora de issues e pull requests.

Para relatar uma vulnerabilidade, abra um contato privado com a pessoa mantenedora do repositório antes de divulgar detalhes. Inclua versão/commit, passos mínimos de reprodução e impacto, sem anexar conteúdo pessoal, tokens ou dados de navegador. Não publique um exploit antes de coordenar a correção.

Mudanças de segurança devem preservar validação de caminhos, contenção em `data/`, escape seguro de conteúdo Markdown e ausência de execução de HTML fornecido como material.
