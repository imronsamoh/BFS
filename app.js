// จุดที่ต้องแก้ไข 1: นำ URL จาก GAS Web App มาใส่ที่นี่
const API_URL = 'https://script.google.com/macros/s/AKfycbyCEK-E_yfblYhjL1iaWDskTAMTu2HWTzKbwbKZRTX0nWYmVDR0s6RoSNMyY6i5rwybkg/exec';


let appData = [];
let myChart = null;

document.addEventListener('DOMContentLoaded', () => {
    setDefaultDateTime();
    
    // เริ่มกระบวนการโหลดข้อมูลเมื่อเปิดแอป
    initApp();

    document.getElementById('recordForm').addEventListener('submit', handleFormSubmit);
});

// ฟังก์ชันควบคุม Splash Screen ตอนเปิดแอป
async function initApp() {
    const splash = document.getElementById('splashScreen');
    const status = document.getElementById('splashStatus');
    
    try {
        status.innerText = 'กำลังดาวน์โหลดข้อมูลล่าสุด...';
        
        // รอจนกว่าจะดึงข้อมูลเสร็จ
        await fetchData(); 
        
        status.innerText = 'เตรียมพร้อมใช้งาน!';
        status.classList.replace('bg-teal-800/30', 'bg-green-500/80'); // เปลี่ยนสีเป็นเขียวเมื่อเสร็จ
        
        // หน่วงเวลาเล็กน้อยให้ผู้ใช้เห็นว่าสำเร็จ แล้วค่อย Fade Out
        setTimeout(() => {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
            }, 500); // ระยะเวลา fade ให้ตรงกับ duration-500 ใน Tailwind
        }, 600);

    } catch (error) {
        status.innerHTML = '<span class="text-red-200"><i class="fa-solid fa-triangle-exclamation"></i> การเชื่อมต่อล้มเหลว กรุณารีเฟรชหน้าเว็บ</span>';
        status.classList.replace('bg-teal-800/30', 'bg-red-900/50');
    }
}


// ประกาศให้อยู่ใน Global Object (window) เพื่อให้ HTML มองเห็นเสมอ
window.switchTab = function(tabName) {
    // ซ่อนทุกหน้า
    document.getElementById('view-form').classList.add('hidden-view');
    document.getElementById('view-history').classList.add('hidden-view');
    document.getElementById('view-dashboard').classList.add('hidden-view');
    
    // Reset สีปุ่ม
    ['form', 'history', 'dashboard'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if(btn) btn.className = 'tab-inactive flex-1 py-3 text-center transition';
    });

    // แสดงหน้าที่เลือก
    document.getElementById(`view-${tabName}`).classList.remove('hidden-view');
    const activeBtn = document.getElementById(`tab-${tabName}`);
    if(activeBtn) activeBtn.className = 'tab-active flex-1 py-3 text-center transition';

    // จัดการปุ่ม Export
    const exportBtn = document.getElementById('exportButtons');
    if (tabName === 'history' || tabName === 'dashboard') {
        exportBtn.classList.remove('hidden');
    } else {
        exportBtn.classList.add('hidden');
    }

    if (tabName === 'history') renderTable();
    if (tabName === 'dashboard') renderDashboard();
};

function setDefaultDateTime() {
    const now = new Date();
    document.getElementById('recordDate').value = now.toLocaleDateString('en-CA');
    document.getElementById('recordTime').value = now.toTimeString().slice(0,5);
}



// อัปเดตฟังก์ชันเติม Dropdown ให้จัดการกรณีว่างเปล่าได้
function populateDropdowns(settings) {
    const typeSelect = document.getElementById('measurementType');
    const contextSelect = document.getElementById('mealContext');
    
    typeSelect.innerHTML = '<option value="">เลือกช่วงเวลา...</option>';
    contextSelect.innerHTML = '<option value="-">ไม่ระบุ</option>';

    if(!settings) return;

    if(settings.types && settings.types.length > 0) {
        settings.types.forEach(t => typeSelect.innerHTML += `<option value="${t}">${t}</option>`);
    } else {
        typeSelect.innerHTML += `<option value="ก่อนอาหาร">ก่อนอาหาร (ค่าเริ่มต้น)</option>`;
    }
    
    if(settings.contexts && settings.contexts.length > 0) {
        settings.contexts.forEach(c => contextSelect.innerHTML += `<option value="${c}">${c}</option>`);
    }
}

