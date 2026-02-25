import requests
import re
import json
import sys
import io
import os
import imaplib
import email
from datetime import datetime
from email.mime.text import MIMEText
from bs4 import BeautifulSoup

# ============================================================================
# CONNECTION SMOKE TEST - Verify Email Credentials Before Main Execution
# ============================================================================

print("=== RUNNING CONNECTION SMOKE TEST ===")

# Retrieve email credentials from environment
REPORTING_EMAIL = os.getenv('REPORTING_EMAIL')
REPORTING_APP_PASSWORD = os.getenv('REPORTING_APP_PASSWORD')

# Check if credentials are missing
if not REPORTING_EMAIL:
    print("ERROR: Secret REPORTING_EMAIL is missing from environment.")
if not REPORTING_APP_PASSWORD:
    print("ERROR: Secret REPORTING_APP_PASSWORD is missing from environment.")

# Only attempt connection if both credentials are available
if REPORTING_EMAIL and REPORTING_APP_PASSWORD:
    try:
        # Attempt IMAP connection to Gmail
        print(f"Attempting connection to Gmail with {REPORTING_EMAIL}...")
        mail = imaplib.IMAP4_SSL('imap.gmail.com')
        mail.login(REPORTING_EMAIL, REPORTING_APP_PASSWORD)
        print(f"SMOKE TEST PASSED: Successfully logged into {REPORTING_EMAIL}")
        mail.logout()
    except Exception as e:
        print(f"SMOKE TEST FAILED: {str(e)}")
else:
    print("SMOKE TEST SKIPPED: Missing required environment variables")

print("=== SMOKE TEST COMPLETE ===\n")

# Force UTF-8 output for Windows console compatibility
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Check for required BeautifulSoup dependency for BrokerBay integration
try:
    from bs4 import BeautifulSoup
except ImportError:
    print("  [ERROR] BeautifulSoup4 not installed. Run: pip install beautifulsoup4")
    print("  [INFO] BrokerBay feedback extraction will be skipped.")
    BeautifulSoup = None

# ============================================================================
# HYBRID DATA STRATEGY - Primary: sellernewsemailPreview HTML Scraper
# ============================================================================

# Source 1: The Email Preview Report (Primary - for Lifetime/30-Day/Trends)
SUMMARY_URL = 'https://ntreis.mysellerreports.com/notifications/sellernewsemailPreview?authkey=A%2FH1nxu3%2FYGAqb4ZZYA9vq0SlV7Whm%2BZtrEn96oeGI5lDMjSPC4vWty4ZZwgLadqYVZTZuSDPcSMvIQyaR%2FfrxBbNNN%2B8At8Yc0M9CxFRtIOvNXzSZ%2BXgC7v9iPNA3Gxha4f7b%2FnTVkd0tKg%2Blszg4fPJ3wP5rnWeakNx88cXYxacE0yQqMOGCCGKmBd%2BJ58l52RLBijUwT2ey6PkpMmlRC4ZJ0HrfgB%2BTJg3rlwmc77pXMzS5N5HeMWHqpFQ1tPT%2BM1PwO7z%2FanNamWi1rS4afZK8%2BXOP60%2FzAFFOqXqlksfNdPv2q%2F6gMfp%2F0wwYKoQSnPdKvHRCP%2FrqsqlgalFO47G8U4ez7wS%2BtEOu8sk4WUM4cvRcndPnKS3j85X%2BS3NnxhRd2SayWmPyHouLQBs1sfa4H488wARvm1g1co6L2CSWZ36eOOhL9eSA9z42b%2BF1lx8gfhfl%2FxMkJdJuz6TQ%3D%3D'

# Source 2: The Data API (Fallback for Heat Map & Website Trends)
API_URL = 'https://ntreis.mysellerreports.com/admin/Statistics/GetSingleListing?ID=Qv37ZxwFUXyQARh87VlmpORltGYF5gvDyC5TiM%2B%2FiSQ%3D&skipauth=0'

# Source 3: Legacy Summary Report (Fallback)
LEGACY_SUMMARY_URL = 'https://r.mysellerreports.com/vpCFz3gNvgg'

DATA_JS_PATH = 'data.js'

# Full browser headers to avoid redirects and request rejection
HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/122.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
}


def extract_number(text):
    """Extract numeric value from text, handling commas."""
    if not text:
        return 0
    cleaned = text.replace(',', '').strip()
    try:
        return int(cleaned)
    except ValueError:
        return 0


# ============================================================================
# PRIMARY SCRAPER: "Bulldozer" Approach - Strip HTML, Match Plain Text
# Extremely fast and robust - no HTML parsing complexity
# ============================================================================

