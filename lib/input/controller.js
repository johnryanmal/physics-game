
export class Controller {
  constructor() {
    this.events = {}
    this.currState = {}
    this.prevState = {}
  }

  on(event, func) {
    this.events[event] = func
  }

  off(event) {
    delete this.events[event]
  }

  listen() {
    for (const [event, func] of Object.entries(this.events)) {
      document.addEventListener(event, func)
    }
  }

  stop() {
    for (const [event, func] of Object.entries(this.events)) {
      document.removeEventListener(event, func)
    }
  }

  //placeholder
  createFrameState() {
    return {}
  }

  updateFrameState(state) {
    this.prevState = this.currState
    this.currState = state ?? this.createFrameState()
  }
}
