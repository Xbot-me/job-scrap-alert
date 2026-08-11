import os
import json
import urllib.request
import xml.etree.ElementTree as ET
from dotenv import load_dotenv
from google import genai
from google.genai import types
import requests

# Load environment variables
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

if not all([GEMINI_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID]):
    print("Error: Missing required environment variables. Please check your .env file.")
    exit(1)

# Initialize Gemini Client
client = genai.Client(api_key=GEMINI_API_KEY)

import re

def parse_config():
    config_path = "search_config.md"
    roles = []
    technologies = []
    avoid = []
    
    current_section = None
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line.startswith("## Roles"):
                    current_section = "roles"
                elif line.startswith("## Technologies"):
                    current_section = "tech"
                elif line.startswith("## Red Flags"):
                    current_section = "avoid"
                
                # Check for checked items: - [x] or - [X] or * [x]
                match = re.match(r'^[-*]\s+\[[xX]\]\s+(.*)', line)
                if match:
                    item = match.group(1).strip()
                    if current_section == "roles":
                        roles.append(item)
                    elif current_section == "tech":
                        technologies.append(item)
                    elif current_section == "avoid":
                        avoid.append(item)
                        
    return {
        "roles": roles,
        "technologies": technologies,
        "avoid": avoid
    }

def get_candidate_profile():
    config = parse_config()
    roles_str = ", ".join(config["roles"]) if config["roles"] else "Software Developer"
    tech_str = ", ".join(config["technologies"]) if config["technologies"] else "Modern Web Tech"
    avoid_str = ", ".join(config["avoid"]) if config["avoid"] else "Scams"
    
    return f"""
Location: Dhaka, Bangladesh (seeking Global Remote work)
Experience: 6+ years as a {roles_str}.
Key Skills: {tech_str}.
Avoid: {avoid_str}.
"""

def fetch_remotive_jobs():
    jobs = []
    url = "https://remotive.com/api/remote-jobs?category=software-dev"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        response = urllib.request.urlopen(req, timeout=10)
        data = json.loads(response.read())
        for job in data.get('jobs', []):
            jobs.append({
                'id': f"remotive_{job.get('id')}",
                'title': job.get('title', ''),
                'company': job.get('company_name', ''),
                'url': job.get('url', ''),
                'description': job.get('description', ''),
                'location': job.get('candidate_required_location', '')
            })
    except Exception as e:
        print(f"Error fetching Remotive: {e}")
    return jobs

def fetch_wwr_jobs():
    jobs = []
    feeds = [
        "https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss",
        "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss"
    ]
    for feed in feeds:
        req = urllib.request.Request(feed, headers={'User-Agent': 'Mozilla/5.0'})
        try:
            response = urllib.request.urlopen(req, timeout=10)
            root = ET.fromstring(response.read())
            for item in root.findall('./channel/item'):
                guid = item.findtext('guid', '')
                title = item.findtext('title', '')
                company = title.split(':')[0] if ':' in title else ''
                job_title = title.split(':')[1].strip() if ':' in title else title
                desc = item.findtext('description', '')
                link = item.findtext('link', '')
                
                jobs.append({
                    'id': f"wwr_{guid.split('/')[-1]}",
                    'title': job_title,
                    'company': company,
                    'url': link,
                    'description': desc,
                    'location': "See description"
                })
        except Exception as e:
            print(f"Error fetching WWR {feed}: {e}")
    return jobs

def analyze_job(job):
    profile = get_candidate_profile()
    prompt = f"""
    Act as a rigorous job recruiter and scam verifier. Evaluate this job posting against my candidate profile.
    
    Candidate Profile:
    {profile}
    
    Job Title: {job['title']}
    Company: {job['company']}
    Location Required: {job['location']}
    Description snippet: {job['description'][:2500]}
    
    Instructions:
    1. Score the job from 0 to 100 based on fit. (0 = terrible fit/mobile role/scam, 100 = perfect match for PHP/Go/Next.js global remote).
    2. Check if the location restricts Bangladesh (e.g. "US Only", "Europe Only"). If so, heavily penalize the score.
    3. Look for scam indicators (asking for crypto, unpaid work, "chat to earn").
    4. Provide a brief 1-sentence reason for the score.
    """
    
    try:
        interaction = client.interactions.create(
            model='gemini-3.6-flash',
            input=prompt,
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": {
                    "type": "object",
                    "properties": {
                        "score": {"type": "integer", "description": "0-100 fit score"},
                        "reason": {"type": "string", "description": "1 sentence reason"},
                        "is_scam_or_spam": {"type": "boolean"}
                    },
                    "required": ["score", "reason", "is_scam_or_spam"]
                }
            }
        )
        return json.loads(interaction.output_text)
    except Exception as e:
        print(f"Error in Gemini analysis: {e}")
        return None

def send_telegram_message(text):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True
    }
    try:
        requests.post(url, json=payload)
    except Exception as e:
        print(f"Error sending to Telegram: {e}")

def main():
    state_file = "seen_jobs.json"
    
    if os.path.exists(state_file):
        with open(state_file, 'r') as f:
            seen_jobs = set(json.load(f))
    else:
        seen_jobs = set()

    print("Fetching jobs...")
    all_jobs = fetch_remotive_jobs() + fetch_wwr_jobs()
    print(f"Found {len(all_jobs)} total jobs.")
    
    # Process only new jobs, limit to recent 50 to avoid hitting API rate limits on first run
    new_jobs = [j for j in all_jobs if j['id'] not in seen_jobs][:50]
    print(f"Analyzing {len(new_jobs)} new jobs with Gemini...")

    for job in new_jobs:
        # Pre-filter out obvious bad matches to save Gemini tokens
        title_lower = job['title'].lower()
        if any(x in title_lower for x in ['ios', 'android', 'flutter', 'react native', 'mobile']):
            seen_jobs.add(job['id'])
            continue
            
        analysis = analyze_job(job)
        if analysis:
            score = analysis.get('score', 0)
            is_scam = analysis.get('is_scam_or_spam', False)
            
            if score >= 80 and not is_scam:
                print(f"Match found! {job['title']} at {job['company']}")
                msg = f"🚀 <b>New High-Match Job!</b>\n\n"
                msg += f"<b>Title:</b> {job['title']}\n"
                msg += f"<b>Company:</b> {job['company']}\n"
                msg += f"<b>Location:</b> {job['location']}\n"
                msg += f"<b>Fit Score:</b> {score}/100\n\n"
                msg += f"<b>AI Note:</b> {analysis.get('reason')}\n\n"
                msg += f"<a href='{job['url']}'>Apply Here</a>"
                
                send_telegram_message(msg)
            else:
                print(f"Skipped {job['title']} - Score: {score}")
                
        seen_jobs.add(job['id'])

    # Save state
    with open(state_file, 'w') as f:
        json.dump(list(seen_jobs), f)
        
    print("Run complete.")

if __name__ == "__main__":
    main()
