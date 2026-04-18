// จุดที่ต้องแก้ไข 1: นำ URL จาก GAS Web App มาใส่ที่นี่
const API_URL = 'https://script.google.com/macros/s/AKfycbyCEK-E_yfblYhjL1iaWDskTAMTu2HWTzKbwbKZRTX0nWYmVDR0s6RoSNMyY6i5rwybkg/exec';
let appData = []; // เก็บข้อมูลทั้งหมด
let myChart = null;

document.addEventListener('DOMContentLoaded', () => {
    setDefaultDateTime();
    fetchData(); // ดึงข้อมูลตอนเปิดแอป

    document.getElementById('recordForm').addEventListener('submit', handleFormSubmit);
});

// กำหนดวันที่/เวลาปัจจุบันให้ Form
function setDefaultDateTime() {
    const now = new Date();
    document.getElementById('recordDate').value = now.toLocaleDateString('en-CA'); // format yyyy-mm-dd
    document.getElementById('recordTime').value = now.toTimeString().slice(0,5);
}

// สลับหน้าจอ (Tab Navigation)
function switchTab(tabName) {
    // ซ่อนทุกหน้า
    document.getElementById('view-form').classList.add('hidden-view');
    document.getElementById('view-history').classList.add('hidden-view');
    document.getElementById('view-dashboard').classList.add('hidden-view');
    
    // Reset สีปุ่ม
    ['form', 'history', 'dashboard'].forEach(t => {
        document.getElementById(`tab-${t}`).className = 'tab-inactive flex-1 py-3 text-center transition';
    });

    // แสดงหน้าที่เลือก
    document.getElementById(`view-${tabName}`).classList.remove('hidden-view');
    document.getElementById(`tab-${tabName}`).className = 'tab-active flex-1 py-3 text-center transition';

    // จัดการปุ่ม Export
    const exportBtn = document.getElementById('exportButtons');
    if (tabName === 'history' || tabName === 'dashboard') exportBtn.classList.remove('hidden');
    else exportBtn.classList.add('hidden');

    if (tabName === 'history') renderTable();
    if (tabName === 'dashboard') renderDashboard();
}

// ดึงข้อมูลหลักและการตั้งค่าจาก API
async function fetchData() {
    try {
        const res = await fetch(API_URL);
        const json = await res.json();
        if(json.status === 'success') {
            appData = json.data;
            populateDropdowns(json.settings);
        }
    } catch (error) {
        console.error("Fetch Error:", error);
    }
}

function populateDropdowns(settings) {
    const typeSelect = document.getElementById('measurementType');
    const contextSelect = document.getElementById('mealContext');
    
    typeSelect.innerHTML = '<option value="">เลือกช่วงเวลา...</option>';
    settings.types.forEach(t => typeSelect.innerHTML += `<option value="${t}">${t}</option>`);
    
    contextSelect.innerHTML = '<option value="-">ไม่ระบุ</option>';
    settings.contexts.forEach(c => contextSelect.innerHTML += `<option value="${c}">${c}</option>`);
}

// แปลงภาพเป็น Base64
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// บันทึกข้อมูล
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

        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await response.json();

        if(result.status === 'success') {
            Swal.fire({ title: 'สำเร็จ!', text: 'บันทึกข้อมูลเรียบร้อย', icon: 'success', confirmButtonColor: '#0d9488' });
            document.getElementById('recordForm').reset();
            setDefaultDateTime();
            fetchData(); // โหลดข้อมูลใหม่เข้าสู่ระบบ
        }
    } catch (error) {
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error');
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-check-circle"></i> บันทึกข้อมูล';
        btn.disabled = false;
    }
}

// สร้างตารางประวัติ (CRUD View)
function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    // เรียงจากใหม่ไปเก่า
    const sortedData = [...appData].sort((a,b) => new Date(b.RecordDate) - new Date(a.RecordDate));

    if(sortedData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">ไม่มีข้อมูล</td></tr>';
        return;
    }

    sortedData.forEach(row => {
        // จัดรูปแบบวันที่ให้อ่านง่าย
        const dateObj = new Date(row.RecordDate);
        const dateStr = `${dateObj.getDate()}/${dateObj.getMonth()+1}/${dateObj.getFullYear().toString().substr(-2)}`;
        
        let colorClass = parseInt(row.GlucoseLevel) > 130 ? 'text-red-600 font-bold' : 'text-teal-700';

        tbody.innerHTML += `
            <tr class="hover:bg-gray-50 transition">
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

function viewDetails(id) {
    const record = appData.find(r => r.ID === id);
    if(record) {
        Swal.fire({
            title: 'รายละเอียด',
            html: `
                <div class="text-left text-sm space-y-2 mt-4">
                    <p><b>ระดับน้ำตาล:</b> <span class="text-lg text-teal-600 font-bold">${record.GlucoseLevel} mg/dL</span></p>
                    <p><b>วัดเมื่อ:</b> ${record.RecordDate} ${record.RecordTime}</p>
                    <p><b>ประเภท:</b> ${record.MeasurementType} (${record.MealContext})</p>
                    <p><b>หมายเหตุ:</b> ${record.Notes || '-'}</p>
                </div>
            `,
            confirmButtonColor: '#0d9488'
        });
    }
}

// สร้าง Dashboard
function renderDashboard() {
    if(appData.length === 0) return;

    // หาค่าล่าสุด
    const sortedData = [...appData].sort((a,b) => new Date(b.RecordDate) - new Date(a.RecordDate));
    document.getElementById('latestValue').innerText = sortedData[0].GlucoseLevel;

    // หาค่าเฉลี่ย 7 วันล่าสุด (แบบง่าย)
    const recent = sortedData.slice(0, 7);
    const avg = recent.reduce((sum, r) => sum + parseInt(r.GlucoseLevel), 0) / recent.length;
    document.getElementById('avg7Days').innerText = Math.round(avg);

    // วาดกราฟ (สลับกลับมาเก่าไปใหม่เพื่อแสดงกราฟจากซ้ายไปขวา)
    const chartData = recent.reverse();
    const labels = chartData.map(r => r.RecordDate.split('T')[0].slice(-5)); // เอาแค่ MM-DD
    const values = chartData.map(r => parseInt(r.GlucoseLevel));

    const ctx = document.getElementById('glucoseChart').getContext('2d');
    if(myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'น้ำตาล (mg/dL)',
                data: values,
                borderColor: '#0d9488', // สีหลัก
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
