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

# ============================================================================
# DYNAMIC CONFIG — folder name passed as first CLI argument by GitHub Actions
# ============================================================================

if len(sys.argv) < 2:
    print("ERROR: No target folder argument provided. Usage: python sync_stats.py <folder>")
    sys.exit(1)

target_folder = sys.argv[1]

config_path = os.path.join(target_folder, 'config.json')
with open(config_path, 'r', encoding='utf-8') as _cfg_file:
    _config = json.load(_cfg_file)

PROPERTY_SEARCH_KEY = _config['search_key']
MLS_DETAILS_URL = _config.get('mls_details_url', '')
CAMPAIGN_START_DATE = _config.get('campaign_start_date', '')

DATA_JS_PATH = os.path.join(target_folder, 'data.js')

print(f"[CONFIG] target_folder={target_folder}  search_key={PROPERTY_SEARCH_KEY}  data.js={DATA_JS_PATH}")

# Retrieve email credentials from environment
REPORTING_EMAIL = os.getenv('REPORTING_EMAIL')
REPORTING_APP_PASSWORD = os.environ.get('STATS_EMAIL_PASSWORD')

# Check if credentials are missing
if not REPORTING_EMAIL:
    print("ERROR: Secret REPORTING_EMAIL is missing from environment.")
if not REPORTING_APP_PASSWORD:
    print("ERROR: Secret STATS_EMAIL_PASSWORD is missing from environment.")

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

