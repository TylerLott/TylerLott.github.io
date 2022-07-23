let n = 200
let m = 15
let color = d3.scaleOrdinal(d3.range(m), d3.schemeCategory10)
let height = 600
let width = 600
let raw_data

//////////////////////////////////////////////////////////////////////
// NARRATIVE PAGES
//////////////////////////////////////////////////////////////////////
let page = 0
const page_years = [1804, 1824, 1832, 1912, 1976, 2020]
const page_desc = {
  1804: "At the origins of the United States, a system of voting was established to allow the people to have a voice in their representation in government",
  1824: "Four candidates from the same party split the votes for the Democratic-Republican party.",
  1832: "Informal caucuses were held to discuss the potential candidates and select the best candidate for a given party before elections were held.",
  1912: "The Presidential Primary was implemented by North Dakota. This formalized the candidate selection process. Each party would conduct their own elections to determine the candidate they would like to 'pledge' as their representative for the state-wide election.",
  1976: "In the winner-take-all format of US elections, two dominant idealogical parties formed. These parties shifted from their prior idealologies to idealologies that would encompass more of the populous, creating two large, broad scoped, parties that split the country.",
  2020: "Today US elections are split nearly 50/50 between the Republican and Democratic parties.",
}

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
  const padding1 = 2 // separation between same-color nodes
  const padding2 = 4 // separation between different-color nodes
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
    if (!event.active) simulation.alphaTarget(0.05).restart()
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

let get_color = (g) => {
  if (g === "Republican") {
    return "red"
  } else if (g === "Democratic") {
    return "blue"
  } else if (g === "Libertarian") {
    return "#FED105"
  } else if (g === "Green") {
    return "#508C1B"
  } else {
    return color(g)
  }
}

//////////////////////////////////////////////////////////////////////
// MAIN FUNCITON
//////////////////////////////////////////////////////////////////////

let set_year = async (year) => {
  // REMOVE olds
  d3.select("div#details").selectAll("*").remove()
  d3.select("div#legend").selectAll("*").remove()
  d3.select("div#dataViewer").selectAll("*").remove()
  d3.select("div#notes-container").selectAll("p").remove()
  // SET NARRATIVE DESCRIPTION
  console.log(year in page_desc)
  if (year in page_desc) {
    d3.select("div#notes-container").append("p").text(page_desc[year])
    document.getElementById("notes-container").style.visibility = "visible"
  } else {
    document.getElementById("notes-container").style.visibility = "hidden"
  }
  // GET DATA
  if (!raw_data) {
    raw_data = await d3.csv("https://TylerLott.github.io/election.csv")
  }
  // PROCESS DATA
  // get max vote, number of electoral votes for winner, total votes
  let cleaned_data = raw_data.reduce((group, r) => {
    if (year === parseInt(r.ElectionYear)) {
      let { CandParty, CandidateName, PopularVote, ElectoralVotes } = r
      PopularVote = PopularVote.replaceAll(",", "")
      ElectoralVotes = ElectoralVotes.replaceAll(",", "")
      if (PopularVote > 0) {
        group.push({
          group: CandParty,
          value: parseInt(PopularVote),
          elecVote: parseInt(ElectoralVotes),
          name: CandidateName,
        })
      }
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
    .attr("fill", (d) => get_color(d.data.group))
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
  const leg_head = d3
    .select("div#legend")
    .append("div")
    .classed("legend-row", true)
  leg_head
    .append("p")
    .classed("legend-point", true)
    .text("")
    .style("padding-bottom", "3px")
  leg_head
    .append("p")
    .classed("legend-candid", true)
    .text("CANDIDATE")
    .style("padding-bottom", "3px")
  leg_head
    .append("p")
    .classed("legend-party", true)
    .text("PARTY")
    .style("padding-bottom", "3px")
  leg_head
    .append("p")
    .classed("legend-votes", true)
    .text("VOTES")
    .style("padding-bottom", "3px")
  for (i = 0; i < cleaned_data.length; i++) {
    const col = get_color(cleaned_data[i].group)
    const leg = d3
      .select("div#legend")
      .append("div")
      .classed("legend-row", true)
    leg
      .append("svg")
      .classed("legend-point", true)
      .attr("preserveAspectRatio", "xMinYMin meet")
      .attr("viewBox", "0 0 120 50")
      .append("circle")
      .attr("cx", "50%")
      .attr("cy", "50%")
      .attr("r", "0.8vw")
      .style("fill", col)
    leg
      .append("p")
      .classed("legend-party", true)
      .text(cleaned_data[i].group)
      .style("font-size", "1vw")
    leg
      .append("p")
      .classed("legend-candid", true)
      .text(cleaned_data[i].name)
      .style("font-size", "1vw")
    leg
      .append("p")
      .classed("legend-votes", true)
      .text(numberWithCommas(cleaned_data[i].value))
      .style("font-size", "1vw")
  }
  const leg_foot = d3
    .select("div#legend")
    .append("div")
    .classed("legend-node-val", true)
  leg_foot
    .append("svg")
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("viewBox", "0 0 20 20")
    .style("width", "10%")
    .append("circle")
    .attr("cx", "50%")
    .attr("cy", "50%")
    .attr("r", "0.2vw")
    .style("fill", "#cacdcf")
  leg_foot.append("p").text(" = " + numberWithCommas(node_value) + " votes")

  setTimeout(() => {
    document.getElementById("nxt-btn").style.animation = "blinker 1.5s linear 3"
  }, 7000)
}

//////////////////////////////////////////////////////////////////////
// NEXT PG FOR VIS NARRATIVE
//////////////////////////////////////////////////////////////////////

let next_pg = () => {
  let nxt_btn = document.getElementById("nxt-btn")
  page += 1
  if (page < page_years.length - 1) {
    set_year(page_years[page])
  } else if (page === page_years.length - 1) {
    // open timeline
    set_year(page_years[page])
    document.getElementById("slidecontainer").style.visibility = "visible"
    let slider = document.getElementById("electionyear")

    slider.oninput = () => {
      let year = 1804 + slider.value * 4
      set_year(year)
    }
  } else {
    document.getElementById("slidecontainer").style.visibility = "visible"
    let slider = document.getElementById("electionyear")

    slider.oninput = () => {
      let year = 1804 + slider.value * 4
      set_year(year)
    }
  }
  if (page < page_years.length - 1) {
    setTimeout(() => {
      console.log("running")
      nxt_btn.style.animation = "blinker 1.5s linear 3"
    }, 7000)
  }
}