def strip_all_html(html):
    """
    BULLDOZER: Strip EVERY HTML tag from the response, leaving only plain text.
    Normalizes whitespace to single spaces for easy pattern matching.
    """
    # Remove all HTML tags
    text = re.sub(r'<[^>]+>', ' ', html)
    # Normalize whitespace (multiple spaces/newlines → single space)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def find_views(html):
    """
    BULLDOZER: Strip HTML to plain text, find 'VIEWS', capture number before it.
    """
    # Step 1: Convert HTML to plain text
    text = strip_all_html(html)
    
    # Step 2: Find "VIEWS" and capture the number immediately before it
    # Pattern: number followed by optional text then VIEWS
    match = re.search(r'(\d{1,3}(?:,\d{3})*|\d+)\s*(?:PROPERTY\s*)?VIEWS', text, flags=re.IGNORECASE)
    
    if match:
        val = extract_number(match.group(1))
        if val > 0:
            # Debug: show context
            start = max(0, match.start() - 10)
            end = min(len(text), match.end() + 10)
            context = text[start:end]
            print(f"  [DEBUG] VIEWS bulldozer match: {val} -> listTracTotalViews")
            print(f"  [DEBUG] Context: ...{context}...")
            return val
    
    print("  [DEBUG] VIEWS not found in plain text")
    return 0


def find_favorites(html):
    """
    BULLDOZER: Strip HTML to plain text, find 'FAVORITES', capture number before it.
    """
    # Step 1: Convert HTML to plain text
    text = strip_all_html(html)
    
    # Step 2: Find "FAVORITES" and capture the number immediately before it
    match = re.search(r'(\d{1,3}(?:,\d{3})*|\d+)\s*FAVORITES?', text, flags=re.IGNORECASE)
    
    if match:
        val = extract_number(match.group(1))
        # Debug: show context
        start = max(0, match.start() - 10)
        end = min(len(text), match.end() + 10)
        context = text[start:end]
        print(f"  [DEBUG] FAVORITES bulldozer match: {val} -> listTracInquiries")
        print(f"  [DEBUG] Context: ...{context}...")
        return val
    
    print("  [DEBUG] FAVORITES not found in plain text")
    return 0


def extract_lifetime_stats(html):
    """
    Extract LIFETIME stats using bulldozer plain-text matching.
    - Views: number before 'VIEWS'
    - Favorites: number before 'FAVORITES'
    """
    views = find_views(html)
    favorites = find_favorites(html)
    return views, favorites


def extract_30day_views(html):
    """
    BULLDOZER: Strip HTML to plain text, find 'TOTAL', capture number after it.
    """
    # Step 1: Convert HTML to plain text
    text = strip_all_html(html)
    
    # Step 2: Find "TOTAL" and capture the number immediately after it
    match = re.search(r'TOTAL\s*(\d{1,3}(?:,\d{3})*|\d+)', text, flags=re.IGNORECASE)
    
    if match:
        val = extract_number(match.group(1))
        if val > 0:
            # Debug: show context
            start = max(0, match.start() - 10)
            end = min(len(text), match.end() + 10)
            context = text[start:end]
            print(f"  [DEBUG] TOTAL bulldozer match: {val} -> listTracViews30Days")
            print(f"  [DEBUG] Context: ...{context}...")
            return val
    
    print("  [DEBUG] TOTAL not found in plain text")
    return 0


def is_noise_entry(name):
    """
    Filter out noise entries that are not valid website/city names.
    Returns True if the name should be filtered out.
    Enhanced with BrokerBay integration noise filtering.
    """
    # Noise words to filter out (header text, agent names, UI labels)
    noise_words = [
        'WEBSITE', 'WEBSITES', 'PROPERTY', 'VIEWS', 'LISTING', 'LISTINGS',
        'THOMAS MILLER', 'MILLER', 'THOMAS', 'PAST', 'DAYS', 'TOP', 'TOTAL', 
        'NAME', 'CITY', 'CITIES', 'WEEK', 'MONTH', 'YEAR', 'REPORT', 'SUMMARY', 
        'AGENT', 'BROKER', 'CLICK', 'INQUIRY', 'FAVORITE', 'FAVORITES', 'VIEW', 
        'SAVE', 'SAVES', 'EMAIL', 'PHONE', 'CONTACT', 'ADDRESS', 'MLS', 'NUMBER',
        'REACH', 'ENGAGEMENT', 'CONVERSION', 'FUNNEL', 'TREND', 'DATA', 'SYNC',
        'PENDING', 'LOADING', 'AVAILABLE', 'LAST', 'UPDATED', 'UNDEFINED',
        'BROKERBAY', 'FEEDBACK', 'SUBMITTED', 'SHOWING', 'INTEREST', 'COMMENTS'
    ]
    
    name_upper = name.upper().strip()
    
    # Exact matches to filter (common false positives)
    exact_filter = ['N/A', 'NA', 'NONE', 'NULL', 'TBD', '--', '...']
    if name_upper in exact_filter or name.strip() in exact_filter:
        return True
    
    # Check if name contains any noise words
    for noise in noise_words:
        if noise in name_upper:
            return True
    
    # Filter out phone numbers (multiple formats)
    phone_patterns = [
        r'\d{3}[\-\.\s]?\d{3}[\-\.\s]?\d{4}',  # 123-456-7890
        r'\(\d{3}\)\s?\d{3}[\-\.\s]?\d{4}',     # (123) 456-7890
        r'\+\d{1,3}\s?\d{3,}',                   # +1 234567890
        r'\d{10,}',                               # 1234567890 (10+ consecutive digits)
    ]
    for pattern in phone_patterns:
        if re.search(pattern, name):
            return True
    
    # Filter out email addresses (but NOT website domains for the websites list)
    if re.search(r'@', name):
        return True
    
    # Filter out entries that are mostly numbers (>25% digits)
    digits = sum(c.isdigit() for c in name)
    if len(name) > 0 and digits / len(name) > 0.25:
        return True
    
    # Filter out very short entries or just numbers
    if len(name) < 3 or name.isdigit():
        return True
    
    # Filter out entries with suspicious characters
    if re.search(r'[<>{}|\[\]\\^`]', name):
        return True
    
    return False


