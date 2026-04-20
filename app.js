const SUPABASE_URL = 'https://dcsfwhnswhnpxpsduamp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjc2Z3aG5zd2hucHhwc2R1YW1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MzUxMzAsImV4cCI6MjA5MjIxMTEzMH0.zl6cVO9r9eU_77pEqtcEbWLno6nSB8wJ84HX8jPDC5M';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let appData = [];
window.globalSettings = { types: [], contexts: [] };
let patientProfile = { name: '', hn: '', age: '' }; // จะถูกโหลดจาก Database แทน
let myChart = null;

document.addEventListener('DOMContentLoaded', () => {
    setDefaultDateTime();
    initApp();
    document.getElementById('recordForm').addEventListener('submit', handleFormSubmit);
});

async function initApp() {
    const splash = document.getElementById('splashScreen');
    const status = document.getElementById('splashStatus');
    try {
        status.innerText = 'กำลังดาวน์โหลดข้อมูลล่าสุด...';
        await fetchData(); 
        status.innerText = 'เตรียมพร้อมใช้งาน!';
        status.classList.replace('bg-teal-800/30', 'bg-green-500/80'); 
        setTimeout(() => {
            splash.style.opacity = '0';
            setTimeout(() => { splash.style.display = 'none'; }, 500); 
        }, 600);
    } catch (error) {
        status.innerHTML = '<span class="text-red-200"><i class="fa-solid fa-triangle-exclamation"></i> การเชื่อมต่อล้มเหลว</span>';
        status.classList.replace('bg-teal-800/30', 'bg-red-900/50');
    }
}

window.switchTab = function(tabName) {
    document.getElementById('view-form').classList.add('hidden-view');
    document.getElementById('view-history').classList.add('hidden-view');
    document.getElementById('view-dashboard').classList.add('hidden-view');
    ['form', 'history', 'dashboard'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if(btn) btn.className = 'tab-inactive flex-1 py-3 text-center transition';
    });
    document.getElementById(`view-${tabName}`).classList.remove('hidden-view');
    const activeBtn = document.getElementById(`tab-${tabName}`);
    if(activeBtn) activeBtn.className = 'tab-active flex-1 py-3 text-center transition';

    const exportBtn = document.getElementById('exportButtons');
    if (tabName === 'history' || tabName === 'dashboard') exportBtn.classList.remove('hidden');
    else exportBtn.classList.add('hidden');

    if (tabName === 'history') renderTable();
    if (tabName === 'dashboard') renderDashboard();
};

function setDefaultDateTime() {
    const now = new Date();
    document.getElementById('recordDate').value = now.toLocaleDateString('en-CA');
    document.getElementById('recordTime').value = now.toTimeString().slice(0,5);
}

// 1. ฟังก์ชันล้างฟอร์ม (ตามคำขอ)
window.resetForm = function() {
    document.getElementById('recordForm').reset();
    setDefaultDateTime();
};

async function fetchData() {
    try {
        // ดึงโปรไฟล์ผู้ป่วยจาก DB
        const { data: profile_data } = await supabaseClient.from('patient_profile').select('*').eq('id', 1).single();
        if(profile_data) patientProfile = profile_data;

        // ดึง Settings
        const { data: set_data } = await supabaseClient.from('app_settings').select('*');
        window.globalSettings.types = set_data.filter(s => s.setting_type === 'MeasurementType').map(s => s.setting_value);
        window.globalSettings.contexts = set_data.filter(s => s.setting_type === 'MealContext').map(s => s.setting_value);
        populateDropdowns(window.globalSettings);

        // ดึงบันทึกข้อมูล
        const { data: rec_data } = await supabaseClient.from('glucose_records').select('*').order('record_date', { ascending: false }).order('record_time', { ascending: false });
        appData = rec_data.map(r => ({
            ID: r.id, RecordDate: r.record_date, RecordTime: r.record_time,
            GlucoseLevel: r.glucose_level, MeasurementType: r.measurement_type,
            MealContext: r.meal_context, Notes: r.notes, ImageURL: r.image_url
        }));
    } catch (error) {
        console.error("Supabase Error:", error);
    }
}

