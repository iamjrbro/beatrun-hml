/* Original Canvas artwork, inspired by the reference photos. No photo assets required. */
function drawNeckTattoo(ctx, x, y, scale) {
  // Small black silhouette of the reference's figure, layered dress and parasol.
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = '#242126'; ctx.strokeStyle = '#242126'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-6, 3); ctx.lineTo(1, -1); ctx.lineTo(8, 3);
  ctx.quadraticCurveTo(0, 1, -6, 3); ctx.fill();
  ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(1, 9); ctx.stroke();
  ctx.beginPath(); ctx.arc(-1, 5, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-3, 7); ctx.lineTo(1, 7); ctx.lineTo(5, 15);
  ctx.lineTo(-6, 15); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#817369'; ctx.lineWidth = 0.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(-3 - i, 9 + i * 2); ctx.lineTo(0, 10 + i * 2); ctx.lineTo(2 + i, 9 + i * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawShoes(ctx, shoes, x, y) {
  ctx.save(); ctx.translate(x, y);
  const box = (x, y, w, h, r, color) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  };
  if (shoes === 'boots') {
    box(1, -4, 15, 13, 2, '#b47e3d');
    box(0, 2, 26, 9, 3, '#cf9b55');
    box(1, -4, 14, 3, 1, '#4f3e30');
    box(-1, 9, 28, 4, 1, '#6b492c');
    ctx.strokeStyle = '#f2d3a0'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(10, i * 2); ctx.lineTo(16, i * 2 + 1); ctx.stroke();
    }
    for (let i = 1; i < 26; i += 4) box(i, 12, 2, 1.3, 0, '#30271f');
  } else {
    box(0, 1, 26, 10, 5, '#14151e'); box(0, 9, 26, 3, 1, '#d9dce3');
    ctx.strokeStyle = '#9299a6'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(11, 4); ctx.lineTo(18, 4); ctx.stroke();
  }
  ctx.restore();
}

