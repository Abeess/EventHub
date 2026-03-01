document.addEventListener('DOMContentLoaded', () => {
    let events = [];

    // Check which page we are on
    const eventsGrid = document.querySelector('.events-grid');
    const eventDetailsContainer = document.getElementById('event-details-content');

    fetch('/api/events')
        .then(res => res.json())
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

    function getImageUrl(event) {
        if (event.image_path) {
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
                        <span class="card-category-tag">${event.category}</span>
                        <div class="card-image" style="background-image: url('${getImageUrl(event)}');"></div>
                    </div>
                    <div class="card-content">
                        <h3>${event.name || event.title}</h3>
                        <span class="card-date">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            ${dateString}
                        </span>
                        <p>${event.description ? event.description.substring(0, 110) + '...' : ''}</p>
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
        renderEvents('all');

        // Filter Button Event Listeners
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
                                <span class="card-category-tag">${event.category}</span>
                                <div class="card-image" style="background-image: url('${getImageUrl(event)}');"></div>
                            </div>
                            <div class="card-content">
                                <h3>${event.name || event.title}</h3>
                                <span class="card-date">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                    ${dateString}
                                </span>
                                <p>${event.description}</p>
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
                    renderEvents(document.querySelector('.filter-btn.active').getAttribute('data-filter'));
                }
            });
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
                            <h1>${event.name || event.title}</h1>
                            <div class="details-meta-info">
                                <span class="badge-primary">${dateString}</span>
                                <span class="badge-secondary">${event.category} Event</span>
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
                                <p>${event.description || 'No description available for this event.'}</p>
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
    const modal = document.getElementById("notify-modal");
    const btn = document.getElementById("get-notified-btn");
    const closeBtns = document.querySelectorAll(".close-btn");
    const form = document.getElementById("notify-form");

    if (btn) {
        btn.onclick = function () {
            modal.style.display = "flex";
        }
    }

    if (closeBtns) {
        closeBtns.forEach(btn => {
            btn.onclick = function () {
                modal.style.display = "none";
            }
        });
    }

    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    if (form) {
        form.onsubmit = function (e) {
            e.preventDefault();
            const nameField = form.querySelector('input[type="text"]');
            if (nameField) {
                alert(`Thanks ${nameField.value}! You have successfully subscribed to event notifications.`);
            } else {
                alert('Success!');
            }
            modal.style.display = "none";
            form.reset();
        }
    }
});
