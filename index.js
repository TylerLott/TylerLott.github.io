// initialize the visualization
//   load data
//   first view
//async function init() {
//   const data = await d3.csv("https://tylerlott.github.io/election.csv")
//   // show 1804 election
//   d3.select("body")
//     .selectAll("p")
//     .data(data)
//     .enter()
//     .append("p")
//     .html((d, i) => {
//       console.log(d.Year, i)
//       return "Year" + d.Year
//     })
// }

let n = 200
let m = 10
let color = d3.scaleOrdinal(d3.range(m), d3.schemeCategory10)
let height = 600
let width = 600

function forceCluster() {
  const strength = 0.2
  let nodes

  function force(alpha) {
    const centroids = d3.rollup(nodes, centroid, (d) => d.data.group)
    const l = alpha * strength
    for (const d of nodes) {
      const { x: cx, y: cy } = centroids.get(d.data.group)
      d.vx -= (d.x - cx) * l
      d.vy -= (d.y - cy) * l
    }
  }

  force.initialize = (_) => (nodes = _)

  return force
}

function forceCollide() {
  const alpha = 0.4 // fixed for greater rigidity!
  const padding1 = 2 // separation between same-color nodes
  const padding2 = 6 // separation between different-color nodes
  let nodes
  let maxRadius

  function force() {
    const quadtree = d3.quadtree(
      nodes,
      (d) => d.x,
      (d) => d.y
    )
    for (const d of nodes) {
      const r = d.r + maxRadius
      const nx1 = d.x - r,
        ny1 = d.y - r
      const nx2 = d.x + r,
        ny2 = d.y + r
      quadtree.visit((q, x1, y1, x2, y2) => {
        if (!q.length)
          do {
            if (q.data !== d) {
              const r =
                d.r +
                q.data.r +
                (d.data.group === q.data.data.group ? padding1 : padding2)
              let x = d.x - q.data.x,
                y = d.y - q.data.y,
                l = Math.hypot(x, y)
              if (l < r) {
                l = ((l - r) / l) * alpha
                ;(d.x -= x *= l), (d.y -= y *= l)
                ;(q.data.x += x), (q.data.y += y)
              }
            }
          } while ((q = q.next))
        return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1
      })
    }
  }

  force.initialize = (_) =>
    (maxRadius = d3.max((nodes = _), (d) => d.r) + Math.max(padding1, padding2))

  return force
}

function centroid(nodes) {
  let x = 0
  let y = 0
  let z = 0
  for (const d of nodes) {
    let k = d.r ** 2
    x += d.x * k
    y += d.y * k
    z += k
  }
  return { x: x / z, y: y / z }
}

drag = (simulation) => {
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart()
    d.fx = d.x
    d.fy = d.y
  }

  function dragged(event, d) {
    d.fx = event.x
    d.fy = event.y
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0)
    d.fx = null
    d.fy = null
  }

  return d3
    .drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended)
}

let init = async () => {
  let data = {
    children: Array.from(
      d3.group(
        Array.from({ length: n }, (_, i) => ({
          group: (Math.random() * m) | 0,
          value: 1 + Math.random(),
        })),
        (d) => d.group
      ),
      ([, children]) => ({ children })
    ),
  }
  console.log(data)
  // const test_data = await d3.csv("https://tylerlott.github.io/election.csv", (d)=>{
  //   return {
  //     group: d.CandidateName,
  //     value: d.PopularVote
  //   }
  // })

  let pack = () =>
    d3.pack().size([width, height]).padding(1)(
      d3.hierarchy(data).sum((d) => d.value)
    )
  const nodes = pack().leaves()

  const simulation = d3
    .forceSimulation(nodes)
    .force("x", d3.forceX(width / 2).strength(0.01))
    .force("y", d3.forceY(height / 2).strength(0.01))
    .force("cluster", forceCluster())
    .force("collide", forceCollide())

  const svg = d3
    .select("div#dataViewer")
    .append("div")
    .classed("svg-container", true)
    .append("svg")
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("viewBox", "0 0 700 600")
    .classed("svg-content-responsive", true)

  const node = svg
    .append("g")
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("cx", (d) => 10)
    .attr("cy", (d) => 10)
    .attr("fill", (d) => color(d.data.group))
    .call(drag(simulation))

  node
    .transition()
    .delay((d, i) => Math.random() * 500)
    .duration(750)
    .attrTween("r", (d) => {
      const i = d3.interpolate(0, d.r)
      return (t) => (d.r = i(t))
    })

  simulation.on("tick", () => {
    node.attr("cx", (d) => d.x).attr("cy", (d) => d.y)
  })

  return svg.node()
}

// change to second view
//   increment election year up to

// change to third view