// ฟังก์ชันสำหรับเพิ่มตัวเลือกใหม่ (เรียกใช้เมื่อกดปุ่ม +)
window.addNewOption = async function(type) {
    const titleText = type === 'MeasurementType' ? 'เพิ่ม "ช่วงเวลาที่วัด" ใหม่' : 'เพิ่ม "บริบทมื้ออาหาร" ใหม่';
    
    const { value: newValue } = await Swal.fire({
        title: titleText,
        input: 'text',
        inputPlaceholder: 'พิมพ์ตัวเลือกใหม่ที่นี่...',
        showCancelButton: true,
        confirmButtonText: 'บันทึกตัวเลือก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#0d9488',
        inputValidator: (value) => {
            if (!value) {
                return 'กรุณาระบุข้อมูล!';
            }
        }
    });

    if (newValue) {
        Swal.fire({
            title: 'กำลังบันทึก...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'addSetting',
                    settingType: type,
                    settingValue: newValue.trim()
                })
            });
            
            const result = await response.json();

            if (result.status === 'success') {
                Swal.fire('สำเร็จ', 'เพิ่มตัวเลือกแล้ว', 'success');
                fetchData(); // โหลดข้อมูล Dropdown มาใหม่จาก Sheet ทันที
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเพิ่มตัวเลือกได้', 'error');
            console.error(error);
        }
    }
};

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

async function handleFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmit');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';
    btn.disabled = true;

    try {
        const payload = {
            action: 'create',
            recordDate: document.getElementById('recordDate').value,
            recordTime: document.getElementById('recordTime').value,
            glucoseLevel: document.getElementById('glucoseLevel').value,
            measurementType: document.getElementById('measurementType').value,
            mealContext: document.getElementById('mealContext').value,
            notes: document.getElementById('notes').value
        };

        const fileInput = document.getElementById('imageInput');
        if (fileInput.files.length > 0) {
            const base64 = await toBase64(fileInput.files[0]);
            payload.imageBase64 = base64.split(',')[1];
            payload.imageName = `IMG_${Date.now()}.jpg`;
        }

        // ใช้ Content-Type text/plain เพื่อป้องกันการเกิด Preflight (OPTIONS) request ที่มักจะติด CORS ใน GAS
        const response = await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();

        if(result.status === 'success') {
            Swal.fire({ title: 'สำเร็จ!', text: 'บันทึกข้อมูลเรียบร้อย', icon: 'success', confirmButtonColor: '#0d9488' });
            document.getElementById('recordForm').reset();
            setDefaultDateTime();
            fetchData(); 
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error("Save Error:", error);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้: ' + error.message, 'error');
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-check-circle"></i> บันทึกข้อมูล';
        btn.disabled = false;
    }
}

// ฟังก์ชันตัวช่วยสำหรับแปลงวันที่และเวลาให้อ่านง่าย
function formatThaiDateTime(rawDate, rawTime) {
    let fDate = rawDate;
    let fTime = rawTime;

    try {
        // จัดการวันที่ (แปลงเป็น 17 เม.ย. 2569)
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
            fDate = d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
        }
        
        // จัดการเวลา (ล้างค่า 1899-12-30 และเติมคำว่า น.)
        if (rawTime.includes('T')) {
            const t = new Date(rawTime);
            fTime = t.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
        } else {
            // กรณีเป็น String ปกติ เช่น "17:00:00" ให้ตัดเหลือ "17:00"
            fTime = rawTime.substring(0, 5) + ' น.';
        }
    } catch (e) {
        console.error("Date format error:", e);
    }

    return { date: fDate, time: fTime };
}



// ฟังก์ชันแสดงรูปใหญ่เต็มจอ
window.showFullImage = function(url) {
    Swal.fire({
        imageUrl: url,
        imageAlt: 'Glucose Meter Result',
        showCloseButton: true,
        showConfirmButton: false,
        background: 'transparent',
        customClass: {
            image: 'rounded-2xl shadow-2xl max-h-[80vh] w-auto'
        }
    });
};

