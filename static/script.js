// DOM Elements
const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('open-sidebar');
const closeSidebarBtn = document.getElementById('close-sidebar');
const navLinks = document.querySelectorAll('.sidebar-nav a');

// Modal Elements
const createEventBtn = document.getElementById('create-event-btn');
const addEventModal = document.getElementById('add-event-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelBtn = document.getElementById('cancel-btn');
const addEventForm = document.getElementById('add-event-form');
const eventsTableBody = document.getElementById('events-table-body');
const modalTitle = document.querySelector('.modal-header h2');
const submitBtn = document.querySelector('.form-actions button[type="submit"]');
const totalEventsCount = document.getElementById('total-events-count');
const upcomingEventsCount = document.getElementById('upcoming-events-count');
const searchInput = document.getElementById('search-input');

// View Elements
const mainView = document.getElementById('main-view');
const eventsView = document.getElementById('events-view');
const studentsView = document.getElementById('students-view');
const reportsView = document.getElementById('reports-view');
const settingsView = document.getElementById('settings-view');
const studentsEventsGrid = document.getElementById('students-events-grid');

// Student Modal Elements
const manageStudentsModal = document.getElementById('manage-students-modal');
const closeStudentsModalBtn = document.getElementById('close-students-modal-btn');
const addStudentForm = document.getElementById('add-student-form');
const studentsTableBody = document.getElementById('students-table-body');
const studentEventIdInput = document.getElementById('student-event-id');
const studentsModalTitle = document.getElementById('students-modal-title');

// Event Data Array
let events = [];

// Toggle Sidebar
if (openSidebarBtn) {
    openSidebarBtn.addEventListener('click', () => {
        sidebar.classList.add('active');
    });
}

if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener('click', () => {
        sidebar.classList.remove('active');
    });
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 1024) {
        if (sidebar && !sidebar.contains(e.target) && !openSidebarBtn.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    }
});

// Active Link Handling
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        // Remove active class from all parent lis
        navLinks.forEach(l => l.parentElement.classList.remove('active'));
        // Add active class to clicked link's parent li
        e.currentTarget.parentElement.classList.add('active');

        const page = e.currentTarget.getAttribute('data-page');
        if (page === 'events') {
            mainView.style.display = 'none';
            if (eventsView) eventsView.style.display = 'block';
            if (studentsView) studentsView.style.display = 'none';
            if (reportsView) reportsView.style.display = 'none';
            if (settingsView) settingsView.style.display = 'none';
        } else if (page === 'students') {
            mainView.style.display = 'none';
            if (eventsView) eventsView.style.display = 'none';
            if (reportsView) reportsView.style.display = 'none';
            if (settingsView) settingsView.style.display = 'none';
            if (studentsView) {
                studentsView.style.display = 'block';
                renderStudentsEventsGrid(); // render events for tracking
            }
        } else if (page === 'reports') {
            mainView.style.display = 'none';
            if (eventsView) eventsView.style.display = 'none';
            if (studentsView) studentsView.style.display = 'none';
            if (settingsView) settingsView.style.display = 'none';
            if (reportsView) {
                reportsView.style.display = 'block';
                fetchAndRenderReports();
            }
        } else if (page === 'settings') {
            mainView.style.display = 'none';
            if (eventsView) eventsView.style.display = 'none';
            if (studentsView) studentsView.style.display = 'none';
            if (reportsView) reportsView.style.display = 'none';
            if (settingsView) settingsView.style.display = 'block';
        }

        // Mobile: close sidebar after click
        if (window.innerWidth <= 1024) {
            sidebar.classList.remove('active');
        }
    });
});

// Fetch events from the server
async function fetchEvents() {
    try {
        const response = await fetch('/api/events');
        if (response.ok) {
            events = await response.json();
            renderEvents();
            updateDashboardMetrics();
        }
    } catch (err) {
        console.error("Failed to load events", err);
    }
}

