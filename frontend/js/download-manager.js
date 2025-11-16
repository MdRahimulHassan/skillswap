// P2P Download Manager for SkillSwap
// Manages multiple concurrent downloads with progress tracking

class DownloadManager {
    constructor(p2pClient) {
        this.p2pClient = p2pClient;
        this.activeDownloads = new Map(); // resourceId -> DownloadInfo
        this.downloadQueue = []; // Queue of downloads to start
        this.maxConcurrent = 3; // Maximum concurrent downloads
        this.downloadHistory = []; // Completed downloads
        this.eventListeners = new Map();
        
        this.setupEventListeners();
    }

    // Download information structure
    createDownloadInfo(resourceId, resource) {
        return {
            resourceId: resourceId,
            title: resource.title,
            fileName: `${resource.title}.file`,
            fileSize: resource.file_size,
            pieceCount: resource.piece_count,
            downloadedPieces: new Set(),
            progress: 0,
            downloadSpeed: 0,
            peers: new Set(),
            startTime: Date.now(),
            status: 'queued', // queued, downloading, completed, failed, paused
            error: null,
            pieces: new Array(resource.piece_count).fill(null),
            pieceHashes: resource.pieces_hash.split(','),
            mimeType: resource.mime_type
        };
    }

    // Add download to queue
    addDownload(resourceId, resource, priority = 'normal') {
        if (this.activeDownloads.has(resourceId)) {
            console.log(`Download for resource ${resourceId} already active`);
            return;
        }

        const downloadInfo = this.createDownloadInfo(resourceId, resource);
        
        if (priority === 'high') {
            this.downloadQueue.unshift(downloadInfo);
        } else {
            this.downloadQueue.push(downloadInfo);
        }

        this.emit('download-queued', { resourceId, downloadInfo });
        this.processQueue();
    }

    // Process download queue
    async processQueue() {
        if (this.activeDownloads.size >= this.maxConcurrent || this.downloadQueue.length === 0) {
            return;
        }

        const downloadInfo = this.downloadQueue.shift();
        downloadInfo.status = 'downloading';
        this.activeDownloads.set(downloadInfo.resourceId, downloadInfo);

        this.emit('download-started', { resourceId: downloadInfo.resourceId, downloadInfo });

        try {
            await this.startDownload(downloadInfo);
        } catch (error) {
            downloadInfo.status = 'failed';
            downloadInfo.error = error;
            this.emit('download-failed', { resourceId: downloadInfo.resourceId, error });
            this.activeDownloads.delete(downloadInfo.resourceId);
            this.processQueue(); // Process next in queue
        }
    }

    // Start individual download
    async startDownload(downloadInfo) {
        const { resourceId } = downloadInfo;

        try {
            // Start leeching with P2P client
            await this.p2pClient.startLeeching(resourceId);
            
            // Monitor progress
            this.monitorProgress(resourceId);
            
        } catch (error) {
            console.error(`Failed to start download for resource ${resourceId}:`, error);
            throw error;
        }
    }

    // Monitor download progress
    monitorProgress(resourceId) {
        const downloadInfo = this.activeDownloads.get(resourceId);
        if (!downloadInfo) return;

        const progressInterval = setInterval(() => {
            if (!this.activeDownloads.has(resourceId)) {
                clearInterval(progressInterval);
                return;
            }

            // Calculate progress and speed
            const elapsed = (Date.now() - downloadInfo.startTime) / 1000;
            const downloadedBytes = downloadInfo.downloadedPieces.size * downloadInfo.pieceSize;
            downloadInfo.progress = (downloadInfo.downloadedPieces.size / downloadInfo.pieceCount) * 100;
            
            if (elapsed > 0) {
                downloadInfo.downloadSpeed = downloadedBytes / elapsed;
            }

            this.emit('download-progress', { resourceId, downloadInfo });

            // Check if complete
            if (downloadInfo.downloadedPieces.size === downloadInfo.pieceCount) {
                clearInterval(progressInterval);
                this.completeDownload(resourceId);
            }
        }, 1000); // Update every second
    }

