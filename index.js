/**
 * Commute Optimizer App
 * Uses Google Directions API to find optimal departure times
 */

// ========================================
// Configuration & State
// ========================================
const CONFIG = {
    STORAGE_KEYS: {
        API_KEY: 'commute_api_key',
        HOME_ADDRESS: 'commute_home',
        WORK_ADDRESS: 'commute_work',
        MORNING_START: 'commute_morning_start',
        MORNING_END: 'commute_morning_end',
        EVENING_START: 'commute_evening_start',
        EVENING_END: 'commute_evening_end',
        TRAFFIC_MODEL: 'commute_traffic_model'
    },
    DEFAULTS: {
        MORNING_START: '06:00',
        MORNING_END: '10:00',
        EVENING_START: '16:00',
        EVENING_END: '20:00',
        INTERVAL_MINUTES: 15
    },
    TRAFFIC_THRESHOLDS: {
        LOW: 1.2,      // Under 20% above baseline = low traffic
        MEDIUM: 1.4    // Under 40% above baseline = medium traffic
    }
};

const state = {
    apiKey: '',
    homeAddress: '',
    workAddress: '',
    selectedDate: null,
    selectedDirection: 'morning',
    isAnalyzing: false,
    analysisResults: null,
    directionsService: null,
    trafficModel: 'best_guess',
    timeSettings: {
        morningStart: CONFIG.DEFAULTS.MORNING_START,
        morningEnd: CONFIG.DEFAULTS.MORNING_END,
        eveningStart: CONFIG.DEFAULTS.EVENING_START,
        eveningEnd: CONFIG.DEFAULTS.EVENING_END
    }
};