def fetch_homes_com_stats():
    """
    Secure IMAP connection to Gmail to extract Homes.com Weekly Report emails.
    Searches for subject "Homes.com Weekly Report", extracts the unique listing URL,
    then scrapes Views, Leads, Social Retargeting, and Broker Support site counts.

    Social Retargeting block (from report page):
        Views  : ad impressions served to retargeted users   (e.g. 171)
        Sites  : number of premium publisher sites in network (e.g. 70)
        Users  : unique retargeted users reached              (e.g. 38)

    Broker Support:
        homesComBrokerSites : count of broker/agent portal sites carrying the listing
                              (distinct from the premium retargeting publisher network)

    Returns (report_url, total_views, leads, retargeting_views, retargeting_sites,
             retargeting_users, broker_sites).
    """
    print("  [INFO] Connecting to Gmail IMAP for Homes.com Weekly Report...")

    if BeautifulSoup is None:
        print("  [WARN] BeautifulSoup not available - skipping Homes.com stats extraction")
        return None, 0, 0, 0, 0, 0, 0

    email_address = os.getenv('REPORTING_EMAIL')
    app_password = os.environ.get('STATS_EMAIL_PASSWORD')

    if not email_address or not app_password:
        print("  [ERROR] Missing email credentials for Homes.com fetch")
        return None, 0, 0, 0, 0, 0, 0

    report_url = None
    total_views = 0
    leads = 0
    retargeting_views = 0
    retargeting_sites = 0
    retargeting_users = 0
    broker_sites = 0

    try:
        mail = imaplib.IMAP4_SSL('imap.gmail.com')
        mail.login(email_address, app_password)
        mail.select('inbox')

        print(f'  [DEBUG] IMAP search: looking for SUBJECT "Homes.com Weekly Report" BODY "{PROPERTY_SEARCH_KEY}"')
        status, messages = mail.search(None, f'(SUBJECT "Homes.com Weekly Report" BODY "{PROPERTY_SEARCH_KEY}")')
        if status != 'OK' or not messages[0].strip():
            print("  [WARN] No Homes.com Weekly Report emails found")
            mail.close()
            mail.logout()
            return None, 0, 0, 0, 0, 0, 0

        message_ids = messages[0].split()
        print(f"  [DEBUG] Found {len(message_ids)} Homes.com Weekly Report email(s)")

        # Process newest email first
        for msg_id in reversed(message_ids):
            try:
                status, msg_data = mail.fetch(msg_id, '(RFC822)')
                if status != 'OK' or not msg_data or not msg_data[0]:
                    continue

                email_message = email.message_from_bytes(msg_data[0][1])
                html_content = ""
                body_text = ""

                if email_message.is_multipart():
                    for part in email_message.walk():
                        ct = part.get_content_type()
                        if ct == "text/html":
                            html_content = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                        elif ct == "text/plain":
                            body_text = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                else:
                    ct = email_message.get_content_type()
                    if ct == "text/html":
                        html_content = email_message.get_payload(decode=True).decode('utf-8', errors='ignore')
                    elif ct == "text/plain":
                        body_text = email_message.get_payload(decode=True).decode('utf-8', errors='ignore')

                # Extract the "See the Full Report" tracking URL from the AMP email HTML.
                # The email contains an <a> tag whose visible text is exactly
                # "See the Full Report" and whose href is a homes.com click-tracker URL.
                search_text = html_content or body_text
                amp_link_match = re.search(
                    r'<a[^>]+href=["\']'
                    r'(https://click\.email\.homes\.com/[^\s\'"<>]+)'
                    r'["\'][^>]*>\s*See the Full Report\s*</a>',
                    search_text, re.IGNORECASE | re.DOTALL
                )
                if amp_link_match:
                    report_url = amp_link_match.group(1)
                    print(f"  [DEBUG] Found Homes.com Full Report AMP link: {report_url}")
                else:
                    # Fallback: any click.email.homes.com tracking URL
                    fallback_match = re.search(
                        r'https://click\.email\.homes\.com/\?qs=[^\s\'"<>]+',
                        search_text
                    )
                    if fallback_match:
                        report_url = fallback_match.group(0).rstrip('.,;)')
                        print(f"  [DEBUG] Found Homes.com click-tracker URL (fallback): {report_url}")
                    else:
                        print("  [DEBUG] No Homes.com Full Report link found in email body")
                        continue  # Try next (older) email

                # Attempt to scrape views, leads, retargeting, and broker sites from report URL
                try:
                    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
                    resp = requests.get(report_url, headers=headers, timeout=15)
                    if resp.status_code == 200:
                        soup = BeautifulSoup(resp.text, 'html.parser')
                        page_text = soup.get_text(separator=' ', strip=True)

                        # Views extraction
                        views_match = re.search(
                            r'(\d[\d,]*)\s*(?:Total\s+)?Views?',
                            page_text, re.IGNORECASE
                        )
                        if views_match:
                            total_views = int(views_match.group(1).replace(',', ''))
                            print(f"  [DEBUG] Homes.com Views: {total_views}")

                        # Leads extraction
                        leads_match = re.search(
                            r'(\d[\d,]*)\s*(?:Total\s+)?Leads?',
                            page_text, re.IGNORECASE
                        )
                        if leads_match:
                            leads = int(leads_match.group(1).replace(',', ''))
                            print(f"  [DEBUG] Homes.com Leads: {leads}")

                        # ── Social Retargeting block ─────────────────────────────
                        # Homes.com report contains a "Retargeting" section with
                        # Views (ad impressions), Sites (publisher network count),
                        # and Users (unique retargeted buyers reached).
                        retarget_block = re.search(
                            r'Retarget(?:ing)?[\s\S]{0,400}?(\d[\d,]*)\s*Views?[\s\S]{0,200}?(\d[\d,]*)\s*Sites?[\s\S]{0,200}?(\d[\d,]*)\s*Users?',
                            page_text, re.IGNORECASE
                        )
                        if retarget_block:
                            retargeting_views = int(retarget_block.group(1).replace(',', ''))
                            retargeting_sites = int(retarget_block.group(2).replace(',', ''))
                            retargeting_users = int(retarget_block.group(3).replace(',', ''))
                            print(f"  [DEBUG] Retargeting: Views={retargeting_views} Sites={retargeting_sites} Users={retargeting_users}")
                        else:
                            # Fallback: try individual patterns near a "Retargeting" heading
                            rt_section = re.search(r'Retarget(?:ing)?(.{0,600})', page_text, re.IGNORECASE | re.DOTALL)
                            if rt_section:
                                rt_text = rt_section.group(1)
                                rv = re.search(r'(\d[\d,]*)\s*Views?', rt_text, re.IGNORECASE)
                                rs = re.search(r'(\d[\d,]*)\s*Sites?', rt_text, re.IGNORECASE)
                                ru = re.search(r'(\d[\d,]*)\s*Users?', rt_text, re.IGNORECASE)
                                if rv: retargeting_views = int(rv.group(1).replace(',', ''))
                                if rs: retargeting_sites = int(rs.group(1).replace(',', ''))
                                if ru: retargeting_users = int(ru.group(1).replace(',', ''))
                                if rv or rs or ru:
                                    print(f"  [DEBUG] Retargeting (fallback): Views={retargeting_views} Sites={retargeting_sites} Users={retargeting_users}")
                                else:
                                    print("  [DEBUG] Retargeting block found but no numeric matches")

                        # ── Broker Support: site count ───────────────────────────
                        # Homes.com reports how many broker/agent sites are distributing
                        # the listing. Pattern varies — try "X Sites" near "Broker" or
                        # "Agent" headings, or a standalone distribution count block.
                        broker_section = re.search(
                            r'(?:Broker|Agent|Distribution|Partner)\s*(?:Sites?|Network|Count)?[\s\S]{0,300}?(\d[\d,]*)\s*(?:Sites?|Portals?|Networks?)',
                            page_text, re.IGNORECASE
                        )
                        if broker_section:
                            broker_sites = int(broker_section.group(1).replace(',', ''))
                            print(f"  [DEBUG] Broker Support Sites: {broker_sites}")
                        else:
                            # Fallback: look for a "X broker sites" or "listed on X" pattern
                            bk_match = re.search(
                                r'listed\s+on\s+(\d[\d,]*)\s*(?:broker|agent|partner)?\s*sites?',
                                page_text, re.IGNORECASE
                            )
                            if bk_match:
                                broker_sites = int(bk_match.group(1).replace(',', ''))
                                print(f"  [DEBUG] Broker Support Sites (fallback): {broker_sites}")
                            else:
                                print("  [DEBUG] Broker Support site count not found in report")

                        if total_views > 0 or leads > 0 or retargeting_views > 0:
                            break  # Successful extraction from this email
                    else:
                        print(f"  [WARN] Homes.com report page returned HTTP {resp.status_code}")
                except Exception as scrape_err:
                    print(f"  [WARN] Could not scrape Homes.com report page: {scrape_err}")

            except Exception as e:
                print(f"  [WARN] Error processing Homes.com email: {e}")
                continue

        mail.close()
        mail.logout()

    except Exception as e:
        print(f"  [ERROR] Gmail IMAP connection failed for Homes.com: {e}")
        return None, 0, 0, 0, 0, 0, 0

    return report_url, total_views, leads, retargeting_views, retargeting_sites, retargeting_users, broker_sites


