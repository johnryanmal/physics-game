import { Controller } from './controller.js'

export class Mouse extends Controller {
  #x = 0
  #y = 0
  #buttons = {}
  #wheel = { dx: 0, dy: 0, dz: 0 }

  static buttonName(id) {
    switch (id) {
      case 0:   return 'Left'
      case 1:	  return 'Middle'
      case 2:	  return 'Right'
      case 3:	  return 'Back'
      case 4:		return 'Forward'
      default:  return id
    }
  }

  /*
  static buttonCode(id) {
    switch (id) {
      case 'Left':	 return 0
      case 'Middle': return 1
      case 'Right':	return 2
      case 'Back':	return 3
      case 'Forward':	return 4
      default:		return id
    }
  }
  */

  constructor() {
    super()

    this.on('mousemove', (event) => {
      this.#x = event.clientX
      this.#y = event.clientY
    })

    this.on('mousedown', (event) => {
      this.#buttons[Mouse.buttonName(event.button)] = true
    })

    this.on('mouseup', (event) => {
      this.#buttons[Mouse.buttonName(event.button)] = false
    })

    this.on('wheel', (event) => {
      this.#wheel.dx = Math.sign(event.deltaX)
      this.#wheel.dy = Math.sign(event.deltaY)
      this.#wheel.dz = Math.sign(event.deltaZ)
    })
  }

  //override
  createFrameState() {
    return {
      x: this.#x,
      y: this.#y,
      buttons: {...this.#buttons},
      wheel: {...this.#wheel}
    }
  }

  get x() {
    return this.currState.x
  }

  get y() {
    return this.currState.y
  }

  get px() {
    return this.prevState.x
  }

  get py() {
    return this.prevState.y
  }

  get dx() {
    return this.x - this.px
  }

  get dy() {
    return this.y - this.py
  }

  get wx() {
    return this.currState.wheel.dx
  }

  get wy() {
    return this.currState.wheel.dy
  }

  get wz() {
    return this.currState.wheel.dz
  }

  get pwx() {
    return this.prevState.wheel.dx
  }

  get pwy() {
    return this.prevState.wheel.dy
  }

  get pwz() {
    return this.prevState.wheel.dz
  }

  isStill() {
    return this.x === this.px && this.y === this.py
  }

  isMoving() {
    return (this.x != this.px) || (this.y != this.py)
  }

  isStateDown(state, buttonDesc) {
    let buttons = buttonDesc.split('+')
    for (const button of buttons) {
      if (!state.buttons[Mouse.buttonName(button)]) {
        return false
      }
    }
    return true
  }

  isDown(buttonDesc) {
    return this.isStateDown(this.currState, buttonDesc)
  }

  isDownPrev(buttonDesc) {
    return this.isStateDown(this.prevState, buttonDesc)
  }

  isPressed(buttonDesc) {
    return this.isDown(buttonDesc) && !this.isDownPrev(buttonDesc)
  }

  isReleased(buttonDesc) {
    return !this.isDown(buttonDesc) && this.isDownPrev(buttonDesc)
  }
}