// ========================================
// DOM Elements
// ========================================
const elements = {
    // Screens
    setupScreen: document.getElementById('setup-screen'),
    mainScreen: document.getElementById('main-screen'),

    // Setup Form
    setupForm: document.getElementById('setup-form'),
    apiKeyInput: document.getElementById('api-key'),
    homeAddressInput: document.getElementById('home-address'),
    workAddressInput: document.getElementById('work-address'),

    // Main Dashboard
    dayPicker: document.getElementById('day-picker'),
    tabs: document.querySelectorAll('.tab'),
    analyzeBtn: document.getElementById('analyze-btn'),
    btnText: document.querySelector('.btn-text'),
    btnLoader: document.querySelector('.btn-loader'),

    // Results
    bestTime: document.getElementById('best-time'),
    duration: document.getElementById('duration'),
    savings: document.getElementById('savings'),
    chartContainer: document.getElementById('chart-container'),
    homeDisplay: document.getElementById('home-display'),
    workDisplay: document.getElementById('work-display'),

    // Settings Modal
    settingsBtn: document.getElementById('settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    closeSettings: document.getElementById('close-settings'),
    settingsForm: document.getElementById('settings-form'),
    settingsApiKey: document.getElementById('settings-api-key'),
    settingsHome: document.getElementById('settings-home'),
    settingsWork: document.getElementById('settings-work'),
    morningStart: document.getElementById('morning-start'),
    morningEnd: document.getElementById('morning-end'),
    eveningStart: document.getElementById('evening-start'),
    eveningEnd: document.getElementById('evening-end'),
    trafficModel: document.getElementById('traffic-model'),
    clearDataBtn: document.getElementById('clear-data-btn'),

    // Toast
    toastContainer: document.getElementById('toast-container')
};

// ========================================
// Initialization
// ========================================
function init() {
    loadSettings();
    setupEventListeners();

    if (isConfigured()) {
        loadGoogleMapsAPI().then(() => {
            showMainScreen();
            generateDayPicker();
            updateRouteDisplay();
        }).catch(err => {
            console.error('Failed to load Google Maps API:', err);
            showToast('Failed to load Google Maps. Check your API key.', 'error');
        });
    } else {
        showSetupScreen();
    }
}

function loadGoogleMapsAPI() {
    return new Promise((resolve, reject) => {
        if (window.google && window.google.maps) {
            state.directionsService = new google.maps.DirectionsService();
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${state.apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
            state.directionsService = new google.maps.DirectionsService();
            resolve();
        };

        script.onerror = () => reject(new Error('Failed to load Google Maps API'));

        document.head.appendChild(script);
    });
}

function loadSettings() {
    state.apiKey = localStorage.getItem(CONFIG.STORAGE_KEYS.API_KEY) || '';
    state.homeAddress = localStorage.getItem(CONFIG.STORAGE_KEYS.HOME_ADDRESS) || '';
    state.workAddress = localStorage.getItem(CONFIG.STORAGE_KEYS.WORK_ADDRESS) || '';
    state.trafficModel = localStorage.getItem(CONFIG.STORAGE_KEYS.TRAFFIC_MODEL) || 'best_guess';
    state.timeSettings.morningStart = localStorage.getItem(CONFIG.STORAGE_KEYS.MORNING_START) || CONFIG.DEFAULTS.MORNING_START;
    state.timeSettings.morningEnd = localStorage.getItem(CONFIG.STORAGE_KEYS.MORNING_END) || CONFIG.DEFAULTS.MORNING_END;
    state.timeSettings.eveningStart = localStorage.getItem(CONFIG.STORAGE_KEYS.EVENING_START) || CONFIG.DEFAULTS.EVENING_START;
    state.timeSettings.eveningEnd = localStorage.getItem(CONFIG.STORAGE_KEYS.EVENING_END) || CONFIG.DEFAULTS.EVENING_END;
}

function saveSettings() {
    localStorage.setItem(CONFIG.STORAGE_KEYS.API_KEY, state.apiKey);
    localStorage.setItem(CONFIG.STORAGE_KEYS.HOME_ADDRESS, state.homeAddress);
    localStorage.setItem(CONFIG.STORAGE_KEYS.WORK_ADDRESS, state.workAddress);
    localStorage.setItem(CONFIG.STORAGE_KEYS.TRAFFIC_MODEL, state.trafficModel);
    localStorage.setItem(CONFIG.STORAGE_KEYS.MORNING_START, state.timeSettings.morningStart);
    localStorage.setItem(CONFIG.STORAGE_KEYS.MORNING_END, state.timeSettings.morningEnd);
    localStorage.setItem(CONFIG.STORAGE_KEYS.EVENING_START, state.timeSettings.eveningStart);
    localStorage.setItem(CONFIG.STORAGE_KEYS.EVENING_END, state.timeSettings.eveningEnd);
}

function getTrafficModel() {
    const modelMap = {
        'optimistic': google.maps.TrafficModel.OPTIMISTIC,
        'best_guess': google.maps.TrafficModel.BEST_GUESS,
        'pessimistic': google.maps.TrafficModel.PESSIMISTIC
    };
    return modelMap[state.trafficModel] || google.maps.TrafficModel.BEST_GUESS;
}

function isConfigured() {
    return state.apiKey && state.homeAddress && state.workAddress;
}

function setupEventListeners() {
    // Setup Form
    elements.setupForm.addEventListener('submit', handleSetupSubmit);

    // Tabs
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => handleTabChange(tab.dataset.direction));
    });

    // Analyze Button
    elements.analyzeBtn.addEventListener('click', handleAnalyze);

    // Settings Modal
    elements.settingsBtn.addEventListener('click', openSettingsModal);
    elements.closeSettings.addEventListener('click', closeSettingsModal);
    elements.settingsModal.querySelector('.modal-backdrop').addEventListener('click', closeSettingsModal);
    elements.settingsForm.addEventListener('submit', handleSettingsSave);
    elements.clearDataBtn.addEventListener('click', handleClearData);
}

// ========================================
// Screen Management
// ========================================
function showSetupScreen() {
    elements.setupScreen.classList.remove('hidden');
    elements.mainScreen.classList.add('hidden');
}

function showMainScreen() {
    elements.setupScreen.classList.add('hidden');
    elements.mainScreen.classList.remove('hidden');
}

// ========================================
// Setup Form Handler
// ========================================
function handleSetupSubmit(e) {
    e.preventDefault();

    state.apiKey = elements.apiKeyInput.value.trim();
    state.homeAddress = elements.homeAddressInput.value.trim();
    state.workAddress = elements.workAddressInput.value.trim();

    if (!state.apiKey || !state.homeAddress || !state.workAddress) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    saveSettings();

    // Load Google Maps API then show main screen
    loadGoogleMapsAPI().then(() => {
        showMainScreen();
        generateDayPicker();
        updateRouteDisplay();
        showToast('Setup complete! Select a day to analyze your commute.', 'success');
    }).catch(err => {
        console.error('Failed to load Google Maps API:', err);
        showToast('Failed to load Google Maps. Please check your API key.', 'error');
    });
}

