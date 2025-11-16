// Swarm Visualization for SkillSwap P2P Network
// Real-time visualization of peer connections and file transfers

class SwarmVisualizer {
    constructor(containerId, p2pClient) {
        this.container = document.getElementById(containerId);
        this.p2pClient = p2pClient;
        this.nodes = new Map(); // nodeId -> Node
        this.edges = new Map(); // edgeId -> Edge
        this.selectedResource = null;
        this.animationFrame = null;
        this.width = 800;
        this.height = 600;
        
        // D3.js-like force simulation (simplified)
        this.simulation = {
            nodes: [],
            links: [],
            forces: {
                center: { x: this.width / 2, y: this.height / 2, strength: 0.1 },
                repel: { strength: 1000 },
                attract: { strength: 0.001 }
            }
        };
        
        this.init();
    }

    init() {
        this.createCanvas();
        this.setupEventListeners();
        this.startAnimation();
    }

    createCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.style.border = '1px solid #e6e6ef';
        this.canvas.style.borderRadius = '8px';
        this.canvas.style.background = '#fafbff';
        
        this.ctx = this.canvas.getContext('2d');
        
        // Add controls
        const controls = document.createElement('div');
        controls.className = 'swarm-controls';
        controls.innerHTML = `
            <div class="control-group">
                <label>Resource:</label>
                <select id="resourceSelect">
                    <option value="">Select a resource</option>
                </select>
            </div>
            <div class="control-group">
                <button id="refreshSwarm" class="btn-refresh">🔄 Refresh</button>
                <button id="toggleAnimation" class="btn-toggle">⏸️ Pause</button>
            </div>
            <div class="control-group">
                <label>Layout:</label>
                <select id="layoutSelect">
                    <option value="force">Force-directed</option>
                    <option value="circular">Circular</option>
                    <option value="grid">Grid</option>
                    <option value="tree">Tree</option>
                </select>
            </div>
        `;
        
        this.container.innerHTML = '';
        this.container.appendChild(controls);
        this.container.appendChild(this.canvas);
        