// อัปเดต Popup ให้ดูสะอาดตาและอ่านง่าย
window.viewDetails = function(id) {
    const record = appData.find(r => r.ID === id);
    if(record) {
        const { date, time } = formatThaiDateTime(record.RecordDate, record.RecordTime);
        
        let contextText = record.MealContext && record.MealContext !== '-' ? `<span class="bg-teal-50 text-teal-700 px-2 py-1 rounded text-xs ml-2">${record.MealContext}</span>` : '';

        Swal.fire({
            title: 'รายละเอียดการวัด',
            html: `
                <div class="text-left text-sm space-y-4 mt-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div class="flex justify-between items-center border-b border-gray-200 pb-2">
                        <span class="text-gray-500">ระดับน้ำตาล</span>
                        <span class="text-2xl text-teal-600 font-bold">${record.GlucoseLevel} <span class="text-sm font-normal text-gray-500">mg/dL</span></span>
                    </div>
                    
                    <div class="flex flex-col gap-1">
                        <div class="flex justify-between">
                            <span class="text-gray-500"><i class="fa-regular fa-calendar text-teal-500 w-5"></i> วันที่</span>
                            <span class="font-medium text-gray-800">${date}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-500"><i class="fa-regular fa-clock text-teal-500 w-5"></i> เวลา</span>
                            <span class="font-medium text-gray-800">${time}</span>
                        </div>
                    </div>

                    <div class="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                        <p class="text-gray-500 text-xs mb-1">ช่วงเวลาที่วัด</p>
                        <p class="font-medium text-gray-800">${record.MeasurementType} ${contextText}</p>
                    </div>

                    ${record.Notes ? `
                    <div class="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-yellow-800">
                        <p class="text-xs text-yellow-600 mb-1"><i class="fa-solid fa-pen"></i> หมายเหตุ</p>
                        <p>${record.Notes}</p>
                    </div>` : ''}

                    ${record.ImageURL ? `
                    <a href="${record.ImageURL}" target="_blank" class="block w-full text-center bg-blue-50 hover:bg-blue-100 text-blue-600 py-2 rounded-lg transition border border-blue-100 mt-2">
                        <i class="fa-solid fa-image"></i> ดูรูปภาพที่แนบ
                    </a>` : ''}
                </div>
            `,
            confirmButtonColor: '#0d9488',
            confirmButtonText: 'ปิดหน้าต่าง'
        });
    }
};

function renderDashboard() {
    if(appData.length === 0) return;

    const sortedData = [...appData].sort((a,b) => new Date(b.RecordDate) - new Date(a.RecordDate));
    document.getElementById('latestValue').innerText = sortedData[0].GlucoseLevel;

    const recent = sortedData.slice(0, 7);
    const avg = recent.reduce((sum, r) => sum + parseInt(r.GlucoseLevel), 0) / recent.length;
    document.getElementById('avg7Days').innerText = Math.round(avg);

    const chartData = recent.reverse();
    const labels = chartData.map(r => r.RecordDate.split('T')[0].slice(-5));
    const values = chartData.map(r => parseInt(r.GlucoseLevel));

    const ctx = document.getElementById('glucoseChart');
    if(!ctx) return;
    
    if(myChart) myChart.destroy();
    myChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'น้ำตาล (mg/dL)',
                data: values,
                borderColor: '#0d9488',
                backgroundColor: 'rgba(13, 148, 136, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#0d9488',
                fill: true,
                tension: 0.4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}
// เก็บค่า Settings ไว้ใช้งานตอนกดปุ่มแก้ไข
window.globalSettings = { types: [], contexts: [] };

// โหลดข้อมูลผู้ป่วยจาก LocalStorage 
let patientProfile = JSON.parse(localStorage.getItem('patientProfile')) || { name: '', hn: '', age: '' };

// อัปเดตฟังก์ชัน fetchData เดิมนิดหน่อย ให้เก็บค่า Settings ทั่วโลก (Global) ด้วย
async function fetchData() {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error('Network response was not ok'); 
    const json = await res.json();
    if(json.status === 'success') {
        appData = json.data;
        window.globalSettings = json.settings; // เก็บไว้ใช้ตอนแก้ไข
        populateDropdowns(json.settings);
    } else {
        throw new Error(json.message);
    }
}