// ========================================
// Day Picker
// ========================================
function generateDayPicker() {
    const days = getNext7Days();
    elements.dayPicker.innerHTML = '';

    days.forEach((day, index) => {
        const chip = document.createElement('button');
        chip.className = 'day-chip' + (index === 0 ? ' active' : '');
        chip.innerHTML = `
            <span class="day-name">${day.dayName}</span>
            <span class="day-date">${day.date}</span>
            <span class="day-month">${day.month}</span>
        `;
        chip.addEventListener('click', () => selectDay(chip, day.fullDate));
        elements.dayPicker.appendChild(chip);

        if (index === 0) {
            state.selectedDate = day.fullDate;
        }
    });
}

function getNext7Days() {
    const days = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);

        days.push({
            dayName: dayNames[date.getDay()],
            date: date.getDate(),
            month: monthNames[date.getMonth()],
            fullDate: date
        });
    }

    return days;
}

function selectDay(chip, date) {
    document.querySelectorAll('.day-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.selectedDate = date;

    // Clear previous results when day changes
    resetResults();
}

// ========================================
// Tab Management
// ========================================
function handleTabChange(direction) {
    state.selectedDirection = direction;

    elements.tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.direction === direction);
    });

    // Re-render results if we have them for this direction
    if (state.analysisResults && state.analysisResults[direction]) {
        renderResults(state.analysisResults[direction]);
    } else {
        resetResults();
    }
}

// ========================================
// Analysis
// ========================================
async function handleAnalyze() {
    if (state.isAnalyzing) return;

    if (!state.selectedDate) {
        showToast('Please select a day first', 'warning');
        return;
    }

    // Check if selected date is in the past
    const now = new Date();
    const selectedDateEnd = new Date(state.selectedDate);
    selectedDateEnd.setHours(23, 59, 59, 999);

    if (selectedDateEnd < now) {
        showToast('Cannot analyze past dates. Google Directions API only predicts future traffic.', 'warning');
        return;
    }

    setAnalyzing(true);

    try {
        // Analyze both directions
        const morningResults = await analyzeTimeRange('morning');
        const eveningResults = await analyzeTimeRange('evening');

        state.analysisResults = {
            morning: morningResults,
            evening: eveningResults
        };

        renderResults(state.analysisResults[state.selectedDirection]);
        showToast('Analysis complete!', 'success');
    } catch (error) {
        console.error('Analysis error:', error);
        showToast(error.message || 'Failed to analyze commute', 'error');
    } finally {
        setAnalyzing(false);
    }
}