    // Complete download
    async completeDownload(resourceId) {
        const downloadInfo = this.activeDownloads.get(resourceId);
        if (!downloadInfo) return;

        try {
            downloadInfo.status = 'completed';
            
            // Get completed file from P2P client
            const torrent = this.p2pClient.torrents.get(resourceId);
            if (torrent && torrent.status === 'completed') {
                // Assemble file from pieces
                const fileBuffer = await this.assembleFile(downloadInfo);
                
                // Create blob
                const blob = new Blob([fileBuffer], { type: downloadInfo.mimeType });
                
                // Add to history
                this.downloadHistory.push({
                    resourceId: resourceId,
                    title: downloadInfo.title,
                    fileName: downloadInfo.fileName,
                    fileSize: downloadInfo.fileSize,
                    completedAt: Date.now(),
                    blob: blob
                });

                this.emit('download-completed', { 
                    resourceId, 
                    downloadInfo, 
                    blob,
                    fileName: downloadInfo.fileName 
                });
            }

        } catch (error) {
            console.error(`Failed to complete download for resource ${resourceId}:`, error);
            downloadInfo.status = 'failed';
            downloadInfo.error = error;
            this.emit('download-failed', { resourceId, error });
        } finally {
            this.activeDownloads.delete(resourceId);
            this.processQueue(); // Process next in queue
        }
    }

    // Assemble file from pieces
    async assembleFile(downloadInfo) {
        const totalSize = downloadInfo.fileSize;
        const fileBuffer = new Uint8Array(totalSize);
        
        for (let i = 0; i < downloadInfo.pieces.length; i++) {
            const piece = downloadInfo.pieces[i];
            if (piece) {
                const offset = i * downloadInfo.pieceSize;
                const length = Math.min(downloadInfo.pieceSize, totalSize - offset);
                fileBuffer.set(new Uint8Array(piece, 0, length), offset);
            }
        }
        
        return fileBuffer;
    }

    // Pause download
    pauseDownload(resourceId) {
        const downloadInfo = this.activeDownloads.get(resourceId);
        if (downloadInfo && downloadInfo.status === 'downloading') {
            downloadInfo.status = 'paused';
            this.emit('download-paused', { resourceId, downloadInfo });
        }
    }

    // Resume download
    resumeDownload(resourceId) {
        const downloadInfo = this.activeDownloads.get(resourceId);
        if (downloadInfo && downloadInfo.status === 'paused') {
            downloadInfo.status = 'downloading';
            this.emit('download-resumed', { resourceId, downloadInfo });
        }
    }

    // Cancel download
    cancelDownload(resourceId) {
        const downloadInfo = this.activeDownloads.get(resourceId);
        if (downloadInfo) {
            downloadInfo.status = 'cancelled';
            this.activeDownloads.delete(resourceId);
            this.emit('download-cancelled', { resourceId, downloadInfo });
            this.processQueue(); // Process next in queue
        }
    }

    // Get download status
    getDownloadStatus(resourceId) {
        return this.activeDownloads.get(resourceId) || null;
    }

    // Get all active downloads
    getActiveDownloads() {
        return Array.from(this.activeDownloads.values());
    }

    // Get download queue
    getDownloadQueue() {
        return [...this.downloadQueue];
    }

    // Get download history
    getDownloadHistory() {
        return [...this.downloadHistory];
    }

    // Handle piece downloaded from P2P client
    handlePieceDownloaded(resourceId, pieceIndex, pieceData) {
        const downloadInfo = this.activeDownloads.get(resourceId);
        if (!downloadInfo) return;

        // Store piece
        downloadInfo.pieces[pieceIndex] = pieceData;
        downloadInfo.downloadedPieces.add(pieceIndex);

        this.emit('piece-downloaded', { resourceId, pieceIndex, downloadInfo });
    }

    // Handle peer connected
    handlePeerConnected(resourceId, peerId) {
        const downloadInfo = this.activeDownloads.get(resourceId);
        if (downloadInfo) {
            downloadInfo.peers.add(peerId);
            this.emit('peer-connected', { resourceId, peerId, downloadInfo });
        }
    }

