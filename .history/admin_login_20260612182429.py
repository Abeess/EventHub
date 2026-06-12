import os
import re
import string
import random
import logging
from datetime import datetime, date

from dotenv import load_dotenv
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from flask_mail import Mail, Message
from markupsafe import escape
from supabase import create_client, Client
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
import gspread
from oauth2client.service_account import ServiceAccountCredentials

load_dotenv()

logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", os.urandom(24).hex())

# ===== Supabase Client =====
supabase_url: str = os.environ.get("SUPABASE_URL")
supabase_key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# ===== Email Configuration =====

app.config['MAIL_SERVER'] = os.getenv("MAIL_SERVER", "smtp.gmail.com")
app.config['MAIL_PORT'] = int(os.getenv("MAIL_PORT", 587))
app.config['MAIL_USE_TLS'] = os.getenv("MAIL_USE_TLS", "True").lower() == "true"
app.config['MAIL_USE_SSL'] = os.getenv("MAIL_USE_SSL", "False").lower() == "true"
app.config['MAIL_USERNAME'] = os.getenv("MAIL_USERNAME")
app.config['MAIL_PASSWORD'] = os.getenv("MAIL_PASSWORD")

mail = Mail(app)

UPLOAD_FOLDER = os.path.join('static', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_sheet_id(sheet_url):
    if not sheet_url:
        return None
    try:
        match = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', sheet_url)
        if match:
            return match.group(1)
        return None
    except Exception as e:
        logger.error(f"Error extracting sheet ID: {e}")
        return None

def generate_random_code(length=6):
    """Generates a random memorable college code."""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

def get_dynamic_event_status(event_date_str):
    """Calculates status based on current date vs event date."""
    if not event_date_str:
        return "Unknown"
    try:
        event_date = datetime.strptime(event_date_str, '%Y-%m-%d').date()
        today = date.today()
        if event_date > today:
            return "Upcoming"
        elif event_date == today:
            return "Ongoing"
        else:
            return "Completed"
    except Exception:
        return "Unknown"

def send_new_event_email(admin_id, event_name, event_date, event_description):
    """Sends email only to subscribers for the specific college (admin_id)."""
    with app.app_context():
        try:
            response = supabase.table("subscribers").select("email, name").eq("admin_id", admin_id).eq("status", "active").execute()
            subscribers = response.data
            
            if not subscribers:
                return True
                
            recipients = [sub['email'] for sub in subscribers]
            
            msg = Message(
                subject=f"New Event Created: {event_name}!",
                sender=app.config.get("MAIL_USERNAME"),
                bcc=recipients
            )
            
            safe_name = escape(event_name)
            safe_date = escape(str(event_date))
            safe_desc = escape(event_description)
            
            msg.html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0;">🎉 New Event Created!</h1>
                </div>
                <div style="background: #f9f9f9; padding: 25px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
                    <h2 style="color: #333; margin-top: 0;">{safe_name}</h2>
                    <p style="color: #555;"><strong>📅 Date:</strong> {safe_date}</p>
                    <p style="color: #555;"><strong>📝 Description:</strong></p>
                    <p style="color: #666; background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #11998e;">{safe_desc}</p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                    <p style="color: #888; font-size: 12px;">Visit the EventHub website to learn more and register!</p>
                </div>
            </div>
            """
            
            mail.send(msg)
            return True
        except Exception as e:
            logger.error(f"Error sending email notifications: {e}")
            return False

def send_event_update_email(admin_id, event_name, event_date, event_description):
    """Sends email to subscribers when an event is updated."""
    with app.app_context():
        try:
            response = supabase.table("subscribers").select("email, name").eq("admin_id", admin_id).eq("status", "active").execute()
            subscribers = response.data
            
            if not subscribers:
                return True
                
            recipients = [sub['email'] for sub in subscribers]
            
            msg = Message(
                subject=f"Event Updated: {event_name}",
                sender=app.config.get("MAIL_USERNAME"),
                bcc=recipients
            )
            
            safe_name = escape(event_name)
            safe_date = escape(str(event_date))
            safe_desc = escape(event_description)
            
            msg.html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0;">🔔 Event Updated</h1>
                </div>
                <div style="background: #f9f9f9; padding: 25px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
                    <h2 style="color: #333; margin-top: 0;">{safe_name}</h2>
                    <p style="color: #555;"><strong>📅 Date:</strong> {safe_date}</p>
                    <p style="color: #555;"><strong>📝 Description:</strong></p>
                    <p style="color: #666; background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #667eea;">{safe_desc}</p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                    <p style="color: #888; font-size: 12px;">This event has been updated. Please check the latest details on EventHub.</p>
                </div>
            </div>
            """
            
            mail.send(msg)
            logger.info(f"Update email sent to {len(recipients)} subscribers.")
            return True
        except Exception as e:
            logger.error(f"Error sending update email notifications: {e}")
            return False

# ===== Public Routes =====
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/subscribe", methods=["POST"])
def subscribe():
    data = request.json
    name = data.get("name")
    email = data.get("email")
    college_code = data.get("college_code")
    
    if not name or not email or not college_code:
        return jsonify({"error": "Name, email, and college code are required"}), 400
        
    try:
        # Find admin_id for this college code
        admin_resp = supabase.table("admin_username_pass").select("id").eq("college_code", college_code).execute()
        if not admin_resp.data:
            return jsonify({"error": "Invalid college code"}), 400
        admin_id = admin_resp.data[0]['id']

        supabase.table("subscribers").insert({
            "name": name, 
            "email": email,
            "admin_id": admin_id
        }).execute()
        return jsonify({"success": True, "message": "Successfully subscribed to notifications!"})
    except Exception as e:
        err_str = str(e).lower()
        if "duplicate" in err_str or "unique constraint" in err_str:
            return jsonify({"error": "This email is already subscribed to this college."}), 400
        logger.error(f"Supabase error: {e}")
        return jsonify({"error": "An error occurred while subscribing."}), 500

@app.route("/event-details.html")
def event_details():
    return render_template("event-details.html")

# ===== Admin Authentication Routes =====
@app.route("/admin")
def admin_login_page():
    session.pop("admin", None)
    session.pop("admin_id", None)
    session.pop("college_code", None)
    return render_template("admin_login.html")

@app.route("/signup", methods=["GET", "POST"])
def admin_signup():
    if request.method == "GET":
        return render_template("admin_signup.html")
        
    username = request.form.get("username", "").strip()
    password = request.form.get("password", "").strip()
    college_name = request.form.get("college_name", "").strip()
    custom_code = request.form.get("college_code", "").strip()

    if not username or not password or not college_name:
        flash("Username, password, and college name are required")
        return redirect(url_for("admin_signup"))

    try:
        # Check if username exists
        user_check = supabase.table("admin_username_pass").select("id").eq("username", username).execute()
        if user_check.data:
            flash("Username already exists")
            return redirect(url_for("admin_signup"))
            
        college_code = custom_code if custom_code else generate_random_code()
        
        # Check if code is unique, if not regenerate until unique
        while True:
            code_check = supabase.table("admin_username_pass").select("id").eq("college_code", college_code).execute()
            if not code_check.data:
                break # Unique!
            if custom_code:
                flash("Custom college code is already taken. Please choose another.")
                return redirect(url_for("admin_signup"))
            college_code = generate_random_code()

        hashed_password = generate_password_hash(password)
        
        supabase.table("admin_username_pass").insert({
            "username": username,
            "password": hashed_password,
            "college_name": college_name,
            "college_code": college_code
        }).execute()
        
        flash("Account created successfully! You can now log in.")
        return redirect(url_for("admin_login_page"))
    except Exception as e:
        logger.error(f"Database error during signup: {e}")
        flash("An error occurred during signup. Please try again.")
        return redirect(url_for("admin_signup"))

@app.route("/login", methods=["POST"])
def login():
    username = request.form.get("username", "").strip()
    password = request.form.get("password", "").strip()

    if not username or not password:
        flash("Username and password are required")
        return redirect(url_for("admin_login_page"))

    try:
        response = supabase.table("admin_username_pass").select("*").eq("username", username).execute()
        admin = response.data[0] if response.data else None

        if not admin:
            flash("Username doesn't exist.")
            return redirect(url_for("admin_login_page"))

        if check_password_hash(admin['password'], password):
            session["admin"] = username
            session["admin_id"] = admin["id"]
            session["college_code"] = admin["college_code"]
            return redirect(url_for("dashboard"))
        else:
            flash("Incorrect password.")
            return redirect(url_for("admin_login_page"))
    except Exception as e:
        logger.error(f"Database error during login: {e}")
        flash("An error occurred during login. Please try again.")
        return redirect(url_for("admin_login_page"))

@app.route("/dashboard")
def dashboard():
    if "admin" in session and "admin_id" in session:
        return render_template("admin_dashboard.html")
    else:
        return redirect(url_for("admin_login_page"))

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("admin_login_page"))

