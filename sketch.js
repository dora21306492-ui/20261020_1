// ============================================================
//  認識台灣原生種 ─ 拖曳配對測驗（p5.js）
//  上方：6 張動態 GIF　下方：6 個文字選項
//  把選項拖到圖片下方的格子，按「交卷看成績」後才顯示結果
//  成績高於 60% 時，會從畫面左右下角噴出彩帶
// ============================================================

// ---------- 題庫 ----------
// name：正確名稱　file：GIF 檔案路徑（放在 assets 資料夾；若找不到檔案，會自動改用程式繪製的動態插圖）
const QUESTIONS = [
  { name: '台灣黑熊',   file: 'assets/bear.gif',     emoji: '🐻' },
  { name: '台灣藍鵲',   file: 'assets/magpie.gif',   emoji: '🐦' },
  { name: '台灣獼猴',   file: 'assets/macaque.gif',  emoji: '🐒' },
  { name: '櫻花鉤吻鮭', file: 'assets/salmon.gif',   emoji: '🐟' },
  { name: '帝雉',       file: 'assets/pheasant.gif', emoji: '🦚' },
  { name: '台灣山羌',   file: 'assets/muntjac.gif',  emoji: '🦌' }
];
const N = QUESTIONS.length;      // 題數（六題）
const PASS_LINE = 60;            // 超過此百分比才放彩帶

// ---------- 全域變數 ----------
let chips = [];                  // 下方可拖曳的文字選項
let cells = [];                  // 上方每一題的版面資料（圖片區 + 放置格）
let dragChip = null;             // 目前正在拖曳的選項
let dragOffX = 0, dragOffY = 0;  // 拖曳時滑鼠與選項左上角的偏移
let prevSlot = -1;               // 拖曳前選項所在的格子編號
let submitted = false;           // 是否已交卷
let showPanel = false;           // 是否顯示成績面板
let result = null;               // 成績資料
let confetti = [];               // 彩帶粒子
let confettiFrames = 0;          // 彩帶持續發射的剩餘影格
let toastMsg = '', toastUntil = 0; // 提示訊息
let btn = { x: 0, y: 0, w: 0, h: 0 };          // 主按鈕（交卷 / 重新測驗）
let panelBtns = { retry: null, close: null };   // 成績面板上的按鈕
let L = {};                      // 版面尺寸（隨視窗大小改變）
const FONT = '"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif';

// ---------- 載入圖片 ----------
function preload() {
  for (const q of QUESTIONS) {
    q.img = null;
    // 載入 GIF（p5 會自動播放動畫）；失敗時改用 emoji 代替
    loadImage(q.file, (img) => { q.img = img; }, () => { q.img = null; });
  }
}

// ---------- 初始化 ----------
function setup() {
  createCanvas(windowWidth, windowHeight);   // 畫布全螢幕
  textFont(FONT);
  pixelDensity(min(2, window.devicePixelRatio || 1));
  newGame();
}

// 開始新的一局：重設狀態並打亂選項順序
function newGame() {
  submitted = false;
  showPanel = false;
  result = null;
  confetti = [];
  confettiFrames = 0;
  dragChip = null;

  // 建立選項，並以洗牌方式打亂順序
  const order = shuffle([...Array(N).keys()]);
  chips = order.map((qi, i) => ({
    id: qi,                 // 對應題號（用來判斷答案）
    label: QUESTIONS[qi].name,
    home: i,                // 在下方待選區的位置編號
    slot: -1,               // 目前放在哪一格（-1 = 還沒放）
    x: 0, y: 0, w: 0, h: 0  // 位置與大小
  }));
  layout();
  for (const c of chips) { c.x = target(c).x; c.y = target(c).y; }
}