async function analyzeTimeRange(direction) {
    const isMorning = direction === 'morning';
    const start = isMorning ? state.timeSettings.morningStart : state.timeSettings.eveningStart;
    const end = isMorning ? state.timeSettings.morningEnd : state.timeSettings.eveningEnd;
    const origin = isMorning ? state.homeAddress : state.workAddress;
    const destination = isMorning ? state.workAddress : state.homeAddress;

    const times = generateTimeSlots(start, end, CONFIG.DEFAULTS.INTERVAL_MINUTES);
    const now = new Date();

    // Pre-check: filter to only future time slots
    const futureTimes = times.filter(time => {
        const departureTime = combineDateAndTime(state.selectedDate, time);
        return departureTime > now;
    });

    // If no future times, provide a helpful message
    if (futureTimes.length === 0) {
        const periodName = isMorning ? 'morning' : 'evening';
        const timeRange = `${formatTime(start)} - ${formatTime(end)}`;
        throw new Error(`All ${periodName} times (${timeRange}) have passed for today. Try selecting tomorrow or a future date.`);
    }

    const isCompareAll = state.trafficModel === 'compare_all';
    const trafficModels = isCompareAll
        ? [
            { key: 'optimistic', model: google.maps.TrafficModel.OPTIMISTIC },
            { key: 'best_guess', model: google.maps.TrafficModel.BEST_GUESS },
            { key: 'pessimistic', model: google.maps.TrafficModel.PESSIMISTIC }
        ]
        : [{ key: 'single', model: null }]; // null = use default

    const results = [];
    let lastError = null;

    // Process only future time slots
    for (const time of futureTimes) {
        const departureTime = combineDateAndTime(state.selectedDate, time);
        const resultEntry = {
            time: time,
            departureTime: departureTime
        };

        for (const { key, model } of trafficModels) {
            try {
                const duration = await fetchTravelTime(origin, destination, departureTime, model);
                if (isCompareAll) {
                    resultEntry[key] = {
                        duration: duration,
                        durationMinutes: Math.round(duration / 60)
                    };
                } else {
                    resultEntry.duration = duration;
                    resultEntry.durationMinutes = Math.round(duration / 60);
                }
            } catch (error) {
                console.warn(`Failed to fetch time for ${time} (${key}):`, error);
                lastError = error;
                if (isCompareAll) {
                    resultEntry[key] = null;
                }
            }

            // Delay between requests to avoid rate limiting
            await sleep(300);
        }

        // Only add if we got at least some data
        if (isCompareAll) {
            if (resultEntry.optimistic || resultEntry.best_guess || resultEntry.pessimistic) {
                results.push(resultEntry);
            }
        } else if (resultEntry.duration) {
            results.push(resultEntry);
        }
    }

    if (results.length === 0) {
        if (lastError) {
            throw lastError;
        }
        throw new Error('Failed to fetch travel times. Please check your API key and addresses.');
    }

    // Calculate stats based on mode
    if (isCompareAll) {
        // Use best_guess for optimal time calculation
        const validResults = results.filter(r => r.best_guess);
        const minDuration = Math.min(...validResults.map(r => r.best_guess.duration));
        const maxDuration = Math.max(...results.map(r =>
            Math.max(
                r.optimistic?.duration || 0,
                r.best_guess?.duration || 0,
                r.pessimistic?.duration || 0
            )
        ));
        const globalMin = Math.min(...results.map(r =>
            Math.min(
                r.optimistic?.duration || Infinity,
                r.best_guess?.duration || Infinity,
                r.pessimistic?.duration || Infinity
            )
        ));

        // Find optimal time based on best_guess
        const optimal = validResults.reduce((best, current) =>
            current.best_guess.duration < best.best_guess.duration ? current : best
        );
        optimal.isOptimal = true;

        const savingsSeconds = maxDuration - optimal.best_guess.duration;

        return {
            times: results,
            optimal: optimal,
            savingsMinutes: Math.round(savingsSeconds / 60),
            minDuration: globalMin,
            maxDuration: maxDuration,
            isCompareAll: true
        };
    } else {
        // Single model mode (original logic)
        const minDuration = Math.min(...results.map(r => r.duration));
        const maxDuration = Math.max(...results.map(r => r.duration));

        results.forEach(result => {
            const ratio = result.duration / minDuration;
            if (ratio < CONFIG.TRAFFIC_THRESHOLDS.LOW) {
                result.trafficLevel = 'low';
            } else if (ratio < CONFIG.TRAFFIC_THRESHOLDS.MEDIUM) {
                result.trafficLevel = 'medium';
            } else {
                result.trafficLevel = 'high';
            }
        });

        const optimal = results.reduce((best, current) =>
            current.duration < best.duration ? current : best
        );
        optimal.isOptimal = true;

        const savingsSeconds = maxDuration - optimal.duration;

        return {
            times: results,
            optimal: optimal,
            savingsMinutes: Math.round(savingsSeconds / 60),
            minDuration: minDuration,
            maxDuration: maxDuration,
            isCompareAll: false
        };
    }
}

function generateTimeSlots(start, end, intervalMinutes) {
    const slots = [];
    const [startHours, startMinutes] = start.split(':').map(Number);
    const [endHours, endMinutes] = end.split(':').map(Number);

    let currentMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;

    while (currentMinutes <= endTotalMinutes) {
        const hours = Math.floor(currentMinutes / 60);
        const mins = currentMinutes % 60;
        slots.push(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
        currentMinutes += intervalMinutes;
    }

    return slots;
}

function combineDateAndTime(date, timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
}

// ========================================
// Google Directions API (using Maps JavaScript API)
// ========================================
async function fetchTravelTime(origin, destination, departureTime, trafficModel = null) {
    // Wrap in a timeout to prevent indefinite hangs
    const timeoutMs = 15000; // 15 seconds

    const directionsPromise = new Promise((resolve, reject) => {
        if (!state.directionsService) {
            reject(new Error('Google Maps not loaded'));
            return;
        }

        // Use provided trafficModel or fall back to state/default
        const model = trafficModel || getTrafficModel();

        const request = {
            origin: origin,
            destination: destination,
            travelMode: google.maps.TravelMode.DRIVING,
            drivingOptions: {
                departureTime: departureTime,
                trafficModel: model
            }
        };

        state.directionsService.route(request, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
                const leg = result.routes[0].legs[0];
                // Use duration_in_traffic if available, otherwise duration
                const duration = leg.duration_in_traffic?.value || leg.duration.value;
                resolve(duration);
            } else if (status === google.maps.DirectionsStatus.ZERO_RESULTS) {
                reject(new Error('No route found between locations'));
            } else if (status === google.maps.DirectionsStatus.REQUEST_DENIED) {
                reject(new Error('API key invalid or Directions API not enabled'));
            } else {
                reject(new Error(`Directions request failed: ${status}`));
            }
        });
    });

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error('Request timed out. Please enable "Maps JavaScript API" in Google Cloud Console.'));
        }, timeoutMs);
    });

    return Promise.race([directionsPromise, timeoutPromise]);
}

