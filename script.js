/* =========================================================
   🍎 Nutrition Manager - Diet Plan Parser & Generator
   Training Manager Style
   ========================================================= */

// --- Constants & Globals ---
const $ = id => document.getElementById(id);

// Meal titles in order
const mealsOrder = [
    'وجبة الإفطار', 'الإفطار', 'الفطار',
    'وجبة خفيفة', 'سناك',
    'الغداء',
    'وجبة قبل التمرين', 'قبل التمرين',
    'وجبة بعد التمرين', 'بعد التمرين',
    'العشاء',
    'ملاحظات عامة', 'ملاحظات',
    'وجبة السحور', 'السحور'
];

// Meal icons mapping
const mealIcons = {
    'وجبة الإفطار': '🌅',
    'الإفطار': '🌅',
    'الفطار': '🌅',
    'وجبة خفيفة': '🍎',
    'سناك': '🍎',
    'الغداء': '🍽️',
    'وجبة قبل التمرين': '💪',
    'قبل التمرين': '💪',
    'وجبة بعد التمرين': '🏋️',
    'بعد التمرين': '🏋️',
    'العشاء': '🌙',
    'ملاحظات عامة': '📝',
    'ملاحظات': '📝',
    'وجبة السحور': '🌙',
    'السحور': '🌙'
};

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    // Set default input example
    if ($('inputText') && !$('inputText').value) {
        $('inputText').value = `وجبة الإفطار 3 بيضات مسلوقة + رغيف بلدي + خيار
وجبة خفيفة ثمرة تفاح + قهوة
الغداء 200جم صدور دجاج + 5 ملاعق أرز + سلطة
وجبة قبل التمرين موزة + قهوة
وجبة بعد التمرين علبة تونة + رغيف سن
العشاء جبنة قريش + طماطم
ملاحظات عامة عاش يا بطل، النظام ده هيساعدك تنشف وفي نفس الوقت تشبع، أهم حاجة الالتزام بالمواعيد.
سعرات
2000
بروتين
180
كارب
150
دهون
60`;
    }

    // Load API key
    loadApiKey();
    setMode('manual');

    // Check master file
    checkMasterFile();

    // Apply background for printing
    window.addEventListener('beforeprint', () => {
        const bgDataUrl = (typeof BG_DATA !== 'undefined') ? BG_DATA : null;
        if (bgDataUrl) {
            const pages = document.querySelectorAll('.page');
            pages.forEach(page => {
                page.style.setProperty('background-image', `url("${bgDataUrl}")`, 'important');
                page.style.setProperty('background-size', '100% 100%', 'important');
            });
        }
    });
});

// --- Diet Parsing Logic ---

