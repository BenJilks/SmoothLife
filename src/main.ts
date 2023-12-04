import * as three from 'three'
import { Scene, Camera, ShaderMaterial, MeshBasicMaterial, WebGLRenderer, WebGLRenderTarget } from 'three'

const ra = 12
const ri = Math.floor(ra / 3)
const kernel = compute_kernel()

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

const vertex_shader = `
varying vec2 v_uv;

void main() {
    v_uv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragment_shader = (width: number, height: number) => `
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

    ${ kernel.map(([x, y, i, o]) => `{
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

interface Context {
    compute_scene: Scene,
    display_scene: Scene,

    renderer: WebGLRenderer,
    camera: Camera,
    compute_material: ShaderMaterial,
    display_material: MeshBasicMaterial,

    buffer0: WebGLRenderTarget,
    buffer1: WebGLRenderTarget,
}

function initialize(canvas: HTMLCanvasElement): Context {
    const scale = 0.5
    const width = Math.floor(canvas.width * scale)
    const height = Math.floor(canvas.height * scale)

    const compute_scene = new three.Scene()
    const display_scene = new three.Scene()
    const renderer = new three.WebGLRenderer({ canvas })
    const camera = new three.OrthographicCamera(-1, 1, 1, -1, -1, 1)

    const buffer0 = create_buffer(width, height)
    const buffer1 = create_buffer(width, height)
    const compute_material = create_compute_target(compute_scene, buffer0.texture, width, height)
    const display_material = create_display_target(display_scene, buffer1.texture)
    renderer.setSize(canvas.width, canvas.height)

    return { 
        compute_scene,
        display_scene,
        renderer,
        camera,
        compute_material,
        display_material,
        buffer0,
        buffer1,
    }
}

function create_buffer(width: number, height: number): WebGLRenderTarget {
    return new WebGLRenderTarget(width, height, {
        generateMipmaps: false,
        magFilter: three.NearestFilter,
        minFilter: three.NearestFilter,
    })
}

function create_compute_target(scene: Scene, texture: three.Texture, width: number, height: number): ShaderMaterial {
    const plane = new three.PlaneGeometry(2, 2)
    const material = new three.ShaderMaterial({
        vertexShader: vertex_shader,
        fragmentShader: fragment_shader(width, height),
        uniforms: {
            'state': { value: texture },
        },
    })

    scene.add(new three.Mesh(plane, material))
    return material
}

function create_display_target(scene: Scene, texture: three.Texture): MeshBasicMaterial {
    const plane = new three.PlaneGeometry(2, 2)
    const material = new MeshBasicMaterial({
        map: texture,
    })

    scene.add(new three.Mesh(plane, material))
    return material
}

function random_grey() {
    const brightness = Math.floor(Math.random() * 255)
    return [brightness, brightness, brightness, 255]
}

function set_initial_state({ renderer, display_scene, camera, display_material, buffer0 }: Context) {
    const width = buffer0.width
    const height = buffer0.height

    const data = new Array(width * height).fill(0).map(() => [0, 0, 0, 255])
    for (let y = 0; y < height/4; y++) {
        for (let x = 0; x < width/4; x++) {
            data[y * width + x] = random_grey()
        }
    }

    const state = new three.DataTexture(Uint8Array.from(data.flat()), width, height)
    state.needsUpdate = true

    display_material.map = state
    renderer.setRenderTarget(buffer0)
    renderer.render(display_scene, camera)
}

let last_time = Date.now()
let frames = 0
function draw_frame(context: Context) {
    const now = Date.now()
    const delta = now - last_time
    frames += 1

    if (delta >= 1000) {
        console.log(frames)
        last_time = now
        frames = 0
    }

    const { renderer, camera, buffer0, buffer1 } = context
    const { compute_scene, compute_material } = context
    const { display_scene, display_material } = context
    compute_material.uniforms.state.value = buffer0.texture
    renderer.setRenderTarget(buffer1)
    renderer.render(compute_scene, camera)

    display_material.map = buffer1.texture
    renderer.setRenderTarget(null)
    renderer.render(display_scene, camera);

    [context.buffer0, context.buffer1] = [buffer1, buffer0]
    setTimeout(() => draw_frame(context), 1000 / 30)
}

const canvas = document.getElementById('canvas') as HTMLCanvasElement
const context = initialize(canvas)
set_initial_state(context)
draw_frame(context)