def extract_top_websites(html, limit=5):
    """
    BULLDOZER: Strip HTML, find 'TOP 10 WEBSITES' section, extract name/number pairs.
    Filters out noise entries (WEBSITE, PROPERTY, VIEWS, Thomas Miller, phone numbers, etc.)
    Returns list of dicts: [{'name': 'Zillow', 'views': 245}, ...]
    """
    websites = []
    
    # Step 1: Convert to plain text
    text = strip_all_html(html)
    
    # Step 2: Find the WEBSITES section (between "TOP 10 WEBSITES" and "TOP 10 CITIES" or "TOTAL")
    section_match = re.search(
        r'TOP\s*10\s*WEBSITES\s*(.*?)(?:TOP\s*10\s*CITIES|TOTAL\s+\d|$)',
        text, flags=re.IGNORECASE | re.DOTALL
    )
    
    if not section_match:
        print("  [DEBUG] TOP 10 WEBSITES section not found in plain text")
        return websites
    
    section = section_match.group(1)
    
    # Step 3: Find all "WebsiteName Number" pairs
    # Pattern: A single word/domain (no spaces, allows dots/hyphens) followed by a number
    pairs = re.findall(r'([A-Za-z][A-Za-z0-9\.\-]{2,40})\s+(\d{1,3}(?:,\d{3})*|\d+)', section)
    
    for name, views in pairs:
        name = name.strip()
        views_num = extract_number(views)
        # Skip entries with 0 views or noise
        if name and views_num > 0 and not is_noise_entry(name):
            websites.append({
                'name': name,
                'views': views_num
            })
    
    # Sort by views descending and take top N
    websites = sorted(websites, key=lambda x: x['views'], reverse=True)[:limit]
    
    if websites:
        print(f"  [DEBUG] Extracted {len(websites)} top websites -> listTracTopWebsites")
        for w in websites:
            print(f"    - {w['name']}: {w['views']}")
    else:
        print("  [DEBUG] No websites extracted from plain text")
    
    return websites


def extract_top_cities(html, limit=5):
    """
    TABLE-SPECIFIC BULLDOZER: Find 'TOP 10 CITIES', grab next section,
    then extract 'CityName [Number]' patterns.
    Returns list of dicts: [{'name': 'Dallas', 'views': 89}, ...]
    """
    cities = []
    
    # Step 1: Convert to plain text
    text = strip_all_html(html)
    
    # Step 2: Find 'TOP 10 CITIES' and grab the section until next major heading
    cities_match = re.search(
        r'TOP\s*10\s*CITIES\s*(.*?)(?:TOTAL\s+\d|WEEK|MONTH|YOUR\s+LISTING|$)',
        text, flags=re.IGNORECASE | re.DOTALL
    )
    
    if not cities_match:
        print("  [DEBUG] TOP 10 CITIES section not found in plain text")
        return cities
    
    section = cities_match.group(1)
    print(f"  [DEBUG] Cities section extracted: {len(section)} chars")
    
    # Step 3: Find all "CityName, ST Number" patterns
    # Pattern: "City, ST" format followed by a number
    # Example: "Dallas, TX 36" -> City: Dallas, TX, Views: 36
    pairs = re.findall(r'([A-Za-z][A-Za-z\s\-]+,\s*[A-Z]{2})\s+(\d{1,3}(?:,\d{3})*|\d+)', section)
    
    for name, views in pairs:
        name = name.strip()
        views_num = extract_number(views)
        # Validate city name - basic sanity checks
        if name and views_num > 0 and len(name) >= 4:
            # Check for obvious noise (but be lenient for city names)
            name_upper = name.upper()
            is_noise = False
            for noise in ['PROPERTY', 'VIEWS', 'LISTING', 'WEBSITE', 'TOTAL', 'PAST', 'DAYS']:
                if noise in name_upper:
                    is_noise = True
                    break
            
            if not is_noise:
                cities.append({
                    'name': name,
                    'views': views_num
                })
    
    # Sort by views descending and take top N
    cities = sorted(cities, key=lambda x: x['views'], reverse=True)[:limit]
    
    if cities:
        print(f"  [DEBUG] Extracted {len(cities)} top cities -> listTracTopCities")
        for c in cities:
            print(f"    - {c['name']}: {c['views']}")
    else:
        print("  [DEBUG] No cities extracted from plain text")
    
    return cities


