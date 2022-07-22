d3.select("svg")
async function init() {
  const data = await d3.csv("D:/School/416_data_vis/FinalProj/inflation.csv")
  console.log(data)
  console.log("here")
}
