d3.select("svg")
async function init() {
  const data = await d3.csv("https://TylerLott.github.io/inflation.csv")
  console.log(data)
  console.log("here")
}