// Helper to get Icon and Colors based on Category
function getCategoryStyles(category) {
    switch (category) {
        case 'Technology':
            return { icon: 'fa-code', color: '#0284c7', bg: '#e0f2fe' };
        case 'Cultural':
            return { icon: 'fa-music', color: '#d97706', bg: '#fef3c7' };
        case 'Social':
            return { icon: 'fa-leaf', color: '#16a34a', bg: '#dcfce7' };
        case 'Sports':
            return { icon: 'fa-basketball', color: '#dc2626', bg: '#fee2e2' };
        default:
            return { icon: 'fa-calendar-day', color: '#4f46e5', bg: '#e0e7ff' };
    }
}

// Update Dashboard Metrics
function updateDashboardMetrics() {
    if (totalEventsCount) {
        totalEventsCount.textContent = events.length;
    }
    if (upcomingEventsCount) {
        const upcomingCount = events.filter(event => event.status === 'Upcoming').length;
        upcomingEventsCount.textContent = upcomingCount;
    }
}

// Render Events Table
function renderEvents(limit = 5, data = events) { // Default limit to 5
    if (!eventsTableBody) return;
    eventsTableBody.innerHTML = '';

    // Determine which events to show based on limit
    const eventsToShow = limit === 'all' ? data : data.slice(0, limit);

    if (eventsToShow.length === 0) {
        eventsTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">No events found</td></tr>';
        return;
    }

    eventsToShow.forEach((event) => {
        const styles = getCategoryStyles(event.category);
        const statusClass = `status-${event.status.toLowerCase()}`;

        const dateObj = new Date(event.date);
        const options = { year: 'numeric', month: 'short', day: '2-digit' };
        const formattedDate = dateObj.toLocaleDateString('en-US', options);

        const imgHtml = event.image_path
            ? `<img src="/static/uploads/${event.image_path}" style="width:100%; height:100%; object-fit:cover;">`
            : `<i class="fa-solid ${styles.icon}" style="color: ${styles.color};"></i>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="event-cell">
                    <div class="event-img" style="background-color: ${styles.bg}; overflow: hidden;">
                        ${imgHtml}
                    </div>
                    <div>
                        <div class="event-name">${event.name}</div>
                        <div class="event-cat">${event.category}</div>
                    </div>
                </div>
            </td>
            <td>${event.organizer}</td>
            <td>${formattedDate}</td>
            <td><span class="status-badge ${statusClass}">${event.status}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="icon-btn edit" onclick="editEvent(${event.id})"><i class="fa-solid fa-pen"></i></button>
                    <button class="icon-btn delete" onclick="deleteEvent(${event.id})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        eventsTableBody.appendChild(tr);
    });
}

// Global View All Handler
const viewAllLink = document.querySelector('.view-all');
if (viewAllLink) {
    viewAllLink.addEventListener('click', (e) => {
        e.preventDefault();
        renderEvents('all');
        viewAllLink.style.display = 'none';
    });
}

// Search Functionality
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        if (searchTerm === "") {
            renderEvents();
            if (viewAllLink) viewAllLink.style.display = 'inline-block';
        } else {
            const filteredEvents = events.filter(event =>
                event.name.toLowerCase().includes(searchTerm) ||
                event.category.toLowerCase().includes(searchTerm) ||
                event.organizer.toLowerCase().includes(searchTerm)
            );
            renderEvents('all', filteredEvents);
        }
    });
}

// Delete Event
window.deleteEvent = async function (id) {
    if (confirm('Are you sure you want to delete this event?')) {
        try {
            const res = await fetch('/api/events/' + id, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                fetchEvents();
            } else {
                alert("Error deleting event: " + data.error);
            }
        } catch (e) {
            console.error("Error deleting event", e);
        }
    }
};

// Edit Event Logic
window.editEvent = function (id) {
    const event = events.find(e => e.id === id);
    if (!event) return;

    // Set Hidden ID
    document.getElementById('event-id').value = event.id;

    // Populate form fields
    document.getElementById('event-name').value = event.name;
    document.getElementById('event-description').value = event.description;
    document.getElementById('event-date').value = event.date;
    document.getElementById('event-category').value = event.category;
    document.getElementById('event-organizer').value = event.organizer;
    document.getElementById('event-status').value = event.status;

    // Check if registration link field exists on this page since we added it
    const regLinkInput = document.getElementById('event-registration-link');
    if (regLinkInput) {
        regLinkInput.value = event.registration_link || '';
    }

    const responsesLinkInput = document.getElementById('event-responses-link');
    if (responsesLinkInput) {
        responsesLinkInput.value = event.sheet_link || '';
    }

    // Make image NOT required when editing (allow them to keep old one)
    document.getElementById('event-image').removeAttribute('required');

    // Change modal titles
    modalTitle.textContent = 'Edit Event';
    submitBtn.textContent = 'Update Event';

    openModal();
};

// Modal Logic
function openModal() {
    addEventModal.classList.add('active');
}

function closeModal() {
    addEventModal.classList.remove('active');
    addEventForm.reset();
}

if (createEventBtn) {
    createEventBtn.addEventListener('click', () => {
        modalTitle.textContent = 'Add New Event';
        submitBtn.textContent = 'Add Event';
        openModal();
    });
}

if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeModal);
}

if (cancelBtn) {
    cancelBtn.addEventListener('click', closeModal);
}

if (addEventModal) {
    addEventModal.addEventListener('click', (e) => {
        if (e.target === addEventModal) {
            closeModal();
        }
    });
}

// Form Submission
if (addEventForm) {
    addEventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addEventForm);

        // Determine whether creating or editing based on hidden ID
        const eventId = document.getElementById('event-id').value;
        const method = eventId ? 'PUT' : 'POST';
        const url = eventId ? `/api/events/${eventId}` : '/api/events';

        try {
            const response = await fetch(url, {
                method: method,
                body: formData
            });
            const data = await response.json();

            if (data.success) {
                fetchEvents();
                closeModal();

                // Reset form back to 'add' state
                document.getElementById('event-id').value = '';
                document.getElementById('event-image').setAttribute('required', 'required');
            } else {
                alert("Error saving event: " + data.error);
            }
        } catch (err) {
            console.error("Error submitting form", err);
            alert("Error submitting form. Please try again.");
        }
    });
}

// Initial Render
document.addEventListener('DOMContentLoaded', () => {
    fetchEvents();
});

// ================= STUDENTS VIEW LOGIC =================

// Render events as cards in the Students View
function renderStudentsEventsGrid() {
    if (!studentsEventsGrid) return;
    studentsEventsGrid.innerHTML = '';

    if (events.length === 0) {
        studentsEventsGrid.innerHTML = '<p>No events found.</p>';
        return;
    }

    events.forEach(event => {
        const styles = getCategoryStyles(event.category);
        const dateObj = new Date(event.date);
        const formattedDate = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });

        const cardHtml = `
            <div style="background: white; border-radius: 12px; border: 1px solid var(--border-color); padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); display: flex; flex-direction: column; gap: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h3 style="margin: 0; font-size: 1.2rem; color: var(--text-color);">${event.name}</h3>
                    <span style="background: ${styles.bg}; color: ${styles.color}; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">${event.category}</span>
                </div>
                <div style="color: var(--text-light); font-size: 0.9rem; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-calendar"></i> ${formattedDate}
                </div>
                <button onclick="openStudentsModal(${event.id}, '${event.name.replace(/'/g, "\\'")}')" class="btn-primary" style="margin-top: auto; width: 100%; text-align: center; border-radius: 6px;">Manage Participants</button>
            </div>
        `;
        studentsEventsGrid.innerHTML += cardHtml;
    });
}

// Open Students Modal
window.openStudentsModal = function (eventId, eventName) {
    studentEventIdInput.value = eventId;
    studentsModalTitle.textContent = `Participants: ${eventName}`;
    manageStudentsModal.classList.add('active');

    // Auto-sync first, then fetch students
    autoSyncStudents(eventId);
};

// Close Students Modal
if (closeStudentsModalBtn) {
    closeStudentsModalBtn.addEventListener('click', () => {
        manageStudentsModal.classList.remove('active');
        addStudentForm.reset();
    });
}

// Close Modal when clicking outside
if (manageStudentsModal) {
    manageStudentsModal.addEventListener('click', (e) => {
        if (e.target === manageStudentsModal) {
            manageStudentsModal.classList.remove('active');
            addStudentForm.reset();
        }
    });
}

// Fetch Students for an Event
async function fetchStudents(eventId) {
    studentsTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Loading...</td></tr>';
    try {
        const res = await fetch(`/api/events/${eventId}/students`);
        const students = await res.json();

        studentsTableBody.innerHTML = '';
        if (students.length === 0) {
            studentsTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No students added yet.</td></tr>';
            return;
        }

        students.forEach(student => {
            const isAttended = student.attended ? 'checked' : '';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${student.student_name}</strong></td>
                <td>${student.student_email}</td>
                <td style="text-align: center;">
                    <input type="checkbox" class="attendance-checkbox" data-student-id="${student.id}" style="width: 18px; height: 18px; cursor: pointer;" 
                           ${isAttended}>
                </td>
            `;
            studentsTableBody.appendChild(tr);
        });
    } catch (e) {
        console.error("Failed to fetch students", e);
        studentsTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Failed to load students.</td></tr>';
    }
}

