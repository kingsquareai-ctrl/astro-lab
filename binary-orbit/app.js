const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

// ── 물리 상수 ──
const G = 800;
const DT_BASE = 5.0;   // 별은 해석적 원운동이라 큰 dt 사용 가능

// ── 상태 ──
let W, H, cx, cy;
let massA  = 1.0;
let massB  = 0.7;
let speed  = 2.0;
let tilt   = 75;
let showTrail = true;

let starA, starB, planet;
let trailPlanet = [];
let trailA = [], trailB = [];
let bgStars = [];

// 이진성 해석적 공전을 위한 상태
let binAngle = 0;   // 현재 공전 각도 (라디안)
let binOmega = 0;   // 각속도 (rad/sim-time)
let binSep = 0, binRa = 0, binRb = 0;

// ── 배경별 생성 ──
function initBgStars() {
    bgStars = Array.from({ length: 180 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.2 + 0.2,
        a: Math.random() * 0.7 + 0.2,
    }));
}

// ── 별 위치를 각도로 계산 ──
function placeStars() {
    starA.x = cx - binRa * Math.cos(binAngle);
    starA.y = cy - binRa * Math.sin(binAngle);
    starB.x = cx + binRb * Math.cos(binAngle);
    starB.y = cy + binRb * Math.sin(binAngle);
}

// ── 별 초기화 ──
function initStars() {
    binSep = Math.min(W, H) * 0.18;
    const mSum = massA + massB;
    binRa = binSep * massB / mSum;
    binRb = binSep * massA / mSum;
    // 케플러 3법칙으로 각속도 계산
    binOmega = Math.sqrt(G * mSum / (binSep * binSep * binSep));
    binAngle = 0;

    starA = { m: massA, r: 12 + massA * 6, x: 0, y: 0 };
    starB = { m: massB, r: 10 + massB * 5, x: 0, y: 0 };
    placeStars();
    trailA = [];
    trailB = [];
    trailPlanet = [];
}

// ── 행성 초기화 ──
function initPlanet() {
    const mSum = massA + massB;
    const pOrbit = binSep * (1.6 + mSum * 0.38);
    const tiltRad = (tilt * Math.PI) / 180;
    const vPlanet = Math.sqrt(G * mSum / pOrbit);

    planet = {
        x: cx + pOrbit, y: cy, z: 0,
        vx: 0,
        vy: vPlanet * Math.cos(tiltRad),
        vz: vPlanet * Math.sin(tiltRad),
        m: 0.001, r: 5,
    };
    trailPlanet = [];
}

// ── 전체 초기화 ──
function initBodies() {
    initStars();
    initPlanet();
}

// ── 물리 스텝 ──
// 별: 해석적 원운동 (적분 오차 없음)
// 행성: 오일러 수치 적분
function step(dt) {
    // 별 위치를 각도로 직접 계산
    binAngle += binOmega * dt;
    placeStars();

    // 행성에 작용하는 두 별의 중력
    let ax = 0, ay = 0, az = 0;
    [starA, starB].forEach(s => {
        const dx = s.x - planet.x;
        const dy = s.y - planet.y;
        const dz = -planet.z;          // 별들은 z=0 평면에 있음
        const r2 = dx*dx + dy*dy + dz*dz + 100;
        const r  = Math.sqrt(r2);
        const f  = G * s.m / r2;
        ax += f * dx / r;
        ay += f * dy / r;
        az += f * dz / r;
    });

    planet.vx += ax * dt;
    planet.vy += ay * dt;
    planet.vz += az * dt;
    planet.x  += planet.vx * dt;
    planet.y  += planet.vy * dt;
    planet.z  += planet.vz * dt;
}

// ── 그리기 ──
function drawGlow(x, y, r, color, glowR) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    g.addColorStop(0,   color.replace(')', ', 0.6)').replace('rgb', 'rgba'));
    g.addColorStop(0.3, color.replace(')', ', 0.15)').replace('rgb', 'rgba'));
    g.addColorStop(1,   'transparent');
    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
}

function drawStar(x, y, r, color, glowColor) {
    drawGlow(x, y, r, glowColor, r * 5);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, color);
    g.addColorStop(1, glowColor);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
}