// ---------- 版面計算（響應式） ----------
function layout() {
  const W = width, H = height, gap = 10;
  const narrow = W < 700;                         // 窄螢幕（手機）判斷

  L.titleH = constrain(H * 0.09, 48, 80);         // 標題區高度
  L.btnH = constrain(H * 0.07, 40, 56);           // 按鈕高度
  L.btnW = constrain(W * 0.4, 150, 260);          // 按鈕寬度
  L.chipH = constrain(H * 0.06, 34, 52);          // 選項高度
  L.chipCols = narrow ? 2 : 3;                    // 選項區每列幾個
  L.chipRows = ceil(N / L.chipCols);
  L.gap = gap;
  L.chipAreaH = L.chipRows * (L.chipH + gap) + gap;
  L.footerH = L.btnH + gap * 2;
  L.gridCols = narrow ? 3 : 6;                    // 圖片區每列幾張
  L.gridRows = ceil(N / L.gridCols);
  L.gridTop = L.titleH;
  L.gridBottom = H - L.footerH - L.chipAreaH;
  L.cellW = W / L.gridCols;
  L.cellH = (L.gridBottom - L.gridTop) / L.gridRows;
  L.slotW = min(L.cellW - 16, 180);               // 放置格寬度（選項寬度與其相同）

  // 每一題的圖片區與放置格
  cells = [];
  for (let i = 0; i < N; i++) {
    const c = i % L.gridCols, r = floor(i / L.gridCols);
    const x0 = c * L.cellW, y0 = L.gridTop + r * L.cellH;
    cells.push({
      x: x0, y: y0, w: L.cellW, h: L.cellH,       // 整個題目格（拖到這範圍內都算）
      img: { x: x0 + 8, y: y0 + 4, w: L.cellW - 16, h: L.cellH - L.chipH - 16 },
      slot: { x: x0 + (L.cellW - L.slotW) / 2, y: y0 + L.cellH - L.chipH - 6, w: L.slotW, h: L.chipH }
    });
  }

  // 主按鈕位置
  btn = { x: W / 2 - L.btnW / 2, y: H - L.btnH - gap, w: L.btnW, h: L.btnH };

  for (const c of chips) { c.w = L.slotW; c.h = L.chipH; }
}

// 計算選項應該停靠的位置（在格子內或回到待選區）
function target(c) {
  if (c.slot >= 0) return { x: cells[c.slot].slot.x, y: cells[c.slot].slot.y };
  const col = c.home % L.chipCols, row = floor(c.home / L.chipCols);
  return {
    x: (col + 0.5) * (width / L.chipCols) - c.w / 2,
    y: height - L.footerH - L.chipAreaH + L.gap + row * (L.chipH + L.gap)
  };
}

// ---------- 主繪圖迴圈 ----------
function draw() {
  background('#eaf4ea');
  drawTitle();
  drawCells();
  drawChips();
  drawMainButton();
  drawToast();
  if (showPanel) drawResultPanel();
  updateConfetti();            // 彩帶畫在最上層
  updateCursor();
}

// 標題與說明文字
function drawTitle() {
  noStroke();
  fill('#2e6b3a');
  textAlign(CENTER, CENTER);
  textSize(constrain(L.titleH * 0.42, 18, 32));
  textStyle(BOLD);
  text('🌿 認識台灣原生種', width / 2, L.titleH * 0.38);
  textStyle(NORMAL);
  fill('#557a5c');
  textSize(constrain(L.titleH * 0.22, 12, 16));
  text('把下方的名稱，拖曳到對應圖片的下方格子', width / 2, L.titleH * 0.78);
}

// 畫出六題的圖片與放置格
function drawCells() {
  for (let i = 0; i < N; i++) {
    const cell = cells[i], q = QUESTIONS[i], im = cell.img, s = cell.slot;

    // 圖片外框
    fill(255); stroke('#b9d6bd'); strokeWeight(2);
    rect(im.x, im.y, im.w, im.h, 12);

    // 圖片（維持比例置中縮放）
    if (q.img && q.img.width > 0) {
      const sc = min((im.w - 8) / q.img.width, (im.h - 8) / q.img.height);
      const w = q.img.width * sc, h = q.img.height * sc;
      image(q.img, im.x + (im.w - w) / 2, im.y + (im.h - h) / 2, w, h);
    } else {
      // 沒有 GIF 檔時：改用程式繪製的「棲地背景＋動物＋動作」動態插圖
      drawScene(i, im.x, im.y, im.w, im.h);
    }
    // 圖片框外框（蓋在插圖上面，讓邊緣整齊）
    noFill(); stroke('#b9d6bd'); strokeWeight(2);
    rect(im.x, im.y, im.w, im.h, 12);

    // 題號圓點
    noStroke(); fill('#2e6b3a');
    circle(im.x + 16, im.y + 16, 24);
    fill(255); textSize(13); textAlign(CENTER, CENTER);
    text(i + 1, im.x + 16, im.y + 16);

    // 放置格（交卷後依對錯顯示綠 / 紅框）
    let border = '#8fb996', bg = 'rgba(255,255,255,0.6)';
    if (submitted) {
      const ok = chips.find(c => c.slot === i && c.id === i);
      border = ok ? '#2e9e4f' : '#d64545';
      bg = ok ? 'rgba(46,158,79,0.12)' : 'rgba(214,69,69,0.12)';
    } else if (dragChip && hitCell(dragChip) === i) {
      border = '#f0a020'; bg = 'rgba(240,160,32,0.15)';   // 拖曳經過時高亮
    }
    fill(bg); stroke(border); strokeWeight(2.5);
    drawingContext.setLineDash([8, 6]);                    // 虛線
    rect(s.x, s.y, s.w, s.h, 10);
    drawingContext.setLineDash([]);

    // 空格提示文字
    if (!chips.some(c => c.slot === i)) {
      noStroke(); fill('#9db8a2');
      textSize(constrain(s.h * 0.34, 12, 16));
      textAlign(CENTER, CENTER);
      text('拖到這裡', s.x + s.w / 2, s.y + s.h / 2);
    }
  }
}

