document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const tabVote = document.getElementById('tab-vote');
    const tabResults = document.getElementById('tab-results');
    const sheetTabsContainer = document.getElementById('sheetTabs');
    const viewVote = document.getElementById('view-vote');
    const viewResults = document.getElementById('view-results');

    // Layout
    const menuContainer = document.getElementById('menuContainer');
    const loadingSpinner = document.getElementById('loading');
    const notificationArea = document.getElementById('notificationArea');
    const eventTitleDisplay = document.getElementById('eventTitleDisplay');
    const eventMetaDisplay = document.getElementById('eventMetaDisplay');
    const resultsContent = document.getElementById('resultsContent');

    // Forms
    const voteForm = document.getElementById('voteForm');
    const voterNameInput = document.getElementById('voterName');

    // State
    let menuData = {};
    let sheetNames = [];
    let currentSheet = '';
    let currentTab = 'vote';
    const API_BASE = '/api';

    // URL Parameter parsing
    const urlParams = new URLSearchParams(window.location.search);
    const currentEventId = urlParams.get('eventId');

    if (!currentEventId) {
        document.getElementById('missingEventContainer').classList.remove('hidden');
        return; // Halt initialization
    } else {
        document.getElementById('mainAppContainer').classList.remove('hidden');
    }

    // Toggle Tabs (Vote vs Results)
    tabVote.addEventListener('click', () => switchTab('vote'));
    tabResults.addEventListener('click', () => switchTab('results'));

    function switchTab(tab) {
        currentTab = tab;
        notificationArea.classList.add('hidden');
        if (tab === 'vote') {
            tabVote.classList.add('active');
            tabResults.classList.remove('active');
            viewVote.classList.remove('hidden');
            viewResults.classList.add('hidden');
            if (currentSheet) renderMenuForSheet(currentSheet);
        } else {
            tabResults.classList.add('active');
            tabVote.classList.remove('active');
            viewResults.classList.remove('hidden');
            viewVote.classList.add('hidden');
            if (currentSheet) fetchResultsForSheet(currentSheet);
        }
    }

    function showNotification(msg, type) {
        notificationArea.textContent = msg;
        notificationArea.className = `notify-${type}`;
        notificationArea.classList.remove('hidden');
        setTimeout(() => {
            notificationArea.classList.add('hidden');
        }, 5000);
    }

    // Fetch Event Data & Menu
    async function loadEvent() {
        try {
            const res = await fetch(`${API_BASE}/events/${currentEventId}`);
            if (!res.ok) throw new Error('Failed to fetch event data');

            const eventData = await res.json();
            menuData = eventData.menuData || {};

            // Populate Header Metadata
            eventTitleDisplay.textContent = eventData.topic || '🍽️ Menu Voting';

            let metaParts = [];
            if (eventData.creatorName) metaParts.push(`👤 By: ${eventData.creatorName}`);
            if (eventData.date) metaParts.push(`📅 ${eventData.date}`);
            if (eventData.time) metaParts.push(`🕒 ${eventData.time}`);
            if (eventData.location) metaParts.push(`📍 ${eventData.location}`);

            if (metaParts.length > 0) {
                eventMetaDisplay.innerHTML = metaParts.map(p => `<span>${p}</span>`).join('');
                eventMetaDisplay.classList.remove('hidden');
            } else {
                eventMetaDisplay.classList.add('hidden');
            }

            // Check Status
            if (eventData.status === 'closed') {
                viewVote.innerHTML = `
                    <div style="text-align:center; padding: 3rem 1rem;">
                        <span style="font-size:3rem;">🛑</span>
                        <h2 style="color:var(--danger); margin: 1rem 0;">Voting is Closed</h2>
                        <p>The creator of this event has locked voting submissions. You can still view results.</p>
                    </div>`;
                loadingSpinner.classList.add('hidden');
                return; // Stop rendering menu form
            }

            sheetNames = Object.keys(menuData);

            if (sheetNames.length > 0) {
                currentSheet = sheetNames[0]; // default to first sheet
                buildSheetTabs();
                renderMenuForSheet(currentSheet);
                sheetTabsContainer.classList.remove('hidden');
            } else {
                menuContainer.innerHTML = '<p style="text-align:center; padding: 2rem;">No menu data available. Please ask the admin to configure the event.</p>';
            }

            loadUsersFromEvent(eventData.allowedVoters || []);

            loadingSpinner.classList.add('hidden');
            voteForm.classList.remove('hidden');
        } catch (err) {
            console.error(err);
            showNotification('Error loading event details. Is the server running?', 'error');
            loadingSpinner.classList.add('hidden');
        }
    }

    // Load Users from Event Object
    function loadUsersFromEvent(usersList) {
        voterNameInput.innerHTML = '<option value="" disabled selected>-- Please select your name --</option>';

        if (usersList.length === 0) {
            const opt = document.createElement('option');
            opt.value = "";
            opt.textContent = "No voters allowed by Admin yet";
            opt.disabled = true;
            voterNameInput.appendChild(opt);
            return;
        }

        usersList.forEach(user => {
            const opt = document.createElement('option');
            opt.value = user;
            opt.textContent = user;
            voterNameInput.appendChild(opt);
        });
    }

    // Build Sheet Toggle Buttons
    function buildSheetTabs() {
        sheetTabsContainer.innerHTML = '';
        sheetNames.forEach(sheet => {
            const btn = document.createElement('button');
            btn.className = `sheet-btn ${sheet === currentSheet ? 'active' : ''}`;
            btn.textContent = sheet;
            btn.addEventListener('click', () => switchSheet(sheet, btn));
            sheetTabsContainer.appendChild(btn);
        });
    }

    function switchSheet(sheet, btnElement) {
        if (currentSheet === sheet) return;
        currentSheet = sheet;

        document.querySelectorAll('.sheet-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = Array.from(document.querySelectorAll('.sheet-btn')).find(b => b.textContent === sheet);
        if (activeBtn) activeBtn.classList.add('active');

        if (currentTab === 'vote') {
            renderMenuForSheet(sheet);
            if (voterNameInput.value) {
                fetchAndPreFillUserVotes(); // Re-check if changing sheets
            }
        } else {
            fetchResultsForSheet(sheet);
        }
    }

    // --- Vote Pre-filling Logic --- //
    voterNameInput.addEventListener('change', fetchAndPreFillUserVotes);

    async function fetchAndPreFillUserVotes() {
        const name = voterNameInput.value;
        if (!name) return;

        try {
            const res = await fetch(`${API_BASE}/votes/${currentEventId}/${encodeURIComponent(name)}`);
            if (!res.ok) return; // Silent fail if not found or error
            const data = await res.json();

            if (data.success && data.votes && data.votes[currentSheet]) {
                const previousSelections = data.votes[currentSheet];
                preFillCheckboxes(previousSelections);
            } else {
                // No votes for this sheet, clear checkboxes
                document.querySelectorAll('.menu-item input').forEach(cb => cb.checked = false);
                document.querySelectorAll('.category-card').forEach(card => {
                    const limit = parseInt(card.getAttribute('data-limit'));
                    const checkboxes = card.querySelectorAll('input[type="checkbox"]');
                    enforceQuota(card, limit, checkboxes);
                });
            }
        } catch (err) {
            console.error("Error fetching previous votes", err);
        }
    }

    function preFillCheckboxes(selections) {
        // Clear all first
        document.querySelectorAll('.menu-item input').forEach(cb => cb.checked = false);

        // Check the ones previously selected
        Object.keys(selections).forEach(cat => {
            const items = selections[cat];
            items.forEach(itemName => {
                const checkbox = document.querySelector(`input[value="${itemName}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        });

        // Re-run quota enforcement for all categories
        document.querySelectorAll('.category-card').forEach(card => {
            const limit = parseInt(card.getAttribute('data-limit'));
            const checkboxes = card.querySelectorAll('input[type="checkbox"]');
            enforceQuota(card, limit, checkboxes);
        });
    }
    // ---------------------------- //

    // Render Menu Form Context
    function renderMenuForSheet(sheet) {
        menuContainer.innerHTML = '';
        const categories = menuData[sheet] || [];

        if (categories.length === 0) {
            menuContainer.innerHTML = '<p>No items found for this sheet.</p>';
            return;
        }

        categories.forEach((catObj, index) => {
            const catId = `cat_${index}`;
            const limit = catObj.quota;

            const categoryHTML = `
                <div class="category-card" data-category="${catObj.category}" data-limit="${limit}">
                    <div class="category-header">
                        <h3>${catObj.category}</h3>
                        <span class="quota-badge">Select up to ${limit}</span>
                    </div>
                    <div class="menu-items-list" id="${catId}">
                        ${catObj.items.map((item) => `
                            <label class="menu-item" aria-label="Select ${item}">
                                <input type="checkbox" name="${catObj.category}" value="${item}">
                                <span>${item}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = categoryHTML;
            const categoryNode = tempDiv.firstElementChild;

            const checkboxes = categoryNode.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                cb.addEventListener('change', () => enforceQuota(categoryNode, limit, checkboxes));
            });

            menuContainer.appendChild(categoryNode);
        });
    }

    function enforceQuota(categoryNode, limit, checkboxes) {
        const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;

        checkboxes.forEach(cb => {
            const label = cb.closest('.menu-item');
            if (!cb.checked && checkedCount >= limit) {
                cb.disabled = true;
                label.classList.add('disabled');
            } else {
                cb.disabled = false;
                label.classList.remove('disabled');
            }
        });
    }

    // Submit Vote
    voteForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const voterName = voterNameInput.value.trim();
        if (!voterName) {
            Swal.fire({
                title: 'Name Required',
                text: 'Please select your name first.',
                icon: 'warning',
                confirmButtonColor: '#4f46e5'
            });
            return;
        }

        const formData = new FormData(voteForm);
        const selections = {};
        const categories = menuData[currentSheet] || [];
        let allValid = true;

        categories.forEach(catObj => {
            const selectedItems = formData.getAll(catObj.category);
            if (selectedItems.length > 0) {
                selections[catObj.category] = selectedItems;
                // remove error styling if it was there
                const card = document.querySelector(`.category-card[data-category="${catObj.category}"]`);
                if (card) {
                    card.style.border = '1px solid rgba(0,0,0,0.05)';
                    card.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.05)';
                }
            } else {
                allValid = false;
                // Highlight the missing category card
                const card = document.querySelector(`.category-card[data-category="${catObj.category}"]`);
                if (card) {
                    card.style.border = '2px solid #ef4444';
                    card.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.3)';
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        });

        if (!allValid) {
            Swal.fire({
                title: 'Incomplete Selection',
                text: 'กรุณาเลือกเมนูให้ครบทุกหมวดหมู่',
                icon: 'warning',
                confirmButtonColor: '#ef4444'
            });
            return;
        }

        // Re-fetch categories from DOM to check limits, as formData doesn't enforce limits
        const domCategories = document.querySelectorAll('.category-card');
        let isValid = true;
        let errMsg = '';

        if (domCategories.length === 0) {
            showNotification('No items to vote for on this sheet.', 'error');
            return;
        }

        domCategories.forEach(catCard => {
            const catName = catCard.getAttribute('data-category');
            const limit = parseInt(catCard.getAttribute('data-limit'));

            const checkedBoxes = Array.from(catCard.querySelectorAll('input[type="checkbox"]:checked'));

            if (checkedBoxes.length === 0) {
                isValid = false;
                errMsg = `Please select at least one item from ${catName}`;
            }

            if (checkedBoxes.length > limit) {
                isValid = false;
                errMsg = `Too many items selected in ${catName}`;
            }

            selections[catName] = checkedBoxes.map(cb => cb.value);
        });

        if (!isValid) {
            showNotification(errMsg, 'error');
            return;
        }

        const submitBtn = voteForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            const res = await fetch(`${API_BASE}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId: currentEventId,
                    sheetName: currentSheet,
                    voterName: voterName,
                    selections: selections
                })
            });

            const data = await res.json();
            if (res.ok) {
                // Check if there is a next sheet
                const currentIndex = sheetNames.indexOf(currentSheet);
                const hasNextSheet = currentIndex !== -1 && currentIndex < sheetNames.length - 1;

                if (hasNextSheet) {
                    const nextSheet = sheetNames[currentIndex + 1];
                    Swal.fire({
                        title: 'Success!',
                        text: `ส่งผลโหวตสำหรับ ${currentSheet} เรียบร้อย ไปยังหน้าถัดไป...`,
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false
                    }).then(() => {
                        const nextBtn = Array.from(document.querySelectorAll('.sheet-btn')).find(b => b.textContent === nextSheet);
                        if (nextBtn) {
                            switchSheet(nextSheet, nextBtn);
                        }
                    });
                } else {
                    Swal.fire({
                        title: 'All Done!',
                        text: 'ส่งผลโหวตครบทุกหน้าเรียบร้อยแล้ว!',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false
                    }).then(() => {
                        switchTab('results');
                    });
                }
            } else {
                showNotification(data.error || 'Failed to submit vote.', 'error');
            }
        } catch (err) {
            console.error(err);
            Swal.fire({
                title: 'Error Submitting',
                text: 'Network error or system error: ' + err.message,
                icon: 'error',
                confirmButtonColor: '#ef4444'
            });
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Vote';
        }
    });

    // View Results
    async function fetchResultsForSheet(sheet) {
        resultsContent.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const res = await fetch(`${API_BASE}/results/${currentEventId}?sheet=${encodeURIComponent(sheet)}`);
            if (!res.ok) throw new Error('Failed to fetch results');
            const data = await res.json();

            renderResults(sheet, data);
        } catch (err) {
            console.error(err);
            resultsContent.innerHTML = `<p class="notify-error" style="padding:1rem;">Failed to load results.</p>`;
        }
    }

    function renderResults(sheet, data) {
        if (!data.votesList || data.votesList.length === 0) {
            resultsContent.innerHTML = '<p style="text-align:center; padding: 2rem;">No votes have been cast for this sheet yet. Be the first!</p>';
            return;
        }

        let html = `<p style="text-align:center; margin-bottom: 2rem; font-weight: 600;">Total Votes for ${sheet}: <span class="quota-badge" style="background:var(--primary-color); color:white;">${data.totalVotes}</span></p>`;

        const sheetCategories = menuData[sheet] || [];

        sheetCategories.forEach(catObj => {
            let catHTML = `<div class="result-category"><h3>${catObj.category}</h3>`;

            const sortedItems = [...catObj.items].sort((a, b) => {
                const countA = data.tally[a] || 0;
                const countB = data.tally[b] || 0;
                return countB - countA;
            });

            sortedItems.forEach(item => {
                const count = data.tally[item] || 0;
                const voters = data.votersByItem[item] || [];

                catHTML += `
                    <div class="result-item" style="${count === 0 ? 'opacity:0.6;' : ''}">
                        <div class="result-info">
                            <h4>${item}</h4>
                            <div class="voter-list">
                                ${count > 0 ? voters.join(', ') : 'No votes yet'}
                            </div>
                        </div>
                        <div class="vote-count-badge">
                            ${count}
                        </div>
                    </div>
                `;
            });
            catHTML += `</div>`;
            html += catHTML;
        });

        resultsContent.innerHTML = html;
    }

    // Init
    loadEvent();
});