function populateDropdowns(settings) {
    const typeSelect = document.getElementById('measurementType');
    const contextSelect = document.getElementById('mealContext');
    typeSelect.innerHTML = '<option value="">เลือกช่วงเวลา...</option>';
    contextSelect.innerHTML = '<option value="-">ไม่ระบุ</option>';
    if(settings.types.length > 0) settings.types.forEach(t => typeSelect.innerHTML += `<option value="${t}">${t}</option>`);
    if(settings.contexts.length > 0) settings.contexts.forEach(c => contextSelect.innerHTML += `<option value="${c}">${c}</option>`);
}

window.addNewOption = async function(type) {
    const titleText = type === 'MeasurementType' ? 'เพิ่ม "ช่วงเวลาที่วัด" ใหม่' : 'เพิ่ม "บริบทมื้ออาหาร" ใหม่';
    const { value: newValue } = await Swal.fire({
        title: titleText, input: 'text', inputPlaceholder: 'พิมพ์ตัวเลือกใหม่...',
        showCancelButton: true, confirmButtonText: 'บันทึก', confirmButtonColor: '#0d9488',
        inputValidator: (value) => { if (!value) return 'กรุณาระบุข้อมูล!'; }
    });

    if (newValue) {
        Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        await supabaseClient.from('app_settings').insert([{ setting_type: type, setting_value: newValue.trim() }]);
        Swal.fire('สำเร็จ', 'เพิ่มตัวเลือกแล้ว', 'success');
        fetchData(); 
    }
};

// 2. ฟังก์ชันบีบอัดรูปภาพ (ลดขนาดไฟล์ก่อนอัพโหลด)
async function compressImage(file, maxWidth = 1024, quality = 0.7) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                }, 'image/jpeg', quality);
            };
        };
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmit');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';
    btn.disabled = true;

    try {
        let imageUrl = null;
        const fileInput = document.getElementById('imageInput');
        
        if (fileInput.files.length > 0) {
            const originalFile = fileInput.files[0];
            // ทำการบีบอัดรูปก่อนอัพโหลด
            const compressedFile = await compressImage(originalFile, 1024, 0.7); 
            const fileName = `IMG_${Date.now()}.jpg`;
            
            const { error: uploadError } = await supabaseClient.storage.from('glucose_images').upload(fileName, compressedFile);
            if(uploadError) throw uploadError;

            const { data } = supabaseClient.storage.from('glucose_images').getPublicUrl(fileName);
            imageUrl = data.publicUrl;
        }

        const insertData = {
            record_date: document.getElementById('recordDate').value,
            record_time: document.getElementById('recordTime').value,
            glucose_level: parseInt(document.getElementById('glucoseLevel').value),
            measurement_type: document.getElementById('measurementType').value,
            meal_context: document.getElementById('mealContext').value,
            notes: document.getElementById('notes').value,
            image_url: imageUrl
        };

        await supabaseClient.from('glucose_records').insert([insertData]);
        Swal.fire({ title: 'สำเร็จ!', text: 'บันทึกข้อมูลเรียบร้อย', icon: 'success', confirmButtonColor: '#0d9488' });
        resetForm(); // ใช้ฟังก์ชันเคลียร์ฟอร์ม
        fetchData(); 
        
    } catch (error) {
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error');
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-check-circle"></i> บันทึกข้อมูล';
        btn.disabled = false;
    }
}

