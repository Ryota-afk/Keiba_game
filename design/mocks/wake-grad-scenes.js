/* 夢から覚めた後の3場面（目覚めの部屋・名前入力の建物・卒業式の場所）の候補案。
   130×100マスの方眼（1マス＝3px。390×300の枠にぴったり）にドット絵として描く。
   wake-room-v1.html / grad-school-v1.html / grad-ceremony-v1.html から呼ぶ。 */
(function () {
  // ===== 色（1文字＝1色。スプライトの文字地図で使う） =====
  const C = {
    k: "#2a2119", // 輪郭
    f: "#f0c8a0", // 肌
    h: "#3a2a1a", // 髪（茶）
    H: "#1c1712", // 髪（黒）
    w: "#f5f1e4", // 白い布
    n: "#2b3d55", // 学生服の紺
    a: "#7f97a6", // 母のブラウス
    s: "#4a4a52", // 背広
    r: "#c8322e", // 赤
    b: "#8a5a2b", // 馬体（鹿毛）
    d: "#5c3a1c", // 馬体の濃い所（たてがみ・尾・蹄まわり）
    p: "#f3b7c8", // 桜
    P: "#e58aa6", // 桜の濃い所
    g: "#4c9142", // 木の葉
    G: "#3a7a33", // 木の葉の濃い所
    t: "#c9d6e8", // 掛け布団
    T: "#a9bbd6", // 掛け布団の影
    y: "#ffd83d", // 黄（旗・目覚ましのベル）
    e: "#d8b96a", // 木の明るい所
  };

  const SPR = {
    mother: [
      "..khhhhk..",
      ".khhhhhhk.",
      "khhhhhhhhk",
      "khhfffhhhk",
      "kfffffffk.",
      "kfkfffkfk.",
      "kfffffffk.",
      ".kffkffk..",
      "..kffffk..",
      "...kffk...",
      ".kkawwakk.",
      "kaakwwkaak",
      "kaakwwkaak",
      "kaakwwkaak",
      "kffkwwkffk",
      "...kwwk...",
      "..kwwwwk..",
      "..kwwwwk..",
      "..kwwwwk..",
      "..kaakaak.",
      "..kkk.kkk.",
    ],
    student: [
      "..kHHHHk..",
      ".kHHHHHHk.",
      ".kHHHHHHk.",
      ".kHfHfHHk.",
      ".kffffffk.",
      ".kfkffkfk.",
      ".kffffffk.",
      "..kffffk..",
      "...kffk...",
      ".kknwwnkk.",
      "knnknnknnk",
      "knnknnknnk",
      "knnknnknnk",
      "kffknnkffk",
      "...knnk...",
      "..knnnnk..",
      "..knnnnk..",
      "..knnknnk.",
      "..knnknnk.",
      "..kkk.kkk.",
    ],
    studentBack: [
      "..kHHHHk..",
      ".kHHHHHHk.",
      ".kHHHHHHk.",
      ".kHHHHHHk.",
      ".kHHHHHHk.",
      "..kHHHHk..",
      "...kffk...",
      ".kknnnnkk.",
      "knnknnknnk",
      "knnknnknnk",
      "knnknnknnk",
      "kffknnkffk",
      "...knnk...",
      "..knnnnk..",
      "..knnnnk..",
      "..knnknnk.",
      "..knnknnk.",
      "..kkk.kkk.",
    ],
    instructor: [
      "..khhhhk..",
      ".khhhhhhk.",
      ".khhhhhhk.",
      ".khfffhhk.",
      ".kffffffk.",
      ".kfkffkfk.",
      ".kffffffk.",
      "..kffffk..",
      "...kffk...",
      ".kkswrskk.",
      "kssksrkssk",
      "kssksskssk",
      "kssksskssk",
      "kffksskffk",
      "...kssk...",
      "..kssssk..",
      "..kssssk..",
      "..ksskssk.",
      "..ksskssk.",
      "..kkk.kkk.",
    ],
    // 横を向いた人（右向き）。授与の場面で向かい合わせに使う
    studentSide: [
      "..kHHHHk..",
      ".kHHHHHHk.",
      ".kHHHHHHk.",
      ".kHHHfffk.",
      ".kHfffffk.",
      ".kHfffkfk.",
      ".kHffffkk.",
      "..kffffk..",
      "...kffk...",
      "..knnwnk..",
      "..knnnnkk.",
      "..knnnnknk",
      "..knnnnknk",
      "..knnnnkfk",
      "..knnnnkk.",
      "..knnnnk..",
      "..knnnnk..",
      "..knnnnk..",
      "..knnnnk..",
      "..kkkkkk..",
    ],
    instructorSide: [
      "..khhhhk..",
      ".khhhhhhk.",
      ".khhhhhhk.",
      ".khhhfffk.",
      ".khfffffk.",
      ".khfffkfk.",
      ".khffffkk.",
      "..kffffk..",
      "...kffk...",
      "..ksswsk..",
      "..kssrskk.",
      "..kssssksk",
      "..kssssksk",
      "..kssssksk",
      "..kssssksk",
      "..kssssk..",
      "..kssssk..",
      "..kssssk..",
      "..kssssk..",
      "..kkkkkk..",
    ],
    // 寝ている頭（頭が左・顔は上向き）。正面図でも見下ろし図でも使う
    sleeper: [
      "..khhhhk.",
      ".khhhhhhk",
      "khhhfffhk",
      "khhfffffk",
      "kfffkkffk",
      "kfffffffk",
      ".kfffkffk",
      "..kkkkkk.",
    ],
    horseHead: [
      ".k.......k.",
      "kdk.....kdk",
      "kbdk...kdbk",
      ".kbbkkkbbk.",
      ".kbbdddbbk.",
      ".kbbbbbbbk.",
      ".kbkbbbkbk.",
      ".kbbbbbbbk.",
      "..kbbbbbk..",
      "..kbkbkbk..",
      "..kbbbbbk..",
      "..kkkkkkk..",
    ],
    clock: [
      "..kkkkk..",
      ".kwwwwwk.",
      "kwwwkwwwk",
      "kwwwkwwwk",
      "kwwwkwwwk",
      "kwwkwwwwk",
      "kwkwwwwwk",
      ".kwwwwwk.",
      "..kkkkk..",
    ],
    alarmClock: [
      ".kyk...kyk",
      "..kkkkkkk.",
      "..kwwwwwk.",
      ".kwwwkwwwk",
      ".kwwwkwwwk",
      ".kwwwkwwwk",
      ".kwwkwwwwk",
      ".kwkwwwwwk",
      "..kwwwwwk.",
      "..kkkkkkk.",
      "..kk...kk.",
    ],
    hinomaru: [
      "wwwwwwwwww",
      "wwwwrrwwww",
      "wwwrrrrwww",
      "wwwrrrrwww",
      "wwwwrrwwww",
      "wwwwwwwwww",
    ],
    tree: [
      ".....kkkk.....",
      "...kkggggkk...",
      "..kggggggggk..",
      ".kggggGgggggk.",
      ".kgggGGGggggk.",
      "kggggGGGGgGggk",
      "kgggGGGGGGGGgk",
      "kggGGGGGGGGGgk",
      ".kGGGGGGGGGGk.",
      ".kkGGGGGGGGkk.",
      "...kkGGGGkk...",
      ".....kddk.....",
      ".....kddk.....",
      ".....kddk.....",
      "....kddddk....",
    ],
    sakura: [
      ".....kkkkkk.....",
      "...kkppppppkk...",
      "..kppppwppppppk.",
      ".kpppppppPppppk.",
      "kppwppppppppppPk",
      "kpppppPpppwppppk",
      "kPpppppppppppppk",
      "kppppPppppPppppk",
      ".kpppppppppppPk.",
      ".kkPpppppppppkk.",
      "...kkppppppkk...",
      ".....kkddkk.....",
      "......kddk......",
      "......kddk......",
      ".....kddddk.....",
    ],
    // 学校の紋（馬の頭の影絵。門柱の上に載せる）
    crest: [
      ".k...k.",
      "kdk.kdk",
      "kdddddk",
      ".kdddk.",
      ".kdddk.",
      "..kkk..",
    ],
  };

  // ===== 描画の道具 =====
  function Painter() {
    const parts = [];
    const p = {
      // 単色の矩形（マス単位）
      r(x, y, w, h, c) {
        parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`);
      },
      poly(points, c) {
        parts.push(`<polygon points="${points.map((q) => q.join(",")).join(" ")}" fill="${c}"/>`);
      },
      ell(cx, cy, rx, ry, c) {
        parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}"/>`);
      },
      // 文字地図のスプライト。flip=true で左右反転、scaleでマスの大きさを変える
      s(name, x, y, opt = {}) {
        const map = SPR[name];
        const sc = opt.scale || 1;
        const w = map[0].length;
        for (let j = 0; j < map.length; j++) {
          for (let i = 0; i < w; i++) {
            const ch = map[j][i];
            if (ch === ".") continue;
            const c = (opt.colors && opt.colors[ch]) || C[ch];
            const ix = opt.flip ? w - 1 - i : i;
            parts.push(`<rect x="${x + ix * sc}" y="${y + j * sc}" width="${sc}" height="${sc}" fill="${c}"/>`);
          }
        }
      },
      // ゲーム本体の馬（view/dreamDerbySprite.jsの形をそのまま。40×36・右向き・脚は立ち姿）
      horse(x, y, opt = {}) {
        const sc = opt.scale || 1;
        const coat = opt.coat || C.b;
        const dark = opt.dark || C.d;
        const R = [];
        const r = (c, rx, ry, rw, rh) => R.push([c, rx, ry, rw, rh]);
        r(dark, 2, 13, 4, 9); r(dark, 1, 20, 3, 3);
        [[7, 23, 4, 9], [11, 23, 3, 8], [21, 23, 4, 9], [25, 23, 3, 8]].forEach(([lx, ly, lw, lh]) => {
          r(coat, lx, ly, lw, lh); r("#221a14", lx, ly + lh - 1.5, lw, 2);
        });
        r(coat, 5, 13, 22, 11); r(dark, 7, 22, 18, 2);
        r(coat, 24, 7, 7, 10); r(coat, 27, 5, 6, 6);
        r(dark, 24, 5, 4, 5); r(dark, 22, 9, 3, 3);
        r(coat, 30, 6, 9, 7); r(dark, 36, 9, 4, 4); r(dark, 30, 3, 3, 3);
        r("#111", 34, 8, 2, 2);
        const g = R.map(([c, rx, ry, rw, rh]) => {
          const px = opt.flip ? 40 - rx - rw : rx;
          return `<rect x="${(x + px * sc).toFixed(2)}" y="${(y + ry * sc).toFixed(2)}" width="${(rw * sc).toFixed(2)}" height="${(rh * sc).toFixed(2)}" fill="${c}"/>`;
        });
        parts.push(g.join(""));
      },
      svg() {
        return `<svg viewBox="0 0 130 100" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" aria-hidden="true">${parts.join("")}</svg>`;
      },
    };
    return p;
  }

  // ===== 共通の部品 =====
  // 学校の校舎（1970年代の日本の学校らしい横長の連続窓・2階建て・玄関のひさし・屋上の時計）
  function schoolBuilding(p, x, y, w) {
    const h = 34;
    p.r(x - 2, y, w + 4, 3, "#8a8378"); // 屋上のふち
    p.r(x, y + 3, w, h - 3, "#e3dccb"); // 壁
    p.r(x, y + 15, w, 2, "#c9c0ad"); // 階の境の横帯
    p.r(x, y + h - 3, w, 3, "#c9c0ad"); // 基礎の帯
    // 連続窓（2階・1階）
    for (const wy of [y + 6, y + 19]) {
      p.r(x + 4, wy, w - 8, 7, "#b9cad6");
      p.r(x + 4, wy + 3, w - 8, 1, "#e3dccb"); // 窓の横桟
      for (let i = x + 4; i < x + w - 4; i += 8) p.r(i + 7, wy, 1, 7, "#e3dccb"); // 窓枠（物の縦成分）
    }
    // 玄関（真ん中）とひさし
    const dx = x + Math.floor(w / 2) - 6;
    p.r(dx, y + 21, 12, 10, "#e3dccb");
    p.r(dx + 1, y + 22, 10, 9, "#3b2f24");
    p.r(dx - 3, y + 18, 18, 3, "#8a8378");
    // 屋上の時計
    p.s("clock", x + Math.floor(w / 2) - 4, y - 6, { scale: 1 });
  }
  function flagpole(p, x, top, bottom) {
    p.r(x, top, 1, bottom - top, "#9c9488");
    p.s("hinomaru", x + 1, top + 1);
  }
  function cloud(p, x, y, w) {
    p.r(x, y + 2, w, 3, "#ffffff");
    p.r(x + 3, y, w - 6, 2, "#ffffff");
    p.r(x + 1, y + 5, w - 2, 1, "#ffffff");
  }
  function sky(p, y1, y2) {
    p.r(0, y1, 130, y2 - y1, "#8fc6e0");
    p.r(0, y1, 130, Math.floor((y2 - y1) / 2), "#7fb8d8");
  }
  // 窓の外（丘・柵・放牧の馬・朝日）。x,y,w,hは窓ガラスの内側
  function outside(p, x, y, w, h, opt = {}) {
    p.r(x, y, w, h, "#a8daf2");
    p.r(x, y, w, Math.floor(h * 0.3), "#96cfee");
    // 朝日
    p.r(x + 4, y + 3, 5, 5, "#fff0a0");
    p.r(x + 5, y + 2, 3, 7, "#fff0a0");
    p.r(x + 3, y + 4, 7, 3, "#fff0a0");
    // 遠くの丘（2段）
    p.poly([[x, y + h * 0.55], [x + w * 0.35, y + h * 0.38], [x + w * 0.7, y + h * 0.5], [x + w, y + h * 0.42], [x + w, y + h], [x, y + h]], "#8fbf6a");
    p.poly([[x, y + h * 0.66], [x + w * 0.5, y + h * 0.56], [x + w, y + h * 0.64], [x + w, y + h], [x, y + h]], "#6faa50");
    // 放牧地の柵（横木2本と短い柱）
    const fy = y + h * 0.78;
    p.r(x, fy, w, 1, "#f5f1e4");
    p.r(x, fy + 3, w, 1, "#f5f1e4");
    for (let i = x + 2; i < x + w; i += 7) p.r(i, fy - 1, 1, 6, "#f5f1e4");
    // 放牧の馬
    if (!opt.noHorse) p.horse(x + w * 0.45, fy - 14, { scale: 0.5, flip: opt.flip });
  }

  // ===== ① 目覚めの部屋 =====
  const SCENES = {};

  // 案A：正面から。今の構図（ベッドの洋室）のまま、寝姿・壁の絵・窓の外を描き直す
  SCENES.roomA = function () {
    const p = Painter();
    p.r(0, 0, 130, 70, "#d6c4a0"); // 壁
    p.r(0, 68, 130, 2, "#8a6a44"); // 幅木
    // 床板（横目）
    p.r(0, 70, 130, 30, "#9a6a3c");
    for (let fy = 76; fy < 100; fy += 6) p.r(0, fy, 130, 1, "#7c5430");
    // 窓（外に丘・柵・馬・朝日）
    p.r(76, 6, 46, 44, "#f2ede0");
    outside(p, 79, 9, 40, 38);
    p.r(98, 9, 2, 38, "#f2ede0");
    p.r(79, 27, 40, 2, "#f2ede0");
    // 壁の絵（額の中に馬）
    p.r(12, 8, 40, 28, "#6b4a2a");
    p.r(14, 10, 36, 24, "#f2ede0");
    p.r(16, 12, 32, 20, "#dfe9d8");
    p.r(16, 26, 32, 6, "#8fbf6a");
    p.horse(16.5, 12, { scale: 0.75 });
    // ベッド：頭板・枕・頭・体（掛け布団の膨らみ）・枠
    p.r(4, 44, 6, 40, "#6b4a2a");
    p.r(4, 44, 6, 2, "#8a6a44");
    p.r(10, 70, 66, 12, "#7d5730"); // 枠
    p.r(10, 82, 4, 6, "#5a3d20"); p.r(72, 82, 4, 6, "#5a3d20"); // 脚
    p.r(10, 62, 66, 8, "#f5f1e4"); // シーツ
    p.r(11, 54, 16, 10, "#f5f1e4"); // 枕
    p.r(11, 54, 16, 1, "#e0dccc");
    // 掛け布団（体の膨らみ＝台形）
    p.poly([[27, 64], [30, 58], [46, 55], [60, 58], [76, 62], [76, 70], [27, 70]], C.t);
    p.poly([[27, 64], [30, 58], [46, 55], [60, 58], [76, 62], [76, 63], [60, 60], [46, 57], [31, 60], [28, 65]], "#e6edf5");
    p.r(27, 66, 49, 1, C.T);
    p.s("sleeper", 13, 51);
    // 枕元の台と目覚まし時計
    p.r(82, 62, 16, 22, "#7d5730");
    p.r(82, 62, 16, 2, "#8a6a44");
    p.s("alarmClock", 85, 51);
    // 母（ベッドのそばに立つ）
    p.s("mother", 104, 42);
    // 右端のドア（開いている）
    p.r(120, 12, 10, 58, "#5a3d20");
    p.r(122, 14, 8, 56, "#3b2f24");
    return p.svg();
  };

  // 案B：斜め見下ろし。和室（畳・布団・障子・箪笥）。壁には競走馬の額、鴨居に学生服
  SCENES.roomB = function () {
    const p = Painter();
    p.r(0, 0, 130, 50, "#dccaa2"); // 砂壁
    p.r(0, 0, 130, 3, "#5a3d20"); // 天井の梁
    p.r(0, 46, 130, 4, "#5a3d20"); // 長押（横木）
    // 畳（斜め見下ろしの床。畳の目は横向き）
    p.r(0, 50, 130, 50, "#b9b06a");
    p.r(0, 74, 130, 26, "#aca35e");
    p.r(0, 50, 130, 1, "#3a5a3a"); p.r(0, 73, 130, 2, "#3a5a3a"); p.r(0, 98, 130, 2, "#3a5a3a");
    p.r(64, 50, 2, 24, "#3a5a3a"); p.r(84, 74, 2, 26, "#3a5a3a"); // 畳の縁（物の縦成分）
    // 障子（左の一枚を開けて外が見える）
    p.r(72, 6, 50, 40, "#8a6a44");
    outside(p, 74, 8, 46, 36, { noHorse: false });
    p.r(96, 8, 24, 36, "#fff7dc"); // 閉じた障子
    for (let gy = 8; gy < 44; gy += 6) p.r(96, gy, 24, 1, "#c9b98a");
    p.r(102, 8, 1, 36, "#c9b98a"); p.r(112, 8, 1, 36, "#c9b98a");
    p.r(96, 8, 1, 36, "#8a6a44");
    // 壁の額（競走馬・騎手つき）
    p.r(8, 8, 46, 32, "#3b2f24");
    p.r(10, 10, 42, 28, "#f2ede0");
    p.r(12, 12, 38, 24, "#d9e6cf");
    p.r(12, 28, 38, 8, "#8fbf6a");
    p.horse(13, 13, { scale: 0.9 });
    // 鴨居に掛けた学生服（今日着る）
    p.r(60, 6, 1, 4, "#9c9488");
    p.s("student", 56, 10, { colors: { f: "#dccaa2", H: "#dccaa2", k: "#2a2119" } });
    p.r(56, 10, 10, 9, "#dccaa2"); // 頭の部分は壁色で消す
    p.r(59, 8, 4, 3, "#9c9488"); // ハンガー
    // 箪笥（横の引き出し）と目覚まし時計
    p.r(100, 54, 26, 24, "#7d5730");
    for (let dy = 57; dy < 78; dy += 6) { p.r(102, dy, 22, 1, "#5a3d20"); p.r(111, dy + 2, 4, 1, "#e6c78a"); }
    p.s("alarmClock", 108, 43);
    // 布団（上から見る。頭が左）
    p.r(8, 58, 66, 32, "#e8e2d4"); // 敷布団
    p.r(24, 60, 50, 28, C.t); // 掛け布団
    p.r(24, 60, 50, 4, "#f5f1e4"); // 襟
    p.poly([[30, 64], [56, 64], [60, 88], [26, 88]], "#dbe4f0"); // 体の膨らみ（明るい面）
    p.r(24, 76, 50, 1, C.T);
    p.r(10, 62, 14, 12, "#f5f1e4"); // 枕
    p.r(10, 62, 14, 1, "#e0dccc");
    p.s("sleeper", 12, 64);
    // 母（襖のところに立つ）
    p.r(118, 6, 12, 40, "#e8dfc6"); p.r(118, 6, 12, 1, "#8a6a44"); p.r(118, 26, 12, 1, "#8a6a44"); // 襖
    p.s("mother", 84, 34);
    return p.svg();
  };

  // 案C：布団の中からの目線。天井・覗き込む母・窓の明かり。壁の絵は置かない
  SCENES.roomC = function () {
    const p = Painter();
    // 天井板（横目）
    p.r(0, 0, 130, 100, "#d9c39a");
    for (let y = 8; y < 100; y += 12) p.r(0, y, 130, 2, "#b99a6a");
    // 天井の照明（丸い蛍光灯とひも）
    p.ell(64, 22, 20, 7, "#f2ede0");
    p.ell(64, 22, 14, 4, "#fff7dc");
    p.r(63, 29, 2, 10, "#9c9488");
    p.r(62, 39, 4, 3, "#c8322e");
    // 左の窓（朝の光）
    p.r(0, 34, 30, 40, "#f2ede0");
    outside(p, 0, 37, 27, 34, { noHorse: true });
    p.r(13, 37, 2, 34, "#f2ede0");
    // 覗き込む母（顔が大きい）
    p.s("mother", 74, 40, { scale: 3.2 });
    // 手前：自分の掛け布団のふち
    p.r(0, 84, 130, 16, C.t);
    p.r(0, 84, 130, 4, "#f5f1e4");
    p.r(0, 92, 130, 1, C.T);
    return p.svg();
  };

  // ===== ② 名前入力の建物（競馬学校） =====
  // 案A：校舎の前に調教コース。馬が走っている
  SCENES.schoolA = function () {
    const p = Painter();
    sky(p, 0, 40);
    cloud(p, 6, 8, 20); cloud(p, 104, 14, 16);
    p.r(0, 36, 130, 8, "#3a7a33"); // 遠くの木立
    for (let x = 2; x < 130; x += 9) p.r(x, 33, 5, 4, "#3a7a33");
    p.r(0, 44, 130, 56, "#57a24b"); // 芝
    schoolBuilding(p, 32, 12, 66);
    flagpole(p, 18, 6, 46);
    p.s("tree", 104, 30); p.s("tree", 4, 30);
    // 調教コース（手前の楕円。外が砂・内が芝・白いラチ）
    p.ell(65, 80, 66, 20, "#b98f5c");
    p.ell(65, 80, 66, 20, "#b98f5c");
    p.ell(65, 80, 50, 12, "#57a24b");
    p.r(0, 60, 130, 1, "#f5f1e4"); // 外ラチ（上側）
    p.r(16, 68, 98, 1, "#f5f1e4"); // 内ラチ（上側）
    p.r(16, 91, 98, 1, "#f5f1e4"); // 内ラチ（下側）
    p.horse(20, 60, { scale: 0.7 });
    p.horse(66, 62, { scale: 0.7 });
    p.horse(80, 84, { scale: 0.7, flip: true, coat: "#5c3a1c", dark: "#3b2314" });
    return p.svg();
  };

  // 案B：校舎を捨て、厩舎と馬を主役に。生徒が馬を引いている
  SCENES.schoolB = function () {
    const p = Painter();
    sky(p, 0, 34);
    cloud(p, 80, 6, 22);
    p.r(0, 30, 130, 6, "#3a7a33");
    schoolBuilding(p, 78, 4, 44); // 遠くに校舎の一部
    p.r(0, 36, 130, 64, "#c9a874"); // 馬場（砂）
    // 厩舎の列
    p.r(0, 18, 130, 8, "#3a5a3a"); // 屋根
    p.r(0, 26, 130, 2, "#2c4a2c");
    p.r(0, 28, 130, 34, "#a0764a"); // 壁
    p.r(0, 60, 130, 2, "#7d5730");
    for (let i = 0; i < 4; i++) {
      const x = 8 + i * 32;
      p.r(x, 32, 18, 30, "#5a3d20"); // 馬房の戸枠
      p.r(x + 1, 33, 16, 12, "#2a2119"); // 上半分（開いている）
      p.r(x + 1, 46, 16, 15, "#7d5730"); // 下半分の戸
      p.r(x + 1, 52, 16, 1, "#5a3d20");
      if (i !== 2) p.s("horseHead", x + 3, 34);
    }
    // 生徒が馬を引く
    p.horse(40, 58, { scale: 1 });
    p.s("student", 84, 70);
    p.r(78, 80, 6, 1, "#f5f1e4"); // 引き綱
    // バケツと干し草
    p.r(6, 84, 8, 8, "#7f97a6"); p.r(5, 83, 10, 1, "#2a2119");
    p.r(112, 82, 14, 10, "#e6c78a"); p.r(112, 86, 14, 1, "#c9a350");
    return p.svg();
  };

  // 案C：校門。桜と門柱、その奥に校舎。生徒が門を入る
  SCENES.schoolC = function () {
    const p = Painter();
    sky(p, 0, 50);
    cloud(p, 50, 6, 24);
    p.r(0, 46, 130, 30, "#57a24b"); // 芝
    schoolBuilding(p, 40, 14, 50);
    p.r(56, 48, 18, 28, "#d8c9a6"); // 校舎までの砂利道
    p.horse(6, 42, { scale: 0.45 }); // 遠くの放牧の馬
    p.r(0, 76, 130, 24, "#8a8a86"); // 道路
    p.r(0, 88, 130, 1, "#f5f1e4");
    // 門柱（石積み・横目地）
    for (const gx of [22, 96]) {
      p.r(gx, 36, 12, 44, "#c9c0ad");
      for (let gy = 40; gy < 80; gy += 6) p.r(gx, gy, 12, 1, "#a19a8a");
      p.r(gx - 1, 34, 14, 2, "#8a8378");
      p.s("crest", gx + 2, 27);
    }
    p.r(23, 44, 10, 16, "#f5f1e4"); // 表札（文字は読めない大きさの彫り）
    p.r(25, 47, 6, 1, "#8a8378"); p.r(25, 50, 6, 1, "#8a8378"); p.r(25, 53, 6, 1, "#8a8378"); p.r(25, 56, 6, 1, "#8a8378");
    // 桜
    p.s("sakura", 0, 20); p.s("sakura", 110, 20);
    p.s("sakura", 6, 30, { scale: 0.8 });
    for (const [px, py] of [[10, 80], [30, 90], [50, 84], [90, 94], [110, 82], [120, 90], [70, 78]]) p.r(px, py, 1, 1, C.p);
    // 門を入る生徒（学生服・かばん）
    p.s("student", 60, 62);
    p.r(69, 76, 5, 4, "#5a3d20");
    return p.svg();
  };

  // ===== ③ 卒業式の場所 =====
  // 案A：講堂の壇上。紅白幕・日の丸と校旗・演台・前に立つ本人・後ろに椅子の列
  SCENES.ceremonyA = function () {
    const p = Painter();
    p.r(0, 0, 130, 100, "#efe8d3");
    p.r(0, 0, 130, 6, "#3b2f24"); // 天井の際
    // 紅白幕（⚠縦縞。縦線の決まりと相談）
    for (let x = 0; x < 130; x += 16) { p.r(x, 6, 8, 34, "#c8322e"); p.r(x + 8, 6, 8, 34, "#f5f1e4"); }
    p.r(0, 6, 130, 2, "#2a2119");
    // 壇（前面と上面）
    p.r(0, 40, 130, 12, "#d8b96a");
    p.r(0, 52, 130, 6, "#8a6a44");
    p.r(0, 58, 130, 1, "#5a3d20");
    // 旗（日の丸と校旗）
    p.r(16, 14, 1, 28, "#9c9488"); p.s("hinomaru", 17, 15);
    p.r(112, 14, 1, 28, "#9c9488"); p.r(103, 15, 9, 6, "#3a5a3a"); p.r(106, 17, 3, 2, C.y);
    // 演台と教官
    p.s("instructor", 60, 18);
    p.r(52, 32, 26, 16, "#7d5730"); p.r(50, 30, 30, 3, "#a5824e");
    p.r(60, 33, 10, 2, "#f5f1e4"); // 卒業証書
    // 床（板の横目）
    p.r(0, 59, 130, 41, "#c9a874");
    for (let y = 66; y < 100; y += 8) p.r(0, y, 130, 1, "#b8956a");
    // 本人（壇の前に立つ・後ろ姿）
    p.s("studentBack", 60, 54);
    // 椅子の列に座る同期（後ろ姿）
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 3; i++) {
        for (const side of [10, 80]) {
          const x = side + i * 14;
          const y = 72 + row * 14;
          p.s("studentBack", x, y - 12);
          p.r(x - 1, y, 12, 6, "#5a3d20"); // 椅子の背
        }
      }
    }
    return p.svg();
  };

  // 案B：授与の瞬間に寄る。向かい合う教官と本人、後ろに同期の列。幕は一色
  SCENES.ceremonyB = function () {
    const p = Painter();
    p.r(0, 0, 130, 100, "#efe8d3");
    p.r(0, 0, 130, 44, "#3a5a3a"); // 一色の幕
    p.r(0, 0, 130, 5, "#2c4a2c"); // 幕の上の帯
    p.r(0, 40, 130, 4, "#2c4a2c");
    // 旗
    p.r(10, 10, 1, 34, "#9c9488"); p.s("hinomaru", 11, 11);
    // 壇の面
    p.r(0, 44, 130, 14, "#d8b96a");
    p.r(0, 58, 130, 6, "#8a6a44");
    // 花（演台の脇）
    p.r(96, 34, 8, 10, "#f2ede0"); p.r(94, 26, 12, 9, "#e58aa6"); p.r(97, 24, 6, 3, "#f3b7c8"); p.r(99, 30, 3, 3, C.y);
    // 向かい合う二人（大きく）
    p.s("studentSide", 30, 14, { scale: 1.6 });
    p.s("instructorSide", 72, 14, { scale: 1.6, flip: true });
    p.r(50, 34, 16, 4, "#f5f1e4"); p.r(50, 34, 16, 1, "#c8322e"); // 卒業証書（両手で受け取る）
    // 床と同期の列（前を向いて並ぶ）
    p.r(0, 64, 130, 36, "#c9a874");
    for (let y = 72; y < 100; y += 8) p.r(0, y, 130, 1, "#b8956a");
    for (let i = 0; i < 7; i++) p.s("student", 8 + i * 17, 74, { scale: 0.9 });
    return p.svg();
  };

  // 案C：屋外。校舎と桜の前で、同期が並び、学校の馬も列に加わる
  SCENES.ceremonyC = function () {
    const p = Painter();
    sky(p, 0, 44);
    cloud(p, 8, 6, 18); cloud(p, 92, 10, 22);
    p.r(0, 40, 130, 60, "#57a24b");
    schoolBuilding(p, 26, 10, 78);
    flagpole(p, 14, 2, 44);
    p.s("sakura", 0, 26); p.s("sakura", 112, 24);
    // 同期の列（前を向く）
    for (let i = 0; i < 6; i++) p.s("student", 30 + i * 12, 46, { scale: 0.8 });
    // 授与（教官と本人が向かい合う）
    p.s("instructorSide", 42, 66, { flip: true });
    p.s("studentSide", 24, 66);
    p.r(34, 76, 8, 2, "#f5f1e4");
    // 学校の馬（引き手つき）
    p.horse(72, 60, { scale: 1 });
    p.s("student", 112, 68);
    p.r(108, 78, 6, 1, "#f5f1e4");
    p.r(0, 96, 130, 4, "#4c9142");
    return p.svg();
  };

  window.WAKE_GRAD_SCENES = SCENES;
})();
