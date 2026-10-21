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
- Recorde salvo no navegador com `localStorage`
- Personagem original em Canvas: cabelo descolorido curto, olhos verdes, cavanhaque, brincos de prata, tatuagens estilizadas e jeans preto oversized com brilhos
- Escolha de polo preta, camiseta branca lisa, moletom verde neon ou laranja neon; jeans oversized preto liso, com brilhos ou camuflado militar; tênis preto, Nike branco ou bota estilo Timberland; vista de frente ou de perfil
- Cabelo loiro por padrão ou rosa, nas duas vistas
- Prévia imediata e combinação salva no navegador; opção de escolher novamente após o fim da partida
- Textura abstrata e discreta de tatuagem no pescoço, subindo sob o queixo
- Corrente de prata com pingente LUKETA e pulseira iced Cuban cravejada no braço direito
- Caminhada e obstáculos começam devagar e aceleram progressivamente, com limite de velocidade
- Duração do salto acompanha a velocidade da corrida para manter uma distância consistente ao ultrapassar obstáculos
- Prévia ampliada do personagem na abertura
- Botão para silenciar música e efeitos
- Física com passo fixo de 60 Hz, independente da taxa de atualização da tela
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
- `character.js` — desenho original e animação do personagem, sem carregar fotos ou imagens externas
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

- Centralizar constantes de gameplay
- Isolar a detecção de colisão
- Adicionar testes para regras de gameplay
- Melhorar os padrões de spawn e progressão
- Otimizar partículas e efeitos para dispositivos móveis
- Adicionar acessibilidade e mais opções de controle
- Modularizar a lógica JavaScript conforme o projeto crescer

## Verificação

Com Node.js 24 ou superior, execute `node tests/game.test.mjs` para verificar renderização básica, pulo duplo, aterrissagem, colisão, pontuação, recorde, redimensionamento e áudio. A renderização final também deve ser conferida no navegador, em desktop e celular.

## Autor

**Julia Ribeiro**

GitHub: https://github.com/iamjrbro
