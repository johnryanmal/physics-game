
function counter() {
  let count = 0
  return () => count++
}

//for use with planck.js linked lists
function* iterList(head) {
  let node = head
  while (node) {
    yield node
    node = node.getNext()
  }
}

function setBits(indexes) {
  let bits = 0
  for (const index of indexes) {
    bits |= 1 << index
  }
  return bits
}

function readBits(bits) {
  let indexes = []
  let index = 0
  while (bits) {
    let bit = bits & 1
    if (bit) {
      indexes.push(index)
    }
    bits >>= 1
    index += 1
  }
  return indexes
}

class Form {
  static from(shape) {
    let type = shape.getType()
    switch (type) {
      case 'circle':
        return new CircleForm(shape)
      case 'edge':
        return new EdgeForm(shape)
      case 'chain':
        return new ChainForm(shape)
      case 'polygon':
        switch(shape.constructor.name) {
          case 'BoxShape':
            return new BoxForm(shape)
          default:
            return new PolygonForm(shape)
        }
      default:
        return new Form(shape)
    }
  }

  constructor(shape) {
    this.shape = shape
  }
}

class CircleForm extends Form {
  get pos() {
    let {x, y} = this.shape.getCenter()
    return {x, y}
  }

  get x() {
    return this.pos.x
  }

  get y() {
    return this.pos.y
  }

  get r() {
    return this.shape.getRadius()
  }
}

class TwoSidedForm extends Form {
  get prev() {
    let {x, y} = this.shape.getPrevVertex()
    return {x, y}
  }

  get next() {
    let {x, y} = this.shape.getNextVertex()
    return {x, y}
  }

  get px() {
    return this.prev.x
  }

  get py() {
    return this.prev.y
  }

  get nx() {
    return this.next.x
  }

  get ny() {
    return this.next.y
  }
}

class EdgeForm extends TwoSidedForm {
  get start() {
    let {x, y} = this.shape.m_vertex1
    return {x, y}
  }

  get end() {
    let {x, y} = this.shape.m_vertex2
    return {x, y}
  }

  get x() {
    return this.start.x
  }

  get y() {
    return this.start.y
  }

  get x2() {
    return this.end.x
  }

  get y2() {
    return this.end.y
  }
}

class ChainForm extends TwoSidedForm {
  get points() {
    return this.shape.m_vertices.map(({x, y}) => ({x, y}))
  }

  get useLoop() {
    return this.shape.isLoop()
  }
}

class PolygonForm extends Form {
  get points() {
    return this.shape.m_vertices.map(({x, y}) => ({x, y}))
  }

  get pos() {
    let {x, y} = this.shape.m_centroid
    return {x, y}
  }

  get x() {
    return this.pos.x
  }

  get y() {
    return this.pos.y
  }
}

class BoxForm extends PolygonForm {
  get low() {
    let {x, y} = this.shape.getVertex(3)
    return {x, y}
  }

  get high() {
    let {x, y} = this.shape.getVertex(1)
    return {x, y}
  }

  get lx() {
    return this.low.x
  }

  get ly() {
    return this.low.y
  }

  get hx() {
    return this.high.x
  }

  get hy() {
    return this.high.y
  }

  get dx() {
    return this.hx - this.lx
  }

  get dy() {
    return this.hy - this.ly
  }

  get w() {
    return Math.abs(this.dx)
  }

  get h() {
    return Math.abs(this.dy)
  }
}



/*
  form: Simulation.defaultForm(),
  density: 1,
  friction: 0,
  elasticity: 0,
  channels: [0],
  collidesWith: [0],
  useCollision: true,
*/
//wrapper over planck.Fixture
class Part {
  constructor(fixture) {
    this.fixture = fixture
  }

  get form() {
    return Form.from(this.fixture.getShape())
  }

  get density() {
    return this.fixture.getDensity()
  }

  get friction() {
    return this.fixture.getFriction()
  }

  get elasticity() {
    return this.fixture.getRestitution()
  }

  get channels() {
    return readBits(this.fixture.getFilterCategoryBits())
  }

  get collidesWith() {
    return readBits(this.fixture.getFilterMaskBits())
  }

  canCollide(other) {
    return this.fixture.shouldCollide(other.fixture)
  }

  get useCollision() {
    return !this.fixture.isSensor()
  }
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

  get parts() {
    let parts = []
    for (const fixture of iterList(this.body.getFixtureList())) {
      parts.push(new Part(fixture))
    }
    return parts
  }
}

//wrapper over plank.Joint
class Link {
  constructor(joint) {
    self.joint = joint
  }
}

class CompoundEntity {
  constructor() {
    self.entities = []
    self.links = []
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
    this.namespace('entities', (info) => info.default?.type === 'entity')
    this.namespace('barriers', (info) => info.default?.type === 'barrier')
    this.namespace('terrain', (info) => info.default?.type === 'terrain')
    this.namespace('dynamics', (info) => ['entity', 'barrier'].includes(info.default?.type))

    if (opts.namespaces) {
      for (const [namespace, filter] of Object.entries(opts.namespaces)) {
        this.namespace(namespace, filter)
      }
    }

    this.templates = {}
    this.info = {}

    this.#define('default')

    if (opts.templates) {
      for (const [kind, template] of Object.entries(opts.templates)) {
        this.define(kind, template)
      }
    }
  }