// ฟังก์ชันลบข้อมูล (Delete)
// ================= ฟังก์ชันลบข้อมูล (อัปเดตใหม่: รีเฟรชหน้าจออัตโนมัติ) =================
window.deleteRecord = async function(id) {
    const result = await Swal.fire({
        title: 'ยืนยันการลบข้อมูล?',
        text: "คุณต้องการลบบันทึกนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444', 
        cancelButtonColor: '#9ca3af',
        confirmButtonText: 'ใช่, ลบข้อมูล',
        cancelButtonText: 'ยกเลิก',
        reverseButtons: true
    });

    if (result.isConfirmed) {
        Swal.fire({
            title: 'กำลังลบข้อมูล...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            // สั่งลบข้อมูลใน Supabase
            const { error } = await supabaseClient
                .from('glucose_records')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // โหลดข้อมูลล่าสุดจากฐานข้อมูลมาเก็บไว้ในตัวแปร appData
            await fetchData();

            // ✅ บังคับให้ระบบวาดหน้าจอ (Render) ใหม่ทันที
            renderTable();
            renderDashboard();

            // แสดงแจ้งเตือนสำเร็จแบบเนียนๆ (ปิดเองใน 1.5 วินาที)
            Swal.fire({
                title: 'ลบสำเร็จ!',
                text: 'ข้อมูลถูกลบออกจากระบบแล้ว',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });

        } catch (error) {
            console.error("Delete Error:", error);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถลบข้อมูลได้ในขณะนี้', 'error');
        }
    }
};

window.editRecord = async function(id) {
    const record = appData.find(r => r.ID === id);
    if(!record) return;

    const typeOpts = globalSettings.types.map(t => `<option value="${t}" ${record.MeasurementType === t ? 'selected' : ''}>${t}</option>`).join('');
    const contextOpts = `<option value="-">-</option>` + globalSettings.contexts.map(c => `<option value="${c}" ${record.MealContext === c ? 'selected' : ''}>${c}</option>`).join('');

    const { value: formValues } = await Swal.fire({
        title: 'แก้ไขข้อมูลการวัด',
        html: `
            <div class="text-left text-sm space-y-3 mt-4">
                <div class="grid grid-cols-2 gap-2">
                    <div><label class="block text-gray-600 mb-1">วันที่</label><input type="date" id="editDate" class="w-full border p-2 rounded-lg" value="${record.RecordDate}"></div>
                    <div><label class="block text-gray-600 mb-1">เวลา</label><input type="time" id="editTime" class="w-full border p-2 rounded-lg" value="${record.RecordTime.substring(0,5)}"></div>
                </div>
                <div><label class="block text-gray-600 mb-1">ระดับน้ำตาล</label><input type="number" id="editLevel" class="w-full border p-2 rounded-lg font-bold text-teal-600" value="${record.GlucoseLevel}"></div>
                <div><label class="block text-gray-600 mb-1">ช่วงเวลา</label><select id="editType" class="w-full border p-2 rounded-lg bg-white">${typeOpts}</select></div>
                <div><label class="block text-gray-600 mb-1">บริบทมื้ออาหาร</label><select id="editContext" class="w-full border p-2 rounded-lg bg-white">${contextOpts}</select></div>
                <div><label class="block text-gray-600 mb-1">หมายเหตุ</label><textarea id="editNotes" class="w-full border p-2 rounded-lg" rows="2">${record.Notes || ''}</textarea></div>
            </div>
        `,
        focusConfirm: false, showCancelButton: true, confirmButtonText: 'บันทึกการแก้ไข', confirmButtonColor: '#f97316', 
        preConfirm: () => {
            return {
                record_date: document.getElementById('editDate').value, record_time: document.getElementById('editTime').value,
                glucose_level: parseInt(document.getElementById('editLevel').value), measurement_type: document.getElementById('editType').value,
                meal_context: document.getElementById('editContext').value, notes: document.getElementById('editNotes').value
            }
        }
    });

    if (formValues) {
        Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        await supabaseClient.from('glucose_records').update(formValues).eq('id', record.ID);
        Swal.fire('สำเร็จ', 'อัปเดตข้อมูลเรียบร้อยแล้ว', 'success');
        fetchData(); 
    }
};

function formatThaiDateTime(rawDate, rawTime) {
    let fDate = rawDate, fTime = rawTime;
    try {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) { fDate = d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }); }
        if (rawTime.includes('T')) { fTime = new Date(rawTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'; } 
        else { fTime = rawTime.substring(0, 5) + ' น.'; }
    } catch (e) {}
    return { date: fDate, time: fTime };
}

window.showFullImage = function(url) {
    Swal.fire({ imageUrl: url, imageAlt: 'Image', showCloseButton: true, showConfirmButton: false, background: 'transparent', customClass: { image: 'rounded-2xl shadow-2xl max-h-[80vh] w-auto' } });
};