// ================= ฟังก์ชันจัดการข้อมูลผู้ป่วย =================
window.editPatientProfile = async function() {
    const { value: formValues } = await Swal.fire({
        title: 'ข้อมูลผู้ป่วย (Patient Profile)',
        html: `
            <div class="text-left text-sm space-y-3 mt-4">
                <div>
                    <label class="block text-gray-600 mb-1">ชื่อ-นามสกุล <span class="text-red-500">*</span></label>
                    <input id="swal-hn-name" class="w-full border border-gray-300 p-2.5 rounded-lg outline-none focus:border-teal-500" placeholder="ระบุชื่อผู้ป่วย" value="${patientProfile.name}">
                </div>
                <div>
                    <label class="block text-gray-600 mb-1">รหัสประจำตัวผู้ป่วย (HN)</label>
                    <input id="swal-hn-id" class="w-full border border-gray-300 p-2.5 rounded-lg outline-none focus:border-teal-500" placeholder="เช่น 66-001234" value="${patientProfile.hn}">
                </div>
                <div>
                    <label class="block text-gray-600 mb-1">อายุ (ปี)</label>
                    <input type="number" id="swal-hn-age" class="w-full border border-gray-300 p-2.5 rounded-lg outline-none focus:border-teal-500" placeholder="ระบุอายุ" value="${patientProfile.age}">
                </div>
                <p class="text-xs text-gray-400 mt-2"><i class="fa-solid fa-circle-info"></i> ข้อมูลนี้จะถูกบันทึกไว้ในเบราว์เซอร์ของคุณ และนำไปใช้พิมพ์รายงาน</p>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'บันทึกข้อมูล',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#0d9488',
        preConfirm: () => {
            const name = document.getElementById('swal-hn-name').value.trim();
            if(!name) { Swal.showValidationMessage('กรุณาระบุชื่อผู้ป่วย'); return false; }
            return {
                name: name,
                hn: document.getElementById('swal-hn-id').value,
                age: document.getElementById('swal-hn-age').value
            }
        }
    });

    if (formValues) {
        patientProfile = formValues;
        localStorage.setItem('patientProfile', JSON.stringify(patientProfile));
        Swal.fire('บันทึกสำเร็จ', 'อัปเดตข้อมูลผู้ป่วยเรียบร้อยแล้ว', 'success');
    }
};

// ================= ฟังก์ชันตาราง และ ปุ่ม Action =================
function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    if(appData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">ไม่มีข้อมูล</td></tr>';
        return;
    }

    const sortedData = [...appData].sort((a,b) => new Date(b.RecordDate) - new Date(a.RecordDate));

    sortedData.forEach(row => {
        const { date, time } = formatThaiDateTime(row.RecordDate, row.RecordTime);
        let colorClass = parseInt(row.GlucoseLevel) > 130 ? 'text-red-600 font-bold' : 'text-teal-700';
        
        const thumbHtml = row.ImageURL 
            ? `<img src="${row.ImageURL}" onclick="showFullImage('${row.ImageURL}')" class="w-10 h-10 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition mx-auto">`
            : `<span class="text-gray-300 text-xs">-</span>`;

        tbody.innerHTML += `
            <tr class="hover:bg-gray-50 transition border-b border-gray-100">
                <td class="p-3 text-xs">
                    <div class="font-medium text-gray-700">${date}</div>
                    <div class="text-gray-400">${time}</div>
                </td>
                <td class="p-3 ${colorClass} text-lg">${row.GlucoseLevel}</td>
                <td class="p-3 text-xs text-gray-600">${row.MeasurementType}</td>
                <td class="p-3 text-center">${thumbHtml}</td>
                <td class="p-3 text-center whitespace-nowrap">
                    <button onclick="viewDetails('${row.ID}')" class="text-teal-500 hover:bg-teal-100 p-2 rounded-full transition"><i class="fa-solid fa-eye"></i></button>
                    <button onclick="editRecord('${row.ID}')" class="text-orange-500 hover:bg-orange-100 p-2 rounded-full transition ml-1"><i class="fa-solid fa-pen-to-square"></i></button>
                </td>
            </tr>
        `;
    });
}

// ================= ฟังก์ชันแก้ไขข้อมูล (Update) =================
window.editRecord = async function(id) {
    const record = appData.find(r => r.ID === id);
    if(!record) return;

    // สร้างตัวเลือก Dropdown จาก Settings ที่มีอยู่
    const typeOpts = globalSettings.types.map(t => `<option value="${t}" ${record.MeasurementType === t ? 'selected' : ''}>${t}</option>`).join('');
    const contextOpts = `<option value="-">-</option>` + globalSettings.contexts.map(c => `<option value="${c}" ${record.MealContext === c ? 'selected' : ''}>${c}</option>`).join('');

    const { value: formValues } = await Swal.fire({
        title: 'แก้ไขข้อมูลการวัด',
        html: `
            <div class="text-left text-sm space-y-3 mt-4">
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="block text-gray-600 mb-1">วันที่</label>
                        <input type="date" id="editDate" class="w-full border p-2 rounded-lg" value="${record.RecordDate.split('T')[0]}">
                    </div>
                    <div>
                        <label class="block text-gray-600 mb-1">เวลา</label>
                        <input type="time" id="editTime" class="w-full border p-2 rounded-lg" value="${record.RecordTime.substring(0,5)}">
                    </div>
                </div>
                <div>
                    <label class="block text-gray-600 mb-1">ระดับน้ำตาล (mg/dL)</label>
                    <input type="number" id="editLevel" class="w-full border p-2 rounded-lg font-bold text-teal-600" value="${record.GlucoseLevel}">
                </div>
                <div>
                    <label class="block text-gray-600 mb-1">ช่วงเวลา</label>
                    <select id="editType" class="w-full border p-2 rounded-lg bg-white">${typeOpts}</select>
                </div>
                <div>
                    <label class="block text-gray-600 mb-1">บริบทมื้ออาหาร</label>
                    <select id="editContext" class="w-full border p-2 rounded-lg bg-white">${contextOpts}</select>
                </div>
                <div>
                    <label class="block text-gray-600 mb-1">หมายเหตุ</label>
                    <textarea id="editNotes" class="w-full border p-2 rounded-lg" rows="2">${record.Notes || ''}</textarea>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'บันทึกการแก้ไข',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#f97316', // สีส้ม
        preConfirm: () => {
            return {
                action: 'update',
                id: record.ID,
                recordDate: document.getElementById('editDate').value,
                recordTime: document.getElementById('editTime').value,
                glucoseLevel: document.getElementById('editLevel').value,
                measurementType: document.getElementById('editType').value,
                mealContext: document.getElementById('editContext').value,
                notes: document.getElementById('editNotes').value
            }
        }
    });

    if (formValues) {
        Swal.fire({ title: 'กำลังบันทึกการแก้ไข...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        try {
            const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(formValues) });
            const result = await response.json();
            if (result.status === 'success') {
                Swal.fire('สำเร็จ', 'อัปเดตข้อมูลเรียบร้อยแล้ว', 'success');
                initApp(); // โหลดข้อมูลมาแสดงใหม่
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกได้', 'error');
        }
    }
};