// ========================================
// Results Rendering
// ========================================
function renderResults(results) {
    if (!results || !results.times || results.times.length === 0) {
        resetResults();
        return;
    }

    // Update recommendation card
    const optimal = results.optimal;
    elements.bestTime.textContent = formatTime(optimal.time);

    // Handle both single model and compare_all modes
    const durationMinutes = results.isCompareAll
        ? optimal.best_guess?.durationMinutes
        : optimal.durationMinutes;

    elements.duration.textContent = `${durationMinutes} min`;
    elements.savings.textContent = results.savingsMinutes > 0
        ? `Save ${results.savingsMinutes} min`
        : 'Optimal time';

    // Render chart
    renderChart(results);
}

function renderChart(results) {
    const times = results.times;
    const isCompareAll = results.isCompareAll;

    // Calculate relative scale (don't start from zero)
    const minDuration = results.minDuration;
    const maxDuration = results.maxDuration;
    const range = maxDuration - minDuration;

    // Add 10% padding below minimum to show relative differences
    const displayMin = Math.max(0, minDuration - range * 0.1);
    const displayRange = maxDuration - displayMin;

    let chartHTML = '<div class="chart-bars">';

    if (isCompareAll) {
        // Stacked/grouped bar chart for all 3 models
        times.forEach(result => {
            const optimalClass = result.isOptimal ? ' optimal-group' : '';

            // Calculate heights relative to display range
            const optHeight = result.optimistic
                ? ((result.optimistic.duration - displayMin) / displayRange) * 100
                : 0;
            const avgHeight = result.best_guess
                ? ((result.best_guess.duration - displayMin) / displayRange) * 100
                : 0;
            const pessHeight = result.pessimistic
                ? ((result.pessimistic.duration - displayMin) / displayRange) * 100
                : 0;

            const optMin = result.optimistic?.durationMinutes || '--';
            const avgMin = result.best_guess?.durationMinutes || '--';
            const pessMin = result.pessimistic?.durationMinutes || '--';

            chartHTML += `
                <div class="chart-bar-wrapper stacked${optimalClass}">
                    <div class="stacked-bars">
                        <div class="chart-bar bar-pessimistic" 
                             style="height: ${pessHeight}%"
                             title="${formatTime(result.time)}: ${pessMin} min (worst)">
                        </div>
                        <div class="chart-bar bar-average" 
                             style="height: ${avgHeight}%"
                             title="${formatTime(result.time)}: ${avgMin} min (avg)">
                        </div>
                        <div class="chart-bar bar-optimistic" 
                             style="height: ${optHeight}%"
                             title="${formatTime(result.time)}: ${optMin} min (best)">
                        </div>
                    </div>
                    <span class="bar-tooltip stacked-tooltip">
                        <strong>${formatTime(result.time)}</strong><br>
                        🟢 Best: ${optMin} min<br>
                        🟡 Avg: ${avgMin} min<br>
                        🔴 Worst: ${pessMin} min
                    </span>
                    <span class="chart-time">${formatTimeShort(result.time)}</span>
                </div>
            `;
        });

        chartHTML += '</div>';

        // Add legend for stacked bars
        chartHTML += `
            <div class="chart-legend">
                <div class="legend-item">
                    <div class="legend-color optimistic"></div>
                    <span>Best Case</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color average"></div>
                    <span>Average</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color pessimistic"></div>
                    <span>Worst Case</span>
                </div>
            </div>
        `;

        // Add Y-axis labels
        const minLabel = Math.round(displayMin / 60);
        const maxLabel = Math.round(maxDuration / 60);
        chartHTML += `
            <div class="chart-axis-labels">
                <span class="axis-label max">${maxLabel} min</span>
                <span class="axis-label min">${minLabel} min</span>
            </div>
        `;
    } else {
        // Original single-bar chart with relative scaling
        times.forEach(result => {
            const heightPercent = ((result.duration - displayMin) / displayRange) * 100;
            const optimalClass = result.isOptimal ? ' optimal' : '';

            chartHTML += `
                <div class="chart-bar-wrapper">
                    <div class="chart-bar traffic-${result.trafficLevel}${optimalClass}" 
                         style="height: ${heightPercent}%"
                         data-time="${formatTime(result.time)}"
                         data-duration="${result.durationMinutes} min">
                        <span class="bar-tooltip">${formatTime(result.time)}<br>${result.durationMinutes} min</span>
                    </div>
                    <span class="chart-time">${formatTimeShort(result.time)}</span>
                </div>
            `;
        });

        chartHTML += '</div>';

        // Add legend
        chartHTML += `
            <div class="chart-legend">
                <div class="legend-item">
                    <div class="legend-color low"></div>
                    <span>Light</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color medium"></div>
                    <span>Moderate</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color high"></div>
                    <span>Heavy</span>
                </div>
            </div>
        `;

        // Add Y-axis labels for single mode too
        const minLabel = Math.round(displayMin / 60);
        const maxLabel = Math.round(maxDuration / 60);
        chartHTML += `
            <div class="chart-axis-labels">
                <span class="axis-label max">${maxLabel} min</span>
                <span class="axis-label min">${minLabel} min</span>
            </div>
        `;
    }

    elements.chartContainer.innerHTML = chartHTML;
}