window.viewDetails = function(id) {
    const record = appData.find(r => r.ID === id);
    if(record) {
        const { date, time } = formatThaiDateTime(record.RecordDate, record.RecordTime);
        let contextText = record.MealContext && record.MealContext !== '-' ? `<span class="bg-teal-50 text-teal-700 px-2 py-1 rounded text-xs ml-2">${record.MealContext}</span>` : '';
        Swal.fire({
            title: 'รายละเอียด',
            html: `
                <div class="text-left text-sm space-y-4 mt-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div class="flex justify-between items-center border-b border-gray-200 pb-2">
                        <span class="text-gray-500">ระดับน้ำตาล</span><span class="text-2xl text-teal-600 font-bold">${record.GlucoseLevel} <span class="text-sm font-normal text-gray-500">mg/dL</span></span>
                    </div>
                    <div class="flex flex-col gap-1">
                        <div class="flex justify-between"><span class="text-gray-500"><i class="fa-regular fa-calendar text-teal-500 w-5"></i> วันที่</span><span class="font-medium text-gray-800">${date}</span></div>
                        <div class="flex justify-between"><span class="text-gray-500"><i class="fa-regular fa-clock text-teal-500 w-5"></i> เวลา</span><span class="font-medium text-gray-800">${time}</span></div>
                    </div>
                    <div class="bg-white p-3 rounded-lg border border-gray-100 shadow-sm"><p class="text-gray-500 text-xs mb-1">ช่วงเวลา</p><p class="font-medium text-gray-800">${record.MeasurementType} ${contextText}</p></div>
                    ${record.Notes ? `<div class="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-yellow-800"><p class="text-xs text-yellow-600 mb-1"><i class="fa-solid fa-pen"></i> หมายเหตุ</p><p>${record.Notes}</p></div>` : ''}
                    ${record.ImageURL ? `<a href="${record.ImageURL}" target="_blank" class="block w-full text-center bg-blue-50 hover:bg-blue-100 text-blue-600 py-2 rounded-lg transition mt-2"><i class="fa-solid fa-image"></i> ดูรูปภาพที่แนบ</a>` : ''}
                </div>
            `,
            confirmButtonColor: '#0d9488', confirmButtonText: 'ปิด'
        });
    }
};

// 3. ระบบอัปเดตข้อมูลผู้ป่วยเข้า Database
window.editPatientProfile = async function() {
    const { value: formValues } = await Swal.fire({
        title: 'ข้อมูลผู้ป่วย',
        html: `
            <div class="text-left text-sm space-y-3 mt-4">
                <div><label class="block text-gray-600 mb-1">ชื่อ-นามสกุล <span class="text-red-500">*</span></label><input id="swal-hn-name" class="w-full border p-2.5 rounded-lg outline-none focus:border-teal-500" value="${patientProfile.name || ''}"></div>
                <div><label class="block text-gray-600 mb-1">HN</label><input id="swal-hn-id" class="w-full border p-2.5 rounded-lg outline-none focus:border-teal-500" value="${patientProfile.hn || ''}"></div>
                <div><label class="block text-gray-600 mb-1">อายุ (ปี)</label><input type="number" id="swal-hn-age" class="w-full border p-2.5 rounded-lg outline-none focus:border-teal-500" value="${patientProfile.age || ''}"></div>
            </div>
        `,
        focusConfirm: false, showCancelButton: true, confirmButtonText: 'บันทึก', confirmButtonColor: '#0d9488',
        preConfirm: () => {
            const name = document.getElementById('swal-hn-name').value.trim();
            if(!name) { Swal.showValidationMessage('กรุณาระบุชื่อผู้ป่วย'); return false; }
            return { name, hn: document.getElementById('swal-hn-id').value, age: document.getElementById('swal-hn-age').value }
        }
    });

    if (formValues) {
        Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        // อัปเดตข้อมูลแถวที่ 1 ในตาราง patient_profile
        await supabaseClient.from('patient_profile').update(formValues).eq('id', 1);
        patientProfile = formValues; 
        Swal.fire('บันทึกสำเร็จ', 'อัปเดตข้อมูลผู้ป่วยเรียบร้อย', 'success');
    }
};

