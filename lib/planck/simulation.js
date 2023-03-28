
function counter() {
  let count = 0
  return () => count++
}

//wrapper over planck.Fixture
class Part {
  constructor(fixture) {
    this.fixture = fixture
  }

  //TODO
}

//wrapper over planck.Body
class Entity {
  constructor(body) {
    this.body = body
  }

  get pos() {
    let {x, y} = this.body.getPosition()
    return {x, y}
  }

  get x() {
    return this.pos.x
  }

  get y() {
    return this.pos.y
  }

  get vel() {
    let {x, y} = this.body.getLinearVelocity()
    return {x, y}
  }

  get vx() {
    return this.vel.x
  }

  get vy() {
    return this.vel.y
  }

  get ang() {
    return this.body.getAngle()
  }

  get rot() {
    return this.body.getAngularVelocity()
  }

  get dampVel() {
    return this.body.getLinearDamping()
  }

  get dampRot() {
    return this.body.getAngularDamping()
  }

  get canRotate() {
    return !this.body.isFixedRotation()
  }

  get offload() {
    return !this.body.isAwake()
  }

  get canOffload() {
    return this.body.isSleepingAllowed()
  }

  get canCollide() {
    return this.body.isActive()
  }

  get isExact() {
    if (this.body.isDynamic()) {
      return this.body.isBullet()
    } else {
      return true
    }
  }
}

class Simulation {
  #createID = counter()

  constructor(opts={}) {
    this.world = opts.world ?? planck.World(opts.worldConfig)
    this.tickrate = opts.tickrate ?? 60
    this.tickPos = opts.tickPos ?? 3
    this.tickVel = opts.tickVel ?? 8

    this.protocol = opts.protocol ?? Simulation.defaultProtocol()
    this.write = opts.write ?? function(data) { return data }
    this.read = opts.read ?? function(data) { return data }
    this.serialize = opts.serialize ?? JSON.stringify
    this.deserialize = opts.deserialize ?? JSON.parse


    this.scope = {}
    this.entities = {}
    this.meta = {}

    this.domain = {}
    this.filters = {}
    this.namespaces = {}

    this.namespace('instances', () => true)
    this.namespace('entities', (info) => info.type === 'entity')
    this.namespace('barriers', (info) => info.type === 'barrier')
    this.namespace('terrain', (info) => info.type === 'terrain')
    this.namespace('dynamics', (info) => info.type === 'entity' || info.type === 'barrier')

    if (opts.namespaces) {
      for (const [namespace, filter] of opts.namespaces) {
        this.namespace(namespace, filter)
      }
    }

    this.templates = {}
    this.info = {}

    this.#define('default')

    if (opts.templates) {
      for (const [kind, template] of opts.templates) {
        this.define(kind, template)
      }
    }
  }

  step() {
    this.world.step(1/this.tickrate, this.tickVel, this.tickPos)
  }

  static defaultTemplate() {
    return {
      type: 'entity',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      ang: 0,
      rot: 0,
      dampVel: 0,
      dampRot: 0,
      offload: false,
      useRotate: true,
      useOffload: true,
      useCollision: true,
      useExactCollision: true,
      parts: [this.defaultPart()]
    }
  }

  static defineTemplate(opts={}) {
    let template = Object.assign(Simulation.defaultTemplate(), opts)
    let {parts, ...model} = template
    parts = parts.map(Simulation.definePart)
    return {parts, ...model}
  }

  //returns planck.BodyDef interface
  //https://github.com/shakiba/planck.js/blob/master/docs/api/interfaces/bodydef.md
  static defineBody(model={}) {

    //position config
    let position = planck.Vec2(model.x, model.y)
    let linearVelocity = planck.Vec2(model.vx, model.vy)
    let linearDamping = model.dampVel

    //rotation config
    let angle = model.ang
    let angularVelocity = model.rot
    let angularDamping = model.dampRot
    let fixedRotation = !model.useRotate

    //internal config
    let awake = !model.offload
    let allowSleep = model.useOffload
    let active = model.useCollision
    let bullet = model.useExactCollision

    switch (model.type) {
      default:
      case 'entity':
        return {
          type: 'dynamic',
          position, linearVelocity, linearDamping,
          angle, angularVelocity, angularDamping, fixedRotation,
          awake, allowSleep, active, bullet
        }

      case 'barrier':
        return {
          type: 'kinematic',
          position, linearVelocity, linearDamping,
          angle, angularVelocity, angularDamping, fixedRotation,
          awake, allowSleep, active
        }

      case 'terrain':
        return {
          type: 'static',
          position,
          angle,
          active
        }
    }
  }

  static defaultPart() {
    return {
      form: Simulation.defaultForm(),
      density: 1,
      friction: 0,
      elasticity: 0,
      channels: [0],
      collidesWith: [0],
      useCollision: true,
    }
  }

  static definePart(opts={}) {
    let part = Object.assign(Simulation.defaultPart(), opts)
    let {form, ...aspect} = part
    form = Simulation.defineForm(form)
    return {form, ...aspect}
  }

  static defaultForm() {
    return {
      type: 'circle',
      x: 0,
      y: 0,
      r: 1,
    }
  }

  static defineForm(opts={}) {
    //TODO more robust opts handling
    return Object.assign(Simulation.defaultForm(), opts)
  }