function resetResults() {
    elements.bestTime.textContent = '--:--';
    elements.duration.textContent = '-- min';
    elements.savings.textContent = 'Save -- min';
    elements.chartContainer.innerHTML = `
        <div class="chart-placeholder">
            <p>Select a day and tap "Analyze" to see travel times</p>
        </div>
    `;
}

function updateRouteDisplay() {
    const homeShort = shortenAddress(state.homeAddress);
    const workShort = shortenAddress(state.workAddress);
    elements.homeDisplay.textContent = homeShort;
    elements.workDisplay.textContent = workShort;
}

// ========================================
// Settings Modal
// ========================================
function openSettingsModal() {
    elements.settingsApiKey.value = state.apiKey;
    elements.settingsHome.value = state.homeAddress;
    elements.settingsWork.value = state.workAddress;
    elements.morningStart.value = state.timeSettings.morningStart;
    elements.morningEnd.value = state.timeSettings.morningEnd;
    elements.eveningStart.value = state.timeSettings.eveningStart;
    elements.eveningEnd.value = state.timeSettings.eveningEnd;
    elements.trafficModel.value = state.trafficModel;
    elements.settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
    elements.settingsModal.classList.add('hidden');
}

function handleSettingsSave(e) {
    e.preventDefault();

    state.apiKey = elements.settingsApiKey.value.trim();
    state.homeAddress = elements.settingsHome.value.trim();
    state.workAddress = elements.settingsWork.value.trim();
    state.trafficModel = elements.trafficModel.value;
    state.timeSettings.morningStart = elements.morningStart.value;
    state.timeSettings.morningEnd = elements.morningEnd.value;
    state.timeSettings.eveningStart = elements.eveningStart.value;
    state.timeSettings.eveningEnd = elements.eveningEnd.value;

    saveSettings();
    updateRouteDisplay();
    closeSettingsModal();
    showToast('Settings saved!', 'success');

    // Clear results since settings changed
    state.analysisResults = null;
    resetResults();
}

function handleClearData() {
    if (confirm('Are you sure you want to clear all saved data? This cannot be undone.')) {
        localStorage.clear();
        state.apiKey = '';
        state.homeAddress = '';
        state.workAddress = '';
        state.analysisResults = null;

        closeSettingsModal();
        showSetupScreen();
        showToast('All data cleared', 'success');
    }
}

// ========================================
// UI Helpers
// ========================================
function setAnalyzing(isAnalyzing) {
    state.isAnalyzing = isAnalyzing;
    elements.analyzeBtn.disabled = isAnalyzing;
    elements.btnText.classList.toggle('hidden', isAnalyzing);
    elements.btnLoader.classList.toggle('hidden', !isAnalyzing);
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-message">${message}</span>`;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========================================
// Utility Functions
// ========================================
function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function formatTimeShort(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'p' : 'a';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')}`;
}

function shortenAddress(address) {
    if (!address) return '';
    // Take first part before comma or first 20 chars
    const parts = address.split(',');
    const short = parts[0].trim();
    return short.length > 20 ? short.substring(0, 20) + '...' : short;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// Start the app
// ========================================
document.addEventListener('DOMContentLoaded', init);