# ============================================================================
# BROKERBAY EMAIL EXTRACTION - "The Bulldozer" for Feedback Intelligence
# ============================================================================

def fetch_brokerbay_feedback():
    """
    Secure IMAP connection to Gmail to extract BrokerBay feedback emails.
    Flexible search: Tries combined, then independent subject filtering if zero found.
    Returns (feedback_count, feedback_log) where feedback_log is array of new findings.
    """
    print("  [INFO] Connecting to Gmail IMAP for BrokerBay feedback...")

    # Check if BeautifulSoup is available
    if BeautifulSoup is None:
        print("  [WARN] BeautifulSoup not available - skipping BrokerBay feedback extraction")
        return 0, []

    # Get credentials from environment variables
    email_address = os.getenv('REPORTING_EMAIL')
    app_password = os.getenv('REPORTING_APP_PASSWORD')

    if not email_address or not app_password:
        print("  [ERROR] Missing email credentials - set REPORTING_EMAIL and REPORTING_APP_PASSWORD environment variables")
        return 0, []

    # IMAP and search logic
    try:
        mail = imaplib.IMAP4_SSL('imap.gmail.com')
        mail.login(email_address, app_password)
        mail.select('inbox')

        property_address = "109 Kelli"  # Adjust for partial matching
        feedback_searches = [
            (f'(SUBJECT "Feedback Submitted" SUBJECT "{property_address}")', "combined"),
            ('(SUBJECT "Feedback")', "feedback-only"),
            (f'(SUBJECT "{property_address}")', "address-only"),
        ]

        # Try combined search first, then fall back
        searched = False
        message_ids = []
        for search_query, mode in feedback_searches:
            print(f"  [DEBUG] Attempting IMAP search mode: {mode} | Query: {search_query}")
            status, messages = mail.search(None, search_query)
            if status == 'OK':
                message_ids = messages[0].split()
                print(f"  [DEBUG] Search ({mode}): {len(message_ids)} email(s) found")
                if message_ids:
                    print(f"  [DEBUG] Using search mode '{mode}' (count: {len(message_ids)})")
                    searched = True
                    break
                else:
                    print(f"  [DEBUG] No emails found in '{mode}' search. Trying other patterns.")
            else:
                print(f"  [ERROR] IMAP search failed for mode '{mode}'")
        
        if not searched or not message_ids:
            print("  [ERROR] No BrokerBay feedback emails found with any pattern")
            mail.close()
            mail.logout()
            return 0, []

        # Process the N most recent emails
        feedback_log = []
        msg_ids_to_process = list(reversed(message_ids))[:10]
        print(f"  [DEBUG] Will process the {len(msg_ids_to_process)} most recent emails")

        for idx, msg_id in enumerate(msg_ids_to_process):
            try:
                print(f"  [DEBUG] Fetching email #{idx+1}, ID={msg_id.decode() if hasattr(msg_id,'decode') else msg_id}")
                status, msg_data = mail.fetch(msg_id, '(RFC822)')
                if status != 'OK':
                    print(f"  [WARN] Unable to fetch message ID {msg_id}: status {status}")
                    continue

                if not msg_data or not msg_data[0]:
                    print(f"  [WARN] No data returned for message ID {msg_id}")
                    continue

                email_body = msg_data[0][1]
                email_message = email.message_from_bytes(email_body)

                # Date processing
                email_date = email_message.get('Date', '')
                if email_date:
                    try:
                        parsed_date = email.utils.parsedate_tz(email_date)
                        if parsed_date:
                            email_datetime = datetime.fromtimestamp(email.utils.mktime_tz(parsed_date))
                            formatted_date = email_datetime.strftime('%m/%d/%Y')
                        else:
                            formatted_date = email_date[:10]  # Fallback
                    except Exception as e:
                        print(f"  [WARN] Date parse failed: {e}")
                        formatted_date = email_date[:10]
                else:
                    formatted_date = 'Unknown'

                # Find HTML content (prefer text/html but fallback to plain text if needed)
                html_content = ""
                if email_message.is_multipart():
                    for part in email_message.walk():
                        content_type = part.get_content_type()
                        if content_type == "text/html":
                            html_content = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                            print(f"  [DEBUG] Found HTML content ({len(html_content)} chars) for email #{idx+1}")
                            break
                        elif content_type == "text/plain" and not html_content:
                            html_content = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                else:
                    content_type = email_message.get_content_type()
                    if content_type == "text/html":
                        html_content = email_message.get_payload(decode=True).decode('utf-8', errors='ignore')
                    elif content_type == "text/plain":
                        html_content = email_message.get_payload(decode=True).decode('utf-8', errors='ignore')

                if not html_content:
                    print(f"  [WARN] No HTML or plain text found on message ID {msg_id}; skipping")
                    continue

                feedback_data = parse_brokerbay_html(html_content, formatted_date)
                if feedback_data:
                    print(f"  [DEBUG] Parsed feedback: {feedback_data}")
                    feedback_log.append(feedback_data)
                else:
                    print(f"  [DEBUG] Skipped email #{idx+1} (no feedback detected)")

            except Exception as e:
                print(f"  [ERROR] Error parsing email ID {msg_id}: {e}")

        mail.close()
        mail.logout()

        print(f"  [DEBUG] Final extracted feedback entry count: {len(feedback_log)}")
        return len(feedback_log), feedback_log

    except Exception as e:
        print(f"  [ERROR] Gmail IMAP connection failed: {e}")
        return 0, []