function drawDJProfile(ctx, { x, y, scale, phase, running, airborne, outfit, shoes }) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const shirt = outfit === 'white' ? '#f4f3ef' : outfit === 'neon' ? '#c1ef35' : '#24252d';
  const seam = outfit === 'white' ? '#bfc1c1' : outfit === 'neon' ? '#789b24' : '#50525d';
  const box = (x, y, w, h, r, color) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  };
  const oval = (x, y, rx, ry, color) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  };
  const line = (points, color, width = 1) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  };
  const swing = running ? Math.sin(phase * 0.25) : 0;
  [-1, 1].forEach(side => {
    ctx.save(); ctx.translate(side * 4, 20);
    ctx.rotate(airborne ? side * 0.55 : side * swing * 0.55);
    box(-11, -1, 23, 31, 5, side < 0 ? '#1e2028' : '#30333c');
    line([[-7, 4], [-8, 24]], '#5c606a', 0.8);
    line([[1, 7], [8, 8]], '#545861', 1);
    for (let i = 0; i < 7; i++) {
      const px = -6 + (i * 5 % 14), py = 3 + (i * 7 % 22);
      line([[px - 0.8, py], [px + 0.8, py]], '#dce7f8', 0.7);
      if (i % 3 === 0) line([[px, py - 1.5], [px, py + 1.5]], '#ffffff', 0.7);
    }
    drawShoes(ctx, shoes, -10, 22); ctx.restore();
  });
  box(-17, -15, 34, 42, 9, shirt);
  line([[-13, 2], [-13, 24]], seam);
  line([[-13, 25], [13, 25]], seam);
  // Neck and a compressed glimpse of the front tattoo in profile.
  box(-7, -27, 17, 22, 4, '#d6a084');
  drawNeckTattoo(ctx, 7, -17, 0.58);
  line([[-5, -23], [-2, -16], [-5, -10]], '#595057', 1.2);
  if (outfit === 'black') line([[-4, -10], [6, -4], [12, -10]], seam, 2);
  if (outfit === 'white') line([[-6, -8], [3, -5], [12, -9]], seam, 1.2);
  if (outfit === 'neon') {
    box(-19, -17, 13, 17, 6, '#addb2e');
    line([[-16, -14], [-14, -4], [-5, -3]], seam, 1.5);
  }
  // Silver chain hangs forward with a narrower nameplate at this angle.
  line([[8, -16], [14, -1], [16, 8]], '#b8c1d1', 2.2);
  line([[9, -15], [15, -1], [17, 7]], '#f1f4ff', 0.8);
  box(9, 6, 17, 8, 1, '#cbd3e0');
  ctx.save(); ctx.translate(17.5, 10); ctx.scale(0.65, 1);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 5.6px Arial';
  ctx.fillStyle = '#ffffff'; ctx.fillText('LUKETA', 0, 0); ctx.restore();
  // Left arm faces the viewer in a right-facing profile.
  ctx.save(); ctx.translate(-7, -7); ctx.rotate(airborne ? -0.65 : -swing * 0.5);
  box(-5, 6, 10, 24, 4, outfit === 'neon' ? shirt : '#dfac8d');
  box(-7, -3, 14, 16, 4, shirt); line([[-6, 11], [6, 11]], seam);
  if (outfit !== 'neon') line([[-3, 16], [2, 19], [-2, 23]], '#6a6369', 1.2);
  oval(0, 29, 5, 6, '#dfac8d');
  box(-6, 23, 12, 5, 1.5, '#a7b1c2');
  for (let i = -4; i <= 4; i += 2) oval(i, 25, 1.1, 1.5, '#eef5ff');
  line([[2, 22], [2, 27]], '#ffffff', 0.7); line([[0, 24], [4, 24]], '#ffffff', 0.7);
  ctx.restore();
  // Side silhouette with short crop, forehead, defined nose, lips and rounded chin.
  const skin = ctx.createLinearGradient(-18, -40, 25, -30);
  skin.addColorStop(0, '#cb9479'); skin.addColorStop(0.6, '#e8ba9b'); skin.addColorStop(1, '#eec6a7');
  ctx.fillStyle = skin; ctx.beginPath();
  ctx.moveTo(-16, -43); ctx.bezierCurveTo(-20, -66, 15, -67, 18, -51);
  ctx.lineTo(18, -43); ctx.lineTo(25, -34); ctx.quadraticCurveTo(26, -32, 19, -32);
  ctx.lineTo(19, -29); ctx.lineTo(22, -27); ctx.lineTo(20, -24);
  ctx.quadraticCurveTo(19, -17, 10, -17); ctx.quadraticCurveTo(-1, -17, -8, -27);
  ctx.lineTo(-15, -33); ctx.closePath(); ctx.fill();
  // Tight blond crop follows the skull, with a faded side above the ear.
  ctx.fillStyle = '#c2ae7e'; ctx.beginPath();
  ctx.moveTo(-17, -40); ctx.bezierCurveTo(-23, -67, 14, -70, 18, -52);
  ctx.lineTo(13, -51); ctx.lineTo(7, -47); ctx.lineTo(-3, -42); ctx.lineTo(-7, -35);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e3cf9b'; ctx.beginPath();
  ctx.moveTo(-16, -52); ctx.bezierCurveTo(-16, -66, 10, -68, 17, -54);
  ctx.lineTo(6, -54); ctx.lineTo(-10, -49); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 18; i++) {
    const px = -12 + (i * 7 % 25), py = -59 + (i * 3 % 7);
    line([[px, py + 1.5], [px + 1.2, py]], i % 3 ? '#f2e1b7' : '#b59c6b', 0.8);
  }
  oval(-6, -36, 4.8, 6.4, '#d29a80');
  line([[-8, -38], [-5, -40], [-3, -36], [-6, -33]], '#ae7b6b', 0.9);
  oval(-5, -31, 1.5, 1.5, '#edf3fc'); oval(-5.5, -31.6, 0.7, 0.7, '#ffffff');
  line([[6, -45], [12, -46], [16, -44]], '#75624f', 2.3);
  oval(12, -40, 4.1, 2.2, '#f1e4d4'); oval(14, -40, 1.8, 2, '#88946b');
  oval(14.5, -40, 0.9, 1.4, '#303731'); oval(15, -40.7, 0.6, 0.6, '#ffffff');
  line([[8, -41], [12, -42], [16, -41]], '#826a57', 0.8);
  line([[18, -33], [21, -32.5]], '#a77564', 0.9);
  line([[17, -28], [21, -27], [18, -25.5]], '#b77978', 1.5);
  line([[17, -23], [15, -19], [9, -19]], '#796753', 2.2);
  ctx.restore();
}