        this.setupControls();
    }

    setupControls() {
        const resourceSelect = document.getElementById('resourceSelect');
        const refreshBtn = document.getElementById('refreshSwarm');
        const toggleBtn = document.getElementById('toggleAnimation');
        const layoutSelect = document.getElementById('layoutSelect');
        
        refreshBtn.addEventListener('click', () => {
            this.refreshSwarm();
        });
        
        toggleBtn.addEventListener('click', () => {
            this.toggleAnimation();
        });
        
        layoutSelect.addEventListener('change', (e) => {
            this.setLayout(e.target.value);
        });
        
        resourceSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                this.selectResource(parseInt(e.target.value));
            }
        });
    }

    setupEventListeners() {
        // Listen to P2P events
        this.p2pClient.on('peer-connected', (data) => {
            this.addPeer(data.peerId, 'connected');
        });
        
        this.p2pClient.on('peer-disconnected', (data) => {
            this.removePeer(data.peerId);
        });
        
        this.p2pClient.on('swarm-update', (data) => {
            this.updateSwarm(data);
        });
        
        // Canvas interactions
        this.canvas.addEventListener('click', (e) => {
            this.handleCanvasClick(e);
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            this.handleCanvasHover(e);
        });
    }

    // Add peer to visualization
    addPeer(peerId, status = 'connecting') {
        const node = {
            id: peerId,
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            vx: 0,
            vy: 0,
            status: status,
            type: peerId === this.p2pClient.userId ? 'self' : 'peer',
            radius: 20,
            color: this.getNodeColor(status, peerId === this.p2pClient.userId),
            label: `User ${peerId}`,
            piecesHave: new Set(),
            uploadSpeed: 0,
            downloadSpeed: 0
        };
        
        this.nodes.set(peerId, node);
        this.simulation.nodes.push(node);
    }

    // Remove peer from visualization
    removePeer(peerId) {
        const node = this.nodes.get(peerId);
        if (node) {
            // Remove edges connected to this node
            this.edges.forEach((edge, edgeId) => {
                if (edge.source === peerId || edge.target === peerId) {
                    this.edges.delete(edgeId);
                }
            });
            
            // Remove node
            this.nodes.delete(peerId);
            const index = this.simulation.nodes.findIndex(n => n.id === peerId);
            if (index !== -1) {
                this.simulation.nodes.splice(index, 1);
            }
        }
    }

    // Add edge between peers
    addEdge(sourceId, targetId, type = 'connection') {
        const edge = {
            id: `${sourceId}-${targetId}`,
            source: sourceId,
            target: targetId,
            type: type,
            strength: 1,
            color: this.getEdgeColor(type),
            width: this.getEdgeWidth(type)
        };
        
        this.edges.set(edge.id, edge);
        this.simulation.links.push(edge);
    }

    // Update swarm with new data
    updateSwarm(swarmData) {
        const { resourceId, peers, stats } = swarmData;
        
        // Clear existing visualization
        this.clearVisualization();
        
        // Add current user as center
        this.addPeer(this.p2pClient.userId, 'seeding');
        
        // Add other peers
        peers.forEach(peer => {
            this.addPeer(peer.user_id, peer.status);
            
            // Add edge if not self
            if (peer.user_id !== this.p2pClient.userId) {
                this.addEdge(this.p2pClient.userId, peer.user_id, 'connection');
            }
        });
        
        // Update layout
        this.applyLayout();
    }

    // Clear visualization
    clearVisualization() {
        this.nodes.clear();
        this.edges.clear();
        this.simulation.nodes = [];
        this.simulation.links = [];
    }

    // Apply layout algorithm
    applyLayout(layout = 'force') {
        switch (layout) {
            case 'circular':
                this.applyCircularLayout();
                break;
            case 'grid':
                this.applyGridLayout();
                break;
            case 'tree':
                this.applyTreeLayout();
                break;
            default:
                this.applyForceLayout();
        }
    }

    // Force-directed layout
    applyForceLayout() {
        const nodes = this.simulation.nodes;
        const links = this.simulation.links;
        const center = this.simulation.forces.center;
        
        // Apply forces
        for (let i = 0; i < 50; i++) { // Iterations
            // Center force
            nodes.forEach(node => {
                const dx = center.x - node.x;
                const dy = center.y - node.y;
                node.vx += dx * center.strength;
                node.vy += dy * center.strength;
            });
            
            // Repulsion between nodes
            for (let j = 0; j < nodes.length; j++) {
                for (let k = j + 1; k < nodes.length; k++) {
                    const node1 = nodes[j];
                    const node2 = nodes[k];
                    const dx = node2.x - node1.x;
                    const dy = node2.y - node1.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance > 0 && distance < 200) {
                        const force = this.simulation.forces.repel.strength / (distance * distance);
                        const fx = (dx / distance) * force;
                        const fy = (dy / distance) * force;
                        
                        node1.vx -= fx;
                        node1.vy -= fy;
                        node2.vx += fx;
                        node2.vy += fy;
                    }
                }
            }
            
            // Attraction along links
            links.forEach(link => {
                const source = nodes.find(n => n.id === link.source);
                const target = nodes.find(n => n.id === link.target);
                
                if (source && target) {
                    const dx = target.x - source.x;
                    const dy = target.y - source.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const force = (distance - 100) * this.simulation.forces.attract.strength;
                    
                    const fx = (dx / distance) * force;
                    const fy = (dy / distance) * force;
                    
                    source.vx += fx;
                    source.vy += fy;
                    target.vx -= fx;
                    target.vy -= fy;
                }
            });
            
            // Update positions
            nodes.forEach(node => {
                node.vx *= 0.9; // Damping
                node.vy *= 0.9;
                node.x += node.vx;
                node.y += node.vy;
                
                // Keep within bounds
                node.x = Math.max(node.radius, Math.min(this.width - node.radius, node.x));
                node.y = Math.max(node.radius, Math.min(this.height - node.radius, node.y));
            });
        }
    }

    // Circular layout
    applyCircularLayout() {
        const nodes = this.simulation.nodes;
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const radius = Math.min(this.width, this.height) * 0.3;
        
        nodes.forEach((node, index) => {
            const angle = (index / nodes.length) * 2 * Math.PI;
            node.x = centerX + radius * Math.cos(angle);
            node.y = centerY + radius * Math.sin(angle);
            node.vx = 0;
            node.vy = 0;
        });
    }

    // Grid layout
    applyGridLayout() {
        const nodes = this.simulation.nodes;
        const cols = Math.ceil(Math.sqrt(nodes.length));
        const rows = Math.ceil(nodes.length / cols);
        const cellWidth = this.width / cols;
        const cellHeight = this.height / rows;
        
        nodes.forEach((node, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            node.x = col * cellWidth + cellWidth / 2;
            node.y = row * cellHeight + cellHeight / 2;
            node.vx = 0;
            node.vy = 0;
        });
    }

    // Tree layout
    applyTreeLayout() {
        const nodes = this.simulation.nodes;
        const links = this.simulation.links;
        
        // Find root (current user)
        const root = nodes.find(n => n.id === this.p2pClient.userId);
        if (!root) return;
        
        // Build tree structure
        const tree = this.buildTree(root, nodes, links);
        
        // Position nodes
        this.positionTreeNodes(tree, this.width / 2, 50, this.width / 4);
    }

    buildTree(root, nodes, links) {
        const tree = { ...root, children: [] };
        const visited = new Set([root.id]);
        
        // Find direct connections
        links.forEach(link => {
            let childId = null;
            if (link.source === root.id && !visited.has(link.target)) {
                childId = link.target;
            } else if (link.target === root.id && !visited.has(link.source)) {
                childId = link.source;
            }
            
            if (childId) {
                const childNode = nodes.find(n => n.id === childId);
                if (childNode) {
                    tree.children.push(this.buildTree(childNode, nodes, links));
                    visited.add(childId);
                }
            }
        });
        
        return tree;
    }

    positionTreeNodes(tree, x, y, horizontalSpacing) {
        tree.x = x;
        tree.y = y;
        
        if (tree.children.length > 0) {
            const childSpacing = horizontalSpacing / tree.children.length;
            const startX = x - (horizontalSpacing / 2) + (childSpacing / 2);
            
            tree.children.forEach((child, index) => {
                const childX = startX + index * childSpacing;
                const childY = y + 100;
                this.positionTreeNodes(child, childX, childY, childSpacing * 0.8);
            });
        }
    }

    // Get node color based on status
    getNodeColor(status, isSelf) {
        if (isSelf) return '#4e54c8'; // Blue for self
        
        switch (status) {
            case 'seeding': return '#28a745'; // Green
            case 'leeching': return '#ffc107'; // Yellow
            case 'completed': return '#17a2b8'; // Cyan
            case 'connecting': return '#6c757d'; // Gray
            default: return '#dc3545'; // Red
        }
    }

    // Get edge color based on type
    getEdgeColor(type) {
        switch (type) {
            case 'connection': return '#4e54c8';
            case 'transfer': return '#28a745';
            case 'request': return '#ffc107';
            default: return '#6c757d';
        }
    }

    // Get edge width based on type
    getEdgeWidth(type) {
        switch (type) {
            case 'transfer': return 3;
            case 'request': return 2;
            default: return 1;
        }
    }

    // Render the visualization
    render() {
        const ctx = this.ctx;
        
        // Clear canvas
        ctx.clearRect(0, 0, this.width, this.height);
        
        // Draw edges
        this.edges.forEach(edge => {
            const source = this.nodes.get(edge.source);
            const target = this.nodes.get(edge.target);
            
            if (source && target) {
                ctx.beginPath();
                ctx.moveTo(source.x, source.y);
                ctx.lineTo(target.x, target.y);
                ctx.strokeStyle = edge.color;
                ctx.lineWidth = edge.width;
                ctx.stroke();
            }
        });
        
        // Draw nodes
        this.nodes.forEach(node => {
            // Draw node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
            ctx.fillStyle = node.color;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Draw label
            ctx.fillStyle = '#333';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(node.label, node.x, node.y + node.radius + 15);
            
            // Draw status indicator
            if (node.status === 'seeding') {
                ctx.beginPath();
                ctx.arc(node.x + node.radius - 5, node.y - node.radius + 5, 5, 0, 2 * Math.PI);
                ctx.fillStyle = '#28a745';
                ctx.fill();
            }
        });
    }

    // Animation loop
    startAnimation() {
        const animate = () => {
            this.applyForceLayout();
            this.render();
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }

    // Toggle animation
    toggleAnimation() {
        const toggleBtn = document.getElementById('toggleAnimation');
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
            toggleBtn.textContent = '▶️ Play';
        } else {
            this.startAnimation();
            toggleBtn.textContent = '⏸️ Pause';
        }
    }

    // Handle canvas click
    handleCanvasClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Find clicked node
        this.nodes.forEach(node => {
            const dx = x - node.x;
            const dy = y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= node.radius) {
                this.selectNode(node);
            }
        });
    }

    // Handle canvas hover
    handleCanvasHover(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        let hoveredNode = null;
        this.nodes.forEach(node => {
            const dx = x - node.x;
            const dy = y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= node.radius) {
                hoveredNode = node;
            }
        });
        
        if (hoveredNode) {
            this.canvas.style.cursor = 'pointer';
            this.showTooltip(hoveredNode, event.clientX, event.clientY);
        } else {
            this.canvas.style.cursor = 'default';
            this.hideTooltip();
        }
    }

    // Select node
    selectNode(node) {
        // Deselect previous
        this.nodes.forEach(n => n.selected = false);
        
        // Select new node
        node.selected = true;
        
        // Show node details
        this.showNodeDetails(node);
    }

    // Show node details
    showNodeDetails(node) {
        const details = `
            User: ${node.label}
            Status: ${node.status}
            Type: ${node.type}
            Upload Speed: ${formatFileSize(node.uploadSpeed)}/s
            Download Speed: ${formatFileSize(node.downloadSpeed)}/s
        `;
        
        // Update details panel or show modal
        console.log('Node details:', details);
    }

    // Show tooltip
    showTooltip(node, x, y) {
        // Create or update tooltip element
        let tooltip = document.getElementById('swarm-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'swarm-tooltip';
            tooltip.style.position = 'absolute';
            tooltip.style.background = 'rgba(0,0,0,0.8)';
            tooltip.style.color = 'white';
            tooltip.style.padding = '8px';
            tooltip.style.borderRadius = '4px';
            tooltip.style.fontSize = '12px';
            tooltip.style.pointerEvents = 'none';
            tooltip.style.zIndex = '1000';
            document.body.appendChild(tooltip);
        }
        
        tooltip.textContent = `${node.label} (${node.status})`;
        tooltip.style.left = x + 10 + 'px';
        tooltip.style.top = y - 30 + 'px';
    }

    // Hide tooltip
    hideTooltip() {
        const tooltip = document.getElementById('swarm-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    // Refresh swarm data
    async refreshSwarm() {
        if (!this.selectedResource) return;
        
        try {
            const stats = await apiCall(`${API_CONFIG.BASE_URL}/api/p2p/swarm/${this.selectedResource}/stats`);
            const peers = await apiCall(`${API_CONFIG.BASE_URL}/api/p2p/swarm/${this.selectedResource}/peers`);
            
            this.updateSwarm({ resourceId: this.selectedResource, stats, peers });
        } catch (error) {
            console.error('Failed to refresh swarm:', error);
        }
    }

    // Select resource to visualize
    selectResource(resourceId) {
        this.selectedResource = resourceId;
        this.refreshSwarm();
    }

    // Set layout
    setLayout(layout) {
        this.applyLayout(layout);
    }

    // Cleanup
    cleanup() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        this.hideTooltip();
    }
}

// Utility function for formatting file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SwarmVisualizer };
}