// Define global variables for graph components
let nodes = [], links = [];
const svg = d3.select("#graph"),
      width = +svg.attr("width"),
      height = +svg.attr("height");

const defaultIntegrationColors = {
        "REST-API": "#00ff00", // Green
        "Batch": "#ff0000", // Red
        };

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
    console.log("Processing data:", data);  
    // Reset nodes and links before processing the new filtered data
    nodes = [];
    links = []; 

    let uniqueIntegrationTypes = uniqueValues(data, 'Integration-Type');
    populateColorConfig(uniqueIntegrationTypes);       
    // Create a mapping of producers and consumers to nodes
    const nodeMap = new Map();
    data.forEach(d => {
        if (!nodeMap.has(d.Producer)) {
            nodeMap.set(d.Producer, { id: d.Producer, type: d['Producer-Type'] });
        }
        if (!nodeMap.has(d.Consumer)) {
            nodeMap.set(d.Consumer, { id: d.Consumer, type: d['Consumer-Type'] });
        }

        // Add link (edge) data
        links.push({
            source: d['Producer'],
            target: d['Consumer'], 
            type: d['Integration-Type'],
            lifecycle: d['Lifecycle-Status'], 
            capability: d['Capabilities-Supported']
        });
    });

    nodes = Array.from(nodeMap.values());
}

function uniqueCapabilities(data, column) {
    // Similar to the uniqueValues function but with added parsing for the stringified arrays
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
    // Updated filterColumns array with the new column names
    const filterColumns = ['Lifecycle-Status', 'Capabilities-Supported'];

    filterColumns.forEach(function(col) {
        // Choose the correct unique function based on the column
        const unique = (col === 'Capabilities-Supported') ? uniqueCapabilities(data, col) : uniqueValues(data, col);
        console.log('Unique values for', col, unique); // Debug: Log the unique values
        populateFilter('#' + col.toLowerCase().replace(/-/g, '') + 'Filter', unique); // Populate the filter dropdown
    });

    // Add event listeners for the filter dropdowns
    d3.select('#lifecyclestatusFilter').on("change", () => applyFilters(data));
    d3.select('#capabilitiessupportedFilter').on("change", () => applyFilters(data));
}

function uniqueValues(data, column) {
    let allValues;
    if(column !== 'Capabilities-Supported') {
        allValues = data.map(d => {
            // Ensure the value is a string before calling trim()
            return (typeof d[column] === 'string') ? d[column].trim() : d[column];
        });
    } else {
        // Flatten the array of arrays into a single array of values
        allValues = data.flatMap(d => {
            try {
                // Parse the JSON-like string into an actual array
                return JSON.parse(d[column]);
            } catch (error) {
                console.error('Error parsing Capabilities-Supported:', d[column]);
                return []; // In case of an error, return an empty array
            }
        });
    }
    // Get unique values, filter out any falsy values like empty strings
    const unique = [...new Set(allValues)].filter(Boolean);
    console.log(`Unique values for ${column}:`, unique); // Log the unique values to the console
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
    let selectedLifecycle = d3.select('#lifecyclestatusFilter').node().value;
    let selectedCapability = d3.select('#capabilitiessupportedFilter').node().value;

    // Filter data based on selection
    let filteredData = filterData(data, selectedLifecycle, selectedCapability);

    // Re-process and redraw graph
    processData(filteredData);
    drawGraph();
}

function filterData(data, selectedLifecycle, selectedCapability) {
    return data.filter(d => {
        const matchesLifecycle = (d['Lifecycle-Status'] === selectedLifecycle || selectedLifecycle === "");
        let capabilityList;
        try {
            capabilityList = JSON.parse(d['Capabilities-Supported']);
        } catch {
            capabilityList = d['Capabilities-Supported'].split(',').map(c => c.trim());
        }
        const matchesCapability = capabilityList.includes(selectedCapability) || selectedCapability === "";
        return matchesLifecycle && matchesCapability;
    });
}

// drawGraph function definition
function drawGraph() {
    console.log("Drawing graph with nodes:", nodes, "and links:", links);
    // Clear the previous graph
    svg.selectAll("*").remove();

    // Rebind the simulation nodes and links with the filtered data
    simulation.nodes(nodes).on("tick", ticked); // Make sure 'nodes' contains the filtered nodes
    simulation.force("link").links(links); // Make sure 'links' contains the filtered links
    
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
                    <tr><th>Integration-Type</th><th>Lifecycle</th><th>Capability</th></tr>
                    <tr>
                        <td>${d.type}</td>
                        <td>${d.lifecycle}</td>
                        <td>${d.capability}</td>
                    </tr>
                </table>`;
    }

    function nodeTooltipHTML(d) {
        console.log("inside nodeTooltipHTML()")
        console.log(d);
        return  `<table style="border-collapse: collapse; border-spacing: 0; width: 100%;">
        <tr><th>Component/System</th><th>Type</th></tr>
        <tr>
            <td>${d.id}</td>
            <td>${d.type}</td>
        </tr>
    </table>`;
    }
    
    // Update the style for links with the color for the integration type
    link.style("stroke", d => {
        console.log(`Applying color for type ${d.type}: `, getColorForType(d.type));
        return getColorForType(d.type);
    });

    console.log("Color for REST-API: ", getColorForType("REST-API"));
    // Change the node color from green to blue
    node.style("fill", "#0000ff"); // Set the fill color to blue

    // Restart the simulation
    simulation.alpha(1).restart();    

}

function resetFilters() {
    // Reloads the current document
    location.reload();
}

// Function to populate the UI with color configuration options
function populateColorConfig(integrationTypes) {
    let configContainer = d3.select("#integrationTypeColorConfig");
    configContainer.selectAll('div').remove(); // Clear any existing config

    integrationTypes.forEach(type => {
        if (type === "REST-API" || type === "Batch") {
            let typeDiv = configContainer.append('div').attr('class', 'integration-type-config');

            typeDiv.append('label')
                .attr('for', 'color-' + type)
                .text(type);

            let defaultColor = defaultIntegrationColors[type] || "#000000"; // Fallback color if not predefined

            typeDiv.append('input')
                .attr('type', 'color')
                .attr('id', 'color-' + type)
                .attr('value', defaultColor)
                .on('input', function() {
                    // When a color is picked, update the colors and redraw the graph
                    defaultIntegrationColors[type] = this.value;
                    drawGraph();
                });
        }
    });
}


// Function to get the selected color for an integration type
function getColorForType(type) {
    let colorInput = d3.select('#color-' + type).node();
    console.log('Looking for: ', '#color-' + type, ', Found: ', colorInput, ', Value: ', colorInput ? colorInput.value : 'none');
    return colorInput ? colorInput.value : '#000000'; // Default color if not set
}