  static defineShape(form) {
    switch (form.type) {
      default:
      case 'circle': {
        let {x, y, r} = form
        return planck.Circle( r, planck.Vec2(x, y) )
      }

      case 'box': {
        let {x, y, w, h} = form
        return planck.Box( w, h, planck.Vec2(x, y) )
      }

      case 'edge': {
        let {x, y, x2, y2} = form
        return planck.Edge( planck.Vec2(x, y), planck.Vec2(x2, y2) )
      }

      case 'chain': {
        let vertices = form.vertices?.map(({x, y}) => planck.Vec2(x, y))
        return planck.Chain(vertices)
      }

      case 'polygon': {
        let vertices = form.vertices?.map(({x, y}) => planck.Vec2(x, y))
        return planck.Polygon(vertices)
      }
    }
  }

  //returns planck.FixtureDef interface
  //https://github.com/shakiba/planck.js/blob/master/docs/api/interfaces/fixturedef.md
  static defineFixture(part={}) {
    function setBits(indexes) {
      let bits = 0
      for (const index of indexes) {
        bits |= 1 << index
      }
      return bits
    }

    //geometry config
    let shape = this.defineShape(part.form)
    let isSensor = !part.useCollision

    //physics config
    let density = part.density
    let friction = part.friction
    let restitution = part.elasticity

    //filter config
    let filterCategoryBits = setBits(part.channels)
    let filterMaskBits = setBits(part.collidesWith)

    return {
      shape, isSensor,
      density, friction, restitution,
      filterCategoryBits, filterMaskBits
    }
  }

  //make namespace
  namespace(name, filter) {
    this.domain[name] = true
    this.filters[name] = filter
    this.namespaces[name] = new Set()

    return this
  }

  of(...names) {
    let result = new Set()
    for (const name of names) {
      if (this.domain[name]) {
        for (const id of this.namespaces[name]) {
          result.add(id)
        }
      }

    }
    return result
  }

  get(id) {
    return this.entities[id]
  }

  getAll(ids) {
    let entities = {}
    for (const id of ids) {
      entities[id] = this.get(id)
    }
    return entities
  }

  #define(kind, opts={}) {
    let template = Simulation.defineTemplate(opts)
    let {parts, ...model} = template

    this.templates[kind] = template
    this.info[kind] = {...model, kind}

    this.namespace(kind, (info) => info.kind === kind)
  }

  defineFrom(base, kind, opts={}) {
    this.#define(kind, {...this.templates[base], ...opts})
    return this
  }

  //define template (and namespace)
  define(kind, opts={}) {
    return this.defineFrom('default', kind, opts)
  }

  //remove template
  /*
  #undefine(kind) {
    if (this.domain[kind]) {
      delete this.domain[kind]
      delete this.templates[kind]
      delete this.info[kind]
    }
  }
  */

  definition(kind) {
    return this.templates[kind]
  }

  #create(id, template={}) {
    let {parts, ...model} = template

    let bodydef = Simulation.defineBody(model)
    let body = this.world.createBody(bodydef)
    for (const part of parts) {
      let fixturedef = Simulation.defineFixture(part)
      body.createFixture(fixturedef)
    }

    this.scope[id] = true
    this.entities[id] = new Entity(body)
    this.meta[id] = template
  }

  //create entity with model
  create(kind='default', opts={}) {
    let id = this.#createID()
    let info = this.info[kind]

    this.#create(id, {...this.templates[kind], ...opts})

    for (const [name, filter] of Object.entries(this.filters)) {
      if (filter(info)) {
        this.namespaces[name].add(id)
      }
    }

    return id
  }

  #destroy(id) {
    if (this.scope[id]) {
      this.world.destroyBody(this.entities[id].body)
      delete this.scope[id]
      delete this.entities[id]
      delete this.meta[id]
    }
  }

  //destroy entity
  destroy(id) {
    this.#destroy(id)

    for (const namespace of Object.values(this.namespaces)) {
      namespace.delete(id)
    }
  }

  //destroy all entities of namespace
  destroyAll(ids) {
    for (const id of ids) {
      this.destroy(id)
    }
  }

  static defaultProtocol() {
    return ['x', 'y', 'vx', 'vy', 'ang', 'rot']
  }

  unwrap(obj) {
    let result = {}
    for (const key of this.protocol) {
      let value = obj[key]
      if (value !== undefined) {
        result[key] = value
      }
    }
    return result
  }

  //force update one entity with data
  update(id, data={}) {
    if (this.scope[id]) {
      let state = {...this.stateOf(id), ...this.unwrap(data)}
      let template = {...this.meta[id], ...state}
      this.#destroy(id)
      this.#create(id, template)
    }
  }

  //read data of entity
  stateOf(id) {
    return this.unwrap(this.entities[id])
  }

  //read state of namespace
  stateOfAll(ids) {
    let state = {}
    for (const id of ids) {
      state[id] = this.stateOf(id)
    }
    return state
  }

  state() {
    return this.stateOfAll('instances')
  }

  //update many entities with state
  sync(state) {
    for (const [id, data] of Object.entries(state)) {
      this.update(id, data)
    }
  }

  pack(state) {
    let packed = {}
    for (const [id, data] of Object.entries(state)) {
      packed[id] = this.write(data)
    }
    return packed
  }

  //make update to send over wire
  makeUpdate(ids) {
    return this.serialize(this.write(ids))
  }

  //apply received update data from wire
  applyUpdate(state) {
    this.sync(this.read(this.deserialize(state)))
  }

  //serialize and deserialize state for consistency
  quantize(ids) {
    this.sync(this.read(this.write(this.stateOfAll(ids))))
  }
}

export { Simulation }