# ===== API Event Routes =====
@app.route("/api/colleges", methods=["GET"])
def get_colleges():
    """Public endpoint: returns all registered colleges for the dropdown."""
    try:
        response = supabase.table("admin_username_pass").select("username, college_name, college_code").execute()
        return jsonify(response.data)
    except Exception as e:
        logger.error(f"Database error: {e}")
        return jsonify({"error": "Failed to retrieve colleges."}), 500

@app.route("/api/all_events", methods=["GET"])
def get_all_events():
    """Public endpoint: returns events from ALL colleges for the landing page."""
    try:
        response = supabase.table("events").select("*").order("id", desc=True).execute()
        events = response.data
        for event in events:
            event['status'] = get_dynamic_event_status(event['date'])
        return jsonify(events)
    except Exception as e:
        logger.error(f"Database error: {e}")
        return jsonify({"error": "Failed to retrieve events."}), 500

@app.route("/api/events", methods=["GET"])
def get_events():
    try:
        # Check if request is from an admin (session) or public (query param)
        admin_id = None
        college_code = request.args.get('college_code')
        
        if college_code:
            # Public request with code
            admin_resp = supabase.table("admin_username_pass").select("id").eq("college_code", college_code).execute()
            if admin_resp.data:
                admin_id = admin_resp.data[0]['id']
            else:
                return jsonify({"error": "Invalid college code"}), 404
        elif "admin_id" in session:
            admin_id = session["admin_id"]
        else:
            return jsonify({"error": "Unauthorized or missing college code"}), 401

        # Fetch events for this specific admin
        response = supabase.table("events").select("*").eq("admin_id", admin_id).order("id", desc=True).execute()
        events = response.data
        
        # Dynamically calculate event status
        for event in events:
            event['status'] = get_dynamic_event_status(event['date'])
            
        return jsonify(events)
    except Exception as e:
        logger.error(f"Database error: {e}")
        return jsonify({"error": "Failed to retrieve events."}), 500

