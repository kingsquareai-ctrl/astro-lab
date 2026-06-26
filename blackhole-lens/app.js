const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl2');

if (!gl) {
    document.body.innerHTML = '<p style="color:white;padding:40px">WebGL2를 지원하지 않는 브라우저입니다.</p>';
    throw new Error('WebGL2 not supported');
}

// ── Vertex Shader ──────────────────────────────────────────────────────────
const VS = `#version 300 es
in vec2 a_pos;
void main() {
    gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// ── Fragment Shader ────────────────────────────────────────────────────────
const FS = `#version 300 es
precision highp float;

out vec4 outColor;

uniform vec2  u_resolution;
uniform vec2  u_blackhole;   // pixel coords (origin bottom-left)
uniform float u_mass;        // 0.3 ~ 3.0
uniform float u_time;
uniform bool  u_showRadius;

// ── 해시 함수 (별 위치 생성용) ──
float hash(vec2 p) {
    p = fract(p * vec2(443.897, 441.423));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
}

// ── 절차적 별 생성 ──
vec3 starField(vec2 uv) {
    uv = fract(uv + vec2(20.0));

    // 은하수 띠: 대각선 방향의 밝은 성운 배경
    float band = uv.x * 0.6 + uv.y * 0.4;
    float milkyWay = exp(-pow((fract(band) - 0.5) * 3.5, 2.0)) * 0.18;
    vec3 col = vec3(0.04, 0.06, 0.14) + vec3(0.10, 0.12, 0.22) * milkyWay;

    // 성운 색상 (보라/파랑 확산광)
    float nebula = sin(uv.x * 4.1 + 1.2) * cos(uv.y * 3.7 - 0.8);
    col += vec3(0.05, 0.02, 0.12) * smoothstep(0.3, 1.0, nebula);

    // 4개 레이어: 대형 밝은별 / 중형 / 소형 / 미세 배경별
    float scales[4];
    scales[0] = 40.0;
    scales[1] = 90.0;
    scales[2] = 180.0;
    scales[3] = 350.0;

    float thresholds[4];
    thresholds[0] = 0.92;
    thresholds[1] = 0.80;
    thresholds[2] = 0.68;
    thresholds[3] = 0.55;

    float brightnesses[4];
    brightnesses[0] = 3.0;
    brightnesses[1] = 1.8;
    brightnesses[2] = 1.0;
    brightnesses[3] = 0.5;

    for (int i = 0; i < 4; i++) {
        vec2 gUV  = uv * scales[i];
        vec2 cell = floor(gUV);
        vec2 cUV  = fract(gUV);

        float r0 = hash(cell + float(i) * 73.13);
        if (r0 > thresholds[i]) {
            float r1 = hash(cell * 1.7 + float(i) * 137.0);
            float r2 = hash(cell * 2.3 + float(i) * 251.0);
            float r3 = hash(cell * 3.1 + float(i) *  89.0);

            vec2  starPos = vec2(r1, r2);
            float d       = length(cUV - starPos);
            float size    = 0.012 + r3 * 0.03 / float(i + 1);

            // 별 본체 + 부드러운 광채
            float core  = smoothstep(size, 0.0, d);
            float glow  = smoothstep(size * 4.0, 0.0, d) * 0.3;
            float bri   = (core + glow) * brightnesses[i];

            // 밝은 별에 십자 광선 (diffraction spike)
            if (i == 0) {
                float spike = max(
                    smoothstep(0.008, 0.0, abs(cUV.x - starPos.x)) * smoothstep(0.06, 0.0, abs(cUV.y - starPos.y)),
                    smoothstep(0.008, 0.0, abs(cUV.y - starPos.y)) * smoothstep(0.06, 0.0, abs(cUV.x - starPos.x))
                );
                bri += spike * 0.6;
            }

            // 반짝임
            bri *= 0.82 + 0.18 * sin(u_time * (1.0 + r3 * 5.0) + r0 * 6.2832);

            // 색온도: 청백 ~ 황적
            vec3 sc = mix(vec3(0.7, 0.88, 1.0), vec3(1.0, 0.85, 0.5), r2);
            if (r0 > 0.97) sc = vec3(1.0, 0.35, 0.2); // 적색 거성

            col += sc * bri;
        }
    }

    return col;
}

