# Beat Runner

Um mini game de corrida em HTML5 Canvas com estética neon e temática musical.

A proposta é simples: controle o personagem, pule os obstáculos e mantenha o combo pelo maior tempo possível.

## Como jogar

- **Espaço** ou **Seta para cima**: pular
- **Toque na tela**: pular
- O personagem possui **duplo pulo**
- Evite os obstáculos musicais
- Quanto mais obstáculos você superar, maior será o score
- A cada 250 pontos, o nível aumenta e a velocidade/dificuldade sobe
- O jogo termina ao colidir com um obstáculo

## Recursos

- Renderização 100% em **HTML5 Canvas**
- Física simples de gravidade e salto
- Duplo pulo
- Obstáculos musicais gerados proceduralmente
- Sistema de score e combo
- Progressão de nível baseada no score
- Partículas para feedback visual
- Trail do personagem
- Animação de corrida
- Tela inicial e tela de Game Over
- High score durante a sessão
- Efeitos sonoros sintetizados com **Web Audio API**
- Música de fundo via elemento HTML5 `<audio>`
- Layout responsivo para desktop e mobile
- Suporte a toque/pointer events
- Polyfill de `roundRect` para compatibilidade com versões antigas do Safari

## Tecnologias

- HTML5
- CSS3
- JavaScript
- Canvas 2D API
- Web Audio API
- HTML5 Audio

Não há framework ou dependência externa obrigatória.

## Estrutura

```text
beatrun/
├── index.html    # Estrutura da página, HUD e áudio
├── style.css     # Layout e estilos da interface
├── game.js       # Física, input, gameplay e renderização
├── music.mp3     # Música de fundo, quando incluída no projeto
└── README.md
```

## Arquitetura do jogo

O jogo é dividido em três responsabilidades principais:

1. **Estado** — controla início, partida e Game Over.
2. **Update** — atualiza física, obstáculos, score, partículas e progressão.
3. **Draw** — renderiza cenário, personagem, obstáculos, partículas e telas.

O loop principal utiliza `requestAnimationFrame` para manter a animação sincronizada com o navegador.

## Sistema de pontuação

Cada obstáculo ultrapassado gera pontos.

```text
bonus = 10 × (1 + floor(combo / 5))
level = 1 + floor(score / 250)
```

Com o aumento do nível, os obstáculos aparecem com maior frequência e se movimentam mais rapidamente.

## Áudio

Os efeitos de salto, pontuação e colisão são sintetizados em tempo real com a Web Audio API.

A música de fundo é carregada de `music.mp3`.

Por causa das políticas de autoplay dos navegadores, a reprodução é iniciada somente depois de uma interação do usuário.

## Compatibilidade

O projeto foi pensado principalmente para navegadores modernos em desktop e mobile.

O código inclui tratamento para AudioContext/webkitAudioContext, pointer events e `roundRect` em navegadores antigos.

## Desenvolvimento

O projeto é propositalmente simples e não utiliza build step.

Para executar localmente, sirva a pasta por um servidor HTTP estático:

```bash
python3 -m http.server 8000
```

Depois, abra `http://localhost:8000`.

## Próximas melhorias

- Persistir o high score com `localStorage`
- Adicionar controle de volume/mute
- Separar a lógica do jogo em módulos
- Centralizar constantes de gameplay
- Adicionar testes para colisão e pontuação
- Melhorar o sistema de spawn para criar padrões de dificuldade
- Adicionar acessibilidade e alternativas de controle
- Adicionar uma tela de configurações
- Otimizar partículas e sombras para dispositivos móveis

## Créditos

Projeto desenvolvido por [Julia Ribeiro](https://github.com/iamjrbro).

Beat Runner é um projeto experimental criado como um mini game web com foco em JavaScript, Canvas e interação mobile.