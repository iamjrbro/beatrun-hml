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
  const sparkle = (x, y, size = 1) => {
    line([[x - size, y], [x + size, y]], '#ffffff', 0.65);
    line([[x, y - size], [x, y + size]], '#ecf5ff', 0.65);
  };
  // Relaxed blue denim with stitched seams and rhinestone highlights.
  [-1, 1].forEach(side => {
    ctx.save(); ctx.translate(side * 10, 21);
    ctx.rotate(airborne ? side * -0.35 : swing * side * 0.35);
    shape(-8, -2, 17, 29, 6, side < 0 ? '#365572' : '#4d7293');
    line([[2, 5], [1, 22]], '#8eacc5', 0.8);
    line([[-6, 1], [-6, 23]], '#243d59', 0.8);
    line([[-4, 5], [4, 6]], '#698da9', 1.5);
    for (let i = 0; i < 9; i++) {
      const dx = -5 + (i * 7 % 12), dy = 2 + (i * 11 % 21);
      oval(dx, dy, 0.65, 0.65, '#cbd7e5');
      if (i % 3 === 0) sparkle(dx, dy, 1.4);
    }
    shape(-9, 23, 24, 10, 5, '#14151e');
    shape(-9, 30, 24, 3, 1, '#d9d4c8');
    line([[3, 26], [9, 26]], '#929398', 1.5);
    ctx.restore();
  });
  // Plain black short-sleeve polo, with a folded collar and button placket.
  shape(-23, -15, 46, 42, 10, '#202129');
  line([[-18, 1], [-18, 22]], '#34353e', 1);
  line([[18, 1], [18, 22]], '#34353e', 1);
  line([[-18, 25], [18, 25]], '#43444c', 1);
  // Wallet chain.
  ctx.strokeStyle = '#aaa9b5'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(15, 25, 7, 11, -0.25, 0, Math.PI); ctx.stroke();
  [-1, 1].forEach(side => {
    ctx.save(); ctx.translate(side * 22, -8);
    ctx.rotate(airborne ? side * -0.65 : -swing * side * 0.38);
    shape(-5, 7, 10, 22, 4, '#dfac8d');
    shape(-7, -2, 14, 15, 4, '#282931');
    line([[-6, 11], [6, 11]], '#484951');
    // Stylized ink on the visible forearms.
    line([[-3, 16], [2, 18], [-2, 21], [3, 23]], '#777177', 1.1);
    oval(0, 28, 5.7, 6.2, '#dfac8d');
    line([[-3, 26], [1, 30], [3, 26]], '#67646b', 1.3);
    // Front view: his anatomical left wrist is on the viewer's right.
    if (side > 0) {
      shape(-6, 23, 12, 5, 1.8, '#929caa');
      for (let i = -4; i <= 4; i += 2) {
        oval(i, 25.5, 1.4, 1.7, '#e6eaf2');
        oval(i, 25, 0.6, 0.65, '#ffffff');
      }
      sparkle(3, 24, 2); sparkle(-4, 27, 1.3);
    }
    ctx.restore();
  });
  // Neck tattoos remain visible above the collar.
  shape(-9, -24, 18, 15, 4, '#d6a084');
  line([[-7, -22], [-3, -14], [0, -21], [4, -13], [7, -22]], '#686268', 2);
  line([[-6, -17], [5, -17]], '#686268', 1.2);
  // Polo collar sits beneath the silver name chain.
  shape(-2, -11, 4, 17, 1, '#34353c');
  line([[-11, -15], [-3, -8], [-7, -4], [-14, -11]], '#666771', 1.3);
  line([[11, -15], [3, -8], [7, -4], [14, -11]], '#666771', 1.3);
  oval(0, -5, 0.65, 0.65, '#b7bec9'); oval(0, 0, 0.65, 0.65, '#b7bec9');
  ctx.strokeStyle = '#a8b1c1'; ctx.lineWidth = 2.7;
  ctx.beginPath(); ctx.moveTo(-10, -17); ctx.quadraticCurveTo(-15, 0, 0, 8);
  ctx.quadraticCurveTo(15, 0, 10, -17); ctx.stroke();
  ctx.strokeStyle = '#edf1fa'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-10, -17); ctx.quadraticCurveTo(-13, 0, 0, 7);
  ctx.quadraticCurveTo(13, 0, 10, -17); ctx.stroke();
  // Iced silver LUKETA pendant: dark bevel, silver face, diamond glints.
  shape(-15, 6, 30, 10, 2, '#7e899e');
  shape(-14, 6.7, 28, 8.3, 1.3, '#cbd3e0');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '900 6.5px Arial, sans-serif'; ctx.fillStyle = '#414d65';
  ctx.fillText('LUKETA', 0, 11.4);
  ctx.fillStyle = '#ffffff'; ctx.fillText('LUKETA', 0, 10.8);
  sparkle(-12, 7.5, 1.4); sparkle(11, 13, 1.8); sparkle(3, 7, 1);
  // Ears and softly shaded face: a short blond crop, never a fringe.
  oval(-21, -36, 3.4, 6, '#cf957c'); oval(21, -36, 3.4, 6, '#e4b398');
  const skin = ctx.createLinearGradient(-20, -40, 21, -28);
  skin.addColorStop(0, '#c98e76'); skin.addColorStop(0.55, '#f0c4a4'); skin.addColorStop(1, '#dca68b');
  ctx.fillStyle = skin; ctx.beginPath();
  ctx.moveTo(-21, -46); ctx.bezierCurveTo(-23, -66, 22, -68, 21, -46);
  ctx.lineTo(20, -31); ctx.bezierCurveTo(18, -19, 10, -16, 0, -16);
  ctx.bezierCurveTo(-10, -16, -18, -21, -20, -31); ctx.closePath(); ctx.fill();
  shape(-21, -64, 42, 17, [17, 17, 3, 3], '#c1ad79');
  shape(-18, -65, 36, 12, [14, 14, 2, 2], '#dfcd9b');
  for (let i = 0; i < 24; i++) {
    const x = -15 + (i * 7 % 30), y = -60 + (i * 3 % 8);
    line([[x, y + 2], [x + 1.6, y]], i % 3 ? '#f6e4b7' : '#b79d66', 0.9);
  }
  // Strong brows, green irises, small highlights.
  [-1, 1].forEach(side => {
    const ex = side * 8.5;
    line([[ex - 5, -44], [ex, -46], [ex + 4, -44.5]], '#75624f', 2.8);
    oval(ex, -39.8, 5.3, 2.4, '#f5e9dc');
    oval(ex + 0.7, -39.5, 2.4, 2.2, '#8a956f');
    oval(ex + 1, -39.4, 1.2, 1.7, '#333936');
    oval(ex + 1.5, -40.6, 0.8, 0.8, '#ffffff');
    line([[ex - 4.5, -41], [ex, -42], [ex + 4, -40.9]], '#846b5a', 0.9);
  });
  line([[0, -38], [-2.4, -32], [0, -30.5], [3.4, -32]], '#bf876f', 1.1);
  oval(-2.8, -31.6, 1.1, 0.65, '#a77364'); oval(3.2, -31.6, 1.1, 0.65, '#a77364');
  // Goatee, understated smile and silver studs.
  ctx.strokeStyle = '#726455'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, -29, 10, 0.22, Math.PI - 0.22); ctx.stroke();
  oval(0, -21.5, 4, 1.7, '#7c6955');
  oval(0, -26, 6.3, 2.5, '#bb7d7c');
  line([[-6, -26.5], [-2, -27], [0, -26.4], [2, -27], [6, -26.5]], '#955e60', 0.7);
  line([[-3, -24.7], [3, -24.7]], '#d99c96', 0.8);
  oval(-21, -33, 1.4, 1.4, '#e4eaf4'); oval(21, -33, 2.2, 2.2, '#eee9e5');
  oval(-21.4, -33.5, 0.9, 0.9, '#ffffff');
  ctx.restore();
}