function parseDietPlan(text) {
    // Keywords that should start a new line
    const keywords = [
        'وجبة الإفطار', 'الإفطار', 'الفطار',
        'وجبة خفيفة', 'سناك',
        'الغداء',
        'وجبة قبل التمرين', 'قبل التمرين',
        'وجبة بعد التمرين', 'بعد التمرين',
        'العشاء', 'ملاحظات عامة', 'ملاحظات', 'وجبة السحور', 'السحور',
        'سعرات', 'بروتين', 'كارب', 'كربوهيدرات', 'دهون'
    ];

    // Clean text and ensure keywords start on new lines
    let cleaned = text.replace(/^["""]|["""]$/g, '').trim();
    const pattern = new RegExp(`(^|\\s)(${keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
    cleaned = cleaned.replace(pattern, '\n$2');

    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
    const meals = [];
    const stats = {};
    let current = null;

    lines.forEach((line, idx) => {
        // Check if line starts with a meal title
        const matchedTitle = mealsOrder.find(m => line.startsWith(m));

        if (matchedTitle) {
            // Save previous meal
            if (current) meals.push(current);

            const isNotes = matchedTitle.includes('ملاحظات');
            current = {
                title: matchedTitle,
                items: '',
                isNotes: isNotes,
                icon: mealIcons[matchedTitle] || '🍴'
            };

            // Get content after the title
            let rest = line.substring(matchedTitle.length).trim();
            rest = rest.replace(/^[:\-]\s*/, ''); // Remove leading : or -

            if (rest) current.items += rest;
        }
        // Check for macros (سعرات، بروتين، كارب، دهون)
        else if (/^(سعرات|بروتين|كارب|كربوهيدرات|دهون)/.test(line)) {
            const key = line.includes('سعرات') ? 'calories'
                : line.includes('بروتين') ? 'protein'
                    : /كارب|كربوهيدرات/.test(line) ? 'carbs'
                        : 'fats';

            // Try to get number from same line
            const sameLineMatch = line.match(/\d+/);
            if (sameLineMatch) {
                stats[key] = sameLineMatch[0];
            } else {
                // Look at next line for the number
                const next = lines[idx + 1] || '';
                if (/^\d+$/.test(next)) {
                    stats[key] = next;
                }
            }
        }
        // Regular content for current meal
        else if (current) {
            // Skip standalone numbers that are macro values
            if (/^\d+$/.test(line) && lines[idx - 1] && /^(سعرات|بروتين|كارب|كربوهيدرات|دهون)/.test(lines[idx - 1])) {
                return;
            }
            current.items += (current.items ? '<br>' : '') + line;
        }
    });

    // Don't forget last meal
    if (current) meals.push(current);

    return { meals, stats };
}

// --- Rendering Logic ---

function render() {
    const text = $('inputText').value;
    const data = parseDietPlan(text);
    const output = $('output');
    output.innerHTML = '';

    // Separate notes from other meals
    const notes = data.meals.find(m => m.isNotes);
    const regularMeals = data.meals.filter(m => !m.isNotes);

    // 1. Render Notes Page (if notes exist)
    if (notes && notes.items.trim()) {
        const notesPage = document.createElement('div');
        notesPage.className = 'page notes-page';
        notesPage.innerHTML = `
            <h1>ملاحظات عامة 📝</h1>
            <div class="notes-content">
                ${notes.items.replace(/\n/g, '<br>')}
            </div>
        `;
        output.appendChild(notesPage);
    }

    // 2. Render Diet Page with meals and macros
    if (regularMeals.length > 0 || Object.keys(data.stats).length > 0) {
        const dietPage = document.createElement('div');
        dietPage.className = 'page diet-page';

        // Build meals HTML
        let mealsHtml = '';
        regularMeals.forEach(meal => {
            mealsHtml += `
                <div class="meal-card">
                    <h4>${meal.icon} ${meal.title}</h4>
                    <div class="meal-content">${meal.items}</div>
                </div>
            `;
        });

        // Build macros HTML
        const macrosHtml = `
            <div class="macros-container">
                <div class="macro-stat calories">
                    <span class="label">السعرات</span>
                    <span class="value">${data.stats.calories || '0'}</span>
                    <span class="unit">kcal</span>
                </div>
                <div class="macro-stat protein">
                    <span class="label">البروتين</span>
                    <span class="value">${data.stats.protein || '0'}</span>
                    <span class="unit">g</span>
                </div>
                <div class="macro-stat carbs">
                    <span class="label">الكارب</span>
                    <span class="value">${data.stats.carbs || '0'}</span>
                    <span class="unit">g</span>
                </div>
                <div class="macro-stat fats">
                    <span class="label">الدهون</span>
                    <span class="value">${data.stats.fats || '0'}</span>
                    <span class="unit">g</span>
                </div>
            </div>
        `;

        dietPage.innerHTML = `
            <div class="diet-header">
                <h2>🍎 النظام الغذائي</h2>
                <h3>Your Daily Nutrition Plan</h3>
            </div>
            <div class="meals-container">
                ${mealsHtml}
            </div>
            ${macrosHtml}
        `;
        output.appendChild(dietPage);
    }
}

function clearAll() {
    $('inputText').value = '';
    $('output').innerHTML = '';
}

// --- PDF Merge Logic ---

let masterPdfBytes = null;

async function checkMasterFile() {
    const statusEl = document.getElementById('masterStatus');

    try {
        const res = await fetch('Nutrition_Master.pdf');
        if (!res.ok) throw new Error('Not Found');
        masterPdfBytes = await res.arrayBuffer();
        statusEl.textContent = '✅ ملف Nutrition_Master.pdf جاهز';
        statusEl.style.color = '#00ff99';
    } catch (err) {
        statusEl.textContent = '⚠️ المتصفح منع تحميل الملف تلقائياً';
        statusEl.style.color = '#ffcc00';
    }
}

async function handleManualFile(input) {
    const statusEl = document.getElementById('masterStatus');
    const file = input.files[0];
    if (file) {
        masterPdfBytes = await file.arrayBuffer();
        statusEl.textContent = `✅ تم اختيار: ${file.name}`;
        statusEl.style.color = '#00ff99';
    }
}

async function mergeAndDownload() {
    render();

    // Also render Before/After page if there's data
    const hasBAData = $('clientName')?.value || $('beforeImg')?.files?.length || $('afterImg')?.files?.length;
    if (hasBAData) {
        await previewBeforeAfter();
    }

    // Parse again to get client name for filename
    const text = document.getElementById('inputText').value;
    const data = parseDietPlan(text);

    // Construct filename
    let safeTitle = 'NutritionPlan';
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }).replace(/:/g, '-');
    const finalFileName = `${safeTitle}_${dateStr}_${timeStr}.pdf`;

    const msgEl = document.getElementById('msg');

    if (!masterPdfBytes) {
        const manualInput = document.getElementById('manualMasterPdf');
        if (manualInput.files && manualInput.files[0]) {
            masterPdfBytes = await manualInput.files[0].arrayBuffer();
        }
    }

    if (!masterPdfBytes) {
        msgEl.textContent = '❌ يجب اختيار ملف PDF الرئيسي أولاً!';
        msgEl.style.color = '#ff4d4d';
        return;
    }

    const pagesContainer = document.getElementById('output');
    const allPages = pagesContainer.querySelectorAll('.page');
    if (allPages.length === 0) {
        msgEl.textContent = '❌ لا توجد صفحات لدمجها!';
        msgEl.style.color = '#ff4d4d';
        return;
    }

    // Separate Before/After page from other pages
    const baPage = pagesContainer.querySelector('.ba-page');
    const nutritionPages = Array.from(allPages).filter(p => !p.classList.contains('ba-page'));

    const totalPages = (baPage ? 1 : 0) + nutritionPages.length;
    msgEl.textContent = `⏳ جاري معالجة ${totalPages} صفحات...`;
    msgEl.style.color = '#ffcc00';

    try {
        const { PDFDocument, PDFName, PDFString } = PDFLib;
        const pdfDoc = await PDFDocument.load(masterPdfBytes);

        const insertAfterPage = parseInt(document.getElementById('insertPage').value) || 5;

        const A4_WIDTH = 595.28;
        const A4_HEIGHT = 841.89;
        const bgDataUrl = (typeof BG_DATA !== 'undefined') ? BG_DATA : null;

        // Helper function to render a page to PDF
        async function renderPageToPdf(pageEl, insertIndex) {
            if (bgDataUrl) {
                pageEl.style.setProperty('background-image', `url("${bgDataUrl}")`, 'important');
            }

            const canvas = await html2canvas(pageEl, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: null
            });
            const imgData = canvas.toDataURL('image/jpeg', 0.85);
            const imgImage = await pdfDoc.embedJpg(imgData);

            if (bgDataUrl) {
                pageEl.style.backgroundImage = '';
            }

            const newPage = pdfDoc.insertPage(insertIndex, [A4_WIDTH, A4_HEIGHT]);

            newPage.drawImage(imgImage, {
                x: 0,
                y: 0,
                width: A4_WIDTH,
                height: A4_HEIGHT
            });
        }

        let processedCount = 0;

        // 1. Insert Before/After page after page 1
        if (baPage) {
            await renderPageToPdf(baPage, 1); // Insert after page 1 (index 1)
            processedCount++;
            msgEl.textContent = `⏳ جاري معالجة صفحة ${processedCount}/${totalPages} (Before/After)...`;
        }

        // 2. Insert nutrition pages after the specified page (default: 5)
        // Adjust insert index: if B&A was inserted, the page numbers shift by 1
        let nutritionInsertIndex = insertAfterPage + (baPage ? 1 : 0);

        for (let i = 0; i < nutritionPages.length; i++) {
            await renderPageToPdf(nutritionPages[i], nutritionInsertIndex + i);
            processedCount++;
            msgEl.textContent = `⏳ جاري معالجة صفحة ${processedCount}/${totalPages}...`;
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const link = document.getElementById('downloadLink');
        link.href = url;
        link.download = finalFileName;
        link.click();

        msgEl.textContent = `✅ تم الحفظ باسم: ${finalFileName}`;
        msgEl.style.color = '#00ff99';
        setTimeout(() => URL.revokeObjectURL(url), 1000);

    } catch (err) {
        console.error(err);
        msgEl.textContent = '❌ حدث خطأ: ' + err.message;
        msgEl.style.color = '#ff4d4d';
    }
}

/* --- AI Integration Logic --- */

function setMode(mode) {
    const btnManual = document.getElementById('btnManual');
    const btnAI = document.getElementById('btnAI');
    const aiInputContainer = document.getElementById('aiInputContainer');
    const aiSettings = document.getElementById('aiSettings');
    const mainInput = document.getElementById('inputText');

    if (mode === 'manual') {
        btnManual.classList.add('active');
        btnAI.classList.remove('active');
        aiInputContainer.style.display = 'none';
        aiSettings.style.display = 'none';
        mainInput.placeholder = "الصق النظام الغذائي هنا...";
    } else {
        btnManual.classList.remove('active');
        btnAI.classList.add('active');
        aiInputContainer.style.display = 'block';
        mainInput.placeholder = "النتيجة ستظهر هنا (النظام الغذائي الجاهز)...";

        if (!document.getElementById('apiKey').value) {
            aiSettings.style.display = 'block';
        }
    }
}

function toggleSettings() {
    const el = document.getElementById('aiSettings');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function saveApiKey() {
    const key = document.getElementById('apiKey').value.trim();
    if (key) {
        localStorage.setItem('nutrition_api_key', key);
        alert('تم حفظ المفتاح بنجاح! ✅');
    }
}

// ✅ SECURE: Load API key from localStorage only (never hardcode keys!)
function loadApiKey() {
    // Read key from localStorage - user must enter their own key
    const savedKey = localStorage.getItem('nutrition_api_key') || '';
    document.getElementById('apiKey').value = savedKey;

    // Show settings panel if no key is saved
    if (!savedKey) {
        console.log('ℹ️ No API key found. Please enter your key in settings.');
    }
}

async function generateNutritionPlan() {
    const aiInputEl = document.getElementById('aiInputText'); // Input
    const outputEl = document.getElementById('inputText'); // Output
    const apiKey = document.getElementById('apiKey').value.trim();
    const btn = document.querySelector('.generate-btn');

    if (!apiKey) {
        alert('⚠️ الرجاء إدخال مفتاح API أولاً (اضغط على علامة الترس)');
        toggleSettings();
        return;
    }

    if (!aiInputEl.value.trim()) {
        alert('⚠️ الرجاء إدخال بيانات العميل في الصندوق المخصص (بيانات العميل)');
        return;
    }

    // UI Loading State
    const originalText = btn.innerText;
    btn.innerText = '⏳ جاري التفكير والكتابة... (يرجى الانتظار)';
    btn.disabled = true;

    try {
        const userContent = aiInputEl.value;
        // Make sure SYSTEM_PROMPT is defined in your HTML or another file
        const fullPrompt = (typeof SYSTEM_PROMPT !== 'undefined' ? SYSTEM_PROMPT : "") + "\n\n🚀 CLIENT DATA:\n" + userContent;
        let generatedText = "";

        // Detect Provider based on key prefix
        if (apiKey.startsWith('sk-')) {
            // --- OPENAI API (ChatGPT) ---
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: (typeof SYSTEM_PROMPT !== 'undefined' ? SYSTEM_PROMPT : "") },
                        { role: 'user', content: "🚀 CLIENT DATA:\n" + userContent }
                    ],
                    temperature: 0.3
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message || "OpenAI API Error");
            generatedText = data.choices[0].message.content;

        } else if (apiKey.startsWith('pplx-')) {
            // --- PERPLEXITY API ---
            const response = await fetch('https://api.perplexity.ai/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.1-sonar-large-128k-online',
                    messages: [
                        { role: 'system', content: (typeof SYSTEM_PROMPT !== 'undefined' ? SYSTEM_PROMPT : "") },
                        { role: 'user', content: "🚀 CLIENT DATA:\n" + userContent }
                    ],
                    temperature: 0.2
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message || "Perplexity API Error");
            generatedText = data.choices[0].message.content;

        } else {
            // --- GOOGLE GEMINI API ---
            // ✅ Updated based on ListModels test - supports latest 2.5 Flash!
            const models = [
                'gemini-2.5-flash',       // Newest stable (June 2025)
                'gemini-2.5-pro',         // Newest pro
                'gemini-flash-latest',    // Always points to latest
                'gemini-2.0-flash'        // Fallback
            ];

            let data = null;
            let success = false;
            let lastError = null;

            for (const model of models) {
                try {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{ text: fullPrompt }]
                            }]
                        })
                    });

                    data = await response.json();

                    // Specific Error Handling
                    if (data.error) {
                        // If Rate Limit (429), stop trying and tell user immediately
                        if (data.error.code === 429 || data.error.status === 'RESOURCE_EXHAUSTED') {
                            throw new Error(`⚠️ ضغط كبير على السيرفر (Rate Limit). يرجى الانتظار دقيقة والمحاولة مجدداً.`);
                        }
                        throw new Error(data.error.message);
                    }

                    // If we get here, it worked!
                    success = true;
                    break;
                } catch (err) {
                    // Rethrow rate limits immediately
                    if (err.message.includes('Rate Limit') || err.message.includes('ضغط كبير')) {
                        throw err;
                    }

                    console.warn(`Model ${model} failed:`, err);
                    lastError = err;
                }
            }

            if (!success) {
                throw lastError || new Error('All Gemini models failed.');
            }
            generatedText = data.candidates[0].content.parts[0].text;
        }

        // Success!
        outputEl.value = generatedText;
        render();

        // Success Animation
        btn.innerText = '✅ تم التوليد بنجاح!';
        setTimeout(() => {
            btn.innerText = originalText;
            btn.disabled = false;
        }, 2000);

    } catch (err) {
        console.error(err);
        alert('❌ حدث خطأ أثناء التوليد:\n' + err.message);
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// --- Before/After Photo Comparison ---

async function previewBeforeAfter() {
    const output = $('output');
    const clientName = $('clientName')?.value || '';
    const beforeText = $('beforeText')?.value || 'Before';
    const afterText = $('afterText')?.value || 'After';
    const baNotes = $('baNotesInput')?.value || '';

    const beforeInput = $('beforeImg');
    const afterInput = $('afterImg');

    // Check if Before/After page already exists
    let baPage = document.querySelector('.ba-page');
    if (!baPage) {
        baPage = document.createElement('div');
        baPage.className = 'page ba-page';
        // Insert as first page
        if (output.firstChild) {
            output.insertBefore(baPage, output.firstChild);
        } else {
            output.appendChild(baPage);
        }
    }

    // Get image data URLs
    const getImageUrl = (input) => {
        return new Promise((resolve) => {
            if (input && input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(input.files[0]);
            } else {
                resolve('');
            }
        });
    };

    const [beforeUrl, afterUrl] = await Promise.all([getImageUrl(beforeInput), getImageUrl(afterInput)]);

    baPage.innerHTML = `
        <div class="ba-content">
            <h2 class="ba-client-name">${clientName || 'اسم العميل'}</h2>
            <div class="ba-images-row">
                <div class="ba-image-box">
                    ${afterUrl ? `<img src="${afterUrl}" alt="After">` : '<div class="ba-placeholder">After</div>'}
                    <p class="ba-label ba-after">${afterText}</p>
                </div>
                <div class="ba-image-box">
                    ${beforeUrl ? `<img src="${beforeUrl}" alt="Before">` : '<div class="ba-placeholder">Before</div>'}
                    <p class="ba-label ba-before">${beforeText}</p>
                </div>
            </div>
            ${baNotes ? `
            <div class="ba-notes-section">
                <h3>ملاحظات</h3>
                <div class="ba-notes-box">${baNotes.replace(/\n/g, '<br>')}</div>
            </div>
            ` : ''}
        </div>
    `;

    // Wait for images to load in DOM
    const images = baPage.querySelectorAll('img');
    if (images.length > 0) {
        await Promise.all(Array.from(images).map(img => {
            return new Promise(resolve => {
                if (img.complete) {
                    resolve();
                } else {
                    img.onload = resolve;
                    img.onerror = resolve;
                }
            });
        }));
    }

    return baPage;
}