def parse_brokerbay_html(html_content, email_date):
    """
    Parse BrokerBay HTML email to extract feedback data robustly.
    Attempts both direct and table-based extraction, with detailed debug output.
    Returns dict with {date, interest, comments} or None if parsing fails.
    """
    try:
        soup = BeautifulSoup(html_content, 'html.parser')

        # Try direct bulldozer text pattern first
        plain_text = soup.get_text(separator='\n')
        interest_level = None
        comments = None

        # Try specific table-based extraction first (BrokerBay embeds feedback in tables)
        possible_interest_labels = ['Interest Level', 'Interest', 'Interest:', 'Interest Level:', 'Interested', 'InterestLevel']
        possible_comment_labels = ['Agent Comments', 'Agent Feedback', 'Additional Comments', 'Comments', 'Feedback']

        # Look for explicit feedback table structure
        found_interest, found_comments = None, None
        # Find all tables just in case
        tables = soup.find_all(['table'])
        for t_idx, table in enumerate(tables):
            rows = table.find_all(['tr'])
            for r_idx, row in enumerate(rows):
                cells = row.find_all(['td', 'th'])
                if len(cells) < 2:
                    continue
                key = cells[0].get_text(strip=True)
                value = cells[1].get_text(" ", strip=True)
                # Debug print for table row context
                print(f"    [BROKERBAY TABLE DEBUG] Row[{t_idx}:{r_idx}] Key='{key}' Value='{value}'")
                # Check for Interest/Comments
                for interest_label in possible_interest_labels:
                    if interest_label.lower() in key.lower():
                        found_interest = value.strip()
                for comment_label in possible_comment_labels:
                    if comment_label.lower() in key.lower():
                        found_comments = value.strip()
            # If both found, break out
            if found_interest and found_comments:
                break

        if not found_interest:
            # Fall back to regex on plain text
            interest_patterns = [
                r'Interest\s*Level[:\-]?\s*(Yes|No|Maybe)',
                r'Interest[:\-]?\s*(Yes|No|Maybe)',
                r'Interested[:\-]?\s*(Yes|No|Maybe)',
                r'(Yes|No|Maybe)\s*interest',
                r'(Yes|No|Maybe)'
            ]
            for pattern in interest_patterns:
                match = re.search(pattern, plain_text, re.IGNORECASE)
                if match:
                    found_interest = match.group(1).title()
                    print(f"    [BROKERBAY FALLBACK DEBUG] Interest found by regex: '{found_interest}'")
                    break

        if not found_comments:
            # Fallback: look for comment patterns in plain text, prefer multi-line capture
            comment_patterns = [
                r'(?:Agent\s+)?Comments?[:\-]?\s*([\S][^\n\r]{5,})',
                r'Feedback[:\-]?\s*([\S][^\n\r]{5,})',
                r'Notes?[:\-]?\s*([\S][^\n\r]{5,})',
            ]
            for pattern in comment_patterns:
                match = re.search(pattern, plain_text, re.IGNORECASE)
                if match:
                    found_comments = match.group(1).strip()
                    print(f"    [BROKERBAY FALLBACK DEBUG] Comments found by regex: '{found_comments}'")
                    break

        # Final fallback defaults
        if not found_interest:
            found_interest = "Unknown"
        if not found_comments:
            found_comments = "No comments provided"
        else:
            # Clean comments
            found_comments = re.sub(r'[\s ]+', ' ', found_comments).strip()[:200]

        # Debug output
        print(f"    [BROKERBAY RESULT] INTEREST='{found_interest}' | COMMENTS='{found_comments}'")

        return {
            'date': email_date,
            'interest': found_interest,
            'comments': found_comments
        }

    except Exception as e:
        print(f"  [DEBUG] Error parsing BrokerBay HTML: {e}")
        return None


