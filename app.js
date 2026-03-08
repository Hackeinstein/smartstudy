/**
 * PastQ — Core Application Logic
 * Client-side quiz engine: JSON parsing, quiz generation, scoring, storage.
 */
$(function () {
  'use strict';

  // ========== DARK MODE ==========
  const darkToggle = $('#darkToggle');

  function applyTheme(dark) {
    $('html').toggleClass('dark', dark);
    try { localStorage.setItem('pastq-theme', dark ? 'dark' : 'light'); } catch (e) { /* quota */ }
  }

  (function initTheme() {
    try {
      const saved = localStorage.getItem('pastq-theme');
      if (saved === 'dark') return applyTheme(true);
      if (saved === 'light') return applyTheme(false);
    } catch (e) { /* no storage */ }
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) applyTheme(true);
  })();

  darkToggle.on('click', function () {
    applyTheme(!$('html').hasClass('dark'));
  });

  // ========== TOAST ==========
  let toastTimer = null;
  function showToast(message, duration) {
    duration = duration || 2500;
    const $t = $('#toast');
    $('#toastMessage').text(message);
    $t.removeClass('hidden toast-hidden').addClass('toast-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      $t.removeClass('toast-visible').addClass('toast-hidden');
      setTimeout(function () { $t.addClass('hidden'); }, 300);
    }, duration);
  }

  // ========== COPY PROMPT (Landing page) ==========
  $('#copyPrompt').on('click', function () {
    const text = $('#aiPrompt').text();
    navigator.clipboard.writeText(text).then(function () {
      $('#copyPrompt .copy-label').text('Copied!');
      showToast('Prompt copied to clipboard');
      setTimeout(function () { $('#copyPrompt .copy-label').text('Copy'); }, 2000);
    }).catch(function () {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      $('#copyPrompt .copy-label').text('Copied!');
      showToast('Prompt copied to clipboard');
      setTimeout(function () { $('#copyPrompt .copy-label').text('Copy'); }, 2000);
    });
  });

  // ========== QUIZ PAGE LOGIC ==========
  if ($('#jsonInput').length === 0) return; // Not on quiz page

  let quizData = [];
  let userAnswers = {};
  let bookmarkedQuestions = new Set();
  let currentFilter = 'all';
  let timerInterval = null;
  let timerSeconds = 0;
  let startTime = null;

  const SAMPLE_QUIZ = [
    {
      question: "1. What is the derivative of x²?",
      options: ["A) x", "B) 2x", "C) x²", "D) 2x²"],
      correctAnswer: "B",
      explanation: "Using the power rule, the derivative of x² is 2x¹ = 2x."
    },
    {
      question: "2. Which of the following is NOT a fundamental force of nature?",
      options: ["A) Gravitational force", "B) Electromagnetic force", "C) Centrifugal force", "D) Strong nuclear force"],
      correctAnswer: "C",
      explanation: "Centrifugal force is a pseudo-force (fictitious force) that appears in a rotating reference frame. The four fundamental forces are gravitational, electromagnetic, strong nuclear, and weak nuclear."
    },
    {
      question: "3. The chemical formula for water is:",
      options: ["A) CO₂", "B) H₂O", "C) NaCl", "D) O₂"],
      correctAnswer: "B",
      explanation: "Water consists of two hydrogen atoms bonded to one oxygen atom, giving the formula H₂O."
    },
    {
      question: "4. In economics, GDP stands for:",
      options: ["A) General Domestic Price", "B) Gross Domestic Product", "C) Global Development Plan", "D) Gross Demand Projection"],
      correctAnswer: "B",
      explanation: "GDP stands for Gross Domestic Product — the total monetary value of all goods and services produced within a country's borders in a given time period."
    },
    {
      question: "5. Who wrote 'Things Fall Apart'?",
      options: ["A) Wole Soyinka", "B) Chimamanda Adichie", "C) Chinua Achebe", "D) Ngũgĩ wa Thiong'o"],
      correctAnswer: "C",
      explanation: "Things Fall Apart was written by Nigerian author Chinua Achebe, published in 1958. It is one of the most widely read books in African literature."
    },
    {
      question: "6. What is the SI unit of electric current?",
      options: ["A) Volt", "B) Watt", "C) Ampere", "D) Ohm"],
      correctAnswer: "C",
      explanation: "The SI unit of electric current is the Ampere (A), named after André-Marie Ampère."
    },
    {
      question: "7. The mitochondria is known as the 'powerhouse of the cell' because it:",
      options: ["A) Stores genetic information", "B) Produces ATP through cellular respiration", "C) Synthesizes proteins", "D) Controls cell division"],
      correctAnswer: "B",
      explanation: "Mitochondria generate most of the cell's supply of adenosine triphosphate (ATP), the molecule used as the primary energy currency of the cell."
    },
    {
      question: "8. Nigeria gained independence in which year?",
      options: ["A) 1957", "B) 1960", "C) 1963", "D) 1966"],
      correctAnswer: "B",
      explanation: "Nigeria gained independence from British colonial rule on October 1, 1960."
    },
    {
      question: "9. In a binary number system, what is 1010 in decimal?",
      options: ["A) 8", "B) 10", "C) 12", "D) 14"],
      correctAnswer: "B",
      explanation: "1010 in binary = 1×2³ + 0×2² + 1×2¹ + 0×2⁰ = 8 + 0 + 2 + 0 = 10."
    },
    {
      question: "10. Which blood type is considered the universal donor?",
      options: ["A) Type A", "B) Type B", "C) Type AB", "D) Type O negative"],
      correctAnswer: "D",
      explanation: "Type O negative blood lacks A, B, and Rh antigens, making it compatible with all blood types. It is therefore considered the universal donor type."
    }
  ];

  // ========== CLEAR INPUT ==========
  const $input = $('#jsonInput');
  const $clear = $('#clearInput');

  $input.on('input', function () {
    $clear.css('opacity', $input.val().trim() ? 1 : 0);
  });

  $clear.on('click', function () {
    $input.val('').trigger('input').focus();
  });

  // ========== TIMER TOGGLE ==========
  $('#timerToggle').on('change', function () {
    $('#timerDuration').toggleClass('hidden', !this.checked).toggleClass('flex', this.checked);
  });

  // ========== LOAD SAMPLE ==========
  $('#loadSample').on('click', function () {
    $input.val(JSON.stringify(SAMPLE_QUIZ, null, 2)).trigger('input');
    showToast('Sample quiz loaded');
  });

  // ========== SAVED QUIZZES ==========
  function loadSavedQuizzes() {
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem('pastq-saved') || '[]'); } catch (e) { /* corrupt */ }
    if (saved.length === 0) {
      $('#savedQuizzesSection').addClass('hidden');
      return;
    }
    $('#savedQuizzesSection').removeClass('hidden');
    $('#savedCount').text(saved.length);
    const $list = $('#savedList').empty();
    saved.forEach(function (item, i) {
      const date = new Date(item.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
      const $card = $(`
        <div class="saved-quiz-card group flex items-center justify-between p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 hover:border-brand-400 dark:hover:border-brand-500 cursor-pointer transition-all" data-index="${i}">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="shrink-0 w-10 h-10 rounded-lg bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center">
              <span class="text-sm font-bold text-brand-600 dark:text-brand-400">${item.count}</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">${escapeHtml(item.name)}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">${item.count} Qs · ${date}</p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0 ml-3">
            <span class="text-xs font-medium text-brand-600 dark:text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity">Start →</span>
            <button class="delete-saved p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all" data-index="${i}" aria-label="Delete quiz">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      `);
      $list.append($card);
    });
  }

  // Click a saved quiz card to start it directly
  $(document).on('click', '.saved-quiz-card', function (e) {
    if ($(e.target).closest('.delete-saved').length) return;
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem('pastq-saved') || '[]'); } catch (e) { return; }
    const idx = parseInt($(this).data('index'), 10);
    if (saved[idx]) {
      quizData = saved[idx].data;
      userAnswers = {};
      bookmarkedQuestions = new Set();
      currentFilter = 'all';
      buildQuiz(quizData);
      $('#inputSection').addClass('hidden');
      $('#quizSection').removeClass('hidden');
      $('#resultsSection').addClass('hidden');
      if ($('#timerToggle').is(':checked')) {
        startTimer(parseInt($('#timerMinutes').val(), 10) || 30);
      }
      startTime = Date.now();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showToast('Started: ' + saved[idx].name, 2500);
    }
  });

  $(document).on('click', '.delete-saved', function (e) {
    e.stopPropagation();
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem('pastq-saved') || '[]'); } catch (e) { return; }
    const idx = parseInt($(this).data('index'), 10);
    saved.splice(idx, 1);
    try { localStorage.setItem('pastq-saved', JSON.stringify(saved)); } catch (e) { /* quota */ }
    loadSavedQuizzes();
    showToast('Quiz deleted');
  });

  // Search quizzes
  $('#searchQuizzes').on('input', function () {
    const query = $(this).val().toLowerCase();
    $('.saved-quiz-card').each(function () {
      const text = $(this).text().toLowerCase();
      $(this).toggle(text.includes(query));
    });
  });

  loadSavedQuizzes();

  // ========== GENERATE QUIZ ==========
  $('#generateBtn').on('click', function () {
    const raw = $input.val().trim();
    if (!raw) {
      showError('Please paste your JSON quiz data above.');
      return;
    }
    generateQuiz(raw);
  });

  function showError(msg) {
    $('#jsonError').html(escapeHtml(msg)).removeClass('hidden').addClass('animate-shake');
    setTimeout(function () { $('#jsonError').removeClass('animate-shake'); }, 500);
  }

  function clearError() {
    $('#jsonError').addClass('hidden');
  }

  function generateQuiz(raw) {
    clearError();

    // Try to extract JSON from potential markdown code fences
    let jsonStr = raw;
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      showError('Invalid JSON — please check the AI output. Error: ' + e.message);
      return;
    }

    // Accept object with a questions array, or a direct array
    if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.questions)) {
      parsed = parsed.questions;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      showError('The JSON should be an array of quiz questions (or an object with a "questions" array). Got: ' + typeof parsed);
      return;
    }

    // Validate structure
    const errors = [];
    parsed.forEach(function (q, i) {
      if (!q.question) errors.push('Question ' + (i + 1) + ' is missing a "question" field.');
      if (!Array.isArray(q.options) || q.options.length < 2) errors.push('Question ' + (i + 1) + ' needs at least 2 options.');
      if (!q.correctAnswer) errors.push('Question ' + (i + 1) + ' is missing "correctAnswer".');
    });

    if (errors.length > 0) {
      showError(errors.slice(0, 3).join(' ') + (errors.length > 3 ? ' ...and ' + (errors.length - 3) + ' more errors.' : ''));
      return;
    }

    // Normalize correctAnswer to letter only
    parsed = parsed.map(function (q) {
      let ans = (q.correctAnswer || '').toString().trim().toUpperCase();
      // Handle "A) text" or "A. text" -> "A"
      if (ans.length > 1) {
        const m = ans.match(/^([A-Z])/);
        if (m) ans = m[1];
      }
      return Object.assign({}, q, { correctAnswer: ans });
    });

    // Shuffle questions if enabled
    if ($('#shuffleToggle').is(':checked')) {
      parsed = shuffleArray(parsed);
    }

    quizData = parsed;
    userAnswers = {};

    // Save to localStorage with custom name
    var quizName = $('#quizNameInput').val().trim();
    saveQuiz(parsed, quizName);
    $('#quizNameInput').val('');

    // Build quiz UI
    buildQuiz(parsed);

    // Switch sections
    $('#inputSection').addClass('hidden');
    $('#quizSection').removeClass('hidden');
    $('#resultsSection').addClass('hidden');

    // Start timer if enabled
    if ($('#timerToggle').is(':checked')) {
      startTimer(parseInt($('#timerMinutes').val(), 10) || 30);
    }

    startTime = Date.now();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function saveQuiz(data, customName) {
    try {
      let saved = JSON.parse(localStorage.getItem('pastq-saved') || '[]');
      // Detect duplicate by first question
      const firstQ = data[0].question;
      const exists = saved.some(function (s) { return s.data[0] && s.data[0].question === firstQ; });
      if (!exists) {
        var name = customName || firstQ.replace(/^\d+[\.\)]\s*/, '').substring(0, 50) + (firstQ.length > 50 ? '...' : '');
        saved.unshift({ name: name, count: data.length, date: new Date().toISOString(), data: data });
        if (saved.length > 20) saved = saved.slice(0, 20);
        localStorage.setItem('pastq-saved', JSON.stringify(saved));
        loadSavedQuizzes();
      }
    } catch (e) { /* quota or access error */ }
  }

  function buildQuiz(data) {
    const $container = $('#questionsContainer').empty();
    $('#questionCount').text(data.length + ' question' + (data.length !== 1 ? 's' : ''));

    data.forEach(function (q, idx) {
      const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      let optionsHtml = '';
      q.options.forEach(function (opt, oi) {
        const letter = letters[oi] || String.fromCharCode(65 + oi);
        // Strip leading letter prefix if present (e.g., "A) text" -> "text")
        const cleanOpt = opt.replace(/^[A-Za-z][\)\.\-\s]+/, '').trim();
        const inputId = 'q' + idx + '_o' + oi;
        optionsHtml += `
          <label for="${inputId}" class="option-label flex items-start gap-3 p-3 sm:p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40" data-question="${idx}" data-letter="${letter}">
            <input type="radio" id="${inputId}" name="q${idx}" value="${letter}" class="mt-0.5 w-4 h-4 text-brand-600 border-gray-300 dark:border-gray-600 focus:ring-brand-500/40 shrink-0">
            <span class="text-sm text-gray-700 dark:text-gray-300"><span class="font-semibold">${escapeHtml(letter)})</span> ${escapeHtml(cleanOpt)}</span>
          </label>`;
      });

      const card = `
        <div class="question-card p-5 sm:p-6 rounded-2xl bg-white dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/50 shadow-sm" data-question-index="${idx}">
          <div class="flex items-start justify-between gap-3 mb-4">
            <div class="flex items-start gap-3 flex-1">
              <span class="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-xs font-bold">${idx + 1}</span>
              <p class="text-sm sm:text-base font-medium text-gray-900 dark:text-white leading-relaxed">${escapeHtml(q.question.replace(/^\d+[\.\)]\s*/, ''))}</p>
            </div>
            <button class="bookmark-btn shrink-0 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all" data-question-index="${idx}" aria-label="Bookmark question">
              <svg class="bookmark-icon w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
            </button>
          </div>
          <div class="grid gap-2 sm:gap-2.5 ml-10">
            ${optionsHtml}
          </div>
        </div>`;
      $container.append(card);
    });

    updateProgress();
    updateFilterCounts();
    
    // Restore bookmarked states
    bookmarkedQuestions.forEach(function(qIdx) {
      updateBookmarkButton(qIdx);
    });
  }

  // ========== OPTION SELECTION ==========
  $(document).on('change', '#questionsContainer input[type="radio"]', function () {
    const $label = $(this).closest('.option-label');
    const qIdx = $label.data('question');
    const letter = $label.data('letter');

    // Clear sibling selection
    $label.siblings('.option-label').removeClass('selected');
    $label.addClass('selected');

    userAnswers[qIdx] = letter;
    updateProgress();

    // Practice mode: Show answer immediately
    if ($('#practiceModeToggle').is(':checked')) {
      showPracticeModeFeedback(qIdx, letter);
    }
  });

  function updateProgress() {
    const total = quizData.length;
    const answered = Object.keys(userAnswers).length;
    const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

    $('#progressLabel').text('Answered ' + answered + ' of ' + total);
    $('#progressPercent').text(pct + '%');
    $('#progressBar').css('width', pct + '%');
    
    updateFilterCounts();
  }

  // ========== TIMER ==========
  function startTimer(minutes) {
    timerSeconds = minutes * 60;
    $('#timerDisplay').removeClass('hidden').addClass('flex');
    updateTimerDisplay();

    timerInterval = setInterval(function () {
      timerSeconds--;
      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        timerSeconds = 0;
        showToast('Time\'s up! Submitting quiz...');
        submitQuiz();
      }
      updateTimerDisplay();
    }, 1000);
  }

  function updateTimerDisplay() {
    const m = Math.floor(timerSeconds / 60);
    const s = timerSeconds % 60;
    const text = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    const $el = $('#timerText');
    $el.text(text);

    // Urgency colors
    const $wrap = $('#timerDisplay');
    $wrap.removeClass('timer-warning timer-danger text-gray-700 dark:text-gray-300');
    if (timerSeconds <= 60) {
      $wrap.addClass('timer-danger');
    } else if (timerSeconds <= 300) {
      $wrap.addClass('timer-warning');
    }
  }

  function stopTimer() {
    clearInterval(timerInterval);
    $('#timerDisplay').addClass('hidden').removeClass('flex');
  }

  // ========== SUBMIT QUIZ ==========
  $('#submitQuiz').on('click', function () {
    submitQuiz();
  });

  function submitQuiz() {
    stopTimer();

    const total = quizData.length;
    let correct = 0;
    const results = [];
    wrongQuestions = [];

    quizData.forEach(function (q, idx) {
      const chosen = userAnswers[idx] || null;
      const isCorrect = chosen === q.correctAnswer;
      if (isCorrect) correct++;
      else wrongQuestions.push(q); // Store wrong questions
      
      results.push({
        index: idx,
        question: q.question,
        options: q.options,
        chosen: chosen,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || '',
        isCorrect: isCorrect
      });
    });

    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const elapsed = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;

    // Determine rank
    let rank, emoji, message, rankColor;
    if (pct >= 90) {
      rank = 'Outstanding'; emoji = '🏆'; message = 'You\'re crushing it! Almost perfect score.'; rankColor = 'text-amber-500';
    } else if (pct >= 80) {
      rank = 'Excellent'; emoji = '🌟'; message = 'Great mastery of the material!'; rankColor = 'text-emerald-500';
    } else if (pct >= 70) {
      rank = 'Very Good'; emoji = '💪'; message = 'Solid performance. A little more practice and you\'ll ace it!'; rankColor = 'text-brand-500';
    } else if (pct >= 60) {
      rank = 'Good'; emoji = '👍'; message = 'You\'re on the right track. Review the corrections below.'; rankColor = 'text-blue-500';
    } else if (pct >= 50) {
      rank = 'Fair'; emoji = '📚'; message = 'You passed, but there\'s room to improve. Study the explanations.'; rankColor = 'text-violet-500';
    } else if (pct >= 40) {
      rank = 'Below Average'; emoji = '📖'; message = 'You need more practice. Review the corrections carefully.'; rankColor = 'text-orange-500';
    } else {
      rank = 'Needs Improvement'; emoji = '💡'; message = 'Don\'t worry — every expert was once a beginner. Study and retry!'; rankColor = 'text-red-500';
    }

    // Show results
    $('#quizSection').addClass('hidden');
    $('#resultsSection').removeClass('hidden');

    $('#scoreEmoji').text(emoji).addClass('animate-score');
    $('#scoreValue').text(correct);
    $('#scoreTotal').text(total);
    $('#scorePercent').text(pct + '%').addClass('animate-score');
    $('#scoreRank').text(rank).attr('class', 'text-lg font-semibold mb-1 ' + rankColor);
    $('#scoreMessage').text(message);

    if (elapsed > 0) {
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      $('#timeTaken').removeClass('hidden').text('Completed in ' + mins + 'm ' + secs + 's');
    }

    // Confetti for excellent
    if (pct >= 80) spawnConfetti();

    // Build corrections
    buildCorrections(results);

    // Save score
    saveScore(correct, total, pct, rank, elapsed);

    // Build leaderboard
    buildLeaderboard();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function buildCorrections(results) {
    const $container = $('#correctionsContainer').empty();
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    results.forEach(function (r) {
      let optionsHtml = '';
      r.options.forEach(function (opt, oi) {
        const letter = letters[oi] || String.fromCharCode(65 + oi);
        const cleanOpt = opt.replace(/^[A-Za-z][\)\.\-\s]+/, '').trim();
        let cls = 'option-label flex items-start gap-3 p-3 rounded-xl border ';

        if (letter === r.correctAnswer) {
          cls += 'correct pointer-events-none';
        } else if (letter === r.chosen && !r.isCorrect) {
          cls += 'wrong pointer-events-none';
        } else {
          cls += 'border-gray-100 dark:border-gray-700/50 pointer-events-none opacity-60';
        }

        const icon = letter === r.correctAnswer
          ? '<svg class="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>'
          : (letter === r.chosen && !r.isCorrect
            ? '<svg class="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>'
            : '<span class="w-4 h-4 shrink-0"></span>');

        optionsHtml += `
          <div class="${cls}">
            ${icon}
            <span class="text-sm"><span class="font-semibold">${escapeHtml(letter)})</span> ${escapeHtml(cleanOpt)}</span>
          </div>`;
      });

      const statusBadge = r.isCorrect
        ? '<span class="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">Correct</span>'
        : (r.chosen === null
          ? '<span class="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">Skipped</span>'
          : '<span class="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">Wrong</span>');

      const explanationHtml = r.explanation
        ? `<div class="mt-3 ml-10 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30">
             <p class="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Explanation</p>
             <p class="text-sm text-amber-800 dark:text-amber-300/90">${escapeHtml(r.explanation)}</p>
           </div>`
        : '';

      const card = `
        <div class="question-card p-5 sm:p-6 rounded-2xl bg-white dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/50 shadow-sm">
          <div class="flex items-start justify-between gap-3 mb-4">
            <div class="flex items-start gap-3">
              <span class="shrink-0 flex items-center justify-center w-7 h-7 rounded-full ${r.isCorrect ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'} text-xs font-bold">${r.index + 1}</span>
              <p class="text-sm sm:text-base font-medium text-gray-900 dark:text-white leading-relaxed">${escapeHtml(r.question.replace(/^\d+[\.\)]\s*/, ''))}</p>
            </div>
            ${statusBadge}
          </div>
          <div class="grid gap-2 ml-10">${optionsHtml}</div>
          ${explanationHtml}
        </div>`;
      $container.append(card);
    });
  }

  // ========== SCORE HISTORY ==========
  function saveScore(correct, total, pct, rank, elapsed) {
    try {
      let history = JSON.parse(localStorage.getItem('pastq-history') || '[]');
      history.unshift({
        correct: correct,
        total: total,
        pct: pct,
        rank: rank,
        elapsed: elapsed,
        date: new Date().toISOString()
      });
      if (history.length > 50) history = history.slice(0, 50);
      localStorage.setItem('pastq-history', JSON.stringify(history));
    } catch (e) { /* quota */ }
  }

  function buildLeaderboard() {
    let history = [];
    try { history = JSON.parse(localStorage.getItem('pastq-history') || '[]'); } catch (e) { /**/ }
    const $lb = $('#leaderboard').empty();

    if (history.length === 0) {
      $lb.append('<p class="text-sm text-gray-400 dark:text-gray-500">No scores yet.</p>');
      return;
    }

    history.slice(0, 10).forEach(function (entry, i) {
      const date = new Date(entry.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
      const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : ''));
      const pctColor = entry.pct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : (entry.pct >= 60 ? 'text-brand-600 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400');

      $lb.append(`
        <div class="lb-entry flex items-center justify-between p-2.5 rounded-lg border border-gray-100 dark:border-gray-700/50">
          <div class="flex items-center gap-2.5">
            <span class="text-sm w-6 text-center">${medal || (i + 1)}</span>
            <div>
              <span class="text-sm font-semibold ${pctColor}">${entry.pct}%</span>
              <span class="text-xs text-gray-400 dark:text-gray-500 ml-1.5">${entry.correct}/${entry.total}</span>
            </div>
          </div>
          <div class="text-right">
            <span class="text-xs text-gray-400 dark:text-gray-500">${date}</span>
            <span class="text-xs text-gray-300 dark:text-gray-600 ml-1.5">${entry.rank}</span>
          </div>
        </div>`);
    });
  }

  $('#clearHistory').on('click', function () {
    try { localStorage.removeItem('pastq-history'); } catch (e) { /**/ }
    buildLeaderboard();
    showToast('Score history cleared');
  });

  // ========== RETRY / NEW ==========
  let wrongQuestions = [];

  $('#retryQuiz').on('click', function () {
    userAnswers = {};
    bookmarkedQuestions.clear();
    currentFilter = 'all';
    startTime = Date.now();
    buildQuiz(quizData);

    $('#resultsSection').addClass('hidden');
    $('#quizSection').removeClass('hidden');

    if ($('#timerToggle').is(':checked')) {
      startTimer(parseInt($('#timerMinutes').val(), 10) || 30);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  $('#reviewWrong').on('click', function () {
    if (wrongQuestions.length === 0) {
      showToast('No wrong answers to review!');
      return;
    }

    userAnswers = {};
    bookmarkedQuestions.clear();
    currentFilter = 'all';
    startTime = Date.now();
    
    // Filter quiz data to only wrong questions
    quizData = wrongQuestions.slice();
    
    buildQuiz(quizData);

    $('#resultsSection').addClass('hidden');
    $('#quizSection').removeClass('hidden');

    showToast(`Reviewing ${wrongQuestions.length} wrong answer${wrongQuestions.length !== 1 ? 's' : ''}`);

    if ($('#timerToggle').is(':checked')) {
      startTimer(parseInt($('#timerMinutes').val(), 10) || 30);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  $('#newQuiz, #backToInput').on('click', function () {
    stopTimer();
    clearProgress();
    quizData = [];
    userAnswers = {};
    bookmarkedQuestions.clear();
    currentFilter = 'all';
    startTime = null;
    
    $('#quizSection').addClass('hidden');
    $('#resultsSection').addClass('hidden');
    $('#inputSection').removeClass('hidden');
    loadSavedQuizzes();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ========== SHARE ==========
  $('#shareResults').on('click', function () {
    const correct = parseInt($('#scoreValue').text(), 10);
    const total = parseInt($('#scoreTotal').text(), 10);
    const pct = $('#scorePercent').text();
    const rank = $('#scoreRank').text();
    const text = `📝 PastQ Quiz Result\n🏅 Score: ${correct}/${total} (${pct})\n🎯 Rank: ${rank}\n\nTry it: pastq.pages.dev`;

    if (navigator.share) {
      navigator.share({ title: 'PastQ Quiz Result', text: text }).catch(function () { /* cancelled */ });
    } else {
      navigator.clipboard.writeText(text).then(function () {
        showToast('Result copied to clipboard!');
      }).catch(function () {
        showToast('Could not copy to clipboard');
      });
    }
  });

  // ========== CONFETTI ==========
  function spawnConfetti() {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    for (let i = 0; i < 40; i++) {
      const $piece = $('<div class="confetti-piece"></div>');
      $piece.css({
        left: Math.random() * 100 + 'vw',
        width: Math.random() * 8 + 4 + 'px',
        height: Math.random() * 8 + 4 + 'px',
        backgroundColor: colors[Math.floor(Math.random() * colors.length)],
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        animationDuration: Math.random() * 2 + 2 + 's',
        animationDelay: Math.random() * 0.5 + 's'
      });
      $('body').append($piece);
      setTimeout(function () { $piece.remove(); }, 5000);
    }
  }

  // ========== SHUFFLE ARRAY ==========
  function shuffleArray(array) {
    const shuffled = array.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // ========== PRACTICE MODE ==========
  function showPracticeModeFeedback(qIdx, chosenLetter) {
    const question = quizData[qIdx];
    if (!question) return;

    const $card = $(`.question-card[data-question-index="${qIdx}"]`);
    const $options = $card.find('.option-label');
    const isCorrect = chosenLetter === question.correctAnswer;

    // Mark correct and wrong options
    $options.each(function () {
      const $opt = $(this);
      const letter = $opt.data('letter');
      
      if (letter === question.correctAnswer) {
        $opt.addClass('correct');
      } else if (letter === chosenLetter && !isCorrect) {
        $opt.addClass('wrong');
      }
      
      // Disable all options
      $opt.find('input').prop('disabled', true);
    });

    // Show explanation if available
    if (question.explanation) {
      const explanationHtml = `
        <div class="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 animate-slide-down">
          <p class="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
            ${isCorrect ? '✓ Correct!' : '✗ Incorrect'}
          </p>
          <p class="text-sm text-amber-800 dark:text-amber-300/90">${escapeHtml(question.explanation)}</p>
        </div>`;
      $card.find('.grid').after(explanationHtml);
    }

    // Haptic feedback on mobile
    if (navigator.vibrate) {
      navigator.vibrate(isCorrect ? [100] : [100, 50, 100]);
    }

    // Visual feedback
    if (isCorrect) {
      showToast('✓ Correct!', 1500);
    }
  }

  // ========== TOUCH GESTURES ==========
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  $(document).on('touchstart', '#questionsContainer', function (e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  });

  $(document).on('touchend', '#questionsContainer', function (e) {
    touchEndX = e.changedTouches[0].clientX;
    touchEndY = e.changedTouches[0].clientY;
    handleSwipe();
  });

  function handleSwipe() {
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const minSwipeDistance = 50;

    // Horizontal swipe (ignore vertical scrolling)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
      if (deltaX > 0) {
        // Swipe right - scroll to top (refresh)
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  // ========== FONT SIZE CONTROLS ==========
  let currentFontSize = 'font-md';
  const fontSizes = ['font-sm', 'font-md', 'font-lg', 'font-xl'];
  
  (function initFontSize() {
    try {
      const saved = localStorage.getItem('pastq-fontsize');
      if (saved && fontSizes.includes(saved)) {
        currentFontSize = saved;
        $('body').removeClass(fontSizes.join(' ')).addClass(currentFontSize);
      }
    } catch (e) { /* no storage */ }
  })();

  $('#fontSizeToggle').on('click', function () {
    const currentIndex = fontSizes.indexOf(currentFontSize);
    const nextIndex = (currentIndex + 1) % fontSizes.length;
    currentFontSize = fontSizes[nextIndex];
    $('body').removeClass(fontSizes.join(' ')).addClass(currentFontSize);
    try { localStorage.setItem('pastq-fontsize', currentFontSize); } catch (e) { /* quota */ }
    
    const sizeNames = { 'font-sm': 'Small', 'font-md': 'Medium', 'font-lg': 'Large', 'font-xl': 'Extra Large' };
    showToast('Font size: ' + sizeNames[currentFontSize], 1500);
  });

  // ========== STUDY STREAKS ==========
  function updateStreak() {
    try {
      const today = new Date().toDateString();
      let streakData = JSON.parse(localStorage.getItem('pastq-streak') || '{"count":0,"lastDate":""}');
      
      if (streakData.lastDate === today) {
        // Already counted today
      } else {
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (streakData.lastDate === yesterday) {
          // Continue streak
          streakData.count++;
        } else if (streakData.lastDate === '') {
          // First time
          streakData.count = 1;
        } else {
          // Streak broken
          streakData.count = 1;
        }
        streakData.lastDate = today;
        localStorage.setItem('pastq-streak', JSON.stringify(streakData));
      }
      
      if (streakData.count > 0) {
        $('#streakCount').text(streakData.count);
        $('#streakBadge').removeClass('hidden').addClass('flex');
      }
    } catch (e) { /* quota */ }
  }

  updateStreak();

  // ========== IMPORT/EXPORT ==========
  $('#importQuiz').on('click', function () {
    $('#importFileInput').click();
  });

  $('#importFileInput').on('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      try {
        const content = event.target.result;
        const data = JSON.parse(content);
        $('#jsonInput').val(JSON.stringify(data, null, 2)).trigger('input');
        showToast('Quiz imported successfully!');
      } catch (err) {
        showToast('Error: Invalid quiz file');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    e.target.value = '';
  });

  $('#exportQuiz').on('click', function () {
    const raw = $('#jsonInput').val().trim();
    if (!raw) {
      showToast('No quiz data to export');
      return;
    }

    try {
      // Validate JSON
      JSON.parse(raw);
      
      // Create and download file
      const blob = new Blob([raw], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pastq-quiz-' + Date.now() + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast('Quiz exported successfully!');
    } catch (e) {
      showToast('Error: Invalid JSON');
    }
  });

  // ========== QUESTION BOOKMARKING ==========
  function toggleBookmark(qIdx) {
    if (bookmarkedQuestions.has(qIdx)) {
      bookmarkedQuestions.delete(qIdx);
    } else {
      bookmarkedQuestions.add(qIdx);
    }
    updateBookmarkButton(qIdx);
    updateFilterCounts();
    saveProgress();
  }

  function updateBookmarkButton(qIdx) {
    const $btn = $(`.question-card[data-question-index="${qIdx}"] .bookmark-btn`);
    $btn.toggleClass('bookmarked', bookmarkedQuestions.has(qIdx));
  }

  $(document).on('click', '.bookmark-btn', function (e) {
    e.preventDefault();
    e.stopPropagation();
    const qIdx = parseInt($(this).attr('data-question-index'), 10);
    toggleBookmark(qIdx);
  });

  // ========== QUESTION FILTERS ==========
  $('#showAllQuestions').on('click', function () {
    currentFilter = 'all';
    $('.filter-btn').removeClass('active');
    $(this).addClass('active');
    applyFilter();
  });

  $('#showBookmarked').on('click', function () {
    currentFilter = 'bookmarked';
    $('.filter-btn').removeClass('active');
    $(this).addClass('active');
    applyFilter();
  });

  $('#showUnanswered').on('click', function () {
    currentFilter = 'unanswered';
    $('.filter-btn').removeClass('active');
    $(this).addClass('active');
    applyFilter();
  });

  function applyFilter() {
    $('.question-card').each(function () {
      const qIdx = parseInt($(this).data('question-index'), 10);
      let show = true;

      if (currentFilter === 'bookmarked') {
        show = bookmarkedQuestions.has(qIdx);
      } else if (currentFilter === 'unanswered') {
        show = !userAnswers.hasOwnProperty(qIdx);
      }

      $(this).toggle(show);
    });

    // Scroll to first visible question
    const $first = $('.question-card:visible').first();
    if ($first.length) {
      $first[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function updateFilterCounts() {
    const total = quizData.length;
    const bookmarked = bookmarkedQuestions.size;
    const answered = Object.keys(userAnswers).length;
    const unanswered = total - answered;

    $('#countAll').text(total);
    $('#countBookmarked').text(bookmarked);
    $('#countUnanswered').text(unanswered);
  }

  // ========== PROGRESS PERSISTENCE ==========
  function saveProgress() {
    if (quizData.length === 0) return;
    try {
      const progressData = {
        quizData: quizData,
        userAnswers: userAnswers,
        bookmarked: Array.from(bookmarkedQuestions),
        timestamp: Date.now()
      };
      localStorage.setItem('pastq-progress', JSON.stringify(progressData));
    } catch (e) { /* quota */ }
  }

  function loadProgress() {
    try {
      const saved = localStorage.getItem('pastq-progress');
      if (!saved) return false;

      const progressData = JSON.parse(saved);
      
      // Check if progress is less than 24 hours old
      const ageHours = (Date.now() - progressData.timestamp) / (1000 * 60 * 60);
      if (ageHours > 24) {
        localStorage.removeItem('pastq-progress');
        return false;
      }

      // Restore data
      quizData = progressData.quizData;
      userAnswers = progressData.userAnswers || {};
      bookmarkedQuestions = new Set(progressData.bookmarked || []);

      return true;
    } catch (e) {
      return false;
    }
  }

  function clearProgress() {
    try {
      localStorage.removeItem('pastq-progress');
    } catch (e) { /* no storage */ }
  }

  function resumeSavedQuiz() {
    buildQuiz(quizData);
    $('#inputSection').addClass('hidden');
    $('#quizSection').removeClass('hidden');
    $('#resultsSection').addClass('hidden');
    showToast('Quiz resumed', 2000);
  }

  // Check for saved progress on page load
  if (loadProgress()) {
    // Show the resume modal instead of auto-loading
    $('#resumeModal').css('display', 'flex');
  }

  // Continue Quiz button
  $('#continueQuizBtn').on('click', function () {
    $('#resumeModal').css('display', 'none');
    resumeSavedQuiz();
  });

  // Start Fresh button
  $('#startFreshBtn').on('click', function () {
    $('#resumeModal').css('display', 'none');
    clearProgress();
    quizData = [];
    userAnswers = {};
    bookmarkedQuestions = new Set();
    showToast('Starting fresh', 2000);
  });

  // Exit Quiz button
  $('#exitQuiz').on('click', function () {
    if (confirm('Are you sure you want to exit this quiz? Your progress will be lost.')) {
      clearProgress();
      quizData = [];
      userAnswers = {};
      bookmarkedQuestions = new Set();
      $('#quizSection').addClass('hidden');
      $('#resultsSection').addClass('hidden');
      $('#inputSection').removeClass('hidden');
      $('#jsonInput').val('');
      showToast('Quiz exited', 2000);
    }
  });

  // Auto-save progress when answering questions
  $(document).on('change', '#questionsContainer input[type="radio"]', function () {
    saveProgress();
  });

  // ========== UTILITY ==========
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
});
