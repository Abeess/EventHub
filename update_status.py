import mysql.connector

try:
    db = mysql.connector.connect(host='127.0.0.1', user='root', password='root', database='admin_login', auth_plugin='mysql_native_password')
    cursor = db.cursor()
    cursor.execute("UPDATE events SET status='Completed' WHERE status='Finished'")
    db.commit()
    print('Updated rows:', cursor.rowcount)
except Exception as e:
    print(e)