def fetch_hybrid_stats():
    """
    PRIMARY: Fetch all stats from sellernewsemailPreview HTML.
    Returns (lifetime_views, favorites, views_30day, top_websites, top_cities, success).
    """
    print("  [INFO] Fetching sellernewsemailPreview (Hybrid Primary)...")
    try:
        response = requests.get(SUMMARY_URL, headers=HEADERS, timeout=30)
        print(f"  [DEBUG] Final URL reached: {response.url}")
        response.raise_for_status()
        html = response.text
        
        print(f"  [DEBUG] Email preview page size: {len(html)} bytes")
        
        # Extract Lifetime Stats (structural text anchoring)
        print("\n  --- LIFETIME STATS (Structural Anchors) ---")
        lifetime_views, favorites = extract_lifetime_stats(html)
        
        # Extract 30-Day Stats (TOTAL from TOP 10 WEBSITES)
        print("\n  --- 30-DAY STATS (Table TOTAL Row) ---")
        views_30day = extract_30day_views(html)
        
        # Extract Trend Lists
        print("\n  --- TREND LISTS (Top 5 from Tables) ---")
        top_websites = extract_top_websites(html, limit=5)
        top_cities = extract_top_cities(html, limit=5)
        
        # Check if primary extraction worked
        if lifetime_views == 0 and views_30day == 0:
            print("  [WARN] Structural anchor extraction returned zeros - text anchors may have changed")
        
        return lifetime_views, favorites, views_30day, top_websites, top_cities, True
        
    except requests.exceptions.Timeout:
        print("  [ERROR] Email preview request timed out")
        return 0, 0, 0, [], [], False
    except requests.exceptions.RequestException as e:
        print(f"  [ERROR] Email preview request failed: {e}")
        return 0, 0, 0, [], [], False
    except Exception as e:
        print(f"  [ERROR] Unexpected error fetching email preview: {e}")
        return 0, 0, 0, [], [], False


# ============================================================================
# FALLBACK SCRAPER: ID-Based Extraction (Legacy HTML)
# ============================================================================

