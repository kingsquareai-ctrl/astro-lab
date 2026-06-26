// 메인 페이지 별 파티클 배경
const canvas = document.getElementById('bg');
const ctx = canvas.getContext('2d');

let stars = [];

function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    initStars();
}

function initStars() {
    stars = Array.from({ length: 220 }, () => ({
        x:    Math.random() * canvas.width,
        y:    Math.random() * canvas.height,
        r:    Math.random() * 1.4 + 0.3,
        a:    Math.random(),
        speed: Math.random() * 0.6 + 0.2,
        phase: Math.random() * Math.PI * 2,
    }));
}

function draw(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => {
        const bri = s.a * (0.5 + 0.5 * Math.sin(t * 0.001 * s.speed + s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 210, 255, ${bri})`;
        ctx.fill();
    });
    requestAnimationFrame(draw);
}

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(draw);