    // Handle peer disconnected
    handlePeerDisconnected(resourceId, peerId) {
        const downloadInfo = this.activeDownloads.get(resourceId);
        if (downloadInfo) {
            downloadInfo.peers.delete(peerId);
            this.emit('peer-disconnected', { resourceId, peerId, downloadInfo });
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Listen to P2P client events
        this.p2pClient.on('piece-downloaded', (data) => {
            this.handlePieceDownloaded(data.resourceId, data.pieceIndex, data.pieceData);
        });

        this.p2pClient.on('peer-connected', (data) => {
            this.handlePeerConnected(data.resourceId, data.peerId);
        });

        this.p2pClient.on('peer-disconnected', (data) => {
            this.handlePeerDisconnected(data.resourceId, data.peerId);
        });

        this.p2pClient.on('download-complete', (data) => {
            this.completeDownload(data.resourceId);
        });
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

    // Get download statistics
    getStatistics() {
        const activeDownloads = this.getActiveDownloads();
        const queueLength = this.downloadQueue.length;
        const totalDownloaded = this.downloadHistory.reduce((sum, download) => sum + download.fileSize, 0);
        const averageSpeed = activeDownloads.length > 0 
            ? activeDownloads.reduce((sum, dl) => sum + dl.downloadSpeed, 0) / activeDownloads.length 
            : 0;

        return {
            activeDownloads: activeDownloads.length,
            queueLength: queueLength,
            totalDownloaded: totalDownloaded,
            averageSpeed: averageSpeed,
            completedDownloads: this.downloadHistory.length
        };
    }

    // Cleanup
    cleanup() {
        // Cancel all active downloads
        for (const resourceId of this.activeDownloads.keys()) {
            this.cancelDownload(resourceId);
        }
        
        // Clear queue
        this.downloadQueue.length = 0;
        
        // Clear event listeners
        this.eventListeners.clear();
        
        console.log('Download manager cleaned up');
    }
}

// Download UI Component
class DownloadUI {
    constructor(containerId, downloadManager) {
        this.container = document.getElementById(containerId);
        this.downloadManager = downloadManager;
        this.downloadElements = new Map();
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.downloadManager.on('download-started', (data) => {
            this.addDownloadElement(data.resourceId, data.downloadInfo);
        });

        this.downloadManager.on('download-progress', (data) => {
            this.updateDownloadProgress(data.resourceId, data.downloadInfo);
        });

        this.downloadManager.on('download-completed', (data) => {
            this.markDownloadCompleted(data.resourceId, data.downloadInfo);
        });

        this.downloadManager.on('download-failed', (data) => {
            this.markDownloadFailed(data.resourceId, data.downloadInfo, data.error);
        });

        this.downloadManager.on('peer-connected', (data) => {
            this.updatePeerCount(data.resourceId, data.downloadInfo.peers.size);
        });

        this.downloadManager.on('peer-disconnected', (data) => {
            this.updatePeerCount(data.resourceId, data.downloadInfo.peers.size);
        });
    }

    addDownloadElement(resourceId, downloadInfo) {
        const element = document.createElement('div');
        element.className = 'download-item';
        element.id = `download-${resourceId}`;
        element.innerHTML = `
            <div class="download-header">
                <div class="download-title">${escapeHtml(downloadInfo.title)}</div>
                <div class="download-actions">
                    <button class="btn-pause" onclick="downloadManager.pauseDownload(${resourceId})">⏸️</button>
                    <button class="btn-cancel" onclick="downloadManager.cancelDownload(${resourceId})">❌</button>
                </div>
            </div>
            <div class="download-progress">
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-${resourceId}" style="width: 0%"></div>
                </div>
                <div class="progress-text" id="progress-text-${resourceId}">0%</div>
            </div>
            <div class="download-info">
                <span class="download-speed" id="speed-${resourceId}">0 KB/s</span>
                <span class="download-peers" id="peers-${resourceId}">0 peers</span>
                <span class="download-size">${formatFileSize(downloadInfo.fileSize)}</span>
            </div>
        `;

        this.container.appendChild(element);
        this.downloadElements.set(resourceId, element);
    }

    updateDownloadProgress(resourceId, downloadInfo) {
        const progressElement = document.getElementById(`progress-${resourceId}`);
        const progressTextElement = document.getElementById(`progress-text-${resourceId}`);
        const speedElement = document.getElementById(`speed-${resourceId}`);

        if (progressElement) {
            progressElement.style.width = `${downloadInfo.progress}%`;
        }
        
        if (progressTextElement) {
            progressTextElement.textContent = `${Math.round(downloadInfo.progress)}%`;
        }
        
        if (speedElement) {
            speedElement.textContent = `${formatFileSize(downloadInfo.downloadSpeed)}/s`;
        }
    }

    updatePeerCount(resourceId, peerCount) {
        const peersElement = document.getElementById(`peers-${resourceId}`);
        if (peersElement) {
            peersElement.textContent = `${peerCount} peers`;
        }
    }

    markDownloadCompleted(resourceId, downloadInfo) {
        const element = this.downloadElements.get(resourceId);
        if (element) {
            element.classList.add('completed');
            element.innerHTML = `
                <div class="download-header">
                    <div class="download-title">✅ ${escapeHtml(downloadInfo.title)}</div>
                </div>
                <div class="download-info">
                    <span>Download completed!</span>
                    <span>${formatFileSize(downloadInfo.fileSize)}</span>
                </div>
            `;
        }
    }

    markDownloadFailed(resourceId, downloadInfo, error) {
        const element = this.downloadElements.get(resourceId);
        if (element) {
            element.classList.add('failed');
            element.innerHTML = `
                <div class="download-header">
                    <div class="download-title">❌ ${escapeHtml(downloadInfo.title)}</div>
                </div>
                <div class="download-info">
                    <span>Failed: ${escapeHtml(error.message)}</span>
                </div>
            `;
        }
    }
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DownloadManager, DownloadUI };
}