# ============================================================================
# FACEBOOK / META INSIGHTS API — PLACEHOLDER (Token Pending Activation)
# ============================================================================

def fetch_facebook_insights(search_key):
    """
    Meta Marketing API — search all Campaigns in the Ad Account whose name
    contains `search_key` (e.g. "109 Kelli"), then sum impressions, reach,
    clicks, and spend across every matching campaign.

    Environment variables required:
        FB_ACCESS_TOKEN  — long-lived User or System-User token with ads_read
        FB_AD_ACCOUNT_ID — format: act_XXXXXXXXXX

    Returns dict: {impressions: int, reach: int, clicks: int, spend: str}
        e.g. {'impressions': 4821, 'reach': 3200, 'clicks': 142, 'spend': '312.47'}
    On any error or missing credentials returns
        {'impressions': 0, 'reach': 0, 'clicks': 0, 'spend': '--'}.

    Graph API flow:
      1. GET /{ad_account_id}/campaigns
             ?fields=name,insights{impressions,reach,clicks,spend}
             &date_preset=maximum
             &limit=500
             &access_token=...
      2. Filter campaigns whose name contains search_key (case-insensitive).
      3. Sum metrics from each matching campaign's insights node.
      4. Paginate using the 'next' cursor until all campaigns are fetched.
    """
    _empty = {'impressions': 0, 'reach': 0, 'clicks': 0, 'spend': '--'}
    print(f"  [INFO] Fetching Facebook Insights for search_key='{search_key}'...")

    fb_token      = os.getenv('FB_ACCESS_TOKEN')
    fb_account_id = os.getenv('FB_AD_ACCOUNT_ID')

    if not fb_token or not fb_account_id:
        print("  [WARN] FB_ACCESS_TOKEN or FB_AD_ACCOUNT_ID not set — skipping Meta Insights fetch")
        return _empty

    total_impressions = 0
    total_reach       = 0
    total_clicks      = 0
    total_spend       = 0.0
    matched_campaigns = 0

    try:
        endpoint = f"https://graph.facebook.com/v22.0/{fb_account_id}/campaigns"
        params = {
            'fields': 'name,insights{impressions,reach,clicks,spend}',
            'date_preset': 'maximum',
            'limit': 500,
            'access_token': fb_token,
        }

        page_num = 0
        while endpoint:
            page_num += 1
            response = requests.get(endpoint, params=params, timeout=20)
            response.raise_for_status()
            payload  = response.json()

            campaigns = payload.get('data', [])
            print(f"  [DEBUG] FB page {page_num}: {len(campaigns)} campaign(s) returned")

            for campaign in campaigns:
                name = campaign.get('name', '')
                if search_key.lower() not in name.lower():
                    continue  # Not this property

                matched_campaigns += 1
                insights_wrapper = campaign.get('insights', {})
                insights_data    = insights_wrapper.get('data', [])
                for row in insights_data:
                    imp    = int(row.get('impressions', 0) or 0)
                    reach  = int(row.get('reach',       0) or 0)
                    clicks = int(row.get('clicks',      0) or 0)
                    spend  = float(row.get('spend',     0) or 0)
                    total_impressions += imp
                    total_reach       += reach
                    total_clicks      += clicks
                    total_spend       += spend
                print(f"  [DEBUG] Matched campaign: '{name}' — impressions={imp}, reach={reach}, clicks={clicks}, spend={spend:.2f}")

            # Pagination — params must be cleared after first request (cursor is embedded in 'next')
            paging = payload.get('paging', {})
            endpoint = paging.get('next')
            params   = {}  # next URL already includes all params

        if matched_campaigns == 0:
            print(f"  [WARN] No Facebook campaigns matched search_key='{search_key}'")
            return _empty

        spend_str = f"{total_spend:,.2f}"
        print(f"  [DEBUG] Meta Insights total: impressions={total_impressions}, reach={total_reach}, "
              f"clicks={total_clicks}, spend=${spend_str} (across {matched_campaigns} campaign(s))")
        return {'impressions': total_impressions, 'reach': total_reach, 'clicks': total_clicks, 'spend': spend_str}

    except Exception as e:
        print(f"  [ERROR] Meta Insights API call failed: {e}")
        return {'impressions': 0, 'reach': 0, 'clicks': 0, 'spend': '--'}