// 畫出所有文字選項（正在拖曳的畫在最上面）
function drawChips() {
  for (const c of chips) {
    if (c === dragChip) continue;
    // 緩動移動到目標位置
    const t = target(c);
    c.x = lerp(c.x, t.x, 0.25);
    c.y = lerp(c.y, t.y, 0.25);
    drawChip(c, false);
  }
  if (dragChip) drawChip(dragChip, true);
}

function drawChip(c, lifted) {
  // 拖曳時加陰影
  if (lifted) { drawingContext.shadowColor = 'rgba(0,0,0,0.3)'; drawingContext.shadowBlur = 14; drawingContext.shadowOffsetY = 6; }
  noStroke();
  fill(lifted ? '#ffd66b' : '#fff3c4');
  stroke(lifted ? '#e0a100' : '#e6c34a'); strokeWeight(2);
  rect(c.x, c.y, c.w, c.h, 10);
  drawingContext.shadowColor = 'rgba(0,0,0,0)'; drawingContext.shadowBlur = 0; drawingContext.shadowOffsetY = 0;
  noStroke(); fill('#4a3b00');
  textAlign(CENTER, CENTER);
  textSize(constrain(c.h * 0.45, 13, 22));
  textStyle(BOLD);
  text(c.label, c.x + c.w / 2, c.y + c.h / 2 + 1);
  textStyle(NORMAL);
}

// 主按鈕：交卷前顯示「交卷看成績」，交卷後顯示「重新測驗」
function drawMainButton() {
  if (showPanel) return;
  const label = submitted ? '🔄 重新測驗' : '📝 交卷看成績';
  const over = inRect(mouseX, mouseY, btn);
  noStroke();
  fill(submitted ? (over ? '#3b86d6' : '#4a96e8') : (over ? '#2e9e4f' : '#38b25c'));
  rect(btn.x, btn.y + (over ? 1 : 0), btn.w, btn.h, 14);
  fill(255); textAlign(CENTER, CENTER);
  textSize(constrain(btn.h * 0.42, 15, 22)); textStyle(BOLD);
  text(label, btn.x + btn.w / 2, btn.y + btn.h / 2);
  textStyle(NORMAL);
}

// 提示訊息（例如還有題目沒作答）
function drawToast() {
  if (millis() > toastUntil) return;
  const w = min(width * 0.8, 320), h = 40;
  noStroke(); fill('rgba(40,40,40,0.88)');
  rect(width / 2 - w / 2, btn.y - h - 12 - L.chipAreaH * 0, w, h, 20);
  fill(255); textAlign(CENTER, CENTER); textSize(15);
  text(toastMsg, width / 2, btn.y - h / 2 - 12);
}

// ---------- 成績面板 ----------
function drawResultPanel() {
  // 半透明遮罩
  noStroke(); fill(0, 0, 0, 120);
  rect(0, 0, width, height);

  const ts = constrain(width * 0.032, 14, 20);   // 內文字級
  const lh = ts * 1.9;                           // 行高
  const wrongCount = result.wrong.length;
  const pw = min(width * 0.92, 580);
  const bh = 44;
  const ph = min(height * 0.96, 40 + lh * 3.4 + lh * (1 + max(1, wrongCount)) + bh + 40);
  const px = width / 2 - pw / 2, py = height / 2 - ph / 2;

  fill(255); stroke('#b9d6bd'); strokeWeight(3);
  rect(px, py, pw, ph, 20);

  noStroke();
  let y = py + 26;
  // 標題
  fill('#2e6b3a'); textAlign(CENTER, CENTER); textStyle(BOLD);
  textSize(ts * 1.5); text('測驗結果', width / 2, y); y += lh * 1.2;
  // 總成績
  const pass = result.pct > PASS_LINE;
  fill(pass ? '#2e9e4f' : '#d64545');
  textSize(ts * 2.1);
  text(result.score + ' / ' + N + '（' + round(result.pct) + '%）', width / 2, y); y += lh * 1.2;
  // 評語
  textSize(ts); fill('#555'); textStyle(NORMAL);
  text(pass ? '🎉 太棒了！成績超過 60%，恭喜通過！' : '💪 再接再厲，成績需高於 60% 才算通過喔！', width / 2, y); y += lh * 1.1;

  // 錯誤題與正確選項
  textAlign(LEFT, CENTER);
  fill('#2e6b3a'); textStyle(BOLD);
  text(wrongCount ? '❌ 答錯的題目與正確選項：' : '✅ 全部答對，沒有錯誤題！', px + 28, y); y += lh;
  textStyle(NORMAL); fill('#333');
  for (const w of result.wrong) {
    text('第 ' + (w.q + 1) + ' 題　你選：' + w.chosen + '　→　正確：' + w.correct, px + 28, y);
    y += lh;
  }

  // 按鈕：重新測驗 / 查看作答
  const bw = (pw - 28 * 2 - 14) / 2, by = py + ph - bh - 22;
  panelBtns.retry = { x: px + 28, y: by, w: bw, h: bh };
  panelBtns.close = { x: px + 28 + bw + 14, y: by, w: bw, h: bh };
  drawPanelBtn(panelBtns.retry, '🔄 重新測驗', '#4a96e8');
  drawPanelBtn(panelBtns.close, '👀 查看作答', '#38b25c');
}

