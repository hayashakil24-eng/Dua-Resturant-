const setupSection = document.getElementById('setup')
const lockSection = document.getElementById('lock')
const dashboardSection = document.getElementById('dashboard')

const backupDirDisplay = document.getElementById('backup-dir-display')
const pickFolderBtn = document.getElementById('pick-folder-btn')
const setupPasswordInput = document.getElementById('setup-password')
const setupPasswordConfirmInput = document.getElementById('setup-password-confirm')
const completeSetupBtn = document.getElementById('complete-setup-btn')
const setupError = document.getElementById('setup-error')

const lockPasswordInput = document.getElementById('lock-password')
const unlockBtn = document.getElementById('unlock-btn')
const lockError = document.getElementById('lock-error')

const statusDot = document.getElementById('status-dot')
const statusText = document.getElementById('status-text')
const lastBackupEl = document.getElementById('last-backup')
const backupDirShownEl = document.getElementById('backup-dir-shown')
const toggleServerBtn = document.getElementById('toggle-server-btn')
const deviceCountEl = document.getElementById('device-count')
const devicesListEl = document.getElementById('devices-list')

let chosenBackupDir = null
let currentStatus = 'stopped'
let devicePollTimer = null

function hideAll() {
  setupSection.classList.add('hidden')
  lockSection.classList.add('hidden')
  dashboardSection.classList.add('hidden')
}

function showSetup() {
  hideAll()
  setupSection.classList.remove('hidden')
}

function showLock() {
  hideAll()
  lockSection.classList.remove('hidden')
  lockPasswordInput.value = ''
  lockPasswordInput.focus()
}

function showDashboard() {
  hideAll()
  dashboardSection.classList.remove('hidden')
}

function renderStatus({ status, error }) {
  currentStatus = status
  const labels = { stopped: 'Offline', starting: 'Starting…', online: 'Online', error: 'Error' }
  statusText.textContent = labels[status] ?? status
  statusDot.className = 'dot ' + status
  toggleServerBtn.textContent = status === 'online' || status === 'starting' ? 'Stop Server' : 'Start Server'
  toggleServerBtn.disabled = status === 'starting'
  if (status === 'error' && error) statusText.textContent += ` (${error})`
}

function renderDevices(devices) {
  deviceCountEl.textContent = devices.length
  if (devices.length === 0) {
    devicesListEl.innerHTML = '<p class="hint">No devices connected right now.</p>'
    return
  }
  devicesListEl.innerHTML = ''
  for (const device of devices) {
    const row = document.createElement('div')
    row.className = 'device-row'
    const since = new Date(device.connectedAt).toLocaleTimeString()
    row.innerHTML = `
      <div class="device-info">
        <span class="device-name">${escapeHtml(device.name)} <span class="device-role">(${escapeHtml(device.role)})</span></span>
        <span class="device-meta">${escapeHtml(device.ip)} · since ${since}</span>
      </div>
      <button class="secondary device-disconnect" data-socket-id="${escapeHtml(device.socketId)}">Disconnect</button>
    `
    devicesListEl.appendChild(row)
  }
  for (const btn of devicesListEl.querySelectorAll('.device-disconnect')) {
    btn.addEventListener('click', async () => {
      btn.disabled = true
      btn.textContent = 'Disconnecting…'
      await window.controlPanel.disconnectDevice(btn.dataset.socketId)
      await refreshDevices()
    })
  }
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str ?? ''
  return div.innerHTML
}

async function refreshStatus() {
  const data = await window.controlPanel.getStatus()
  renderStatus(data)
  backupDirShownEl.textContent = data.backupDir ?? '—'
  lastBackupEl.textContent = data.health?.lastBackupAt ? new Date(data.health.lastBackupAt).toLocaleString() : 'None yet'
}

async function refreshDevices() {
  const devices = await window.controlPanel.getDevices()
  renderDevices(Array.isArray(devices) ? devices : [])
}

function startPolling() {
  refreshStatus()
  refreshDevices()
  clearInterval(devicePollTimer)
  devicePollTimer = setInterval(() => {
    refreshStatus()
    refreshDevices()
  }, 5_000)
}

pickFolderBtn.addEventListener('click', async () => {
  const dir = await window.controlPanel.pickBackupFolder()
  if (dir) {
    chosenBackupDir = dir
    backupDirDisplay.value = dir
    updateCompleteSetupEnabled()
  }
})

function updateCompleteSetupEnabled() {
  const passwordsFilled = setupPasswordInput.value.length >= 4 && setupPasswordConfirmInput.value.length >= 4
  completeSetupBtn.disabled = !(chosenBackupDir && passwordsFilled)
}
setupPasswordInput.addEventListener('input', updateCompleteSetupEnabled)
setupPasswordConfirmInput.addEventListener('input', updateCompleteSetupEnabled)

completeSetupBtn.addEventListener('click', async () => {
  if (setupPasswordInput.value !== setupPasswordConfirmInput.value) {
    setupError.textContent = 'Passwords do not match.'
    setupError.classList.remove('hidden')
    return
  }
  completeSetupBtn.disabled = true
  completeSetupBtn.textContent = 'Setting up…'
  const result = await window.controlPanel.runSetup({
    backupDir: chosenBackupDir,
    panelPassword: setupPasswordInput.value,
  })
  if (result.ok) {
    setupError.classList.add('hidden')
    showDashboard()
    startPolling()
  } else {
    setupError.textContent = result.error
    setupError.classList.remove('hidden')
    completeSetupBtn.disabled = false
    completeSetupBtn.textContent = 'Complete Setup'
  }
})

unlockBtn.addEventListener('click', async () => {
  unlockBtn.disabled = true
  const { ok } = await window.controlPanel.unlockPanel(lockPasswordInput.value)
  unlockBtn.disabled = false
  if (ok) {
    lockError.classList.add('hidden')
    showDashboard()
    startPolling()
  } else {
    lockError.textContent = 'Wrong password.'
    lockError.classList.remove('hidden')
  }
})
lockPasswordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') unlockBtn.click()
})

toggleServerBtn.addEventListener('click', async () => {
  toggleServerBtn.disabled = true
  if (currentStatus === 'online') {
    await window.controlPanel.stopServer()
  } else {
    await window.controlPanel.startServer()
  }
  await refreshStatus()
})

window.controlPanel.onStatusChanged((data) => {
  renderStatus(data)
  if (!dashboardSection.classList.contains('hidden')) refreshStatus()
})

;(async () => {
  const { setupComplete } = await window.controlPanel.getSetupStatus()
  if (!setupComplete) {
    showSetup()
    return
  }
  showLock()
})()
