import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const mineralsCanvasPath = new URL(
  '../src/animation/minerals-canvas-local-debug.js',
  import.meta.url
)

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function loadPlanner() {
  const source = await readFile(mineralsCanvasPath, 'utf8')
  assert(
    /export function getMineralsFrameLoadPlan/.test(source),
    'getMineralsFrameLoadPlan should remain an explicit export'
  )
  const testableSource = `${source
    .replace(/^import .*$/gm, '')
    .replace(/export function /g, 'function ')}
;({ getMineralsFrameLoadPlan })`

  return vm.runInNewContext(
    testableSource,
    {
      gsap: { registerPlugin() {} },
      ScrollTrigger: {},
    },
    { filename: mineralsCanvasPath.pathname }
  ).getMineralsFrameLoadPlan
}

function indices(plan) {
  return plan.map((item) => item.index)
}

const getMineralsFrameLoadPlan = await loadPlanner()

assert(
  typeof getMineralsFrameLoadPlan === 'function',
  'getMineralsFrameLoadPlan must be exported'
)

assert(
  getMineralsFrameLoadPlan({ targetIndex: 0, total: 0 }).length === 0,
  'empty sequences should return an empty plan'
)
assert(
  indices(getMineralsFrameLoadPlan({ targetIndex: 10, total: 1 })).join(',') ===
    '0',
  'single-frame sequences should only plan frame 0'
)
assert(
  getMineralsFrameLoadPlan({
    targetIndex: 30,
    previousIndex: 0,
    total: 600,
    maxPlan: 3,
  }).length === 3,
  'maxPlan should cap even fast scroll plans'
)

const initialPlan = getMineralsFrameLoadPlan({
  targetIndex: 0,
  previousIndex: 0,
  total: 600,
  baseAhead: 6,
  baseBehind: 2,
  mediumAhead: 16,
  fastAhead: 32,
  maxPlan: 40,
})

assert(initialPlan[0].index === 0, 'frame 0 should be first in the plan')
assert(initialPlan[0].highPriority === true, 'target frame should be high priority')
assert(indices(initialPlan).includes(6), 'slow forward plan should include base ahead')
assert(!indices(initialPlan).includes(7), 'slow forward plan should not exceed base ahead')
assert(initialPlan.length < 600, 'initial plan should not queue the full sequence')

const mediumPlan = getMineralsFrameLoadPlan({
  targetIndex: 180,
  previousIndex: 170,
  total: 600,
  baseAhead: 6,
  baseBehind: 2,
  mediumAhead: 16,
  fastAhead: 32,
  maxPlan: 40,
})

assert(
  indices(mediumPlan).includes(196),
  'medium scroll should expand forward preload to medium ahead'
)
assert(
  !indices(mediumPlan).includes(197),
  'medium scroll should not exceed medium ahead'
)
assert(
  mediumPlan.filter((item) => item.highPriority).length > 6,
  'medium scroll should prioritize more forward frames than slow scroll'
)

const fastPlan = getMineralsFrameLoadPlan({
  targetIndex: 420,
  previousIndex: 360,
  total: 600,
  baseAhead: 6,
  baseBehind: 2,
  mediumAhead: 16,
  fastAhead: 32,
  maxPlan: 40,
})

assert(indices(fastPlan).includes(452), 'fast scroll should include fast ahead')
assert(!indices(fastPlan).includes(453), 'fast scroll should stop at fast ahead')
assert(fastPlan.length <= 40, 'fast plan should remain bounded by maxPlan')
assert(
  fastPlan[0].index === 420 && fastPlan[0].highPriority,
  'fast plan should prioritize the target frame first'
)

const backwardPlan = getMineralsFrameLoadPlan({
  targetIndex: 250,
  previousIndex: 280,
  total: 600,
  baseAhead: 6,
  baseBehind: 2,
  mediumAhead: 16,
  fastAhead: 32,
  maxPlan: 40,
})

assert(indices(backwardPlan).includes(218), 'fast backward scroll should preload backward')
assert(!indices(backwardPlan).includes(282), 'backward plan should not preload far forward')
assert(backwardPlan.every((item) => item.index >= 0 && item.index < 600), 'indices must stay in range')

console.log('Minerals sequence verification passed')
