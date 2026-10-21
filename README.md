# Beat Runner

Um mini game de corrida em HTML5 Canvas com estética neon e temática musical.

Beat Runner é um jogo web experimental feito em JavaScript puro, com foco em Canvas, animação, áudio e interação mobile.

## Como jogar

- **Espaço** ou **Seta para cima**: pular
- **Toque na tela**: pular
- O personagem possui **duplo pulo**
- Evite os obstáculos
- Passe pelos obstáculos para aumentar o score e o combo
- A cada 250 pontos, o nível aumenta
- A velocidade e a dificuldade aumentam conforme o nível
- A colisão com um obstáculo encerra a partida

## Recursos

- HTML5 Canvas para toda a renderização do jogo
- Física de gravidade e salto
- Duplo pulo
- Obstáculos gerados durante a partida
- Sistema de score e combo
- Progressão de dificuldade por nível
- Partículas e efeitos visuais
- Trail e animação do personagem
- Tela inicial e Game Over
- High score durante a sessão
- Efeitos sonoros com Web Audio API
- Música de fundo com HTML5 Audio
- Controles para teclado e dispositivos touch
- Layout responsivo para desktop e mobile
- Compatibilidade com navegadores que não possuem `roundRect` nativamente

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
├── index.html
├── style.css
├── game.js
├── music.mp3
└── README.md
```

- `index.html` — estrutura da página, HUD e elemento de áudio
- `style.css` — layout e estilos da interface
- `game.js` — lógica do jogo, física, input, obstáculos, áudio e renderização
- `music.mp3` — música de fundo

## Arquitetura

O gameplay é executado em um loop baseado em `requestAnimationFrame`.

De forma simplificada, o ciclo do jogo é:

```text
input
  ↓
update
  ↓
draw
  ↓
requestAnimationFrame
  ↺
```

A lógica é organizada em responsabilidades como estado do jogo, player, obstáculos, partículas, áudio, atualização da física e renderização.

## Pontuação e dificuldade

Cada obstáculo ultrapassado contribui para o score e para o combo.

O bônus do combo segue a lógica:

```text
bonus = 10 × (1 + floor(combo / 5))
```

O nível é baseado no score:

```text
level = 1 + floor(score / 250)
```

Com o avanço dos níveis, a dificuldade aumenta por meio da velocidade e da frequência dos obstáculos.

## Áudio

Os efeitos de salto, pontuação e colisão são sintetizados em tempo real usando a Web Audio API.

A música de fundo é carregada pelo arquivo `music.mp3`.

A reprodução de áudio depende da interação do usuário por causa das políticas de autoplay dos navegadores.

## Executar localmente

O projeto não possui build step ou dependências obrigatórias.

Clone o repositório e sirva os arquivos por um servidor HTTP local:

```bash
git clone https://github.com/iamjrbro/beatrun.git
cd beatrun
python3 -m http.server 8000
```

Depois, acesse `http://localhost:8000` no navegador.

Também é possível publicar os arquivos em qualquer serviço de hospedagem estática compatível.

## Compatibilidade

O projeto foi desenvolvido para navegadores modernos em desktop e mobile.

O código possui tratamento para `AudioContext`/`webkitAudioContext`, eventos de ponteiro e fallback para `roundRect`.

## Roadmap

- Persistir o high score com `localStorage`
- Adicionar controle de volume e mute
- Centralizar constantes de gameplay
- Isolar a detecção de colisão
- Adicionar testes para regras de gameplay
- Melhorar os padrões de spawn e progressão
- Otimizar partículas e efeitos para dispositivos móveis
- Adicionar acessibilidade e mais opções de controle
- Modularizar a lógica JavaScript conforme o projeto crescer

## Autor

**Julia Ribeiro**

GitHub: https://github.com/iamjrbro