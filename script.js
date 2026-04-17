class PhotoBooth {
    constructor() {
        this.video = document.getElementById('video');
        this.filterCanvas = document.getElementById('filterCanvas');
        this.photostripCanvas = document.getElementById('photostripCanvas');
        this.countdownEl = document.getElementById('countdown');
        this.captureBtn = document.getElementById('captureBtn');
        this.switchCameraBtn = document.getElementById('switchCameraBtn');
        this.takeAnotherBtn = document.getElementById('takeAnotherBtn');
        this.printBtn = document.getElementById('printBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.photostripSection = document.getElementById('photostripSection');

        this.currentFilter = 'none';
        this.photos = [];
        this.isCapturing = false;
        this.currentStream = null;
        this.videoContext = null;
        this.mediaDevices = [];

        this.init();
    }

    async init() {
        try {
            await this.setupCamera();
            this.setupEventListeners();
            this.startFilterRendering();
        } catch (error) {
            console.error('Initialization failed:', error);
            alert('Failed to initialize camera. Please check permissions and try again.');
        }
    }

    async setupCamera() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.mediaDevices = devices.filter(device => device.kind === 'videoinput');

            const constraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            };

            this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.currentStream;

            this.videoContext = this.filterCanvas.getContext('2d');
            
            this.video.onloadedmetadata = () => {
                this.filterCanvas.width = this.video.videoWidth || 1280;
                this.filterCanvas.height = this.video.videoHeight || 720;
            };

            this.video.onresize = () => {
                this.filterCanvas.width = this.video.videoWidth;
                this.filterCanvas.height = this.video.videoHeight;
            };
        } catch (err) {
            throw new Error('Camera access failed: ' + err.message);
        }
    }

    setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelector('.filter-btn.active')?.classList.remove('active');
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
            });
        });

        // Capture button
        this.captureBtn.addEventListener('click', () => this.startCaptureSequence());

        // Switch camera
        this.switchCameraBtn.addEventListener('click', () => this.switchCamera());

        // Photostrip actions
        this.takeAnotherBtn.addEventListener('click', () => this.resetToCapture());
        this.downloadBtn.addEventListener('click', () => this.downloadPhotostrip());
        this.printBtn.addEventListener('click', () => this.printPhotostrip());
    }

    startFilterRendering() {
        const render = () => {
            if (this.video.readyState === this.video.HAVE_ENOUGH_DATA && 
                this.video.videoWidth > 0 && !this.isCapturing) {
                
                this.videoContext.save();
                this.videoContext.clearRect(0, 0, this.filterCanvas.width, this.filterCanvas.height);
                this.videoContext.drawImage(this.video, 0, 0, this.filterCanvas.width, this.filterCanvas.height);
                this.applyFilter(this.videoContext, this.currentFilter);
                this.videoContext.restore();
            }
            requestAnimationFrame(render);
        };
        render();
    }

    applyFilter(ctx, filter) {
        const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            switch (filter) {
                case 'grayscale':
                    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                    data[i] = data[i + 1] = data[i + 2] = gray;
                    break;
                case 'sepia':
                    data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
                    data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
                    data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
                    break;
                case 'vintage':
                    data[i] = Math.min(255, r * 1.2 - 20);
                    data[i + 1] = Math.min(255, g * 1.1 - 10);
                    data[i + 2] = Math.min(255, b * 0.9);
                    break;
                case 'polaroid':
                    data[i] = Math.min(255, r * 1.1);
                    data[i + 1] = Math.min(255, g * 1.05);
                    data[i + 2] = Math.min(255, b * 1.15);
                    break;
                case 'ocean':
                    data[i + 2] = Math.min(255, b * 1.3);
                    break;
                case 'sunset':
                    data[i] = Math.min(255, r * 1.4);
                    data[i + 1] = Math.min(255, g * 1.1);
                    break;
                case 'blur':
                    // Simple blur effect (sample nearby pixels)
                    if (i > 20 && i < data.length - 20) {
                        const avgR = (data[i-4] + data[i+4] + r) / 3;
                        const avgG = (data[i+1-4] + data[i+1+4] + g) / 3;
                        const avgB = (data[i+2-4] + data[i+2+4] + b) / 3;
                        data[i] = avgR;
                        data[i+1] = avgG;
                        data[i+2] = avgB;
                    }
                    break;
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }

    async startCaptureSequence() {
        if (this.isCapturing || this.photos.length >= 4) return;

        this.isCapturing = true;
        this.captureBtn.disabled = true;
        this.captureBtn.textContent = '🎬';

        for (let i = 3; i > 0; i--) {
            this.countdownEl.textContent = i;
            this.countdownEl.style.display = 'block';
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        this.countdownEl.style.display = 'none';
        this.capturePhoto();
    }

    capturePhoto() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = this.filterCanvas.width;
        canvas.height = this.filterCanvas.height;

        ctx.drawImage(this.filterCanvas, 0, 0);
        const photoData = canvas.toDataURL('image/png', 0.95);

        this.photos.push(photoData);

        if (this.photos.length < 4) {
            setTimeout(() => this.startCaptureSequence(), 800);
        } else {
            this.finishCapture();
        }
    }

    finishCapture() {
        this.isCapturing = false;
        this.captureBtn.disabled = false;
        this.captureBtn.textContent = '📸 Capture';
        this.renderPhotostrip();
    }

    renderPhotostrip() {
        const ctx = this.photostripCanvas.getContext('2d');
        const stripWidth = this.photostripCanvas.width;
        const stripHeight = this.photostripCanvas.height;
        const photoWidth = stripWidth / 2;
        const photoHeight = stripHeight / 2;
        ctx.clearRect(0, 0, stripWidth, stripHeight);

        this.photos.forEach((photo, index) => {
            const img = new Image();
            img.onload = () => {
                const x = (index % 2) * photoWidth;
                const y = Math.floor(index / 2) * photoHeight;
                ctx.drawImage(img, x, y, photoWidth, photoHeight);
            };
            img.src = photo;
        }   );  }

    resetToCapture() {
        this.photos = [];
        this.photostripSection.style.display = 'none';
        this.captureBtn.style.display = 'inline-block';
    }
}
