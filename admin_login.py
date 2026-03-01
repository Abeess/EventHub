import os
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from werkzeug.utils import secure_filename
import mysql.connector
from mysql.connector import Error
import gspread
from oauth2client.service_account import ServiceAccountCredentials
import re
import requests
from googleapiclient.discovery import build

app = Flask(__name__)
app.secret_key = "supersecretkey"

# Configuration for file uploads
UPLOAD_FOLDER = os.path.join('static', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Standardized DB Connection Method
def get_db_connection():
    try:
        db = mysql.connector.connect(
            host="127.0.0.1",
            user="root",
            password="root", 
            database="admin_login",
            auth_plugin='mysql_native_password'
        )
        return db
    except Error as e:
        print(f"Error connecting to database: {e}")
        return None

def extract_sheet_id(sheet_url):
    if not sheet_url:
        return None
    
    try:
        match = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', sheet_url)
        if match:
            return match.group(1)
        return None
    except Exception as e:
        print(f"Error extracting sheet ID: {e}")
        return None

# ===== Public Routes =====
@app.route("/")
def home():
    """Serves the public facing event hub website"""
    return render_template("index.html")

@app.route("/event-details.html")
def event_details():
    return render_template("event-details.html")

# ===== Admin Authentication Routes =====
@app.route("/admin")
def admin_login_page():
    if "admin" in session:
        return redirect(url_for("dashboard"))
    return render_template("admin_login.html")

@app.route("/login", methods=["POST"])
def login():
    db = get_db_connection()
    if db is None:
        flash("Database connection error. Please try again later.")
        return redirect(url_for("admin_login_page"))

    username = request.form.get("username", "").strip()
    password = request.form.get("password", "").strip()

    if not username or not password:
        flash("Username and password are required")
        return redirect(url_for("admin_login_page"))

    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM admin_username_pass WHERE username=%s AND password=%s",
            (username, password)
        )
        admin = cursor.fetchone()
        cursor.close()

        if admin:
            session["admin"] = username
            return redirect(url_for("dashboard"))
        else:
            flash("Invalid Username or Password")
            return redirect(url_for("admin_login_page"))
    except Error as e:
        print(f"Database error during login: {e}")
        flash("An error occurred during login. Please try again.")
        return redirect(url_for("admin_login_page"))
    finally:
        if db.is_connected():
            db.close()

@app.route("/dashboard")
def dashboard():
    if "admin" in session:
        return render_template("admin_dashboard.html")
    else:
        return redirect(url_for("admin_login_page"))

@app.route("/logout")
def logout():
    session.pop("admin", None)
    return redirect(url_for("admin_login_page"))