// Auto-Sync from Google Sheets
async function autoSyncStudents(eventId) {
    const syncStatus = document.getElementById('sync-status');
    if (syncStatus) {
        syncStatus.style.display = 'block';
        syncStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Auto-syncing participants...';
        syncStatus.style.color = 'var(--primary-color)';
    }

    try {
        const res = await fetch(`/api/events/${eventId}/sync_students`, { method: 'POST' });
        const data = await res.json();

        if (!data.success && syncStatus) {
            // Display error if one occurred
            syncStatus.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${data.error}`;
            syncStatus.style.color = 'var(--danger-color)';
            // Keep error visible for 5 seconds then hide
            setTimeout(() => {
                syncStatus.style.display = 'none';
            }, 5000);
        } else if (syncStatus) {
            // Hide on success
            syncStatus.style.display = 'none';
        }
    } catch (err) {
        console.error("Auto-sync failed:", err);
        if (syncStatus) {
            syncStatus.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Sync connection failed`;
            syncStatus.style.color = 'var(--danger-color)';
            setTimeout(() => {
                syncStatus.style.display = 'none';
            }, 5000);
        }
    } finally {
        // Always fetch the students table after sync attempt
        fetchStudents(eventId);
    }
}

// Save Attendance Batch Update
const saveAttendanceBtn = document.getElementById('save-attendance-btn');
if (saveAttendanceBtn) {
    saveAttendanceBtn.addEventListener('click', async () => {
        const checkboxes = document.querySelectorAll('.attendance-checkbox');
        const updates = Array.from(checkboxes).map(cb => ({
            id: parseInt(cb.getAttribute('data-student-id')),
            attended: cb.checked
        }));

        const originalText = saveAttendanceBtn.innerHTML;
        saveAttendanceBtn.innerHTML = 'Saving...';
        saveAttendanceBtn.disabled = true;

        try {
            const res = await fetch('/api/students/batch_attendance', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates })
            });
            const data = await res.json();
            if (data.success) {
                alert("Attendance saved successfully!");
                manageStudentsModal.classList.remove('active');
            } else {
                alert("Error saving attendance: " + data.error);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to save attendance.");
        } finally {
            saveAttendanceBtn.innerHTML = originalText;
            saveAttendanceBtn.disabled = false;
        }
    });
}

