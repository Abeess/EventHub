import gspread
from oauth2client.service_account import ServiceAccountCredentials

scope = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/drive"
]

creds = ServiceAccountCredentials.from_json_keyfile_name(
    "credentials.json", scope
)

client = gspread.authorize(creds)

# Use EXACT sheet name from your browser tab
sheet = client.open("Tink-Her-Hack Event Registration Form (Responses)").sheet1

rows = sheet.get_all_records()

print(rows)