function drawPanelBtn(b, label, col) {
  noStroke(); fill(col); rect(b.x, b.y, b.w, b.h, 12);
  fill(255); textAlign(CENTER, CENTER); textSize(16); textStyle(BOLD);
  text(label, b.x + b.w / 2, b.y + b.h / 2); textStyle(NORMAL);
}

// ---------- 交卷與評分 ----------
function submitQuiz() {
  // 還有選項沒放進格子就提示
  if (chips.some(c => c.slot < 0)) {
    toastMsg = '還有題目沒作答，請把六個選項都拖進格子喔！';
    toastUntil = millis() + 2200;
    return;
  }
  let score = 0; const wrong = [];
  for (let i = 0; i < N; i++) {
    const chosen = chips.find(c => c.slot === i);        // 放在第 i 題格子的選項
    if (chosen.id === i) score++;
    else wrong.push({ q: i, chosen: chosen.label, correct: QUESTIONS[i].name });
  }
  const pct = score / N * 100;
  result = { score, wrong, pct };
  submitted = true;
  showPanel = true;
  if (pct > PASS_LINE) startConfetti();                  // 高於 60% 才放彩帶
}

// ---------- 彩帶效果 ----------
function startConfetti() {
  confetti = [];
  confettiFrames = 90;                                   // 持續發射約 1.5 秒
  for (let i = 0; i < 60; i++) { spawnConfetti(true); spawnConfetti(false); }
}

// 從左下角（left = true）或右下角噴出一片彩帶
function spawnConfetti(left) {
  const sc = height / 800;                               // 依螢幕高度調整力道
  const ang = random(PI * 0.2, PI * 0.45);               // 往上的角度
  const sp = random(14, 30) * sc;
  const colors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c'];
  confetti.push({
    x: left ? 0 : width, y: height,
    vx: (left ? 1 : -1) * cos(ang) * sp,
    vy: -sin(ang) * sp,
    w: random(6, 12), h: random(10, 18),
    rot: random(TWO_PI), vr: random(-0.3, 0.3),
    col: random(colors), g: 0.45 * sc + 0.1
  });
}

function updateConfetti() {
  if (confettiFrames > 0) {                              // 持續補發
    confettiFrames--;
    for (let i = 0; i < 2; i++) { spawnConfetti(true); spawnConfetti(false); }
  }
  for (let i = confetti.length - 1; i >= 0; i--) {
    const p = confetti[i];
    p.vy += p.g; p.vx *= 0.985; p.vy *= 0.99;            // 重力與空氣阻力
    p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    push();
    translate(p.x, p.y); rotate(p.rot);
    noStroke(); fill(p.col);
    rect(-p.w / 2, -p.h / 2, p.w, p.h);
    pop();
    if (p.y > height + 40) confetti.splice(i, 1);        // 掉出畫面就移除
  }
}

// ---------- 滑鼠 / 觸控事件（p5 會把觸控視為滑鼠） ----------
function mousePressed() {
  // 成績面板開啟時，只處理面板按鈕
  if (showPanel) {
    if (inRect(mouseX, mouseY, panelBtns.retry)) newGame();
    else if (inRect(mouseX, mouseY, panelBtns.close)) showPanel = false;
    return false;
  }
  // 主按鈕
  if (inRect(mouseX, mouseY, btn)) {
    if (submitted) newGame(); else submitQuiz();
    return false;
  }
  if (submitted) return false;                           // 交卷後不能再拖曳
  // 由上往下找被點到的選項
  for (let i = chips.length - 1; i >= 0; i--) {
    const c = chips[i];
    if (inRect(mouseX, mouseY, c)) {
      dragChip = c;
      prevSlot = c.slot;
      c.slot = -1;                                       // 拿起來就離開原格子
      dragOffX = mouseX - c.x; dragOffY = mouseY - c.y;
      chips.splice(i, 1); chips.push(c);                 // 移到陣列最後（繪圖在最上層）
      break;
    }
  }
  return false;
}

function mouseDragged() {
  if (dragChip) {
    dragChip.x = mouseX - dragOffX;
    dragChip.y = mouseY - dragOffY;
  }
  return false;
}

