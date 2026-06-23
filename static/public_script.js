// HTML Escape Helper (prevents XSS)
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    let events = [];
    // Make 'All Colleges' the default by not loading from localStorage on start
    let currentCollegeCode = null;

    const collegeCodeModal = document.getElementById('college-code-modal');
    const collegeCodeForm = document.getElementById('college-code-form');
    const collegeCodeInput = document.getElementById('college-code-input');
    const collegeCodeError = document.getElementById('college-code-error');
    const collegeSelect = document.getElementById('college-select');
    const eventsGrid = document.querySelector('.events-grid');
    const eventDetailsContainer = document.getElementById('event-details-content');

    // 1. Colleges & Events Initialization
    if (collegeSelect) {
        // Fetch and populate colleges
        fetch('/api/colleges')
            .then(res => res.json())
            .then(colleges => {
                colleges.forEach(college => {
                    const option = document.createElement('option');
                    option.value = college.college_code;
                    const nameToDisplay = college.college_name || college.username;
                    option.textContent = `${nameToDisplay} (${college.college_code})`;
                    if (currentCollegeCode === college.college_code) {
                        option.selected = true;
                    }
                    collegeSelect.appendChild(option);
                });
            })
            .catch(err => console.error("Failed to load colleges", err));

        // Handle dropdown change
        collegeSelect.addEventListener('change', (e) => {
            const selectedCode = e.target.value;
            if (selectedCode) {
                currentCollegeCode = selectedCode;
                localStorage.setItem('collegeCode', selectedCode);
                fetchEvents(selectedCode);
            } else {
                currentCollegeCode = null;
                localStorage.removeItem('collegeCode');
                fetchAllEvents();
            }
        });
    }

    // Initial event fetch
    if (!currentCollegeCode) {
        fetchAllEvents();
    } else {
        fetchEvents(currentCollegeCode);
    }

    function fetchAllEvents() {
        fetch('/api/all_events')
            .then(res => {
                if (!res.ok) throw new Error("Failed to load all events");
                return res.json();
            })
            .then(data => {
                events = data;
                if (eventsGrid) {
                    initializeListingPage();
                } else if (eventDetailsContainer) {
                    initializeDetailsPage();
                }
            })
            .catch(err => {
                console.error("Failed to load events", err);
                if (eventsGrid) eventsGrid.innerHTML = "<p>Error loading events.</p>";
            });
    }

    function fetchEvents(code) {
        if (!code) return;
        fetch(`/api/events?college_code=${encodeURIComponent(code)}`)
            .then(res => {
                if (!res.ok) {
                    // If the stored code is invalid now (e.g. admin deleted)
                    localStorage.removeItem('collegeCode');
                    currentCollegeCode = null;
                    if (collegeSelect) {
                        collegeSelect.value = '';
                    }
                    fetchAllEvents();
                    throw new Error("Invalid stored college code");
                }
                return res.json();
            })
            .then(data => {
                events = data;
                if (eventsGrid) {
                    initializeListingPage();
                } else if (eventDetailsContainer) {
                    initializeDetailsPage();
                }
            })
            .catch(err => {
                console.error("Failed to load events", err);
            });
    }

    function getImageUrl(event) {
        if (event.image_path) {
            // image_path may be a full URL (e.g. Supabase Storage public URL)
            // or a legacy local filename stored under /static/uploads/
            if (event.image_path.startsWith('http://') || event.image_path.startsWith('https://')) {
                return event.image_path;
            }
            return `/static/uploads/${event.image_path}`;
        }
        return 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1000&q=80';
    }

    function initializeListingPage() {
        const filterButtons = document.querySelectorAll('.filter-btn');

        // Function to render events
        function renderEvents(filter = 'all') {
            eventsGrid.innerHTML = ''; // Clear current events

            // Filter events
            let filteredEvents = events;
            if (filter !== 'all') {
                filteredEvents = events.filter(event => event.status && event.status.toLowerCase() === filter.toLowerCase());
            }

            // Sort events by date
            filteredEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

            // Create HTML for each event
            filteredEvents.forEach(event => {
                const dateObj = new Date(event.date);
                const dateString = isNaN(dateObj) ? event.date : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                const eventCard = document.createElement('article');
                eventCard.className = 'event-card';
                // Make the card clickable and link to details page
                eventCard.onclick = () => window.location.href = `event-details.html?id=${event.id}`;
                eventCard.style.cursor = 'pointer';

                eventCard.innerHTML = `
                    <div class="card-image-wrapper">
                        <span class="card-category-tag">${escapeHtml(event.category)}</span>
                        <div class="card-image" style="background-image: url('${getImageUrl(event)}');"></div>
                    </div>
                    <div class="card-content">
                        <h3>${escapeHtml(event.name || event.title)}</h3>
                        <span class="card-date">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            ${dateString}
                        </span>
                        <p>${event.description ? escapeHtml(event.description.substring(0, 110)) + '...' : ''}</p>
                        <div class="card-footer">
                            <span>View Details</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </div>
                    </div>
                `;
                eventsGrid.appendChild(eventCard);
            });

            if (filteredEvents.length === 0) {
                eventsGrid.innerHTML = "<p>No events found for this status.</p>";
            }
        }

        // Initial render
        renderEvents(document.querySelector('.filter-btn.active')?.getAttribute('data-filter') || 'all');

        // Filter Button Event Listeners (Add only once)
        if (!eventsGrid.dataset.listenersAdded) {
            filterButtons.forEach(button => {
                button.addEventListener('click', () => {
                    // Remove active class from all buttons
                    filterButtons.forEach(btn => btn.classList.remove('active'));
                    // Add active class to clicked button
                    button.classList.add('active');

                    const filterValue = button.getAttribute('data-filter');
                    renderEvents(filterValue);
                });
            });
            eventsGrid.dataset.listenersAdded = 'true';
        }

        // Search functionality
        const searchButton = document.querySelector('.search-bar button');
        const searchInput = document.querySelector('.search-bar input');

        if (searchButton && searchInput) {
            searchButton.addEventListener('click', () => {
                const query = searchInput.value.toLowerCase();
                if (query !== "") {
                    const searchResults = events.filter(event => {
                        const titleMatch = (event.name || event.title || '').toLowerCase().includes(query);
                        const descMatch = (event.description || '').toLowerCase().includes(query);
                        return titleMatch || descMatch;
                    });

                    eventsGrid.innerHTML = '';
                    searchResults.forEach(event => {
                        const dateObj = new Date(event.date);
                        const dateString = isNaN(dateObj) ? event.date : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        const eventCard = document.createElement('article');
                        eventCard.className = 'event-card';
                        eventCard.onclick = () => window.location.href = `event-details.html?id=${event.id}`;
                        eventCard.style.cursor = 'pointer';
                        eventCard.innerHTML = `
                            <div class="card-image-wrapper">
                                <span class="card-category-tag">${escapeHtml(event.category)}</span>
                                <div class="card-image" style="background-image: url('${getImageUrl(event)}');"></div>
                            </div>
                            <div class="card-content">
                                <h3>${escapeHtml(event.name || event.title)}</h3>
                                <span class="card-date">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                    ${dateString}
                                </span>
                                <p>${escapeHtml(event.description)}</p>
                                <div class="card-footer">
                                    <span>View Details</span>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                </div>
                            </div>
                        `;
                        eventsGrid.appendChild(eventCard);
                    });

                    if (searchResults.length === 0) {
                        eventsGrid.innerHTML = "<p>No matching events found.</p>";
                    }
                } else {
                    // If search is cleared, render the current filter again
                    renderEvents(document.querySelector('.filter-btn.active')?.getAttribute('data-filter') || 'all');
                }
            });
            
            // Allow clearing search by listening to input
            searchInput.addEventListener('input', (e) => {
                if (e.target.value.trim() === "") {
                    renderEvents(document.querySelector('.filter-btn.active')?.getAttribute('data-filter') || 'all');
                }
            });
            
            eventsGrid.dataset.searchListenerAdded = 'true';
        }
    }

    function initializeDetailsPage() {
        const urlParams = new URLSearchParams(window.location.search);
        const eventId = parseInt(urlParams.get('id'));

        const event = events.find(e => e.id === eventId);

        if (event) {
            const dateObj = new Date(event.date);
            const dateString = isNaN(dateObj) ? event.date : dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', weekday: 'long' });

            const existingMain = document.querySelector('.details-main');
            if (existingMain) {
                existingMain.innerHTML = `
                    <div class="details-hero" style="background-image: url('${getImageUrl(event)}');">
                        <div class="details-hero-content">
                            <h1>${escapeHtml(event.name || event.title)}</h1>
                            <div class="details-meta-info">
                                <span class="badge-primary">${dateString}</span>
                                <span class="badge-secondary">${escapeHtml(event.category)} Event</span>
                            </div>
                        </div>
                    </div>
                    <div class="details-container">
                        <div class="event-card-deep">
                            <a href="/" class="back-link">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                                Back to All Events
                            </a>
                            <div class="description-block">
                                <h3>About this Event</h3>
                                <p>${escapeHtml(event.description) || 'No description available for this event.'}</p>
                                ${event.registration_link ? `<div style="margin-top: 30px;"><a href="${event.registration_link}" target="_blank" class="btn btn-primary" style="padding: 12px 24px; font-size: 1.1rem;">Register Now</a></div>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }

            if (eventDetailsContainer && !existingMain) {
                eventDetailsContainer.innerHTML = `<p>Error loading layout.</p>`;
            }

        } else {
            const existingMain = document.querySelector('.details-main');
            if (existingMain) {
                existingMain.innerHTML = '<div class="details-container" style="padding-top: 5rem; text-align: center;"><h2>Event not found.</h2><a href="/" class="btn btn-primary">Go Home</a></div>';
            }
        }
    }

    // Get Notified Modal Logic
    const notifyModal = document.getElementById("notify-modal");
    const getNotifiedBtn = document.getElementById("get-notified-btn");
    const notifyCloseBtns = document.querySelectorAll("#notify-modal .close-btn");
    const notifyForm = document.getElementById("notify-form");

    if (getNotifiedBtn && notifyModal) {
        getNotifiedBtn.onclick = function () {
            if (!currentCollegeCode) {
                alert("Please select a specific College from the dropdown first.");
                if (collegeSelect) collegeSelect.focus();
                return;
            }
            notifyModal.style.display = "flex";
        }
    }

    if (notifyCloseBtns) {
        notifyCloseBtns.forEach(btn => {
            btn.onclick = function () {
                notifyModal.style.display = "none";
            }
        });
    }

    window.onclick = function (event) {
        if (event.target == notifyModal) {
            notifyModal.style.display = "none";
        }
        if (event.target == collegeCodeModal) {
            collegeCodeModal.style.display = "none";
        }
    }

    if (notifyForm) {
        notifyForm.onsubmit = async function (e) {
            e.preventDefault();
            const nameField = notifyForm.querySelector('input[type="text"]');
            const emailField = notifyForm.querySelector('input[type="email"]');
            const submitBtn = notifyForm.querySelector('.btn-submit');

            if (nameField && emailField && currentCollegeCode) {
                // Disable button and show loading state
                const originalText = submitBtn.textContent;
                submitBtn.textContent = 'Subscribing...';
                submitBtn.disabled = true;

                try {
                    const response = await fetch('/subscribe', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            name: nameField.value.trim(),
                            email: emailField.value.trim(),
                            college_code: currentCollegeCode
                        })
                    });

                    const data = await response.json();

                    if (response.ok) {
                        alert(`Success: ${data.message}`);
                        notifyForm.reset();
                        notifyModal.style.display = "none";
                    } else {
                        alert(`Error: ${data.error}`);
                    }
                } catch (error) {
                    console.error('Subscription error:', error);
                    alert('A network error occurred. Please check if the server is running and try again.');
                } finally {
                    // Restore button state
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                }
            }
        }
    }
});