// Delete Student
window.deleteStudent = async function (studentId, eventId) {
    if (confirm("Are you sure you want to remove this participant?")) {
        try {
            const res = await fetch(`/api/students/${studentId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                fetchStudents(eventId);
            }
        } catch (e) {
            console.error("Error deleting student", e);
        }
    }
};

// ================= REPORTS VIEW LOGIC =================
let attendanceChartInstance = null;

async function fetchAndRenderReports() {
    try {
        const res = await fetch('/api/reports');
        const reports = await res.json();

        // Populate Table
        const tbody = document.getElementById('reports-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (reports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No event data available yet.</td></tr>';
            return;
        }

        const labels = [];
        const registeredData = [];
        const attendedData = [];

        reports.forEach(report => {
            const rate = report.total_registered > 0
                ? Math.round((report.total_attended / report.total_registered) * 100)
                : 0;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${report.name}</strong></td>
                <td><span style="background: var(--light-bg); padding: 4px 8px; border-radius: 12px; font-size: 0.8rem;">${report.category}</span></td>
                <td style="text-align: center;">${report.total_registered}</td>
                <td style="text-align: center; color: var(--primary-color);"><strong>${report.total_attended}</strong></td>
                <td style="text-align: center;">
                    <div style="background: #eef2f6; border-radius: 10px; height: 8px; width: 100%; overflow: hidden; margin-top: 5px;">
                        <div style="background: var(--primary-color); height: 100%; width: ${rate}%;"></div>
                    </div>
                    <small>${rate}%</small>
                </td>
            `;
            tbody.appendChild(tr);

            // Chart Data Prep
            labels.push(report.name.length > 15 ? report.name.substring(0, 15) + '...' : report.name);
            registeredData.push(report.total_registered);
            attendedData.push(report.total_attended);
        });

        // Render Chart
        renderAttendanceChart(labels, registeredData, attendedData);

    } catch (e) {
        console.error("Failed to load reports", e);
    }
}

