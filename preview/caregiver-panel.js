(() => {
  const STORAGE_KEY = 'salamatAvalCaregiverPanelV1';
  const toman = value => `${Number(value || 0).toLocaleString('fa-IR')} تومان`;
  const faNumber = value => Number(value || 0).toLocaleString('fa-IR');
  const nowFa = () => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());

  const defaults = {
    profile: {
      name: 'مریم حسینی',
      code: 'SA-1405-1028',
      mobile: '09128668837',
      rank: 'مراقب حرفه‌ای',
      status: 'فعال',
      supportAgent: 'نگار احمدی',
      certificate: 'معتبر تا ۳۰ آذر ۱۴۰۵'
    },
    wallet: {
      balance: 18450000,
      withdrawable: 16450000,
      pending: 2000000,
      transactions: [
        { id: 'TR-7201', title: 'واریز حقوق تیرماه', amount: 17350000, type: 'credit', date: '۲ مرداد ۱۴۰۵' },
        { id: 'TR-7192', title: 'پاداش رضایت خانواده', amount: 1100000, type: 'credit', date: '۳۱ تیر ۱۴۰۵' },
        { id: 'TR-7184', title: 'درخواست برداشت', amount: 2000000, type: 'debit', date: '۲۹ تیر ۱۴۰۵' }
      ],
      payoutRequests: []
    },
    contract: {
      type: 'ساعتی',
      startDate: '۱ تیر ۱۴۰۵',
      endDate: '۳۱ شهریور ۱۴۰۵',
      monthlyHours: 168,
      loggedHours: 144,
      overtimeHours: 8,
      hourlyRate: 118000,
      currentShift: { family: 'خانواده مرادی', date: 'امروز', time: '۰۸:۰۰ تا ۱۶:۰۰', checkedIn: false, checkedOut: false }
    },
    payslips: [
      { id: 'PS-1405-04', month: 'تیر ۱۴۰۵', gross: 19920000, benefits: 1350000, deductions: 3920000, net: 17350000, status: 'پرداخت‌شده', paidAt: '۲ مرداد ۱۴۰۵' },
      { id: 'PS-1405-03', month: 'خرداد ۱۴۰۵', gross: 18880000, benefits: 850000, deductions: 3580000, net: 16150000, status: 'پرداخت‌شده', paidAt: '۳ تیر ۱۴۰۵' },
      { id: 'PS-1405-02', month: 'اردیبهشت ۱۴۰۵', gross: 17700000, benefits: 920000, deductions: 3420000, net: 15200000, status: 'پرداخت‌شده', paidAt: '۴ خرداد ۱۴۰۵' }
    ],
    performance: {
      score: 87,
      trend: '+۴ امتیاز در ۳۰ روز',
      lastReview: '۲۸ تیر ۱۴۰۵',
      dimensions: [
        { title: 'کیفیت اجرای مراقبت', score: 92, weight: 20 },
        { title: 'تعهد و حضور به‌موقع', score: 95, weight: 15 },
        { title: 'رفتار حرفه‌ای', score: 89, weight: 15 },
        { title: 'رضایت خانواده', score: 86, weight: 15 },
        { title: 'ایمنی و گزارش‌دهی', score: 84, weight: 10 },
        { title: 'تکمیل آموزش‌ها', score: 80, weight: 10 },
        { title: 'همکاری با پشتیبان', score: 88, weight: 10 },
        { title: 'انضباط سازمانی', score: 82, weight: 5 }
      ],
      reviews: [
        { date: '۲۸ تیر ۱۴۰۵', source: 'پشتیبان پرونده', note: 'تعامل حرفه‌ای و ثبت منظم گزارش روزانه', impact: '+۳' },
        { date: '۲۰ تیر ۱۴۰۵', source: 'خانواده مرادی', note: 'رضایت از نظم، آرامش و همراهی با سالمند', impact: '+۲' },
        { date: '۱۲ تیر ۱۴۰۵', source: 'کنترل کیفیت', note: 'نیاز به تکمیل دوره پیشگیری از زمین‌خوردن', impact: '-۱' }
      ]
    },
    rank: {
      current: 'مراقب حرفه‌ای',
      next: 'مراقب ارشد',
      points: 87,
      required: 100,
      requirements: [
        { title: 'امتیاز حرفه‌ای حداقل ۹۰', done: false },
        { title: 'تکمیل همه آموزش‌های الزامی', done: false },
        { title: 'حداقل ۳ ماه همکاری فعال', done: true },
        { title: 'نبود گزارش انضباطی باز', done: true }
      ]
    },
    courses: [
      { id: 'C-101', title: 'ایمنی و پیشگیری از زمین‌خوردن سالمند', type: 'الزامی', duration: '۴۵ دقیقه', progress: 65, due: '۵ مرداد ۱۴۰۵' },
      { id: 'C-102', title: 'اصول ارتباط با سالمند مبتلا به دمانس', type: 'تخصصی', duration: '۶۰ دقیقه', progress: 20, due: '۱۲ مرداد ۱۴۰۵' },
      { id: 'C-103', title: 'گزارش‌نویسی روزانه مراقبت', type: 'الزامی', duration: '۳۰ دقیقه', progress: 100, due: 'تکمیل‌شده' }
    ],
    shifts: [
      { id: 'SH-901', date: 'امروز', day: 'چهارشنبه', time: '۰۸:۰۰ تا ۱۶:۰۰', family: 'خانواده مرادی', address: 'سعادت‌آباد', status: 'فعال' },
      { id: 'SH-902', date: 'فردا', day: 'پنجشنبه', time: '۰۸:۰۰ تا ۱۶:۰۰', family: 'خانواده مرادی', address: 'سعادت‌آباد', status: 'تأییدشده' },
      { id: 'SH-903', date: '۱۰ مرداد', day: 'شنبه', time: '۱۶:۰۰ تا ۲۲:۰۰', family: 'خانواده علوی', address: 'شهرک غرب', status: 'تأییدشده' }
    ],
    leaveRequests: [],
    supportMessages: [
      { from: 'support', text: 'سلام مریم عزیز، برنامه شیفت هفته آینده شما تأیید شد.', date: 'امروز، ۱۰:۲۰' },
      { from: 'caregiver', text: 'ممنون، برنامه را مشاهده کردم.', date: 'امروز، ۱۰:۳۵' }
    ],
    securityReports: []
  };

  const clone = value => JSON.parse(JSON.stringify(value));
  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved ? { ...clone(defaults), ...saved } : clone(defaults);
    } catch {
      return clone(defaults);
    }
  }
  let caregiverState = loadState();
  const saveState = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(caregiverState));

  const originalRenderDashboard = renderDashboard;
  const originalRenderModule = renderModule;

  function caregiverSummaryCards() {
    return `
      <section class="metrics caregiver-metrics">
        <article class="metric"><span class="metric-icon green" data-icon="wallet"></span><div><small>موجودی کیف پول</small><strong>${toman(caregiverState.wallet.balance)}</strong><em>${toman(caregiverState.wallet.withdrawable)} قابل برداشت</em></div></article>
        <article class="metric"><span class="metric-icon blue" data-icon="badge"></span><div><small>رتبه حرفه‌ای</small><strong>${caregiverState.rank.current}</strong><em>${faNumber(caregiverState.rank.required - caregiverState.rank.points)} امتیاز تا رتبه بعد</em></div></article>
        <article class="metric"><span class="metric-icon purple" data-icon="chart"></span><div><small>کارنامه کاری</small><strong>${faNumber(caregiverState.performance.score)} از ۱۰۰</strong><em>${caregiverState.performance.trend}</em></div></article>
        <article class="metric"><span class="metric-icon orange" data-icon="briefcase"></span><div><small>ساعات قرارداد</small><strong>${faNumber(caregiverState.contract.monthlyHours)} ساعت</strong><em>${faNumber(caregiverState.contract.loggedHours)} ساعت ثبت‌شده</em></div></article>
      </section>`;
  }

  function progress(value, tone = 'green') {
    return `<div class="cp-progress"><span class="${tone}" style="width:${Math.max(0, Math.min(100, value))}%"></span></div>`;
  }

  function actionCard(iconName, tone, title, text, target) {
    return `<button class="cp-action-card" data-nav-target="${target}"><span class="metric-icon ${tone}" data-icon="${iconName}"></span><div><strong>${title}</strong><small>${text}</small></div><span class="cp-card-arrow" data-icon="arrow-left"></span></button>`;
  }

  function renderCaregiverDashboard() {
    const shift = caregiverState.contract.currentShift;
    qs('#pageTitle').textContent = 'داشبورد مراقب';
    qs('#pageSubtitle').textContent = 'وضعیت کاری، مالی، آموزشی و حرفه‌ای شما';
    qs('#content').innerHTML = `
      <section class="role-hero caregiver-hero-panel">
        <div>
          <span class="cp-eyebrow">باشگاه مراقبین سلامت اول</span>
          <h2>سلام ${caregiverState.profile.name.split(' ')[0]}، ${shift.checkedIn ? 'شیفت شما در حال اجراست' : 'برای شیفت امروز آماده‌ای؟'}</h2>
          <p>برنامه امروز ${shift.time} برای ${shift.family} ثبت شده است. شروع و پایان شیفت را از همین صفحه ثبت کن.</p>
          <div class="hero-actions">
            <button class="btn primary" id="shiftAction">${shift.checkedIn && !shift.checkedOut ? 'ثبت پایان شیفت' : shift.checkedOut ? 'شیفت امروز تکمیل شد' : 'ثبت شروع شیفت'}</button>
            <button class="btn outline" data-nav-target="تقویم کاری">مشاهده برنامه کاری</button>
          </div>
        </div>
        <div class="hero-score"><div class="score-ring" style="background:conic-gradient(var(--green) 0 ${caregiverState.performance.score}%,#e5ece8 ${caregiverState.performance.score}%)"><strong>${faNumber(caregiverState.performance.score)}</strong></div><div><span>امتیاز حرفه‌ای</span><small>آخرین پایش: ${caregiverState.performance.lastReview}</small></div></div>
      </section>
      ${caregiverSummaryCards()}
      <section class="dashboard-grid caregiver-dashboard-grid">
        <article class="surface">
          <div class="surface-head"><div><h3>دسترسی‌های اصلی</h3><p>ماژول‌های روزمره پنل مراقب</p></div></div>
          <div class="cp-action-grid">
            ${actionCard('money','orange','حقوق و فیش حقوقی','مشاهده دریافتی، مزایا و کسورات','حقوق و فیش حقوقی')}
            ${actionCard('briefcase','blue','ساعات قرارداد','ساعت موظفی، حضور و اضافه‌کاری','ساعات قرارداد')}
            ${actionCard('book','green','آموزش‌های من',`${caregiverState.courses.filter(c=>c.progress<100).length} آموزش در حال انجام`,'آموزش‌های من')}
            ${actionCard('message','purple','پشتیبانی پرونده',`گفت‌وگو با ${caregiverState.profile.supportAgent}`,'پشتیبانی پرونده')}
            ${actionCard('alert','orange','گزارش امنیت','ثبت فوری و محرمانه رخداد','گزارش امنیت')}
            ${actionCard('calendar','blue','تقویم کاری','شیفت‌ها و درخواست مرخصی','تقویم کاری')}
          </div>
        </article>
        <article class="surface">
          <div class="surface-head"><div><h3>اقدام‌های امروز</h3><p>مواردی که بهتر است امروز تکمیل شوند</p></div></div>
          <div class="cp-today-list">
            <div class="cp-today-item"><span data-icon="calendar"></span><div><strong>${shift.family}</strong><small>${shift.time} • سعادت‌آباد</small></div><b class="status">${shift.checkedIn ? 'در حال اجرا' : 'آماده شروع'}</b></div>
            <div class="cp-today-item"><span data-icon="book"></span><div><strong>${caregiverState.courses[0].title}</strong><small>${caregiverState.courses[0].progress}٪ تکمیل شده</small>${progress(caregiverState.courses[0].progress)}</div><button data-nav-target="آموزش‌های من">ادامه</button></div>
            <div class="cp-today-item"><span data-icon="message"></span><div><strong>پشتیبان پرونده</strong><small>${caregiverState.supportMessages[caregiverState.supportMessages.length-1].text}</small></div><button data-nav-target="پشتیبانی پرونده">پاسخ</button></div>
          </div>
        </article>
      </section>`;
    hydrateIcons(qs('#content'));
    bindCaregiverActions();
  }

  function performancePage() {
    return `
      <section class="cp-page-head"><div><span class="cp-eyebrow">کارنامه حرفه‌ای</span><h2>امتیاز کل ${faNumber(caregiverState.performance.score)} از ۱۰۰</h2><p>امتیاز رسمی بر اساس رویدادهای ثبت‌شده، ارزیابی عملیات، بازخورد خانواده و تکمیل آموزش‌ها محاسبه می‌شود.</p></div><div class="cp-score-badge"><strong>${faNumber(caregiverState.performance.score)}</strong><small>${caregiverState.performance.trend}</small></div></section>
      <section class="cp-two-column">
        <article class="surface"><div class="surface-head"><div><h3>شاخص‌های کارنامه</h3><p>هشت شاخص اصلی ارزیابی عملکرد</p></div><span class="status">آخرین پایش ${caregiverState.performance.lastReview}</span></div><div class="cp-score-list">${caregiverState.performance.dimensions.map(d=>`<div class="cp-score-row"><div><strong>${d.title}</strong><small>وزن ${faNumber(d.weight)}٪</small></div><div class="cp-score-value">${faNumber(d.score)}</div>${progress(d.score,d.score<85?'orange':'green')}</div>`).join('')}</div></article>
        <article class="surface"><div class="surface-head"><div><h3>رویدادهای مؤثر بر امتیاز</h3><p>هر تغییر امتیاز قابل ردیابی است</p></div></div><div class="activity-list">${caregiverState.performance.reviews.map(r=>`<div class="activity-item"><span data-icon="chart"></span><div><strong>${r.note}</strong><small>${r.source} • ${r.date}</small></div><time class="${r.impact.startsWith('-')?'cp-negative':'cp-positive'}">${r.impact}</time></div>`).join('')}</div></article>
      </section>`;
  }

  function rankPage() {
    const pct = Math.round((caregiverState.rank.points / caregiverState.rank.required) * 100);
    return `
      <section class="cp-page-head"><div><span class="cp-eyebrow">مسیر رشد حرفه‌ای</span><h2>${caregiverState.rank.current}</h2><p>رتبه شما نتیجه کیفیت پایدار، رفتار حرفه‌ای، آموزش و قابلیت اعتماد عملیاتی است.</p></div><div class="cp-certificate"><span data-icon="shield-check"></span><div><strong>گواهی صلاحیت فعال</strong><small>${caregiverState.profile.certificate}</small></div></div></section>
      <section class="cp-two-column"><article class="surface cp-rank-card"><div class="surface-head"><div><h3>مسیر ارتقا به ${caregiverState.rank.next}</h3><p>${faNumber(caregiverState.rank.required-caregiverState.rank.points)} امتیاز تا بررسی ارتقا</p></div></div><div class="cp-rank-meter"><strong>${faNumber(caregiverState.rank.points)}</strong><span>از ${faNumber(caregiverState.rank.required)}</span>${progress(pct)}</div><div class="cp-requirements">${caregiverState.rank.requirements.map(x=>`<div class="cp-requirement ${x.done?'done':''}"><span data-icon="${x.done?'check-circle':'alert'}"></span><strong>${x.title}</strong><small>${x.done?'انجام شده':'نیازمند اقدام'}</small></div>`).join('')}</div></article><article class="surface"><div class="surface-head"><div><h3>مزایای رتبه فعلی</h3><p>دسترسی‌ها و اولویت‌های حرفه‌ای</p></div></div><div class="cp-benefits"><div><span data-icon="wallet"></span><strong>اولویت پرداخت</strong><small>پرداخت در چرخه سریع‌تر</small></div><div><span data-icon="briefcase"></span><strong>پرونده‌های منتخب</strong><small>دسترسی به شیفت‌های تخصصی‌تر</small></div><div><span data-icon="book"></span><strong>آموزش تخصصی</strong><small>دوره‌های ارتقای مهارت</small></div></div></article></section>`;
  }

  function walletPage() {
    return `
      <section class="cp-wallet-hero"><div><small>موجودی کل کیف پول</small><strong>${toman(caregiverState.wallet.balance)}</strong><span>${toman(caregiverState.wallet.withdrawable)} قابل برداشت</span></div><button class="btn primary" id="openPayout">درخواست برداشت</button></section>
      <section class="cp-two-column"><article class="surface"><div class="surface-head"><div><h3>گردش کیف پول</h3><p>آخرین واریزها و برداشت‌ها</p></div></div><div class="cp-transaction-list">${caregiverState.wallet.transactions.map(t=>`<div class="cp-transaction"><span class="metric-icon ${t.type==='credit'?'green':'orange'}" data-icon="${t.type==='credit'?'plus':'arrow-left'}"></span><div><strong>${t.title}</strong><small>${t.id} • ${t.date}</small></div><b class="${t.type==='credit'?'cp-positive':'cp-negative'}">${t.type==='credit'?'+':'-'} ${toman(t.amount)}</b></div>`).join('')}</div></article><article class="surface"><div class="surface-head"><div><h3>درخواست‌های برداشت</h3><p>وضعیت تسویه‌های ثبت‌شده</p></div></div><div class="cp-empty-or-list">${caregiverState.wallet.payoutRequests.length?caregiverState.wallet.payoutRequests.map(p=>`<div class="cp-request-row"><div><strong>${toman(p.amount)}</strong><small>${p.date}</small></div><span class="status">در انتظار بررسی</span></div>`).join(''):'<div class="cp-empty"><span data-icon="wallet"></span><strong>درخواست بازی وجود ندارد</strong><small>پس از ثبت برداشت، وضعیت آن اینجا نمایش داده می‌شود.</small></div>'}</div></article></section>`;
  }

  function payslipPage() {
    return `<section class="cp-page-head"><div><span class="cp-eyebrow">حقوق و مزایا</span><h2>فیش‌های حقوقی</h2><p>جزئیات ناخالص، مزایا، کسورات و مبلغ خالص هر دوره را مشاهده و دریافت کنید.</p></div></section><article class="surface table-wrap"><table class="data-table cp-payslip-table"><thead><tr><th>دوره</th><th>حقوق ناخالص</th><th>مزایا</th><th>کسورات</th><th>خالص پرداختی</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>${caregiverState.payslips.map(p=>`<tr><td><strong>${p.month}</strong><small>${p.paidAt}</small></td><td>${toman(p.gross)}</td><td>${toman(p.benefits)}</td><td>${toman(p.deductions)}</td><td><strong>${toman(p.net)}</strong></td><td><span class="status">${p.status}</span></td><td><button class="cp-link-btn" data-payslip="${p.id}">دریافت فیش</button></td></tr>`).join('')}</tbody></table></article>`;
  }

  function contractPage() {
    const percent = Math.round((caregiverState.contract.loggedHours/caregiverState.contract.monthlyHours)*100);
    return `<section class="cp-page-head"><div><span class="cp-eyebrow">قرارداد فعال</span><h2>${caregiverState.contract.type} • ${caregiverState.contract.startDate} تا ${caregiverState.contract.endDate}</h2><p>ساعات موظفی، ساعات ثبت‌شده و وضعیت حضور شما در این دوره.</p></div><div class="cp-contract-value"><small>نرخ پایه ساعتی</small><strong>${toman(caregiverState.contract.hourlyRate)}</strong></div></section><section class="cp-two-column"><article class="surface"><div class="surface-head"><div><h3>پیشرفت ساعت موظفی</h3><p>${faNumber(caregiverState.contract.loggedHours)} ساعت از ${faNumber(caregiverState.contract.monthlyHours)} ساعت</p></div><strong>${faNumber(percent)}٪</strong></div><div class="cp-contract-progress">${progress(percent)}<div class="cp-stat-grid"><div><small>ساعت ثبت‌شده</small><strong>${faNumber(caregiverState.contract.loggedHours)}</strong></div><div><small>باقی‌مانده</small><strong>${faNumber(Math.max(0,caregiverState.contract.monthlyHours-caregiverState.contract.loggedHours))}</strong></div><div><small>اضافه‌کاری</small><strong>${faNumber(caregiverState.contract.overtimeHours)}</strong></div></div></div></article><article class="surface"><div class="surface-head"><div><h3>ثبت حضور شیفت جاری</h3><p>${caregiverState.contract.currentShift.family} • ${caregiverState.contract.currentShift.time}</p></div></div><div class="cp-shift-action"><span data-icon="briefcase"></span><strong>${caregiverState.contract.currentShift.checkedOut?'شیفت تکمیل شده':caregiverState.contract.currentShift.checkedIn?'حضور شما ثبت شده است':'هنوز شروع شیفت ثبت نشده است'}</strong><small>ثبت حضور در کارنامه ساعت کاری و حقوق این دوره اثر می‌گذارد.</small><button class="btn primary" id="shiftAction">${caregiverState.contract.currentShift.checkedIn&&!caregiverState.contract.currentShift.checkedOut?'ثبت پایان شیفت':caregiverState.contract.currentShift.checkedOut?'تکمیل شده':'ثبت شروع شیفت'}</button></div></article></section>`;
  }

  function coursesPage() {
    return `<section class="cp-page-head"><div><span class="cp-eyebrow">آکادمی سلامت اول</span><h2>آموزش‌های من</h2><p>دوره‌های پیش از اعزام، بازآموزی و تخصصی اختصاص‌یافته به شما.</p></div><div class="cp-course-summary"><strong>${faNumber(caregiverState.courses.filter(c=>c.progress===100).length)}</strong><small>دوره تکمیل‌شده</small></div></section><section class="cp-course-grid">${caregiverState.courses.map(c=>`<article class="surface cp-course-card"><div class="cp-course-cover"><span data-icon="book"></span><b>${c.type}</b></div><div class="cp-course-body"><h3>${c.title}</h3><div class="cp-course-meta"><span>${c.duration}</span><span>${c.due}</span></div>${progress(c.progress,c.progress===100?'green':'blue')}<div class="cp-course-footer"><strong>${faNumber(c.progress)}٪</strong><button class="btn ${c.progress===100?'outline':'primary'}" data-course="${c.id}">${c.progress===100?'مرور دوره':'ادامه آموزش'}</button></div></div></article>`).join('')}</section>`;
  }

  function supportPage() {
    return `<section class="cp-support-layout"><article class="surface cp-chat"><div class="surface-head"><div><h3>گفت‌وگو با پشتیبان پرونده</h3><p>${caregiverState.profile.supportAgent} • پاسخگویی در ساعات اداری</p></div><span class="status">آنلاین</span></div><div class="cp-chat-messages" id="supportMessages">${caregiverState.supportMessages.map(m=>`<div class="cp-message ${m.from==='caregiver'?'mine':''}"><p>${m.text}</p><small>${m.date}</small></div>`).join('')}</div><form class="cp-chat-form" id="supportForm"><input id="supportInput" required placeholder="پیام خود را بنویسید..."/><button class="btn primary">ارسال پیام</button></form></article><aside class="surface cp-support-side"><div class="surface-head"><div><h3>راه‌های ارتباطی</h3><p>برای موضوعات فوری از تماس استفاده کنید</p></div></div><a href="tel:1527" class="cp-contact-card"><span data-icon="phone"></span><div><strong>مرکز پاسخگویی ۱۵۲۷</strong><small>پشتیبانی عملیاتی و پرونده</small></div></a><button class="cp-contact-card" data-nav-target="گزارش امنیت"><span data-icon="alert"></span><div><strong>گزارش محرمانه امنیت</strong><small>ثبت رخداد بدون نمایش برای خانواده</small></div></button></aside></section>`;
  }

  function securityPage() {
    return `<section class="cp-security-hero"><span data-icon="shield"></span><div><small>لاین محرمانه مراقبین</small><h2>گزارش امنیت و رخداد حساس</h2><p>این گزارش مستقیماً برای تیم امنیت و مدیر مجاز ارسال می‌شود و برای خانواده یا سایر کاربران پرونده نمایش داده نخواهد شد.</p></div><a href="tel:1527" class="btn outline">تماس فوری با ۱۵۲۷</a></section><section class="cp-two-column"><article class="surface"><div class="surface-head"><div><h3>ثبت گزارش محرمانه</h3><p>در موقعیت خطر فوری ابتدا با پلیس یا اورژانس تماس بگیرید.</p></div></div><form class="cp-form" id="securityForm"><label>نوع رخداد<select id="securityType" required><option value="">انتخاب کنید</option><option>تهدید یا خشونت</option><option>رفتار نامناسب در محل خدمت</option><option>مغایرت مالی یا درخواست مشکوک</option><option>خطر برای سالمند</option><option>سایر موارد</option></select></label><label>سطح فوریت<select id="securityLevel" required><option>عادی</option><option>مهم</option><option>فوری</option></select></label><label class="cp-full">شرح دقیق رخداد<textarea id="securityText" required rows="6" placeholder="زمان، مکان و جزئیات رخداد را بنویسید..."></textarea></label><label class="cp-check cp-full"><input id="securityAnonymous" type="checkbox"/> گزارش بدون نمایش نام من در روند پیگیری ثبت شود</label><button class="btn primary cp-full">ثبت امن گزارش</button></form></article><article class="surface"><div class="surface-head"><div><h3>گزارش‌های ثبت‌شده من</h3><p>فقط وضعیت پیگیری نمایش داده می‌شود</p></div></div><div class="cp-empty-or-list">${caregiverState.securityReports.length?caregiverState.securityReports.map(r=>`<div class="cp-request-row"><div><strong>${r.type}</strong><small>${r.date} • ${r.level}</small></div><span class="status">در حال بررسی محرمانه</span></div>`).join(''):'<div class="cp-empty"><span data-icon="shield-check"></span><strong>گزارشی ثبت نشده است</strong><small>رخدادهای امنیتی فقط برای افراد مجاز قابل مشاهده‌اند.</small></div>'}</div></article></section>`;
  }

  function calendarPage() {
    return `<section class="cp-page-head"><div><span class="cp-eyebrow">برنامه کاری</span><h2>تقویم شیفت‌ها</h2><p>برنامه تأییدشده، محل خدمت و درخواست‌های مرخصی خود را مدیریت کنید.</p></div><button class="btn primary" id="openLeave">درخواست مرخصی</button></section><section class="cp-two-column"><article class="surface"><div class="surface-head"><div><h3>شیفت‌های پیش‌رو</h3><p>برنامه ثبت‌شده توسط منابع انسانی</p></div></div><div class="cp-shift-list">${caregiverState.shifts.map(s=>`<div class="cp-shift-row"><div class="cp-date-box"><strong>${s.date}</strong><small>${s.day}</small></div><div><strong>${s.family}</strong><small>${s.time} • ${s.address}</small></div><span class="status">${s.status}</span></div>`).join('')}</div></article><article class="surface"><div class="surface-head"><div><h3>درخواست‌های مرخصی</h3><p>سوابق درخواست‌های ثبت‌شده</p></div></div><div class="cp-empty-or-list">${caregiverState.leaveRequests.length?caregiverState.leaveRequests.map(r=>`<div class="cp-request-row"><div><strong>${r.date}</strong><small>${r.reason}</small></div><span class="status">در انتظار بررسی</span></div>`).join(''):'<div class="cp-empty"><span data-icon="calendar"></span><strong>درخواست بازی ندارید</strong><small>درخواست جدید از دکمه بالای صفحه ثبت می‌شود.</small></div>'}</div></article></section>`;
  }

  function moduleMarkup(label) {
    switch (label) {
      case 'کارنامه کاری': return performancePage();
      case 'درجه و رتبه': return rankPage();
      case 'کیف پول': return walletPage();
      case 'حقوق و فیش حقوقی': return payslipPage();
      case 'ساعات قرارداد': return contractPage();
      case 'آموزش‌های من': return coursesPage();
      case 'پشتیبانی پرونده': return supportPage();
      case 'گزارش امنیت': return securityPage();
      case 'تقویم کاری': return calendarPage();
      default: return performancePage();
    }
  }

  function renderCaregiverModule(nav) {
    qs('#pageTitle').textContent = nav[1];
    qs('#pageSubtitle').textContent = `پنل مراقب • ${caregiverState.profile.code}`;
    qs('#content').innerHTML = `<section class="module-page caregiver-module">${moduleMarkup(nav[1])}</section>`;
    hydrateIcons(qs('#content'));
    bindCaregiverActions();
  }

  function goToNav(label) {
    const button = qsa('.nav-item').find(item => item.textContent.includes(label));
    if (button) button.click();
  }

  function updateShift() {
    const shift = caregiverState.contract.currentShift;
    if (shift.checkedOut) return;
    if (!shift.checkedIn) {
      shift.checkedIn = true;
      toast('شروع شیفت ثبت شد', `حضور شما در ${nowFa()} ثبت شد.`);
    } else {
      shift.checkedOut = true;
      caregiverState.contract.loggedHours = Math.min(caregiverState.contract.monthlyHours + caregiverState.contract.overtimeHours, caregiverState.contract.loggedHours + 8);
      toast('پایان شیفت ثبت شد', 'هشت ساعت به کارکرد این دوره افزوده شد.');
    }
    saveState();
    renderCaregiverDashboard();
  }

  function downloadPayslip(id) {
    const p = caregiverState.payslips.find(item => item.id === id);
    if (!p) return;
    const html = `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><title>فیش حقوقی ${p.month}</title><style>body{font-family:Tahoma;padding:40px;color:#17241c}h1{color:#08743f}table{width:100%;border-collapse:collapse;margin-top:30px}td,th{border:1px solid #ddd;padding:12px;text-align:right}.total{font-size:20px;font-weight:bold;color:#08743f}</style><h1>فیش حقوقی سلامت اول</h1><p>نام مراقب: ${caregiverState.profile.name}</p><p>کد پرونده: ${caregiverState.profile.code}</p><p>دوره: ${p.month}</p><table><tr><th>حقوق ناخالص</th><td>${toman(p.gross)}</td></tr><tr><th>مزایا</th><td>${toman(p.benefits)}</td></tr><tr><th>کسورات</th><td>${toman(p.deductions)}</td></tr><tr><th>خالص پرداختی</th><td class="total">${toman(p.net)}</td></tr><tr><th>تاریخ پرداخت</th><td>${p.paidAt}</td></tr></table></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payslip-${id}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast('فیش آماده شد', `فیش ${p.month} دریافت شد.`);
  }

  function openPayoutDrawer() {
    qs('#drawerTitle').textContent = 'درخواست برداشت از کیف پول';
    qs('#drawerBody').innerHTML = `<form class="cp-form" id="payoutForm"><label class="cp-full">مبلغ برداشت<input id="payoutAmount" type="number" min="100000" max="${caregiverState.wallet.withdrawable}" required placeholder="مبلغ به تومان"/></label><div class="cp-balance-note cp-full">حداکثر مبلغ قابل برداشت: <strong>${toman(caregiverState.wallet.withdrawable)}</strong></div><button class="btn primary cp-full">ثبت درخواست برداشت</button></form>`;
    qs('#drawer').classList.add('open');
    qs('#drawerBackdrop').classList.remove('hidden');
    qs('#payoutForm').addEventListener('submit', e => {
      e.preventDefault();
      const amount = Number(qs('#payoutAmount').value);
      if (!amount || amount > caregiverState.wallet.withdrawable) return toast('مبلغ نامعتبر', 'مبلغ را در محدوده موجودی قابل برداشت وارد کنید.');
      caregiverState.wallet.payoutRequests.unshift({ amount, date: nowFa() });
      caregiverState.wallet.withdrawable -= amount;
      caregiverState.wallet.pending += amount;
      saveState();
      closeDrawer();
      toast('درخواست ثبت شد', 'درخواست برداشت برای واحد مالی ارسال شد.');
      renderCaregiverModule(['wallet','کیف پول']);
    });
  }

  function openLeaveDrawer() {
    qs('#drawerTitle').textContent = 'درخواست مرخصی';
    qs('#drawerBody').innerHTML = `<form class="cp-form" id="leaveForm"><label>تاریخ مرخصی<input id="leaveDate" type="date" required/></label><label>نوع مرخصی<select id="leaveType"><option>استحقاقی</option><option>بدون حقوق</option><option>اضطراری</option></select></label><label class="cp-full">علت درخواست<textarea id="leaveReason" rows="4" required placeholder="توضیح کوتاه..."></textarea></label><button class="btn primary cp-full">ارسال برای منابع انسانی</button></form>`;
    qs('#drawer').classList.add('open');
    qs('#drawerBackdrop').classList.remove('hidden');
    qs('#leaveForm').addEventListener('submit', e => {
      e.preventDefault();
      caregiverState.leaveRequests.unshift({ date: qs('#leaveDate').value, reason: `${qs('#leaveType').value} • ${qs('#leaveReason').value}` });
      saveState();
      closeDrawer();
      toast('درخواست مرخصی ثبت شد', 'منابع انسانی پس از بررسی نتیجه را اعلام می‌کند.');
      renderCaregiverModule(['calendar','تقویم کاری']);
    });
  }

  function bindCaregiverActions() {
    qsa('[data-nav-target]').forEach(el => el.addEventListener('click', () => goToNav(el.dataset.navTarget)));
    const shiftAction = qs('#shiftAction');
    if (shiftAction) shiftAction.addEventListener('click', updateShift);
    const payout = qs('#openPayout');
    if (payout) payout.addEventListener('click', openPayoutDrawer);
    const leave = qs('#openLeave');
    if (leave) leave.addEventListener('click', openLeaveDrawer);
    qsa('[data-payslip]').forEach(btn => btn.addEventListener('click', () => downloadPayslip(btn.dataset.payslip)));
    qsa('[data-course]').forEach(btn => btn.addEventListener('click', () => {
      const course = caregiverState.courses.find(c => c.id === btn.dataset.course);
      if (!course) return;
      if (course.progress < 100) course.progress = Math.min(100, course.progress + 20);
      saveState();
      toast(course.progress === 100 ? 'دوره تکمیل شد' : 'پیشرفت ذخیره شد', `${course.title}: ${faNumber(course.progress)}٪`);
      renderCaregiverModule(['book','آموزش‌های من']);
    }));
    const supportForm = qs('#supportForm');
    if (supportForm) supportForm.addEventListener('submit', e => {
      e.preventDefault();
      const input = qs('#supportInput');
      caregiverState.supportMessages.push({ from: 'caregiver', text: input.value.trim(), date: nowFa() });
      saveState();
      renderCaregiverModule(['message','پشتیبانی پرونده']);
      toast('پیام ارسال شد', `پیام برای ${caregiverState.profile.supportAgent} ثبت شد.`);
    });
    const securityForm = qs('#securityForm');
    if (securityForm) securityForm.addEventListener('submit', e => {
      e.preventDefault();
      caregiverState.securityReports.unshift({
        type: qs('#securityType').value,
        level: qs('#securityLevel').value,
        text: qs('#securityText').value,
        anonymous: qs('#securityAnonymous').checked,
        date: nowFa()
      });
      saveState();
      toast('گزارش امن ثبت شد', 'کد پیگیری محرمانه برای شما ایجاد شد.');
      renderCaregiverModule(['alert','گزارش امنیت']);
    });
  }

  renderDashboard = function(r) {
    if (r === roles.caregiver || selectedRole === 'caregiver') return renderCaregiverDashboard();
    return originalRenderDashboard(r);
  };

  renderModule = function(r, nav) {
    if (r === roles.caregiver || selectedRole === 'caregiver') return renderCaregiverModule(nav);
    return originalRenderModule(r, nav);
  };
})();