function drawPlanet(x, y, z, r) {
    // z축을 y 오프셋으로 투영 (간단한 3D→2D)
    const py = y + z * 0.3;
    const scale = 0.6 + 0.4 * (1 - Math.abs(z) / (Math.min(W, H) * 0.3 + 1));

    drawGlow(x, py, r, 'rgb(100, 170, 255)', r * 6);
    ctx.beginPath();
    ctx.arc(x, py, r * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#88ccff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(150, 200, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function drawTrail(trail, color, maxLen) {
    if (trail.length < 2) return;
    for (let i = 1; i < trail.length; i++) {
        const a = (i / trail.length) * 0.5;
        ctx.beginPath();
        ctx.moveTo(trail[i-1].x, trail[i-1].y);
        ctx.lineTo(trail[i].x,   trail[i].y);
        ctx.strokeStyle = color.replace('A', `${a.toFixed(2)}`);
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

let frame = 0;

function render() {
    const dt = DT_BASE * speed;

    // 물리 업데이트 (여러 스텝)
    for (let i = 0; i < 50; i++) step(dt);

    // 궤적 기록
    const TRAIL = 600;
    trailA.push({ x: starA.x, y: starA.y });
    trailB.push({ x: starB.x, y: starB.y });
    trailPlanet.push({ x: planet.x, y: planet.y + planet.z * 0.3 });
    if (trailA.length > TRAIL)       trailA.shift();
    if (trailB.length > TRAIL)       trailB.shift();
    if (trailPlanet.length > TRAIL * 2) trailPlanet.shift();

    // ── 그리기 ──
    ctx.fillStyle = 'rgba(2, 5, 16, 0.25)';
    ctx.fillRect(0, 0, W, H);

    // 배경별
    bgStars.forEach(s => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 210, 255, ${s.a})`;
        ctx.fill();
    });

    // 궤적
    if (showTrail) {
        drawTrail(trailA,       'rgba(255, 220, 80, A)',  600);
        drawTrail(trailB,       'rgba(255, 140, 60, A)',  600);
        drawTrail(trailPlanet,  'rgba(100, 180, 255, A)', 1200);
    }

    // 질량 중심
    const mSum = starA.m + starB.m;
    const comX = (starA.x * starA.m + starB.x * starB.m) / mSum;
    const comY = (starA.y * starA.m + starB.y * starB.m) / mSum;
    ctx.beginPath();
    ctx.arc(comX, comY, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();

    // 두 별 연결선 (희미하게)
    ctx.beginPath();
    ctx.moveTo(starA.x, starA.y);
    ctx.lineTo(starB.x, starB.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 행성 z축 선 (공간감)
    const py = planet.y + planet.z * 0.3;
    ctx.beginPath();
    ctx.moveTo(planet.x, planet.y);
    ctx.lineTo(planet.x, py);
    ctx.strokeStyle = 'rgba(100,180,255,0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 별 A (노란)
    drawStar(starA.x, starA.y, starA.r, '#ffe066', 'rgb(255, 200, 50)');
    // 별 B (주황)
    drawStar(starB.x, starB.y, starB.r, '#ff8844', 'rgb(255, 120, 40)');
    // 행성
    drawPlanet(planet.x, planet.y, planet.z, planet.r);

    frame++;
    requestAnimationFrame(render);
}

// ── 리사이즈 ──
function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    cx = W / 2;
    cy = H / 2;
    initBgStars();
    initBodies();
}

// ── 컨트롤 ──
function bindSlider(id, valId, setter, decimals = 1) {
    const el  = document.getElementById(id);
    const val = document.getElementById(valId);
    el.addEventListener('input', () => {
        const v = parseFloat(el.value);
        val.textContent = v.toFixed(decimals);
        setter(v);
        initBodies();
    });
}

// 질량 변경: 전체 재설정 → 총 질량에 따라 행성 궤도 반지름이 즉시 달라짐
bindSlider('massA', 'massAVal', v => { massA = v; initBodies(); });
bindSlider('massB', 'massBVal', v => { massB = v; initBodies(); });
// 속도: 리셋 없음
bindSlider('speed', 'speedVal', v => { speed = v; });
// 기울기: 행성 궤도면만 변경
bindSlider('tilt',  'tiltVal',  v => { tilt  = v; initPlanet(); }, 0);

document.getElementById('showTrail').addEventListener('change', e => {
    showTrail = e.target.checked;
    if (!showTrail) { trailA = []; trailB = []; trailPlanet = []; }
});

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(render);
