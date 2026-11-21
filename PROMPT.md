# Prompt: montar o Levl com o Claude Code

Como usar:
1. Instale o Claude Code e faça login (passos 1 e 2 do [README](README.md#opção-2-montar-do-zero-com-o-claude-code)).
2. Copie **todo** o bloco abaixo e cole no Claude Code.

O Claude Code vai explicar cada passo e pedir a sua confirmação antes de instalar qualquer coisa. Você só precisa clicar, confirmar e fazer o login quando ele pedir.

````text
Quero instalar o Levl, um medidor de consumo do plano do Claude para Windows.
Repositório oficial: https://github.com/Jhons-neural/levl

Regras:
- Fale comigo em português simples, curto e um passo por vez.
- Antes de instalar qualquer programa, diga o que é, de onde vem e peça a minha confirmação.
- Instale só de fontes oficiais (winget e npm) e nada além do que está listado aqui.
- Nunca leia, mostre ou envie o conteúdo de credenciais ou tokens. No máximo, confira se o arquivo existe.
- Se algo falhar, mostre o erro em uma linha, explique o que significa e proponha a correção.

Passos:
1. Confira que estou no Windows 10 ou 11 (`[Environment]::OSVersion`). Avise que o efeito de vidro só aparece no Windows 11.
2. Confira se o Git está instalado (`git --version`). Se não estiver, instale com
   `winget install --id Git.Git -e --source winget`.
3. Confira se o Node.js 22 ou mais novo está instalado (`node -v`). Se não estiver, instale com
   `winget install --id OpenJS.NodeJS.LTS -e --source winget`.
   Depois de instalar o Git ou o Node, abra um novo terminal ou atualize o PATH da sessão para que os comandos sejam encontrados.
4. Crie a pasta `%USERPROFILE%\Projetos` se ela não existir e clone o repositório:
   `git clone https://github.com/Jhons-neural/levl.git "%USERPROFILE%\Projetos\levl"`
   Se a pasta já existir, rode `git pull` nela.
5. Dentro da pasta, rode `npm ci` e depois `npm test`. Todos os testes precisam passar; se algum falhar, pare e me mostre qual.
6. Gere o instalador com `npm run dist`. Leva alguns minutos e cria `dist\Levl-Setup-<versão>.exe`.
7. Instale sem janelas com `Start-Process -Wait "<caminho do .exe>" -ArgumentList '/S'`. O Levl abre sozinho no canto da tela.
8. Confira se existe o arquivo `%USERPROFILE%\.claude\.credentials.json`, sem abrir nem ler o conteúdo.
   - Se não existir: peça para eu digitar `/login` aqui no Claude Code e entrar com a minha conta do Claude (Pro ou Max). Espere eu confirmar.
9. No final, me explique em até 6 linhas:
   - clicar no termômetro abre o painel;
   - arrastar o tubo muda a posição, e na borda lateral ele fica vertical;
   - Ctrl+Alt+L mostra e esconde; Ctrl+Alt+K deixa os cliques atravessarem;
   - a engrenagem abre as configurações (visual, transparência, tamanho e avisos);
   - "Abrir Leitor" mostra a comparação com a semana passada e os projetos que mais gastam;
   - as atualizações chegam sozinhas pelo repositório oficial.
10. Abra no navegador https://github.com/Jhons-neural/levl para eu dar uma estrela no projeto, se eu quiser.
````

## Problemas comuns

| O que aparece | O que fazer |
|---|---|
| "abra o Claude Code para atualizar" | Abra o Claude Code e rode `/login`. |
| "muitas consultas · volto em 10 min" | É normal: a Anthropic pediu uma pausa. O Levl tenta de novo sozinho. |
| "O Windows protegeu o computador" | Clique em **Mais informações** e depois em **Executar assim mesmo**. O instalador não tem certificado pago. |
| `winget` não encontrado | Instale o "Instalador de Aplicativo" pela Microsoft Store e tente de novo. |
| `npm ci` falhou por rede | Tente de novo; o primeiro download do Electron é grande (cerca de 100 MB). |