def fetch_brokerbay_feedback():
    """
    Secure IMAP connection to Gmail to extract BrokerBay feedback emails.
    Flexible: Search only for SUBJECT "Feedback Submitted", then filter for property locally.
    Overwrites feedbackLog with most recent matching feedback entries.
    Returns (feedback_count, feedback_log).
    """
    print("  [INFO] Connecting to Gmail IMAP for BrokerBay feedback...")

    if BeautifulSoup is None:
        print("  [WARN] BeautifulSoup not available - skipping BrokerBay feedback extraction")
        return 0, []

    email_address = os.getenv('REPORTING_EMAIL')
    app_password = os.environ.get('STATS_EMAIL_PASSWORD')

    if not email_address or not app_password:
        print("  [ERROR] Missing email credentials - set REPORTING_EMAIL and STATS_EMAIL_PASSWORD environment variables")
        return 0, []

    property_phrases = [PROPERTY_SEARCH_KEY]

    try:
        mail = imaplib.IMAP4_SSL('imap.gmail.com')
        mail.login(email_address, app_password)
        mail.select('inbox')

        print('  [DEBUG] IMAP search: looking for SUBJECT "Feedback Submitted"')
        status, messages = mail.search(None, '(SUBJECT "Feedback Submitted")')
        if status != 'OK':
            print("  [ERROR] IMAP search for Feedback Submitted failed")
            mail.close()
            mail.logout()
            return 0, []

        message_ids = messages[0].split()
        print(f"  [DEBUG] Found {len(message_ids)} total emails matching subject 'Feedback Submitted'.")

        feedback_candidates = []
        for idx, msg_id in enumerate(reversed(message_ids)):
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

                subj = email_message.get('Subject', '')
                body_text = ""
                html_content = ""
                if email_message.is_multipart():
                    for part in email_message.walk():
                        content_type = part.get_content_type()
                        if content_type == "text/html":
                            html_content = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                        elif content_type == "text/plain":
                            body_text = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                else:
                    content_type = email_message.get_content_type()
                    if content_type == "text/html":
                        html_content = email_message.get_payload(decode=True).decode('utf-8', errors='ignore')
                    elif content_type == "text/plain":
                        body_text = email_message.get_payload(decode=True).decode('utf-8', errors='ignore')

                concatenated_search = (subj or "") + " " + (body_text or "") + " " + (html_content or "")
                matched = any(phrase in concatenated_search for phrase in property_phrases)
                print(f"  [DEBUG] Email #{idx+1} - Matched property filter: {matched} (Subject: '{subj}')")
                if not matched:
                    print(f"  [DEBUG] Skipping email #{idx+1} (does not match property: {property_phrases})")
                    continue

                feedback_candidates.append({
                    'email_message': email_message,
                    'html_content': html_content,
                })

                if len(feedback_candidates) >= 10:
                    break

            except Exception as e:
                print(f"  [ERROR] Error processing email #{idx+1}, ID {msg_id}: {e}")

        feedback_log = []
        for idx, candidate in enumerate(feedback_candidates):
            email_message = candidate['email_message']
            html_content = candidate['html_content']
            email_date = email_message.get('Date', '')
            if email_date:
                try:
                    parsed_date = email.utils.parsedate_tz(email_date)
                    if parsed_date:
                        email_datetime = datetime.fromtimestamp(email.utils.mktime_tz(parsed_date))
                        formatted_date = email_datetime.strftime('%m/%d/%Y')
                    else:
                        formatted_date = email_date[:10]
                except Exception as e:
                    print(f"  [WARN] Date parse failed: {e}")
                    formatted_date = email_date[:10]
            else:
                formatted_date = 'Unknown'

            parsed = parse_brokerbay_html(html_content, formatted_date)
            if parsed:
                print(f"  [DEBUG] Added valid feedback entry: {parsed}")
                feedback_log.append(parsed)
            else:
                print(f"  [DEBUG] Skipped a matching email (could not extract feedback entry)")

        mail.close()
        mail.logout()

        print(f"  [DEBUG] Final extracted feedback entry count (for data.js feedbackLog): {len(feedback_log)}")
        return len(feedback_log), feedback_log

    except Exception as e:
        print(f"  [ERROR] Gmail IMAP connection failed: {e}")
        return 0, []