@app.route("/api/events", methods=["POST"])
def create_event():
    if "admin_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    try:
        name = request.form.get("name")
        date = request.form.get("date")
        category = request.form.get("category")
        organizer = request.form.get("organizer")
        description = request.form.get("description", "")
        registration_link = request.form.get("registration_link", "")
        sheet_link = request.form.get("responses_sheet_link", "")
        
        image_path = None
        if 'image' in request.files:
            file = request.files['image']
            if file and file.filename != '' and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                image_path = filename

        # Dynamic status will be calculated on fetch, but we store something initial
        initial_status = get_dynamic_event_status(date)

        data = {
            "name": name, "date": date, "category": category,
            "organizer": organizer, "status": initial_status, "description": description,
            "image_path": image_path, "registration_link": registration_link,
            "sheet_link": sheet_link,
            "admin_id": session["admin_id"]
        }
        
        response = supabase.table("events").insert(data).execute()
        new_id = response.data[0]['id'] if response.data else None
        
        try:
            send_new_event_email(session["admin_id"], name, date, description)
        except Exception as email_err:
            logger.warning(f"Failed to send email updates: {email_err}")
        
        return jsonify({"success": True, "message": "Event created", "id": new_id})
    except Exception as e:
        logger.error(f"Server error: {e}")
        return jsonify({"error": "An unexpected error occurred."}), 500

@app.route("/api/events/<int:id>", methods=["PUT"])
def update_event(id):
    if "admin_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    try:
        # Verify event belongs to admin
        verify_resp = supabase.table("events").select("admin_id").eq("id", id).execute()
        if not verify_resp.data or verify_resp.data[0]['admin_id'] != session["admin_id"]:
            return jsonify({"error": "Event not found or unauthorized"}), 404

        name = request.form.get("name")
        date = request.form.get("date")
        category = request.form.get("category")
        organizer = request.form.get("organizer")
        description = request.form.get("description", "")
        registration_link = request.form.get("registration_link", "")
        sheet_link = request.form.get("responses_sheet_link", "")
        
        response = supabase.table("events").select("image_path").eq("id", id).execute()
        image_path = response.data[0].get('image_path') if response.data else None
        
        if 'image' in request.files:
            file = request.files['image']
            if file and file.filename != '' and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                image_path = filename

        status = get_dynamic_event_status(date)

        data = {
            "name": name, "date": date, "category": category,
            "organizer": organizer, "status": status, "description": description,
            "image_path": image_path, "registration_link": registration_link,
            "sheet_link": sheet_link
        }
        
        supabase.table("events").update(data).eq("id", id).execute()
        
        # Send update notification email to subscribers
        try:
            send_event_update_email(session["admin_id"], name, date, description)
        except Exception as email_err:
            logger.warning(f"Failed to send update email: {email_err}")
        
        return jsonify({"success": True, "message": "Event updated"})
    except Exception as e:
        logger.error(f"Server error: {e}")
        return jsonify({"error": "An unexpected error occurred."}), 500

