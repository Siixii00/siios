import Router from '../../router.js';
import { createElement, createIcon, createToast } from '../../components.js';
import { HealthDB, UsersDB } from '../../db.js';
import { PeriodCalculator } from '../../core/period-calculator.js';

const SYMPTOM_TAGS = ['Cramps', 'Back pain', 'Headache', 'Fatigue', 'Bloating', 'Mood swings', 'Appetite changes', 'Insomnia', 'Breast tenderness'];
const MOOD_TAGS = ['Irritable', 'Low mood', 'Anxious', 'Sensitive', 'Tired', 'Cravings'];

let currentUser = null;
let memoryTemplate = null;

async function renderHealth(params) {
    const users = await UsersDB.getAll();
    currentUser = users[0];
    
    if (currentUser) {
        memoryTemplate = await HealthDB.getMemoryTemplate(currentUser.id);
    }
    
    const container = createElement('div', 'app-container');
    
    container.innerHTML = `
        <header class='ios-header'>
            <button class='ios-back-btn'>
                <span class='material-symbols-outlined'>chevron_left</span> Back
            </button>
            <h1>Health Management</h1>
        </header>
        
        <div class='health-content'>
            <section class='health-section'>
                <h2>Health Memory</h2>
                <p class='section-desc'>Record your symptoms. Characters will care naturally based on their personality.</p>
                
                <div class='memory-card'>
                    <h3>Period Symptoms</h3>
                    <div class='tag-container' id='symptom-tags'></div>
                </div>
                
                <div class='memory-card'>
                    <h3>Mood Changes</h3>
                    <div class='tag-container' id='mood-tags'></div>
                </div>
                
                <button class='save-btn' id='save-memory'>Save Memory Template</button>
            </section>
            
            <section class='health-section'>
                <h2>Period Records</h2>
                <div class='period-calendar' id='period-calendar'></div>
                
                <button class='add-btn' id='add-period'>Add Period Record</button>
            </section>
            
            <section class='health-section'>
                <h2>Medication Records</h2>
                <div class='medication-list' id='medication-list'>
                    <p class='empty-msg'>No medication records</p>
                </div>
                <button class='add-btn' id='add-medication'>Add Medication</button>
            </section>
        </div>
    `;
    
    const backBtn = container.querySelector('.ios-back-btn');
    backBtn.onclick = () => Router.back();
    
    renderSymptomTags(container);
    renderMoodTags(container);
    renderPeriodCalendar(container);
    renderMedicationList(container);
    
    container.querySelector('#save-memory').onclick = async () => {
        if (!currentUser) {
            createToast('Please create a user mask first', 'error');
            return;
        }
        
        const symptoms = [];
        container.querySelectorAll('#symptom-tags .tag.active').forEach(tag => {
            symptoms.push(tag.textContent);
        });
        
        const moods = [];
        container.querySelectorAll('#mood-tags .tag.active').forEach(tag => {
            moods.push(tag.textContent);
        });
        
        await HealthDB.saveMemoryTemplate({
            user_id: currentUser.id,
            period_symptoms: symptoms,
            period_mood_changes: moods
        });
        
        memoryTemplate = await HealthDB.getMemoryTemplate(currentUser.id);
        createToast('Health memory saved');
    };
    
    container.querySelector('#add-period').onclick = () => showAddPeriodDialog(container);
    container.querySelector('#add-medication').onclick = () => showAddMedicationDialog(container);
    
    return { element: container, cleanup: null };
}

function renderSymptomTags(container) {
    const tagContainer = container.querySelector('#symptom-tags');
    tagContainer.innerHTML = '';
    
    SYMPTOM_TAGS.forEach(tag => {
        const el = createElement('span', 'tag' + (memoryTemplate?.period_symptoms?.includes(tag) ? ' active' : ''));
        el.textContent = tag;
        el.onclick = () => el.classList.toggle('active');
        tagContainer.appendChild(el);
    });
}

function renderMoodTags(container) {
    const tagContainer = container.querySelector('#mood-tags');
    tagContainer.innerHTML = '';
    
    MOOD_TAGS.forEach(tag => {
        const el = createElement('span', 'tag' + (memoryTemplate?.period_mood_changes?.includes(tag) ? ' active' : ''));
        el.textContent = tag;
        el.onclick = () => el.classList.toggle('active');
        tagContainer.appendChild(el);
    });
}