function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    if(appData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">ไม่มีข้อมูลบันทึก</td></tr>';
        return;
    }

    // เรียงลำดับจากใหม่ไปเก่า
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
                <td class="p-3 ${colorClass} text-lg font-semibold">${row.GlucoseLevel}</td>
                <td class="p-3 text-xs text-gray-600">${row.MeasurementType}</td>
                <td class="p-3 text-center">${thumbHtml}</td>
                <td class="p-3 text-center whitespace-nowrap">
                    <button onclick="viewDetails('${row.ID}')" class="text-teal-500 hover:bg-teal-100 p-2 rounded-full transition" title="ดูรายละเอียด">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button onclick="editRecord('${row.ID}')" class="text-orange-500 hover:bg-orange-100 p-2 rounded-full transition ml-1" title="แก้ไข">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button onclick="deleteRecord('${row.ID}')" class="text-red-500 hover:bg-red-100 p-2 rounded-full transition ml-1" title="ลบ">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

window.deleteRecord = async function(id) {
    const result = await Swal.fire({
        title: 'ยืนยันการลบข้อมูล?',
        text: "คุณต้องการลบบันทึกนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444', // สีแดงสำหรับการลบ
        cancelButtonColor: '#9ca3af',
        confirmButtonText: 'ใช่, ลบข้อมูล',
        cancelButtonText: 'ยกเลิก',
        reverseButtons: true
    });

    if (result.isConfirmed) {
        Swal.fire({
            title: 'กำลังลบข้อมูล...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            // คำสั่งลบจากตาราง glucose_records ใน Supabase
            const { error } = await supabaseClient
                .from('glucose_records')
                .delete()
                .eq('id', id);

            if (error) throw error;

            Swal.fire({
                title: 'ลบสำเร็จ!',
                text: 'ข้อมูลถูกลบออกจากระบบแล้ว',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });

            // โหลดข้อมูลใหม่เพื่ออัปเดตหน้าจอ
            await fetchData();
            renderTable();
            if (document.getElementById('view-dashboard').style.display !== 'none') {
                renderDashboard();
            }

        } catch (error) {
            console.error("Delete Error:", error);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถลบข้อมูลได้ในขณะนี้', 'error');
        }
    }
};

function renderDashboard() {
    if(appData.length === 0) return;
    const sortedData = [...appData].sort((a,b) => new Date(b.RecordDate) - new Date(a.RecordDate));
    document.getElementById('latestValue').innerText = sortedData[0].GlucoseLevel;
    const recent = sortedData.slice(0, 7);
    const avg = recent.reduce((sum, r) => sum + parseInt(r.GlucoseLevel), 0) / recent.length;
    document.getElementById('avg7Days').innerText = Math.round(avg);

    const typeStats = {};
    appData.forEach(r => {
        const type = r.MeasurementType || 'ไม่ระบุ';
        if(!typeStats[type]) typeStats[type] = { sum: 0, count: 0 };
        typeStats[type].sum += parseInt(r.GlucoseLevel);
        typeStats[type].count += 1;
    });

    const analysisContainer = document.getElementById('analysisByType');
    if (analysisContainer) {
        analysisContainer.innerHTML = ''; 
        const sortedTypes = Object.keys(typeStats).sort((a, b) => a.includes('Fasting') ? -1 : 0);
        sortedTypes.forEach(type => {
            const data = typeStats[type];
            const typeAvg = Math.round(data.sum / data.count);
            let colorClass = 'text-green-600', bgClass = 'bg-green-50';
            if (typeAvg > 130) { colorClass = 'text-red-500'; bgClass = 'bg-red-50'; } 
            else if (typeAvg < 70) { colorClass = 'text-orange-500'; bgClass = 'bg-orange-50'; }
            analysisContainer.innerHTML += `<div class="${bgClass} p-3 rounded-xl border border-gray-100 text-center shadow-sm"><p class="text-xs text-gray-500 mb-1 truncate">${type}</p><h4 class="text-xl font-bold ${colorClass}">${typeAvg}</h4><p class="text-[10px] text-gray-400 mt-1">จาก ${data.count} ครั้ง</p></div>`;
        });
    }

    const chartData = recent.reverse();
    const labels = chartData.map(r => formatThaiDateTime(r.RecordDate, r.RecordTime).date.split(' ')[0]);
    const values = chartData.map(r => parseInt(r.GlucoseLevel));

    const ctx = document.getElementById('glucoseChart');
    if(!ctx) return;
    if(myChart) myChart.destroy();
    myChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'น้ำตาล', data: values, borderColor: '#0d9488', backgroundColor: 'rgba(13, 148, 136, 0.1)', borderWidth: 2, pointBackgroundColor: '#0d9488', fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

window.exportToPDF = function() {
    const levels = appData.map(r => parseInt(r.GlucoseLevel));
    const avg = Math.round(levels.reduce((a,b) => a+b, 0) / levels.length);
    const max = Math.max(...levels);
    const min = Math.min(...levels);
    const now = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const sortedData = [...appData].sort((a,b) => new Date(b.RecordDate) - new Date(a.RecordDate));

    let reportContent = `
    <html>
    <head>
        <title>รายงานระดับน้ำตาล</title>
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
            @media print { body { padding: 0; } }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>รายงานระดับน้ำตาลในเลือด</h1>
            <p>ผู้ป่วย: <b>${patientProfile.name || 'ไม่ระบุชื่อ'}</b> ${patientProfile.hn ? ` | HN: ${patientProfile.hn}` : ''} ${patientProfile.age ? ` | อายุ: ${patientProfile.age} ปี` : ''} | พิมพ์เมื่อ: ${now}</p>
        </div>
        <div class="summary-grid">
            <div class="summary-box"><small>ค่าเฉลี่ย</small><div>${avg} <small>mg/dL</small></div></div>
            <div class="summary-box"><small>สูงสุด</small><div>${max} <small>mg/dL</small></div></div>
            <div class="summary-box"><small>ต่ำสุด</small><div>${min} <small>mg/dL</small></div></div>
        </div>
        <table>
            <thead><tr><th>วันที่</th><th>เวลา</th><th>ระดับน้ำตาล</th><th>ช่วงเวลา / บริบท</th><th>หมายเหตุ</th></tr></thead>
            <tbody>
    `;

    sortedData.forEach(row => {
        const { date, time } = formatThaiDateTime(row.RecordDate, row.RecordTime);
        const isHigh = parseInt(row.GlucoseLevel) > 130 ? 'class="high"' : '';
        const meal = row.MealContext && row.MealContext !== '-' ? `(${row.MealContext})` : '';
        reportContent += `<tr><td>${date}</td><td>${time}</td><td ${isHigh}>${row.GlucoseLevel} mg/dL</td><td>${row.MeasurementType} ${meal}</td><td>${row.Notes || '-'}</td></tr>`;
    });

    reportContent += `
            </tbody>
        </table>
        <div style="margin-top: 50px; text-align: center; border-top: 1px dashed #ccc; padding-top: 20px;">
            <p style="font-size: 12px; color: #666; margin-bottom: 5px;">รายงานนี้สร้างโดยอัตโนมัติจากแอปพลิเคชัน GlucoTrack</p>
            <p style="font-size: 14px; font-weight: bold; color: #0d9488; margin: 0;">ผู้พัฒนาระบบ: IMRON ADAM</p>
        </div>
        <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; }</script>
    </body>
    </html>
    `;
    const printWindow = window.open('', '_blank');
    printWindow.document.open();
    printWindow.document.write(reportContent);
    printWindow.document.close();
};

window.exportToExcel = function() {
    const excelData = appData.map(r => {
        const { date, time } = formatThaiDateTime(r.RecordDate, r.RecordTime);
        return { "วันที่": date, "เวลา": time, "ระดับน้ำตาล (mg/dL)": r.GlucoseLevel, "ช่วงเวลาที่วัด": r.MeasurementType, "บริบทมื้ออาหาร": r.MealContext, "หมายเหตุ": r.Notes };
    });
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "รายงานค่าน้ำตาล");
    XLSX.writeFile(wb, `Glucose_${Date.now()}.xlsx`);
};
