import { Controller } from './controller.js'

export class Keyboard extends Controller {
  #keys = {}

  constructor() {
    super()

    this.on('keydown', (event) => {
      this.#keys[event.code] = true
    })

    this.on('keyup', (event) => {
      this.#keys[event.code] = false
    })
  }

  //override
  createFrameState() {
    return {
      keys: {...this.#keys}
    }
  }

  isComboDown(state, combo) {
    let keys = combo.split('+')
    for (const key of keys) {
        if (!state.keys[key]) {
            return false
        }
    }
    return true
  }

  isStateDown(state, comboDesc) {
      let combos = comboDesc.split('|')
      for (const combo of combos) {
          if (this.isComboDown(state, combo)) {
              return true
          }
      }
      return false
  }

  isDown(keyDesc) {
    return this.isStateDown(this.currState, keyDesc)
  }

  isDownPrev(keyDesc) {
    return this.isStateDown(this.prevState, keyDesc)
  }

  isPressed(keyDesc) {
    return this.isDown(keyDesc) && !this.isDownPrev(keyDesc)
  }

  isReleased(keyDesc) {
    return !this.isDown(keyDesc) && this.isDownPrev(keyDesc)
  }
}