async function renderPeriodCalendar(container) {
    const calendarEl = container.querySelector('#period-calendar');
    if (!currentUser) {
        calendarEl.innerHTML = '`<p class=`'`empty-msg`'`>Please create a user mask first</p>`';
        return;
    }
    
    const periods = await HealthDB.getRecentPeriods(currentUser.id, 12);
    const prediction = await PeriodCalculator.calculateNextPeriod(currentUser.id);
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    let html = '<div class='calendar-header'>';
    html += '<span>' + year + ' / ' + (month + 1) + '</span>';
    html += '</div>';
    html += '<div class='calendar-grid'>';
    html += '<div class='calendar-row header'><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>';
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    html += '<div class='calendar-row'>';
    for (let i = 0; i < firstDay; i++) {
        html += '<span class='empty'></span>';
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const timestamp = date.getTime();
        let classes = '';
        
        const isPeriod = periods.some(p => {
            const start = p.start_date;
            const end = p.end_date || start + 5 * 24 * 60 * 60 * 1000;
            return timestamp >= start && timestamp <= end;
        });
        
        if (isPeriod) classes = 'period';
        
        if (prediction && prediction.days_until >= 0) {
            const predictedDate = new Date(prediction.predicted_date);
            if (date.toDateString() === predictedDate.toDateString()) {
                classes = 'predicted';
            }
        }
        
        html += '<span class='' + classes + ''>' + day + '</span>';
        
        if ((day + firstDay) % 7 === 0 && day < daysInMonth) {
            html += '</div><div class='calendar-row'>';
        }
    }
    
    html += '</div></div>';
    
    html += '<div class='calendar-legend'>';
    html += '<span><span class='legend-dot period'></span> Period</span>';
    html += '<span><span class='legend-dot predicted'></span> Predicted</span>';
    html += '</div>';
    
    if (prediction) {
        html += '<div class='prediction-info'>Next period: ' + prediction.days_until + ' day(s)</div>';
    }
    
    calendarEl.innerHTML = html;
}

async function renderMedicationList(container) {
    const listEl = container.querySelector('#medication-list');
    if (!currentUser) {
        listEl.innerHTML = '`<p class=`'`empty-msg`'`>Please create a user mask first</p>`';
        return;
    }
    
    const medications = await HealthDB.getByType(currentUser.id, 'medication');
    
    if (medications.length === 0) {
        listEl.innerHTML = '`<p class=`'`empty-msg`'`>No medication records</p>`';
        return;
    }
    
    listEl.innerHTML = medications.map(med => `
        <div class='medication-item'>
            <div class='med-info'>
                <span class='med-name'>${med.medication_name}</span>
                <span class='med-dosage'>${med.dosage}</span>
            </div>
            <button class='delete-btn' data-id='${med.id}'>Delete</button>
        </div>
    `).join('');
    
    listEl.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = async () => {
            await HealthDB.delete(btn.dataset.id);
            renderMedicationList(container);
            createToast('Medication deleted');
        };
    });
}

function showAddPeriodDialog(container) {
    const dialog = createElement('div', 'dialog-overlay');
    dialog.innerHTML = `
        <div class='dialog'>
            <h3>Add Period Record</h3>
            <div class='form-group'>
                <label>Start Date</label>
                <input type='date' id='period-start'>
            </div>
            <div class='form-group'>
                <label>End Date (optional)</label>
                <input type='date' id='period-end'>
            </div>
            <div class='form-group'>
                <label>Notes</label>
                <textarea id='period-notes'></textarea>
            </div>
            <div class='dialog-btns'>
                <button class='cancel-btn'>Cancel</button>
                <button class='confirm-btn'>Save</button>
            </div>
        </div>
    `;
    
    dialog.querySelector('.cancel-btn').onclick = () => dialog.remove();
    dialog.querySelector('.confirm-btn').onclick = async () => {
        const start = dialog.querySelector('#period-start').value;
        const end = dialog.querySelector('#period-end').value;
        const notes = dialog.querySelector('#period-notes').value;
        
        if (!start) {
            createToast('Please select start date', 'error');
            return;
        }
        
        await HealthDB.createPeriod({
            user_id: currentUser.id,
            start_date: new Date(start).getTime(),
            end_date: end ? new Date(end).getTime() : null,
            notes
        });
        
        dialog.remove();
        renderPeriodCalendar(container);
        createToast('Period record saved');
    };
    
    container.appendChild(dialog);
}

function showAddMedicationDialog(container) {
    const dialog = createElement('div', 'dialog-overlay');
    dialog.innerHTML = `
        <div class='dialog'>
            <h3>Add Medication</h3>
            <div class='form-group'>
                <label>Medication Name</label>
                <input type='text' id='med-name' placeholder='e.g., Vitamin D'>
            </div>
            <div class='form-group'>
                <label>Dosage</label>
                <input type='text' id='med-dosage' placeholder='e.g., 1000 IU daily'>
            </div>
            <div class='form-group'>
                <label>Notes</label>
                <textarea id='med-notes'></textarea>
            </div>
            <div class='dialog-btns'>
                <button class='cancel-btn'>Cancel</button>
                <button class='confirm-btn'>Save</button>
            </div>
        </div>
    `;
    
    dialog.querySelector('.cancel-btn').onclick = () => dialog.remove();
    dialog.querySelector('.confirm-btn').onclick = async () => {
        const name = dialog.querySelector('#med-name').value.trim();
        const dosage = dialog.querySelector('#med-dosage').value.trim();
        const notes = dialog.querySelector('#med-notes').value;
        
        if (!name) {
            createToast('Please enter medication name', 'error');
            return;
        }
        
        await HealthDB.createMedication({
            user_id: currentUser.id,
            medication_name: name,
            dosage,
            notes
        });
        
        dialog.remove();
        renderMedicationList(container);
        createToast('Medication saved');
    };
    
    container.appendChild(dialog);
}

export default {
    id: 'health',
    name: 'Health',
    icon: 'favorite',
    routes: [{ path: '/health', render: renderHealth }],
    navItem: { label: 'Health', icon: 'favorite', path: '/health', showInNav: true, order: 30 },
    stylesPath: 'js/apps/health/style.css'
};