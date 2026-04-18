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

// ปรับปรุงการ Fetch ให้จัดการ Error ได้ดีขึ้น
async function fetchData() {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error('Network response was not ok'); 
    
    const json = await res.json();
    if(json.status === 'success') {
        appData = json.data;
        populateDropdowns(json.settings);
    } else {
        throw new Error(json.message);
    }
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

function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    if(appData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">ไม่มีข้อมูล</td></tr>';
        return;
    }

    const sortedData = [...appData].sort((a,b) => new Date(b.RecordDate) - new Date(a.RecordDate));

    sortedData.forEach(row => {
        const dateObj = new Date(row.RecordDate);
        const dateStr = `${dateObj.getDate()}/${dateObj.getMonth()+1}/${dateObj.getFullYear().toString().substr(-2)}`;
        let colorClass = parseInt(row.GlucoseLevel) > 130 ? 'text-red-600 font-bold' : 'text-teal-700';

        tbody.innerHTML += `
            <tr class="hover:bg-gray-50 transition border-b border-gray-100">
                <td class="p-3 text-xs">
                    <div class="font-medium text-gray-700">${dateStr}</div>
                    <div class="text-gray-400">${row.RecordTime}</div>
                </td>
                <td class="p-3 ${colorClass}">${row.GlucoseLevel}</td>
                <td class="p-3 text-xs text-gray-600">${row.MeasurementType}</td>
                <td class="p-3">
                    <button onclick="viewDetails('${row.ID}')" class="text-teal-500 hover:bg-teal-100 p-2 rounded-full transition"><i class="fa-solid fa-eye"></i></button>
                </td>
            </tr>
        `;
    });
}

window.viewDetails = function(id) {
    const record = appData.find(r => r.ID === id);
    if(record) {
        Swal.fire({
            title: 'รายละเอียด',
            html: `
                <div class="text-left text-sm space-y-2 mt-4">
                    <p><b>ระดับน้ำตาล:</b> <span class="text-lg text-teal-600 font-bold">${record.GlucoseLevel} mg/dL</span></p>
                    <p><b>วัดเมื่อ:</b> ${record.RecordDate} ${record.RecordTime}</p>
                    <p><b>ประเภท:</b> ${record.MeasurementType} ${record.MealContext !== '-' ? `(${record.MealContext})` : ''}</p>
                    <p><b>หมายเหตุ:</b> ${record.Notes || '-'}</p>
                    ${record.ImageURL ? `<div class="mt-3"><a href="${record.ImageURL}" target="_blank" class="text-blue-500 underline"><i class="fa-solid fa-image"></i> ดูรูปภาพที่แนบ</a></div>` : ''}
                </div>
            `,
            confirmButtonColor: '#0d9488'
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