// ================= อัปเดตส่วนรายงาน PDF (ให้ดึงชื่อคนไข้มาใช้) =================
// ในส่วนของฟังก์ชัน exportToPDF() ให้แก้ไขบรรทัดข้อมูลคนไข้เป็นแบบนี้ครับ:
/* <div class="header">
        <h1>รายงานระดับน้ำตาลในเลือด (GlucoTrack)</h1>
        <p>ผู้ป่วย: <b>${patientProfile.name || 'ไม่ระบุชื่อ'}</b> 
        ${patientProfile.hn ? ` | HN: ${patientProfile.hn}` : ''} 
        ${patientProfile.age ? ` | อายุ: ${patientProfile.age} ปี` : ''} 
        | วันที่ออกรายงาน: ${now}</p>
    </div>
*/

// --- ส่วนของ Export PDF สำหรับแพทย์ ---
window.exportToPDF = function() {
    // 1. เตรียมข้อมูลสถิติ
    const levels = appData.map(r => parseInt(r.GlucoseLevel));
    const avg = Math.round(levels.reduce((a,b) => a+b, 0) / levels.length);
    const max = Math.max(...levels);
    const min = Math.min(...levels);
    const now = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    // 2. เรียงข้อมูลจากใหม่ไปเก่า
    const sortedData = [...appData].sort((a,b) => new Date(b.RecordDate) - new Date(a.RecordDate));

    // 3. สร้างเนื้อหา HTML สำหรับรายงาน
    let reportContent = `
    <html>
    <head>
        <title>รายงานระดับน้ำตาล - GlucoTrack</title>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
        <style>
            body { font-family: 'Sarabun', sans-serif; padding: 40px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0d9488; padding-bottom: 10px; }
            .header h1 { color: #0d9488; margin: 0; }
            .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
            .summary-box { background: #f0fdfa; padding: 15px; border-radius: 10px; text-align: center; border: 1px solid #ccfbf1; }
            .summary-box small { color: #666; font-size: 12px; }
            .summary-box div { font-size: 20px; font-weight: bold; color: #0d9488; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
            th { background-color: #0d9488; color: white; padding: 12px; text-align: left; }
            td { border-bottom: 1px solid #eee; padding: 10px; }
            .high { color: #e11d48; font-weight: bold; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #999; }
            @media print {
                body { padding: 0; }
                button { display: none; }
            }
        </style>
    </head>
    <body>
        <div class="header">
        <h1>รายงานระดับน้ำตาลในเลือด (GlucoTrack)</h1>
        <p>ผู้ป่วย: <b>${patientProfile.name || 'ไม่ระบุชื่อ'}</b> 
        ${patientProfile.hn ? ` | HN: ${patientProfile.hn}` : ''} 
        ${patientProfile.age ? ` | อายุ: ${patientProfile.age} ปี` : ''} 
        | วันที่ออกรายงาน: ${now}</p>
    </div>

        <div class="summary-grid">
            <div class="summary-box"><small>ค่าเฉลี่ย</small><div>${avg} <small>mg/dL</small></div></div>
            <div class="summary-box"><small>สูงสุด</small><div>${max} <small>mg/dL</small></div></div>
            <div class="summary-box"><small>ต่ำสุด</small><div>${min} <small>mg/dL</small></div></div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>วันที่</th>
                    <th>เวลา</th>
                    <th>ระดับน้ำตาล</th>
                    <th>ช่วงเวลา / บริบท</th>
                    <th>หมายเหตุ</th>
                </tr>
            </thead>
            <tbody>
    `;

    sortedData.forEach(row => {
        const { date, time } = formatThaiDateTime(row.RecordDate, row.RecordTime);
        const isHigh = parseInt(row.GlucoseLevel) > 130 ? 'class="high"' : '';
        const meal = row.MealContext && row.MealContext !== '-' ? `(${row.MealContext})` : '';

        reportContent += `
            <tr>
                <td>${date}</td>
                <td>${time}</td>
                <td ${isHigh}>${row.GlucoseLevel} mg/dL</td>
                <td>${row.MeasurementType} ${meal}</td>
                <td>${row.Notes || '-'}</td>
            </tr>
        `;
    });

    reportContent += `
            </tbody>
        </table>
        <div class="footer">
            รายงานนี้สร้างโดยอัตโนมัติจากแอปพลิเคชัน GlucoTrack
        </div>
        <script>
            window.onload = function() { 
                window.print(); 
                // สำหรับมือถือให้ปิดหน้าต่างหลังจากพิมพ์เสร็จ
                window.onafterprint = function() { window.close(); };
            }
        </script>
    </body>
    </html>
    `;

    // 4. เปิดหน้าต่างใหม่และเขียน Content ลงไป
    const printWindow = window.open('', '_blank');
    printWindow.document.open();
    printWindow.document.write(reportContent);
    printWindow.document.close();
};

// --- ส่วนของ Export Excel ---
window.exportToExcel = function() {
    // จัดระเบียบข้อมูลใหม่สำหรับ Excel ให้แพทย์อ่านง่าย
    const excelData = appData.map(r => {
        const { date, time } = formatThaiDateTime(r.RecordDate, r.RecordTime);
        return {
            "วันที่": date,
            "เวลา": time,
            "ระดับน้ำตาล (mg/dL)": r.GlucoseLevel,
            "ช่วงเวลาที่วัด": r.MeasurementType,
            "บริบทมื้ออาหาร": r.MealContext,
            "หมายเหตุ": r.Notes
        };
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "รายงานค่าน้ำตาล");
    XLSX.writeFile(wb, `Glucose_Data_IMRON_${Date.now()}.xlsx`);
};