def extract_by_element_id(html, element_id):
    """
    Extract numeric value from an HTML element by its ID attribute.
    Looks for patterns like: id="NumberOfViews">2,993<
    """
    patterns = [
        rf'id\s*=\s*["\']?{element_id}["\']?\s*[^>]*>\s*(\d{{1,3}}(?:,\d{{3}})*|\d+)',
        rf'id\s*=\s*["\']?{element_id}["\']?[^>]*>.*?(\d{{1,3}}(?:,\d{{3}})*|\d+)',
        rf'id\s*=\s*["\']?{element_id}["\']?[^>]*(?:data-value|value)\s*=\s*["\']?(\d{{1,3}}(?:,\d{{3}})*|\d+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, html, flags=re.IGNORECASE | re.DOTALL)
        if match:
            for group in match.groups():
                if group:
                    val = extract_number(group)
                    if val >= 0:
                        print(f"  [DEBUG] Found #{element_id} => {val}")
                        return val, True
    return 0, False


def find_views_generic(html):
    """Generic pattern matching fallback for views."""
    patterns = [
        r'(\d{1,3}(?:,\d{3})*|\d+)\s*(?:property\s+)?views?',
        r'(?:property\s+)?views?\s*[:\-]?\s*(\d{1,3}(?:,\d{3})*|\d+)',
        r'property\s*views?[^0-9]*?(\d{1,3}(?:,\d{3})*|\d+)',
        r'["\']?views?["\']?\s*[:\=]\s*["\']?(\d{1,3}(?:,\d{3})*|\d+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, html, flags=re.IGNORECASE | re.DOTALL)
        if match:
            for group in match.groups():
                if group:
                    val = extract_number(group)
                    if val > 0:
                        return val
    return 0


def find_favorites_generic(html):
    """Generic pattern matching fallback for favorites."""
    patterns = [
        r'(\d{1,3}(?:,\d{3})*|\d+)\s*favorites?',
        r'favorites?\s*[:\-]?\s*(\d{1,3}(?:,\d{3})*|\d+)',
        r'favorites?[^0-9]*?(\d{1,3}(?:,\d{3})*|\d+)',
        r'["\']?favorites?["\']?\s*[:\=]\s*["\']?(\d{1,3}(?:,\d{3})*|\d+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, html, flags=re.IGNORECASE | re.DOTALL)
        if match:
            for group in match.groups():
                if group:
                    val = extract_number(group)
                    if val >= 0:
                        return val
    return 0


def fetch_fallback_stats():
    """
    FALLBACK: Fetch Views and Favorites from legacy summary page HTML.
    Uses specific element IDs: NumberOfViews and NumberOfFavorites.
    Returns (views, favorites, success_bool).
    """
    print("  [INFO] Fetching legacy summary page (ID-Based Fallback)...")
    try:
        response = requests.get(LEGACY_SUMMARY_URL, headers=HEADERS, timeout=30)
        response.raise_for_status()
        html = response.text
        
        print(f"  [DEBUG] Legacy summary page size: {len(html)} bytes")
        
        # PRIMARY METHOD: Look for specific element IDs
        views, views_found = extract_by_element_id(html, 'NumberOfViews')
        favorites, favs_found = extract_by_element_id(html, 'NumberOfFavorites')
        
        # Check if primary IDs were found
        if not views_found and not favs_found:
            print("  ╔══════════════════════════════════════════════════════════════╗")
            print("  ║  [CRITICAL] HTML ELEMENT IDs NOT FOUND!                      ║")
            print("  ║                                                              ║")
            print("  ║  Expected IDs: 'NumberOfViews' and 'NumberOfFavorites'       ║")
            print("  ║                                                              ║")
            print("  ║  The page format may have changed. Please inspect the HTML   ║")
            print("  ║  source at the LEGACY_SUMMARY_URL and update the element IDs.║")
            print("  ╚══════════════════════════════════════════════════════════════╝")
            
            # FALLBACK: Try generic pattern matching as last resort
            print("  [WARN] Attempting generic pattern fallback...")
            views = find_views_generic(html)
            favorites = find_favorites_generic(html)
            
            if views == 0 and favorites == 0:
                print("  [CRITICAL] Generic fallback also failed - manual inspection required")
        
        return views, favorites, True
        
    except requests.exceptions.Timeout:
        print("  [ERROR] Legacy summary page request timed out")
        return 0, 0, False
    except requests.exceptions.RequestException as e:
        print(f"  [ERROR] Legacy summary page request failed: {e}")
        return 0, 0, False
    except Exception as e:
        print(f"  [ERROR] Unexpected error fetching legacy summary: {e}")
        return 0, 0, False


# ============================================================================
# DATA.JS UPDATE
# ============================================================================

def update_data_js(lifetime_views, favorites, views_30day, top_websites, top_cities, brokerbay_count=0, brokerbay_feedback=None):
    """
    Update data.js syndicationStats block with fetched ListTrac data and BrokerBay feedback.
    
    Mapping:
      - lifetime_views  -> listTracTotalViews
      - views_30day     -> listTracViews30Days  
      - favorites       -> listTracInquiries
      - top_websites    -> listTracTopWebsites (array of {name, views})
      - top_cities      -> listTracTopCities (array of {name, views})
      - brokerbay_count -> brokerBayShowings
      - brokerbay_feedback -> propertyData.feedbackLog (new field)
    """
    with open(DATA_JS_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print(f"  [WRITE] Updating data.js with scraped values...")
    
    # Update Lifetime Views (listTracTotalViews)
    old_content = content
    content = re.sub(r'(listTracTotalViews:\s*)\d+', f'\\g<1>{lifetime_views}', content)
    if content != old_content:
        print(f"    -> listTracTotalViews: {lifetime_views}")
    
    # Update 30-Day Views (listTracViews30Days)
    old_content = content
    content = re.sub(r'(listTracViews30Days:\s*)\d+', f'\\g<1>{views_30day}', content)
    if content != old_content:
        print(f"    -> listTracViews30Days: {views_30day}")
    
    # Update Favorites/Inquiries (listTracInquiries)
    old_content = content
    content = re.sub(r'(listTracInquiries:\s*)\d+', f'\\g<1>{favorites}', content)
    if content != old_content:
        print(f"    -> listTracInquiries: {favorites}")
    
    # Update Top Websites (listTracTopWebsites) - handles nested arrays
    websites_js = json.dumps(top_websites) if top_websites else '[]'
    old_content = content
    # Match listTracTopWebsites: followed by [ and any content until matching ]
    content = re.sub(
        r'listTracTopWebsites:\s*\[(?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*\]',
        f'listTracTopWebsites: {websites_js}',
        content
    )
    if content != old_content:
        print(f"    -> listTracTopWebsites: {len(top_websites)} entries")
    
    # Update Top Cities (listTracTopCities) - handles nested arrays
    cities_js = json.dumps(top_cities) if top_cities else '[]'
    old_content = content
    content = re.sub(
        r'listTracTopCities:\s*\[(?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*\]',
        f'listTracTopCities: {cities_js}',
        content
    )
    if content != old_content:
        print(f"    -> listTracTopCities: {len(top_cities)} entries")
    
    # Update BrokerBay Showings (brokerBayShowings)
    if brokerbay_count is not None:
        old_content = content
        content = re.sub(r'(brokerBayShowings:\s*)\d+', f'\\g<1>{brokerbay_count}', content)
        if content != old_content:
            print(f"    -> brokerBayShowings: {brokerbay_count}")
    
    # Add/Update Feedback Log (feedbackLog) - Add to propertyData if not exists
    if brokerbay_feedback is not None:
        feedback_js = json.dumps(brokerbay_feedback, indent=4) if brokerbay_feedback else '[]'
        
        # Check if feedbackLog already exists in propertyData
        if 'feedbackLog:' in content:
            # Update existing feedbackLog
            old_content = content
            content = re.sub(
                r'feedbackLog:\s*\[(?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*\]',
                f'feedbackLog: {feedback_js}',
                content,
                flags=re.DOTALL
            )
            if content != old_content:
                print(f"    -> feedbackLog: {len(brokerbay_feedback)} entries (updated)")
        else:
            # Add feedbackLog before syndicationStats (find propertyData closing)
            syndication_pattern = r'(\s+)(// Syndication Stats for Funnel Performance Scoreboard)'
            replacement = f'\\1// BrokerBay Feedback Intelligence Log\\1feedbackLog: {feedback_js},\\1\\1\\2'
            old_content = content
            content = re.sub(syndication_pattern, replacement, content)
            if content != old_content:
                print(f"    -> feedbackLog: {len(brokerbay_feedback)} entries (added)")
    
    # Update Last Sync Date - handles both 'quoted' and "double-quoted" strings
    current_date = datetime.now().strftime('%B %d, %Y')
    current_date = re.sub(r' 0(\d),', r' \1,', current_date)  # Remove leading zero from day
    
    old_content = content
    content = re.sub(r"(lastSync:\s*')[^']*(')", f"\\g<1>{current_date}\\2", content)
    content = re.sub(r'(lastSync:\s*")[^"]*(")', f'\\g<1>{current_date}\\2', content)
    if content != old_content:
        print(f"    -> lastSync: {current_date}")

    with open(DATA_JS_PATH, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"  [WRITE] data.js updated successfully")
    return current_date


# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    print("Starting Sync for 109 Kelli Dr (Hybrid Strategy + BrokerBay Integration)...")
    print("=" * 60)
    
    # Step 1: Try Primary Hybrid Scraper (sellernewsemailPreview)
    lifetime_views, favorites, views_30day, top_websites, top_cities, primary_ok = fetch_hybrid_stats()
    
    # Step 2: Fallback to Legacy ID-Based Scraper if primary failed
    if not primary_ok or (lifetime_views == 0 and views_30day == 0):
        print("  [INFO] Primary scraper returned zeros - trying fallback...")
        fallback_views, fallback_favorites, fallback_ok = fetch_fallback_stats()
        
        if fallback_ok:
            if lifetime_views == 0 and fallback_views > 0:
                lifetime_views = fallback_views
                print(f"  [DEBUG] Using fallback lifetime views: {lifetime_views}")
            if favorites == 0 and fallback_favorites > 0:
                favorites = fallback_favorites
                print(f"  [DEBUG] Using fallback favorites: {favorites}")
    
    # Step 3: Fetch BrokerBay Feedback Intelligence
    print("\n  --- BROKERBAY FEEDBACK EXTRACTION ---")
    brokerbay_count, brokerbay_feedback = fetch_brokerbay_feedback()
    
    print("=" * 60)
    
    # Step 4: Update data.js if we have any valid data
    if lifetime_views > 0 or views_30day > 0 or favorites >= 0 or brokerbay_count > 0:
        last_date = update_data_js(lifetime_views, favorites, views_30day, top_websites, top_cities, brokerbay_count, brokerbay_feedback)
        print("Sync Successful!")
        print(f"   - Lifetime Views: {lifetime_views}")
        print(f"   - 30-Day Views: {views_30day}")
        print(f"   - Favorites: {favorites}")
        if top_websites:
            print(f"   - Top Website: {top_websites[0].get('name', 'N/A')} ({top_websites[0].get('views', 0)} views)")
        if top_cities:
            print(f"   - Top City: {top_cities[0].get('name', 'N/A')} ({top_cities[0].get('views', 0)} views)")
        print(f"   - BrokerBay Showings: {brokerbay_count}")
        print(f"   - Feedback Entries: {len(brokerbay_feedback) if brokerbay_feedback else 0}")
        print(f"   - Updated On: {last_date}")
    else:
        print("Sync completed but no data found.")
    
    print("=" * 60)
    
    # Final print statements for GitHub Actions logs
    print("\n=== FINAL VALUES FOR GITHUB ACTIONS ===")
    print(f"Final Views (Lifetime): {lifetime_views}  [listTracTotalViews]")
    print(f"Final Views (30-Day): {views_30day}  [listTracViews30Days]")
    print(f"Final Favorites: {favorites}  [listTracInquiries]")
    print(f"Final BrokerBay Showings: {brokerbay_count}  [brokerBayShowings]")
    print(f"Final Feedback Entries: {len(brokerbay_feedback) if brokerbay_feedback else 0}  [feedbackLog]")


if __name__ == '__main__':
    main()