# ===== API Event Routes =====
@app.route("/api/events", methods=["GET"])
def get_events():
    db = get_db_connection()
    if db is None:
        return jsonify({"error": "Database connection error"}), 500
        
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT * FROM events ORDER BY id DESC")
        events = cursor.fetchall()
        
        # Convert date objects to strings for JSON serialization
        for event in events:
            if event['date']:
                event['date'] = event['date'].strftime('%Y-%m-%d')
                
        return jsonify(events)
    except Error as e:
        print(f"Database error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if db.is_connected():
            db.close()

@app.route("/api/events", methods=["POST"])
def create_event():
    # Only admins can create events
    if "admin" not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    db = get_db_connection()
    if db is None:
        return jsonify({"error": "Database connection error"}), 500
        
    try:
        name = request.form.get("name")
        date = request.form.get("date")
        category = request.form.get("category")
        organizer = request.form.get("organizer")
        status = request.form.get("status")
        description = request.form.get("description", "")
        registration_link = request.form.get("registration_link", "")
        sheet_link = request.form.get("responses_sheet_link", "")
        
        # Handle file upload
        image_path = None
        if 'image' in request.files:
            file = request.files['image']
            if file and file.filename != '' and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                # Store relative path for URL generation
                image_path = filename

        cursor = db.cursor()
        query = """
            INSERT INTO events (name, date, category, organizer, status, description, image_path, registration_link, sheet_link)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (name, date, category, organizer, status, description, image_path, registration_link, sheet_link))
        db.commit()
        new_id = cursor.lastrowid
        
        return jsonify({"success": True, "message": "Event created", "id": new_id})
    except Error as e:
        print(f"Database error: {e}")
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if db.is_connected():
            db.close()

@app.route("/api/events/<int:id>", methods=["PUT"])
def update_event(id):
    if "admin" not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    db = get_db_connection()
    if db is None:
        return jsonify({"error": "Database connection error"}), 500
        
    try:
        name = request.form.get("name")
        date = request.form.get("date")
        category = request.form.get("category")
        organizer = request.form.get("organizer")
        status = request.form.get("status")
        description = request.form.get("description", "")
        registration_link = request.form.get("registration_link", "")
        sheet_link = request.form.get("responses_sheet_link", "")
        
        cursor = db.cursor(dictionary=True)
        # Fetch current image path
        cursor.execute("SELECT image_path FROM events WHERE id = %s", (id,))
        current_event = cursor.fetchone()
        if not current_event:
             return jsonify({"error": "Event not found"}), 404
             
        image_path = current_event['image_path']
        
        # Handle file upload update
        if 'image' in request.files:
            file = request.files['image']
            if file and file.filename != '' and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                image_path = filename

        query = """
            UPDATE events 
            SET name=%s, date=%s, category=%s, organizer=%s, status=%s, description=%s, image_path=%s, registration_link=%s, sheet_link=%s
            WHERE id=%s
        """
        cursor.execute(query, (name, date, category, organizer, status, description, image_path, registration_link, sheet_link, id))
        db.commit()
        
        return jsonify({"success": True, "message": "Event updated"})
    except Error as e:
        print(f"Database error: {e}")
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if db.is_connected():
            db.close()

@app.route("/api/events/<int:id>", methods=["DELETE"])
def delete_event(id):
    if "admin" not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    db = get_db_connection()
    if db is None:
        return jsonify({"error": "Database connection error"}), 500
        
    try:
        cursor = db.cursor()
        # Fetch image path to delete file later
        cursor.execute("SELECT image_path FROM events WHERE id = %s", (id,))
        result = cursor.fetchone()
        
        cursor.execute("DELETE FROM events WHERE id = %s", (id,))
        db.commit()
        
        if cursor.rowcount > 0:
            return jsonify({"success": True, "message": "Event deleted"})
        else:
            return jsonify({"error": "Event not found"}), 404
    except Error as e:
        print(f"Database error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if db.is_connected():
            db.close()

# ===== API Student Routes =====
@app.route("/api/events/<int:event_id>/students", methods=["GET"])
def get_students(event_id):
    if "admin" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    db = get_db_connection()
    if db is None:
        return jsonify({"error": "Database connection error"}), 500
        
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT * FROM event_registrations WHERE event_id = %s ORDER BY id DESC", (event_id,))
        students = cursor.fetchall()
        return jsonify(students)
    except Error as e:
        print(f"Database error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if db.is_connected():
            db.close()

@app.route("/api/events/<int:event_id>/sync_students", methods=["POST"])
def sync_students(event_id):
    if "admin" not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    db = get_db_connection()
    if db is None:
        return jsonify({"error": "Database connection error"}), 500
        
    try:
        cursor = db.cursor(dictionary=True)
        # 1. Get the responses link
        cursor.execute("SELECT sheet_link FROM events WHERE id = %s", (event_id,))
        event = cursor.fetchone()
        
        if not event or not event.get('sheet_link'):
            return jsonify({"error": "No Google Sheet responses link is configured for this event. Please edit the event and provide the Responses Spreadsheet Link."}), 400
            
        sheet_id = extract_sheet_id(event['sheet_link'])
        if not sheet_id:
            return jsonify({"error": "Invalid Google Sheet link. Could not extract spreadsheet ID."}), 400
        
        # 2. Authenticate and fetch from Google Sheets
        scope = [
            "https://spreadsheets.google.com/feeds",
            "https://www.googleapis.com/auth/drive"
        ]
        
        # Determine current app directory for credentials.json location
        creds_path = os.path.join(app.root_path, "credentials.json")
        if not os.path.exists(creds_path):
             return jsonify({"error": "Server is missing Google Sheets credentials."}), 500
             
        creds = ServiceAccountCredentials.from_json_keyfile_name(creds_path, scope)
        client = gspread.authorize(creds)
        
        try:
            sheet = client.open_by_key(sheet_id).sheet1
            rows = sheet.get_all_records()
        except Exception as sheet_err:
            return jsonify({"error": f"Failed to open Google Sheet. Make sure the link is correct and the service account has 'Viewer' access. Details: {sheet_err}"}), 400

        if not rows:
             return jsonify({"success": True, "message": "Sheet is empty, no students synced.", "added": 0})
             
        # 3. Find column names that might represent Name and Email
        headers = list(rows[0].keys())
        name_col = next((h for h in headers if "name" in str(h).lower()), None)
        email_col = next((h for h in headers if "email" in str(h).lower() or "mail" in str(h).lower()), None)
        
        if not name_col or not email_col:
             return jsonify({"error": "Could not auto-detect Name and Email columns in the spreadsheet. Please ensure headers contain 'Name' and 'Email'."}), 400

        # 4. Fetch existing emails to prevent duplicates
        cursor.execute("SELECT student_email FROM event_registrations WHERE event_id = %s", (event_id,))
        existing_emails = {row['student_email'].strip().lower() for row in cursor.fetchall()}
        
        added_count = 0
        insert_query = "INSERT INTO event_registrations (event_id, student_name, student_email) VALUES (%s, %s, %s)"
        
        for row in rows:
            student_name = str(row.get(name_col, "")).strip()
            student_email = str(row.get(email_col, "")).strip()
            
            if not student_name or not student_email:
                continue
                
            email_lower = student_email.lower()
            if email_lower not in existing_emails:
                cursor.execute(insert_query, (event_id, student_name, student_email))
                existing_emails.add(email_lower)
                added_count += 1
                
        db.commit()
        return jsonify({"success": True, "message": f"Successfully synced {added_count} new students!", "added": added_count})
        
    except Error as e:
        print(f"Database error: {e}")
        return jsonify({"error": str(e)}), 500
    except Exception as ex:
        print(f"Server error: {ex}")
        return jsonify({"error": str(ex)}), 500
    finally:
        if db.is_connected():
            db.close()

@app.route("/api/events/<int:event_id>/students", methods=["POST"])
def add_student(event_id):
    if "admin" not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    db = get_db_connection()
    if db is None:
        return jsonify({"error": "Database connection error"}), 500
        
    try:
        data = request.json
        name = data.get("name")
        email = data.get("email")
        
        if not name or not email:
            return jsonify({"error": "Name and email are required"}), 400

        cursor = db.cursor()
        query = "INSERT INTO event_registrations (event_id, student_name, student_email) VALUES (%s, %s, %s)"
        cursor.execute(query, (event_id, name, email))
        db.commit()
        return jsonify({"success": True, "message": "Student added", "id": cursor.lastrowid})
    except Error as e:
        print(f"Database error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if db.is_connected():
            db.close()

@app.route("/api/students/batch_attendance", methods=["PUT"])
def batch_update_attendance():
    if "admin" not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    db = get_db_connection()
    if db is None:
        return jsonify({"error": "Database connection error"}), 500
        
    try:
        data = request.json
        updates = data.get("updates", [])
        
        if not updates:
            return jsonify({"success": True, "message": "No updates provided"})

        cursor = db.cursor()
        
        # Build batch query
        query = "UPDATE event_registrations SET attended = %s WHERE id = %s"
        update_data = [(item['attended'], item['id']) for item in updates]
        
        cursor.executemany(query, update_data)
        db.commit()
        return jsonify({"success": True, "message": f"Successfully updated {len(updates)} records"})
    except Error as e:
        print(f"Database error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if db.is_connected():
            db.close()

@app.route("/api/students/<int:student_id>", methods=["DELETE"])
def delete_student(student_id):
    if "admin" not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    db = get_db_connection()
    if db is None:
        return jsonify({"error": "Database connection error"}), 500
        
    try:
        cursor = db.cursor()
        cursor.execute("DELETE FROM event_registrations WHERE id = %s", (student_id,))
        db.commit()
        return jsonify({"success": True, "message": "Student removed"})
    except Error as e:
        print(f"Database error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if db.is_connected():
            db.close()

# ===== API Reports Routes =====
@app.route("/api/reports", methods=["GET"])
def get_reports():
    if "admin" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    db = get_db_connection()
    if db is None:
        return jsonify({"error": "Database connection error"}), 500
        
    try:
        cursor = db.cursor(dictionary=True)
        query = """
            SELECT 
                e.id, 
                e.name, 
                e.category,
                COUNT(r.id) as total_registered,
                SUM(CASE WHEN r.attended = 1 THEN 1 ELSE 0 END) as total_attended
            FROM events e
            LEFT JOIN event_registrations r ON e.id = r.event_id
            GROUP BY e.id, e.name, e.category
            ORDER BY e.date DESC
        """
        cursor.execute(query)
        reports = cursor.fetchall()
        
        # Ensure values aren't None for events with 0 registrations
        for report in reports:
            report['total_registered'] = report['total_registered'] or 0
            # MySQL SUM returns Decimal or None, need to convert to int explicitly
            report['total_attended'] = int(report['total_attended']) if report['total_attended'] is not None else 0

        return jsonify(reports)
    except Error as e:
        print(f"Database error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if db.is_connected():
            db.close()

# ===== Settings API =====
@app.route("/api/settings/credentials", methods=["PUT"])
def update_credentials():
    if "admin" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    db = get_db_connection()
    if db is None:
        return jsonify({"error": "Database connection error"}), 500
        
    try:
        data = request.json
        new_username = data.get("new_username", "").strip()
        new_password = data.get("new_password", "").strip()
        
        if not new_password:
            return jsonify({"error": "New password is required"}), 400
            
        cursor = db.cursor()
        current_username = session["admin"]
        
        if new_username:
            # Check if new username already exists (and is not the current one)
            if new_username != current_username:
                cursor.execute("SELECT id FROM admin_username_pass WHERE username = %s", (new_username,))
                if cursor.fetchone():
                    return jsonify({"error": "Username already taken"}), 400
            
            cursor.execute(
                "UPDATE admin_username_pass SET username=%s, password=%s WHERE username=%s",
                (new_username, new_password, current_username)
            )
            session["admin"] = new_username # Update session
        else:
            cursor.execute(
                "UPDATE admin_username_pass SET password=%s WHERE username=%s",
                (new_password, current_username)
            )
            
        db.commit()
        return jsonify({"success": True, "message": "Credentials updated"})
        
    except Error as e:
        print(f"Database error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if db.is_connected():
            db.close()

if __name__ == "__main__":
    app.run(debug=True)
