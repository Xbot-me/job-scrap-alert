# Telegram AI Job Alert Bot

This script automatically pulls remote job listings from popular sources (We Work Remotely, Remotive), analyzes them using Google's Gemini AI against your specific profile, and sends high-quality matches to your Telegram.

## Setup Instructions

### 1. Install Dependencies
```bash
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Copy the example environment file:
```bash
cp .env.example .env
```

Open `.env` and fill in the 3 required keys:

**a. Gemini API Key**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Create API Key" and paste it into `GEMINI_API_KEY`.

**b. Telegram Bot Token**
1. Open Telegram and search for `@BotFather`.
2. Send `/newbot` and follow the prompts to create a bot.
3. BotFather will give you an HTTP API Token. Paste this into `TELEGRAM_BOT_TOKEN`.

**c. Telegram Chat ID**
1. Start a chat with your newly created bot in Telegram (click Start).
2. Open your browser and go to `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Look for the `"chat":{"id":123456789,...}` block in the JSON response.
4. Copy that ID number and paste it into `TELEGRAM_CHAT_ID`.

### 3. Running via GitHub Actions (Recommended)

This repository is already configured to run completely automatically in the cloud via GitHub Actions.

1. Push this code to a private GitHub repository.
2. In your GitHub repository, go to **Settings > Secrets and variables > Actions**.
3. Click **New repository secret** and add all 3 of your keys exactly as they appear in the `.env` file:
   - `GEMINI_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
4. Also go to **Settings > Actions > General > Workflow permissions** and select **Read and write permissions** (this allows the bot to save the `seen_jobs.json` file back to the repo).
5. Go to the **Actions** tab, select **Telegram AI Job Alert**, and click **Run workflow** to test it immediately.

The bot will now automatically wake up and search for jobs every 6 hours, completely for free in the cloud!

### 4. Running Locally (Alternative)
```bash
python job_alert.py
```