void main() {
    vec2 fPos  = gl_FragCoord.xy;
    vec2 delta = fPos - u_blackhole;
    float r    = length(delta);

    // 슈바르츠실트 반지름 (픽셀 단위)
    float rs          = u_mass * 24.0;
    float photonSphere = rs * 1.5;

    // ── 사건의 지평선: 순수 블랙 ──
    if (r < rs) {
        outColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    // ── 중력 렌즈 왜곡 ──
    // 빛이 블랙홀 쪽으로 휘어지므로 샘플 좌표를 블랙홀 방향으로 이동
    vec2 dir   = normalize(delta);    // BH → 픽셀 방향
    vec2 toBH  = -dir;                // 픽셀 → BH 방향

    // 기본 편향: rs² / r (r이 작을수록 강해짐)
    float lensBase = (rs * rs) / r * 1.8;

    // 광자구 근처에서 급격히 증가 (아인슈타인 링 효과)
    float boost = smoothstep(photonSphere * 8.0, photonSphere * 1.1, r);
    float lens  = lensBase * (1.0 + boost * 10.0);

    // 샘플 UV 계산
    vec2 lensedPos = fPos + toBH * lens;
    vec2 lensedUV  = lensedPos / u_resolution;

    vec3 col = starField(lensedUV);

    // ── 광자구 글로우 (주황 링) ──
    float ringDist = abs(r - photonSphere);
    float ringGlow = smoothstep(rs * 0.6, 0.0, ringDist);
    col += vec3(1.0, 0.52, 0.08) * ringGlow * 2.0;

    // ── 강착원반 암시 (BH 주변 확산 광) ──
    float diskGlow = smoothstep(rs * 7.0, rs * 1.3, r) * 0.18;
    col += vec3(0.8, 0.25, 0.02) * diskGlow;

    // ── 사건의 지평선 경계 부드럽게 처리 ──
    float edgeFade = smoothstep(rs, rs * 1.08, r);
    col *= edgeFade;

    // ── 반지름 경계선 표시 (선택) ──
    if (u_showRadius) {
        // 슈바르츠실트 반지름 (파란 선)
        float rsLine = smoothstep(2.5, 0.0, abs(r - rs));
        col = mix(col, vec3(0.2, 0.55, 1.0), rsLine * 0.75);

        // 광자구 (노란 선)
        float psLine = smoothstep(2.0, 0.0, abs(r - photonSphere));
        col = mix(col, vec3(1.0, 0.85, 0.2), psLine * 0.6);
    }

    outColor = vec4(col, 1.0);
}`;

// ── WebGL 초기화 ───────────────────────────────────────────────────────────
function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
    }
    return s;
}

function createProgram(vsSrc, fsSrc) {
    const prog = gl.createProgram();
    gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(prog));
        return null;
    }
    return prog;
}

const program = createProgram(VS, FS);
gl.useProgram(program);

// 풀스크린 쿼드 (삼각형 2개)
const quad = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
const buf  = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

const posLoc = gl.getAttribLocation(program, 'a_pos');
gl.enableVertexAttribArray(posLoc);
gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

// Uniform 위치
const uRes        = gl.getUniformLocation(program, 'u_resolution');
const uBH         = gl.getUniformLocation(program, 'u_blackhole');
const uMass       = gl.getUniformLocation(program, 'u_mass');
const uTime       = gl.getUniformLocation(program, 'u_time');
const uShowRadius = gl.getUniformLocation(program, 'u_showRadius');

// ── 상태 ──────────────────────────────────────────────────────────────────
let bhX, bhY;
let mass        = 1.0;
let showRadius  = false;
let isDragging  = false;

function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (bhX === undefined) {
        bhX = canvas.width  / 2;
        bhY = canvas.height / 2;
    }
}

// ── 마우스 인터랙션 ────────────────────────────────────────────────────────
function setPos(clientX, clientY) {
    bhX = clientX;
    bhY = canvas.height - clientY;  // WebGL Y축 반전
}

canvas.addEventListener('mousedown',  (e) => { isDragging = true;  setPos(e.clientX, e.clientY); });
canvas.addEventListener('mousemove',  (e) => { if (isDragging) setPos(e.clientX, e.clientY); });
canvas.addEventListener('mouseup',    ()  => { isDragging = false; });
canvas.addEventListener('mouseleave', ()  => { isDragging = false; });

// 터치 지원
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); isDragging = true;  setPos(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
canvas.addEventListener('touchmove',  (e) => { e.preventDefault(); if (isDragging) setPos(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
canvas.addEventListener('touchend',   ()  => { isDragging = false; });

// ── 컨트롤 UI ─────────────────────────────────────────────────────────────
document.getElementById('mass').addEventListener('input', (e) => {
    mass = parseFloat(e.target.value);
    document.getElementById('massValue').textContent = mass.toFixed(1);
});

document.getElementById('showRadius').addEventListener('change', (e) => {
    showRadius = e.target.checked;
    document.getElementById('legendBox').style.display = showRadius ? 'block' : 'none';
});

// ── 렌더 루프 ─────────────────────────────────────────────────────────────
function render(t) {
    gl.uniform2f(uRes,   canvas.width, canvas.height);
    gl.uniform2f(uBH,   bhX, bhY);
    gl.uniform1f(uMass,  mass);
    gl.uniform1f(uTime,  t * 0.001);
    gl.uniform1i(uShowRadius, showRadius ? 1 : 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
}

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(render);
