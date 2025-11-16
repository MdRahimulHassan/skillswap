// P2P Client for SkillSwap - Browser-based peer-to-peer file sharing
// Uses WebRTC for direct peer connections and WebSocket for coordination

class P2PClient {
    constructor(userId, trackerUrl) {
        this.userId = userId;
        this.trackerUrl = trackerUrl;
        this.peers = new Map(); // Connected peers: peerId -> PeerConnection
        this.torrents = new Map(); // Active torrents: resourceId -> Torrent
        this.ws = null; // WebSocket connection to tracker
        this.pieceSize = 1024 * 1024; // 1MB pieces
        this.maxPeers = 10; // Maximum concurrent peer connections
        this.downloadQueue = []; // Queue of pieces to download
        this.activeDownloads = new Map(); // pieceIndex -> DownloadInfo
        this.uploadQueue = []; // Queue of pieces to upload
        this.eventListeners = new Map(); // Event listeners
        
        // WebRTC configuration
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        this.init();
    }

    async init() {
        try {
            await this.connectToTracker();
            this.setupEventHandlers();
            console.log('P2P Client initialized for user:', this.userId);
        } catch (error) {
            console.error('Failed to initialize P2P client:', error);
            this.emit('error', error);
        }
    }

    // Connect to P2P tracker via WebSocket
    async connectToTracker() {
        return new Promise((resolve, reject) => {
            const wsUrl = `${this.trackerUrl}?user_id=${this.userId}`;
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('Connected to P2P tracker');
                this.emit('tracker-connected');
                resolve();
            };
            
            this.ws.onmessage = (event) => {
                this.handleTrackerMessage(JSON.parse(event.data));
            };
            
            this.ws.onerror = (error) => {
                console.error('Tracker WebSocket error:', error);
                this.emit('tracker-error', error);
                reject(error);
            };
            
            this.ws.onclose = () => {
                console.log('Disconnected from P2P tracker');
                this.emit('tracker-disconnected');
            };
        });
    }

    // Handle messages from P2P tracker
    handleTrackerMessage(message) {
        switch (message.type) {
            case 'peer_announce':
                this.handlePeerAnnounce(message);
                break;
            case 'piece_request':
                this.handlePieceRequest(message);
                break;
            case 'piece_response':
                this.handlePieceResponse(message);
                break;
            case 'swarm_update':
                this.handleSwarmUpdate(message);
                break;
            case 'peer_connect':
                this.handlePeerConnect(message);
                break;
            case 'peer_disconnect':
                this.handlePeerDisconnect(message);
                break;
            default:
                console.log('Unknown tracker message:', message);
        }
    }

    // Create and seed a new resource
    async createResource(file, metadata) {
        try {
            this.emit('create-resource-start', { file, metadata });
            
            // Calculate file hash and split into pieces
            const fileBuffer = await file.arrayBuffer();
            const fileHash = await this.calculateHash(fileBuffer);
            const pieces = await this.splitIntoPieces(fileBuffer);
            const pieceHashes = await Promise.all(pieces.map(piece => this.calculateHash(piece)));
            
            // Create torrent metadata
            const torrent = {
                id: null, // Will be set by server
                title: metadata.title,
                description: metadata.description,
                skillCategory: metadata.skillCategory,
                fileHash: fileHash,
                fileSize: file.size,
                mimeType: file.type,
                pieceCount: pieces.length,
                pieceSize: this.pieceSize,
                piecesHash: pieceHashes.join(','),
                tags: metadata.tags || [],
                difficultyLevel: metadata.difficultyLevel || 'intermediate',
                pieces: pieces,
                pieceHashes: pieceHashes
            };
            
            // Upload to server
            const formData = new FormData();
            formData.append('title', metadata.title);
            formData.append('description', metadata.description);
            formData.append('skill_category', metadata.skillCategory);
            formData.append('tags', metadata.tags?.join(',') || '');
            formData.append('difficulty_level', metadata.difficultyLevel || 'intermediate');
            formData.append('uploader_id', this.userId);
            formData.append('file', file);
            
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/p2p/resource/create`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Failed to create resource: ${response.statusText}`);
            }
            
            const resource = await response.json();
            torrent.id = resource.id;
            
            // Store torrent and start seeding
            this.torrents.set(resource.id, torrent);
            await this.startSeeding(resource.id);
            
            this.emit('create-resource-success', { resource, torrent });
            return resource;
            
        } catch (error) {
            console.error('Failed to create resource:', error);
            this.emit('create-resource-error', error);
            throw error;
        }
    }

    // Start leeching a resource
    async startLeeching(resourceId) {
        try {
            this.emit('leech-start', { resourceId });
            
            // Get resource details
            const resource = await apiCall(`${API_CONFIG.ENDPOINTS.P2P_RESOURCE}/${resourceId}`);
            
            // Get torrent info
            const torrent = {
                id: resource.id,
                title: resource.title,
                fileHash: resource.file_hash,
                fileSize: resource.file_size,
                pieceCount: resource.piece_count,
                pieceSize: resource.piece_size,
                piecesHash: resource.pieces_hash.split(','),
                pieces: new Array(resource.piece_count).fill(null),
                downloadedPieces: new Set(),
                status: 'leeching',
                progress: 0,
                downloadSpeed: 0,
                startTime: Date.now()
            };
            
            this.torrents.set(resourceId, torrent);
            
            // Announce to tracker
            await this.announceToTracker(resourceId, 'leeching', 0);
            
            // Get peers and connect
            await this.connectToPeers(resourceId);
            
            // Start downloading pieces
            this.startPieceDownload(resourceId);
            
            this.emit('leech-started', { resourceId, torrent });
            
        } catch (error) {
            console.error('Failed to start leeching:', error);
            this.emit('leech-error', error);
            throw error;
        }
    }

    // Start seeding a resource
    async startSeeding(resourceId) {
        try {
            const torrent = this.torrents.get(resourceId);
            if (!torrent) {
                throw new Error('Torrent not found');
            }
            
            torrent.status = 'seeding';
            
            // Announce to tracker
            await this.announceToTracker(resourceId, 'seeding', 100);
            
            this.emit('seeding-started', { resourceId, torrent });
            
        } catch (error) {
            console.error('Failed to start seeding:', error);
            this.emit('seeding-error', error);
        }
    }

    // Connect to peers for a resource
    async connectToPeers(resourceId) {
        try {
            // Get peer list from tracker
            const response = await apiCall(`${API_CONFIG.BASE_URL}/api/p2p/swarm/${resourceId}/peers`);
            const peers = response.filter(peer => peer.user_id !== this.userId && peer.status === 'seeding');
            
            // Connect to up to maxPeers
            const connectPromises = peers.slice(0, this.maxPeers).map(peer => 
                this.connectToPeer(peer.user_id, resourceId)
            );
            
            await Promise.allSettled(connectPromises);
            
        } catch (error) {
            console.error('Failed to connect to peers:', error);
        }
    }

    // Connect to individual peer via WebRTC
    async connectToPeer(peerId, resourceId) {
        try {
            if (this.peers.has(peerId)) {
                return; // Already connected
            }
            
            const peerConnection = new RTCPeerConnection(this.rtcConfig);
            const peer = {
                id: peerId,
                resourceId: resourceId,
                connection: peerConnection,
                dataChannel: null,
                connected: false,
                piecesHave: new Set(),
                lastActivity: Date.now()
            };
            
            this.peers.set(peerId, peer);
            
            // Setup WebRTC handlers
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    // Send ICE candidate through signaling server
                    this.sendSignalingMessage(peerId, 'ice-candidate', event.candidate);
                }
            };
            
            peerConnection.onconnectionstatechange = () => {
                console.log(`Peer ${peerId} connection state:`, peerConnection.connectionState);
                if (peerConnection.connectionState === 'connected') {
                    peer.connected = true;
                    this.emit('peer-connected', { peerId, resourceId });
                } else if (peerConnection.connectionState === 'disconnected' || 
                          peerConnection.connectionState === 'failed') {
                    this.disconnectFromPeer(peerId);
                }
            };
            
            // Create data channel for piece transfer
            const dataChannel = peerConnection.createDataChannel('pieces', {
                ordered: true,
                maxRetransmits: 3
            });
            
            this.setupDataChannel(dataChannel, peer);
            peer.dataChannel = dataChannel;
            
            // Create and send offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            this.sendSignalingMessage(peerId, 'offer', offer);
            
        } catch (error) {
            console.error(`Failed to connect to peer ${peerId}:`, error);
            this.peers.delete(peerId);
        }
    }

    // Setup data channel for peer communication
    setupDataChannel(dataChannel, peer) {
        dataChannel.onopen = () => {
            console.log(`Data channel opened with peer ${peer.id}`);
        };
        
        dataChannel.onmessage = (event) => {
            this.handlePeerMessage(peer.id, JSON.parse(event.data));
        };
        
        dataChannel.onerror = (error) => {
            console.error(`Data channel error with peer ${peer.id}:`, error);
        };
        
        dataChannel.onclose = () => {
            console.log(`Data channel closed with peer ${peer.id}`);
        };
    }

    // Handle messages from peers
    handlePeerMessage(peerId, message) {
        switch (message.type) {
            case 'piece-request':
                this.handlePeerPieceRequest(peerId, message);
                break;
            case 'piece-response':
                this.handlePeerPieceResponse(peerId, message);
                break;
            case 'bitfield':
                this.handlePeerBitfield(peerId, message);
                break;
            case 'have':
                this.handlePeerHave(peerId, message);
                break;
        }
    }

    // Start downloading pieces for a resource
    startPieceDownload(resourceId) {
        const torrent = this.torrents.get(resourceId);
        if (!torrent) return;
        
        // Find missing pieces
        const missingPieces = [];
        for (let i = 0; i < torrent.pieceCount; i++) {
            if (!torrent.downloadedPieces.has(i)) {
                missingPieces.push(i);
            }
        }
        
        if (missingPieces.length === 0) {
            this.completeDownload(resourceId);
            return;
        }
        
        // Request pieces from multiple peers
        this.downloadPiecesFromPeers(resourceId, missingPieces);
    }

    // Download pieces from available peers
    async downloadPiecesFromPeers(resourceId, pieceIndices) {
        const torrent = this.torrents.get(resourceId);
        const availablePeers = Array.from(this.peers.values())
            .filter(peer => peer.resourceId === resourceId && peer.connected);
        
        if (availablePeers.length === 0) {
            console.log('No available peers for downloading');
            return;
        }
        
        // Distribute pieces among peers
        const piecesPerPeer = Math.ceil(pieceIndices.length / availablePeers.length);
        
        for (let i = 0; i < availablePeers.length; i++) {
            const peer = availablePeers[i];
            const startIdx = i * piecesPerPeer;
            const endIdx = Math.min(startIdx + piecesPerPeer, pieceIndices.length);
            const piecesForPeer = pieceIndices.slice(startIdx, endIdx);
            
            for (const pieceIndex of piecesForPeer) {
                this.requestPieceFromPeer(peer.id, resourceId, pieceIndex);
            }
        }
    }

    // Request specific piece from peer
    requestPieceFromPeer(peerId, resourceId, pieceIndex) {
        const peer = this.peers.get(peerId);
        if (!peer || !peer.connected) return;
        
        const message = {
            type: 'piece-request',
            resourceId: resourceId,
            pieceIndex: pieceIndex
        };
        
        peer.dataChannel.send(JSON.stringify(message));
        
        // Track request
        this.activeDownloads.set(pieceIndex, {
            peerId: peerId,
            resourceId: resourceId,
            startTime: Date.now()
        });
    }

    // Handle piece response from peer
    handlePeerPieceResponse(peerId, message) {
        const { resourceId, pieceIndex, pieceData } = message;
        const torrent = this.torrents.get(resourceId);
        
        if (!torrent) return;
        
        // Verify piece hash
        const expectedHash = torrent.pieceHashes[pieceIndex];
        const actualHash = Array.from(new Uint8Array(
            await crypto.subtle.digest('SHA-256', pieceData)
        )).map(b => b.toString(16).padStart(2, '0')).join('');
        
        if (expectedHash !== actualHash) {
            console.error(`Piece ${pieceIndex} hash mismatch from peer ${peerId}`);
            return;
        }
        
        // Store piece
        torrent.pieces[pieceIndex] = pieceData;
        torrent.downloadedPieces.add(pieceIndex);
        
        // Update progress
        torrent.progress = (torrent.downloadedPieces.size / torrent.pieceCount) * 100;
        
        // Clean up active download tracking
        this.activeDownloads.delete(pieceIndex);
        
        this.emit('piece-downloaded', {
            resourceId,
            pieceIndex,
            peerId,
            progress: torrent.progress
        });
        
        // Check if download complete
        if (torrent.downloadedPieces.size === torrent.pieceCount) {
            this.completeDownload(resourceId);
        }
    }

    // Complete download and assemble file
    async completeDownload(resourceId) {
        const torrent = this.torrents.get(resourceId);
        if (!torrent) return;
        
        try {
            this.emit('download-complete-start', { resourceId });
            
            // Assemble file from pieces
            const totalSize = torrent.fileSize;
            const fileBuffer = new Uint8Array(totalSize);
            
            for (let i = 0; i < torrent.pieces.length; i++) {
                const piece = torrent.pieces[i];
                const offset = i * torrent.pieceSize;
                const length = Math.min(torrent.pieceSize, totalSize - offset);
                fileBuffer.set(new Uint8Array(piece, 0, length), offset);
            }
            
            // Create file blob
            const blob = new Blob([fileBuffer], { type: torrent.mimeType });
            
            // Update torrent status
            torrent.status = 'completed';
            torrent.progress = 100;
            
            // Announce completion to tracker
            await this.announceToTracker(resourceId, 'completed', 100);
            
            // Start seeding
            await this.startSeeding(resourceId);
            
            this.emit('download-complete', {
                resourceId,
                blob,
                fileName: `${torrent.title}.file`,
                torrent
            });
            
        } catch (error) {
            console.error('Failed to complete download:', error);
            this.emit('download-complete-error', error);
        }
    }

    // Announce status to tracker
    async announceToTracker(resourceId, status, progress) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        const message = {
            type: 'peer_announce',
            user_id: this.userId,
            resource_id: resourceId,
            status: status,
            progress: progress,
            event: status === 'started' ? 'started' : 'update'
        };
        
        this.ws.send(JSON.stringify(message));
    }

    // Utility functions
    async calculateHash(data) {
        const buffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async splitIntoPieces(buffer) {
        const pieces = [];
        const view = new Uint8Array(buffer);
        
        for (let offset = 0; offset < view.length; offset += this.pieceSize) {
            const piece = view.slice(offset, offset + this.pieceSize);
            pieces.push(piece.buffer);
        }
        
        return pieces;
    }

    // Event handling
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => callback(data));
        }
    }

    // Cleanup
    disconnect() {
        // Close all peer connections
        for (const peer of this.peers.values()) {
            if (peer.connection) {
                peer.connection.close();
            }
        }
        this.peers.clear();
        
        // Close WebSocket
        if (this.ws) {
            this.ws.close();
        }
        
        console.log('P2P client disconnected');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { P2PClient };
}