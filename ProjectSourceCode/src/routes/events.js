
/*
 * TETHR CALENDAR
 * Frontend calendar functionality.
 *
 * demoMode = true: uses sample data.
 * demoMode = false: connects to Express API.
 */

document.addEventListener("DOMContentLoaded", () => {

    const config = window.TETHR_CALENDAR_CONFIG || {};

    const DEMO_MODE = config.demoMode !== false;
    const API = config.apiBase || "/api/calendar";

    // ---------------------------------
    // 1. APPLICATION STATE
    // ---------------------------------

    let currentDate = new Date();
    let currentView = "month";
    let selectedCircle = "all";

    let circles = [];
    let events = [];

    const calendar = document.getElementById("calendar");

    const newEventModal = new bootstrap.Modal(
        document.getElementById("newEventModal")
    );

    const detailsModal = new bootstrap.Modal(
        document.getElementById("eventDetailsModal")
    );

    // ---------------------------------
    // 2. SAMPLE DATA FOR INDEPENDENT TESTING
    // ---------------------------------

    const sampleCircles = [
        { id: 1, name: "Roommates" },
        { id: 2, name: "College Friends" },
        { id: 3, name: "Ski Trip Group" }
    ];

    const sampleEvents = [
        {
            id: 1,
            circleId: 1,
            title: "Dinner Together",
            date: getDateOffset(2),
            startTime: "18:00",
            endTime: "20:00",
            location: "Apartment",
            description: "Group dinner"
        },
        {
            id: 2,
            circleId: 2,
            title: "Study Session",
            date: getDateOffset(5),
            startTime: "14:00",
            endTime: "16:00",
            location: "Library",
            description: "Study for exams"
        }
    ];

    // ---------------------------------
    // 3. HELPER FUNCTIONS
    // ---------------------------------

    function getDateOffset(offset) {
        const date = new Date();
        date.setDate(date.getDate() + offset);
        return formatDate(date);
    }

    // Formats date using local time, avoiding UTC date shifts.
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function parseDate(dateString) {
        const [year, month, day] = dateString.split("-").map(Number);
        return new Date(year, month - 1, day);
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function getCircleName(circleId) {
        const circle = circles.find(
            c => String(c.id) === String(circleId)
        );

        return circle ? circle.name : "Unknown Circle";
    }

    function getVisibleEvents() {
        return events.filter(event =>
            selectedCircle === "all" ||
            String(event.circleId) === String(selectedCircle)
        );
    }

    function showStatus(message) {
        document.getElementById("statusMessage").textContent = message;
    }

    // ---------------------------------
    // 4. BACKEND API COMMUNICATION
    // ---------------------------------

    async function apiRequest(endpoint, options = {}) {

        const response = await fetch(`${API}${endpoint}`, {
            credentials: "same-origin",
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...options.headers
            }
        });

        if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            throw new Error(result.error || "Server request failed.");
        }

        return response.status === 204 ? null : response.json();
    }

    async function loadCircles() {

        if (DEMO_MODE) {
            circles = [...sampleCircles];
        } else {
            circles = await apiRequest("/circles");
        }

        const filter = document.getElementById("circleFilter");
        const eventCircle = document.getElementById("eventCircle");

        filter.innerHTML = '<option value="all">All Circles</option>';
        eventCircle.innerHTML = '<option value="">Choose a Circle</option>';

        circles.forEach(circle => {

            const option1 = document.createElement("option");
            option1.value = circle.id;
            option1.textContent = circle.name;

            const option2 = option1.cloneNode(true);

            filter.appendChild(option1);
            eventCircle.appendChild(option2);
        });
    }

    function getCalendarRange() {

        let start;
        let end;

        if (currentView === "month") {

            start = new Date(
                currentDate.getFullYear(),
                currentDate.getMonth(),
                1
            );

            start.setDate(start.getDate() - start.getDay());

            end = new Date(start);
            end.setDate(start.getDate() + 42);

        } else {

            start = new Date(currentDate);
            start.setDate(start.getDate() - start.getDay());
            start.setHours(0, 0, 0, 0);

            end = new Date(start);
            end.setDate(start.getDate() + 7);
        }

        return { start, end };
    }

    async function loadEvents() {

        if (DEMO_MODE) {
            events = [...sampleEvents];
            return;
        }

        const range = getCalendarRange();

        const params = new URLSearchParams({
            start: range.start.toISOString(),
            end: range.end.toISOString()
        });

        if (selectedCircle !== "all") {
            params.set("circleId", selectedCircle);
        }

        events = await apiRequest(`/events?${params.toString()}`);
    }

    // ---------------------------------
    // 5. CALENDAR RENDERING
    // ---------------------------------

    function renderCalendar() {

        calendar.innerHTML = "";

        if (currentView === "month") {
            renderMonthView();
        } else {
            renderWeekView();
        }

        document.getElementById("monthBtn").className =
            currentView === "month"
                ? "btn btn-primary"
                : "btn btn-outline-primary";

        document.getElementById("weekBtn").className =
            currentView === "week"
                ? "btn btn-primary"
                : "btn btn-outline-primary";
    }

    function renderMonthView() {

        const title = currentDate.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric"
        });

        document.getElementById("calendarTitle").textContent = title;

        const weekdays = [
            "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"
        ];

        weekdays.forEach(day => {
            const heading = document.createElement("div");
            heading.className = "calendar-weekday";
            heading.textContent = day;
            calendar.appendChild(heading);
        });

        const firstDay = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            1
        );

        const start = new Date(firstDay);
        start.setDate(firstDay.getDate() - firstDay.getDay());

        const today = formatDate(new Date());

        for (let i = 0; i < 42; i++) {

            const date = new Date(start);
            date.setDate(start.getDate() + i);

            const dateString = formatDate(date);

            const cell = document.createElement("div");

            cell.className = "calendar-day";

            if (date.getMonth() !== currentDate.getMonth()) {
                cell.classList.add("is-outside");
            }

            if (dateString === today) {
                cell.classList.add("is-today");
            }

            const dayNumber = document.createElement("div");
            dayNumber.className = "day-number";
            dayNumber.textContent = date.getDate();

            cell.appendChild(dayNumber);

            const dayEvents = getVisibleEvents().filter(event =>
                event.date === dateString ||
                (event.start && formatDate(new Date(event.start)) === dateString)
            );

            dayEvents.forEach(event => {
                cell.appendChild(createEventElement(event));
            });

            calendar.appendChild(cell);
        }
    }

    function renderWeekView() {

        const start = new Date(currentDate);
        start.setDate(start.getDate() - start.getDay());

        const end = new Date(start);
        end.setDate(end.getDate() + 6);

        document.getElementById("calendarTitle").textContent =
            `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;

        const weekdays = [
            "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"
        ];

        weekdays.forEach((day, index) => {

            const date = new Date(start);
            date.setDate(start.getDate() + index);

            const heading = document.createElement("div");
            heading.className = "calendar-weekday";

            heading.textContent =
                `${day} ${date.getDate()}`;

            calendar.appendChild(heading);
        });

        for (let i = 0; i < 7; i++) {

            const date = new Date(start);
            date.setDate(start.getDate() + i);

            const cell = document.createElement("div");
            cell.className = "calendar-day week-day";

            const dayEvents = getVisibleEvents().filter(event =>
                getEventDate(event) === formatDate(date)
            );

            dayEvents.forEach(event => {
                cell.appendChild(createEventElement(event));
            });

            if (dayEvents.length === 0) {
                cell.textContent = "No events";
            }

            calendar.appendChild(cell);
        }
    }

    function getEventDate(event) {
        return event.date ||
            (event.start ? formatDate(new Date(event.start)) : "");
    }

    // ---------------------------------
    // 6. EVENT ELEMENT
    // ---------------------------------

    function createEventElement(event) {

        const button = document.createElement("button");

        button.className = "calendar-event";
        button.type = "button";

        const time = event.startTime ||
            (event.start ? new Date(event.start).toLocaleTimeString(
                [], { hour: "numeric", minute: "2-digit" }
            ) : "");

        button.textContent = `${time} ${event.title}`;

        button.title = `${event.title} - ${getCircleName(event.circleId)}`;

        button.addEventListener("click", () => {
            showEventDetails(event.id);
        });

        return button;
    }

    // ---------------------------------
    // 7. EVENT DETAILS
    // ---------------------------------

    async function showEventDetails(eventId) {

        try {

            let event = events.find(
                e => String(e.id) === String(eventId)
            );

            if (!DEMO_MODE) {
                event = await apiRequest(
                    `/events/${encodeURIComponent(eventId)}`
                );
            }

            if (!event) return;

            document.getElementById("detailTitle").textContent =
                event.title;

            const body = document.getElementById("eventDetailsBody");

            const start = event.start ||
                `${event.date}T${event.startTime}`;

            body.innerHTML = `
                <p><strong>Circle:</strong>
                    ${escapeHTML(getCircleName(event.circleId))}
                </p>

                <p><strong>Date:</strong>
                    ${escapeHTML(getEventDate(event))}
                </p>

                <p><strong>Time:</strong>
                    ${escapeHTML(event.startTime || "")}
                    ${event.endTime ? "- " + escapeHTML(event.endTime) : ""}
                </p>

                <p><strong>Location:</strong>
                    ${escapeHTML(event.location || "Not specified")}
                </p>

                <p><strong>Description:</strong>
                    ${escapeHTML(event.description || "No description")}
                </p>

                <hr>

                <h6>RSVP</h6>

                <button class="btn btn-success btn-sm" data-rsvp="going">
                    Going
                </button>

                <button class="btn btn-secondary btn-sm" data-rsvp="maybe">
                    Maybe
                </button>

                <button class="btn btn-danger btn-sm" data-rsvp="declined">
                    Can't Go
                </button>

                <p class="mt-3" id="rsvpStatus">
                    Your RSVP: ${escapeHTML(event.myRsvp || "Not submitted")}
                </p>
            `;

            body.querySelectorAll("[data-rsvp]").forEach(button => {
                button.addEventListener("click", () => {
                    submitRSVP(eventId, button.dataset.rsvp);
                });
            });

            detailsModal.show();

        } catch (error) {
            showStatus(error.message);
        }
    }

    // ---------------------------------
    // 8. RSVP FUNCTIONALITY
    // ---------------------------------

    async function submitRSVP(eventId, status) {

        try {

            if (DEMO_MODE) {

                const event = events.find(
                    e => String(e.id) === String(eventId)
                );

                event.myRsvp = status;

            } else {

                await apiRequest(
                    `/events/${encodeURIComponent(eventId)}/rsvp`,
                    {
                        method: "POST",
                        body: JSON.stringify({ status })
                    }
                );
            }

            document.getElementById("rsvpStatus").textContent =
                `Your RSVP: ${status}`;

            showStatus("RSVP updated.");

        } catch (error) {
            showStatus(error.message);
        }
    }

    // ---------------------------------
    // 9. CREATE NEW EVENT
    // ---------------------------------

    document.getElementById("newEventBtn").addEventListener(
        "click", () => {

            document.getElementById("eventForm").reset();

            document.getElementById("formError").textContent = "";

            // Default date to currently selected calendar date.
            document.getElementById("eventDate").value =
                formatDate(currentDate);

            document.getElementById("startTime").value = "12:00";
            document.getElementById("endTime").value = "13:00";

            newEventModal.show();
        }
    );

    document.getElementById("eventForm").addEventListener(
        "submit", async (e) => {

            e.preventDefault();

            const title = document.getElementById("eventTitle").value.trim();
            const circleId = document.getElementById("eventCircle").value;
            const date = document.getElementById("eventDate").value;
            const startTime = document.getElementById("startTime").value;
            const endTime = document.getElementById("endTime").value;
            const location = document.getElementById("eventLocation").value;
            const description = document.getElementById("eventDescription").value;

            const errorElement = document.getElementById("formError");

            errorElement.textContent = "";

            if (!title || !circleId || !date || !startTime || !endTime) {
                errorElement.textContent =
                    "Please complete all required fields.";
                return;
            }

            const start = new Date(`${date}T${startTime}`);
            const end = new Date(`${date}T${endTime}`);

            if (end <= start) {
                errorElement.textContent =
                    "End time must be after start time.";
                return;
            }

            const eventData = {
                circleId,
                title,
                date,
                startTime,
                endTime,
                location,
                description,
                start: start.toISOString(),
                end: end.toISOString()
            };

            try {

                if (DEMO_MODE) {

                    events.push({
                        ...eventData,
                        id: Date.now()
                    });

                } else {

                    await apiRequest("/events", {
                        method: "POST",
                        body: JSON.stringify(eventData)
                    });

                    await loadEvents();
                }

                currentDate = parseDate(date);

                newEventModal.hide();

                renderCalendar();

                showStatus("Event successfully created!");

            } catch (error) {

                errorElement.textContent = error.message;
            }
        }
    );

    // ---------------------------------
    // 10. CALENDAR NAVIGATION
    // ---------------------------------

    document.getElementById("prevBtn").addEventListener(
        "click", () => {

            if (currentView === "month") {
                currentDate.setMonth(currentDate.getMonth() - 1);
            } else {
                currentDate.setDate(currentDate.getDate() - 7);
            }

            refreshCalendar();
        }
    );

    document.getElementById("nextBtn").addEventListener(
        "click", () => {

            if (currentView === "month") {
                currentDate.setMonth(currentDate.getMonth() + 1);
            } else {
                currentDate.setDate(currentDate.getDate() + 7);
            }

            refreshCalendar();
        }
    );

    document.getElementById("todayBtn").addEventListener(
        "click", () => {

            currentDate = new Date();
            refreshCalendar();
        }
    );

    // ---------------------------------
    // 11. MONTH / WEEK TOGGLE
    // ---------------------------------

    document.getElementById("monthBtn").addEventListener(
        "click", () => {

            currentView = "month";
            refreshCalendar();
        }
    );

    document.getElementById("weekBtn").addEventListener(
        "click", () => {

            currentView = "week";
            refreshCalendar();
        }
    );

    // ---------------------------------
    // 12. CIRCLE FILTER
    // ---------------------------------

    document.getElementById("circleFilter").addEventListener(
        "change", async (e) => {

            selectedCircle = e.target.value;
            await refreshCalendar();
        }
    );

    // ---------------------------------
    // 13. REFRESH CALENDAR
    // ---------------------------------

    async function refreshCalendar() {

        try {

            await loadEvents();
            renderCalendar();

        } catch (error) {

            showStatus(error.message);
        }
    }

    // ---------------------------------
    // 14. INITIALIZE CALENDAR
    // ---------------------------------

    async function initializeCalendar() {

        try {

            await loadCircles();
            await loadEvents();

            renderCalendar();

        } catch (error) {

            showStatus(`Unable to load calendar: ${error.message}`);
        }
    }

    initializeCalendar();

});
