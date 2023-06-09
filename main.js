import planck, { Simulation } from './lib/planck/index.js'
import { Keyboard } from './lib/input/index.js'

let keyboard = new Keyboard()
keyboard.listen()

const testbed_size = 40
const aspect_ratio = window.innerWidth / window.innerHeight

planck.testbed((testbed) => {
    // Viewbox center and size
    testbed.x = 0;
    testbed.y = 0;

    // Viewbox size
    testbed.width = testbed_size * aspect_ratio;
    testbed.height = testbed_size;

    testbed.speed = 1;

    let simulation = new Simulation({world: testbed.world})
        .define('topdown', {
            dampVel: 1,
            dampRot: 1,
            //useExactCollision: false
        })
        .defineFrom('topdown', 'ball')
        .defineFrom('topdown', 'box', {
            parts: [
                {
                    form: {
                        type: 'box',
                        w: 2,
                        h: 2
                    }
                }
            ]
        })
        .define('player')


    let playerid = simulation.create('player')

    let state = simulation.stateOfAll(simulation.of('dynamics'))
    testbed.step = () => {
        keyboard.updateFrameState()

        let player = simulation.get(playerid).default
        let running = keyboard.isDown('ShiftLeft|ShiftRight')
        let velocity = player.body.getLinearVelocity()
        let mass = player.body.getMass()

        velocity.mul(0.95)

        if (keyboard.isDown('Space')) {
            if (velocity.length() > 0) {
                velocity.normalize()
                velocity.mul(running? 40 : 30)
            }
        }

        let acc = running? 1 : 0.5
        let dx = (keyboard.isDown('ArrowRight|KeyD') - keyboard.isDown('ArrowLeft|KeyA'))
        let dy = (keyboard.isDown('ArrowUp|KeyW') - keyboard.isDown('ArrowDown|KeyS'))
        let direction = planck.Vec2(dx, dy)
        if (direction.length() > 0) {
            direction.normalize()
            let momentum = mass * acc
            let force = planck.Vec2.mul(direction, momentum)
            player.body.applyLinearImpulse(force, player.body.getWorldCenter())
        }

        if (keyboard.isPressed('KeyC')) {
            simulation.create('box')
        }

        if (keyboard.isDown('KeyI')) {
            simulation.update(playerid, {vy:10})
        } else if (keyboard.isDown('KeyK')) {
            simulation.update(playerid, {vy:-10})
        }
        if (keyboard.isDown('KeyJ')) {
            simulation.update(playerid, {vx:-10})
        } else if (keyboard.isDown('KeyL')) {
            simulation.update(playerid, {vx:10})
        }

        if (keyboard.isPressed('Digit1')) {
            state = simulation.stateOfAll(simulation.of('dynamics'))

        } else if (keyboard.isPressed('Digit2')) {
            simulation.sync(state)

        } else if (keyboard.isPressed('Digit3')) {
            simulation.quantize(simulation.of('dynamics'))

        } else if (keyboard.isPressed('Digit4')) {
            simulation.destroyAll(simulation.of('dynamics'))
            playerid = simulation.create('player')

        }

        simulation.step()
    }

    return simulation.world;
});

