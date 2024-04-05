// Define global variables for graph components
let nodes = [], links = [];
const svg = d3.select("#graph"),
      width = +svg.attr("width"),
      height = +svg.attr("height");

// Define simulation with forces
let simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id).distance(50))
    .force("charge", d3.forceManyBody().strength(-150))
    .force("center", d3.forceCenter(width / 2, height / 2));

// Add a tooltip for displaying edge details
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// Load the CSV file and initialize the graph
d3.csv("systems-components-inventory.csv").then(data => {
    processData(data);
    initializeFilters(data);
    drawGraph();
}).catch(error => {
    console.error("Error loading the CSV file:", error);
});

function processData(data) {
    // Create a mapping of publishers and consumers to nodes
    const nodeMap = new Map();
    data.forEach(d => {
        if (!nodeMap.has(d.Publisher)) {
            nodeMap.set(d.Publisher, { id: d.Publisher });
        }
        if (!nodeMap.has(d.Consumer)) {
            nodeMap.set(d.Consumer, { id: d.Consumer });
        }

        // Add link (edge) data
        links.push({
            source: d.Publisher,
            target: d.Consumer,
            type: d["Integration-Type"],
            lifecycle: d.Lifecycle, 
            capability: d.Capability
        });
    });

    nodes = Array.from(nodeMap.values());
}

function initializeFilters(data) {
    // Populate Lifecycle filter
    populateFilter('#lifecycleFilter', uniqueValues(data, 'Lifecycle'));
    // Populate Capability filter
    populateFilter('#capabilityFilter', uniqueValues(data, 'Capability'));

    // Add event listeners
    d3.select('#lifecycleFilter').on("change", () => applyFilters(data));
    d3.select('#capabilityFilter').on("change", () => applyFilters(data));
}

function uniqueValues(data, column) {
    return [...new Set(data.map(d => d[column]))];
}

function populateFilter(selector, values) {
    let select = d3.select(selector);
    select.selectAll('option')
        .data(values)
        .enter()
        .append('option')
        .text(d => d);
}

function applyFilters(data) {
    // Get selected filter values
    let selectedLifecycle = d3.select('#lifecycleFilter').node().value;
    let selectedCapability = d3.select('#capabilityFilter').node().value;

    // Filter data
    let filteredData = data.filter(d => 
        (d.Lifecycle === selectedLifecycle || selectedLifecycle === "") &&
        (d.Capability === selectedCapability || selectedCapability === "")
    );

    // Re-process and redraw graph
    processData(filteredData);
    drawGraph();
}

// drawGraph function definition
function drawGraph() {
    // Clear the previous graph
    svg.selectAll("*").remove();

    // Update simulation nodes and links
    simulation.nodes(nodes).on("tick", ticked);
    simulation.force("link").links(links);

    // Define the lines (links)
    const link = svg.append("g")
                    .attr("class", "links")
                    .selectAll("line")
                    .data(links)
                    .enter().append("line")
                    .style("stroke", "#999")
                    .style("stroke-width", "2px") // Thicker line for better clickability
                    .on('click', edgeClicked);

    // Define the nodes
    const node = svg.append("g")
                    .attr("class", "nodes")
                    .selectAll("circle")
                    .data(nodes)
                    .enter().append("circle")
                    .attr("r", 5)
                    .style("fill", "#69b3a2")
                    .call(d3.drag()
                        .on("start", dragstarted)
                        .on("drag", dragged)
                        .on("end", dragended));

    // Add the labels for nodes
    const nodeLabels = svg.append("g")
                          .attr("class", "labels")
                          .selectAll("text")
                          .data(nodes)
                          .enter().append("text")
                          .text(d => d.id)
                          .style("text-anchor", "middle")
                          .style("fill", "#333");

    function ticked() {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);

        nodeLabels
            .attr("x", d => d.x)
            .attr("y", d => d.y - 10);
    }

    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        // Uncomment the following lines if you want nodes to be fixed at the dropped location
        // d.fx = d.x;
        // d.fy = d.y;
    }

    function edgeClicked(event, d) {
        // Toggle edge thickness and highlight connected nodes
        let isSelected = d3.select(this).classed("selected");
        svg.selectAll("line").classed("selected", false).style("stroke-width", "2px");
        d3.select(this).classed("selected", !isSelected).style("stroke-width", isSelected ? "2px" : "8px");

        // Toggle tooltip
        tooltip.transition()
            .duration(200)
            .style("opacity", .9);
        tooltip.html(edgeTooltipHTML(d))
            .style("left", (event.pageX) + "px")
            .style("top", (event.pageY - 28) + "px");
    }
    
    // Add tooltip to body
    tooltip.html("")
        .style("left", "0px")
        .style("top", "0px")
        .style("opacity", 0);

    // Generate HTML content for the tooltip
    function edgeTooltipHTML(d) {
        // Construct HTML string for tooltip
        return `<table style="border-collapse: collapse; border-spacing: 0; width: 100%;">
                    <tr><th>Publisher-Type</th><th>Integration-Type</th><th>Lifecycle</th><th>Capability</th></tr>
                    <tr>
                        <td>${d.source.id}</td>
                        <td>${d.type}</td>
                        <td>${d.lifecycle}</td>
                        <td>${d.capability}</td>
                    </tr>
                </table>`;
    }
}


// ... rest of the code, including any additional functions or event listeners ...