function renderAttendanceChart(labels, registeredData, attendedData) {
    const ctx = document.getElementById('attendanceChart');
    if (!ctx) return;

    if (attendanceChartInstance) {
        attendanceChartInstance.destroy(); // Destroy previous chart to prevent overlaps
    }

    attendanceChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Registered',
                    data: registeredData,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Attended',
                    data: attendedData,
                    backgroundColor: 'rgba(15, 157, 88, 0.7)',
                    borderColor: 'rgba(15, 157, 88, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }
                }
            },
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Student Attendance by Event' }
            }
        }
    });
}

// ================= SETTINGS LOGIC =================
const settingsForm = document.getElementById('settings-form');
const settingsMessage = document.getElementById('settings-message');
const updateCredsBtn = document.getElementById('update-creds-btn');

if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newUsername = document.getElementById('new-username').value.trim();
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            settingsMessage.textContent = "Passwords do not match!";
            settingsMessage.style.color = 'red';
            return;
        }

        updateCredsBtn.disabled = true;
        updateCredsBtn.innerHTML = 'Updating...';

        try {
            const res = await fetch('/api/settings/credentials', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    new_username: newUsername,
                    new_password: newPassword
                })
            });
            const data = await res.json();

            if (data.success) {
                settingsMessage.textContent = "Credentials successfully updated!";
                settingsMessage.style.color = 'green';
                settingsForm.reset();
            } else {
                settingsMessage.textContent = data.error || "Failed to update credentials.";
                settingsMessage.style.color = 'red';
            }
        } catch (err) {
            console.error(err);
            settingsMessage.textContent = "Network error. Please try again.";
            settingsMessage.style.color = 'red';
        } finally {
            updateCredsBtn.disabled = false;
            updateCredsBtn.innerHTML = 'Update Credentials';
        }
    });
}
