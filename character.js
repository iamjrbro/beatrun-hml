/* Original Canvas artwork, inspired by the reference photos. No photo assets required. */
function drawDJ(ctx, { x, y, scale = 1, phase = 0, running = false, airborne = false }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const swing = running ? Math.sin(phase * 0.25) : Math.sin(phase * 0.035) * 0.08;
  const shape = (x, y, w, h, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  };
  const oval = (x, y, rx, ry, color) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  };
  const line = (points, color, width = 1) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  };
  // Baggy trousers and black sneakers, with articulated running legs.
  [-1, 1].forEach(side => {
    ctx.save(); ctx.translate(side * 10, 21);
    ctx.rotate(airborne ? side * -0.35 : swing * side * 0.35);
    shape(-8, -2, 17, 29, 6, side < 0 ? '#20212c' : '#30313d');
    line([[2, 5], [1, 22]], '#454552');
    shape(-9, 23, 24, 10, 5, '#14151e');
    shape(-9, 30, 24, 3, 1, '#d9d4c8');
    line([[3, 26], [9, 26]], '#929398', 1.5);
    ctx.restore();
  });
  // Oversized black tee and leather jacket.
  shape(-23, -15, 46, 42, 11, '#12131c');
  shape(-13, -12, 26, 35, 5, '#242430');
  line([[-12, -11], [-18, 3], [-15, 24]], '#50515f', 1.3);
  line([[13, -11], [18, 3], [16, 23]], '#50515f', 1.3);
  line([[-17, -8], [-10, 0], [-14, 5]], '#777580', 1.2);
  line([[17, -8], [10, 0], [14, 5]], '#777580', 1.2);
  // Tiny original waveform shirt print.
  line([[-7, 9], [-5, 9], [-3, 4], [0, 14], [3, 3], [5, 9], [7, 9]], '#d8d3c7', 1.4);
  // Wallet chain.
  ctx.strokeStyle = '#aaa9b5'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(15, 25, 7, 11, -0.25, 0, Math.PI); ctx.stroke();
  [-1, 1].forEach(side => {
    ctx.save(); ctx.translate(side * 22, -8);
    ctx.rotate(airborne ? side * -0.65 : -swing * side * 0.38);
    shape(-6, -2, 12, 27, 6, side < 0 ? '#242530' : '#353540');
    line([[-3, 3], [-3, 17]], '#565563');
    shape(-5, 20, 11, 5, 2, '#11121a');
    oval(0, 28, 5.7, 6.2, '#dfac8d');
    line([[-3, 26], [1, 30], [3, 26]], '#67646b', 1.3);
    if (side > 0) line([[-5, 24], [5, 24]], '#d7d6df', 2);
    ctx.restore();
  });
  // Neck tattoos remain visible above the collar.
  shape(-9, -24, 18, 15, 4, '#d6a084');
  line([[-7, -22], [-3, -14], [0, -21], [4, -13], [7, -22]], '#686268', 2);
  line([[-6, -17], [5, -17]], '#686268', 1.2);
  // Silver Cuban chain.
  ctx.strokeStyle = '#e3e0de'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-11, -12); ctx.quadraticCurveTo(0, 5, 11, -12); ctx.stroke();
  for (let i = -8; i <= 8; i += 4) oval(i, -5 - Math.abs(i) * 0.55, 1.2, 1.1, '#fff5dd');
  // Ears and softly shaded face: a short blond crop, never a fringe.
  oval(-20, -37, 4.5, 7, '#cf957c'); oval(20, -37, 4.5, 7, '#e4b398');
  const skin = ctx.createLinearGradient(-20, -40, 21, -28);
  skin.addColorStop(0, '#c98e76'); skin.addColorStop(0.55, '#f0c4a4'); skin.addColorStop(1, '#dca68b');
  shape(-20, -61, 40, 43, [17, 17, 18, 18], skin);
  shape(-20, -64, 40, 20, [18, 18, 5, 5], '#c6ae76');
  shape(-17, -64, 34, 13, [14, 14, 3, 3], '#e7d29a');
  for (let i = 0; i < 24; i++) {
    const x = -15 + (i * 7 % 30), y = -60 + (i * 3 % 8);
    line([[x, y + 2], [x + 1.6, y]], i % 3 ? '#f6e4b7' : '#b79d66', 0.9);
  }
  // Strong brows, green irises, small highlights.
  [-1, 1].forEach(side => {
    const ex = side * 8.5;
    line([[ex - 5, -44], [ex, -45.5], [ex + 4, -44.5]], '#78634f', 2.3);
    oval(ex, -39.8, 5, 3.1, '#f5e9dc');
    oval(ex + 0.7, -39.5, 2.5, 2.9, '#82906b');
    oval(ex + 1, -39.4, 1.25, 2, '#333936');
    oval(ex + 1.5, -40.6, 0.8, 0.8, '#ffffff');
    line([[ex - 4.5, -41], [ex, -42], [ex + 4, -40.9]], '#846b5a', 0.9);
  });
  line([[0, -38], [-1.7, -32], [1.7, -31]], '#bf876f', 1.2);
  // Goatee, understated smile and silver studs.
  ctx.strokeStyle = '#726455'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, -29, 10, 0.22, Math.PI - 0.22); ctx.stroke();
  oval(0, -21.5, 4, 1.7, '#7c6955');
  line([[-5, -27], [0, -26], [5, -27.5]], '#a46364', 1.6);
  oval(-21, -33, 2.2, 2.2, '#eee9e5'); oval(21, -33, 2.2, 2.2, '#eee9e5');
  oval(-21.4, -33.5, 0.9, 0.9, '#ffffff');
  // DJ headphones rest around the neck, leaving his hair and earrings visible.
  line([[-16, -15], [-15, -3], [0, 2], [15, -3], [16, -15]], '#0a0c13', 4);
  [-1, 1].forEach(side => {
    shape(side * 15 - 4, -14, 8, 13, 3, '#0c1019');
    line([[side * 15, -11], [side * 15, -5]], '#a5e6d7', 2);
  });
  ctx.restore();
}
