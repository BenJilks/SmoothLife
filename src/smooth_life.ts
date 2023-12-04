import * as three from 'three'
import { Scene, Camera, ShaderMaterial, MeshBasicMaterial, WebGLRenderer, WebGLRenderTarget } from 'three'
import { vertex_shader, fragment_shader } from './shader'

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

export default class SmoothLife {
    private compute_scene: Scene
    private display_scene: Scene

    private renderer: WebGLRenderer
    private camera: Camera
    private compute_material: ShaderMaterial
    private display_material: MeshBasicMaterial

    private buffer0: WebGLRenderTarget
    private buffer1: WebGLRenderTarget

    constructor(canvas: HTMLCanvasElement) {
        const scale = 0.5
        const width = Math.floor(canvas.width * scale)
        const height = Math.floor(canvas.height * scale)

        this.compute_scene = new three.Scene()
        this.display_scene = new three.Scene()
        this.renderer = new three.WebGLRenderer({ canvas })
        this.camera = new three.OrthographicCamera(-1, 1, 1, -1, -1, 1)

        this.buffer0 = create_buffer(width, height)
        this.buffer1 = create_buffer(width, height)
        this.compute_material = create_compute_target(this.compute_scene, this.buffer0.texture, width, height)
        this.display_material = create_display_target(this.display_scene, this.buffer1.texture)
        this.renderer.setSize(canvas.width, canvas.height)
    }

    set_initial_state() {
        const width = this.buffer0.width
        const height = this.buffer0.height

        const data = new Array(width * height).fill(0).map(() => [0, 0, 0, 255])
        for (let y = 0; y < height/4; y++) {
            for (let x = 0; x < width/4; x++) {
                data[y * width + x] = random_grey()
            }
        }

        const state = new three.DataTexture(Uint8Array.from(data.flat()), width, height)
        state.needsUpdate = true

        this.display_material.map = state
        this.renderer.setRenderTarget(this.buffer0)
        this.renderer.render(this.display_scene, this.camera)
    }

    draw_frame() {
        this.compute_material.uniforms.state.value = this.buffer0.texture
        this.renderer.setRenderTarget(this.buffer1)
        this.renderer.render(this.compute_scene, this.camera)

        this.display_material.map = this.buffer1.texture
        this.renderer.setRenderTarget(null)
        this.renderer.render(this.display_scene, this.camera);

        [this.buffer0, this.buffer1] = [this.buffer1, this.buffer0]
    }
}