function mouseReleased() {
  if (!dragChip) return;
  const t = hitCell(dragChip);                           // 放開時落在哪一題
  if (t >= 0) {
    const other = chips.find(c => c !== dragChip && c.slot === t);
    if (other) other.slot = prevSlot;                    // 該格已有選項：兩者交換
    dragChip.slot = t;
  } else {
    dragChip.slot = -1;                                  // 沒放進格子就回到待選區
  }
  dragChip = null;
  return false;
}

// ---------- 工具函式 ----------
// 判斷座標是否在矩形內
function inRect(px, py, r) {
  return r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

// 取得選項中心點所在的題目格編號（沒有則 -1）
function hitCell(c) {
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  for (let i = 0; i < N; i++) if (inRect(cx, cy, cells[i])) return i;
  return -1;
}

// 滑鼠移到可操作物件上時顯示手指游標
function updateCursor() {
  let hand = false;
  if (showPanel) hand = inRect(mouseX, mouseY, panelBtns.retry) || inRect(mouseX, mouseY, panelBtns.close);
  else hand = inRect(mouseX, mouseY, btn) || (!submitted && chips.some(c => inRect(mouseX, mouseY, c)));
  cursor(dragChip ? 'grabbing' : hand ? 'pointer' : 'default');
}

// 視窗大小改變時，重新調整畫布與版面（響應式）
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  layout();
}


// ============================================================
//  動態情境插圖：棲地背景 ＋ 大主體動物 ＋ 簡單活動
//  （沒有 GIF 檔時自動使用；畫布座標為 200 x 150 的虛擬畫面）
// ============================================================
function drawScene(i, x, y, w, h) {
  const t = millis() / 1000;                    // 時間（秒），用來產生動畫
  const ctx = drawingContext;
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 12); else ctx.rect(x, y, w, h);
  ctx.clip();                                   // 只允許畫在圖片框內
  push();
  translate(x + w / 2, y + h / 2);
  const sc = min(w / 200, h / 150);             // 等比例縮放，確保動物完整可見
  scale(sc);
  translate(-100, -75);                         // 讓虛擬畫面置中
  noStroke();
  [sceneBear, sceneMagpie, sceneMacaque, sceneSalmon, scenePheasant, sceneMuntjac][i](t);
  pop();
  ctx.restore();
}

// 畫一個上下漸層的矩形（用來畫天空、水、地面）
function gradRect(x, y, w, h, c1, c2) {
  const g = drawingContext.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  drawingContext.fillStyle = g;
  drawingContext.fillRect(x, y, w, h);
}

// 畫一棵松樹（三層三角形＋樹幹）
function pine(px, py, s, col) {
  fill('#4a3828'); rect(px - 2 * s, py, 4 * s, 8 * s);
  fill(col);
  for (let k = 0; k < 3; k++) triangle(px - (17 - k * 2) * s, py - k * 13 * s, px + (17 - k * 2) * s, py - k * 13 * s, px, py - k * 13 * s - 26 * s);
}

// ---------- 1. 台灣黑熊：中海拔山林，四足緩步行走 ----------
function sceneBear(t) {
  gradRect(-300, -300, 800, 420, '#bfe3d0', '#eaf5de');      // 天空
  fill('#8fb8a0'); triangle(-60, 105, 50, 20, 160, 105); triangle(70, 105, 160, 12, 300, 105); // 遠山
  fill('#5f9a72'); ellipse(30, 108, 210, 60); ellipse(175, 110, 230, 70);                     // 丘陵
  gradRect(-300, 108, 800, 300, '#4c7f3f', '#335a2c');      // 草地
  pine(14, 116, 1.2, '#2d5a3a'); pine(182, 118, 1.3, '#2d5a3a'); pine(-12, 122, 1, '#244a30'); pine(210, 122, 1, '#244a30');

  const dir = cos(t * 0.6) >= 0 ? 1 : -1;                    // 左右來回走
  const bx = 100 + 26 * sin(t * 0.6);
  const step = t * 5;                                        // 步伐節奏
  push(); translate(bx, sin(step * 2) * 1.2); scale(dir, 1);
  fill('rgba(0,0,0,0.25)'); ellipse(0, 130, 96, 10);         // 影子
  const leg = (hx, ph, col) => { push(); translate(hx, 108); rotate(sin(step + ph) * 0.45); fill(col); rect(-5, 0, 10, 22, 5); pop(); };
  leg(-24, PI, '#141414'); leg(22, 0, '#141414');            // 遠側腿
  fill('#222'); ellipse(0, 96, 78, 44);                      // 身體
  fill('#f2f2f2'); triangle(18, 90, 34, 90, 26, 105);        // 胸前白色 V 字（台灣黑熊特徵）
  leg(-24, 0, '#222'); leg(22, PI, '#222');                  // 近側腿
  const hy = 88 + sin(step) * 1.2;
  fill('#222'); circle(34, hy - 14, 17); circle(48, hy - 15, 17); // 耳朵
  fill('#6b5a4a'); circle(34, hy - 14, 8); circle(48, hy - 15, 8);
  fill('#222'); ellipse(44, hy, 32, 28);                     // 頭
  fill('#9a7b5a'); ellipse(57, hy + 5, 15, 12);              // 口鼻
  fill('#111'); ellipse(63, hy + 3, 6, 5);                   // 鼻頭
  fill(255); circle(49, hy - 4, 5); fill(0); circle(50, hy - 4, 2.5); // 眼睛
  pop();
}

