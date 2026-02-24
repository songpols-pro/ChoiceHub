document.addEventListener('DOMContentLoaded', () => {
    // Globals
    const API_BASE = '/api';
    let currentEventId = null;
    let currentEventData = null; // Stores full event object
    let manualMenuState = {}; // Draft state for manual builder { "Sheet1": [categories...] }
    let manualCurrentSheet = 'Sheet1';
    let loggedInCreator = null; // Stores the currently loaded creator

    // Elements
    const notificationArea = document.getElementById('notificationArea');

    // Creator Search Elements
    const creatorSearchSection = document.getElementById('creatorSearchSection');
    const creatorSearchForm = document.getElementById('creatorSearchForm');
    const creatorSearchInput = document.getElementById('creatorSearchInput');

    // Event Manager Elements
    const eventsDashboardSection = document.getElementById('eventsDashboardSection');
    const loggedInCreatorNameDisplay = document.getElementById('loggedInCreatorNameDisplay');
    const logoutCreatorBtn = document.getElementById('logoutCreatorBtn');
    const createEventForm = document.getElementById('createEventForm');
    const newEventTopicInput = document.getElementById('newEventTopic');
    const eventsList = document.getElementById('eventsList');

    // Event Editor Elements
    const eventEditorSection = document.getElementById('eventEditorSection');
    const editorEventTopicTitle = document.getElementById('editorEventTopicTitle');
    const closeEditorBtn = document.getElementById('closeEditorBtn');
    const eventShareLink = document.getElementById('eventShareLink');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const eventStatusBadge = document.getElementById('eventStatusBadge');
    const toggleStatusBtn = document.getElementById('toggleStatusBtn');

    // Tabs
    const editorTabBtns = document.querySelectorAll('.editor-tab-btn');
    const editorTabContents = document.querySelectorAll('.editor-tab-content');

    // General Settings Forms
    const eventSettingsForm = document.getElementById('eventSettingsForm');
    const eventTopic = document.getElementById('eventTopic');
    const eventDate = document.getElementById('eventDate');
    const eventTime = document.getElementById('eventTime');
    const eventLocation = document.getElementById('eventLocation');

    // Voter Management (Per-Event)
    const eventAddUserForm = document.getElementById('eventAddUserForm');
    const eventNewUserNameInput = document.getElementById('eventNewUserName');
    const eventUsersList = document.getElementById('eventUsersList');

    // Menu
    const uploadMenuForm = document.getElementById('uploadMenuForm');
    const menuFileInput = document.getElementById('menuFile');
    const deleteEventBtn = document.getElementById('deleteEventBtn');

    // Manual Menu Builder
    const manualMenuBuilder = document.getElementById('manualMenuBuilder');
    const addManualCategoryBtn = document.getElementById('addManualCategoryBtn');
    const saveManualMenuBtn = document.getElementById('saveManualMenuBtn');

    // Global
    const clearVotesBtn = document.getElementById('clearVotesBtn');

    // Notifications
    function showNotification(msg, type) {
        notificationArea.textContent = msg;
        notificationArea.className = `notify-${type}`;
        notificationArea.classList.remove('hidden');
        setTimeout(() => notificationArea.classList.add('hidden'), 5000);
    }

    // --- TAB LOGIC ---
    editorTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Deactivate all
            editorTabBtns.forEach(b => b.classList.remove('active'));
            editorTabContents.forEach(c => c.classList.add('hidden'));

            // Activate selected
            btn.classList.add('active');
            document.querySelector(btn.getAttribute('data-target')).classList.remove('hidden');
        });
    });

    // --- CREATOR SEARCH & LOGOUT ---

    creatorSearchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = creatorSearchInput.value.trim();
        if (!name) return;

        loggedInCreator = name;
        creatorSearchSection.classList.add('hidden');
        eventsDashboardSection.classList.remove('hidden');
        loggedInCreatorNameDisplay.textContent = loggedInCreator;
        fetchEvents();
    });

    logoutCreatorBtn.addEventListener('click', () => {
        loggedInCreator = null;
        creatorSearchInput.value = '';
        eventsDashboardSection.classList.add('hidden');
        creatorSearchSection.classList.remove('hidden');
        eventsList.innerHTML = '';
        eventEditorSection.classList.add('hidden');
    });

    // --- EVENTS DASHBOARD ---

    async function fetchEvents() {
        if (!loggedInCreator) return;
        eventsList.innerHTML = '<li style="text-align:center;">Loading events...</li>';
        try {
            const res = await fetch(`${API_BASE}/events`);
            const allEvents = await res.json();

            // Filter by creator name (case insensitive)
            const myEvents = allEvents.filter(e =>
                (e.creatorName || '').toLowerCase() === loggedInCreator.toLowerCase()
            );

            renderEvents(myEvents);
        } catch (err) {
            eventsList.innerHTML = '<li style="color:red; text-align:center;">Error loading events</li>';
        }
    }

    function renderEvents(events) {
        eventsList.innerHTML = '';
        if (events.length === 0) {
            eventsList.innerHTML = '<li style="text-align:center; color: #6b7280;">No events created yet.</li>';
            return;
        }

        events.forEach(event => {
            const li = document.createElement('li');
            li.className = 'user-item';

            const infoDiv = document.createElement('div');
            const titleSpan = document.createElement('strong');
            titleSpan.textContent = event.topic;
            titleSpan.style.display = 'block';

            const metaSpan = document.createElement('span');
            const statColor = event.status === 'open' ? 'var(--success)' : 'var(--danger)';
            metaSpan.innerHTML = `Created by: <b>${event.creatorName}</b> | Status: <b style="color:${statColor}; text-transform:uppercase;">${event.status}</b>`;
            metaSpan.style.fontSize = '0.8rem';
            metaSpan.style.color = 'var(--text-muted)';

            infoDiv.appendChild(titleSpan);
            infoDiv.appendChild(metaSpan);

            const editBtn = document.createElement('button');
            editBtn.className = 'primary-btn btn-small';
            editBtn.textContent = 'Manage Event →';
            editBtn.style.padding = '0.4rem 0.8rem';
            editBtn.addEventListener('click', () => openEventEditor(event));

            li.appendChild(infoDiv);
            li.appendChild(editBtn);
            eventsList.appendChild(li);
        });
    }

    createEventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const topic = newEventTopicInput.value.trim();
        const creatorName = loggedInCreator;
        if (!topic || !creatorName) return;

        const submitBtn = createEventForm.querySelector('button');
        submitBtn.disabled = true;

        try {
            const res = await fetch(`${API_BASE}/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, creatorName })
            });

            if (res.ok) {
                showNotification(`Created event: ${topic}`, 'success');
                Swal.fire({
                    title: 'Success!',
                    text: `สร้างงานโหวต "${topic}" สำเร็จแล้ว!`,
                    icon: 'success',
                    confirmButtonColor: '#4f46e5'
                });
                newEventTopicInput.value = '';
                // Keep creator name for speed
                fetchEvents();
            } else {
                showNotification('Failed to create event', 'error');
            }
        } catch (err) {
            showNotification('Network error', 'error');
        } finally {
            submitBtn.disabled = false;
        }
    });

    // --- EVENT EDITOR GENERAL ---

    async function openEventEditor(eventOverview) {
        currentEventId = eventOverview.id;

        // Fetch full event to get voters & menu
        try {
            const res = await fetch(`${API_BASE}/events/${currentEventId}`);
            currentEventData = await res.json();

            // Populate UI
            editorEventTopicTitle.textContent = currentEventData.topic;
            eventTopic.value = currentEventData.topic || '';
            eventDate.value = currentEventData.date || '';
            eventTime.value = currentEventData.time || '';
            eventLocation.value = currentEventData.location || '';
            menuFileInput.value = '';

            // Status Badge
            updateStatusBadge(currentEventData.status);

            // Share Link
            const shareUrl = `${window.location.origin}/?eventId=${currentEventId}`;
            eventShareLink.textContent = shareUrl;

            // Load Sub-components
            renderEventVoters(currentEventData.allowedVoters || []);
            initManualMenuBuilder(currentEventData.menuData);

            // Show Editor Container
            eventEditorSection.classList.remove('hidden');
            eventEditorSection.scrollIntoView({ behavior: 'smooth' });

            // Reset tabs
            editorTabBtns[0].click();
        } catch (err) {
            showNotification('Error loading event data', 'error');
        }
    }

    closeEditorBtn.addEventListener('click', () => {
        currentEventId = null;
        currentEventData = null;
        eventEditorSection.classList.add('hidden');
        fetchEvents(); // Refresh overview
    });

    copyLinkBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(eventShareLink.textContent).then(() => {
            const originalText = copyLinkBtn.textContent;
            copyLinkBtn.textContent = '✅ Copied!';
            setTimeout(() => copyLinkBtn.textContent = originalText, 2000);
        }).catch(() => {
            Swal.fire({
                title: 'Copy this link:',
                input: 'text',
                inputValue: eventShareLink.textContent,
                icon: 'info',
                confirmButtonColor: '#4f46e5'
            });
        });
    });

    function updateStatusBadge(status) {
        if (status === 'open') {
            eventStatusBadge.textContent = 'OPEN';
            eventStatusBadge.style.background = 'var(--success)';
            toggleStatusBtn.textContent = 'Lock & Close Voting';
            toggleStatusBtn.style.background = 'var(--error)'; // Warning red
        } else {
            eventStatusBadge.textContent = 'CLOSED';
            eventStatusBadge.style.background = 'var(--error)';
            toggleStatusBtn.textContent = 'Re-Open Voting';
            toggleStatusBtn.style.background = 'var(--success)'; // Green to reopen
        }
    }

    toggleStatusBtn.addEventListener('click', async () => {
        if (!currentEventId || !currentEventData) return;
        const newStatus = currentEventData.status === 'open' ? 'closed' : 'open';

        try {
            const res = await fetch(`${API_BASE}/events/${currentEventId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                currentEventData.status = newStatus;
                updateStatusBadge(newStatus);
                showNotification(`Event ${newStatus === 'open' ? 'opened' : 'closed'} successfully`, 'success');
                Swal.fire({
                    title: newStatus === 'open' ? 'Event Opened!' : 'Event Closed!',
                    text: `เปลี่ยนสถานะงานโหวตเป็น ${newStatus === 'open' ? 'เปิด (OPEN)' : 'ปิด (CLOSED)'} สำเร็จแล้ว!`,
                    icon: newStatus === 'open' ? 'success' : 'warning',
                    confirmButtonColor: '#4f46e5'
                });
            }
        } catch (err) {
            showNotification('Failed to toggle status', 'error');
        }
    });

    eventSettingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentEventId) return;

        const submitBtn = eventSettingsForm.querySelector('button');
        submitBtn.disabled = true;

        const payload = {
            topic: eventTopic.value.trim(),
            date: eventDate.value.trim(),
            time: eventTime.value.trim(),
            location: eventLocation.value.trim()
        };

        try {
            const res = await fetch(`${API_BASE}/events/${currentEventId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showNotification('Event settings saved!', 'success');
                Swal.fire({
                    title: 'Saved!',
                    text: 'บันทึกการตั้งค่างานสำเร็จแล้ว!',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
                editorEventTopicTitle.textContent = payload.topic;
                // update local memory
                currentEventData.topic = payload.topic;
            } else {
                showNotification('Failed to save settings', 'error');
            }
        } catch (err) {
            showNotification('Network error', 'error');
        } finally {
            submitBtn.disabled = false;
        }
    });


    // --- EVENT VOTERS MANAGEMENT ---

    function renderEventVoters(voters) {
        eventUsersList.innerHTML = '';
        if (voters.length === 0) {
            eventUsersList.innerHTML = '<li style="text-align:center; color:var(--text-muted); padding: 1rem;">No voters allowed yet for this event.<br>Add names above!</li>';
            return;
        }

        voters.forEach(voter => {
            const li = document.createElement('li');
            li.className = 'user-item';

            const span = document.createElement('span');
            span.textContent = voter;

            const delBtn = document.createElement('button');
            delBtn.className = 'btn-delete';
            delBtn.textContent = 'Remove';
            delBtn.addEventListener('click', () => deleteEventVoter(voter));

            li.appendChild(span);
            li.appendChild(delBtn);
            eventUsersList.appendChild(li);
        });
    }

    eventAddUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentEventId) return;
        const name = eventNewUserNameInput.value.trim();
        if (!name) return;

        const submitBtn = eventAddUserForm.querySelector('button');
        submitBtn.disabled = true;

        try {
            const res = await fetch(`${API_BASE}/events/${currentEventId}/voters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const data = await res.json();

            if (res.ok) {
                eventNewUserNameInput.value = '';
                currentEventData.allowedVoters = data.voters;
                renderEventVoters(data.voters);
                Swal.fire({
                    title: 'Voter Added',
                    text: `เพิ่มผู้โหวต "${name}" สำเร็จแล้ว!`,
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            } else {
                Swal.fire('Error', data.error || 'Failed to add voter', 'error');
            }
        } catch (err) {
            Swal.fire('Network error', 'error', 'error');
        } finally {
            submitBtn.disabled = false;
        }
    });

    // 4. Delete Voter
    async function deleteEventVoter(name) {
        if (!currentEventId) return;

        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `Remove '${name}' from this event?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, remove them'
        });

        if (!result.isConfirmed) return;

        try {
            const res = await fetch(`${API_BASE}/events/${currentEventId}/voters/${encodeURIComponent(name)}`, {
                method: 'DELETE'
            });
            const data = await res.json();

            if (res.ok) {
                currentEventData.allowedVoters = data.voters;
                renderEventVoters(data.voters);
                showNotification(`Removed ${name}`, 'success');
                Swal.fire({
                    title: 'Removed!',
                    text: `ลบผู้โหวต "${name}" สำเร็จแล้ว!`,
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            } else {
                showNotification(data.error || 'Failed to remove voter', 'error');
            }
        } catch (err) {
            showNotification('Network error', 'error');
        }
    }


    // --- MENU CONFIGURATION (EXCEL & MANUAL) ---

    uploadMenuForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentEventId || !menuFileInput.files.length) return;

        const submitBtn = uploadMenuForm.querySelector('button');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading...';

        const formData = new FormData();
        formData.append('menuFile', menuFileInput.files[0]);

        try {
            const res = await fetch(`${API_BASE}/upload-menu/${currentEventId}`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                showNotification('Menu uploaded successfully! Syncing manual builder UI...', 'success');
                await Swal.fire({
                    title: 'Uploaded!',
                    text: 'อัปโหลดไฟล์เมนูให้กับงานนี้เรียบร้อยแล้ว',
                    icon: 'success',
                    confirmButtonColor: '#4f46e5'
                });
                menuFileInput.value = '';
                // Sync manual builder
                currentEventData.menuData = data.menuData;
                initManualMenuBuilder(currentEventData.menuData);
            } else {
                showNotification(data.error || 'Failed to upload menu', 'error');
                Swal.fire({
                    title: 'Error!',
                    text: 'เกิดข้อผิดพลาด: ' + (data.error || 'Upload failed'),
                    icon: 'error',
                    confirmButtonColor: '#4f46e5'
                });
            }
        } catch (err) {
            showNotification('Network error upload', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Upload Excel';
        }
    });


    // --- THE MANUAL MENU BUILDER (MULTI-SHEET SUPPORT) ---

    function initManualMenuBuilder(menuData) {
        if (!menuData || Object.keys(menuData).length === 0) {
            manualMenuState = { 'Sheet1': [] };
            manualCurrentSheet = 'Sheet1';
        } else {
            manualMenuState = JSON.parse(JSON.stringify(menuData)); // Deep copy
            manualCurrentSheet = Object.keys(manualMenuState)[0];
        }
        renderManualMenu();
    }

    function renderManualMenu() {
        manualMenuBuilder.innerHTML = '';

        // 1. Render Sheet Navigation Tabs
        const sheetNav = document.createElement('div');
        sheetNav.style.cssText = 'display:flex; gap:0.5rem; margin-bottom:1rem; overflow-x:auto; padding-bottom:0.5rem; border-bottom:2px solid rgba(0,0,0,0.05);';

        Object.keys(manualMenuState).forEach(sheetName => {
            const btn = document.createElement('button');
            btn.className = `editor-tab-btn ${sheetName === manualCurrentSheet ? 'active' : ''}`;
            btn.style.cssText = 'white-space:nowrap; padding:0.5rem 1rem;';
            btn.textContent = sheetName;

            // Allow clicking to switch
            btn.addEventListener('click', () => {
                manualCurrentSheet = sheetName;
                renderManualMenu();
            });

            // If it's the active tab, add a small delete button (if more than 1 sheet)
            if (sheetName === manualCurrentSheet && Object.keys(manualMenuState).length > 1) {
                const delSheet = document.createElement('span');
                delSheet.textContent = ' ✕';
                delSheet.style.color = 'var(--danger)';
                delSheet.style.cursor = 'pointer';
                delSheet.addEventListener('click', (e) => {
                    e.stopPropagation();
                    delete manualMenuState[sheetName];
                    manualCurrentSheet = Object.keys(manualMenuState)[0];
                    renderManualMenu();
                });
                btn.appendChild(delSheet);
            }

            sheetNav.appendChild(btn);
        });

        // Add "New Sheet" Button
        const addSheetBtn = document.createElement('button');
        addSheetBtn.className = 'editor-tab-btn';
        addSheetBtn.style.cssText = 'white-space:nowrap; padding:0.5rem 1rem; border:1px dashed var(--primary-color); color:var(--primary-color); background:transparent;';
        addSheetBtn.textContent = '+ Add Topic (Sheet)';
        addSheetBtn.addEventListener('click', async () => {
            const { value: newSheetName } = await Swal.fire({
                title: 'New Topic / Sheet',
                input: 'text',
                inputPlaceholder: 'e.g. Day 2 Dinner',
                showCancelButton: true,
                confirmButtonColor: '#4f46e5'
            });
            if (newSheetName && newSheetName.trim() && !manualMenuState[newSheetName.trim()]) {
                const cleanName = newSheetName.trim();
                manualMenuState[cleanName] = [];
                manualCurrentSheet = cleanName;
                renderManualMenu();
            }
        });
        sheetNav.appendChild(addSheetBtn);
        manualMenuBuilder.appendChild(sheetNav);

        // 2. Render Categories for the active sheet
        const currentCategories = manualMenuState[manualCurrentSheet] || [];

        if (currentCategories.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.style.cssText = 'text-align:center; padding: 2rem; color:var(--text-muted); border:2px dashed rgba(0,0,0,0.1); border-radius:8px; margin-bottom:1rem;';
            emptyMsg.textContent = `No categories in '${manualCurrentSheet}'. Add a category to start building!`;
            manualMenuBuilder.appendChild(emptyMsg);
        } else {
            currentCategories.forEach((catObj, catIndex) => {
                const catCard = document.createElement('div');
                catCard.style.cssText = 'background: white; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; box-shadow: 0 2px 5px rgba(0,0,0,0.02);';

                // Category Header
                const headerRow = document.createElement('div');
                headerRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; padding-bottom:0.5rem; border-bottom:1px solid rgba(0,0,0,0.05);';

                headerRow.innerHTML = `
                    <div style="flex-grow:1;">
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <span style="font-weight:bold; font-size:1.1rem; color:var(--primary-color);">${catObj.category}</span>
                            <span style="font-size:0.8rem; background:rgba(0,0,0,0.05); padding:2px 8px; border-radius:12px;">Quota: ${catObj.quota}</span>
                        </div>
                    </div>
                `;

                const catActions = document.createElement('div');
                const addItemBtn = document.createElement('button');
                addItemBtn.className = 'primary-btn btn-small';
                addItemBtn.textContent = '+ Item';
                addItemBtn.style.marginRight = '0.5rem';
                addItemBtn.addEventListener('click', async () => {
                    const { value: itemName } = await Swal.fire({
                        title: `Add item to '${catObj.category}'`,
                        input: 'text',
                        inputPlaceholder: 'Enter item name',
                        showCancelButton: true,
                        confirmButtonColor: '#4f46e5'
                    });

                    if (itemName && itemName.trim()) {
                        catObj.items.push(itemName.trim());
                        renderManualMenu();
                    }
                });

                const delCatBtn = document.createElement('button');
                delCatBtn.className = 'btn-delete';
                delCatBtn.innerHTML = '🗑️';
                delCatBtn.addEventListener('click', async () => {
                    const result = await Swal.fire({
                        title: 'Are you sure?',
                        text: `Delete entire category '${catObj.category}'?`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#ef4444',
                        cancelButtonColor: '#6b7280',
                        confirmButtonText: 'Yes, delete it!'
                    });

                    if (result.isConfirmed) {
                        manualMenuState[manualCurrentSheet].splice(catIndex, 1);
                        renderManualMenu();
                    }
                });

                catActions.appendChild(addItemBtn);
                catActions.appendChild(delCatBtn);
                headerRow.appendChild(catActions);
                catCard.appendChild(headerRow);

                // Category Items
                const itemsList = document.createElement('ul');
                itemsList.style.cssText = 'list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:0.5rem;';

                if (catObj.items.length === 0) {
                    itemsList.innerHTML = '<li style="color:var(--text-muted); font-size:0.9rem;">No items yet.</li>';
                } else {
                    catObj.items.forEach((item, itemIndex) => {
                        const itemLi = document.createElement('li');
                        itemLi.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.02); padding: 0.5rem 1rem; border-radius:6px;';
                        itemLi.innerHTML = `<span>${item}</span>`;

                        const delItemBtn = document.createElement('button');
                        delItemBtn.className = 'btn-delete';
                        delItemBtn.style.padding = '0.2rem 0.5rem';
                        delItemBtn.innerHTML = '✕';
                        delItemBtn.addEventListener('click', () => {
                            catObj.items.splice(itemIndex, 1);
                            renderManualMenu();
                        });

                        itemLi.appendChild(delItemBtn);
                        itemsList.appendChild(itemLi);
                    });
                }

                catCard.appendChild(itemsList);
                manualMenuBuilder.appendChild(catCard);
            });
        }
    }

    // Add Category to current active sheet
    addManualCategoryBtn.addEventListener('click', async () => {
        if (!manualCurrentSheet || !manualMenuState[manualCurrentSheet]) {
            Swal.fire('Error', 'Please create a sheet/topic first.', 'error');
            return;
        }

        const { value: formValues } = await Swal.fire({
            title: `Add Category to '${manualCurrentSheet}'`,
            html: `
                <input id="swal-cat-name" class="swal2-input" placeholder="Category Name (e.g. Drinks)">
                <input id="swal-cat-quota" type="number" class="swal2-input" placeholder="Quota (e.g. 1)" value="1" min="1">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            preConfirm: () => {
                const name = document.getElementById('swal-cat-name').value.trim();
                const quota = parseInt(document.getElementById('swal-cat-quota').value);
                if (!name || isNaN(quota) || quota < 1) {
                    Swal.showValidationMessage('Please enter valid name and quota >= 1');
                    return false;
                }
                return { name, quota };
            }
        });

        if (formValues) {
            manualMenuState[manualCurrentSheet].push({
                category: formValues.name,
                quota: formValues.quota,
                items: []
            });
            renderManualMenu();
        }
    });

    saveManualMenuBtn.addEventListener('click', async () => {
        if (!currentEventId) return;

        saveManualMenuBtn.disabled = true;
        saveManualMenuBtn.textContent = 'Saving...';

        try {
            // Send the full object { "Sheet1": [categories], "Sheet2": [...] }
            const res = await fetch(`${API_BASE}/events/${currentEventId}/menu`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ menuData: manualMenuState })
            });
            const data = await res.json();

            if (res.ok) {
                currentEventData.menuData = data.menuData;
                Swal.fire({
                    title: 'Saved!',
                    text: 'บันทึกเมนูสำเร็จแล้ว!',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            } else {
                Swal.fire('Error', data.error || 'Failed to save menu', 'error');
            }
        } catch (err) {
            Swal.fire('Error', 'Network error', 'error');
        } finally {
            saveManualMenuBtn.disabled = false;
            saveManualMenuBtn.textContent = 'Save Manual Menu';
        }
    });

    // --- DELETIONS ---

    deleteEventBtn.addEventListener('click', async () => {
        if (!currentEventId) return;

        const { value: confirmation } = await Swal.fire({
            title: 'Are you absolutely sure?',
            text: "Type 'DELETE' to permanently remove this event and ALL its votes.",
            input: 'text',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Delete Event'
        });

        if (confirmation !== 'DELETE') return;

        try {
            const res = await fetch(`${API_BASE}/events/${currentEventId}`, { method: 'DELETE' });
            if (res.ok) {
                showNotification('Event deleted successfully.', 'success');
                Swal.fire({
                    title: 'Deleted!',
                    text: 'ลบงานโหวตนี้สำเร็จแล้ว!',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
                eventEditorSection.classList.add('hidden');
                currentEventId = null;
                fetchEvents();
            } else {
                showNotification('Failed to delete event.', 'error');
            }
        } catch (err) {
            showNotification('Network error', 'error');
        }
    });

    clearVotesBtn.addEventListener('click', async () => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "คุณแน่ใจหรือไม่ที่จะล้างคะแนนโหวตทั้งหมดสำหรับ 'ทุกงานโหวต'? (การกระทำนี้จะลบคะแนนทั้งหมดและไม่สามารถกู้คืนได้)",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, clear all votes!'
        });

        if (!result.isConfirmed) return;

        try {
            const res = await fetch(`${API_BASE}/votes`, { method: 'DELETE' });
            if (res.ok) {
                showNotification('ALL votes wiped successfully!', 'success');
                Swal.fire({
                    title: 'Cleared!',
                    text: 'ดำเนินการล้างคะแนนโหวตสำหรับทุกงานเรียบร้อยแล้ว!',
                    icon: 'success',
                    confirmButtonColor: '#4f46e5'
                });
            } else {
                showNotification('Failed to clear votes', 'error');
                Swal.fire({
                    title: 'Error',
                    text: 'เกิดข้อผิดพลาดในการลบผลโหวต',
                    icon: 'error',
                    confirmButtonColor: '#4f46e5'
                });
            }
        } catch (err) {
            showNotification('Network error', 'error');
            Swal.fire({
                title: 'Network Error',
                text: 'เกิดปัญหาการเชื่อมต่อเครือข่าย',
                icon: 'error',
                confirmButtonColor: '#4f46e5'
            });
        }
    });

    // Init - Dont fetch events yet, wait for login
});
