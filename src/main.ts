import SmoothLife from './smooth_life'

const canvas = document.getElementById('canvas') as HTMLCanvasElement
const smooth_life = new SmoothLife(canvas)
smooth_life.set_initial_state()
setInterval(() => smooth_life.draw_frame(), 1000 / 30)

