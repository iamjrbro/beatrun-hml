# Code Review

## Visão geral

O Beat Runner é um projeto pequeno e adequado para uma arquitetura baseada em Canvas: não depende de framework, concentra o gameplay em um loop e mantém a renderização organizada por funções.

A revisão considera o histórico recente do repositório e a implementação atual.

## O que está funcionando bem

### Organização

O game.js está dividido em blocos de áudio, estado, player, spawn, update, background, renderização, partículas, telas e game loop. Para um projeto desse tamanho, essa divisão já facilita bastante a manutenção.

### Feedback visual

Partículas, trail, glow, animação de corrida e textos de combo dão feedback imediato ao jogador sem bibliotecas externas.

### Mobile

O uso de pointerdown, touch-action: none e viewport responsivo é adequado ao objetivo mobile.

### Progressão

Score, combo, nível, frequência de spawn e velocidade formam uma curva de dificuldade simples e compreensível.

## Pontos que eu ajustaria

### 1. Ordem do loop

O loop atual desenha e depois executa update. Isso cria uma defasagem de um frame entre estado e renderização.

Prefira:

```text
update()
draw()
requestAnimationFrame(loop)
```

### 2. Centralizar constantes

Gravidade, força do pulo, intervalo de spawn, velocidade, margem de colisão e thresholds estão espalhados.

Uma configuração centralizada facilita balancear o jogo:

```js
const CONFIG = {
  physics: { gravity: 0.65, jumpForce: -15, maxJumps: 2 },
  difficulty: { pointsPerLevel: 250, minSpawnInterval: 38, baseSpawnInterval: 95 }
};
```

### 3. Isolar colisão

Separe a matemática de colisão da lógica de gameplay:

```js
function checkCollision(player, obstacle) {
  // retorna true quando as hitboxes se sobrepõem
}
```

Isso torna a regra testável e mais fácil de ajustar.

### 4. Tratamento de áudio

O catch vazio evita quebrar o jogo, mas dificulta diagnóstico. Durante desenvolvimento, prefira logar o erro:

```js
catch (error) {
  console.warn('Audio error:', error);
}
```

### 5. Estado global

Score, combo, level, frame e STATE funcionam neste tamanho, mas podem ser agrupados quando o jogo crescer:

```js
const gameState = {
  status: 'start',
  score: 0,
  combo: 0,
  level: 1,
  frame: 0
};
```

### 6. High score

O high score atualmente existe somente durante a sessão. O próximo passo natural é persistir com localStorage.

### 7. Comentários

Os comentários de seção são bons, mas alguns podem explicar a intenção em vez de repetir o que a função já deixa evidente.

Prefira:

```js
// Reduzimos a hitbox para evitar colisões injustas
// quando o sprite ainda está visualmente distante do obstáculo.
```

em vez de apenas:

```js
// colisão
```

Comentários de intenção envelhecem melhor que comentários que repetem o código.

## Histórico recente

O histórico mostra experimentação entre versões do Beat Runner e uma versão Cloud Runner, seguida do retorno ao Beat Runner e de ajustes no personagem.

Também houve uma etapa em que o desenho dos headphones foi comentado e, posteriormente, removido.

Para os próximos commits, prefira mensagens descritivas e pequenas, como:

```text
refactor: extract collision detection
docs: document gameplay and controls
fix: prevent unfair obstacle collisions
perf: reduce canvas shadow usage on mobile
```

Isso facilita entender a evolução do projeto sem precisar abrir cada diff.

## Prioridade

### Alta

1. Extrair constantes de gameplay.
2. Separar colisão em função própria.
3. Reorganizar o loop para update → draw.
4. Persistir high score.

### Média

5. Melhorar tratamento de áudio.
6. Reduzir estado global.
7. Padronizar comentários de intenção.

### Baixa

8. Modularizar o JavaScript em arquivos menores.
9. Adicionar testes automatizados.
10. Criar uma camada de configuração/debug.

## Conclusão

A base é boa para um mini game Canvas e não precisa ser transformada em uma arquitetura complexa.

O maior ganho agora viria de organização e manutenção, não de adicionar framework. O projeto pode continuar em vanilla JavaScript e ficar significativamente mais profissional centralizando configuração, isolando colisão e estado e melhorando a documentação.