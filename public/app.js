/**
 * Website Cloner - Frontend Application
 * Handles clone requests and real-time log streaming
 */

class WebsiteClonerApp {
  constructor() {
    // DOM elements
    this.urlInput = document.getElementById('urlInput');
    this.cloneBtn = document.getElementById('cloneBtn');
    this.progressSection = document.getElementById('progressSection');
    this.progressTitle = document.getElementById('progressTitle');
    this.progressBar = document.getElementById('progressBar');
    this.progressSteps = document.getElementById('progressSteps');
    this.consoleBody = document.getElementById('consoleBody');
    this.emptyConsole = document.getElementById('emptyConsole');
    this.resultSection = document.getElementById('resultSection');
    this.resultIcon = document.getElementById('resultIcon');
    this.resultTitle = document.getElementById('resultTitle');
    this.resultInfo = document.getElementById('resultInfo');
    this.openCloneBtn = document.getElementById('openCloneBtn');

    // State
    this.ws = null;
    this.currentJobId = null;
    this.isCloning = false;

    // Step mapping for progress
    this.stepKeywords = {
      'launch': ['Launching browser', 'Launch browser'],
      'navigate': ['Navigating', 'Navigate'],
      'scroll': ['scroll', 'Scroll', 'Auto-scroll'],
      'snapshot': ['Extracting', 'Snapshot', 'content'],
      'download': ['Download', 'asset', 'Asset'],
      'rewrite': ['Rewriting', 'Rewrite'],
      'save': ['Saving', 'Save', 'complete', 'Complete']
    };

    this.stepOrder = ['launch', 'navigate', 'scroll', 'snapshot', 'download', 'rewrite', 'save'];
    this.currentStepIndex = -1;

    this.init();
  }

  init() {
    // Event listeners
    this.cloneBtn.addEventListener('click', () => this.startClone());
    this.urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.startClone();
    });

    // Focus input on load
    this.urlInput.focus();
  }

  async startClone() {
    const url = this.urlInput.value.trim();
    if (!url) {
      this.showError('Please enter a URL to clone');
      return;
    }

    if (this.isCloning) return;

    // Reset UI
    this.resetUI();
    this.isCloning = true;
    this.cloneBtn.disabled = true;
    this.cloneBtn.querySelector('span').textContent = '⏳ Cloning...';

    // Show progress
    this.progressSection.classList.add('active');
    this.resultSection.classList.remove('active');

    try {
      // Start the clone job
      const response = await fetch('/api/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json();

      if (data.error) {
        this.showError(data.error);
        return;
      }

      this.currentJobId = data.jobId;
      this.connectWebSocket(data.jobId);

    } catch (err) {
      this.showError(`Failed to start clone: ${err.message}`);
    }
  }

  connectWebSocket(jobId) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}?jobId=${jobId}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.addLog('pipeline', 'Connected to clone server...');
    };

    this.ws.onmessage = (event) => {
      try {
        const logEntry = JSON.parse(event.data);
        this.handleLogEntry(logEntry);
      } catch (e) {
        console.error('Failed to parse log entry:', e);
      }
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      this.addLog('error', 'Connection error');
    };

    this.ws.onclose = () => {
      // Connection closed
    };
  }

  handleLogEntry(entry) {
    const { type, message, result } = entry;

    // Add to console
    this.addLog(type, message);

    // Update progress based on message content
    this.updateProgressFromMessage(message);

    // Handle completion
    if (type === 'complete') {
      this.handleCompletion(result);
    }

    // Handle errors
    if (type === 'error') {
      this.handleError(message);
    }
  }

  updateProgressFromMessage(message) {
    if (!message) return;

    // Find which step this message relates to
    for (let i = 0; i < this.stepOrder.length; i++) {
      const stepKey = this.stepOrder[i];
      const keywords = this.stepKeywords[stepKey];

      if (keywords.some(kw => message.includes(kw))) {
        if (i > this.currentStepIndex) {
          this.setStep(stepKey, i);
        }
        break;
      }
    }
  }

  setStep(stepKey, index) {
    this.currentStepIndex = index;

    // Update step badges
    const steps = this.progressSteps.querySelectorAll('.step');
    steps.forEach((step, i) => {
      step.classList.remove('active', 'completed');
      if (i < index) {
        step.classList.add('completed');
      } else if (i === index) {
        step.classList.add('active');
      }
    });

    // Update progress bar
    const progress = ((index + 1) / this.stepOrder.length) * 100;
    this.progressBar.style.width = `${progress}%`;

    // Update title
    const stepNames = {
      'launch': 'Launching browser...',
      'navigate': 'Navigating to page...',
      'scroll': 'Auto-scrolling for lazy content...',
      'snapshot': 'Capturing DOM snapshot...',
      'download': 'Downloading assets...',
      'rewrite': 'Rewriting HTML references...',
      'save': 'Saving output...'
    };
    this.progressTitle.textContent = stepNames[stepKey] || 'Processing...';
  }

  addLog(type, message) {
    // Hide empty state
    if (this.emptyConsole) {
      this.emptyConsole.style.display = 'none';
    }

    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const time = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    entry.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-type ${type}">[${type}]</span>
      <span class="log-message">${this.escapeHtml(message)}</span>
    `;

    this.consoleBody.appendChild(entry);
    this.consoleBody.scrollTop = this.consoleBody.scrollHeight;
  }

  handleCompletion(result) {
    this.isCloning = false;
    this.cloneBtn.disabled = false;
    this.cloneBtn.querySelector('span').textContent = '🔮 Clone';

    // Complete progress
    this.progressBar.style.width = '100%';
    this.progressTitle.textContent = 'Complete!';

    const steps = this.progressSteps.querySelectorAll('.step');
    steps.forEach(step => {
      step.classList.remove('active');
      step.classList.add('completed');
    });

    if (result && result.success) {
      // Show success result
      this.resultSection.classList.remove('error');
      this.resultSection.classList.add('active');
      this.resultIcon.textContent = '🎉';
      this.resultTitle.textContent = 'Clone Complete!';
      this.resultInfo.textContent = `Output folder: ${result.folderName || result.outputPath}`;
      this.openCloneBtn.href = result.openUrl;
      this.openCloneBtn.style.display = 'inline-flex';
    } else {
      this.handleError(result?.error || 'Unknown error');
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  handleError(message) {
    this.isCloning = false;
    this.cloneBtn.disabled = false;
    this.cloneBtn.querySelector('span').textContent = '🔮 Clone';

    // Show error result
    this.resultSection.classList.add('error', 'active');
    this.resultIcon.textContent = '❌';
    this.resultTitle.textContent = 'Clone Failed';
    this.resultInfo.textContent = message;
    this.openCloneBtn.style.display = 'none';

    // Hide progress
    this.progressSection.classList.remove('active');
  }

  showError(message) {
    this.addLog('error', message);
    this.handleError(message);
  }

  resetUI() {
    // Clear console (except empty state)
    const entries = this.consoleBody.querySelectorAll('.log-entry');
    entries.forEach(entry => entry.remove());

    // Show empty console
    if (this.emptyConsole) {
      this.emptyConsole.style.display = 'flex';
    }

    // Reset progress
    this.currentStepIndex = -1;
    this.progressBar.style.width = '0%';
    this.progressTitle.textContent = 'Initializing...';

    const steps = this.progressSteps.querySelectorAll('.step');
    steps.forEach(step => {
      step.classList.remove('active', 'completed');
    });

    // Hide results
    this.resultSection.classList.remove('active', 'error');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.clonerApp = new WebsiteClonerApp();
});