function drawDJ(ctx, { x, y, scale = 1, phase = 0, running = false, airborne = false, outfit = 'black', shoes = 'sneakers', view = 'front' }) {
  if (view === 'profile') return drawDJProfile(ctx, { x, y, scale, phase, running, airborne, outfit, shoes });
  const shirt = outfit === 'white' ? '#f4f3ef' : outfit === 'neon' ? '#c1ef35' : '#202129';
  const seam = outfit === 'white' ? '#c9c9c6' : outfit === 'neon' ? '#769d24' : '#43444c';
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
  // Oversized black denim with a wide leg and subtle rhinestones.
  [-1, 1].forEach(side => {
    ctx.save(); ctx.translate(side * 10, 21);
    ctx.rotate(airborne ? side * -0.35 : swing * side * 0.35);
    shape(-11, -2, 23, 31, 5, side < 0 ? '#20222a' : '#30333c');
    line([[2, 5], [1, 22]], '#626670', 0.8);
    line([[-6, 1], [-6, 23]], '#14161d', 0.8);
    line([[-4, 5], [4, 6]], '#484c57', 1.5);
    for (let i = 0; i < 9; i++) {
      const dx = -5 + (i * 7 % 12), dy = 2 + (i * 11 % 21);
      oval(dx, dy, 0.65, 0.65, '#cbd7e5');
      if (i % 3 === 0) sparkle(dx, dy, 1.4);
    }
    drawShoes(ctx, shoes, -10, 22);
    ctx.restore();
  });
  // Plain black short-sleeve polo, with a folded collar and button placket.
  shape(-23, -15, 46, 42, 10, shirt);
  line([[-18, 1], [-18, 22]], seam, 1);
  line([[18, 1], [18, 22]], '#34353e', 1);
  line([[-18, 25], [18, 25]], seam, 1);
  // Wallet chain.
  ctx.strokeStyle = '#aaa9b5'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(15, 25, 7, 11, -0.25, 0, Math.PI); ctx.stroke();
  [-1, 1].forEach(side => {
    ctx.save(); ctx.translate(side * 22, -8);
    ctx.rotate(airborne ? side * -0.65 : -swing * side * 0.38);
    shape(-5, 7, 10, 22, 4, outfit === 'neon' ? shirt : '#dfac8d');
    shape(-7, -2, 14, 15, 4, shirt);
    line([[-6, 11], [6, 11]], seam);
    // Stylized ink on the visible forearms.
    if (outfit !== 'neon') line([[-3, 16], [2, 18], [-2, 21], [3, 23]], '#777177', 1.1);
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
  shape(-9, -25, 18, 20, 4, '#d6a084');
  drawNeckTattoo(ctx, 0, -16, 0.65);
  if (outfit === 'black') {
    shape(-2, -8, 4, 14, 1, '#34353c');
    line([[-11, -11], [-3, -5], [-7, -1], [-14, -8]], '#666771', 1.3);
    line([[11, -11], [3, -5], [7, -1], [14, -8]], '#666771', 1.3);
    oval(0, -2, 0.65, 0.65, '#b7bec9'); oval(0, 2, 0.65, 0.65, '#b7bec9');
  } else if (outfit === 'neon') {
    line([[-13, -13], [-17, -5], [-7, -2], [0, -5], [7, -2], [17, -5], [13, -13]], seam, 2.5);
    line([[-5, -2], [-6, 9]], '#e8f8be', 1); line([[5, -2], [6, 9]], '#e8f8be', 1);
  } else {
    // Plain white crew neck: no collar, buttons or print.
    ctx.strokeStyle = seam; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(0, -6, 10, 3, 0, 0, Math.PI); ctx.stroke();
  }
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
