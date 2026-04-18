// จุดที่ต้องแก้ไข 1: นำ URL จาก GAS Web App มาใส่ที่นี่
const API_URL = 'https://script.google.com/macros/s/AKfycbyCEK-E_yfblYhjL1iaWDskTAMTu2HWTzKbwbKZRTX0nWYmVDR0s6RoSNMyY6i5rwybkg/exec';

document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
    
    document.getElementById('recordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSubmit');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';

        try {
            const formData = {
                glucoseLevel: document.getElementById('glucoseLevel').value,
                recordDate: new Date().toISOString().split('T')[0],
                recordTime: new Date().toTimeString().slice(0,5),
                // ใส่ Field อื่นๆ ตามต้องการ
            };

            // จัดการรูปภาพเป็น Base64
            const fileInput = document.getElementById('imageInput');
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const base64 = await toBase64(file);
                formData.imageBase64 = base64.split(',')[1];
                formData.imageName = `GLUCOSE_${new Date().getTime()}.jpg`;
            }

            // ส่งข้อมูลไป GAS
            const response = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            if(result.status === 'success') {
                alert('บันทึกสำเร็จ');
                document.getElementById('recordForm').reset();
                loadDashboardData(); // โหลดกราฟใหม่
            }
        } catch (error) {
            console.error('Error:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-save"></i> บันทึกข้อมูล';
        }
    });
});

// ฟังก์ชันแปลงรูปเป็น Base64
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// ฟังก์ชันดึงข้อมูลมาวาดกราฟ
async function loadDashboardData() {
    try {
        const response = await fetch(API_URL);
        const result = await response.json();
        
        if(result.status === 'success') {
            const data = result.data;
            // ดึง 7 รายการล่าสุดมาทำกราฟ
            const recentData = data.slice(-7); 
            
            const labels = recentData.map(r => r.RecordDate.split('T')[0]);
            const values = recentData.map(r => parseInt(r.GlucoseLevel));

            renderChart(labels, values);
        }
    } catch (error) {
        console.error('Failed to load data', error);
    }
}

let myChart = null;
function renderChart(labels, data) {
    const ctx = document.getElementById('glucoseChart').getContext('2d');
    if(myChart) myChart.destroy(); // ลบกราฟเก่าทิ้งก่อนวาดใหม่
    
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'ระดับน้ำตาล (mg/dL)',
                data: data,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
        }
    });
}