// ---------- 2. 台灣藍鵲：樹枝上跳躍、擺動長尾 ----------
function sceneMagpie(t) {
  gradRect(-300, -300, 800, 450, '#8fd0f5', '#dcf2fb');      // 藍天
  fill('rgba(255,255,255,0.85)');                            // 飄動的雲
  for (let k = 0; k < 2; k++) { const cx = ((t * 6 + k * 130) % 300) - 50; ellipse(cx, 30 + k * 22, 50, 16); ellipse(cx + 14, 24 + k * 22, 30, 14); }
  fill('#3f9a4a'); ellipse(5, 8, 100, 56); ellipse(195, 2, 110, 56);   // 樹葉
  fill('#58b560'); ellipse(40, 24, 56, 28); ellipse(160, 20, 60, 30);
  stroke('#6b4a2f'); strokeWeight(7); line(-60, 114, 260, 104); noStroke();  // 樹枝
  fill('#58b560'); ellipse(30, 108, 18, 8); ellipse(165, 98, 18, 8);

  const hop = pow(max(0, sin(t * 2.2)), 6) * 14;             // 偶爾跳一下
  const tailA = 0.12 * sin(t * 4) + hop * 0.015;             // 長尾上下擺動
  push(); translate(100, 108 - hop);
  stroke('#e63a2e'); strokeWeight(2.5); line(-5, -9, -5, 0); line(6, -9, 6, 0); noStroke(); // 紅腳
  push(); translate(-14, -18); rotate(PI - 0.35 + tailA);    // 長尾（尾端白色）
  fill('#2a5fcf'); quad(0, -6, 0, 6, 74, 4, 74, -4);
  fill('#1b2f7a'); quad(44, -4.5, 44, 4.5, 52, 4, 52, -4);
  fill('#fff'); quad(56, -4, 56, 4, 76, 3.5, 76, -3.5);
  pop();
  fill('#2f66d6'); ellipse(0, -22, 44, 30);                  // 身體
  fill('#6f9bf2'); ellipse(3, -16, 30, 18);
  fill('#1d44a8'); ellipse(-6, -23, 28, 15);                 // 翅膀
  const hy = -38 + sin(t * 3) * 1.5;                         // 頭部微微擺動
  fill('#1b1b1b'); circle(16, hy, 23);                       // 黑色頭部
  fill('#e63a2e'); triangle(25, hy - 4, 25, hy + 4, 41, hy + 1); // 紅嘴
  fill(255); circle(19, hy - 2, 6); fill(0); circle(20, hy - 2, 3);
  pop();
}

// ---------- 3. 台灣獼猴：森林岩石上坐著吃果子 ----------
function sceneMacaque(t) {
  gradRect(-300, -300, 800, 450, '#86c196', '#3f7a52');      // 森林
  fill('#5b4332'); rect(8, -60, 18, 200); rect(170, -60, 22, 200);   // 樹幹
  fill('#2f7a45'); ellipse(20, 6, 90, 60); ellipse(180, 0, 100, 64);  // 樹冠
  gradRect(-300, 120, 800, 200, '#6a8f4a', '#4a6f35');       // 地面
  fill('#8d8d8d'); ellipse(100, 128, 116, 42); fill('#a8a8a8'); ellipse(90, 121, 70, 20); // 岩石

  const ph = (sin(t * 2.2) + 1) / 2;                         // 0＝手放下　1＝果子送到嘴邊
  const bob = sin(t * 2.2) * 0.8;
  noFill(); stroke('#7a6a58'); strokeWeight(6); bezier(82, 112, 50, 124, 40, 92, 58, 76); noStroke(); // 尾巴
  fill('#8a7a68'); ellipse(100, 94, 46, 52);                 // 身體
  fill('#ad9f8b'); ellipse(104, 98, 26, 32);                 // 肚子
  fill('#7a6a58'); ellipse(86, 114, 24, 14); ellipse(114, 114, 24, 14); // 腳
  push(); translate(0, bob);
  fill('#8a7a68'); circle(104, 58, 36);                      // 頭
  fill('#d98a7a'); circle(88, 58, 11); circle(120, 58, 11);  // 耳朵
  fill('#d98a7a'); ellipse(106, 62, 26, 24);                 // 紅臉
  fill('#222'); circle(100, 58, 3.5); circle(112, 58, 3.5);  // 眼睛
  fill(ph > 0.8 ? '#7a2b2b' : '#a35a4e'); ellipse(106, 70, 8, ph > 0.8 ? 6 : 2);   // 嘴巴（吃的時候張開）
  pop();
  const hx = lerp(90, 106, ph), hy = lerp(104, 70, ph);      // 手與果子的位置
  stroke('#7a6a58'); strokeWeight(8); line(92, 80, hx, hy); noStroke();
  fill('#8a7a68'); circle(hx, hy, 10);
  if (ph < 0.95) { fill('#f28c28'); circle(hx + 2, hy - 5, 12); fill('#3f9a4a'); ellipse(hx + 5, hy - 12, 6, 3); } // 果子
}

