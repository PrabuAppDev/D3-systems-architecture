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
d3.csv("systems-components-inventory-tags.csv").then(data => {
// d3.csv("systems-components-inventory.csv").then(data => {
    processData(data);
    initializeFilters(data);
    drawGraph();
}).catch(error => {
    console.error("Error loading the CSV file:", error);
});

function processData(data) {
    // Create a mapping of producers and consumers to nodes
    const nodeMap = new Map();
    data.forEach(d => {
        if (!nodeMap.has(d.Producer)) {
            nodeMap.set(d.Producer, { id: d.Producer });
        }
        if (!nodeMap.has(d.Consumer)) {
            nodeMap.set(d.Consumer, { id: d.Consumer });
        }

        // Add link (edge) data
        links.push({
            source: d.Producer,
            target: d.Consumer,
            type: d["Integration-Type"],
            lifecycle: d.Lifecycle, 
            capability: d.Capability
        });
    });

    nodes = Array.from(nodeMap.values());
}

function uniqueCapabilities(data, column) {
    const uniqueCapSet = new Set();

    data.forEach(row => {
        if (row[column] && row[column].trim() !== '') {
            try {
                const capabilitiesArray = JSON.parse(row[column]);
                if (Array.isArray(capabilitiesArray)) {
                    capabilitiesArray.forEach(cap => uniqueCapSet.add(cap.trim()));
                }
            } catch (e) {
                uniqueCapSet.add(row[column].trim());
            }
        }
    });

    return Array.from(uniqueCapSet);
}


// This function initializes filters and populates them with unique values from the data.
function initializeFilters(data) {
    // Updated filterColumns array with the new column name 'Capabilities-Supported'
    const filterColumns = ['Lifecycle', 'Capabilities-Supported'];

    filterColumns.forEach(function(col) {
        // Choose the correct unique function based on the column
        const unique = (col === 'Capabilities-Supported') ? uniqueCapabilities(data, col) : uniqueValues(data, col);
        console.log('Unique values for', col, unique); // Debug: Log the unique values
        populateFilter('#' + col.toLowerCase().replace(/-/g, '') + 'Filter', unique); // Populate the filter dropdown
    });

    // Add event listeners for the filter dropdowns
    d3.select('#lifecycleFilter').on("change", () => applyFilters(data));
    // Make sure to use the correct ID after updating the header name
    d3.select('#capabilitiessupportedFilter').on("change", () => applyFilters(data));
}

function uniqueValues(data, column) {
    let allValues;
    if(column !== 'Capabilities') {
        allValues = data.map(d => d[column]);
    } else {
        // Flatten the array of arrays into a single array of values
        allValues = data.flatMap(d => {
            try {
                // Parse the JSON-like string into an actual array
                return JSON.parse(d[column]);
            } catch (error) {
                console.error('Error parsing Capabilities:', d[column]);
                return []; // In case of an error, return an empty array
            }
        });
    }
    // Get unique values
    const unique = [...new Set(allValues.map(v => v.trim()))];
    console.log(unique); // Log the unique capabilities to the console
    return unique;
}


// This function populates a filter dropdown with options from the values array.
function populateFilter(selector, values) {
    let select = d3.select(selector);
    select.selectAll('option').remove(); // Clear any existing options
    select.selectAll('option') // This ensures an empty selection to bind the data properly
        .data(values, function(d) { return d; }) // Binding data with a key function for tracking
        .enter()
        .append('option')
        .attr('value', function(d) { return d; })
        .text(function(d) { return d; });

    // Debug: Log to check what is being appended
    console.log('Options appended for selector:', selector, values);
}


function applyFilters(data) {
    // Get selected filter values
    let selectedLifecycle = d3.select('#lifecycleFilter').node().value;
    let selectedCapability = d3.select('#capabilityFilter').node().value;

    // Filter data
    let filteredData = data.filter(d => {
        const matchesLifecycle = (d.Lifecycle === selectedLifecycle || selectedLifecycle === "");
        const capabilityList = d.Capability.split(',').map(c => c.trim());
        const matchesCapability = capabilityList.includes(selectedCapability) || selectedCapability === "";
        return matchesLifecycle && matchesCapability;
    });

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
                    .style("stroke-width", "2px")
                    .on('mouseover', edgeMouseover)
                    .on('mouseout', mouseout); // Add mouseout event

    // Define the nodes
    const node = svg.append("g")
                    .attr("class", "nodes")
                    .selectAll("circle")
                    .data(nodes)
                    .enter().append("circle")
                    .attr("r", 5)
                    .style("fill", "#69b3a2")
                    .on('mouseover', nodeMouseover)
                    .on('mouseout', mouseout) // Add mouseout event
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

    function nodeMouseover(event, d) {
        tooltip.transition()
               .duration(200)
               .style("opacity", .9);
        tooltip.html(nodeTooltipHTML(d))
               .style("left", (event.pageX) + "px")
               .style("top", (event.pageY - 28) + "px");
    }
    
    function edgeMouseover(event, d) {
        tooltip.transition()
               .duration(200)
               .style("opacity", .9);
        tooltip.html(edgeTooltipHTML(d))
               .style("left", (event.pageX) + "px")
               .style("top", (event.pageY - 28) + "px");
    }
    
    function mouseout() {
        tooltip.transition()
               .duration(500)
               .style("opacity", 0);
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
                    <tr><th>Producer-Type</th><th>Integration-Type</th><th>Lifecycle</th><th>Capability</th></tr>
                    <tr>
                        <td>${d.id}</td>
                        <td>${d.type}</td>
                        <td>${d.lifecycle}</td>
                        <td>${d.capability}</td>
                    </tr>
                </table>`;
    }

    function nodeTooltipHTML(d) {
        // Here you need to fetch and format the data for node tooltip
        // As an example, I'm just returning the node id.
        return `<strong>${d.id}</strong>`;
    }    
}


// ... rest of the code, including any additional functions or event listeners ...
