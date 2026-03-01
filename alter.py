import mysql.connector
from mysql.connector import Error

def alter_table():
    try:
        db = mysql.connector.connect(
            host="127.0.0.1",
            user="root",
            password="root", 
            database="admin_login",
            auth_plugin='mysql_native_password'
        )
        if db.is_connected():
            cursor = db.cursor()
            query = """
            ALTER TABLE events ADD COLUMN spreadsheet_id VARCHAR(255);
            """
            cursor.execute(query)
            db.commit()
            print("Successfully altered 'events' table.")
            cursor.close()
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
    finally:
        if db and db.is_connected():
            db.close()

if __name__ == "__main__":
    alter_table()
