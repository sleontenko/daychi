"""Run on the server. Exercise enrollment without printing credentials or sending push."""
from pathlib import Path
import requests
from practice_api.reminder_store import ReminderStore

store = ReminderStore(Path('/Users/mac-mini-server/.config/quiet-practice/devices.sqlite3'))
base = 'http://127.0.0.1:8765/api/v1/device'
code = store.create_pairing_code()
response = requests.post(base + '/pair', json={'code': code}, timeout=10)
response.raise_for_status()
token = response.json()['token']
device = store.authenticate(token)
headers = {'Authorization': 'Bearer ' + token}
try:
    assert requests.post(base + '/pair', json={'code': code}, timeout=10).status_code == 401
    result = requests.put(base + '/choices', headers=headers, json={'choices': [
        {'occurrence_id': 'deployment-check', 'minutes_before': 30}]}, timeout=10)
    result.raise_for_status()
    assert requests.get(base + '/choices', headers=headers, timeout=10).json()['choices'][0]['occurrence_id'] == 'deployment-check'
    assert requests.get(base + '/choices', timeout=10).status_code == 401
    requests.delete(base, headers=headers, timeout=10).raise_for_status()
    assert requests.get(base + '/choices', headers=headers, timeout=10).status_code == 401
    print('PASS: enrollment, one-use code, authenticated choices, revocation; no push sent')
finally:
    store.revoke(device)
