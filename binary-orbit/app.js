const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

// ── 물리 상수 (시뮬레이션 단위) ──
const G = 800;   // 중력 상수 (픽셀 스케일)
const DT_BASE = 0.008;

// ── 상태 ──
let W, H, cx, cy;
let massA  = 1.0;
let massB  = 0.7;
let speed  = 1.0;
let tilt   = 75;   // 행성 궤도 기울기 (도)
let showTrail = true;

let starA, starB, planet;
let trailPlanet = [];
let trailA = [], trailB = [];
let bgStars = [];

// ── 배경별 생성 ──
function initBgStars() {
    bgStars = Array.from({ length: 180 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.2 + 0.2,
        a: Math.random() * 0.7 + 0.2,
    }));
}

// ── 별 초기화 (질량 변경 시 별만 재설정) ──
function initStars() {
    const sep  = Math.min(W, H) * 0.18;
    const mSum = massA + massB;
    const rA = sep * massB / mSum;
    const rB = sep * massA / mSum;
    const vCircA = Math.sqrt(G * massB * massB / (mSum * sep));
    const vCircB = Math.sqrt(G * massA * massA / (mSum * sep));

    starA = { x: cx - rA, y: cy, vx: 0, vy: -vCircA, m: massA, r: 12 + massA * 6 };
    starB = { x: cx + rB, y: cy, vx: 0, vy:  vCircB, m: massB, r: 10 + massB * 5 };
    trailA = [];
    trailB = [];
    trailPlanet = [];
}

// ── 행성 초기화 (기울기 변경 또는 전체 리셋 시) ──
function initPlanet() {
    const sep  = Math.min(W, H) * 0.18;
    const mSum = massA + massB;

    // 총 질량이 클수록 더 넓은 안정 궤도 → 질량 변경 시 즉시 크기 차이 확인 가능
    const pOrbit = sep * (1.6 + mSum * 0.38);
    const tiltRad = (tilt * Math.PI) / 180;
    const vPlanet = Math.sqrt(G * mSum / pOrbit);

    planet = {
        x:  cx + pOrbit,
        y:  cy,
        vx: 0,
        vy: vPlanet * Math.cos(tiltRad),
        vz: vPlanet * Math.sin(tiltRad),
        z:  0,
        m: 0.001,
        r: 5,
    };
    trailPlanet = [];
}

// ── 전체 초기화 ──
function initBodies() {
    initStars();
    initPlanet();
}

// ── 물리 업데이트 (RK2 적분) ──
function accel(bodies, idx) {
    const b = bodies[idx];
    let ax = 0, ay = 0;
    for (let i = 0; i < bodies.length; i++) {
        if (i === idx) continue;
        const o  = bodies[i];
        const dx = o.x - b.x;
        const dy = o.y - b.y;
        // z 성분 포함 거리 (행성의 경우)
        const dz = (o.z || 0) - (b.z || 0);
        const r2 = dx*dx + dy*dy + dz*dz + 100; // softening
        const r  = Math.sqrt(r2);
        const f  = G * o.m / r2;
        ax += f * dx / r;
        ay += f * dy / r;
    }
    return { ax, ay };
}

function step(dt) {
    const bodies = [starA, starB, planet];

    // 각 천체 가속도 계산 후 속도/위치 업데이트 (Euler)
    bodies.forEach((b, i) => {
        const { ax, ay } = accel(bodies, i);
        b.vx += ax * dt;
        b.vy += ay * dt;
    });

    // 행성 z축 속도 (중력으로 인한 z 변화 없음 - 단순 자유 운동)
    // 두 별의 z 중력도 포함
    let pazAccel = 0;
    [starA, starB].forEach(s => {
        const dx = s.x - planet.x;
        const dy = s.y - planet.y;
        const dz = (s.z || 0) - planet.z;
        const r2 = dx*dx + dy*dy + dz*dz + 100;
        const r  = Math.sqrt(r2);
        pazAccel += G * s.m / r2 * dz / r;
    });
    planet.vz += pazAccel * dt;
    planet.z  += planet.vz * dt;

    bodies.forEach(b => {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
    });
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
    for (let i = 0; i < 5; i++) step(dt);

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

// 질량 변경: 별만 재설정, 행성은 계속 실행하며 즉시 중력 변화를 받음
bindSlider('massA', 'massAVal', v => { massA = v; initStars(); });
bindSlider('massB', 'massBVal', v => { massB = v; initStars(); });
// 속도: 리셋 없음
bindSlider('speed', 'speedVal', v => { speed = v; });
// 기울기: 행성 궤도면 자체가 바뀌므로 행성만 재설정
bindSlider('tilt',  'tiltVal',  v => { tilt  = v; initPlanet(); }, 0);

document.getElementById('showTrail').addEventListener('change', e => {
    showTrail = e.target.checked;
    if (!showTrail) { trailA = []; trailB = []; trailPlanet = []; }
});

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(render);
