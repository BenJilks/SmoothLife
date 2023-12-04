const ra = 12
const ri = Math.floor(ra / 3)

function ramp_step(x: number, a: number, ea: number): number {
    return Math.min(Math.max((x - a) / ea + 0.5, 0.0), 1.0)
}

function compute_kernel(): number[][] {
    const kernel: number[][] = []
    for (let y = -ra; y <= ra; y += 1) {
        for (let x = -ra; x <= ra; x += 1) {
            const distance = Math.sqrt(x*x + y*y)
            kernel.push([
                x, y,
                ramp_step(-distance, -ri, 1.0),
                ramp_step(-distance, -ra, 1.0) * ramp_step(distance, ri, 1.0),
            ])
        }
    }

    return kernel
}

export const vertex_shader = `
varying vec2 v_uv;

void main() {
    v_uv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const fragment_shader = (width: number, height: number) => `
varying vec2 v_uv;

uniform sampler2D state;
uniform vec2 resolution;

#define PI 3.1415926538

const float b1 = 0.278;
const float b2 = 0.365;
const float d1 = 0.267;
const float d2 = 0.445;
const float alpha_n = 0.028;
const float alpha_m = 0.147;

const float ra = float(${ ra });
const float ri = float(${ ri });
const float max_inner = PI * ri*ri;
const float max_outer = PI * (ra*ra - ri*ri);

float o(float x, float a, float alpha) {
    return 1.0 / (1.0 + exp(-(x - a) * 4.0/alpha));
}

float o_n(float x, float a, float b) {
    return o(x, a, alpha_n) * (1.0 - o(x, b, alpha_n));
}

float o_m(float x, float y, float m) {
    float o1 = o(m, 0.5, alpha_m);
    return x * (1.0 - o1) + y * o1;
}

float s(float n, float m) {
    return o_n(n, o_m(b1, d1, m), o_m(b2, d2, m));
}

void main() {
    float outer = 0.0;
    float inner = 0.0;

    ${ compute_kernel().map(([x, y, i, o]) => `{
        float value = texture2D(state, mod(v_uv + vec2(${ x / width }, ${ y / height }), 1.0)).r;
        outer += value * float(${ o });
        inner += value * float(${ i });
    }`).join('\n') }

    float n = outer / max_outer;
    float m = inner / max_inner;

    float c = s(n, m);
    gl_FragColor = vec4(c, c, c, 1.0);
}
`
