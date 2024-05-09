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
    // console.log("Processing data:", data);  
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

function uniqueOrgLevels(data) {
    const orgLevel1Set = new Set();
    const orgLevel2Set = new Set();

    data.forEach(d => {
        // Use explicit CSV header names for mapping
        orgLevel1Set.add(d['Consumer-Org-Level1']);
        orgLevel1Set.add(d['Producer-Org-Level1']);
        orgLevel2Set.add(d['Consumer-Org-Level2']);
        orgLevel2Set.add(d['Producer-Org-Level2']);
    });

    return {
        orgLevel1: Array.from(orgLevel1Set).filter(Boolean), // Remove null/undefined values
        orgLevel2: Array.from(orgLevel2Set).filter(Boolean) // Remove null/undefined values
    };
}

// This function initializes filters and populates them with unique values from the data.
function initializeFilters(data) {
    const orgLevels = uniqueOrgLevels(data);
    populateFilter('#orgLevel1Filter', orgLevels.orgLevel1);
    populateFilter('#orgLevel2Filter', orgLevels.orgLevel2);

    const filterColumns = ['Lifecycle-Status', 'Capabilities-Supported'];
    filterColumns.forEach(col => {
        const unique = (col === 'Capabilities-Supported') ? uniqueCapabilities(data, col) : uniqueValues(data, col);
        populateFilter('#' + col.toLowerCase().replace(/-/g, '') + 'Filter', unique.filter(Boolean));
    });

    d3.select('#lifecyclestatusFilter').on("change", () => applyFilters(data));
    d3.select('#capabilitiessupportedFilter').on("change", () => applyFilters(data));
    d3.select('#orgLevel1Filter').on("change", () => applyFilters(data));
    d3.select('#orgLevel2Filter').on("change", () => applyFilters(data));
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
    // console.log(`Unique values for ${column}:`, unique); // Log the unique values to the console
    return unique;
}


// This function populates a filter dropdown with options from the values array.
// This function populates a filter dropdown with options from the values array.
function populateFilter(selector, values) {
    let select = d3.select(selector).attr('multiple', 'multiple'); // Enable multiple selection
    select.selectAll('option').remove(); // Clear any existing options
    select.selectAll('option')
        .data(values)
        .enter()
        .append('option')
        .attr('value', d => d)
        .text(d => d);
}
function applyFilters(data) {
    let selectedLifecycle = Array.from(d3.select('#lifecyclestatusFilter').node().selectedOptions).map(d => d.value);
    let selectedCapability = Array.from(d3.select('#capabilitiessupportedFilter').node().selectedOptions).map(d => d.value);

    let selectedOrgLevel1 = Array.from(d3.select('#orgLevel1Filter').node().selectedOptions).map(d => d.value);
    let selectedOrgLevel2 = Array.from(d3.select('#orgLevel2Filter').node().selectedOptions).map(d => d.value);

    let filteredData = filterData(data, selectedLifecycle, selectedCapability, selectedOrgLevel1, selectedOrgLevel2);
    processData(filteredData);
    drawGraph();
}

function filterData(data, selectedLifecycle, selectedCapability, selectedOrgLevel1, selectedOrgLevel2) {
    return data.filter(d => {
        const matchesLifecycle = selectedLifecycle.includes(d['Lifecycle-Status']) || selectedLifecycle.length === 0;
        let capabilityList;
        try {
            capabilityList = JSON.parse(d['Capabilities-Supported']);
        } catch {
            capabilityList = d['Capabilities-Supported'].split(',').map(c => c.trim());
        }
        const matchesCapability = capabilityList.some(cap => selectedCapability.includes(cap)) || selectedCapability.length === 0;
        const matchesOrgLevel1 = selectedOrgLevel1.includes(d['Consumer-Org-Level1']) || selectedOrgLevel1.includes(d['Producer-Org-Level1']) || selectedOrgLevel1.length === 0;
        const matchesOrgLevel2 = selectedOrgLevel2.includes(d['Consumer-Org-Level2']) || selectedOrgLevel2.includes(d['Producer-Org-Level2']) || selectedOrgLevel2.length === 0;
        return matchesLifecycle && matchesCapability && matchesOrgLevel1 && matchesOrgLevel2;
    });
}

// drawGraph function definition
function drawGraph() {
    // Clear the previous graph
    svg.selectAll("*").remove();

    // Rebind the simulation nodes and links with the filtered data
    simulation.nodes(nodes).on("tick", ticked); // Make sure 'nodes' contains the filtered nodes
    simulation.force("link").links(links); // Make sure 'links' contains the filtered links

    // Define the lines (links)
    const link = svg.append("g")
                    .attr("class", "links")
                    .selectAll("path")
                    .data(links)
                    .enter().append("path")
                    .attr("class", "link-path")
                    .style("stroke", "#999")
                    .style("stroke-width", "2px")
                    .style("fill", "none")
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
        // Adjust link path to create orthogonal links
        link.attr("d", d => {
            const x1 = d.source.x;
            const y1 = d.source.y;
            const x2 = d.target.x;
            const y2 = d.target.y;

            // Calculate midpoint
            const midX = x1 + (x2 - x1) / 2;
            const midY = y1 + (y2 - y1) / 2;

            // Return path in "M L L L" format
            return `M${x1},${y1} L${midX},${y1} L${midX},${y2} L${x2},${y2}`;
        });

        node.attr("cx", d => d.x).attr("cy", d => d.y);

        nodeLabels.attr("x", d => d.x).attr("y", d => d.y - 10);
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
        return `<table style="border-collapse: collapse; border-spacing: 0; width: 100%;">
                    <tr><th>Component/System</th><th>Type</th></tr>
                    <tr>
                        <td>${d.id}</td>
                        <td>${d.type}</td>
                    </tr>
                </table>`;
    }

    // Update the style for links with the color for the integration type
    link.style("stroke", d => getColorForType(d.type));

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
    // console.log('Looking for: ', '#color-' + type, ', Found: ', colorInput, ', Value: ', colorInput ? colorInput.value : 'none');
    return colorInput ? colorInput.value : '#000000'; // Default color if not set
}
