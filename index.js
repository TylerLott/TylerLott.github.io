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

let page = 0
let page_years = [1804, 2016, 2020]

let raw_data

//////////////////////////////////////////////////////////////////////
// SETUP FOR SIMULATION
//////////////////////////////////////////////////////////////////////
function forceCluster() {
  const strength = 0.01
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
  const alpha = 0.2 // fixed for greater rigidity!
  const padding1 = 4 // separation between same-color nodes
  const padding2 = 7 // separation between different-color nodes
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
    if (!event.active) simulation.alphaTarget(0.01).restart()
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

//////////////////////////////////////////////////////////////////////
// HELPER FUNCTION
//////////////////////////////////////////////////////////////////////
let numberWithCommas = (x) => {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

//////////////////////////////////////////////////////////////////////
// MAIN FUNCITON
//////////////////////////////////////////////////////////////////////

let set_year = async (year) => {
  // REMOVE olds
  d3.select("div#details").selectAll("*").remove()
  d3.select("div#dataViewer").selectAll("*").remove()
  // GET DATA
  if (!raw_data) {
    raw_data = await d3.csv(
      "https://raw.githubusercontent.com/TylerLott/TylerLott.github.io/main/election.csv"
    )
  }
  // PROCESS DATA
  // get max vote, number of electoral votes for winner, total votes
  let cleaned_data = raw_data.reduce((group, r) => {
    if (year === parseInt(r.ElectionYear)) {
      let { CandParty, CandidateName, PopularVote, ElectoralVotes } = r
      PopularVote = PopularVote.replaceAll(",", "")
      ElectoralVotes = ElectoralVotes.replaceAll(",", "")
      group.push({
        group: CandParty,
        value: parseInt(PopularVote),
        elecVote: parseInt(ElectoralVotes),
        name: CandidateName,
      })
    }
    return group
  }, [])
  const max_vote = Math.max(...cleaned_data.map((o) => o.value))
  const winner_elec_votes = Math.max(...cleaned_data.map((o) => o.elecVote))
  const total_vote = cleaned_data.reduce((v, r) => {
    v += r.value
    return v
  }, 0)
  // get the number of votes each node will represent
  let node_value = 100
  if (10_000 < max_vote && max_vote <= 200_000) {
    node_value = 1_000
  } else if (200_000 < max_vote && max_vote <= 1_000_000) {
    node_value = 10_000
  } else if (1_000_000 < max_vote && max_vote <= 25_000_000) {
    node_value = 100_000
  } else if (25_000_000 < max_vote && max_vote <= 50_000_000) {
    node_value = 250_000
  } else if (50_000_000 < max_vote) {
    node_value = 500_000
  }
  // create nodes
  temp_data = cleaned_data.reduce((n, r) => {
    for (let i = 0; i < Math.ceil(r.value / node_value); i++) {
      n.push({ name: r.name, group: r.group, value: 2 + Math.random() })
    }
    return n
  }, [])
  temp_data = temp_data.reduce((g, r) => {
    const { group } = r
    g[group] = g[group] ?? []
    g[group].push(r)
    return g
  }, {})
  let final_data = []
  for (const [key, val] of Object.entries(temp_data)) {
    final_data.push({ children: val })
  }
  final_data = { children: final_data }

  // CREATE CLUSTER
  //   tooltip on points
  //     - party
  //     -
  let pack = () =>
    d3.pack().size([width, height]).padding(1)(
      d3.hierarchy(final_data).sum((d) => d.value)
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
    .attr("cx", (d) => {
      let val = 1000 * Math.random()
      return val
    })
    .attr("cy", (d) => 1000 * Math.random())
    .attr("fill", (d) => color(d.data.group))
    .call(drag(simulation))

  node
    .transition()
    .delay((d, i) => Math.random() * 500)
    .duration(100)
    .attrTween("r", (d) => {
      const i = d3.interpolate(0, d.r)
      return (t) => (d.r = i(t))
    })

  simulation.on("tick", () => {
    node.attr("cx", (d) => d.x).attr("cy", (d) => d.y)
  })

  // CREATE DETAILS
  //   year
  //   election winner
  //   election winning party
  //   election total votes
  elec_winner = raw_data.filter(
    (d) =>
      parseInt(d.ElectoralVotes.replaceAll(",", "")) === winner_elec_votes &&
      parseInt(d.ElectionYear) === year
  )[0]
  d3.select("div#details")
    .append("h2")
    .text(elec_winner.CandidateName.toUpperCase())
  d3.select("div#details").append("h3").text(year)
  d3.select("div#details")
    .append("p")
    .text("Total Voting Population: " + numberWithCommas(total_vote))
  d3.select("div#details")
    .append("p")
    .text("Party: " + elec_winner.CandParty)

  // CREATE LEGEND
  //  colored point | party name | votes

  // return svg.node()
}

//////////////////////////////////////////////////////////////////////
// NEXT PG FOR NARRATIVE
//////////////////////////////////////////////////////////////////////

let next_pg = () => {
  page += 1
  if (page < page_years.length) {
    set_year(page_years[page])
  } else {
    // open timeline
    document.getElementById("slidecontainer").style.visibility = "visible"
    let slider = document.getElementById("electionyear")

    console.log("dl,", slider)
    slider.oninput = () => {
      console.log("val", slider.value)
      let year = 1804 + slider.value * 4
      set_year(year)
      console.log("new year ", year)
    }
  }
}