  step() {
    this.world.step(1/this.tickrate, this.tickVel, this.tickPos)
  }

  static defaultTemplate() {
    return {
      structures: { 'default': Simulation.defaultStructure() },
      relations: []
    }
  }

  static defineTemplate(opts={}) {
    let template = Object.assign(Simulation.defaultTemplate(), opts)
    let {structures, relations} = template
    return {
      structures: Object.fromEntries(
        Object.entries(structures).map(([key, value]) => [key, Simulation.defineStructure(value)])
      ),
      relations: relations.map(Simulation.defineRelation)
    }
  }

  static defaultRelation() {
    return {}
  }

  static defineRelation(opts={}) {
    return {}
  }

  static defaultStructure() {
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
      parts: [Simulation.defaultPart()]
    }
  }

  static defineStructure(opts={}) {
    let structure = Object.assign(Simulation.defaultStructure(), opts)
    let {parts, ...model} = structure
    return {
      parts: parts.map(Simulation.definePart),
      ...model
    }
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
    return {
      form: Simulation.defineForm(form),
      ...aspect
    }
  }

  static defaultForm() {
    return {
      type: 'circle',
      x: 0,
      y: 0,
      r: 1
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
        return planck.Box( w/2, h/2, planck.Vec2(x, y) )
      }

      case 'edge': {
        let {x, y, x2, y2, prev, next} = form

        let edge = planck.Edge( planck.Vec2(x, y), planck.Vec2(x2, y2) )
        if (prev) edge.setPrevVertex( planck.Vec2(prev.x, prev.y) )
        if (next) edge.setNextVertex( planck.Vec2(next.x, next.y) )
        return edge
      }

      case 'chain': {
        let {points, useLoop, prev, next} = form
        let vertices = points?.map(({x, y}) => planck.Vec2(x, y))

        let chain = planck.Chain(vertices, useLoop)
        if (prev) chain.setPrevVertex( planck.Vec2(prev.x, prev.y) )
        if (next) chain.setNextVertex( planck.Vec2(next.x, next.y) )
        return chain
      }

      case 'polygon': {
        let {points} = form
        let vertices = points?.map(({x, y}) => planck.Vec2(x, y))

        return planck.Polygon(vertices)
      }
    }
  }

  //returns planck.FixtureDef interface
  //https://github.com/shakiba/planck.js/blob/master/docs/api/interfaces/fixturedef.md
  static defineFixture(part={}) {

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
    let {structures, relations} = template

    this.templates[kind] = template
    this.info[kind] = {
      ...Object.fromEntries(
        Object.entries(structures).map(([key, {parts, ...model}]) => [key, {...model}])
      ),
      kind
    }

    this.namespace(kind, (info) => info.kind === kind)
  }

  defineFrom(base, kind, opts={}) {
    return this.defineGroup(kind, {
      structures: {
        'default': {...this.templates[base].structures['default'], ...opts}
      }
    })
  }

  defineGroup(kind, opts) {
    this.#define(kind, opts)
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
    let {structures, relations} = Simulation.defineTemplate(template)
    let entityGroup = {}

    for (const [name, structure] of Object.entries(structures)) {
      let {parts, ...model} = Simulation.defineStructure(structure)

      let bodydef = Simulation.defineBody(model)
      let body = this.world.createBody(bodydef)
      for (const part of parts) {
        let fixturedef = Simulation.defineFixture(part)
        body.createFixture(fixturedef)
      }

      entityGroup[name] = new Entity(body)
    }

    this.scope[id] = true
    this.entities[id] = entityGroup
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
    for (const entity of Object.values(this.entities[id])) {
      this.world.destroyBody(entity.body)
    }
    delete this.scope[id]
    delete this.entities[id]
    delete this.meta[id]
  }

  //destroy entity
  destroy(id) {
    if (this.scope[id]) {
      this.#destroy(id)
      for (const namespace of Object.values(this.namespaces)) {
        namespace.delete(id)
      }
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

  unpack(group) {
    return Object.fromEntries(
      Object.entries(group).map(([key, value]) => [key, this.unwrap(value)])
    )
  }

  //force update one entity with data
  update(id, data={}) {
    this.updateGroup(id, {
      default: data
    })
  }

  updateGroup(id, data={}) {
    if (this.scope[id]) {
      let template = this.meta[id]
      for (const states of [this.stateOf(id), this.unpack(data)]) {
        for (const [key, value] of Object.entries(states)) {
          Object.assign(template.structures[key], value)
        }
      }
      this.#destroy(id)
      this.#create(id, template)
    }
  }

  //read data of entity
  stateOf(id) {
    return this.unpack(this.entities[id])
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
  updateAll(state) {
    for (const [id, data] of Object.entries(state)) {
      this.updateGroup(id, data)
    }
  }

  sync(state) {
    this.updateAll(state)
  }

  writeUpdate(ids) {
    return this.write(this.stateOfAll(ids))
  }

  readUpdate(update) {
    this.sync(this.read(update))
  }

  //make update to send over wire
  serializeUpdate(ids) {
    return this.serialize(this.writeUpdate(ids))
  }

  //apply received update data from wire
  deserializeUpdate(update) {
    this.readUpdate(this.deserialize(update))
  }

  //serialize and deserialize state for consistency
  quantize(ids) {
    this.readUpdate(this.writeUpdate(ids))
  }
}

export { Simulation }