@app.route("/api/events/<int:id>", methods=["DELETE"])
def delete_event(id):
    if "admin_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    try:
        # Verify ownership
        response = supabase.table("events").select("admin_id, image_path").eq("id", id).execute()
        if not response.data or response.data[0]['admin_id'] != session["admin_id"]:
            return jsonify({"error": "Event not found or unauthorized"}), 404
            
        image_path = response.data[0].get('image_path')
        
        supabase.table("events").delete().eq("id", id).execute()
        
        if image_path:
            image_file = os.path.join(app.config['UPLOAD_FOLDER'], image_path)
            if os.path.exists(image_file):
                try:
                    os.remove(image_file)
                except OSError as file_err:
                    logger.warning(f" Could not delete image file {image_file}: {file_err}")
                    
        return jsonify({"success": True, "message": "Event deleted"})
    except Exception as e:
        logger.error(f"Database error: {e}")
        return jsonify({"error": "Failed to delete event."}), 500

# ===== API Student Routes =====
@app.route("/api/events/<int:event_id>/students", methods=["GET"])
def get_students(event_id):
    if "admin_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        # Check event ownership
        ev_resp = supabase.table("events").select("admin_id").eq("id", event_id).execute()
        if not ev_resp.data or ev_resp.data[0]['admin_id'] != session["admin_id"]:
            return jsonify({"error": "Unauthorized"}), 401

        response = supabase.table("event_registrations").select("*").eq("event_id", event_id).order("id", desc=True).execute()
        return jsonify(response.data)
    except Exception as e:
        logger.error(f"Database error: {e}")
        return jsonify({"error": "Failed to retrieve students."}), 500

@app.route("/api/events/<int:event_id>/sync_students", methods=["POST"])
def sync_students(event_id):
    if "admin_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    try:
        response = supabase.table("events").select("sheet_link, admin_id").eq("id", event_id).execute()
        event = response.data[0] if response.data else None
        
        if not event or event['admin_id'] != session["admin_id"]:
            return jsonify({"error": "Unauthorized"}), 401
            
        if not event.get('sheet_link'):
            return jsonify({"error": "No Google Sheet responses link is configured."}), 400
            
        sheet_id = extract_sheet_id(event['sheet_link'])
        if not sheet_id:
            return jsonify({"error": "Invalid Google Sheet link."}), 400
        
        scope = [
            "https://spreadsheets.google.com/feeds",
            "https://www.googleapis.com/auth/drive"
        ]
        
        creds_path = os.path.join(app.root_path, "credentials.json")
        if not os.path.exists(creds_path):
             return jsonify({"error": "Server is missing Google Sheets credentials."}), 500
             
        creds = ServiceAccountCredentials.from_json_keyfile_name(creds_path, scope)
        client = gspread.authorize(creds)
        
        try:
            sheet = client.open_by_key(sheet_id).sheet1
            rows = sheet.get_all_records()
        except Exception as sheet_err:
            return jsonify({"error": f"Failed to open Google Sheet: {sheet_err}"}), 400

        if not rows:
             return jsonify({"success": True, "message": "Sheet is empty, no students synced.", "added": 0})
             
        headers = list(rows[0].keys())
        name_col = next((h for h in headers if "name" in str(h).lower()), None)
        email_col = next((h for h in headers if "email" in str(h).lower() or "mail" in str(h).lower()), None)
        
        if not name_col or not email_col:
             return jsonify({"error": "Could not auto-detect Name and Email columns."}), 400

        reg_resp = supabase.table("event_registrations").select("student_email").eq("event_id", event_id).execute()
        existing_emails = {row['student_email'].strip().lower() for row in reg_resp.data}
        
        to_insert = []
        added_count = 0
        
        for row in rows:
            student_name = str(row.get(name_col, "")).strip()
            student_email = str(row.get(email_col, "")).strip()
            
            if not student_name or not student_email:
                continue
                
            email_lower = student_email.lower()
            if email_lower not in existing_emails:
                to_insert.append({
                    "event_id": event_id,
                    "student_name": student_name,
                    "student_email": student_email,
                    "attended": False
                })
                existing_emails.add(email_lower)
                added_count += 1
                
        if to_insert:
            supabase.table("event_registrations").insert(to_insert).execute()
            
        return jsonify({"success": True, "message": f"Successfully synced {added_count} new students!", "added": added_count})
        
    except Exception as ex:
        logger.error(f"Server error: {ex}")
        return jsonify({"error": "An unexpected error occurred during sync."}), 500

