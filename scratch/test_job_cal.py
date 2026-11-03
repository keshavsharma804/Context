import requests
import sqlite3

# 1. Fetch current jobs
r = requests.get('http://127.0.0.1:3000/api/jobs')
print('Jobs before:', r.json().get('applications'))

# 2. Add an application with interview
payload = {
    'company': 'Linear',
    'role': 'Product Engineer',
    'status': 'interview',
    'interview_at': '2026-11-12T14:30',
    'url': 'https://linear.app/careers'
}
r2 = requests.post('http://127.0.0.1:3000/api/jobs/add', json=payload)
print('Add job response:', r2.json())

# 3. Check /calendar for this month
r3 = requests.get('http://127.0.0.1:3000/api/calendar?start=2026-11-01&end=2026-11-30')
cal = r3.json()
print('Calendar applications:', [a['company'] for a in cal.get('applications', [])])
print('Calendar interviews:', [i['company'] for i in cal.get('interviews', [])])
print('Calendar events matching interview:', [e['title'] for e in cal.get('events', []) if 'Linear' in e.get('title', '')])

# 4. Clean up the test job
r4 = requests.post('http://127.0.0.1:3000/api/jobs/delete', json={'company': 'Linear'})
print('Delete job response:', r4.json())

# 5. Clean up any calendar event created for Linear
conn = sqlite3.connect('context.db')
conn.execute("DELETE FROM events WHERE title LIKE '%Linear%'")
conn.execute("DELETE FROM interviews WHERE company = 'Linear'")
conn.execute("DELETE FROM companies WHERE name = 'Linear'")
conn.commit()
conn.close()

# 6. Final check
r5 = requests.get('http://127.0.0.1:3000/api/jobs')
print('Final jobs count:', len(r5.json().get('applications', [])))
print('Final interviews count:', len(r5.json().get('interviews', [])))