// ---------- 4. 櫻花鉤吻鮭：山區溪流水中游動 ----------
function sceneSalmon(t) {
  gradRect(-300, -300, 800, 500, '#4aa3c7', '#1f5f86');      // 水
  fill('rgba(255,255,255,0.09)');                            // 水面透下來的光
  for (let k = 0; k < 4; k++) { const sx = 10 + k * 55 + sin(t * 0.5 + k) * 8; quad(sx, -10, sx + 28, -10, sx + 62, 160, sx + 14, 160); }
  fill('#6f6a5a'); ellipse(30, 150, 100, 40); ellipse(115, 153, 120, 44); ellipse(185, 148, 90, 38);  // 河床
  fill('#8a8573'); ellipse(62, 138, 32, 16); ellipse(152, 141, 38, 18);                               // 石頭
  noFill(); stroke('#3f9a5a'); strokeWeight(3);              // 水草
  for (const px of [18, 42, 166, 186]) line(px, 140, px + sin(t * 1.5 + px) * 7, 102);
  stroke('rgba(255,255,255,0.65)'); strokeWeight(1.2);       // 氣泡
  for (let k = 0; k < 6; k++) circle(30 + k * 30 + sin(t + k) * 3, 150 - ((t * 20 + k * 37) % 150), 4 + (k % 3) * 2);
  noStroke();

  const dir = cos(t * 0.6) >= 0 ? 1 : -1;                    // 左右來回游
  const wag = sin(t * 8);                                    // 尾巴擺動
  push(); translate(100 + 44 * sin(t * 0.6), 72 + 6 * sin(t * 1.1)); scale(dir * 1.05, 1.05);
  push(); translate(-40, 0); rotate(wag * 0.35); fill('#7f9a8f'); quad(0, 0, -26, -19, -19, 0, -26, 19); pop(); // 尾鰭
  rotate(wag * 0.04);
  fill('#a9bdb0'); ellipse(0, 0, 88, 36);                    // 身體
  fill('#7d9486'); arc(0, 0, 88, 36, PI, TWO_PI);            // 深色背部
  fill('#e8f0e8'); arc(0, 0, 82, 32, 0, PI);                 // 淺色腹部
  fill('rgba(235,110,120,0.75)'); ellipse(0, 2, 70, 8);      // 粉紅色側線
  fill('rgba(40,60,60,0.5)'); for (let px = -22; px <= 24; px += 11) ellipse(px, -1, 6, 20); // 橢圓形斑紋（幼魚斑）
  fill('#8fa89a'); triangle(-8, -17, 8, -17, -2, -29);       // 背鰭
  fill('#c7d6cc'); triangle(10, 8, -8, 20 + wag * 2, -2, 6); // 胸鰭
  fill(255); circle(30, -4, 8); fill(0); circle(31, -4, 4);  // 眼睛
  stroke('#5d7468'); strokeWeight(1.5); noFill(); arc(22, 0, 12, 24, -1, 1); // 鰓蓋
  noStroke(); pop();
}