@app.route("/api/events/<int:event_id>/students", methods=["POST"])
def add_student(event_id):
    if "admin_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    try:
        data = request.json
        name = data.get("name")
        email = data.get("email")
        
        if not name or not email:
            return jsonify({"error": "Name and email are required"}), 400

        response = supabase.table("event_registrations").insert({
            "event_id": event_id,
            "student_name": name,
            "student_email": email
        }).execute()
        
        new_id = response.data[0]['id'] if response.data else None
        return jsonify({"success": True, "message": "Student added", "id": new_id})
    except Exception as e:
        logger.error(f"Database error: {e}")
        return jsonify({"error": "Failed to add student."}), 500

@app.route("/api/students/batch_attendance", methods=["PUT"])
def batch_update_attendance():
    if "admin_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    try:
        data = request.json
        updates = data.get("updates", [])
        
        if not updates:
            return jsonify({"success": True, "message": "No updates provided"})

        for item in updates:
            supabase.table("event_registrations").update({"attended": item['attended']}).eq("id", item['id']).execute()
            
        return jsonify({"success": True, "message": f"Successfully updated {len(updates)} records"})
    except Exception as e:
        logger.error(f"Database error: {e}")
        return jsonify({"error": "Failed to update attendance."}), 500

@app.route("/api/students/<int:student_id>", methods=["DELETE"])
def delete_student(student_id):
    if "admin_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    try:
        supabase.table("event_registrations").delete().eq("id", student_id).execute()
        return jsonify({"success": True, "message": "Student removed"})
    except Exception as e:
        logger.error(f"Database error: {e}")
        return jsonify({"error": "Failed to remove student."}), 500

# ===== API Reports Routes =====
@app.route("/api/reports", methods=["GET"])
def get_reports():
    if "admin_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        # Fetch events for this admin
        events_resp = supabase.table("events").select("id, name, category, date").eq("admin_id", session["admin_id"]).order("date", desc=True).execute()
        
        events_map = {e['id']: e for e in events_resp.data}
        for e in events_map.values():
            e['total_registered'] = 0
            e['total_attended'] = 0
            e['status'] = get_dynamic_event_status(e['date'])
            
        if events_map:
            # Fetch registrations only for these events. Since simple wrapper lacks 'in' operator natively easily, we fetch all and filter.
            regs_resp = supabase.table("event_registrations").select("event_id, attended").execute()
            for r in regs_resp.data:
                if r['event_id'] in events_map:
                    events_map[r['event_id']]['total_registered'] += 1
                    if r['attended']:
                        events_map[r['event_id']]['total_attended'] += 1
                    
        reports = list(events_map.values())
        reports.sort(key=lambda x: x['date'], reverse=True)
        
        return jsonify(reports)
    except Exception as e:
        logger.error(f"Database error: {e}")
        return jsonify({"error": "Failed to retrieve reports."}), 500

# ===== Settings API =====
@app.route("/api/settings/credentials", methods=["PUT"])
def update_credentials():
    if "admin_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        data = request.json
        new_username = data.get("new_username", "").strip()
        new_password = data.get("new_password", "").strip()
        
        if not new_password:
            return jsonify({"error": "New password is required"}), 400

        hashed_password = generate_password_hash(new_password)
        current_id = session["admin_id"]
        
        if new_username:
            if new_username != session["admin"]:
                response = supabase.table("admin_username_pass").select("id").eq("username", new_username).execute()
                if response.data:
                    return jsonify({"error": "Username already taken"}), 400
            
            supabase.table("admin_username_pass").update({
                "username": new_username, 
                "password": hashed_password
            }).eq("id", current_id).execute()
            session["admin"] = new_username
        else:
            supabase.table("admin_username_pass").update({
                "password": hashed_password
            }).eq("id", current_id).execute()
            
        return jsonify({"success": True, "message": "Credentials updated"})
        
    except Exception as e:
        logger.error(f"Database error: {e}")
        return jsonify({"error": "Failed to update credentials."}), 500

if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
