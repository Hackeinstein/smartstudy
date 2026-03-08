# PastQ — Turn Past Questions into Quizzes

<p align="center">
  <strong>Convert university past exam questions into interactive quizzes using AI.</strong><br>
  Free, fast, offline-capable, and built for Nigerian students.
</p>

---

## ✨ Features

- **AI-Powered Quiz Generation** — Paste JSON output from any AI (ChatGPT, Gemini, etc.) and instantly get an interactive quiz
- **Custom Quiz Naming** — Name your quizzes for easy identification (e.g. "BIO 201 Midterm")
- **Saved Quizzes** — All quizzes are saved locally; tap any saved quiz to start it directly
- **Practice Mode** — See correct answers immediately after each selection
- **Shuffle Questions** — Randomize question order for varied practice
- **Timed Quizzes** — Set a timer to simulate real exam conditions
- **Question Bookmarking** — Flag questions to revisit later
- **Quick Filters** — Filter by All, Flagged, or Unanswered questions
- **Review Wrong Answers** — Retry only the questions you got wrong
- **Progress Auto-Save** — Leave mid-quiz and resume where you left off
- **Import/Export** — Share quiz files with classmates via WhatsApp/Telegram
- **Study Streak Tracking** — Build daily study habits with streak badges
- **Font Size Controls** — 4 size options for comfortable reading
- **Dark Mode** — Easy on the eyes for late-night study sessions
- **Score History** — Track your performance over time
- **Share Results** — Share your quiz scores via native share or clipboard
- **PWA / Offline Support** — Install to homescreen, works without internet
- **Touch Gestures** — Mobile-optimized with swipe support

## 🚀 Live Demo

Deployed on Cloudflare Pages: [smartstudy.pages.dev](https://smartstudy.pages.dev)

## 📱 How It Works

1. **Copy the prompt** from the landing page
2. **Paste it into any AI** (ChatGPT, Gemini, Claude, etc.) along with your past questions
3. **Copy the JSON output** from the AI
4. **Paste into PastQ** and click "Generate Quiz"
5. **Take the quiz**, review corrections, and track your progress

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, JavaScript |
| Styling | Tailwind CSS |
| Interactivity | jQuery 3.7.1 |
| Storage | localStorage (no backend) |
| Hosting | Cloudflare Pages |
| PWA | Service Worker + Web App Manifest |

**100% client-side** — no server, no database, no accounts, no data collection.

## 📂 Project Structure

```
smartstudy/
├── index.html       # Landing page with instructions & AI prompt
├── quiz.html        # Quiz interface (generate, take, review)
├── app.js           # Core application logic (~1100 lines)
├── styles.css       # Custom styles & animations
├── manifest.json    # PWA manifest
├── sw.js            # Service worker for offline caching
└── sample/          # Sample data
```

## 🏗 Local Development

No build step required. Just serve the files:

```bash
# Using Python
python3 -m http.server 8000

# Using Node
npx serve .

# Then open http://localhost:8000
```

## 📦 Deployment

Push to GitHub and connect to [Cloudflare Pages](https://pages.cloudflare.com/):

- **Build command:** _(none)_
- **Build output directory:** `/`
- **Framework preset:** None

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first.

## 📄 License

MIT

---

<p align="center">
  Created by <a href="https://github.com/hackeinstein">@hackeinstein</a>
</p>