// ---------- 5. 帝雉：高海拔霧林，低頭覓食行走 ----------
function scenePheasant(t) {
  gradRect(-300, -300, 800, 440, '#aebfcc', '#e1e9ee');      // 霧濛濛的天空
  for (const px of [10, 60, 130, 190]) pine(px, 100, 1.1, '#7f97a3');     // 遠處針葉林
  fill('rgba(255,255,255,0.4)'); ellipse(((t * 5) % 300) - 50, 96, 170, 22); ellipse(260 - ((t * 4) % 300), 80, 150, 18); // 流動的霧
  for (const px of [-5, 95, 205]) pine(px, 124, 1.5, '#4f6f68');          // 近處針葉林
  gradRect(-300, 118, 800, 300, '#6b7a52', '#4b5a3a');       // 林地

  const dir = cos(t * 0.5) >= 0 ? 1 : -1;
  const step = t * 5;
  push(); translate(100 + 30 * sin(t * 0.5), sin(step * 2) * 0.8); scale(dir, 1);
  fill('rgba(0,0,0,0.22)'); ellipse(0, 130, 70, 8);
  stroke('#d05a4a'); strokeWeight(3);                        // 紅色的腳（左右交替）
  for (const ph of [0, PI]) line(ph ? 4 : -4, 106, (ph ? 4 : -4) + sin(step + ph) * 9, 130 - max(0, cos(step + ph)) * 5);
  noStroke();
  push(); translate(-22, 100); rotate(PI - 0.12);            // 長尾（有白色橫斑）
  fill('#252c4a'); quad(0, -8, 0, 8, 76, 4, 76, -4);
  fill('#fff'); for (let k = 1; k <= 4; k++) rect(k * 15 - 3, -7 + k * 0.8, 4, 14 - k * 1.6);
  pop();
  fill('#222a4a'); ellipse(0, 92, 54, 34);                   // 身體
  fill('#3a4a7a'); ellipse(10, 95, 30, 24);                  // 胸部（帶藍紫金屬光澤）
  fill('#1b2140'); ellipse(-4, 90, 34, 20);                  // 翅膀
  fill('#222a4a'); ellipse(21, 76, 16, 28);                  // 脖子
  const hx = 29 + sin(step) * 2, hy = 62 + max(0, sin(step * 0.5)) * 2;   // 走路時頭前後點動
  fill('#222a4a'); circle(hx, hy, 17);
  fill('#d63a3a'); ellipse(hx + 3, hy, 11, 9);               // 眼周紅色裸皮
  fill('#b5b5a0'); triangle(hx + 8, hy - 1, hx + 8, hy + 3, hx + 17, hy + 1); // 嘴
  fill(0); circle(hx + 3, hy - 0.5, 3);
  pop();
}

// ---------- 6. 台灣山羌：草地邊緣低頭吃草、甩動耳朵與尾巴 ----------
function sceneMuntjac(t) {
  gradRect(-300, -300, 800, 440, '#cfe6c4', '#ebf6da');      // 天空
  fill('#6b4f35'); rect(16, 60, 9, 70); rect(176, 56, 9, 74);        // 樹幹
  fill('#5f9a5f'); ellipse(20, 62, 72, 92); ellipse(180, 56, 82, 104); // 樹冠
  fill('#3f7a43'); ellipse(58, 120, 64, 32); ellipse(150, 122, 74, 36); // 灌木
  gradRect(-300, 120, 800, 300, '#79a64a', '#58853a');       // 草地
  stroke('#4d7a30'); strokeWeight(2);                        // 隨風搖擺的草
  for (let gx = -10; gx < 220; gx += 12) line(gx, 140, gx + sin(t * 2 + gx) * 3, 129);
  noStroke();

  const g = pow((sin(t * 1.0) + 1) / 2, 1.4);                // 0＝抬頭張望　1＝低頭吃草
  const body = '#a8693b';
  fill('rgba(0,0,0,0.2)'); ellipse(96, 134, 90, 8);
  stroke('#8b5530'); strokeWeight(5);                        // 四條細腿
  line(72, 108, 72, 132); line(82, 110, 82, 132); line(110, 110, 110, 132); line(120, 106, 120, 132);
  noStroke();
  push(); translate(66, 92); rotate(-0.5 + sin(t * 6) * 0.3 * max(0, sin(t * 0.9 + 1))); // 尾巴偶爾甩動
  fill(body); ellipse(0, 0, 16, 8); fill('#fff'); ellipse(-6, 2, 7, 5); pop();
  fill(body); ellipse(95, 98, 62, 34);                       // 身體（背部微微拱起）
  fill('#e0c29c'); ellipse(98, 108, 46, 14);                 // 腹部
  const hx = 140 + g * 6, hy = 72 + g * 46;                  // 頭的位置（隨低頭而下移）
  stroke(body); strokeWeight(14); line(118, 94, hx - 4, hy); noStroke();   // 脖子
  push(); translate(hx, hy); rotate(lerp(-0.1, 1.05, g));
  fill('#b0733f'); ellipse(6, 0, 30, 16);                    // 頭
  fill('#222'); circle(20, 1, 4.5); circle(4, -3, 3.2);      // 鼻頭與眼睛
  stroke('#5a3b22'); strokeWeight(2); line(0, -8, -2, -19); noStroke();   // 短角
  push(); translate(-5, -7); rotate(-0.8 + sin(t * 6) * 0.3 * max(0, sin(t * 0.9)));   // 大耳朵（偶爾抖動）
  fill('#8b5530'); ellipse(0, -5, 9, 18); fill('#e8b9a0'); ellipse(0, -5, 4, 11); pop();
  pop();
}