def parse_brokerbay_html(html_content, email_date):
    """
    Parse BrokerBay HTML email to extract feedback data.
    Attempts to robustly pull Interest Level and (Agent) Comments even from nested tables.
    Returns dict with {date, interest, comments} or None if parsing fails.
    """
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        # Search both table cells and fallback to plain text
        interest_level = None
        comments = None

        # Search for all td's, th's, tr's with "Interest Level" and "Comments" nearby
        for tag in soup.find_all(['tr', 'td', 'th']):
            label = tag.get_text(separator=' ', strip=True)
            # Handle Interest Level
            if re.search(r'Interest\s*Level', label, re.IGNORECASE):
                # look for neighbor (in row) with Yes/No/Maybe
                siblings = tag.find_next_siblings()
                value_found = False
                for sib in siblings:
                    value = sib.get_text(separator=' ', strip=True)
                    m = re.search(r'(Yes|No|Maybe)', value, re.IGNORECASE)
                    if m:
                        interest_level = m.group(1).title()
                        value_found = True
                        break
                if value_found:
                    continue
                # Or try parent tr for multiple tds
                tr = tag.find_parent('tr')
                if tr:
                    tds = tr.find_all('td')
                    for cell in tds:
                        value = cell.get_text(separator=' ', strip=True)
                        m = re.search(r'(Yes|No|Maybe)', value, re.IGNORECASE)
                        if m:
                            interest_level = m.group(1).title()
                            break

            # Handle Comments (Agent/Additional)
            if re.search(r'(Additional\s*)?Comments?', label, re.IGNORECASE):
                siblings = tag.find_next_siblings()
                for sib in siblings:
                    value = sib.get_text(separator=' ', strip=True)
                    # Our definition: more than a couple words, does not repeat label
                    if (value and not re.search(r'Comments?', value, re.IGNORECASE) 
                        and len(value) > 6):
                        comments = value[:250]
                        break
                if not comments:
                    # If not in siblings, maybe another td in row
                    tr = tag.find_parent('tr')
                    if tr:
                        tds = tr.find_all('td')
                        for cell in tds:
                            value = cell.get_text(separator=' ', strip=True)
                            if (value and not re.search(r'Comments?', value, re.IGNORECASE)
                                and len(value) > 6):
                                comments = value[:250]
                                break

        # Fallback: Plain text scrapes (as previously)
        plain_text = soup.get_text()
        if not interest_level:
            patterns = [
                r'Interest\s*Level[:\-]?\s*(Yes|No|Maybe)',
                r'Interest[:\-]?\s*(Yes|No|Maybe)',
                r'Interested[:\-]?\s*(Yes|No|Maybe)',
                r'(Yes|No|Maybe)\s*interest',
            ]
            for pattern in patterns:
                m = re.search(pattern, plain_text, re.IGNORECASE)
                if m:
                    interest_level = m.group(1).title()
                    break
        if not comments:
            patterns = [
                r'(?:Additional\s*)?Comments?[:\-]?\s*([^\n\r]+)',
                r'Feedback[:\-]?\s*([^\n\r]+)',
                r'Notes?[:\-]?\s*([^\n\r]+)',
            ]
            for pattern in patterns:
                m = re.search(pattern, plain_text, re.IGNORECASE)
                if m:
                    c = m.group(1).strip()
                    if len(c) > 6 and not re.search(r'Comments?', c, re.IGNORECASE):
                        comments = c[:250]
                        break

        if not interest_level:
            interest_level = "Unknown"
        if not comments:
            comments = "No comments provided"

        # Clean up extracted text
        comments = re.sub(r'\s+', ' ', comments).strip()

        return {
            'date': email_date,
            'interest': interest_level,
            'comments': comments
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
# MLS AGENT ACTIVITY — "Bulldozer" scrape of id="NumberOfViews" on MLS detail page
# ============================================================================

def fetch_mls_agent_activity(target_url):
    """
    Fetch the MLS Agent Activity count (the "144" value) from the property's
    MLS details page.  The page exposes the count inside an element whose
    id attribute is "NumberOfViews", e.g.:
        <span id="NumberOfViews">144</span>

    Strategy:
      1. Primary  — extract_by_element_id() targets id="NumberOfViews" directly.
      2. Fallback — Bulldozer regex: strip all HTML, find a number immediately
                    before the label "agent views" / "NumberOfViews".

    Returns int agent_activity (0 on any failure).
    """
    if not target_url:
        print("  [WARN] fetch_mls_agent_activity: no mls_details_url configured — skipping")
        return 0

    print(f"  [INFO] Fetching MLS Agent Activity from: {target_url}")
    try:
        response = requests.get(target_url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        html = response.text
        print(f"  [DEBUG] MLS details page size: {len(html)} bytes")

        # Primary: id-based extraction
        val, found = extract_by_element_id(html, 'NumberOfViews')
        if found and val > 0:
            print(f"  [DEBUG] MLS Views (id match): {val}")
            return val

        # Bulldozer fallback: strip tags, find number before known label variants
        text = strip_all_html(html)
        patterns = [
            r'(\d{1,3}(?:,\d{3})*|\d+)\s*(?:Agent\s+)?(?:Views?|NumberOfViews)',
            r'NumberOfViews\D{0,20}?(\d{1,3}(?:,\d{3})*|\d+)',
        ]
        for pat in patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                v = extract_number(m.group(1))
                if v > 0:
                    print(f"  [DEBUG] MLS Views (bulldozer fallback): {v}")
                    return v

        print("  [WARN] MLS Views: NumberOfViews not found on page")
        return 0

    except requests.exceptions.Timeout:
        print("  [ERROR] MLS details page request timed out")
        return 0
    except requests.exceptions.RequestException as e:
        print(f"  [ERROR] MLS details page request failed: {e}")
        return 0
    except Exception as e:
        print(f"  [ERROR] Unexpected error in fetch_mls_agent_activity: {e}")
        return 0


# ============================================================================
# DATA.JS UPDATE
# ============================================================================

def update_data_js(lifetime_views, favorites, views_30day, top_websites, top_cities, brokerbay_count=0, brokerbay_feedback=None, homes_report_url=None, homes_total_views=0, homes_leads=0, homes_retargeting_views=0, homes_retargeting_sites=0, homes_retargeting_users=0, homes_broker_sites=0, fb_paid_reach=0, fb_paid_spend='--', fb_reach=0, fb_clicks=0, agent_activity=0, campaign_start_date=''):
    """
    Update data.js syndicationStats block with fetched ListTrac data and BrokerBay feedback.
    
    Mapping:
      - lifetime_views       -> listTracTotalViews
      - views_30day          -> listTracViews30Days  
      - favorites            -> listTracInquiries
      - top_websites         -> listTracTopWebsites (array of {name, views})
      - top_cities           -> listTracTopCities (array of {name, views})
      - brokerbay_count      -> brokerBayShowings (floor: never below 1)
      - brokerbay_feedback   -> propertyData.feedbackLog
      - homes_broker_sites   -> homesComStats.homesComBrokerSites
      - fb_paid_reach        -> syndicationStats.facebookPaidReach    (legacy paid impressions)
      - fb_paid_reach        -> syndicationStats.facebookImpressions (canonical impressions key)
      - fb_paid_spend        -> syndicationStats.facebookPaidSpend
      - fb_reach             -> syndicationStats.facebookReach        (unique reach)
      - fb_clicks            -> syndicationStats.facebookClicks       (page views / clicks)
      - agent_activity       -> syndicationStats.mlsViews
      - campaign_start_date  -> syndicationStats.campaignStartDate
    """
    with open(DATA_JS_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print(f"  [WRITE] Updating data.js with scraped values...")
    
    # Update MLS Views (mlsViews in syndicationStats)
    # Writes the value when a live number was fetched; never overwrites with 0.
    if agent_activity > 0:
        old_content = content
        if 'mlsViews:' in content:
            content = re.sub(r'(mlsViews:\s*)\d+', f'\\g<1>{agent_activity}', content)
        else:
            # Insert mlsViews into syndicationStats block as a fallback
            content = re.sub(
                r'(syndicationStats:\s*\{)',
                f'\\g<1>\n        mlsViews: {agent_activity},',
                content
            )
        if content != old_content:
            print(f"    -> syndicationStats.mlsViews: {agent_activity}")
    
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
    
    # Update BrokerBay Showings — exact string replacement to prevent zeroing out
    raw_brokerbay_count = int(brokerbay_count or 0)
    brokerbay_count = max(raw_brokerbay_count, 1)
    if brokerbay_count != raw_brokerbay_count:
        print(f"    -> brokerBayShowings: FLOOR ENFORCED to 1 (was {raw_brokerbay_count})")
    existing_match = re.search(r'brokerBayShowings:\s*(\d+)', content)
    if existing_match:
        existing_val = int(existing_match.group(1))
        exact_old = existing_match.group(0)
        exact_new = f'brokerBayShowings: {brokerbay_count}'
        old_content = content
        content = content.replace(exact_old, exact_new, 1)
        if content != old_content:
            print(f"    -> brokerBayShowings: {existing_val} -> {brokerbay_count} (exact replacement)")
    else:
        print(f"    -> brokerBayShowings: field not found in data.js (skipping)")
    
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
    
    # Update Homes.com Elite Stats (homesComStats block)
    if homes_total_views > 0:
        old_content = content
        content = re.sub(r'(homesComStats:\s*\{[^}]*totalViews:\s*)\d+', f'\\g<1>{homes_total_views}', content, flags=re.DOTALL)
        if content != old_content:
            print(f"    -> homesComStats.totalViews: {homes_total_views}")
    if homes_leads > 0:
        old_content = content
        content = re.sub(r'(homesComStats:\s*\{[^}]*leads:\s*)\d+', f'\\g<1>{homes_leads}', content, flags=re.DOTALL)
        if content != old_content:
            print(f"    -> homesComStats.leads: {homes_leads}")
    if homes_report_url:
        old_content = content
        content = re.sub(
            r"(homesComStats:\s*\{[^}]*reportUrl:\s*')[^']*(')",
            f"\\g<1>{homes_report_url}\\2",
            content, flags=re.DOTALL
        )
        content = re.sub(
            r'(homesComStats:\s*\{[^}]*reportUrl:\s*")[^"]*(")',
            f'\\g<1>{homes_report_url}\\2',
            content, flags=re.DOTALL
        )
        if content != old_content:
            print(f"    -> homesComStats.reportUrl: {homes_report_url}")

    # Update Homes.com Retargeting Stats (homesComRetargeting* fields)
    if homes_retargeting_views > 0:
        old_content = content
        content = re.sub(r'(homesComRetargetingViews:\s*)\d+', f'\\g<1>{homes_retargeting_views}', content)
        if content != old_content:
            print(f"    -> homesComRetargetingViews: {homes_retargeting_views}")
    if homes_retargeting_sites > 0:
        old_content = content
        content = re.sub(r'(homesComRetargetingSites:\s*)\d+', f'\\g<1>{homes_retargeting_sites}', content)
        if content != old_content:
            print(f"    -> homesComRetargetingSites: {homes_retargeting_sites}")
    if homes_retargeting_users > 0:
        old_content = content
        content = re.sub(r'(homesComRetargetingUsers:\s*)\d+', f'\\g<1>{homes_retargeting_users}', content)
        if content != old_content:
            print(f"    -> homesComRetargetingUsers: {homes_retargeting_users}")

    # Update Homes.com Broker Support site count (homesComBrokerSites)
    if homes_broker_sites > 0:
        old_content = content
        if 'homesComBrokerSites:' in content:
            content = re.sub(r'(homesComBrokerSites:\s*)\d+', f'\\g<1>{homes_broker_sites}', content)
        else:
            # Insert after homesComRetargetingUsers line
            content = re.sub(
                r'(homesComRetargetingUsers:\s*\d+)',
                f'\\g<1>,\n        homesComBrokerSites: {homes_broker_sites}',
                content
            )
        if content != old_content:
            print(f"    -> homesComBrokerSites: {homes_broker_sites}")

    # Update Facebook / Meta Paid Performance fields
    # facebookPaidReach: only update when a real value is returned (token active)
    if fb_paid_reach > 0:
        old_content = content
        content = re.sub(r'(facebookPaidReach:\s*)\d+', f'\\g<1>{fb_paid_reach}', content)
        if content != old_content:
            print(f"    -> facebookPaidReach: {fb_paid_reach}")
    # facebookImpressions: canonical impressions key (mirrors fb_paid_reach / Meta impressions)
    if fb_paid_reach > 0:
        old_content = content
        if 'facebookImpressions:' in content:
            content = re.sub(r'(facebookImpressions:\s*)\d+', f'\\g<1>{fb_paid_reach}', content)
        else:
            # Insert immediately after facebookPaidReach line
            content = re.sub(
                r'(facebookPaidReach:\s*\d+)',
                f'\\g<1>,\n        facebookImpressions: {fb_paid_reach}',
                content
            )
        if content != old_content:
            print(f"    -> facebookImpressions: {fb_paid_reach}")
    if fb_paid_spend != '--':
        old_content = content
        content = re.sub(r"(facebookPaidSpend:\s*)'[^']*'", f"\\g<1>'{fb_paid_spend}'", content)
        content = re.sub(r'(facebookPaidSpend:\s*)"[^"]*"', f'\\g<1>"{fb_paid_spend}"', content)
        if content != old_content:
            print(f"    -> facebookPaidSpend: {fb_paid_spend}")
    # facebookReach (unique audience reach) — only update when a real value is returned
    if fb_reach > 0:
        old_content = content
        content = re.sub(r'(facebookReach:\s*)\d+', f'\\g<1>{fb_reach}', content)
        if content != old_content:
            print(f"    -> facebookReach: {fb_reach}")
    # facebookClicks (page views / link clicks) — only update when a real value is returned
    if fb_clicks > 0:
        old_content = content
        content = re.sub(r'(facebookClicks:\s*)\d+', f'\\g<1>{fb_clicks}', content)
        if content != old_content:
            print(f"    -> facebookClicks: {fb_clicks}")

    # Update Campaign Start Date (campaignStartDate) — only write when provided
    if campaign_start_date:
        old_content = content
        if 'campaignStartDate:' in content:
            content = re.sub(
                r"(campaignStartDate:\s*)['\"][^'\"]*['\"]",
                f'\\g<1>"{campaign_start_date}"',
                content
            )
        else:
            # Insert after facebookPaidSpend or facebookPaidReach line
            content = re.sub(
                r'(facebookPaidSpend:\s*[\'"][^\'"]*[\'"])',
                f'\\g<1>,\n        campaignStartDate: "{campaign_start_date}"',
                content
            )
        if content != old_content:
            print(f"    -> campaignStartDate: {campaign_start_date}")

    # Calculate and update listingDOM — days since campaign_start_date (2026-02-11)
    if campaign_start_date:
        try:
            from datetime import date as _date
            start_dt = _date.fromisoformat(campaign_start_date)
            listing_dom = (datetime.now().date() - start_dt).days
            listing_dom = max(listing_dom, 0)
            old_content = content
            if 'listingDOM:' in content:
                content = re.sub(r'(listingDOM:\s*)\d+', f'\\g<1>{listing_dom}', content)
            else:
                # Insert listingDOM after campaignStartDate line
                content = re.sub(
                    r'(campaignStartDate:\s*[\'"][^\'"]*[\'"])',
                    f'\\g<1>,\n        listingDOM: {listing_dom}',
                    content
                )
            if content != old_content:
                print(f"    -> listingDOM: {listing_dom} days (since {campaign_start_date})")
        except Exception as _e:
            print(f"  [WARN] Could not calculate listingDOM: {_e}")

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

def read_existing_brokerbay_count():
    """Read the current brokerBayShowings value from data.js to preserve it when fetch fails."""
    try:
        with open(DATA_JS_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
        match = re.search(r'brokerBayShowings:\s*(\d+)', content)
        if match:
            val = int(match.group(1))
            floored_val = max(val, 1)
            if floored_val != val:
                print("  [WARN] Existing brokerBayShowings was 0 — applying floor to 1")
            print(f"  [DEBUG] Existing brokerBayShowings in data.js: {floored_val}")
            return floored_val
    except Exception as e:
        print(f"  [WARN] Could not read existing brokerBayShowings: {e}")
    return 1


def main():
    print("Starting Sync for Property (Hybrid Strategy + BrokerBay Integration)...")
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

    # Step 4: Fetch Homes.com Elite Performance Stats
    print("\n  --- HOMES.COM WEEKLY REPORT EXTRACTION ---")
    homes_report_url, homes_total_views, homes_leads, homes_retargeting_views, homes_retargeting_sites, homes_retargeting_users, homes_broker_sites = fetch_homes_com_stats()
    print(f"  [INFO] Homes.com: URL={homes_report_url}, Views={homes_total_views}, Leads={homes_leads}, RetargetViews={homes_retargeting_views}, RetargetSites={homes_retargeting_sites}, RetargetUsers={homes_retargeting_users}, BrokerSites={homes_broker_sites}")

    # Step 5: Fetch Facebook / Meta Paid Performance
    print("\n  --- FACEBOOK / META INSIGHTS (PAID PERFORMANCE) ---")
    fb_insights   = fetch_facebook_insights(PROPERTY_SEARCH_KEY)
    fb_paid_reach = fb_insights['impressions']
    fb_reach      = fb_insights['reach']
    fb_clicks     = fb_insights['clicks']
    fb_paid_spend = fb_insights['spend']
    print(f"  [INFO] Meta Insights: Impressions={fb_paid_reach}, Reach={fb_reach}, Clicks={fb_clicks}, Spend={fb_paid_spend}")

    # Step 6: Fetch MLS Agent Activity (id="NumberOfViews" on MLS detail page)
    print("\n  --- MLS AGENT ACTIVITY ---")
    agent_activity = fetch_mls_agent_activity(MLS_DETAILS_URL)
    print(f"  [INFO] MLS Views (mlsViews): {agent_activity}")

    scraped_count = int(brokerbay_count or 0)
    existing_count = read_existing_brokerbay_count()

    # LOCK: If fetch returned 0, preserve the existing data.js value.
    # If data.js is also 0 or empty, force to 1 — never allow zero showings.
    if scraped_count == 0:
        print(f"  [WARN] Fetch returned 0 showings — falling back to existing data.js value ({existing_count})")
        brokerbay_count = existing_count
    else:
        brokerbay_count = scraped_count

    brokerbay_count = int(brokerbay_count or 0)
    if brokerbay_count < 1:
        print(f"  [WARN] Both fetch and data.js are 0 — forcing brokerBayShowings to 1")
        brokerbay_count = 1

    print(f"  [INFO] Smart Sync floor: brokerBayShowings = {brokerbay_count} "
          f"(scraped={scraped_count}, existing={existing_count}, floor=1)")
    
    print("=" * 60)
    
    # Step 7: Update data.js if we have any valid data
    if lifetime_views > 0 or views_30day > 0 or favorites >= 0 or brokerbay_count > 0:
        last_date = update_data_js(lifetime_views, favorites, views_30day, top_websites, top_cities, brokerbay_count, brokerbay_feedback,
                                   homes_report_url=homes_report_url, homes_total_views=homes_total_views, homes_leads=homes_leads,
                                   homes_retargeting_views=homes_retargeting_views, homes_retargeting_sites=homes_retargeting_sites,
                                   homes_retargeting_users=homes_retargeting_users, homes_broker_sites=homes_broker_sites,
                                   fb_paid_reach=fb_paid_reach, fb_paid_spend=fb_paid_spend,
                                   fb_reach=fb_reach, fb_clicks=fb_clicks,
                                   agent_activity=agent_activity, campaign_start_date=CAMPAIGN_START_DATE)
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
        print(f"   - Homes.com Views: {homes_total_views}")
        print(f"   - Homes.com Leads: {homes_leads}")
        print(f"   - Retargeting Views: {homes_retargeting_views}, Sites: {homes_retargeting_sites}, Users: {homes_retargeting_users}")
        print(f"   - Broker Support Sites: {homes_broker_sites}")
        print(f"   - MLS Agent Activity: {agent_activity}")
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
    print(f"Final Homes.com Views: {homes_total_views}  [homesComStats.totalViews]")
    print(f"Final Homes.com Leads: {homes_leads}  [homesComStats.leads]")
    print(f"Final Retargeting: Views={homes_retargeting_views} Sites={homes_retargeting_sites} Users={homes_retargeting_users}  [homesComStats.homesComRetargeting*]")
    print(f"Final Broker Support Sites: {homes_broker_sites}  [homesComStats.homesComBrokerSites]")
    print(f"Final Facebook Paid Reach: {fb_paid_reach}  [syndicationStats.facebookPaidReach]")
    print(f"Final Facebook Impressions: {fb_paid_reach}  [syndicationStats.facebookImpressions]")
    print(f"Final Facebook Paid Spend: {fb_paid_spend}  [syndicationStats.facebookPaidSpend]")
    print(f"Final Facebook Reach:      {fb_reach}       [syndicationStats.facebookReach]")
    print(f"Final Facebook Clicks:     {fb_clicks}      [syndicationStats.facebookClicks]")
    print(f"Final MLS Views: {agent_activity}  [syndicationStats.mlsViews]")


if __name__ == '__main__':
    main()
