import mysql.connector
from mysql.connector import Error

def create_table():
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
            CREATE TABLE IF NOT EXISTS events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                date DATE NOT NULL,
                category VARCHAR(100) NOT NULL,
                organizer VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL,
                description TEXT,
                image_path VARCHAR(255),
                registration_link VARCHAR(500),
                responses_sheet_link VARCHAR(500)
            )
            """
            cursor.execute(query)
            db.commit()
            print("Successfully created 'events' table.")
            cursor.close()
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
    finally:
        if db and db.is_connected():
            db.close()
            print("MySQL connection closed.")

if __name__ == "__main__":
    create_table()
